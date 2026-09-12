import React from 'react';
import { BrainCircuit, Check, ChevronRight, Loader2, Sparkles, X, Plus, UserRound, FolderKanban, ListChecks, Brain, StickyNote, RotateCcw } from 'lucide-react';
import './horizon-ai-live.css';

type Prospect = Record<string, unknown>;
type Action = { operation?: 'create' | 'update'; type: string; title?: string; match?: Record<string, unknown>; data?: Record<string, unknown> };
type Memory = { operation?: 'create' | 'update'; content: string; type: string; scope?: string; confidence?: number };
type Organization = { actions: Action[]; memories: Memory[]; followUps: string[] };
type Workspace = { clients: Record<string, unknown>[]; projects: Record<string, unknown>[]; tasks: Record<string, unknown>[]; memories: Record<string, unknown>[]; notes: Record<string, unknown>[] };

const PROSPECTS_KEY = 'hw-outreach-prospects';
const WORKSPACE_KEY = 'horizon-ai-workspace';

const emptyWorkspace = (): Workspace => ({ clients: [], projects: [], tasks: [], memories: [], notes: [] });

function safeRead<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

function context() {
  const prospects = safeRead<Prospect[]>(PROSPECTS_KEY, []);
  const workspace = safeRead<Workspace>(WORKSPACE_KEY, emptyWorkspace());
  return { workspaceName: 'Horizon Works', prospects: prospects.slice(0, 50), workspace };
}

