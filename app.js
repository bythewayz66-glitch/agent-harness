/* =====================================================================
   AGENT HARNESS — multi-agent orchestration console
   Single / Swarm / Mix-of-Agents modes, shared workspace, MCP + APIs,
   builtin tools & skills, Teamily.AI / gamut.io import & export.
   ===================================================================== */

const STORAGE_KEY = 'agentHarness.v1';

const DEFAULT_ORCH_PROMPT = `You are the Orchestrator of a multi-agent harness.

Your responsibilities:
1. Decompose the user's goal into clear, independent subtasks.
2. Route each subtask to the best-fit agent based on role, tools, skills and attached resources.
3. Respect the active mode:
   - SINGLE: one agent owns the entire task end-to-end.
   - SWARM: fan out subtasks across all available agents in parallel, then merge.
   - MIX: route to a lead agent per subtask, and consult specialists when needed.
4. All agents share ONE workspace (read + write). Coordinate file ownership to avoid write conflicts.
5. Use attached MCP servers, APIs, builtin tools and skills only when they help.
6. Return a single, consolidated final answer with a short summary of what each agent contributed.

Be concise, decisive, and always explain your delegation plan before executing.`;

const TOOL_LIBRARY = [
  { id: 'web_search', name: 'Web Search', icon: '🔍', desc: 'Search the live web for current information.' },
  { id: 'scrape_webpage', name: 'Web Scraper', icon: '🌐', desc: 'Extract clean text content from any URL.' },
  { id: 'browser_control', name: 'Browser Control', icon: '🖱️', desc: 'Navigate, click, fill forms in a real browser.' },
  { id: 'code_exec', name: 'Code Execution', icon: '⚙️', desc: 'Run Python / Node in a sandboxed runtime.' },
  { id: 'file_read', name: 'File Read', icon: '📖', desc: 'Read files from the shared workspace.' },
  { id: 'file_write', name: 'File Write', icon: '💾', desc: 'Create and modify files in the shared workspace.' },
  { id: 'shell', name: 'Shell', icon: '⌨️', desc: 'Execute CLI commands in the environment.' },
  { id: 'image_gen', name: 'Image Generation', icon: '🎨', desc: 'Generate images from text prompts.' },
  { id: 'image_edit', name: 'Image Editing', icon: '🖌️', desc: 'Edit existing images with instructions.' },
  { id: 'vision', name: 'Vision', icon: '👁️', desc: 'Inspect and reason over images.' },
  { id: 'audio_transcribe', name: 'Audio Transcribe', icon: '🎙️', desc: 'Transcribe audio files to text.' },
  { id: 'youtube', name: 'YouTube Transcript', icon: '▶️', desc: 'Pull transcripts from YouTube videos.' },
  { id: 'data_providers', name: 'Data Providers', icon: '🗂️', desc: 'LinkedIn, Twitter, Zillow, Amazon, finance.' },
  { id: 'http_request', name: 'HTTP Request', icon: '🔗', desc: 'Call any REST API with auth.' },
  { id: 'sql_query', name: 'SQL Query', icon: '🗄️', desc: 'Query connected databases.' },
  { id: 'calculator', name: 'Calculator', icon: '🧮', desc: 'Precise arithmetic and math.' },
];

const SKILL_LIBRARY = [
  { id: 'research', name: 'Deep Research', icon: '📚', desc: 'Multi-source investigation and synthesis.' },
  { id: 'coding', name: 'Software Engineering', icon: '💻', desc: 'Design, build and debug software.' },
  { id: 'data_analysis', name: 'Data Analysis', icon: '📈', desc: 'Clean, transform and analyze datasets.' },
  { id: 'writing', name: 'Content Writing', icon: '✍️', desc: 'Long-form, persuasive, on-brand copy.' },
  { id: 'design', name: 'Visual Design', icon: '🎨', desc: 'Layouts, UI mockups and print-ready docs.' },
  { id: 'planning', name: 'Project Planning', icon: '🗺️', desc: 'Break goals into milestones and tasks.' },
  { id: 'review', name: 'Code Review', icon: '🔎', desc: 'Audit quality, correctness and security.' },
  { id: 'testing', name: 'QA & Testing', icon: '🧪', desc: 'Write and run tests, find regressions.' },
  { id: 'summarization', name: 'Summarization', icon: '📝', desc: 'Condense long content faithfully.' },
  { id: 'translation', name: 'Translation', icon: '🌍', desc: 'Translate across languages.' },
  { id: 'devops', name: 'DevOps', icon: '🚀', desc: 'CI/CD, deployment and infrastructure.' },
  { id: 'security', name: 'Security Audit', icon: '🛡️', desc: 'Threat modeling and hardening.' },
];

/* ---------------- provider catalog (API key vault) ---------------- */
const PROVIDER_CATALOG = [
  { id: 'pollinations', name: 'Pollinations.ai', icon: '🌸', group: 'LLM', hint: 'Pollen key — removes the 30s throttle', url: 'https://enter.pollinations.ai' },
  { id: 'anthropic', name: 'Anthropic', icon: '🎭', group: 'LLM', hint: 'sk-ant-…', url: 'https://console.anthropic.com' },
  { id: 'google', name: 'Google Gemini', icon: '💎', group: 'LLM', hint: 'AIza…', url: 'https://aistudio.google.com' },
  { id: 'mistral', name: 'Mistral', icon: '🌬️', group: 'LLM', hint: 'key', url: 'https://console.mistral.ai' },
  { id: 'groq', name: 'Groq', icon: '⚡', group: 'LLM', hint: 'gsk_…', url: 'https://console.groq.com' },
  { id: 'together', name: 'Together AI', icon: '🤝', group: 'LLM', hint: 'key', url: 'https://api.together.xyz' },
  { id: 'openrouter', name: 'OpenRouter', icon: '🔀', group: 'LLM', hint: 'sk-or-…', url: 'https://openrouter.ai/keys' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🐋', group: 'LLM', hint: 'sk-…', url: 'https://platform.deepseek.com' },
  { id: 'xai', name: 'xAI Grok', icon: '✖️', group: 'LLM', hint: 'xai-…', url: 'https://console.x.ai' },
  { id: 'cohere', name: 'Cohere', icon: '🧭', group: 'LLM', hint: 'key', url: 'https://dashboard.cohere.com' },
  { id: 'perplexity', name: 'Perplexity', icon: '🔎', group: 'LLM', hint: 'pplx-…', url: 'https://www.perplexity.ai/settings/api' },
  { id: 'fireworks', name: 'Fireworks', icon: '🎆', group: 'LLM', hint: 'fw_…', url: 'https://fireworks.ai' },
  { id: 'replicate', name: 'Replicate', icon: '🔁', group: 'Media', hint: 'r8_…', url: 'https://replicate.com/account/api-tokens' },
  { id: 'stability', name: 'Stability AI', icon: '🖼️', group: 'Media', hint: 'sk-…', url: 'https://platform.stability.ai' },
  { id: 'fal', name: 'fal.ai', icon: '🚀', group: 'Media', hint: 'key:secret', url: 'https://fal.ai/dashboard/keys' },
  { id: 'runway', name: 'Runway', icon: '🎬', group: 'Media', hint: 'key', url: 'https://dev.runwayml.com' },
  { id: 'elevenlabs', name: 'ElevenLabs', icon: '🗣️', group: 'Audio', hint: 'sk_…', url: 'https://elevenlabs.io/app/settings' },
  { id: 'deepgram', name: 'Deepgram', icon: '🎙️', group: 'Audio', hint: 'key', url: 'https://console.deepgram.com' },
  { id: 'suno', name: 'Suno', icon: '🎵', group: 'Audio', hint: 'key', url: 'https://suno.ai' },
  { id: 'meshy', name: 'Meshy (3D)', icon: '🧊', group: '3D', hint: 'msy_…', url: 'https://www.meshy.ai/api' },
  { id: 'tripo', name: 'Tripo3D', icon: '🔺', group: '3D', hint: 'tsk_…', url: 'https://platform.tripo3d.ai' },
  { id: 'huggingface', name: 'Hugging Face', icon: '🤗', group: 'Platform', hint: 'hf_…', url: 'https://huggingface.co/settings/tokens' },
  { id: 'github', name: 'GitHub', icon: '🐙', group: 'Platform', hint: 'ghp_…', url: 'https://github.com/settings/tokens' },
  { id: 'supabase', name: 'Supabase', icon: '⚡', group: 'Platform', hint: 'service_role', url: 'https://supabase.com/dashboard' },
  { id: 'cloudflare', name: 'Cloudflare', icon: '☁️', group: 'Platform', hint: 'token', url: 'https://dash.cloudflare.com/profile/api-tokens' },
  { id: 'aws', name: 'AWS', icon: '🅰️', group: 'Platform', hint: 'access:secret', url: 'https://console.aws.amazon.com/iam' },
  { id: 'stripe', name: 'Stripe', icon: '💳', group: 'Platform', hint: 'sk_live_…', url: 'https://dashboard.stripe.com/apikeys' },
];

/* ---------------- pipeline blueprints ---------------- */
const PIPELINE_LIBRARY = [
  {
    id: 'p_3d', name: '3D Model Pipeline', icon: '🧊', kind: '3D Assets',
    desc: 'Concept → prompt → mesh generation → retopo → texture → export glTF/FBX.',
    stages: [
      { name: 'Concept & reference', agent: 'Atlas', tool: 'web_search', out: 'references.md' },
      { name: 'Prompt engineering', agent: 'Quill', tool: 'file_write', out: 'prompts/3d.md' },
      { name: 'Mesh generation', agent: 'Nova', tool: 'http_request', out: 'assets/model.glb' },
      { name: 'Texture & materials', agent: 'Nova', tool: 'http_request', out: 'assets/textures/' },
      { name: 'QA & polycount check', agent: 'Sage', tool: 'code_exec', out: 'reports/3d-qa.md' },
    ],
  },
  {
    id: 'p_audio', name: 'Audio Asset Pipeline', icon: '🎧', kind: 'Audio',
    desc: 'SFX and voice: brief → script → synthesis → mastering → loudness QA.',
    stages: [
      { name: 'Asset brief', agent: 'Quill', tool: 'file_write', out: 'audio/brief.md' },
      { name: 'Script / cue sheet', agent: 'Quill', tool: 'file_write', out: 'audio/script.md' },
      { name: 'Synthesis (TTS/SFX)', agent: 'Nova', tool: 'http_request', out: 'audio/raw/' },
      { name: 'Mastering & normalize', agent: 'Nova', tool: 'shell', out: 'audio/final/' },
      { name: 'Loudness QA', agent: 'Sage', tool: 'code_exec', out: 'reports/audio-qa.md' },
    ],
  },
  {
    id: 'p_music', name: 'Music Generation Pipeline', icon: '🎵', kind: 'Audio',
    desc: 'Style brief → structure → generation → stem split → mixdown.',
    stages: [
      { name: 'Style & mood brief', agent: 'Quill', tool: 'file_write', out: 'music/brief.md' },
      { name: 'Structure & sections', agent: 'Quill', tool: 'file_write', out: 'music/structure.md' },
      { name: 'Generate track', agent: 'Nova', tool: 'http_request', out: 'music/track.wav' },
      { name: 'Stem split & mix', agent: 'Nova', tool: 'shell', out: 'music/stems/' },
    ],
  },
  {
    id: 'p_video', name: 'Video Production Pipeline', icon: '🎬', kind: 'Video',
    desc: 'Script → storyboard → shot generation → edit → captions → export.',
    stages: [
      { name: 'Script & hook', agent: 'Quill', tool: 'file_write', out: 'video/script.md' },
      { name: 'Storyboard', agent: 'Quill', tool: 'image_gen', out: 'video/storyboard/' },
      { name: 'Shot generation', agent: 'Nova', tool: 'http_request', out: 'video/clips/' },
      { name: 'Edit & captions', agent: 'Nova', tool: 'shell', out: 'video/final.mp4' },
      { name: 'Review pass', agent: 'Sage', tool: 'vision', out: 'reports/video-qa.md' },
    ],
  },
  {
    id: 'p_image', name: 'Image Asset Pipeline', icon: '🖼️', kind: 'Images',
    desc: 'Art direction → prompt set → generation → upscale → brand QA.',
    stages: [
      { name: 'Art direction', agent: 'Atlas', tool: 'web_search', out: 'image/direction.md' },
      { name: 'Prompt set', agent: 'Quill', tool: 'file_write', out: 'image/prompts.md' },
      { name: 'Generate variants', agent: 'Nova', tool: 'image_gen', out: 'image/raw/' },
      { name: 'Upscale & export', agent: 'Nova', tool: 'image_edit', out: 'image/final/' },
    ],
  },
  {
    id: 'p_content', name: 'Long-Form Content Pipeline', icon: '📝', kind: 'Content',
    desc: 'Research → outline → draft → fact-check → SEO → publish.',
    stages: [
      { name: 'Research & sources', agent: 'Atlas', tool: 'web_search', out: 'content/research.md' },
      { name: 'Outline', agent: 'Quill', tool: 'file_write', out: 'content/outline.md' },
      { name: 'Draft', agent: 'Quill', tool: 'file_write', out: 'content/draft.md' },
      { name: 'Fact-check', agent: 'Sage', tool: 'web_search', out: 'content/factcheck.md' },
      { name: 'SEO & publish', agent: 'Nova', tool: 'http_request', out: 'content/final.md' },
    ],
  },
  {
    id: 'p_game', name: 'Game Asset Pipeline', icon: '🎮', kind: '3D Assets',
    desc: 'Asset list → concept → 3D + audio → engine import → playtest.',
    stages: [
      { name: 'Asset list', agent: 'Atlas', tool: 'file_write', out: 'game/assets.md' },
      { name: 'Concept art', agent: 'Quill', tool: 'image_gen', out: 'game/concept/' },
      { name: '3D + audio build', agent: 'Nova', tool: 'http_request', out: 'game/build/' },
      { name: 'Engine import', agent: 'Nova', tool: 'shell', out: 'game/import.md' },
      { name: 'Playtest & QA', agent: 'Sage', tool: 'code_exec', out: 'reports/game-qa.md' },
    ],
  },
];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, type = 'ok') {
  const w = $('#toastWrap');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(30px)'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 3200);
}

