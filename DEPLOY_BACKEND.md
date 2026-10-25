# Deploying the Agent Harness backend

The app is a static SPA. It runs **fully standalone** — keyed providers are called
directly from the browser (all of OpenAI, Anthropic, Google, Groq, OpenRouter,
Mistral, Together, DeepSeek, xAI and Perplexity send CORS headers), and keyless
Pollinations is throttled client-side at 1 request / 30 s.

You only need the backend if you want:

* keys to stay **server-side** instead of in browser memory,
* a **shared** 1/30 s keyless throttle across tabs and users,
* one place to route every provider through a single OpenAI-compatible endpoint.

`harness_server.py` is a single file, **standard library only** — no pip installs.

## Local

```bash
PORT=8091 python harness_server.py
# → http://localhost:8091  (app + /api/llm + /api/llm/status)
```

## Docker (any host)

```bash
docker build -t agent-harness .
docker run -p 8091:8091 -e PORT=8091 agent-harness
```

## Render (free tier, easiest)

1. Push this folder to a GitHub repo.
2. Render → **New → Blueprint** → select the repo (it reads `render.yaml`).
3. Wait for the build, copy `https://<service>.onrender.com`.
4. In the app: **API Keys → Runtime & Backend → Backend URL** → paste → **Save** → **Test**.

## Fly.io

```bash
fly launch --no-deploy --name agent-harness-<yourname>
fly deploy
```

Then paste `https://agent-harness-<yourname>.fly.dev` into the Backend URL field.

## Railway

```bash
railway init
railway up
```

`railway.json` sets the Dockerfile builder and the `/api/llm/status` healthcheck.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/llm/status` | `{interval, waitSeconds, queueDepth, lastCall, upstream, keylessThrottle}` |
| `POST` | `/api/llm` | Body: `{model, messages, temperature, max_tokens, _provider, _apiKey?}` |

`_apiKey` present → routed to that provider, **no throttle**.
`_apiKey` absent → keyless Pollinations, **hard 1/30 s** global throttle.

## Verifying

```bash
curl -s https://<your-backend>/api/llm/status
# {"interval": 30.0, "waitSeconds": 0.0, "queueDepth": 0, ...}
```

The pill in the top bar turns green (**backend live**) and the Runtime card in
API Keys shows the proxy URL.
