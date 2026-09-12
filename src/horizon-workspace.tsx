import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrainCircuit, CheckCircle2, FolderKanban, ListChecks, Users, StickyNote, X, Search } from 'lucide-react';
import './horizon-workspace.css';

type RecordItem = Record<string, unknown>;
type Workspace = { clients: RecordItem[]; projects: RecordItem[]; tasks: RecordItem[]; memories: RecordItem[]; notes: RecordItem[] };

const KEY = 'horizon-ai-workspace';
const empty = (): Workspace => ({ clients: [], projects: [], tasks: [], memories: [], notes: [] });

function read(): Workspace {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') ?? empty(); } catch { return empty(); }
}

function display(item: RecordItem, keys: string[]) {
  for (const key of keys) if (item[key]) return String(item[key]);
  return 'Untitled';
}

function Section({ title, icon, items, emptyText }: { title: string; icon: React.ReactNode; items: RecordItem[]; emptyText: string }) {
  return <section className="hws-section"><div className="hws-section-head"><span>{icon}</span><div><b>{title}</b><small>{items.length}</small></div></div>{items.length === 0 ? <div className="hws-empty-line">{emptyText}</div> : <div className="hws-list">{items.slice(0, 5).map((item, i) => <div className="hws-item" key={String(item.id || i)}><strong>{display(item, ['name', 'title', 'content'])}</strong><span>{display(item, ['industry', 'project', 'client', 'type', 'scope', 'status', 'due', 'deadline', 'budget', 'notes'])}</span></div>)}</div>}</section>;
}

function App() {
  const [open, setOpen] = React.useState(false);
  const [workspace, setWorkspace] = React.useState(read);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    const sync = () => setWorkspace(read());
    window.addEventListener('horizon-ai-updated', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('horizon-ai-updated', sync); window.removeEventListener('storage', sync); };
  }, []);

  const all = [
    ...workspace.clients.map((x) => ({ ...x, kind: 'client' })),
    ...workspace.projects.map((x) => ({ ...x, kind: 'project' })),
    ...workspace.tasks.map((x) => ({ ...x, kind: 'task' })),
    ...workspace.memories.map((x) => ({ ...x, kind: 'memory' })),
    ...workspace.notes.map((x) => ({ ...x, kind: 'note' })),
  ];
  const filtered = all.filter((x) => JSON.stringify(x).toLowerCase().includes(query.toLowerCase())).slice(0, 12);

  return <>
    <button className="hws-launcher" onClick={() => setOpen(true)} aria-label="Open Horizon workspace"><BrainCircuit size={16} /><span>Brain</span><i /></button>
    {open && <div className="hws-backdrop" onClick={() => setOpen(false)}><aside className="hws-drawer" onClick={(e) => e.stopPropagation()}>
      <header className="hws-top"><div><p>HORIZON WORKS</p><h2>Workspace Brain</h2></div><button onClick={() => setOpen(false)}><X size={17} /></button></header>
      <div className="hws-summary"><div><strong>{workspace.clients.length}</strong><span>Clients</span></div><div><strong>{workspace.projects.length}</strong><span>Projects</span></div><div><strong>{workspace.tasks.length}</strong><span>Tasks</span></div><div><strong>{workspace.memories.length}</strong><span>Memories</span></div></div>
      <div className="hws-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Horizon brain" /></div>
      {query ? <section className="hws-section"><div className="hws-section-head"><span><Search size={15} /></span><div><b>Results</b><small>{filtered.length}</small></div></div>{filtered.length ? <div className="hws-list">{filtered.map((item, i) => <div className="hws-item" key={`${item.kind}-${String(item.id || i)}`}><strong>{display(item, ['name', 'title', 'content'])}</strong><span>{item.kind} · {display(item, ['project', 'client', 'scope', 'type', 'status'])}</span></div>)}</div> : <div className="hws-empty-line">Nothing matches yet.</div>}</section> : <><Section title="Clients" icon={<Users size={15} />} items={workspace.clients} emptyText="Tell Horizon about a client." /><Section title="Projects" icon={<FolderKanban size={15} />} items={workspace.projects} emptyText="Projects will appear here." /><Section title="Tasks" icon={<ListChecks size={15} />} items={workspace.tasks} emptyText="Tasks will appear here." /><Section title="Memory" icon={<BrainCircuit size={15} />} items={workspace.memories} emptyText="Durable memories will appear here." /><Section title="Notes" icon={<StickyNote size={15} />} items={workspace.notes} emptyText="Notes will appear here." /></>}
      <div className="hws-footer"><CheckCircle2 size={14} /> Everything shown here is workspace state created or updated through Horizon AI.</div>
    </aside></div>}
  </>;
}

createRoot(document.body.appendChild(document.createElement('div'))).render(<App />);