/* ---------------- default state ---------------- */
function modeDefaults() {
  return {
    single: { name: 'Orchestrator', model: 'gpt-4o', provider: 'pollinations', temperature: 0.4, maxDepth: 4, maxAgents: 1, reviewer: false, prompt: DEFAULT_ORCH_PROMPT },
    swarm:  { name: 'Orchestrator', model: 'gpt-4o', provider: 'pollinations', temperature: 0.6, maxDepth: 8, maxAgents: 0, reviewer: true,  prompt: DEFAULT_ORCH_PROMPT },
    mix:    { name: 'Orchestrator', model: 'gpt-4o', provider: 'pollinations', temperature: 0.5, maxDepth: 6, maxAgents: 4, reviewer: true,  prompt: DEFAULT_ORCH_PROMPT },
  };
}

function defaultState() {
  return {
    mode: 'single',
    modes: modeDefaults(),
    orchestrator: { ...modeDefaults().single },
    settings: { backendUrl: '' },
    agents: [
      {
        id: uid(), name: 'Atlas', emoji: '🔍', role: 'Research Analyst', model: 'gpt-4o',
        prompt: 'You are Atlas, a meticulous research analyst. Gather evidence from multiple sources, verify facts, and produce concise, well-cited briefs. Hand off findings to the team.',
        tools: ['web_search', 'scrape_webpage', 'data_providers'], skills: ['research', 'summarization'],
        mcp: [], apis: [], status: 'idle'
      },
      {
        id: uid(), name: 'Nova', emoji: '💻', role: 'Full-Stack Engineer', model: 'claude-3.5-sonnet',
        prompt: 'You are Nova, a senior full-stack engineer. Write clean, tested, production-ready code. Own the src/ directory in the shared workspace and coordinate interfaces with the team.',
        tools: ['code_exec', 'file_read', 'file_write', 'shell'], skills: ['coding', 'testing', 'devops'],
        mcp: [], apis: [], status: 'idle'
      },
      {
        id: uid(), name: 'Quill', emoji: '✍️', role: 'Content Writer', model: 'claude-3.5-sonnet',
        prompt: 'You are Quill, an expert writer. Turn research and specs into clear, engaging prose. Own docs/ and marketing copy. Match the requested tone and audience.',
        tools: ['file_read', 'file_write', 'web_search'], skills: ['writing', 'summarization'],
        mcp: [], apis: [], status: 'idle'
      },
      {
        id: uid(), name: 'Sage', emoji: '🧪', role: 'QA & Reviewer', model: 'gpt-4o',
        prompt: 'You are Sage, a rigorous QA reviewer. Review all outputs for correctness, security and completeness. Report issues with actionable fixes before final delivery.',
        tools: ['file_read', 'code_exec', 'shell'], skills: ['review', 'testing', 'security'],
        mcp: [], apis: [], status: 'idle'
      },
    ],
    mcpServers: [
      { id: uid(), name: 'filesystem', transport: 'stdio', target: 'npx -y @modelcontextprotocol/server-filesystem /workspace', status: 'connected' },
      { id: uid(), name: 'github', transport: 'http', target: 'https://mcp.github.example/sse', status: 'connected' },
    ],
    apis: [
      { id: uid(), name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', auth: 'Bearer', key: 'sk-••••••••', status: 'connected' },
      { id: uid(), name: 'Weather', baseUrl: 'https://api.openweathermap.org/data/2.5', auth: 'API Key', key: '••••••••', status: 'connected' },
    ],
    tools: TOOL_LIBRARY.map(t => ({ ...t, enabled: ['web_search','scrape_webpage','code_exec','file_read','file_write','http_request','image_gen','vision'].includes(t.id) })),
    skills: SKILL_LIBRARY.map(s => ({ ...s, enabled: ['research','coding','writing','review','planning'].includes(s.id) })),
    keys: [],
    pipelines: [],
    apps: [],
    workspace: {
      files: [
        { path: 'README.md', content: '# Project\n\nShared workspace for the agent team.\nAll agents have read + write access.\n', by: 'system', at: Date.now() },
        { path: 'docs/brief.md', content: '# Brief\n\nGoal: build a product landing page.\nAudience: early adopters.\n', by: 'Atlas', at: Date.now() },
        { path: 'src/app.js', content: '// main application entry\nconsole.log("hello harness");\n', by: 'Nova', at: Date.now() },
      ],
      selected: 'README.md',
    },
    logs: [],
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // migrate missing fields
      s.tools = s.tools || TOOL_LIBRARY.map(t => ({ ...t, enabled: true }));
      s.skills = s.skills || SKILL_LIBRARY.map(x => ({ ...x, enabled: true }));
      s.keys = s.keys || [];
      s.pipelines = s.pipelines || [];
      s.apps = s.apps || [];
      s.workspace = s.workspace || { files: [], selected: null };
      s.logs = s.logs || [];
      s.orchestrator = s.orchestrator || {};
      // providers the UI can actually route to; anything else (e.g. a retired
      // "openai" selection) falls back to keyless Pollinations
      const VALID_PROVIDERS = ['pollinations', 'simulated', 'anthropic', 'google', 'mistral', 'groq',
        'together', 'openrouter', 'deepseek', 'xai', 'perplexity', 'fireworks'];
      if (!VALID_PROVIDERS.includes(s.orchestrator.provider)) s.orchestrator.provider = 'pollinations';
      const MODELS = ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'claude-3-opus', 'gemini-1.5-pro', 'llama-3.1-70b', 'mistral-large', 'local:ollama'];
      if (!MODELS.includes(s.orchestrator.model)) s.orchestrator.model = 'gpt-4o';
      // per-mode settings: seed any missing mode from the current orchestrator, then
      // make state.orchestrator reflect the active mode
      const md = modeDefaults();
      s.modes = s.modes || {};
      ['single', 'swarm', 'mix'].forEach(m => {
        s.modes[m] = Object.assign({}, md[m], s.modes[m] || {});
        if (!MODELS.includes(s.modes[m].model)) s.modes[m].model = 'gpt-4o';
        if (!VALID_PROVIDERS.includes(s.modes[m].provider)) s.modes[m].provider = 'pollinations';
      });
      s.mode = ['single', 'swarm', 'mix'].includes(s.mode) ? s.mode : 'single';
      s.orchestrator = Object.assign({}, s.modes[s.mode]);
      return s;
    }
  } catch (e) { console.warn('load failed', e); }
  return defaultState();
}
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }

/* ---------------- navigation ---------------- */
const VIEW_META = {
  dashboard: ['Dashboard', 'Overview of your agent harness'],
  orchestrator: ['Orchestrator', 'System prompt, model and routing policy'],
  agents: ['Agents', 'Compose the team for the active mode'],
  pipelines: ['Pipelines', 'Reusable content production blueprints for your agents'],
  workspace: ['Workspace', 'One shared read/write filesystem for every agent'],
  keys: ['API Keys', 'Vault of provider keys, injected per request'],
  mcp: ['MCP Servers', 'Model Context Protocol servers shared by all agents'],
  apis: ['APIs', 'External APIs and credentials shared by all agents'],
  tools: ['Tools & Skills', 'Builtin capabilities available to every agent'],
  console: ['Run Console', 'Execute tasks and watch orchestration live'],
};

function setView(view) {
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  const [title, crumb] = VIEW_META[view] || ['', ''];
  $('#viewTitle').textContent = title;
  $('#viewCrumb').textContent = crumb;
  $('#content').scrollTop = 0;
  closeSidebar();
  if (view === 'workspace') renderWorkspace();
  if (view === 'console') renderConsole();
  if (view === 'keys') renderKeys();
  if (view === 'pipelines') renderPipelines();
}

function setMode(mode) {
  if (mode === state.mode) return;
  // persist the settings of the mode we are leaving
  state.modes[state.mode] = { ...state.orchestrator };
  state.mode = mode;
  // load the settings belonging to the mode we are entering
  state.orchestrator = { ...(state.modes[mode] || modeDefaults()[mode]) };
  save();
  $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const label = { single: 'Single', swarm: 'Swarm', mix: 'Mix of Agents' }[mode];
  $('#modeFoot').innerHTML = 'Mode: <b>' + label + '</b>';
  $('#agentModeLabel').textContent = label;
  $('#consoleMode').textContent = label;
  renderAll();
  toast('Switched to ' + label + ' mode — its own settings loaded', 'ok');
}

/* ---------------- render: master ---------------- */
function renderAll() {
  renderNavCounts();
  renderDashboard();
  renderOrchestrator();
  renderAgents();
  renderPipelines();
  renderWorkspace();
  renderKeys();
  renderMcp();
  renderApis();
  renderTools();
  renderConsole();
  save();
}

function renderNavCounts() {
  $('#navAgentCount').textContent = state.agents.length;
  $('#navFileCount').textContent = state.workspace.files.length;
  $('#navMcpCount').textContent = state.mcpServers.length;
  $('#navApiCount').textContent = state.apis.length;
  $('#navKeyCount').textContent = state.keys.length;
  $('#navPipeCount').textContent = state.pipelines.length;
}

/* ---------------- dashboard ---------------- */
function renderDashboard() {
  $('#stAgents').textContent = state.agents.length;
  $('#stFiles').textContent = state.workspace.files.length;
  $('#stMcp').textContent = state.mcpServers.length;
  $('#stApis').textContent = state.apis.length;

  const o = state.orchestrator;
  $('#dashOrch').innerHTML = `
    <div class="flex items-center gap-12" style="margin-bottom:12px">
      <div class="agent-avatar" style="font-size:22px">🧠</div>
      <div>
        <div class="agent-name">${esc(o.name)}</div>
        <div class="agent-role">${esc(o.model)} · ${esc(o.provider || 'pollinations')} · temp ${o.temperature} · depth ${o.maxDepth}</div>
      </div>
      <span class="pill green" style="margin-left:auto"><span class="dot"></span>Ready</span>
    </div>
    <div class="prompt-preview mono" style="font-size:11.5px;color:var(--muted);max-height:80px;overflow:hidden">${esc(o.prompt.slice(0, 240))}…</div>
    <button class="btn sm mt-12" data-action="goto" data-view="orchestrator">✎ Edit system prompt</button>`;

  const modeInfo = {
    single: { icon: '🎯', title: 'Single Agent', body: 'One agent owns the entire task end-to-end. Best for focused, well-scoped work.' },
    swarm: { icon: '🐝', title: 'Swarm', body: 'All agents fan out on decomposed subtasks in parallel, then results are merged. Add agents on demand.' },
    mix: { icon: '🧬', title: 'Mix of Agents', body: 'A hybrid: the orchestrator routes each subtask to the best-fit lead and consults specialists as needed.' },
  }[state.mode];
  $('#dashMode').innerHTML = `
    <div class="flex items-center gap-12" style="margin-bottom:12px">
      <div class="agent-avatar" style="font-size:22px">${modeInfo.icon}</div>
      <div><div class="agent-name">${modeInfo.title}</div><div class="agent-role">Active topology</div></div>
      <span class="pill indigo" style="margin-left:auto">${state.agents.length} agents</span>
    </div>
    <p style="font-size:12.5px;color:var(--muted);line-height:1.6">${modeInfo.body}</p>
    <button class="btn sm mt-12" data-action="goto" data-view="agents">⚙ Manage agents</button>`;

  $('#dashAgents').innerHTML = state.agents.map(a => agentCardHTML(a, true)).join('') ||
    `<div class="empty"><div class="big">🤖</div>No agents yet. Add one to get started.</div>`;
}

/* ---------------- orchestrator ---------------- */
function renderOrchestrator() {
  const o = state.orchestrator;
  $('#orchName').value = o.name;
  $('#orchModel').value = o.model;

  // Build provider list: keyless pollinations + any LLM provider that has a key
  const sel = $('#orchProvider');
  const ROUTABLE = ['anthropic','google','mistral','groq','together','openrouter','deepseek','xai','perplexity','fireworks'];
  const llmProviders = PROVIDER_CATALOG.filter(p => p.group === 'LLM' && ROUTABLE.includes(p.id));
  let opts = `<option value="pollinations">Pollinations.ai (keyless · throttled)</option>`;
  llmProviders.forEach(p => {
    const has = keyFor(p.id);
    opts += `<option value="${p.id}">${p.icon} ${esc(p.name)}${has ? ' · keyed' : ' · needs key'}</option>`;
  });
  opts += `<option value="simulated">Simulated (no network)</option>`;
  sel.innerHTML = opts;
  sel.value = o.provider || 'pollinations';
  if (!sel.value) sel.value = 'pollinations';
  updateThrottleHint();
  $('#orchTemp').value = o.temperature;
  $('#orchTempVal').textContent = o.temperature;
  $('#orchDepth').value = o.maxDepth;
  $('#orchPrompt').value = o.prompt;

  // per-mode banner + fields
  const label = { single: 'Single', swarm: 'Swarm', mix: 'Mix of Agents' }[state.mode];
  const mb = $('#modeSettingsBanner');
  if (mb) {
    mb.innerHTML = `<span class="hi">🎛️</span><div>You are editing the settings for <b>${label}</b> mode. Each mode stores its own model, provider, temperature, depth, prompt and limits — switching modes swaps them.</div>`;
  }
  const ma = $('#orchMaxAgents');
  if (ma) ma.value = o.maxAgents ?? 0;
  const rv = $('#orchReviewer');
  if (rv) rv.checked = !!o.reviewer;
  const maField = $('#orchMaxAgentsField');
  if (maField) maField.style.display = state.mode === 'single' ? 'none' : '';
}

function updateThrottleHint() {
  const prov = state.orchestrator.provider || 'pollinations';
  const box = $('#throttleStatus');
  if (!box) return;
  const keyed = prov !== 'pollinations' && prov !== 'simulated' && keyFor(prov);
  if (prov === 'simulated') {
    box.innerHTML = `<span class="hi">🧪</span><div>Simulated mode — no network calls, instant responses.</div>`;
  } else if (keyed) {
    box.innerHTML = `<span class="hi">✅</span><div><b>${esc(prov)}</b> keyed — <b style="color:var(--green)">no throttle</b>. Calls route through your key.</div>`;
  } else if (prov === 'pollinations' && keyFor('pollinations')) {
    box.innerHTML = `<span class="hi">✅</span><div>Pollinations key detected — <b style="color:var(--green)">throttle lifted</b>.</div>`;
  } else {
    box.innerHTML = `<span class="hi">⏱️</span><div>Hard throttle: <b>1 request / 30s</b> across all agents. <span id="throttleLive" class="muted"></span></div>`;
  }
}

