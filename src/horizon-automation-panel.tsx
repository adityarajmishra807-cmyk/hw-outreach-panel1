import React from 'react';
import { Clock3, Plus, Power, Trash2, Play, X } from 'lucide-react';
import { createAutomation, getDueAutomations, listAutomations, markAutomationRun, removeAutomation, toggleAutomation, subscribeToAutomationChanges, type AutomationFrequency, type HorizonAutomation } from './horizon-automations';
import './horizon-automation-panel.css';

type Props = { onClose: () => void };

const frequencies: AutomationFrequency[] = ['hourly', 'daily', 'weekly'];

export function HorizonAutomationPanel({ onClose }: Props) {
  const [items, setItems] = React.useState<HorizonAutomation[]>(() => listAutomations());
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', instruction: '', frequency: 'daily' as AutomationFrequency });
  const [running, setRunning] = React.useState<string | null>(null);

  React.useEffect(() => subscribeToAutomationChanges(() => setItems(listAutomations())), []);

  function refresh() { setItems(listAutomations()); }

  function save() {
    if (!form.name.trim() || !form.instruction.trim()) return;
    createAutomation(form);
    setForm({ name: '', instruction: '', frequency: 'daily' });
    setShowForm(false);
    refresh();
  }

  async function runNow(item: HorizonAutomation) {
    if (running) return;
    setRunning(item.id);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: item.instruction, context: { workspace: 'Horizon Works', automation: { id: item.id, name: item.name, frequency: item.frequency } } }),
      });
      if (!response.ok) throw new Error('Automation request failed');
      markAutomationRun(item.id);
      refresh();
    } catch {
      // Keep the automation enabled; a later run can retry.
    } finally { setRunning(null); }
  }

  return <div className="ha-overlay" onClick={onClose}>
    <section className="ha-panel" onClick={(e) => e.stopPropagation()}>
      <header className="ha-header"><div><p>HORIZON AUTOMATIONS</p><h2>Automate the routine</h2><span>Let Horizon repeat useful work on a schedule.</span></div><button className="ha-close" onClick={onClose}><X size={16} /></button></header>
      <div className="ha-toolbar"><div className="ha-summary"><strong>{items.filter((x) => x.enabled).length}</strong><span>active</span><i /><strong>{items.length}</strong><span>total</span></div><button className="ha-add" onClick={() => setShowForm(true)}><Plus size={14} /> New automation</button></div>
      {showForm && <div className="ha-form"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name — e.g. Morning Horizon briefing" /><textarea value={form.instruction} onChange={(e) => setForm({ ...form, instruction: e.target.value })} rows={4} placeholder="Tell Horizon exactly what to do when this runs..." /><div className="ha-frequency">{frequencies.map((frequency) => <button key={frequency} className={form.frequency === frequency ? 'active' : ''} onClick={() => setForm({ ...form, frequency })}>{frequency}</button>)}</div><div className="ha-form-actions"><button className="ha-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="ha-add" onClick={save}>Create automation</button></div></div>}
      <div className="ha-list">{items.length === 0 ? <div className="ha-empty"><Clock3 size={22} /><strong>No automations yet</strong><span>Create a repeating instruction and Horizon will keep the task on your schedule.</span></div> : items.map((item) => <article className={`ha-item ${item.enabled ? '' : 'disabled'}`} key={item.id}><div className="ha-item-main"><div className="ha-icon"><Clock3 size={15} /></div><div><strong>{item.name}</strong><span>{item.frequency} · next {new Date(item.nextRunAt).toLocaleString()}</span><p>{item.instruction}</p></div></div><div className="ha-actions"><button title={item.enabled ? 'Pause' : 'Enable'} onClick={() => { toggleAutomation(item.id); refresh(); }}><Power size={14} /></button><button title="Run now" disabled={running === item.id} onClick={() => void runNow(item)}><Play size={13} /></button><button title="Delete" onClick={() => { removeAutomation(item.id); refresh(); }}><Trash2 size={13} /></button></div></article>)}</div>
    </section>
  </div>;
}
