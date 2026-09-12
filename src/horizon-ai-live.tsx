import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrainCircuit, Check, ChevronRight, Loader2, Sparkles, X, Plus, UserRound, FolderKanban, ListChecks, Brain } from 'lucide-react';
import './horizon-ai-live.css';

type Prospect = Record<string, unknown>;
type Action = { type: string; title?: string; data?: Record<string, unknown> };
type Memory = { content: string; type: string; confidence?: number };
type Organization = { actions: Action[]; memories: Memory[]; followUps: string[] };

const PROSPECTS_KEY = 'hw-outreach-prospects';
const WORKSPACE_KEY = 'horizon-ai-workspace';

function safeRead(key: string, fallback: unknown) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

function context() {
  const prospects = safeRead(PROSPECTS_KEY, []) as Prospect[];
  const workspace = safeRead(WORKSPACE_KEY, { clients: [], projects: [], tasks: [], memories: [], notes: [] }) as Record<string, unknown[]>;
  return { prospects: prospects.slice(0, 40), workspace };
}

function iconFor(type: string) {
  if (type.includes('client')) return <UserRound size={14} />;
  if (type.includes('project')) return <FolderKanban size={14} />;
  if (type.includes('task')) return <ListChecks size={14} />;
  return <BrainCircuit size={14} />;
}

function applyOrganization(organization: Organization) {
  const workspace = safeRead(WORKSPACE_KEY, { clients: [], projects: [], tasks: [], memories: [], notes: [] }) as Record<string, unknown[]>;
  const now = new Date().toISOString();
  const target = (type: string) => type.includes('client') ? 'clients' : type.includes('project') ? 'projects' : type.includes('task') ? 'tasks' : type.includes('memory') ? 'memories' : 'notes';

  for (const action of organization.actions || []) {
    const bucket = target(action.type);
    workspace[bucket] ||= [];
    workspace[bucket].unshift({ id: crypto.randomUUID(), ...action.data, title: action.title || action.type, source: 'Horizon AI', createdAt: now });
  }
  for (const memory of organization.memories || []) {
    workspace.memories ||= [];
    workspace.memories.unshift({ id: crypto.randomUUID(), ...memory, source: 'Horizon AI', createdAt: now });
  }
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  window.dispatchEvent(new CustomEvent('horizon-ai-updated'));
}

function App() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [response, setResponse] = React.useState('');
  const [organization, setOrganization] = React.useState<Organization | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [applied, setApplied] = React.useState(false);
  const [history, setHistory] = React.useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  async function ask(message = input) {
    const text = message.trim();
    if (!text || loading) return;
    setLoading(true); setError(''); setApplied(false); setOrganization(null);
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
        <div className="hai-status"><i /> Gemini connected · server-side key</div>
        <div className="hai-content">
          {history.length === 0 && !loading && <div className="hai-welcome"><div className="hai-welcome-icon"><Brain size={26} /></div><p className="hai-kicker">AI OPERATING LAYER</p><h2>Tell me what happened.</h2><p>Drop in a client call, an idea, a task, a decision, or a messy thought. Horizon will organize it into the panel's workspace.</p><div className="hai-suggestions"><button onClick={() => ask('I talked to Rahul today. He wants a restaurant website for 60k, needs the proposal tomorrow, and may want WhatsApp automation later.')}>Rahul wants a website for 60k...</button><button onClick={() => ask('Prachar bulk messaging still needs work. Add a task for per-client daily limits and another for delivery tracking.')}>Prachar still needs two tasks...</button></div></div>}
          {history.map((item, i) => item.role === 'user' ? <div className="hai-user" key={i}>{item.text}</div> : <div className="hai-assistant" key={i}><div className="hai-assistant-label"><span /><b>HORIZON</b></div><p>{item.text}</p></div>)}
          {loading && <div className="hai-assistant"><div className="hai-assistant-label"><span /><b>HORIZON</b></div><div className="hai-thinking"><Loader2 size={14} className="spin" /> Organizing with Gemini…</div></div>}
          {error && <div className="hai-error">{error}</div>}
          {organization && <div className="hai-organization">
            {organization.actions.length > 0 && <section><div className="hai-section-label">WORKSPACE UPDATES</div>{organization.actions.map((a, i) => <div className="hai-action" key={i}><div className="hai-action-icon">{iconFor(a.type)}</div><div><b>{a.title || a.type.replaceAll('_', ' ')}</b><span>{a.type.replaceAll('_', ' ')}</span></div><ChevronRight size={14} /></div>)}</section>}
            {organization.memories.length > 0 && <section><div className="hai-section-label">LONG-TERM MEMORY</div>{organization.memories.map((m, i) => <div className="hai-memory" key={i}><BrainCircuit size={14} /><div><b>{m.content}</b><span>{m.type} · {Math.round((m.confidence ?? 0.9) * 100)}% confidence</span></div></div>)}</section>}
            {organization.followUps.length > 0 && <section><div className="hai-section-label">CLARIFY</div>{organization.followUps.map((f, i) => <div className="hai-followup" key={i}>{f}</div>)}</section>}
            {(organization.actions.length > 0 || organization.memories.length > 0) && <div className="hai-apply-row"><button className={`hai-apply ${applied ? 'done' : ''}`} onClick={() => { if (!applied) { applyOrganization(organization); setApplied(true); } }}>{applied ? <><Check size={14} /> Saved to workspace</> : <><Plus size={14} /> Apply organization</>}</button>{applied && <button className="hai-refresh" onClick={() => window.location.reload()}>Refresh panel</button>}</div>}
          </div>}
        </div>
        <form className="hai-composer" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} placeholder="Tell Horizon anything…" />
          <div className="hai-composer-foot"><span>Ctrl / Cmd + Enter</span><button disabled={loading || !input.trim()}>{loading ? <Loader2 size={14} className="spin" /> : <ChevronRight size={14} />} Organize</button></div>
        </form>
      </aside>
    </div>}
  </>;
}

createRoot(document.body.appendChild(document.createElement('div'))).render(<App />);