/* ---------------- agents ---------------- */
function agentCardHTML(a, compact) {
  const toolTags = a.tools.slice(0, 3).map(t => `<span class="tag tool">${esc(toolName(t))}</span>`).join('');
  const skillTags = a.skills.slice(0, 2).map(s => `<span class="tag skill">${esc(skillName(s))}</span>`).join('');
  const mcpTags = a.mcp.length ? `<span class="tag mcp">🔌 ${a.mcp.length} MCP</span>` : '';
  const apiTags = a.apis.length ? `<span class="tag api">🔗 ${a.apis.length} API</span>` : '';
  return `
  <div class="agent-card">
    <div class="agent-top">
      <div class="agent-avatar">${a.emoji || '🤖'}</div>
      <div style="flex:1;min-width:0">
        <div class="agent-name">${esc(a.name)}</div>
        <div class="agent-role">${esc(a.role)} · ${esc(a.model)}</div>
      </div>
      <span class="pill ${a.status === 'working' ? 'amber' : 'green'}"><span class="dot"></span>${a.status === 'working' ? 'Working' : 'Idle'}</span>
    </div>
    <div class="prompt-preview">${esc(a.prompt)}</div>
    <div class="agent-tags">${toolTags}${skillTags}${mcpTags}${apiTags}</div>
    ${compact ? '' : `<div class="agent-actions">
      <button class="btn sm" data-action="edit-agent" data-id="${a.id}">✎ Edit</button>
      <button class="btn sm ghost" data-action="dup-agent" data-id="${a.id}">⧉</button>
      <button class="btn sm danger" data-action="del-agent" data-id="${a.id}">🗑</button>
    </div>`}
  </div>`;
}

function renderAgents() {
  const label = { single: 'Single', swarm: 'Swarm', mix: 'Mix of Agents' }[state.mode];
  $('#agentModeLabel').textContent = label;

  const notice = {
    single: `<div class="hint-box mb-12"><span class="hi">🎯</span><div><b>Single mode.</b> The orchestrator runs one agent end-to-end. Pick the agent that best matches the task — you can still keep others in the roster for later.</div></div>`,
    swarm: `<div class="hint-box mb-12"><span class="hi">🐝</span><div><b>Swarm mode.</b> Every agent below joins the swarm. Add agents on demand, or import a team from Teamily.AI / gamut.io. Work is fanned out in parallel across the shared workspace.</div></div>`,
    mix: `<div class="hint-box mb-12"><span class="hi">🧬</span><div><b>Mix of Agents.</b> The orchestrator routes each subtask to the best-fit lead agent and consults specialists. A flexible blend of focused single-agent work and swarm collaboration.</div></div>`,
  }[state.mode];
  $('#modeNotice').innerHTML = notice;

  const cards = state.agents.map(a => agentCardHTML(a, false)).join('');
  const addCard = `<div class="add-agent-card" data-action="add-agent">
      <div class="plus">＋</div>
      <div style="font-weight:600;font-size:13px">Add Agent</div>
      <div style="font-size:11px;color:var(--muted-2)">on demand · blank or from template</div>
    </div>`;
  $('#agentsGrid').innerHTML = cards + addCard;
}

function toolName(id) { const t = TOOL_LIBRARY.find(x => x.id === id); return t ? t.name : id; }
function skillName(id) { const s = SKILL_LIBRARY.find(x => x.id === id); return s ? s.name : id; }

/* ---------------- API keys vault ---------------- */
function keyFor(provider) {
  return state.keys.find(k => k.provider === provider && k.key);
}

function renderKeys() {
  const grid = $('#keyGrid');
  const groups = [...new Set(PROVIDER_CATALOG.map(p => p.group))];
  let html = '';
  groups.forEach(g => {
    html += `<div class="key-group-title">${esc(g)}</div><div class="key-grid-inner">`;
    PROVIDER_CATALOG.filter(p => p.group === g).forEach(p => {
      const saved = state.keys.find(k => k.provider === p.id);
      const has = saved && saved.key;
      html += `
        <div class="key-card ${has ? 'on' : ''}">
          <div class="key-top">
            <div class="key-ic">${p.icon}</div>
            <div class="key-name">${esc(p.name)}</div>
            <span class="pill ${has ? 'green' : ''}"><span class="dot"></span>${has ? 'set' : 'empty'}</span>
          </div>
          <input type="password" class="key-input" data-provider="${p.id}" placeholder="${esc(p.hint)}" value="${has ? esc(saved.key) : ''}">
          <div class="key-foot">
            <span class="key-hint">${esc(p.hint)}</span>
            <div class="flex gap-8">
              ${has ? `<button class="btn sm ghost" data-action="del-key" data-id="${saved.id}">🗑</button>` : ''}
              <button class="btn sm" data-action="save-key" data-provider="${p.id}">Save</button>
            </div>
          </div>
        </div>`;
    });
    html += `</div>`;
  });
  grid.innerHTML = html;

  const poll = keyFor('pollinations');
  $('#keyThrottleStat').innerHTML = poll
    ? 'Pollinations: <b style="color:var(--green)">keyed · no throttle</b>'
    : 'Pollinations: <b style="color:var(--amber)">throttled 1/30s</b>';

  const bi = $('#backendUrlInput');
  if (bi && document.activeElement !== bi) bi.value = backendBase();
}

function saveKeyFromCard(provider) {
  const input = document.querySelector(`.key-input[data-provider="${provider}"]`);
  if (!input) return;
  const val = input.value.trim();
  const existing = state.keys.find(k => k.provider === provider);
  if (!val) {
    if (existing) { state.keys = state.keys.filter(k => k.id !== existing.id); renderAll(); toast('Key cleared', 'warn'); }
    return;
  }
  if (existing) { existing.key = val; existing.at = Date.now(); }
  else {
    const meta = PROVIDER_CATALOG.find(p => p.id === provider) || { name: provider };
    state.keys.push({ id: uid(), provider, name: meta.name, key: val, at: Date.now() });
  }
  renderAll();
  toast('Key saved for ' + (PROVIDER_CATALOG.find(p => p.id === provider)?.name || provider), 'ok');
}

function openKeyEditor() {
  openModal({
    title: 'Add Custom Key',
    body: `
      <label class="field"><span class="lbl">Provider name</span><input type="text" id="ckName" placeholder="e.g. My Internal API"></label>
      <label class="field"><span class="lbl">Key / token</span><input type="password" id="ckKey" placeholder="paste key…"></label>
      <div class="hint-box"><span class="hi">🔑</span><div>Custom keys are available to agents via the <code>http_request</code> tool and can be referenced in prompts.</div></div>
    `,
    foot: `<button class="btn ghost" data-action="close-modal">Cancel</button>
           <button class="btn primary" data-action="save-custom-key">＋ Save Key</button>`
  });
}

/* ---------------- pipelines ---------------- */
function renderPipelines() {
  const grid = $('#pipeGrid');
  if (!state.pipelines.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">🏗️</div>No blueprints yet. Load the starter set or create your own.</div>`;
    return;
  }
  grid.innerHTML = state.pipelines.map(p => `
    <div class="pipe-card">
      <div class="pipe-top">
        <div class="pipe-ic">${p.icon}</div>
        <div style="flex:1;min-width:0">
          <div class="pipe-name">${esc(p.name)}</div>
          <div class="pipe-kind">${esc(p.kind)} · ${p.stages.length} stages</div>
        </div>
        <button class="toggle ${p.enabled !== false ? 'on' : ''}" data-action="toggle-pipe" data-id="${p.id}"></button>
      </div>
      <div class="pipe-desc">${esc(p.desc)}</div>
      <div class="pipe-stages">
        ${p.stages.map((s, i) => `
          <div class="pipe-stage">
            <span class="pipe-num">${i + 1}</span>
            <span class="pipe-sname">${esc(s.name)}</span>
            <span class="pipe-agent">${esc(s.agent || '—')}</span>
          </div>`).join('')}
      </div>
      <div class="pipe-actions">
        <button class="btn sm" data-action="edit-pipe" data-id="${p.id}">✎ Edit</button>
        <button class="btn sm ghost" data-action="run-pipe" data-id="${p.id}">▶ Run</button>
        <button class="btn sm danger" data-action="del-pipe" data-id="${p.id}">🗑</button>
      </div>
    </div>`).join('');
}

