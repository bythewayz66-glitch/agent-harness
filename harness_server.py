#!/usr/bin/env python3
"""
Agent Harness server
- Serves the static app
- Proxies LLM calls: keyless Pollinations (throttled) or keyed multi-provider (unthrottled)
- Enforces a hard global throttle of 1 request / 30 seconds ONLY for keyless Pollinations
"""
import json, os, threading, time, urllib.request, urllib.error
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
INTERVAL = 30.0  # seconds between keyless LLM calls (hard limit)
BUFFER = 2.0     # safety margin: upstream counts from reply completion
UPSTREAM = "https://text.pollinations.ai/openai"

_lock = threading.Lock()
_call_lock = threading.Lock()
_next_allowed = 0.0
_queue_depth = 0
_last_call = 0.0

OPENAI_COMPAT = {
    "openai":      "https://api.openai.com/v1/chat/completions",
    "groq":        "https://api.groq.com/openai/v1/chat/completions",
    "together":    "https://api.together.xyz/v1/chat/completions",
    "openrouter":  "https://openrouter.ai/api/v1/chat/completions",
    "deepseek":    "https://api.deepseek.com/chat/completions",
    "xai":         "https://api.x.ai/v1/chat/completions",
    "mistral":     "https://api.mistral.ai/v1/chat/completions",
    "fireworks":   "https://api.fireworks.ai/inference/v1/chat/completions",
    "perplexity":  "https://api.perplexity.ai/chat/completions",
    "huggingface": "https://router.huggingface.co/v1/chat/completions",
    "pollinations": "https://text.pollinations.ai/openai",
}

DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "groq": "llama-3.3-70b-versatile",
    "together": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "openrouter": "openai/gpt-4o-mini",
    "deepseek": "deepseek-chat",
    "xai": "grok-2-latest",
    "mistral": "mistral-large-latest",
    "fireworks": "accounts/fireworks/models/llama-v3p3-70b-instruct",
    "perplexity": "sonar",
    "huggingface": "meta-llama/Llama-3.1-8B-Instruct",
    "pollinations": "openai-fast",
}

UI_MODELS = {"gpt-4o", "gpt-4o-mini", "claude-3.5-sonnet", "claude-3-opus",
             "gemini-1.5-pro", "llama-3.1-70b", "mistral-large", "local:ollama"}


def _http(url, data, headers, timeout=180):
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b'{"error":"upstream http error"}')


def _openai_call(payload, provider, key):
    url = OPENAI_COMPAT[provider]
    body = dict(payload)
    body.pop("_provider", None)
    body.pop("_apiKey", None)
    if not body.get("model") or body.get("model") in UI_MODELS:
        body["model"] = DEFAULT_MODELS.get(provider, body.get("model"))
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://agent-harness.local"
        headers["X-Title"] = "Agent Harness"
    return _http(url, json.dumps(body).encode(), headers)


def _anthropic_call(payload, key):
    msgs = payload.get("messages", [])
    system = "\n".join(m["content"] for m in msgs if m.get("role") == "system")
    convo = [{"role": m["role"], "content": m["content"]} for m in msgs if m.get("role") != "system"]
    body = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": payload.get("max_tokens", 1024),
        "temperature": payload.get("temperature", 0.6),
        "messages": convo,
    }
    if system:
        body["system"] = system
    headers = {"Content-Type": "application/json", "x-api-key": key or "",
               "anthropic-version": "2023-06-01"}
    status, raw = _http("https://api.anthropic.com/v1/messages", json.dumps(body).encode(), headers)
    if status != 200:
        return status, raw
    d = json.loads(raw)
    text = "".join(b.get("text", "") for b in d.get("content", []) if b.get("type") == "text")
    return 200, json.dumps({"choices": [{"message": {"role": "assistant", "content": text}}],
                            "model": d.get("model"), "provider": "anthropic"}).encode()


def _google_call(payload, key):
    msgs = payload.get("messages", [])
    system = "\n".join(m["content"] for m in msgs if m.get("role") == "system")
    contents = [{"role": "model" if m.get("role") == "assistant" else "user",
                 "parts": [{"text": m["content"]}]}
                for m in msgs if m.get("role") != "system"]
    body = {"contents": contents, "generationConfig": {
        "temperature": payload.get("temperature", 0.6),
        "maxOutputTokens": payload.get("max_tokens", 1024)}}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    url = ("https://generativelanguage.googleapis.com/v1beta/models/"
           "gemini-1.5-flash:generateContent?key=" + (key or ""))
    status, raw = _http(url, json.dumps(body).encode(), {"Content-Type": "application/json"})
    if status != 200:
        return status, raw
    d = json.loads(raw)
    try:
        text = d["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        text = ""
    return 200, json.dumps({"choices": [{"message": {"role": "assistant", "content": text}}],
                            "provider": "google"}).encode()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-LLM-Key, X-LLM-Provider")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/llm/status"):
            with _lock:
                wait = max(0.0, _next_allowed - time.monotonic())
            body = json.dumps({"interval": INTERVAL, "waitSeconds": round(wait, 1),
                               "queueDepth": _queue_depth, "lastCall": _last_call,
                               "upstream": UPSTREAM, "provider": "pollinations",
                               "keylessThrottle": True}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def do_POST(self):
        if not self.path.startswith("/api/llm"):
            self.send_error(404)
            return

        global _next_allowed, _queue_depth, _last_call

        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode() or "{}")
        except Exception:
            self._json(400, {"error": "invalid json"})
            return

        provider = (payload.get("_provider") or self.headers.get("X-LLM-Provider") or "pollinations").lower()
        key = payload.get("_apiKey") or self.headers.get("X-LLM-Key") or ""

        # keyed providers: no throttle
        if key:
            try:
                if provider == "anthropic":
                    status, body = _anthropic_call(payload, key)
                elif provider == "google":
                    status, body = _google_call(payload, key)
                elif provider in OPENAI_COMPAT:
                    status, body = _openai_call(payload, provider, key)
                else:
                    self._json(400, {"error": f"unsupported provider '{provider}'"})
                    return
                _last_call = time.time()
            except Exception as e:
                self._json(502, {"error": f"upstream failed: {e}"})
                return
            self._send(status, body)
            return

        # keyless pollinations: hard global throttle
        with _call_lock:
            _queue_depth += 1
            try:
                wait = max(0.0, _next_allowed - time.monotonic())
                if wait > 0:
                    time.sleep(wait)
                bp = dict(payload)
                bp.pop("_provider", None)
                bp.pop("_apiKey", None)
                try:
                    status, body = _http(UPSTREAM, json.dumps(bp).encode(),
                                         {"Content-Type": "application/json",
                                          "Accept": "application/json"})
                    _last_call = time.time()
                except Exception as e:
                    self._json(502, {"error": f"upstream failed: {e}"})
                    return
                finally:
                    _next_allowed = time.monotonic() + INTERVAL + BUFFER
            finally:
                _queue_depth -= 1

        self._send(status, body)

    def _send(self, status, body):
        self.send_response(status if status < 500 else 502)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj).encode())


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    srv = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Agent Harness on http://0.0.0.0:{port}  (keyless throttle: 1/{INTERVAL:.0f}s)")
    srv.serve_forever()
