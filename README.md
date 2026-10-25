# Agent Harness — Multi-Agent Orchestration Console

A local-first web harness for composing and running multi-agent teams, with three execution modes, a shared workspace, shared MCP servers and APIs, a builtin tools/skills library, and import/export for **Teamily.AI** and **gamut.io**.

## Run it

```bash
python3 harness_server.py          # http://localhost:8090
PORT=8091 python3 harness_server.py
```

The server does two jobs:

1. Serves the static app (`index.html`, `styles.css`, `app.js`).
2. Proxies keyless LLM calls to **Pollinations.ai** at `POST /api/llm`, enforcing a hard global throttle.

`GET /api/llm/status` returns the current throttle state.

> If you host the static files somewhere without the proxy (e.g. S3/Pages), the client automatically falls back to calling `https://text.pollinations.ai/openai` directly (CORS-enabled) and still applies the 30s throttle client-side.

## LLM provider — Pollinations.ai (keyless)

- No API key required.
- Free tier model: `openai-fast` (GPT-OSS 20B). All friendly model names in the UI map to it.
- **Hard throttle: 1 request / 30 seconds per IP.**

### How the throttle is enforced

| Layer | Behaviour |
|---|---|
| Server (`harness_server.py`) | A global lock fully serializes calls; the next slot is scheduled from the **reply completion** time + 30s + 2s safety buffer. |
| Client (`app.js`) | A promise chain serializes calls; spacing is measured from the previous response, plus a live countdown in the console. |
| Retry | On HTTP `402` / `429` / `5xx`, the client parses `Retry after Ns` and retries up to 3 times. |

Because every LLM call waits ~30s, a run costs roughly `calls × 30s`:

| Mode | Typical calls | Approx. time |
|---|---|---|
| Single | 3 (plan, agent, synthesis) | ~1.5 min |
| Mix | 4–6 | ~2–3 min |
| Swarm (4 agents) | 6–7 | ~3–4 min |

Switch **LLM Provider → Simulated** in the Orchestrator panel to exercise the UI without network calls.

## Modes

- **Single** — one best-fit agent owns the whole task.
- **Swarm** — the orchestrator decomposes the task and fans subtasks across every agent, then merges. Add agents on demand.
- **Mix of Agents** — hybrid: route each subtask to a best-fit lead and consult specialists.

## Orchestrator — per-mode settings

Each of the three modes stores **its own** orchestrator settings: name, model, provider, temperature, max delegation depth, max agents and the reviewer toggle. Switching modes saves the outgoing set and loads the incoming one, so a Swarm run can use a hot temperature and 8-deep delegation while Single stays cold and shallow.

| Setting | Single | Swarm | Mix |
|---|---|---|---|
| Temperature | 0.4 | 0.6 | 0.5 |
| Max depth | 4 | 8 | 6 |
| Max agents | 1 | 0 (whole roster) | 4 |
| Reviewer pass | off | on | on |

The system prompt is injected into both the planning call and the final synthesis call. A banner at the top of the Orchestrator view always shows which mode you are editing.

## GitHub discovery

Skills, Apps and MCP servers can be found and added without leaving the app:

- **Tools & Skills → Skills → 🐙 Find on GitHub**
- **Tools & Skills → Apps & Integrations → 🐙 Find on GitHub**
- **MCP Servers → 🐙 Find on GitHub**

Each opens a search modal backed by the GitHub REST search API (`/search/repositories`, sorted by stars). One click adds the repo as a skill, an app tile, or an MCP server (with a sensible `npx -y <package>` stdio command). Unauthenticated search allows 10 requests/minute; a GitHub token in the API Keys vault raises that to 30/minute (and the core API to 5,000/hour).

## Shared workspace

One filesystem, read + write for every agent. Each agent writes its deliverable to a skill-appropriate folder (`src/`, `docs/`, `research/`, `design/`, `notes/`), and the orchestrator writes the consolidated `FINAL.md`.

## Shared resources

- **MCP servers** — stdio / http / sse, attached once and available to all agents.
- **APIs** — base URL, auth type, key; shared across the team.
- **Builtin tools & skills** — 16 tools and 12 skills, toggleable, assignable per agent.

## Import / export