function openPipelineEditor(id) {
  const p = id ? state.pipelines.find(x => x.id === id) : null;
  const draft = p || { name: '', icon: '🏗️', kind: 'Custom', desc: '', stages: [{ name: '', agent: '', tool: '', out: '' }], enabled: true };
  const agentOpts = sel => `<option value="">—</option>` + state.agents.map(a => `<option ${a.name === sel ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
  const toolOpts = sel => `<option value="">—</option>` + TOOL_LIBRARY.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('');

  const stageRows = draft.stages.map((s, i) => `
    <div class="stage-row" data-stage="${i}">
      <span class="stage-idx">${i + 1}</span>
      <input type="text" class="st-name" placeholder="Stage name" value="${esc(s.name)}">
      <select class="st-agent">${agentOpts(s.agent)}</select>
      <select class="st-tool">${toolOpts(s.tool)}</select>
      <input type="text" class="st-out" placeholder="output path" value="${esc(s.out || '')}">
      <button class="btn sm ghost" data-action="del-stage" data-idx="${i}">✕</button>
    </div>`).join('');

  openModal({
    title: id ? 'Edit Blueprint' : 'New Pipeline Blueprint',
    body: `
      <div class="grid cols-3" style="gap:12px">
        <label class="field"><span class="lbl">Name</span><input type="text" id="plName" value="${esc(draft.name)}" placeholder="3D Model Pipeline"></label>
        <label class="field"><span class="lbl">Icon</span><input type="text" id="plIcon" value="${esc(draft.icon)}" maxlength="4"></label>
        <label class="field"><span class="lbl">Kind</span><input type="text" id="plKind" value="${esc(draft.kind)}" placeholder="3D Assets / Audio / Video"></label>
      </div>
      <label class="field"><span class="lbl">Description</span><input type="text" id="plDesc" value="${esc(draft.desc)}" placeholder="What this pipeline produces"></label>
      <div class="section-title">Stages <button class="btn sm ghost" data-action="add-stage" style="margin-left:auto">＋ Add stage</button></div>
      <div id="stageList" class="stage-list">${stageRows}</div>
    `,
    foot: `<button class="btn ghost" data-action="close-modal">Cancel</button>
           <button class="btn primary" data-action="save-pipe" data-id="${id || ''}">${id ? '💾 Save' : '＋ Create'}</button>`
  });
}

function collectStages() {
  return $$('#stageList .stage-row').map(r => ({
    name: r.querySelector('.st-name').value.trim(),
    agent: r.querySelector('.st-agent').value,
    tool: r.querySelector('.st-tool').value,
    out: r.querySelector('.st-out').value.trim(),
  })).filter(s => s.name);
}

function savePipeline(id) {
  const name = $('#plName').value.trim();
  if (!name) { toast('Blueprint needs a name', 'err'); return; }
  const data = {
    name,
    icon: $('#plIcon').value.trim() || '🏗️',
    kind: $('#plKind').value.trim() || 'Custom',
    desc: $('#plDesc').value.trim(),
    stages: collectStages(),
  };
  if (id) Object.assign(state.pipelines.find(p => p.id === id), data);
  else state.pipelines.push({ id: uid(), enabled: true, ...data });
  closeModal(); renderAll(); toast('Blueprint ' + (id ? 'updated' : 'created'), 'ok');
}

function seedPipelines() {
  let added = 0;
  PIPELINE_LIBRARY.forEach(lib => {
    if (!state.pipelines.find(p => p.name === lib.name)) {
      state.pipelines.push({ ...JSON.parse(JSON.stringify(lib)), enabled: true });
      added++;
    }
  });
  renderAll();
  toast(added ? `Loaded ${added} starter blueprint(s)` : 'Blueprints already loaded', added ? 'ok' : 'warn');
}

/* ---------------- workspace ---------------- */
function fileIcon(path) {
  const p = path.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(p)) return '🖼️';
  if (/\.(mp3|wav|ogg|m4a)$/.test(p)) return '🎵';
  if (/\.(mp4|mov|webm)$/.test(p)) return '🎬';
  if (/\.(glb|gltf|fbx|obj|blend)$/.test(p)) return '🧊';
  if (p.endsWith('.md')) return '📝';
  if (p.endsWith('.json')) return '🗂️';
  if (/\.(js|ts|py|html|css|sh)$/.test(p)) return '📜';
  return '📄';
}

function renderWorkspace() {
  $('#wsAgentCount').textContent = state.agents.length;
  const files = state.workspace.files;
  const tree = $('#fileTree');
  if (!files.length) {
    tree.innerHTML = `<div class="empty"><div class="big">📁</div>No files yet</div>`;
  } else {
    tree.innerHTML = files.map(f => `
      <div class="file-item ${f.path === state.workspace.selected ? 'active' : ''}" data-action="open-file" data-path="${esc(f.path)}">
        <span class="fi">${fileIcon(f.path)}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.path)}</span>
        <span class="meta">${esc(f.by || '')}</span>
      </div>`).join('');
  }
  const sel = files.find(f => f.path === state.workspace.selected);
  const ta = $('#edFileContent');
  const prev = $('#edPreview');
  if (sel) {
    $('#edFileName').textContent = sel.path;
    $('#edFileIcon').textContent = fileIcon(sel.path);
    $('#edFileWho').textContent = 'last edited by ' + (sel.by || 'unknown');
    ta.value = sel.content; ta.disabled = false;
    $('#saveFileBtn').disabled = false; $('#delFileBtn').disabled = false; $('#dlFileBtn').disabled = false;
    $('#edFileStat').textContent = sel.content.length + ' chars · ' + sel.content.split('\n').length + ' lines';

    const isImg = /\.(png|jpe?g|gif|webp|svg)$/i.test(sel.path) && /^(data:|https?:)/.test(sel.content.trim());
    if (isImg) {
      prev.classList.remove('hidden');
      prev.innerHTML = `<img src="${esc(sel.content.trim())}" alt="${esc(sel.path)}" style="max-width:100%;border-radius:10px;display:block;margin:12px">`;
      ta.classList.add('hidden');
    } else {
      prev.classList.add('hidden'); prev.innerHTML = '';
      ta.classList.remove('hidden');
    }
  } else {
    $('#edFileName').textContent = '— no file selected —';
    $('#edFileIcon').textContent = '📄';
    $('#edFileWho').textContent = '';
    ta.value = ''; ta.disabled = true;
    prev.classList.add('hidden'); prev.innerHTML = ''; ta.classList.remove('hidden');
    $('#saveFileBtn').disabled = true; $('#delFileBtn').disabled = true; $('#dlFileBtn').disabled = true;
    $('#edFileStat').textContent = '';
  }
}

function downloadFile(path) {
  const f = state.workspace.files.find(x => x.path === path);
  if (!f) return;
  downloadText(path.split('/').pop(), f.content);
  toast('Downloaded ' + f.path, 'ok');
}

function downloadAll() {
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    files: state.workspace.files,
  }, null, 2);
  downloadText('workspace-' + Date.now() + '.json', payload);
  toast('Workspace exported (' + state.workspace.files.length + ' files)', 'ok');
}

function uploadFiles(fileList) {
  Array.from(fileList).forEach(file => {
    const reader = new FileReader();
    const isText = /^(text\/|application\/(json|javascript|xml))/.test(file.type) || /\.(md|txt|json|js|ts|py|html|css|sh|csv|yml|yaml)$/i.test(file.name);
    reader.onload = () => {
      const content = isText ? reader.result : reader.result; // data URL for binaries
      const existing = state.workspace.files.find(f => f.path === file.name);
      if (existing) { existing.content = content; existing.by = 'you'; existing.at = Date.now(); }
      else state.workspace.files.push({ path: file.name, content, by: 'you', at: Date.now() });
      state.workspace.selected = file.name;
      renderAll();
      toast('Uploaded ' + file.name, 'ok');
    };
    if (isText) reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}

/* ---------------- mcp ---------------- */
function renderMcp() {
  const list = $('#mcpList');
  if (!state.mcpServers.length) {
    list.innerHTML = `<div class="empty"><div class="big">🔌</div>No MCP servers attached. Attach one to share tools with every agent.</div>`;
    return;
  }
  list.innerHTML = state.mcpServers.map(m => `
    <div class="row-card">
      <div class="ric">🔌</div>
      <div class="rmain">
        <div class="rname">${esc(m.name)}
          <span class="pill ${m.status === 'connected' ? 'green' : 'amber'}"><span class="dot"></span>${m.status}</span>
          <span class="tag">${esc(m.transport)}</span>
        </div>
        <div class="rsub mono">${esc(m.target)}</div>
      </div>
      <div class="ractions">
        <button class="btn sm" data-action="edit-mcp" data-id="${m.id}">✎</button>
        <button class="btn sm ghost" data-action="toggle-mcp" data-id="${m.id}">${m.status === 'connected' ? '⏸' : '▶'}</button>
        <button class="btn sm danger" data-action="del-mcp" data-id="${m.id}">🗑</button>
      </div>
    </div>`).join('');
}

/* ---------------- apis ---------------- */
function renderApis() {
  const list = $('#apiList');
  if (!state.apis.length) {
    list.innerHTML = `<div class="empty"><div class="big">🔗</div>No APIs attached. Add credentials to share with every agent.</div>`;
    return;
  }
  list.innerHTML = state.apis.map(a => `
    <div class="row-card">
      <div class="ric">🔗</div>
      <div class="rmain">
        <div class="rname">${esc(a.name)}
          <span class="pill ${a.status === 'connected' ? 'green' : 'amber'}"><span class="dot"></span>${a.status}</span>
          <span class="tag">${esc(a.auth)}</span>
        </div>
        <div class="rsub mono">${esc(a.baseUrl)} · key ${esc(a.key)}</div>
      </div>
      <div class="ractions">
        <button class="btn sm" data-action="edit-api" data-id="${a.id}">✎</button>
        <button class="btn sm ghost" data-action="toggle-api" data-id="${a.id}">${a.status === 'connected' ? '⏸' : '▶'}</button>
        <button class="btn sm danger" data-action="del-api" data-id="${a.id}">🗑</button>
      </div>
    </div>`).join('');
}

/* ---------------- tools & skills ---------------- */
function renderTools() {
  $('#toolsGrid').innerHTML = state.tools.map(t => `
    <div class="tile ${t.enabled ? 'on' : ''}">
      <div class="tile-top">
        <div class="tic">${t.icon}</div>
        <div class="tname">${esc(t.name)}</div>
        <button class="toggle ${t.enabled ? 'on' : ''}" data-action="toggle-tool" data-id="${t.id}"></button>
      </div>
      <div class="tdesc">${esc(t.desc)}</div>
    </div>`).join('');

  $('#skillsGrid').innerHTML = state.skills.map(s => `
    <div class="tile ${s.enabled ? 'on' : ''}">
      <div class="tile-top">
        <div class="tic">${s.icon}</div>
        <div class="tname">${esc(s.name)}</div>
        <button class="toggle ${s.enabled ? 'on' : ''}" data-action="toggle-skill" data-id="${s.id}"></button>
      </div>
      <div class="tdesc">${esc(s.desc)}</div>
      ${s.source ? `<a class="tile-src" href="${esc(s.source)}" target="_blank" rel="noopener">🐙 source</a>` : ''}
    </div>`).join('');

  const apps = state.apps || [];
  $('#appsGrid').innerHTML = apps.length ? apps.map(a => `
    <div class="tile ${a.enabled !== false ? 'on' : ''}">
      <div class="tile-top">
        <div class="tic">${a.icon || '🧩'}</div>
        <div class="tname">${esc(a.name)}</div>
        <button class="toggle ${a.enabled !== false ? 'on' : ''}" data-action="toggle-app" data-id="${a.id}"></button>
      </div>
      <div class="tdesc">${esc(a.desc)}</div>
      <div class="tile-foot">
        ${a.url ? `<a class="tile-src" href="${esc(a.url)}" target="_blank" rel="noopener">🐙 ${esc(a.repo || 'source')}</a>` : ''}
        <button class="btn sm ghost" data-action="del-app" data-id="${a.id}">🗑</button>
      </div>
    </div>`).join('') : `<div class="empty" style="grid-column:1/-1"><div class="big">🧩</div>No apps yet — find some on GitHub.</div>`;
}

/* ---------------- GitHub discovery ---------------- */
const GH_KINDS = {
  skill: {
    title: '🔎 Find Skills on GitHub',
    placeholder: 'e.g. claude skills, prompt library, agent skills',
    seed: 'claude skills in:name,description stars:>50',
    blurb: 'Search public repos for reusable skill/prompt packs. Adding one creates a skill you can toggle and assign to agents.',
  },
  mcp: {
    title: '🔌 Find MCP Servers on GitHub',
    placeholder: 'e.g. mcp server filesystem, postgres mcp',
    seed: 'mcp server in:name,description stars:>50',
    blurb: 'Search public repos for Model Context Protocol servers. Adding one attaches it as a shared MCP server.',
  },
  app: {
    title: '🧩 Find Apps & Integrations on GitHub',
    placeholder: 'e.g. agent app template, slack bot, rag app',
    seed: 'ai agent app in:name,description stars:>100',
    blurb: 'Search public repos for apps and integrations. Adding one registers it as a shared app your agents can call.',
  },
};

function ghHeaders() {
  const k = keyFor('github');
  const h = { 'Accept': 'application/vnd.github+json' };
  if (k && k.key) h['Authorization'] = 'Bearer ' + k.key;
  return h;
}

async function ghSearch(kind, query) {
  const q = (query || '').trim() || GH_KINDS[kind].seed;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=20`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (res.status === 403 || res.status === 429) {
    throw new Error('GitHub rate limit hit. Add a GitHub token in API Keys to raise search from 10/min to 30/min (and core API to 5,000/hr).');
  }
  if (!res.ok) throw new Error('GitHub search failed (HTTP ' + res.status + ')');
  const data = await res.json();
  return data.items || [];
}

function openGithubSearch(kind) {
  const meta = GH_KINDS[kind];
  openModal({
    title: meta.title,
    body: `
      <div class="hint-box mb-12"><span class="hi">🐙</span><div>${esc(meta.blurb)}</div></div>
      <div class="gh-search">
        <input type="text" id="ghQuery" placeholder="${esc(meta.placeholder)}" value="${esc(meta.seed)}">
        <button class="btn primary" id="ghGoBtn">Search</button>
      </div>
      <div class="gh-meta" id="ghMeta"></div>
      <div class="gh-results" id="ghResults"><div class="empty"><div class="big">🐙</div>Run a search to see repositories.</div></div>
    `,
    foot: `<button class="btn ghost" data-action="close-modal">Close</button>`,
  });
  const run = async () => {
    const box = $('#ghResults');
    box.innerHTML = `<div class="empty"><div class="big">⏳</div>Searching GitHub…</div>`;
    try {
      const items = await ghSearch(kind, $('#ghQuery').value);
      $('#ghMeta').textContent = `${items.length} repositories · sorted by stars`;
      renderGhResults(kind, items);
    } catch (e) {
      $('#ghMeta').textContent = '';
      box.innerHTML = `<div class="empty"><div class="big">⚠️</div>${esc(e.message)}</div>`;
    }
  };
  $('#ghGoBtn').onclick = run;
  $('#ghQuery').onkeydown = (e) => { if (e.key === 'Enter') run(); };
  run();
}

function renderGhResults(kind, items) {
  const box = $('#ghResults');
  if (!items.length) {
    box.innerHTML = `<div class="empty"><div class="big">🔍</div>No repositories matched.</div>`;
    return;
  }
  box.innerHTML = items.map(r => `
    <div class="gh-card">
      <div class="gh-card-top">
        <img class="gh-av" src="${esc(r.owner?.avatar_url || '')}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0">
          <div class="gh-name">${esc(r.full_name)}</div>
          <div class="gh-sub">★ ${r.stargazers_count.toLocaleString()} · ${esc(r.language || 'n/a')} · updated ${new Date(r.updated_at).toLocaleDateString()}</div>
        </div>
        <button class="btn sm primary" data-action="gh-add" data-kind="${kind}" data-repo="${esc(r.full_name)}" data-url="${esc(r.html_url)}" data-desc="${esc((r.description || '').slice(0, 300))}">＋ Add</button>
      </div>
      <div class="gh-desc">${esc(r.description || 'No description')}</div>
      <div class="gh-tags">
        ${(r.topics || []).slice(0, 6).map(t => `<span class="chip">${esc(t)}</span>`).join('')}
        <a class="gh-link" href="${esc(r.html_url)}" target="_blank" rel="noopener">View on GitHub ↗</a>
      </div>
    </div>`).join('');
}

function ghAdd(kind, repo, url, desc) {
  const short = repo.split('/')[1] || repo;
  const name = short.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 40);
  if (kind === 'skill') {
    if (state.skills.some(s => s.name === name)) { toast('Skill already added', 'warn'); return; }
    state.skills.push({ id: 'gh_' + uid(), name, icon: '⭐', desc: desc || repo, enabled: true, source: url });
    toast('Skill added: ' + name, 'ok');
  } else if (kind === 'mcp') {
    if (state.mcpServers.some(m => m.name === name)) { toast('MCP server already attached', 'warn'); return; }
    state.mcpServers.push({
      id: 'gh_' + uid(), name, transport: 'stdio',
      command: 'npx -y ' + short, args: '', url: '', status: 'disconnected', source: url,
    });
    toast('MCP server attached: ' + name, 'ok');
  } else {
    state.apps = state.apps || [];
    if (state.apps.some(a => a.name === name)) { toast('App already added', 'warn'); return; }
    state.apps.push({ id: 'gh_' + uid(), name, icon: '🧩', desc: desc || repo, repo, url, enabled: true });
    toast('App added: ' + name, 'ok');
  }
  save(); renderAll();
}

/* ---------------- console ---------------- */
function renderConsole() {
  $('#consoleAgents').textContent = state.agents.length;
  $('#consoleProvider').textContent = state.orchestrator.provider || 'pollinations';
  const body = $('#consoleBody');
  body.innerHTML = state.logs.map(l => `
    <div class="log-line log-${l.type}">
      <span class="lt">${l.t}</span>
      <span class="tag">${l.tag}</span>
      <span class="msg">${esc(l.msg)}</span>
    </div>`).join('');
  body.scrollTop = body.scrollHeight;
}

function log(type, tag, msg) {
  state.logs.push({ type, tag, msg, t: now() });
  if (state.logs.length > 400) state.logs.shift();
  renderConsole();
}

/* ---------------- modal system ---------------- */
function openModal({ title, body, foot, wide = true }) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  $('#modalFoot').innerHTML = foot || '';
  $('#modalBox').classList.toggle('wide', wide);
  $('#modalBackdrop').classList.add('show');
}
function closeModal() { $('#modalBackdrop').classList.remove('show'); }

