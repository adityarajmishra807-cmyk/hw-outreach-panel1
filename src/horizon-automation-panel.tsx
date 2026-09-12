import React from 'react';
import { Clock3, Plus, Power, Trash2, Play, X, CheckCircle2 } from 'lucide-react';
import { createAutomation, getDueAutomations, listAutomations, markAutomationRun, removeAutomation, toggleAutomation, subscribeToAutomationChanges, type AutomationFrequency, type HorizonAutomation } from './horizon-automations';
import { applyOrganization, type OrganizationAction } from './horizon-organization';
import { upsertMemory } from './horizon-memory';
import { recordAudit } from './horizon-audit';
import './horizon-automation-panel.css';

type Props = { onClose: () => void };
type AIResult = { organization?: { actions?: OrganizationAction[]; memories?: Array<{ content: string; type?: string; scope?: string; confidence?: number; importance?: number }> } };
const frequencies: AutomationFrequency[] = ['hourly', 'daily', 'weekly'];

function applyAutomationResult(data: AIResult) {
  const actions = Array.isArray(data.organization?.actions) ? data.organization.actions : [];
  const memories = Array.isArray(data.organization?.memories) ? data.organization.memories : [];
  const org = actions.length ? applyOrganization(actions) : { created: 0, updated: 0 };
  memories.filter((memory) => memory.content?.trim()).forEach((memory) => upsertMemory({
    content: memory.content,
    type: (['fact', 'preference', 'decision', 'observation'].includes(memory.type || '') ? memory.type : 'observation') as any,
    scope: (['personal', 'company', 'client', 'project'].includes(memory.scope || '') ? memory.scope : 'company') as any,
    confidence: typeof memory.confidence === 'number' ? memory.confidence : 0.9,
    importance: typeof memory.importance === 'number' ? memory.importance : 0.7,
    source: 'Horizon AI',
  }));
  return { created: org.created, updated: org.updated, memories: memories.length };
}

export function HorizonAutomationPanel({ onClose }: Props) {
  const [items, setItems] = React.useState<HorizonAutomation[]>(() => listAutomations());
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', instruction: '', frequency: 'daily' as AutomationFrequency });
  const [running, setRunning] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => subscribeToAutomationChanges(() => setItems(listAutomations())), []);
  React.useEffect(() => {
    const tick = () => { const due = getDueAutomations(); for (const item of due) void execute(item); };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function refresh() { setItems(listAutomations()); }
  function save() {
    if (!form.name.trim() || !form.instruction.trim()) return;
    createAutomation(form); setForm({ name: '', instruction: '', frequency: 'daily' }); setShowForm(false); refresh();
  }
  async function execute(item: HorizonAutomation) {
    if (running) return;
    setRunning(item.id); setMessage('');
    try {
      const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: item.instruction, context: { workspace: 'Horizon Works', automation: { id: item.id, name: item.name, frequency: item.frequency } } }) });
      const data = await response.json() as AIResult & { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Automation request failed');
      const result = applyAutomationResult(data);
      markAutomationRun(item.id); refresh();
      const summary = `${item.name} ran successfully${result.created || result.updated || result.memories ? ` · ${result.created} created · ${result.updated} updated · ${result.memories} memories` : ''}`;
      setMessage(summary); recordAudit({ kind: 'ai_request', action: 'automation_run', summary, metadata: { automationId: item.id, created: result.created, updated: result.updated, memories: result.memories } });
    } catch (error) {
      const summary = error instanceof Error ? error.message : 'Automation failed.';
      setMessage(summary); recordAudit({ kind: 'error', action: 'automation_run', summary, metadata: { automationId: item.id, ok: false } });
    } finally { setRunning(null); }
  }

  return <div className="ha-overlay" onClick={onClose}>
    <section className="ha-panel" onClick={(e) => e.stopPropagation()}>
      <header className="ha-header"><div><p>HORIZON AUTOMATIONS</p><h2>Automate the routine</h2><span>Repeat instructions and let Horizon apply the result to your workspace.</span></div><button className="ha-close" onClick={onClose}><X size={16} /></button></header>
      <div className="ha-toolbar"><div className="ha-summary"><strong>{items.filter((x) => x.enabled).length}</strong><span>active</span><i /><strong>{items.length}</strong><span>total</span></div><button className="ha-add" onClick={() => setShowForm(true)}><Plus size={14} /> New automation</button></div>
      {message && <div className="ha-message"><CheckCircle2 size={14} /><span>{message}</span></div>}
      {showForm && <div className="ha-form"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name — e.g. Morning Horizon briefing" /><textarea value={form.instruction} onChange={(e) => setForm({ ...form, instruction: e.target.value })} rows={4} placeholder="Tell Horizon exactly what to do when this runs..." /><div className="ha-frequency">{frequencies.map((frequency) => <button key={frequency} className={form.frequency === frequency ? 'active' : ''} type="button" onClick={() => setForm({ ...form, frequency })}>{frequency}</button>)}</div><div className="ha-form-actions"><button className="ha-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="ha-add" type="button" onClick={save}>Create automation</button></div></div>}
      <div className="ha-list">{items.length === 0 ? <div className="ha-empty"><Clock3 size={22} /><strong>No automations yet</strong><span>Create a repeating instruction and Horizon will keep the task on your schedule.</span></div> : items.map((item) => <article className={`ha-item ${item.enabled ? '' : 'disabled'}`} key={item.id}><div className="ha-item-main"><div className="ha-icon"><Clock3 size={15} /></div><div><strong>{item.name}</strong><span>{item.frequency} · next {new Date(item.nextRunAt).toLocaleString()}</span><p>{item.instruction}</p>{item.lastRunAt && <small>Last run {new Date(item.lastRunAt).toLocaleString()}</small>}</div></div><div className="ha-actions"><button title={item.enabled ? 'Pause' : 'Enable'} onClick={() => { toggleAutomation(item.id); refresh(); }}><Power size={14} /></button><button title="Run now" disabled={running === item.id} onClick={() => void execute(item)}><Play size={13} /></button><button title="Delete" onClick={() => { removeAutomation(item.id); refresh(); }}><Trash2 size={13} /></button></div></article>)}</div>
    </section>
  </div>;
}
