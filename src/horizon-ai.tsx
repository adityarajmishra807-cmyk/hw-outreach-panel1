import React from 'react';
import { BrainCircuit, Check, Database, Loader2, Sparkles, ArrowUpRight, FolderKanban, ListTodo, UsersRound, StickyNote, Wrench, Activity, Trash2 } from 'lucide-react';
import { getOrganizedRecords, subscribeToOrganizationChanges, type OrganizationAction } from './horizon-organization';
import { getMemories, subscribeToMemoryChanges, type HorizonMemory } from './horizon-memory';
import { executeHorizonToolCalls, HORIZON_TOOLS, type HorizonToolCall } from './horizon-tools';
import { clearAudit, getAuditEntries, recordAudit, subscribeToAuditChanges, type HorizonAuditEntry } from './horizon-audit';

type Prospect = {
  id: string;
  name: string;
  handle: string;
  niche: string;
  score: number | null;
  status: string;
  reply: string;
  time: string;
};

type HorizonResponse = {
  ok: boolean;
  text?: string;
  error?: string;
  organization?: {
    actions?: OrganizationAction[];
    memories?: Array<Omit<HorizonMemory, 'id' | 'createdAt' | 'updatedAt'>>;
    followUps?: string[];
  };
};

const EXAMPLES = [
  'I spoke to Rahul today. He wants a restaurant website for around 60k and wants it before October 15. I need to send the proposal tomorrow.',
  'Organize this: our strongest outreach opportunity today is a luxury travel business that replied and asked to see the demo.',
  'What should I focus on today based on the outreach pipeline?',
];

function OrganizationSummary({ refresh }: { refresh: number }) {
  const records = React.useMemo(() => getOrganizedRecords(), [refresh]);
  const memories = React.useMemo(() => getMemories(), [refresh]);
  const counts = {
    client: records.filter((r) => r.type === 'client').length,
    project: records.filter((r) => r.type === 'project').length,
    task: records.filter((r) => r.type === 'task').length,
    note: records.filter((r) => r.type === 'note').length,
  };
  return (
    <div className="horizon-organization-summary">
      <div className="horizon-org-stat"><UsersRound size={14} /><strong>{counts.client}</strong><span>clients</span></div>
      <div className="horizon-org-stat"><FolderKanban size={14} /><strong>{counts.project}</strong><span>projects</span></div>
      <div className="horizon-org-stat"><ListTodo size={14} /><strong>{counts.task}</strong><span>tasks</span></div>
      <div className="horizon-org-stat"><StickyNote size={14} /><strong>{counts.note + memories.length}</strong><span>notes + memories</span></div>
    </div>
  );
}