/* ---------------- agent editor ---------------- */
function openAgentEditor(id) {
  const a = id ? state.agents.find(x => x.id === id) : null;
  const editing = !!a;
  const draft = a || { name: '', emoji: '🤖', role: '', model: 'gpt-4o', prompt: '', tools: [], skills: [], mcp: [], apis: [] };

  const toolChips = TOOL_LIBRARY.map(t => `<div class="chip ${draft.tools.includes(t.id) ? 'on' : ''}" data-chip="tool" data-id="${t.id}">${t.icon} ${esc(t.name)}</div>`).join('');
  const skillChips = SKILL_LIBRARY.map(s => `<div class="chip ${draft.skills.includes(s.id) ? 'on' : ''}" data-chip="skill" data-id="${s.id}">${s.icon} ${esc(s.name)}</div>`).join('');
  const mcpChips = state.mcpServers.length ? state.mcpServers.map(m => `<div class="chip ${draft.mcp.includes(m.id) ? 'on' : ''}" data-chip="mcp" data-id="${m.id}">🔌 ${esc(m.name)}</div>`).join('') : '<span class="muted" style="font-size:12px">No MCP servers attached yet.</span>';
  const apiChips = state.apis.length ? state.apis.map(x => `<div class="chip ${draft.apis.includes(x.id) ? 'on' : ''}" data-chip="api" data-id="${x.id}">🔗 ${esc(x.name)}</div>`).join('') : '<span class="muted" style="font-size:12px">No APIs attached yet.</span>';

  openModal({
    title: editing ? 'Edit Agent' : 'Add Agent',
    body: `
      <div class="grid cols-2" style="gap:14px">
        <label class="field"><span class="lbl">Name</span><input type="text" id="agName" value="${esc(draft.name)}" placeholder="e.g. Nova"></label>
        <label class="field"><span class="lbl">Emoji / Avatar</span><input type="text" id="agEmoji" value="${esc(draft.emoji)}" maxlength="4" placeholder="🤖"></label>
      </div>
      <div class="grid cols-2" style="gap:14px">
        <label class="field"><span class="lbl">Role</span><input type="text" id="agRole" value="${esc(draft.role)}" placeholder="e.g. Backend Engineer"></label>
        <label class="field"><span class="lbl">Model</span>
          <select id="agModel">
            ${['gpt-4o','gpt-4o-mini','claude-3.5-sonnet','claude-3-opus','gemini-1.5-pro','llama-3.1-70b','mistral-large','local:ollama'].map(m => `<option ${m === draft.model ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </label>
      </div>
      <label class="field"><span class="lbl">System Prompt</span><textarea id="agPrompt" style="min-height:120px" placeholder="Describe this agent's role, responsibilities, tone and boundaries…">${esc(draft.prompt)}</textarea></label>
      <div class="section-title">Builtin Tools</div>
      <div class="chip-select" style="margin-bottom:16px">${toolChips}</div>
      <div class="section-title">Skills</div>
      <div class="chip-select" style="margin-bottom:16px">${skillChips}</div>
      <div class="section-title">MCP Servers</div>
      <div class="chip-select" style="margin-bottom:16px">${mcpChips}</div>
      <div class="section-title">APIs</div>
      <div class="chip-select">${apiChips}</div>
    `,
    foot: `<button class="btn ghost" data-action="close-modal">Cancel</button>
           <button class="btn primary" data-action="save-agent" data-id="${editing ? a.id : ''}">${editing ? '💾 Save Agent' : '＋ Add Agent'}</button>`
  });

  // chip toggles
  $$('#modalBody .chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('on'));
  });
}

function saveAgentFromModal(id) {
  const name = $('#agName').value.trim();
  if (!name) { toast('Agent needs a name', 'err'); return; }
  const collect = type => $$(`#modalBody .chip[data-chip="${type}"].on`).map(c => c.dataset.id);
  const data = {
    name,
    emoji: $('#agEmoji').value.trim() || '🤖',
    role: $('#agRole').value.trim() || 'Generalist',
    model: $('#agModel').value,
    prompt: $('#agPrompt').value.trim(),
    tools: collect('tool'),
    skills: collect('skill'),
    mcp: collect('mcp'),
    apis: collect('api'),
    status: 'idle',
  };
  if (id) {
    Object.assign(state.agents.find(a => a.id === id), data);
    toast('Agent updated', 'ok');
  } else {
    state.agents.push({ id: uid(), ...data });
    toast('Agent added to ' + ({ single: 'roster', swarm: 'swarm', mix: 'mix' }[state.mode]), 'ok');
  }
  closeModal(); renderAll();
}

/* ---------------- import / export ---------------- */
function openImport() {
  openModal({
    title: 'Import Agents',
    body: `
      <div class="hint-box mb-12"><span class="hi">⬇</span><div>Paste an exported JSON payload from <b>Teamily.AI</b> or <b>gamut.io</b>, or a generic harness export. Format is auto-detected.</div></div>
      <div class="flex gap-8 mb-12">
        <button class="btn sm" data-action="import-file">📂 Choose file…</button>
        <button class="btn sm ghost" data-action="import-sample-teamily">Load Teamily sample</button>
        <button class="btn sm ghost" data-action="import-sample-gamut">Load gamut sample</button>
      </div>
      <label class="field"><span class="lbl">JSON payload</span><textarea id="importJson" style="min-height:220px" placeholder='{ "platform": "teamily.ai", "agents": [ … ] }'></textarea></label>
      <div id="importPreview"></div>
    `,
    foot: `<button class="btn ghost" data-action="close-modal">Cancel</button>
           <button class="btn primary" data-action="do-import">⬇ Import</button>`
  });
  const ta = $('#importJson');
  ta.addEventListener('input', () => previewImport(ta.value));
}

function detectAndNormalize(raw) {
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch (e) { throw new Error('Invalid JSON: ' + e.message); }

  let platform = (data.platform || data.source || '').toLowerCase();
  let arr = data.agents || data.team || data.items || (Array.isArray(data) ? data : null);
  if (!arr) throw new Error('No agents array found in payload.');

  const norm = arr.map(x => {
    // Teamily.AI shape
    if (platform.includes('teamily') || x.persona || x.instructions !== undefined && x.displayName === undefined) {
      return {
        name: x.name || x.displayName || 'Agent',
        emoji: x.avatar || x.emoji || '🤖',
        role: x.role || x.description || 'Imported Agent',
        model: x.model || x.llm || 'gpt-4o',
        prompt: x.persona || x.instructions || x.prompt || x.systemPrompt || '',
        tools: x.tools || x.capabilities || [],
        skills: x.skills || [],
        mcp: x.mcpServers || x.mcp || [],
        apis: x.apis || x.integrations || [],
        status: 'idle',
      };
    }
    // gamut.io shape
    if (platform.includes('gamut') || x.displayName !== undefined || x.llm !== undefined) {
      return {
        name: x.displayName || x.name || 'Agent',
        emoji: x.icon || x.emoji || '🤖',
        role: x.role || x.tagline || 'Imported Agent',
        model: x.llm || x.model || 'gpt-4o',
        prompt: x.instructions || x.systemPrompt || x.prompt || '',
        tools: x.capabilities || x.tools || [],
        skills: x.skills || [],
        mcp: x.integrations || x.mcp || [],
        apis: x.apis || [],
        status: 'idle',
      };
    }
    // generic
    return {
      name: x.name || 'Agent',
      emoji: x.emoji || '🤖',
      role: x.role || 'Imported Agent',
      model: x.model || 'gpt-4o',
      prompt: x.prompt || x.systemPrompt || x.instructions || '',
      tools: x.tools || [],
      skills: x.skills || [],
      mcp: x.mcp || [],
      apis: x.apis || [],
      status: 'idle',
    };
  });
  return { platform: platform || 'generic', agents: norm };
}

function previewImport(raw) {
  const box = $('#importPreview');
  if (!raw.trim()) { box.innerHTML = ''; return; }
  try {
    const { platform, agents } = detectAndNormalize(raw);
    box.innerHTML = `<div class="hint-box"><span class="hi">✅</span><div>Detected <b>${esc(platform)}</b> · ${agents.length} agent(s): ${agents.map(a => esc(a.name)).join(', ')}</div></div>`;
  } catch (e) {
    box.innerHTML = `<div class="hint-box" style="background:var(--red-soft);border-color:rgba(239,68,68,.3);color:#fca5a5"><span class="hi">⚠️</span><div>${esc(e.message)}</div></div>`;
  }
}

function doImport() {
  const raw = $('#importJson').value;
  try {
    const { platform, agents } = detectAndNormalize(raw);
    let added = 0;
    agents.forEach(a => {
      // map tool/skill names to ids if they came as display names
      a.tools = a.tools.map(t => TOOL_LIBRARY.find(x => x.id === t || x.name.toLowerCase() === String(t).toLowerCase())?.id || t);
      a.skills = a.skills.map(s => SKILL_LIBRARY.find(x => x.id === s || x.name.toLowerCase() === String(s).toLowerCase())?.id || s);
      state.agents.push({ id: uid(), ...a });
      added++;
    });
    closeModal(); renderAll();
    toast(`Imported ${added} agent(s) from ${platform}`, 'ok');
  } catch (e) {
    toast('Import failed: ' + e.message, 'err');
  }
}

function openExport() {
  openModal({
    title: 'Export Agents',
    body: `
      <div class="hint-box mb-12"><span class="hi">⬆</span><div>Export the current roster to a format you can re-import into <b>Teamily.AI</b>, <b>gamut.io</b>, or this harness.</div></div>
      <div class="chip-select mb-12" id="exportFormat">
        <div class="chip on" data-fmt="teamily">Teamily.AI</div>
        <div class="chip" data-fmt="gamut">gamut.io</div>
        <div class="chip" data-fmt="generic">Generic Harness</div>
      </div>
      <label class="field"><span class="lbl">Preview</span><textarea id="exportJson" style="min-height:260px" readonly></textarea></label>
    `,
    foot: `<button class="btn ghost" data-action="close-modal">Close</button>
           <button class="btn" data-action="copy-export">📋 Copy</button>
           <button class="btn primary" data-action="download-export">⬇ Download</button>`
  });
  let fmt = 'teamily';
  const render = () => { $('#exportJson').value = buildExport(fmt); };
  $$('#exportFormat .chip').forEach(c => c.addEventListener('click', () => {
    $$('#exportFormat .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); fmt = c.dataset.fmt; render();
  }));
  $('#exportJson').dataset.fmt = 'teamily';
  render();
  // keep current fmt accessible
  window.__exportFmt = () => fmt;
}

function buildExport(fmt) {
  const agents = state.agents;
  if (fmt === 'teamily') {
    return JSON.stringify({
      platform: 'teamily.ai',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      agents: agents.map(a => ({
        name: a.name,
        avatar: a.emoji,
        description: a.role,
        persona: a.prompt,
        model: a.model,
        tools: a.tools,
        skills: a.skills,
        mcpServers: a.mcp,
        apis: a.apis,
      })),
    }, null, 2);
  }
  if (fmt === 'gamut') {
    return JSON.stringify({
      platform: 'gamut.io',
      schema: 'gamut.agent.v1',
      exportedAt: new Date().toISOString(),
      agents: agents.map(a => ({
        displayName: a.name,
        icon: a.emoji,
        role: a.role,
        instructions: a.prompt,
        llm: a.model,
        capabilities: a.tools,
        skills: a.skills,
        integrations: a.mcp,
        apis: a.apis,
      })),
    }, null, 2);
  }
  return JSON.stringify({
    platform: 'agent-harness',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    orchestrator: state.orchestrator,
    agents,
    mcpServers: state.mcpServers,
    apis: state.apis,
  }, null, 2);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- mcp editor ---------------- */
function openMcpEditor(id) {
  const m = id ? state.mcpServers.find(x => x.id === id) : null;
  openModal({
    title: id ? 'Edit MCP Server' : 'Attach MCP Server',
    body: `
      <label class="field"><span class="lbl">Name</span><input type="text" id="mcpName" value="${m ? esc(m.name) : ''}" placeholder="e.g. github"></label>
      <label class="field"><span class="lbl">Transport</span>
        <select id="mcpTransport">
          <option ${m && m.transport === 'stdio' ? 'selected' : ''}>stdio</option>
          <option ${m && m.transport === 'http' ? 'selected' : ''}>http</option>
          <option ${m && m.transport === 'sse' ? 'selected' : ''}>sse</option>
        </select>
      </label>
      <label class="field"><span class="lbl">Command or URL</span><input type="text" id="mcpTarget" value="${m ? esc(m.target) : ''}" placeholder="npx -y @modelcontextprotocol/server-…  |  https://…"></label>
      <div class="hint-box"><span class="hi">🔌</span><div>Once attached, this server's tools are shared with every agent in the harness.</div></div>
    `,
    foot: `<button class="btn ghost" data-action="close-modal">Cancel</button>
           <button class="btn primary" data-action="save-mcp" data-id="${id || ''}">${id ? '💾 Save' : '＋ Attach'}</button>`
  });
}
function saveMcp(id) {
  const name = $('#mcpName').value.trim();
  if (!name) { toast('Name required', 'err'); return; }
  const data = { name, transport: $('#mcpTransport').value, target: $('#mcpTarget').value.trim(), status: 'connected' };
  if (id) Object.assign(state.mcpServers.find(x => x.id === id), data);
  else state.mcpServers.push({ id: uid(), ...data });
  closeModal(); renderAll(); toast('MCP server ' + (id ? 'updated' : 'attached'), 'ok');
}

/* ---------------- api editor ---------------- */
function openApiEditor(id) {
  const a = id ? state.apis.find(x => x.id === id) : null;
  openModal({
    title: id ? 'Edit API' : 'Attach API',
    body: `
      <label class="field"><span class="lbl">Name</span><input type="text" id="apiName" value="${a ? esc(a.name) : ''}" placeholder="e.g. OpenAI"></label>
      <label class="field"><span class="lbl">Base URL</span><input type="text" id="apiBase" value="${a ? esc(a.baseUrl) : ''}" placeholder="https://api.example.com/v1"></label>
      <div class="grid cols-2" style="gap:14px">
        <label class="field"><span class="lbl">Auth Type</span>
          <select id="apiAuth">
            <option ${a && a.auth === 'Bearer' ? 'selected' : ''}>Bearer</option>
            <option ${a && a.auth === 'API Key' ? 'selected' : ''}>API Key</option>
            <option ${a && a.auth === 'Basic' ? 'selected' : ''}>Basic</option>
            <option ${a && a.auth === 'OAuth2' ? 'selected' : ''}>OAuth2</option>
            <option ${a && a.auth === 'None' ? 'selected' : ''}>None</option>
          </select>
        </label>
        <label class="field"><span class="lbl">Key / Token</span><input type="password" id="apiKey" value="${a ? esc(a.key) : ''}" placeholder="••••••••"></label>
      </div>
      <div class="hint-box"><span class="hi">🔗</span><div>Credentials are stored locally and shared with every agent. Use a scoped key.</div></div>
    `,
    foot: `<button class="btn ghost" data-action="close-modal">Cancel</button>
           <button class="btn primary" data-action="save-api" data-id="${id || ''}">${id ? '💾 Save' : '＋ Attach'}</button>`
  });
}
function saveApi(id) {
  const name = $('#apiName').value.trim();
  if (!name) { toast('Name required', 'err'); return; }
  const data = { name, baseUrl: $('#apiBase').value.trim(), auth: $('#apiAuth').value, key: $('#apiKey').value || '••••••••', status: 'connected' };
  if (id) Object.assign(state.apis.find(x => x.id === id), data);
  else state.apis.push({ id: uid(), ...data });
  closeModal(); renderAll(); toast('API ' + (id ? 'updated' : 'attached'), 'ok');
}

/* ---------------- file ops ---------------- */
function openNewFile() {
  openModal({
    title: 'New File',
    body: `
      <label class="field"><span class="lbl">Path</span><input type="text" id="newFilePath" placeholder="e.g. docs/plan.md"></label>
      <label class="field"><span class="lbl">Initial content</span><textarea id="newFileContent" style="min-height:140px" placeholder="Optional…"></textarea></label>
    `,
    foot: `<button class="btn ghost" data-action="close-modal">Cancel</button>
           <button class="btn primary" data-action="create-file">＋ Create</button>`
  });
}
function createFile() {
  const path = $('#newFilePath').value.trim();
  if (!path) { toast('Path required', 'err'); return; }
  if (state.workspace.files.find(f => f.path === path)) { toast('File already exists', 'err'); return; }
  state.workspace.files.push({ path, content: $('#newFileContent').value, by: 'you', at: Date.now() });
  state.workspace.selected = path;
  closeModal(); renderAll(); toast('File created', 'ok');
}

/* ---------------- LLM CLIENT — Pollinations.ai (keyless) ---------------- */
/* Hard throttle: 1 request / 30 seconds, serialized across ALL agents. */
const LLM_INTERVAL = 30000;
let llmChain = Promise.resolve();
let llmLastCall = 0;
let llmCallsThisRun = 0;

const POLL_MODEL_MAP = {
  'gpt-4o': 'openai-fast',
  'gpt-4o-mini': 'openai-fast',
  'claude-3.5-sonnet': 'openai-fast',
  'claude-3-opus': 'openai-fast',
  'gemini-1.5-pro': 'openai-fast',
  'llama-3.1-70b': 'openai-fast',
  'mistral-large': 'openai-fast',
  'local:ollama': 'openai-fast',
};
const pollModel = m => POLL_MODEL_MAP[m] || 'openai-fast';

async function countdownWait(ms, label) {
  const end = Date.now() + ms;
  log('tool', 'THROTTLE', `⏳ ${label}: next LLM slot in ${Math.ceil(ms / 1000)}s (limit 1 req / 30s)`);
  while (Date.now() < end) {
    const left = Math.ceil((end - Date.now()) / 1000);
    const el = $('#throttleLive');
    if (el) el.textContent = `Next slot in ${left}s…`;
    await sleep(Math.min(1000, Math.max(50, end - Date.now())));
  }
  const el = $('#throttleLive');
  if (el) el.textContent = 'Slot acquired.';
}

/* ---- direct browser → provider calls (no proxy needed; all major providers send CORS) ---- */
const DIRECT_ENDPOINTS = {
  openai:      'https://api.openai.com/v1/chat/completions',
  groq:        'https://api.groq.com/openai/v1/chat/completions',
  together:    'https://api.together.xyz/v1/chat/completions',
  openrouter:  'https://openrouter.ai/api/v1/chat/completions',
  deepseek:    'https://api.deepseek.com/chat/completions',
  xai:         'https://api.x.ai/v1/chat/completions',
  mistral:     'https://api.mistral.ai/v1/chat/completions',
  fireworks:   'https://api.fireworks.ai/inference/v1/chat/completions',
  perplexity:  'https://api.perplexity.ai/chat/completions',
  huggingface: 'https://router.huggingface.co/v1/chat/completions',
  pollinations:'https://text.pollinations.ai/openai',
};
const DIRECT_MODELS = {
  openai:    { 'gpt-4o':'gpt-4o', 'gpt-4o-mini':'gpt-4o-mini', 'claude-3.5-sonnet':'gpt-4o', 'claude-3-opus':'gpt-4o', 'gemini-1.5-pro':'gpt-4o', 'llama-3.1-70b':'gpt-4o-mini', 'mistral-large':'gpt-4o-mini', 'local:ollama':'gpt-4o-mini' },
  anthropic: { 'claude-3.5-sonnet':'claude-3-5-sonnet-latest', 'claude-3-opus':'claude-3-opus-20240229', 'gpt-4o':'claude-3-5-sonnet-latest' },
  google:    { 'gemini-1.5-pro':'gemini-1.5-pro', 'gpt-4o':'gemini-1.5-pro' },
  groq:      { 'llama-3.1-70b':'llama-3.3-70b-versatile', 'gpt-4o':'llama-3.3-70b-versatile', 'gpt-4o-mini':'llama-3.1-8b-instant' },
  together:  { 'llama-3.1-70b':'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'gpt-4o':'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  openrouter:{ 'gpt-4o':'openai/gpt-4o', 'gpt-4o-mini':'openai/gpt-4o-mini', 'claude-3.5-sonnet':'anthropic/claude-3.5-sonnet', 'gemini-1.5-pro':'google/gemini-pro-1.5', 'llama-3.1-70b':'meta-llama/llama-3.3-70b-instruct' },
  deepseek:  { 'gpt-4o':'deepseek-chat', 'llama-3.1-70b':'deepseek-chat' },
  xai:       { 'gpt-4o':'grok-2-latest', 'llama-3.1-70b':'grok-2-latest' },
  mistral:   { 'mistral-large':'mistral-large-latest', 'gpt-4o':'mistral-large-latest' },
  fireworks: { 'llama-3.1-70b':'accounts/fireworks/models/llama-v3p3-70b-instruct', 'gpt-4o':'accounts/fireworks/models/llama-v3p3-70b-instruct' },
  perplexity:{ 'gpt-4o':'sonar', 'gpt-4o-mini':'sonar' },
  huggingface:{ 'llama-3.1-70b':'meta-llama/Llama-3.3-70B-Instruct', 'gpt-4o':'meta-llama/Llama-3.3-70B-Instruct' },
  pollinations:{ 'gpt-4o':'openai-fast' },
};
function directModel(provider, ui) {
  const m = DIRECT_MODELS[provider] || {};
  return m[ui] || ui;
}
let proxyOnline = false; // set by refreshThrottleStatus()
function backendBase() {
  return String((state.settings && state.settings.backendUrl) || '').replace(/\/+$/, '');
}

async function directLLM({ provider, key, model, system, user, maxTokens, temperature }) {
  const mdl = directModel(provider, model);
  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: mdl, max_tokens: maxTokens, temperature,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: user }],
      }),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error('Anthropic HTTP ' + r.status + ' ' + txt.slice(0, 160));
    const d = JSON.parse(txt);
    const out = (d.content || []).map(c => c.text || '').join('').trim();
    if (!out) throw new Error('Empty Anthropic response');
    return out;
  }
  if (provider === 'google') {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(mdl) + ':generateContent?key=' + encodeURIComponent(key);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error('Gemini HTTP ' + r.status + ' ' + txt.slice(0, 160));
    const d = JSON.parse(txt);
    const out = ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [])
      .map(p => p.text || '').join('').trim();
    if (!out) throw new Error('Empty Gemini response');
    return out;
  }
  const endpoint = DIRECT_ENDPOINTS[provider];
  if (!endpoint) throw new Error('No direct endpoint for "' + provider + '" — set a Backend URL in API Keys.');
  const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + key };
  if (provider === 'openrouter') { headers['HTTP-Referer'] = location.origin; headers['X-Title'] = 'Agent Harness'; }
  const r = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: mdl,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
      temperature, max_tokens: maxTokens,
    }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(provider + ' HTTP ' + r.status + ' ' + txt.slice(0, 160));
  const d = JSON.parse(txt);
  const out = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
  if (!out) throw new Error('Empty ' + provider + ' response');
  return String(out).trim();
}

