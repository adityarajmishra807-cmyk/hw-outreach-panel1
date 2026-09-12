import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrainCircuit, CheckCircle2, FolderKanban, ListChecks, Users, StickyNote, X, Search, Clock3, Plus, Trash2, Power } from 'lucide-react';
import './horizon-workspace.css';
import { createAutomation, listAutomations, removeAutomation, toggleAutomation, type AutomationFrequency, type HorizonAutomation } from './horizon-automations';

type RecordItem = Record<string, unknown>;
type Workspace = { clients: RecordItem[]; projects: RecordItem[]; tasks: RecordItem[]; memories: RecordItem[]; notes: RecordItem[] };
const KEY = 'horizon-ai-workspace';
const empty = (): Workspace => ({ clients: [], projects: [], tasks: [], memories: [], notes: [] });
function read(): Workspace { try { return JSON.parse(localStorage.getItem(KEY) || 'null') ?? empty(); } catch { return empty(); } }
function display(item: RecordItem, keys: string[]) { for (const key of keys) if (item[key]) return String(item[key]); return 'Untitled'; }
function Section({ title, icon, items, emptyText }: { title: string; icon: React.ReactNode; items: RecordItem[]; emptyText: string }) { return <section className="hws-section"><div className="hws-section-head"><span>{icon}</span><div><b>{title}</b><small>{items.length}</small></div></div>{items.length === 0 ? <div className="hws-empty-line">{emptyText}</div> : <div className="hws-list">{items.slice(0, 5).map((item, i) => <div className="hws-item" key={String(item.id || i)}><strong>{display(item, ['name', 'title', 'content'])}</strong><span>{display(item, ['industry', 'project', 'client', 'type', 'scope', 'status', 'due', 'deadline', 'budget', 'notes'])}</span></div>)}</div>}</section>; }

function AutomationPanel({ items, onChange }: { items: HorizonAutomation[]; onChange: () => void }) {
  const [name, setName] = React.useState('');
  const [instruction, setInstruction] = React.useState('');
  const [frequency, setFrequency] = React.useState<AutomationFrequency>('daily');
  const add = () => { if (!instruction.trim()) return; createAutomation({ name, instruction, frequency }); setName(''); setInstruction(''); onChange(); };
  return <section className="hws-section">
    <div className="hws-section-head"><span><Clock3 size={15} /></span><div><b>Automations</b><small>{items.filter(x => x.enabled).length} active</small></div></div>
    <div className="hws-auto-form"><input value={name} onChange={e => setName(e.target.value)} placeholder="Automation name" /><textarea value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="What should Horizon do? e.g. Review open tasks and surface anything overdue." rows={2} /><div className="hws-auto-controls"><select value={frequency} onChange={e => setFrequency(e.target.value as AutomationFrequency)}><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select><button onClick={add}><Plus size={14} /> Add automation</button></div></div>
    {items.length > 0 && <div className="hws-list">{items.slice(0, 8).map(item => <div className="hws-item" key={item.id}><strong>{item.name}</strong><span>{item.frequency} · next {new Date(item.nextRunAt).toLocaleString()}</span><div className="hws-auto-actions"><button onClick={() => { toggleAutomation(item.id); onChange(); }}><Power size={13} /> {item.enabled ? 'On' : 'Off'}</button><button onClick={() => { removeAutomation(item.id); onChange(); }}><Trash2 size={13} /></button></div></div>)}</div>}
    <div className="hws-empty-line">Automations are stored locally and only run when the Horizon workspace is open.</div>
  </section>;
}

function App() {
  const [open, setOpen] = React.useState(false);
  const [workspace, setWorkspace] = React.useState(read);
  const [query, setQuery] = React.useState('');
  const [automations, setAutomations] = React.useState<HorizonAutomation[]>(listAutomations);
  const sync = React.useCallback(() => { setWorkspace(read()); setAutomations(listAutomations()); }, []);
  React.useEffect(() => { window.addEventListener('horizon-ai-updated', sync); window.addEventListener('storage', sync); window.addEventListener('horizon-ai-automations-updated', sync); return () => { window.removeEventListener('horizon-ai-updated', sync); window.removeEventListener('storage', sync); window.removeEventListener('horizon-ai-automations-updated', sync); }; }, [sync]);
  const all = [...workspace.clients.map(x => ({ ...x, kind: 'client' })), ...workspace.projects.map(x => ({ ...x, kind: 'project' })), ...workspace.tasks.map(x => ({ ...x, kind: 'task' })), ...workspace.memories.map(x => ({ ...x, kind: 'memory' })), ...workspace.notes.map(x => ({ ...x, kind: 'note' }))];
  const filtered = all.filter(x => JSON.stringify(x).toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  return <><button className="hws-launcher" onClick={() => setOpen(true)} aria-label="Open Horizon workspace"><BrainCircuit size={16} /><span>Brain</span><i /></button>{open && <div className="hws-backdrop" onClick={() => setOpen(false)}><aside className="hws-drawer" onClick={e => e.stopPropagation()}><header className="hws-top"><div><p>HORIZON WORKS</p><h2>Workspace Brain</h2></div><button onClick={() => setOpen(false)}><X size={17} /></button></header><div className="hws-summary"><div><strong>{workspace.clients.length}</strong><span>Clients</span></div><div><strong>{workspace.projects.length}</strong><span>Projects</span></div><div><strong>{workspace.tasks.length}</strong><span>Tasks</span></div><div><strong>{workspace.memories.length}</strong><span>Memories</span></div></div><div className="hws-search"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Horizon brain" /></div>{query ? <section className="hws-section"><div className="hws-section-head"><span><Search size={15} /></span><div><b>Results</b><small>{filtered.length}</small></div></div>{filtered.length ? <div className="hws-list">{filtered.map((item, i) => <div className="hws-item" key={`${item.kind}-${String(item.id || i)}`}><strong>{display(item, ['name', 'title', 'content'])}</strong><span>{item.kind} · {display(item, ['project', 'client', 'scope', 'type', 'status'])}</span></div>)}</div> : <div className="hws-empty-line">Nothing matches yet.</div>}</section> : <><Section title="Clients" icon={<Users size={15} />} items={workspace.clients} emptyText="Tell Horizon about a client." /><Section title="Projects" icon={<FolderKanban size={15} />} items={workspace.projects} emptyText="Projects will appear here." /><Section title="Tasks" icon={<ListChecks size={15} />} items={workspace.tasks} emptyText="Tasks will appear here." /><Section title="Memory" icon={<BrainCircuit size={15} />} items={workspace.memories} emptyText="Durable memories will appear here." /><Section title="Notes" icon={<StickyNote size={15} />} items={workspace.notes} emptyText="Notes will appear here." /><AutomationPanel items={automations} onChange={sync} /></>}<div className="hws-footer"><CheckCircle2 size={14} /> Horizon state, memory and automations stay separate from outreach data.</div></aside></div>}</>;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<App />);