function ActivityAudit({ refresh }: { refresh: number }) {
  const entries = React.useMemo(() => getAuditEntries({ limit: 12 }), [refresh]);
  return (
    <div className="horizon-audit-card">
      <div className="horizon-audit-head"><div><p className="section-kicker">Activity / audit</p><h3>What Horizon did</h3></div><button className="horizon-audit-clear" onClick={clearAudit} title="Clear local audit history"><Trash2 size={14} /></button></div>
      {entries.length === 0 ? <div className="horizon-audit-empty"><Activity size={16} /><span>Tool calls and organization events will appear here.</span></div> : (
        <div className="horizon-audit-list">
          {entries.map((entry: HorizonAuditEntry) => (
            <div className="horizon-audit-item" key={entry.id}>
              <span className={`horizon-audit-dot ${entry.metadata?.ok === false ? 'error' : ''}`} />
              <div><strong>{entry.action.replaceAll('_', ' ')}</strong><span>{entry.summary}</span></div>
              <time>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HorizonAI({ prospects }: { prospects: Prospect[] }) {
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [organizationTick, setOrganizationTick] = React.useState(0);
  const [lastOrganization, setLastOrganization] = React.useState<{ created: number; updated: number; memories: number; tools: number } | null>(null);

  React.useEffect(() => {
    const refresh = () => setOrganizationTick((v) => v + 1);
    const unsubscribeOrg = subscribeToOrganizationChanges(refresh);
    const unsubscribeMemory = subscribeToMemoryChanges(refresh);
    const unsubscribeAudit = subscribeToAuditChanges(refresh);
    return () => { unsubscribeOrg(); unsubscribeMemory(); unsubscribeAudit(); };
  }, []);

  async function sendMessage(message = input) {
    const text = message.trim();
    if (!text || loading) return;
    setInput('');
    setNotice('');
    setMessages((current) => [...current, { role: 'user', text }]);
    setLoading(true);
    recordAudit({ kind: 'ai_request', action: 'ai_request', summary: 'Horizon started processing a request.', metadata: { length: text.length } });
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: {
            workspace: 'Horizon Works Outreach',
            prospects: prospects.map(({ id, ...p }) => p),
            counts: {
              prospects: prospects.length,
              sent: prospects.filter((p) => ['Sent', 'Replied', 'Interested', 'Not interested'].includes(p.status)).length,
              replies: prospects.filter((p) => ['Replied', 'Interested', 'Not interested'].includes(p.status)).length,
              interested: prospects.filter((p) => p.status === 'Interested').length,
            },
            organizedRecords: getOrganizedRecords().slice(0, 40),
            memories: getMemories().slice(0, 40),
          },
        }),
      });
      const data = (await response.json()) as HorizonResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || 'Horizon could not process that request.');

      const organization = data.organization;
      const toolCalls: HorizonToolCall[] = [];
      if (organization?.actions?.length) toolCalls.push({ name: 'organize_records', arguments: { actions: organization.actions } });
      for (const memory of organization?.memories || []) {
        if (!memory.content?.trim()) continue;
        toolCalls.push({ name: 'save_memory', arguments: memory });
      }
      const toolResults = executeHorizonToolCalls(toolCalls);
      const created = toolResults.reduce((sum, result) => sum + (result.data && typeof result.data === 'object' && 'created' in result.data ? Number((result.data as { created?: number }).created || 0) : 0), 0);
      const updated = toolResults.reduce((sum, result) => sum + (result.data && typeof result.data === 'object' && 'updated' in result.data ? Number((result.data as { updated?: number }).updated || 0) : 0), 0);
      const memoryCount = toolCalls.filter((call) => call.name === 'save_memory').length;
      setLastOrganization({ created, updated, memories: memoryCount, tools: toolCalls.length });
      setOrganizationTick((v) => v + 1);

      const suffix = created || updated || memoryCount
        ? `\n\nOrganized: ${created} new, ${updated} updated${memoryCount ? `, ${memoryCount} memor${memoryCount === 1 ? 'y' : 'ies'} stored` : ''}.`
        : '';
      setMessages((current) => [...current, { role: 'assistant', text: `${data.text || 'Done.'}${suffix}` }]);
      recordAudit({ kind: 'ai_request', action: 'ai_request_completed', summary: 'Horizon completed the request.', metadata: { tools: toolCalls.length, created, updated, memories: memoryCount } });
    } catch (error) {
      recordAudit({ kind: 'error', action: 'ai_request', summary: error instanceof Error ? error.message : 'Horizon request failed.', metadata: { ok: false } });
      setNotice(error instanceof Error ? error.message : 'Horizon AI is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="horizon-ai-page">
      <div className="horizon-ai-intro"><div><p className="eyebrow">HORIZON WORKS / AI OPERATING LAYER</p><div className="horizon-title-row"><div className="horizon-logo"><BrainCircuit size={22} /></div><div><h2>Horizon AI</h2><p>Tell Horizon anything. It interprets the information, organizes it into durable records, and keeps important context available for future work.</p></div></div></div><div className="horizon-status"><span /> Gemini backbone</div></div>
      <div className="horizon-grid">
        <div className="panel horizon-chat-panel"><div className="panel-head"><div><p className="section-kicker">Command center</p><h3>Talk naturally</h3></div><span className="horizon-live"><span /> Ready</span></div><div className="horizon-examples">{EXAMPLES.map((example) => <button key={example} onClick={() => sendMessage(example)}>{example}</button>)}</div><div className="horizon-messages" aria-live="polite">{messages.length === 0 ? <div className="horizon-empty-chat"><Sparkles size={20} /><strong>Start with a thought, update, plan, or question.</strong><span>Horizon will classify durable information and automatically turn it into workspace records.</span></div> : messages.map((message, index) => <div className={`horizon-message ${message.role}`} key={`${message.role}-${index}`}><div className="horizon-message-label">{message.role === 'user' ? 'YOU' : 'HORIZON'}</div><div className="horizon-message-text">{message.text}</div></div>)}{loading && <div className="horizon-message assistant"><div className="horizon-message-label">HORIZON</div><div className="horizon-loading"><Loader2 size={15} className="spin" /> Thinking and organizing…</div></div>}</div>{notice && <div className="horizon-notice"><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}<form className="horizon-composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}><textarea value={input} onChange={(event) => setInput(event.target.value)} rows={5} placeholder="Tell Horizon anything… e.g. a client update, an idea, a deadline, a task, or a question." /><div className="horizon-composer-foot"><span>Private server-side Gemini request</span><button className="primary-btn" type="submit" disabled={loading || !input.trim()}>{loading ? 'Working…' : 'Send to Horizon'} <ArrowUpRight size={14} /></button></div></form></div>
        <div className="horizon-side-stack"><div className="panel"><div className="panel-head"><div><p className="section-kicker">Automatic organization</p><h3>Workspace records</h3></div></div><OrganizationSummary refresh={organizationTick} /><div className="horizon-context-row"><Database size={15} /><div><strong>{getOrganizedRecords().length}</strong><span>structured records</span></div><Check size={14} /></div><div className="horizon-context-row"><BrainCircuit size={15} /><div><strong>{getMemories().length}</strong><span>durable memories</span></div><Check size={14} /></div><div className="horizon-context-row"><Wrench size={15} /><div><strong>{HORIZON_TOOLS.length}</strong><span>controlled tools</span></div><Check size={14} /></div>{lastOrganization && <div className="horizon-org-result">Last run: {lastOrganization.created} created · {lastOrganization.updated} updated · {lastOrganization.memories} memories · {lastOrganization.tools} tools</div>}</div><div className="panel horizon-memory-card"><p className="section-kicker">Tool system</p><h3>Controlled execution</h3><p>Horizon routes workspace mutations and knowledge operations through a small allowlisted tool layer instead of allowing arbitrary client-side actions.</p><div className="memory-line"><span>Read workspace records</span><i /></div><div className="memory-line"><span>Search knowledge</span><i /></div><div className="memory-line"><span>Save durable memory</span><i /></div><div className="memory-line"><span>Create or update records</span><i /></div></div><div className="panel"><ActivityAudit refresh={organizationTick} /></div></div>
      </div>
    </section>
  );
}