async function callLLM({ system, user, maxTokens = 800, temperature = 0.6, label = 'LLM' }) {
  const provider = state.orchestrator.provider || 'pollinations';
  if (provider === 'simulated') {
    await sleep(500 + Math.random() * 400);
    return simulatedReply(system, user, label);
  }

  const run = async () => {
    // Resolve a key for the active provider (keyed = no throttle, any provider)
    const activeKey = keyFor(provider);
    const keyed = !!(activeKey && activeKey.key);
    const base = backendBase();
    const payload = {
      model: provider === 'pollinations' ? pollModel(state.orchestrator.model) : state.orchestrator.model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
      private: true,
      referrer: 'agent-harness',
      _provider: provider,
    };
    if (keyed) payload._apiKey = activeKey.key;

    const attempt = async (n) => {
      // client throttle: only for keyless pollinations, measured from the *end* of the previous call
      if (!keyed) {
        const wait = Math.max(0, llmLastCall + LLM_INTERVAL + 2000 - Date.now());
        if (wait > 0) await countdownWait(wait, label);
      }

      // keyed + no proxy anywhere → straight to the provider from the browser (CORS-safe)
      if (keyed && !base && !proxyOnline) {
        const out = await directLLM({ provider, key: activeKey.key, model: state.orchestrator.model, system, user, maxTokens, temperature });
        llmLastCall = Date.now();
        return out;
      }

      let res, txt = '';
      try {
        res = await fetch((base || '') + '/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        // network-level failure only (DNS/CORS/offline) — HTTP errors handled below
        if (keyed) {
          log('tool', 'DIRECT', 'Proxy unreachable — calling ' + provider + ' directly from the browser.');
          const out = await directLLM({ provider, key: activeKey.key, model: state.orchestrator.model, system, user, maxTokens, temperature });
          llmLastCall = Date.now();
          return out;
        }
        // keyless fallback for static hosting without the proxy (Pollinations allows CORS)
        if (provider !== 'pollinations') throw e;
        res = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        txt = await res.text().catch(() => '');
        // free-tier limit or transient error → back off and retry
        if ((res.status === 402 || res.status === 429 || res.status >= 500) && n < 3) {
          const m = /retry after (\d+)\s*s/i.exec(txt);
          const delay = (m ? parseInt(m[1], 10) : 30) * 1000 + 3000;
          log('tool', 'THROTTLE', `⚠ upstream limit (${res.status}) — retrying in ${Math.round(delay / 1000)}s`);
          await countdownWait(delay, label);
          return attempt(n + 1);
        }
        throw new Error('LLM HTTP ' + res.status + ' ' + txt.slice(0, 140));
      }

      llmLastCall = Date.now(); // completion-based spacing
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty LLM response');
      return String(content).trim();
    };

    llmCallsThisRun++;
    return attempt(0);
  };

  const p = llmChain.then(run, run);
  llmChain = p.catch(() => {});
  return p;
}

function simulatedReply(system, user, label) {
  const who = (system || '').split('\n')[0].slice(0, 60);
  return `[simulated · ${label}] ${who}\n\nProcessed: ${String(user).slice(0, 160)}…\n\n- Key point 1\n- Key point 2\n- Next step: hand off to the team.`;
}

/* ---------------- RUN ENGINE ---------------- */
let running = false;

function rosterBrief() {
  return state.agents.map(a =>
    `- ${a.name} (${a.role}) | model=${a.model} | tools=[${a.tools.join(', ')}] | skills=[${a.skills.join(', ')}]`
  ).join('\n');
}

function sharedResourcesBrief() {
  const mcp = state.mcpServers.filter(m => m.status === 'connected').map(m => m.name).join(', ') || 'none';
  const apis = state.apis.filter(a => a.status === 'connected').map(a => a.name).join(', ') || 'none';
  const tools = state.tools.filter(t => t.enabled).map(t => t.name).join(', ') || 'none';
  const skills = state.skills.filter(s => s.enabled).map(s => s.name).join(', ') || 'none';
  return `MCP servers: ${mcp}\nAPIs: ${apis}\nBuiltin tools: ${tools}\nSkills: ${skills}`;
}

function workspaceBrief() {
  if (!state.workspace.files.length) return '(workspace is empty)';
  return state.workspace.files.map(f => `- ${f.path} (${f.content.length} chars, by ${f.by})`).join('\n');
}

function parsePlanJSON(text) {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('no JSON array');
  const arr = JSON.parse(t.slice(start, end + 1));
  if (!Array.isArray(arr) || !arr.length) throw new Error('empty plan');
  return arr;
}

async function orchestratePlan(task) {
  const mode = state.mode;
  const modeRule = {
    single: 'Assign the ENTIRE task to exactly ONE best-fit agent. Return a 1-item array.',
    swarm: 'Decompose into independent subtasks and assign each to a different agent so they can run in parallel. Return one item per subtask.',
    mix: 'Route each subtask to the best-fit lead agent, consulting specialists where useful. Return 2-4 items.',
  }[mode];

  const system = `${state.orchestrator.prompt}\n\n---\nACTIVE MODE: ${mode.toUpperCase()}\nMODE RULE: ${modeRule}\n\nAVAILABLE AGENTS:\n${rosterBrief()}\n\nSHARED RESOURCES:\n${sharedResourcesBrief()}\n\nSHARED WORKSPACE (read/write for all agents):\n${workspaceBrief()}\n\nRespond with ONLY a JSON array (no prose, no code fences) of objects: {"agent": "<exact agent name>", "subtask": "<clear, self-contained instruction>"}`;

  const raw = await callLLM({ system, user: `TASK: ${task}`, maxTokens: 700, temperature: 0.3, label: 'Orchestrator plan' });
  const arr = parsePlanJSON(raw);
  const plan = arr.map(item => {
    const agent = state.agents.find(a => a.name.toLowerCase() === String(item.agent || '').toLowerCase())
      || pickLead(item.subtask || task);
    return { agent, subtask: String(item.subtask || task) };
  }).filter(p => p.agent);
  if (!plan.length) throw new Error('plan had no valid agents');
  return plan;
}

function localPlan(task) {
  const mode = state.mode;
  if (mode === 'single') return [{ agent: pickLead(task), subtask: task }];
  const n = mode === 'swarm' ? state.agents.length : Math.max(2, Math.min(state.agents.length, 4));
  const subs = decompose(task, n);
  return subs.map((s, i) => ({ agent: state.agents[i % state.agents.length], subtask: s }));
}

async function runAgentLive(p, task, priorOutputs) {
  const a = p.agent;
  a.status = 'working'; renderAgents(); renderDashboard();

  const context = priorOutputs.length
    ? priorOutputs.map(o => `### ${o.agent.name} — ${o.subtask}\n${o.content.slice(0, 700)}`).join('\n\n')
    : '(you are the first to contribute)';

  const system = `${a.prompt}\n\n---\nYou are ${a.name}, the ${a.role} in a multi-agent harness.\nYour tools: ${a.tools.join(', ') || 'none'}\nYour skills: ${a.skills.join(', ') || 'none'}\nShared MCP servers: ${a.mcp.length ? a.mcp.map(id => state.mcpServers.find(m => m.id === id)?.name).filter(Boolean).join(', ') : 'none'}\nShared APIs: ${a.apis.length ? a.apis.map(id => state.apis.find(x => x.id === id)?.name).filter(Boolean).join(', ') : 'none'}\n\nSHARED WORKSPACE (read + write):\n${workspaceBrief()}\n\nTEAM OUTPUTS SO FAR:\n${context}\n\nProduce concrete, self-contained work product for your subtask. Be specific and actionable. Do not describe what you would do — do it.`;

  log('agent', a.name.toUpperCase(), `▶ ${p.subtask}`);
  let content;
  try {
    content = await callLLM({
      system,
      user: `Overall project task: ${task}\n\nYour subtask: ${p.subtask}`,
      maxTokens: 900,
      temperature: state.orchestrator.temperature,
      label: a.name,
    });
  } catch (e) {
    log('err', 'ERR', `${a.name} failed: ${e.message}`);
    a.status = 'idle'; renderAgents(); renderDashboard();
    return { agent: a, subtask: p.subtask, content: `[failed: ${e.message}]`, file: null };
  }

  const file = workspaceWriteFor(a, p.subtask, content);
  log('ws', 'WS', `${a.name} wrote ${file.path} (${content.length} chars)`);
  log('agent', a.name.toUpperCase(), `✓ ${p.subtask} — done`);

  a.status = 'idle'; renderAgents(); renderDashboard();
  save();
  return { agent: a, subtask: p.subtask, content, file };
}

async function synthesize(task, outputs) {
  const system = `${state.orchestrator.prompt}\n\nYou are consolidating the final deliverable for the user. Merge the team's contributions into one coherent, complete answer. Note any gaps. Use Markdown.`;
  const user = `TASK: ${task}\n\nTEAM CONTRIBUTIONS:\n${outputs.map(o => `## ${o.agent.name} (${o.agent.role}) — ${o.subtask}\n${o.content}`).join('\n\n')}\n\nProduce the final consolidated deliverable.`;
  try {
    return await callLLM({ system, user, maxTokens: 1100, temperature: state.orchestrator.temperature, label: 'Synthesis' });
  } catch (e) {
    log('err', 'ERR', 'Synthesis failed: ' + e.message);
    return outputs.map(o => `## ${o.agent.name}\n${o.content}`).join('\n\n');
  }
}

async function runTask(text) {
  if (running) { toast('Already running', 'warn'); return; }
  if (!state.agents.length) { toast('Add at least one agent first', 'err'); return; }

  const task = (text || $('#taskInput').value || '').trim() || 'Analyze the project and produce a status report';
  const mode = state.mode;
  const provider = state.orchestrator.provider || 'pollinations';
  const live = provider === 'pollinations';

  running = true;
  llmCallsThisRun = 0;
  $('#runBtn').disabled = true; $('#sendTaskBtn').disabled = true;

  log('sys', 'SYS', `Session started · mode=${mode.toUpperCase()} · provider=${provider}${live ? ' · throttle 1/30s' : ''}`);
  log('orch', 'ORCH', `${state.orchestrator.name} received task: "${task}"`);
  if (live) log('sys', 'TIP', 'Keyless Pollinations calls are throttled to 1 per 30s — runs with several agents take a few minutes.');

  // ---- 1. PLAN ----
  let plan;
  try {
    plan = live ? await orchestratePlan(task) : localPlan(task);
    log('orch', 'PLAN', `${mode.toUpperCase()} plan · ${plan.length} assignment(s):`);
    plan.forEach(p => log('orch', '→', `  ${p.agent.name} (${p.agent.role}) ⟵ ${p.subtask}`));
  } catch (e) {
    log('err', 'ERR', 'Planning failed (' + e.message + ') — falling back to local planner.');
    plan = localPlan(task);
  }

  // ---- 2. EXECUTE (serialized by the throttle) ----
  // per-mode cap on how many assignments actually run
  const cap = parseInt(state.orchestrator.maxAgents, 10) || 0;
  if (cap > 0 && plan.length > cap) {
    log('orch', 'CAP', `Mode limit: ${plan.length} assignments trimmed to ${cap}.`);
    plan = plan.slice(0, cap);
  }
  const outputs = [];
  for (const p of plan) {
    outputs.push(await runAgentLive(p, task, outputs));
  }

  // ---- 3. REVIEW (per-mode toggle) ----
  const reviewer = state.agents.find(a => a.skills.includes('review') || /qa|review/i.test(a.role));
  if (state.orchestrator.reviewer !== false && reviewer && mode !== 'single' && outputs.length > 1) {
    log('agent', reviewer.name.toUpperCase(), 'Reviewing consolidated output…');
    try {
      const review = await callLLM({
        system: `${reviewer.prompt}\n\nYou are reviewing the team's combined output. List blocking issues only, or reply "PASS" if acceptable.`,
        user: outputs.map(o => `## ${o.agent.name}\n${o.content}`).join('\n\n').slice(0, 6000),
        maxTokens: 400, temperature: 0.2, label: reviewer.name + ' review',
      });
      log('agent', reviewer.name.toUpperCase(), '✓ Review: ' + review.slice(0, 220).replace(/\n/g, ' '));
    } catch (e) {
      log('err', 'ERR', 'Review skipped: ' + e.message);
    }
  }

  // ---- 4. SYNTHESIZE ----
  log('orch', 'ORCH', 'Consolidating final deliverable…');
  const final = await synthesize(task, outputs);
  const finalFile = 'FINAL.md';
  const existing = state.workspace.files.find(f => f.path === finalFile);
  const body = `# Final Deliverable\n\n**Task:** ${task}\n**Mode:** ${mode}\n**Agents:** ${outputs.map(o => o.agent.name).join(', ')}\n\n---\n\n${final}\n`;
  if (existing) { existing.content = body; existing.by = state.orchestrator.name; existing.at = Date.now(); }
  else state.workspace.files.push({ path: finalFile, content: body, by: state.orchestrator.name, at: Date.now() });
  log('ws', 'WS', `Orchestrator wrote ${finalFile} (${body.length} chars)`);

  log('done', 'DONE', `Task complete · ${outputs.length} agent(s) · ${llmCallsThisRun} LLM call(s) · workspace has ${state.workspace.files.length} files.`);

  running = false;
  $('#runBtn').disabled = false; $('#sendTaskBtn').disabled = false;
  $('#taskInput').value = '';
  renderAll();
  toast('Run complete — see FINAL.md in the workspace', 'ok');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function pickLead(task, fallback) {
  const t = String(task).toLowerCase();
  const score = a => {
    let s = 0;
    const hay = (a.role + ' ' + a.skills.join(' ') + ' ' + a.tools.join(' ')).toLowerCase();
    ['code', 'build', 'app', 'api', 'backend', 'frontend', 'engineer'].forEach(k => { if (t.includes(k) && /cod|engineer|dev|test/.test(hay)) s += 3; });
    ['write', 'copy', 'content', 'blog', 'doc', 'article'].forEach(k => { if (t.includes(k) && /writ|content|summar/.test(hay)) s += 3; });
    ['research', 'find', 'analyze', 'investigate', 'data'].forEach(k => { if (t.includes(k) && /research|analys|data/.test(hay)) s += 3; });
    ['design', 'ui', 'ux', 'visual'].forEach(k => { if (t.includes(k) && /design/.test(hay)) s += 3; });
    ['test', 'qa', 'review', 'bug'].forEach(k => { if (t.includes(k) && /review|test|qa|security/.test(hay)) s += 3; });
    return s;
  };
  const sorted = [...state.agents].sort((a, b) => score(b) - score(a));
  return sorted[0] || fallback || state.agents[0];
}

function decompose(task, n) {
  const t = String(task).toLowerCase();
  let base;
  if (/build|app|site|code|api|software|landing/.test(t)) {
    base = ['Research requirements and competitive context',
      'Design the architecture and data model',
      'Implement the core application code',
      'Write documentation and usage guide',
      'Test, review and harden the build'];
  } else if (/write|content|blog|article|copy|doc/.test(t)) {
    base = ['Research the topic and gather sources',
      'Draft the outline and key arguments',
      'Write the full content',
      'Edit for clarity, tone and accuracy'];
  } else if (/research|analy|investigate|data|report/.test(t)) {
    base = ['Define the research questions',
      'Collect data from multiple sources',
      'Analyze and synthesize findings',
      'Write the final report'];
  } else {
    base = ['Clarify the goal and constraints',
      'Plan the approach',
      'Execute the core work',
      'Review and finalize the deliverable'];
  }
  const out = [];
  for (let i = 0; i < n; i++) out.push(base[i % base.length]);
  return out;
}

function workspaceWriteFor(a, subtask, content) {
  const slug = String(subtask).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'output';
  let path;
  if (a.skills.includes('coding')) path = 'src/' + slug + '.md';
  else if (a.skills.includes('writing')) path = 'docs/' + slug + '.md';
  else if (a.skills.includes('research')) path = 'research/' + slug + '.md';
  else if (a.skills.includes('design')) path = 'design/' + slug + '.md';
  else path = 'notes/' + slug + '.md';

  const body = `# ${subtask}\n\n_By ${a.name} · ${a.role} · ${new Date().toLocaleString()}_\n\n${content}\n`;
  const existing = state.workspace.files.find(f => f.path === path);
  if (existing) { existing.content = body; existing.by = a.name; existing.at = Date.now(); }
  else state.workspace.files.push({ path, content: body, by: a.name, at: Date.now() });
  return { path, content: body };
}

/* ---------------- global event wiring ---------------- */
document.addEventListener('click', (e) => {
  const nav = e.target.closest('.nav-item');
  if (nav) { setView(nav.dataset.view); return; }

  const modeBtn = e.target.closest('.mode-btn');
  if (modeBtn) { setMode(modeBtn.dataset.mode); return; }

  const act = e.target.closest('[data-action]');
  if (!act) return;
  const action = act.dataset.action;
  const id = act.dataset.id;

  switch (action) {
    case 'goto': setView(act.dataset.view); break;
    case 'add-agent': openAgentEditor(null); break;
    case 'edit-agent': openAgentEditor(id); break;
    case 'save-agent': saveAgentFromModal(id); break;
    case 'dup-agent': {
      const a = state.agents.find(x => x.id === id);
      if (a) { state.agents.push({ ...a, id: uid(), name: a.name + ' (copy)', status: 'idle' }); renderAll(); toast('Agent duplicated', 'ok'); }
      break;
    }
    case 'del-agent': {
      const a = state.agents.find(x => x.id === id);
      if (a && confirm(`Remove agent "${a.name}"?`)) {
        state.agents = state.agents.filter(x => x.id !== id); renderAll(); toast('Agent removed', 'warn');
      }
      break;
    }
    case 'open-file': state.workspace.selected = act.dataset.path; renderWorkspace(); break;
    case 'create-file': createFile(); break;
    case 'edit-mcp': openMcpEditor(id); break;
    case 'save-mcp': saveMcp(id); break;
    case 'del-mcp': state.mcpServers = state.mcpServers.filter(x => x.id !== id); renderAll(); toast('MCP server removed', 'warn'); break;
    case 'toggle-mcp': { const m = state.mcpServers.find(x => x.id === id); if (m) { m.status = m.status === 'connected' ? 'paused' : 'connected'; renderAll(); } break; }
    case 'edit-api': openApiEditor(id); break;
    case 'save-api': saveApi(id); break;
    case 'del-api': state.apis = state.apis.filter(x => x.id !== id); renderAll(); toast('API removed', 'warn'); break;
    case 'toggle-api': { const a = state.apis.find(x => x.id === id); if (a) { a.status = a.status === 'connected' ? 'paused' : 'connected'; renderAll(); } break; }
    case 'toggle-tool': { const t = state.tools.find(x => x.id === id); if (t) { t.enabled = !t.enabled; renderTools(); save(); } break; }
    case 'toggle-skill': { const s = state.skills.find(x => x.id === id); if (s) { s.enabled = !s.enabled; renderTools(); save(); } break; }
    case 'toggle-app': { const a = (state.apps || []).find(x => x.id === id); if (a) { a.enabled = a.enabled === false; renderTools(); save(); } break; }
    case 'del-app': state.apps = (state.apps || []).filter(x => x.id !== id); renderTools(); save(); toast('App removed', 'warn'); break;
    case 'gh-add': ghAdd(act.dataset.kind, act.dataset.repo, act.dataset.url, act.dataset.desc); break;
    case 'save-key': saveKeyFromCard(act.dataset.provider); break;
    case 'del-key': state.keys = state.keys.filter(k => k.id !== id); renderAll(); toast('Key removed', 'warn'); break;
    case 'save-custom-key': {
      const name = $('#ckName').value.trim(); const key = $('#ckKey').value.trim();
      if (!name || !key) { toast('Name and key required', 'err'); break; }
      state.keys.push({ id: uid(), provider: 'custom_' + uid(), name, key, at: Date.now() });
      closeModal(); renderAll(); toast('Custom key saved', 'ok'); break;
    }
    case 'toggle-pipe': { const p = state.pipelines.find(x => x.id === id); if (p) { p.enabled = p.enabled === false; renderPipelines(); save(); } break; }
    case 'edit-pipe': openPipelineEditor(id); break;
    case 'del-pipe': if (confirm('Delete this blueprint?')) { state.pipelines = state.pipelines.filter(p => p.id !== id); renderAll(); toast('Blueprint deleted', 'warn'); } break;
    case 'save-pipe': savePipeline(id); break;
    case 'add-stage': {
      const list = $('#stageList');
      const i = list.children.length;
      const agentOpts = `<option value="">—</option>` + state.agents.map(a => `<option>${esc(a.name)}</option>`).join('');
      const toolOpts = `<option value="">—</option>` + TOOL_LIBRARY.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
      const div = document.createElement('div');
      div.className = 'stage-row'; div.dataset.stage = i;
      div.innerHTML = `<span class="stage-idx">${i + 1}</span>
        <input type="text" class="st-name" placeholder="Stage name">
        <select class="st-agent">${agentOpts}</select>
        <select class="st-tool">${toolOpts}</select>
        <input type="text" class="st-out" placeholder="output path">
        <button class="btn sm ghost" data-action="del-stage" data-idx="${i}">✕</button>`;
      list.appendChild(div); break;
    }
    case 'del-stage': act.closest('.stage-row').remove(); break;
    case 'run-pipe': runPipeline(id); break;
    case 'close-modal': closeModal(); break;
    case 'import-file': {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('#importJson').value = r.result; previewImport(r.result); }; r.readAsText(f); };
      inp.click(); break;
    }
    case 'import-sample-teamily': {
      const s = JSON.stringify({ platform: 'teamily.ai', version: '1.0', agents: [
        { name: 'Iris', avatar: '🎨', description: 'Brand Designer', persona: 'You are Iris, a brand designer. Create cohesive visual systems and UI mockups.', model: 'claude-3.5-sonnet', tools: ['image_gen', 'vision'], skills: ['design'] },
        { name: 'Echo', avatar: '📣', description: 'Growth Marketer', persona: 'You are Echo, a growth marketer. Craft campaigns, copy and experiments.', model: 'gpt-4o', tools: ['web_search', 'scrape_webpage'], skills: ['writing', 'research'] }
      ] }, null, 2);
      $('#importJson').value = s; previewImport(s); break;
    }
    case 'import-sample-gamut': {
      const s = JSON.stringify({ platform: 'gamut.io', schema: 'gamut.agent.v1', agents: [
        { displayName: 'Vector', icon: '📊', role: 'Data Scientist', instructions: 'You are Vector, a data scientist. Clean data, run analysis and build models.', llm: 'gpt-4o', capabilities: ['code_exec', 'sql_query'], skills: ['data_analysis'] },
        { displayName: 'Ops', icon: '🚀', role: 'DevOps Engineer', instructions: 'You are Ops, a DevOps engineer. Own CI/CD and deployment.', llm: 'claude-3.5-sonnet', capabilities: ['shell', 'code_exec'], skills: ['devops', 'security'] }
      ] }, null, 2);
      $('#importJson').value = s; previewImport(s); break;
    }
    case 'do-import': doImport(); break;
    case 'copy-export': { navigator.clipboard.writeText($('#exportJson').value); toast('Copied to clipboard', 'ok'); break; }
    case 'download-export': {
      const fmt = window.__exportFmt ? window.__exportFmt() : 'teamily';
      const name = { teamily: 'teamily', gamut: 'gamut', generic: 'harness' }[fmt] || fmt;
      downloadText(`agents-${name}-${Date.now()}.json`, $('#exportJson').value);
      toast('Exported ' + fmt, 'ok'); break;
    }
  }
});