function iconFor(type: string) {
  if (type === 'client') return <UserRound size={14} />;
  if (type === 'project') return <FolderKanban size={14} />;
  if (type === 'task') return <ListChecks size={14} />;
  if (type === 'note') return <StickyNote size={14} />;
  return <BrainCircuit size={14} />;
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function recordMatches(record: Record<string, unknown>, match: Record<string, unknown> | undefined, action: Action) {
  if (match && Object.keys(match).length) {
    return Object.entries(match).every(([key, value]) => normalize(record[key]) === normalize(value));
  }
  const candidate = (action.data?.name ?? action.data?.title ?? action.title) as unknown;
  if (!candidate) return false;
  return normalize(record.name ?? record.title) === normalize(candidate);
}

function applyOrganization(organization: Organization) {
  const workspace = safeRead<Workspace>(WORKSPACE_KEY, emptyWorkspace());
  const now = new Date().toISOString();

  for (const action of organization.actions || []) {
    const bucket = action.type === 'client' ? 'clients' : action.type === 'project' ? 'projects' : action.type === 'task' ? 'tasks' : 'notes';
    workspace[bucket] ||= [];
    const list = workspace[bucket];
    const index = action.operation === 'update' ? list.findIndex((record) => recordMatches(record, action.match, action)) : -1;
    const patch = { ...(action.data || {}), title: action.title || action.data?.title || action.data?.name || action.type, source: 'Horizon AI', updatedAt: now };
    if (index >= 0) {
      list[index] = { ...list[index], ...patch };
    } else {
      list.unshift({ id: crypto.randomUUID(), ...patch, createdAt: now });
    }
  }

  for (const memory of organization.memories || []) {
    workspace.memories ||= [];
    const index = memory.operation === 'update' ? workspace.memories.findIndex((record) => normalize(record.content) === normalize(memory.content)) : -1;
    const patch = { content: memory.content, type: memory.type, scope: memory.scope || 'company', confidence: memory.confidence ?? 0.9, source: 'Horizon AI', updatedAt: now };
    if (index >= 0) workspace.memories[index] = { ...workspace.memories[index], ...patch };
    else workspace.memories.unshift({ id: crypto.randomUUID(), ...patch, createdAt: now });
  }

  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  window.dispatchEvent(new CustomEvent('horizon-ai-updated'));
}

function getCounts() {
  const workspace = safeRead<Workspace>(WORKSPACE_KEY, emptyWorkspace());
  return {
    clients: workspace.clients.length,
    projects: workspace.projects.length,
    tasks: workspace.tasks.length,
    memories: workspace.memories.length,
    notes: workspace.notes.length,
  };
}

function App() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [response, setResponse] = React.useState('');
  const [organization, setOrganization] = React.useState<Organization | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [applied, setApplied] = React.useState(false);
  const [counts, setCounts] = React.useState(getCounts);
  const [history, setHistory] = React.useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  React.useEffect(() => {
    const sync = () => setCounts(getCounts());
    window.addEventListener('horizon-ai-updated', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('horizon-ai-updated', sync); window.removeEventListener('storage', sync); };
  }, []);

  async function ask(message = input) {
    const text = message.trim();
    if (!text || loading) return;
    setLoading(true); setError(''); setApplied(false); setOrganization(null); setResponse('');
    setHistory((h) => [...h, { role: 'user', text }]); setInput('');
    try {
      const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, context: context() }) });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || 'Gemini request failed.');
      const org = data.organization as Organization;
      setResponse(data.text || 'Done.');
      setOrganization(org);
      setHistory((h) => [...h, { role: 'assistant', text: data.text || 'Done.' }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Horizon AI is unavailable.');
    } finally { setLoading(false); }
  }

  return <>
    {!open && <button className="hai-launcher" onClick={() => setOpen(true)} aria-label="Open Horizon AI"><span className="hai-launcher-orbit" /><BrainCircuit size={18} /><span>Horizon AI</span></button>}
    {open && <div className="hai-backdrop" onClick={() => setOpen(false)}>
      <aside className="hai-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="hai-top">
          <div className="hai-brand"><div className="hai-mark"><Sparkles size={14} /></div><div><strong>Horizon AI</strong><span>Horizon Works intelligence</span></div></div>
          <button className="hai-icon-btn" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="hai-status"><i /> Gemini connected · organizing workspace</div>
        <div className="hai-content">
          {history.length === 0 && !loading && <div className="hai-welcome"><div className="hai-welcome-icon"><Brain size={26} /></div><p className="hai-kicker">AI OPERATING LAYER</p><h2>Tell me what happened.</h2><p>Drop in a client call, an idea, a task, a decision, a deadline, or a messy thought. Horizon will interpret it and prepare the correct workspace changes.</p><div className="hai-suggestions"><button onClick={() => ask('I talked to Rahul today. He wants a restaurant website for 60k, needs the proposal tomorrow, and may want WhatsApp automation later.')}>Rahul wants a website for 60k...</button><button onClick={() => ask('Prachar bulk messaging still needs work. Add a task for per-client daily limits and another for delivery tracking.')}>Prachar still needs two tasks...</button></div></div>}
          {history.map((item, i) => item.role === 'user' ? <div className="hai-user" key={i}>{item.text}</div> : <div className="hai-assistant" key={i}><div className="hai-assistant-label"><span /><b>HORIZON</b></div><p>{item.text}</p></div>)}
          {loading && <div className="hai-assistant"><div className="hai-assistant-label"><span /><b>HORIZON</b></div><div className="hai-thinking"><Loader2 size={14} className="spin" /> Organizing with Gemini…</div></div>}
          {error && <div className="hai-error">{error}</div>}
          {organization && <div className="hai-organization">
            {organization.actions.length > 0 && <section><div className="hai-section-label">WORKSPACE PLAN</div>{organization.actions.map((a, i) => <div className="hai-action" key={i}><div className="hai-action-icon">{iconFor(a.type)}</div><div><b>{a.title || a.data?.name || a.data?.title || a.type}</b><span>{(a.operation || 'create').toUpperCase()} · {a.type}</span></div><ChevronRight size={14} /></div>)}</section>}
            {organization.memories.length > 0 && <section><div className="hai-section-label">MEMORY CANDIDATES</div>{organization.memories.map((m, i) => <div className="hai-memory" key={i}><BrainCircuit size={14} /><div><b>{m.content}</b><span>{m.scope || 'company'} · {m.type} · {Math.round((m.confidence ?? 0.9) * 100)}% confidence</span></div></div>)}</section>}
            {organization.followUps.length > 0 && <section><div className="hai-section-label">NEEDS CLARIFICATION</div>{organization.followUps.map((f, i) => <div className="hai-followup" key={i}>{f}</div>)}</section>}
            {(organization.actions.length > 0 || organization.memories.length > 0) && <div className="hai-apply-row"><button className={`hai-apply ${applied ? 'done' : ''}`} onClick={() => { if (!applied) { applyOrganization(organization); setApplied(true); setCounts(getCounts()); } }}>{applied ? <><Check size={14} /> Saved to workspace</> : <><Plus size={14} /> Apply organization</>}</button>{applied && <button className="hai-refresh" onClick={() => { setOrganization(null); setResponse(''); }}><RotateCcw size={14} /> Continue</button>}</div>}
          </div>}
          <div className="hai-counts"><span>{counts.clients} clients</span><span>{counts.projects} projects</span><span>{counts.tasks} tasks</span><span>{counts.memories} memories</span></div>
        </div>
        <form className="hai-composer" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} placeholder="Tell Horizon anything…" />
          <div className="hai-composer-foot"><span>Natural language workspace</span><button disabled={loading || !input.trim()}>{loading ? <Loader2 size={14} className="spin" /> : <ChevronRight size={14} />} Organize</button></div>
        </form>
      </aside>
    </div>}
  </>;
}

createRoot(document.body.appendChild(document.createElement('div'))).render(<App />);
