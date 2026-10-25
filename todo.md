# Agent Harness Build

## Setup
- [x] Create project structure (index.html, styles.css, app.js)
- [x] Define data model + localStorage persistence

## Core UI
- [x] Layout: sidebar, topbar with 3-mode switch, main panels
- [x] Orchestrator panel with editable system prompt + model/temp
- [x] Agents manager (add/edit/remove agents, per-agent prompt, model, tools, skills, mcp, apis)
- [x] Shared workspace file explorer with read/write
- [x] MCP servers manager (multiple, shared)
- [x] APIs manager (multiple, shared)
- [x] Builtin tools & skills library with toggles

## Modes
- [x] Single mode
- [x] Swarm mode (add agents on demand)
- [x] Mix of Agents mode

## Import / Export
- [x] Import Teamily.AI exported agents
- [x] Import gamut.io exported agents
- [x] Import generic JSON
- [x] Export to Teamily.AI format
- [x] Export to gamut.io format
- [x] Export generic JSON

## Pollinations integration
- [x] Verify keyless Pollinations endpoint from sandbox
- [x] Proxy server with server-side 30s throttle (completion-based + buffer)
- [x] Client-side throttle queue with live countdown
- [x] 402/429 retry with Retry-after parsing
- [x] Real orchestration: plan -> agents -> review -> synthesis -> FINAL.md
- [x] Provider selector (Pollinations / Simulated)
- [x] Verify end-to-end run in browser

## Delivery
- [x] Serve + expose port
- [x] README
- [x] Attach files

## Round 3 — Keys vault, pipelines, mobile, workspace access
- [x] API Keys vault: 28 providers in 5 groups, per-provider save/clear
- [x] Custom key support
- [x] Server: keyed multi-provider routing (OpenAI, Anthropic, Google, Groq, Together, OpenRouter, DeepSeek, xAI, Mistral, Fireworks, Perplexity)
- [x] Server: Pollinations key bypasses the 30s throttle
- [x] Client: skip local countdown when a key is present
- [x] Orchestrator provider dropdown built from keyed providers + throttle hint
- [x] Pipelines tab: 7 starter content blueprints (3D, audio, music, video, image, long-form, game)
- [x] Pipeline editor: name/icon/kind/desc + stage rows (agent, tool, output path)
- [x] Pipeline run: executes stages through agents, writes markdown output
- [x] Workspace: upload, download file, download all, image preview, char/line stats
- [x] Mobile: hamburger + off-canvas sidebar + scrim, responsive grids, stacked stage editor
- [x] CSS for all new components
- [x] Verify in browser: keys, pipelines, editor modal, mobile 390px/820px, no overflow
- [x] Verify keyed bypass (0.29s) vs keyless throttle (32s)
- [x] README update

## Round 4 — Backend deploy, per-mode settings, GitHub discovery
- [x] Investigate exposed port: blanket 302 → /404 auth gate, cannot serve Python publicly
- [x] Audit provider CORS: OpenAI blocks; Anthropic/Gemini/Groq/OpenRouter/Mistral/Together/DeepSeek/xAI/Perplexity allow
- [x] Client-side direct-provider path (no proxy needed for keyed calls)
- [x] OpenAI-specific actionable error + "needs backend" label in provider dropdown
- [x] Runtime & Backend card: Backend URL input, Save, Test, live pill
- [x] proxyOnline detection so same-origin proxy is used when Backend URL is blank
- [x] Fix: proxy HTTP errors no longer mistaken for network failure
- [x] Per-mode independent settings (model, provider, temp, depth, maxAgents, reviewer, prompt)
- [x] GitHub search for Skills, Apps, MCP servers (REST search, one-click add)
- [x] Backend deploy artifacts: Dockerfile, render.yaml, fly.toml, railway.json, Procfile, .dockerignore
- [x] DEPLOY_BACKEND.md guide
- [x] Verify: direct groq/anthropic/gemini reach real providers; proxy returns upstream 401 both same-origin and remote
- [x] Verify: GitHub search 20 results + add; mobile 390px zero overflow; zero page errors
- [x] README update
- [x] Rebuild dist + redeploy

## Round 5 — Drop OpenAI, GitHub auth
- [x] Remove OpenAI from provider catalog (28 → 27 key cards)
- [x] Remove OpenAI from ROUTABLE orchestrator dropdown
- [x] Remove DIRECT_BLOCKED guard + "needs backend" label
- [x] Migration: stale `openai` provider selection falls back to pollinations
- [x] Correct rate-limit claim: search is 10/min anon → 30/min authed (not 5,000/hr)
- [x] Restore README per-mode settings + GitHub discovery sections (parallel-edit collision)
- [x] GitHub device-flow auth via gh CLI (account: bythewayz66-glitch)
- [x] Verify authenticated search: skills 20, MCP 20, apps 20 + one-click add
- [x] Redeploy + verify live: no openai, 27 cards, zero errors