/* ---------------- direct button wiring ---------------- */
function wire() {
  $('#addAgentBtn').onclick = () => openAgentEditor(null);
  $('#importBtn').onclick = openImport;
  $('#exportBtn').onclick = openExport;
  $('#newFileBtn').onclick = openNewFile;
  $('#addMcpBtn').onclick = () => openMcpEditor(null);
  $('#ghMcpBtn').onclick = () => openGithubSearch('mcp');
  $('#ghSkillBtn').onclick = () => openGithubSearch('skill');
  $('#ghAppBtn').onclick = () => openGithubSearch('app');
  $('#addApiBtn').onclick = () => openApiEditor(null);
  $('#addKeyBtn').onclick = openKeyEditor;

  const bSave = $('#saveBackendBtn');
  if (bSave) bSave.onclick = () => {
    const v = ($('#backendUrlInput').value || '').trim().replace(/\/+$/, '');
    if (v && !/^https?:\/\//i.test(v)) { toast('Backend URL must start with http:// or https://', 'warn'); return; }
    state.settings = state.settings || {};
    state.settings.backendUrl = v;
    save();
    toast(v ? 'Backend URL saved' : 'Backend cleared — using direct mode', 'ok');
    refreshThrottleStatus();
  };
  const bTest = $('#testBackendBtn');
  if (bTest) bTest.onclick = async () => {
    bTest.disabled = true;
    const ok = await refreshThrottleStatus();
    bTest.disabled = false;
    toast(ok ? 'Backend reachable ✓' : 'No backend reachable — direct mode is active', ok ? 'ok' : 'warn');
  };
  $('#addPipelineBtn').onclick = () => openPipelineEditor(null);
  $('#seedPipelinesBtn').onclick = seedPipelines;
  $('#uploadBtn').onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true;
    inp.onchange = () => uploadFiles(inp.files); inp.click();
  };
  $('#downloadAllBtn').onclick = downloadAll;
  $('#dlFileBtn').onclick = () => downloadFile(state.workspace.selected);
  $('#hamburger').onclick = openSidebar;
  $('#sidebarScrim')?.addEventListener('click', closeSidebar);
  $('#modalClose').onclick = closeModal;
  $('#modalBackdrop').addEventListener('click', (e) => { if (e.target.id === 'modalBackdrop') closeModal(); });

  $('#saveOrch').onclick = () => {
    state.orchestrator.name = $('#orchName').value.trim() || 'Orchestrator';
    state.orchestrator.model = $('#orchModel').value;
    state.orchestrator.provider = $('#orchProvider').value;
    state.orchestrator.temperature = parseFloat($('#orchTemp').value);
    state.orchestrator.maxDepth = parseInt($('#orchDepth').value) || 4;
    state.orchestrator.maxAgents = parseInt($('#orchMaxAgents').value) || 0;
    state.orchestrator.reviewer = $('#orchReviewer').checked;
    state.orchestrator.prompt = $('#orchPrompt').value;
    state.modes[state.mode] = { ...state.orchestrator };
    const lbl = { single: 'Single', swarm: 'Swarm', mix: 'Mix of Agents' }[state.mode];
    save(); renderAll(); toast('Saved ' + lbl + ' mode settings', 'ok');
  };
  $('#resetOrch').onclick = () => {
    state.orchestrator.prompt = DEFAULT_ORCH_PROMPT;
    state.modes[state.mode].prompt = DEFAULT_ORCH_PROMPT;
    save(); renderOrchestrator(); toast('Prompt reset to default', 'warn');
  };
  $('#orchTemp').oninput = () => { $('#orchTempVal').textContent = $('#orchTemp').value; };
  $('#orchProvider').onchange = () => {
    state.orchestrator.provider = $('#orchProvider').value;
    save(); updateThrottleHint();
  };

  $('#saveFileBtn').onclick = () => {
    const f = state.workspace.files.find(x => x.path === state.workspace.selected);
    if (!f) return;
    f.content = $('#edFileContent').value; f.by = 'you'; f.at = Date.now();
    save(); renderWorkspace(); toast('File saved', 'ok');
  };
  $('#delFileBtn').onclick = () => {
    if (!confirm('Delete ' + state.workspace.selected + '?')) return;
    state.workspace.files = state.workspace.files.filter(x => x.path !== state.workspace.selected);
    state.workspace.selected = state.workspace.files[0]?.path || null;
    save(); renderAll(); toast('File deleted', 'warn');
  };

  $('#runBtn').onclick = () => runTask();
  $('#sendTaskBtn').onclick = () => runTask();
  $('#taskInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') runTask(); });
  $('#clearLogBtn').onclick = () => { state.logs = []; renderConsole(); save(); };
}