- **Teamily.AI**: `platform: "teamily.ai"`, agents with `persona`, `avatar`, `description`, `mcpServers`.
- **gamut.io**: `platform: "gamut.io"`, agents with `displayName`, `icon`, `instructions`, `llm`, `capabilities`, `integrations`.
- **Generic harness**: full state including orchestrator, MCP servers and APIs.

Import auto-detects the platform, normalizes fields, and maps tool/skill names to ids. Export produces copyable JSON or a download.


## API keys vault

The **API Keys** tab holds credentials for 28 providers across 5 groups (LLM, Media, Audio, 3D, Platform). Keys are stored in `localStorage` and injected server-side per request — they never leave your machine except to the provider you are calling.

- **Keyed providers are unthrottled.** Pick one in the Orchestrator's *LLM Provider* dropdown (Anthropic, Google, Groq, Together, OpenRouter, DeepSeek, xAI, Mistral, Fireworks, Perplexity) and calls route directly through your key.
- **A Pollinations pollen key removes the 30s throttle.** Save it under the Pollinations card and the keyless throttle is lifted automatically.
- Custom keys can be added for internal APIs and referenced by the `http_request` tool.

## Runtime & Backend (direct mode vs proxy)

The **API Keys → Runtime & Backend** card controls how LLM calls are routed, and a pill in the top bar shows the live state (`backend live` / `direct mode`).

**Direct mode (default, no server needed).** With a key saved, the browser calls the provider directly over CORS: Anthropic, Gemini, Groq, OpenRouter, Mistral, Together, DeepSeek, xAI and Perplexity all work. OpenAI is deliberately not offered — it withholds CORS headers on real responses, so it can only work behind a proxy; use OpenRouter for GPT-4o class models.

**Proxy mode.** Paste a Backend URL and the app routes every call through `harness_server.py`, keeping keys server-side and enforcing one shared 1/30s keyless throttle. The proxy is a single stdlib-only Python file and ships with deploy configs:

```
Dockerfile          container build
render.yaml         Render blueprint (free tier)
fly.toml            Fly.io config
railway.json        Railway config
Procfile            Heroku-style dyno
DEPLOY_BACKEND.md   step-by-step for all four
```

```bash
docker build -t agent-harness . && docker run -p 8091:8091 agent-harness
```

## Pipelines

The **Pipelines** tab stores reusable content-production blueprints. Load the starter set (7 blueprints) or build your own:

| Blueprint | Produces |
|---|---|
| 3D Model Pipeline | concept → prompt → mesh → retopo → texture → GLTF/FBX |
| Audio Asset Pipeline | SFX/voice brief → script → synthesis → mastering → loudness QA |
| Music Generation | style brief → structure → generation → stem split → mixdown |
| Video Production | script → storyboard → shots → edit → captions → export |
| Image Asset | art direction → prompt set → generation → upscale → brand QA |
| Long-Form Content | research → outline → draft → fact-check → SEO → publish |
| Game Asset | concept → model → rig → texture → engine import |

Each stage is bound to an agent, a builtin tool and an output path. **Run** executes the stages in order through the agent team and writes the result into the shared workspace.

## Workspace access

The **Workspace** tab is the shared filesystem every agent reads and writes. You can:

- **Upload** files (text and binary — images preview inline)
- **Edit and save** any file directly
- **Download** the selected file or **export the whole workspace** as JSON
- See who last edited each file and live char/line counts

## Mobile

The whole app is responsive. Below 900px the sidebar becomes an off-canvas drawer (hamburger + scrim), the mode switch goes full-width, grids collapse to one column, and the pipeline stage editor stacks. Verified at 390px and 820px with no horizontal overflow.

## Running

```bash
PORT=8091 python3 harness_server.py
# open http://localhost:8091
```

The server exposes `GET /api/llm/status` and `POST /api/llm`. Keyless Pollinations calls are serialized and spaced 30s + 2s buffer from reply completion; keyed calls skip the queue entirely.

## Files

```
index.html          app shell and views
styles.css          dark console theme
app.js              state, views, CRUD, import/export, orchestration engine
harness_server.py   static server + multi-provider LLM proxy (keyless throttle / keyed direct)
Dockerfile          backend container
render.yaml         Render blueprint
fly.toml            Fly.io config
railway.json        Railway config
Procfile            process definition
DEPLOY_BACKEND.md   backend deployment guide
dist/               clean static bundle for static hosting
```
