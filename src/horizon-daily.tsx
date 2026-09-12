import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, RefreshCw, Sparkles, Target, TrendingUp, X } from 'lucide-react';
import { getOrganizedRecords } from './horizon-organization';
import { getMemories } from './horizon-memory';
import { getKnowledge, searchKnowledge } from './horizon-knowledge';
import './horizon-daily.css';

type Prospect = Record<string, unknown>;
type BriefItem = { title: string; reason?: string; detail?: string; urgency?: string; severity?: string; source?: string };
type Briefing = { headline: string; priorities: BriefItem[]; followUps: BriefItem[]; risks: BriefItem[]; opportunities: BriefItem[]; note: string };

const PROSPECTS_KEY = 'hw-outreach-prospects';
function readProspects(): Prospect[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROSPECTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function HorizonDaily() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [briefing, setBriefing] = React.useState<Briefing | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState('');

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const organizedRecords = getOrganizedRecords().slice(0, 120);
      const memories = getMemories().slice(0, 120);
      const knowledge = searchKnowledge('today priorities deadlines follow up risk opportunity', 16);
      const response = await fetch('/api/daily-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          now: new Date().toISOString(),
          workspace: { name: 'Horizon Works' },
          prospects: readProspects().slice(0, 100),
          organizedRecords,
          memories,
          knowledge,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not generate the daily briefing.');
      setBriefing(data.briefing as Briefing);
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Daily briefing is unavailable.');
    } finally { setLoading(false); }
  }

  React.useEffect(() => { if (open && !briefing) void generate(); }, [open]);

  return <>
    <button className="hd-launcher" onClick={() => setOpen(true)} aria-label="Open daily briefing">
      <Sparkles size={15} />
      <span>Today</span>
    </button>
    {open && <div className="hd-backdrop" onClick={() => setOpen(false)}>
      <section className="hd-panel" onClick={(e) => e.stopPropagation()}>
        <header className="hd-header">
          <div className="hd-brand"><div className="hd-mark"><Sparkles size={15} /></div><div><p>HORIZON WORKS / DAILY AI</p><h2>Today</h2><span>Your operating brief, generated from the current Horizon context.</span></div></div>
          <div className="hd-actions"><button onClick={() => void generate()} disabled={loading} title="Refresh"><RefreshCw size={15} className={loading ? 'hd-spin' : ''} /></button><button onClick={() => setOpen(false)} title="Close"><X size={17} /></button></div>
        </header>
        <div className="hd-body">
          {loading && !briefing && <div className="hd-loading"><Sparkles size={22} className="hd-pulse" /><strong>Building your day…</strong><span>Checking tasks, outreach, memory and knowledge.</span></div>}
          {error && <div className="hd-error"><AlertTriangle size={16} /><span>{error}</span></div>}
          {briefing && <>
            <div className="hd-hero"><div><p className="hd-kicker">OPERATING HEADLINE</p><h3>{briefing.headline}</h3><span>{updatedAt ? `Updated ${updatedAt}` : 'Live briefing'}</span></div><Target size={21} /></div>
            <div className="hd-grid">
              <BriefSection title="Priorities" icon={<Target size={15} />} items={briefing.priorities} badge="priority" />
              <BriefSection title="Follow-ups" icon={<Clock3 size={15} />} items={briefing.followUps} badge="followup" />
              <BriefSection title="Risks" icon={<AlertTriangle size={15} />} items={briefing.risks} badge="risk" />
              <BriefSection title="Opportunities" icon={<TrendingUp size={15} />} items={briefing.opportunities} badge="opportunity" />
            </div>
            {briefing.note && <div className="hd-note"><CheckCircle2 size={16} /><div><b>Horizon recommendation</b><span>{briefing.note}</span></div></div>}
          </>}
        </div>
        <footer className="hd-footer"><span>Grounded in your current Horizon workspace.</span><button onClick={() => setOpen(false)}>Back to workspace <ArrowRight size={14} /></button></footer>
      </section>
    </div>}
  </>;
}

function BriefSection({ title, icon, items, badge }: { title: string; icon: React.ReactNode; items: BriefItem[]; badge: string }) {
  return <section className="hd-section"><div className="hd-section-head"><div>{icon}<h4>{title}</h4></div><span>{items.length}</span></div>{items.length === 0 ? <div className="hd-empty">Nothing surfaced.</div> : items.map((item, index) => <article className="hd-item" key={`${badge}-${index}`}><div className={`hd-item-dot ${badge} ${item.urgency || item.severity || ''}`} /><div><strong>{item.title}</strong>{(item.reason || item.detail) && <span>{item.reason || item.detail}</span>}{(item.source) && <em>Source: {item.source}</em>}</div></article>)}</section>;
}

const mount = document.createElement('div');
mount.id = 'horizon-daily';
document.body.appendChild(mount);
import('react-dom/client').then(({ createRoot }) => createRoot(mount).render(<HorizonDaily />));