/* ---------------- pipeline execution ---------------- */
async function runPipeline(id) {
  const pipe = state.pipelines.find(p => p.id === id);
  if (!pipe) return;
  if (running) { toast('A run is already in progress', 'warn'); return; }
  if (!state.agents.length) { toast('Add agents first', 'err'); return; }

  const plan = pipe.stages.map(s => {
    const agent = state.agents.find(a => a.name === s.agent)
      || state.agents.find(a => (a.skills || []).some(k => k.toLowerCase().includes((s.name || '').split(' ')[0].toLowerCase())))
      || pickLead(s.name + ' ' + (s.out || ''));
    return { agent, subtask: `${s.name}${s.out ? ' → produce ' + s.out : ''}` };
  }).filter(p => p.agent);

  if (!plan.length) { toast('No agents matched the stages', 'err'); return; }

  running = true;
  llmCallsThisRun = 0;
  $('#runBtn').disabled = true; $('#sendTaskBtn').disabled = true;
  setView('console');

  log('sys', 'PIPE', `Pipeline "${pipe.name}" started · ${plan.length} stages · ${pipe.kind}`);
  const outputs = [];
  for (const p of plan) {
    log('orch', 'STAGE', `${p.agent.name} ⟵ ${p.subtask}`);
    outputs.push(await runAgentLive(p, `${pipe.name}: ${pipe.desc}`, outputs));
  }

  log('orch', 'ORCH', 'Consolidating pipeline output…');
  const final = await synthesize(`${pipe.name} — ${pipe.desc}`, outputs);
  const finalFile = `pipelines/${pipe.id}-${pipe.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
  const body = `# ${pipe.name}\n\n**Kind:** ${pipe.kind}\n**Stages:** ${plan.length}\n**Agents:** ${outputs.map(o => o.agent.name).join(', ')}\n\n---\n\n${final}\n`;
  const existing = state.workspace.files.find(f => f.path === finalFile);
  if (existing) { existing.content = body; existing.by = state.orchestrator.name; existing.at = Date.now(); }
  else state.workspace.files.push({ path: finalFile, content: body, by: state.orchestrator.name, at: Date.now() });

  log('done', 'DONE', `Pipeline "${pipe.name}" complete · ${outputs.length} stages · ${llmCallsThisRun} LLM call(s).`);
  running = false;
  $('#runBtn').disabled = false; $('#sendTaskBtn').disabled = false;
  renderAll();
  toast('Pipeline complete — see ' + finalFile, 'ok');
}

/* ---------------- mobile sidebar ---------------- */
function openSidebar() {
  $('.sidebar').classList.add('open');
  $('#sidebarScrim')?.classList.add('show');
}
function closeSidebar() {
  $('.sidebar').classList.remove('open');
  $('#sidebarScrim')?.classList.remove('show');
}

/* ---------------- boot ---------------- */
function renderRuntime(online, detail) {
  const pill = $('#runtimePill');
  const hint = $('#runtimeHint');
  const input = $('#backendUrlInput');
  const base = backendBase();
  if (input && document.activeElement !== input) input.value = base;
  if (pill) {
    pill.className = 'pill ' + (online ? 'green' : 'amber');
    pill.innerHTML = `<span class="dot"></span>${online ? 'backend live' : 'direct mode'}`;
    pill.title = online ? (detail || 'Proxy reachable') : 'No proxy — the browser calls providers directly';
  }
  if (hint) {
    hint.innerHTML = online
      ? `<span class="hi">✅</span><div><b>Proxy online</b> at <code>${esc(base || location.origin)}</code>. Keys are forwarded server-side and the keyless 1/30s throttle is enforced globally. ${detail ? '· ' + esc(detail) : ''}</div>`
      : `<span class="hi">⚡</span><div><b>Direct mode.</b> No backend detected, so keyed providers are called straight from your browser (CORS). Keyless Pollinations is throttled client-side at 1 request / 30s. Set a Backend URL above if you want server-side keys and a shared throttle.</div>`;
  }
}

async function refreshThrottleStatus() {
  const pill = $('#backendPill');
  const base = backendBase();
  try {
    const r = await fetch(base + '/api/llm/status', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const s = await r.json();
    const el = $('#throttleLive');
    if (el && !running) el.textContent = s.waitSeconds > 0 ? `Server next slot in ${Math.ceil(s.waitSeconds)}s.` : 'Server ready.';
    if (pill) {
      pill.className = 'pill green';
      pill.innerHTML = `<span class="dot"></span>backend live`;
      pill.title = `LLM proxy online · keyless throttle ${s.interval}s · queue ${s.queueDepth}`;
    }
    proxyOnline = true;
    renderRuntime(true, `keyless throttle ${s.interval}s · queue ${s.queueDepth}`);
    return true;
  } catch (e) {
    proxyOnline = false;
    // static hosting: no proxy. Direct-to-provider fallback still works.
    if (pill) {
      pill.className = 'pill amber';
      pill.innerHTML = `<span class="dot"></span>direct mode`;
      pill.title = 'No LLM proxy detected. Keyed providers are called directly from the browser; keyless Pollinations is throttled client-side.';
    }
    renderRuntime(false);
    return false;
  }
}

function boot() {
  wire();
  // sync mode buttons
  $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
  const label = { single: 'Single', swarm: 'Swarm', mix: 'Mix of Agents' }[state.mode];
  $('#modeFoot').innerHTML = 'Mode: <b>' + label + '</b>';
  renderAll();
  refreshThrottleStatus();
  setInterval(refreshThrottleStatus, 4000);
  // seed console greeting
  if (!state.logs.length) {
    log('sys', 'SYS', 'Agent Harness ready.');
    log('orch', 'ORCH', `Loaded ${state.agents.length} agents · ${state.mcpServers.length} MCP servers · ${state.apis.length} APIs · mode=${state.mode.toUpperCase()}`);
    log('sys', 'TIP', 'Switch modes in the top-right, then hit "Run Task" to watch orchestration.');
  }
}

document.addEventListener('DOMContentLoaded', boot);
