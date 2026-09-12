import React from 'react';
import { CalendarDays, CheckCircle2, Loader2, RefreshCw, ShieldAlert, Target, TrendingUp } from 'lucide-react';
import { getOrganizedRecords } from './horizon-organization';
import { getMemories } from './horizon-memory';

type Prospect = { id: string; name: string; handle: string; niche: string; score: number | null; status: string; reply: string; time: string };
type BriefItem = { title: string; reason?: string; detail?: string; source?: string; urgency?: 'high' | 'medium' | 'low'; severity?: 'high' | 'medium' | 'low' };
type Briefing = { headline: string; priorities: BriefItem[]; followUps: BriefItem[]; risks: BriefItem[]; opportunities: BriefItem[]; note: string };

const CACHE_KEY = 'horizon-daily-briefing-v1';

function cachedBriefing(): Briefing | null {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return value?.date === new Date().toISOString().slice(0, 10) ? value.briefing : null;
  } catch { return null; }
}

function saveBriefing(briefing: Briefing) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ date: new Date().toISOString().slice(0, 10), briefing })); } catch { /* cache is optional */ }
}

export function HorizonDailyAI({ prospects }: { prospects: Prospect[] }) {
  const [briefing, setBriefing] = React.useState<Briefing | null>(cachedBriefing);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function generate() {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/daily-briefing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          now: new Date().toISOString(),
          workspace: { name: 'Horizon Works Outreach' },
          prospects: prospects.slice(0, 80),
          organizedRecords: getOrganizedRecords().slice(0, 80),
          memories: getMemories().slice(0, 80),
          knowledge: [],
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.briefing) throw new Error(data.error || 'Daily briefing could not be generated.');
      setBriefing(data.briefing); saveBriefing(data.briefing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Daily briefing is unavailable.');
    } finally { setLoading(false); }
  }

  React.useEffect(() => { if (!briefing) void generate(); }, []);

  return <section className="horizon-daily-card">
    <div className="horizon-daily-head">
      <div><p className="section-kicker">Daily AI</p><h3>Today at a glance</h3><span><CalendarDays size={13} /> {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span></div>
      <button className="horizon-daily-refresh" onClick={() => void generate()} disabled={loading} title="Regenerate briefing">{loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}</button>
    </div>
    {loading && !briefing ? <div className="horizon-daily-loading"><Loader2 size={16} className="spin" /> Building today's briefing from your workspace…</div> : error ? <div className="horizon-daily-error"><ShieldAlert size={15} /><span>{error}</span><button onClick={() => void generate()}>Retry</button></div> : briefing ? <>
      <p className="horizon-daily-headline">{briefing.headline}</p>
      <div className="horizon-daily-grid">
        <div className="horizon-daily-section"><div className="horizon-daily-section-title"><Target size={14} /><span>Priorities</span></div>{briefing.priorities.length ? briefing.priorities.map((item, i) => <div className="horizon-daily-item" key={`${item.title}-${i}`}><span className={`daily-priority ${item.urgency || 'medium'}`} /><div><strong>{item.title}</strong><small>{item.reason}{item.source ? ` · ${item.source}` : ''}</small></div></div>) : <p className="horizon-daily-empty">No priority items surfaced.</p>}</div>
        <div className="horizon-daily-section"><div className="horizon-daily-section-title"><CheckCircle2 size={14} /><span>Follow-ups</span></div>{briefing.followUps.length ? briefing.followUps.map((item, i) => <div className="horizon-daily-item" key={`${item.title}-${i}`}><span className="daily-priority low" /><div><strong>{item.title}</strong><small>{item.reason}{item.source ? ` · ${item.source}` : ''}</small></div></div>) : <p className="horizon-daily-empty">No follow-ups surfaced.</p>}</div>
        <div className="horizon-daily-section"><div className="horizon-daily-section-title"><ShieldAlert size={14} /><span>Risks</span></div>{briefing.risks.length ? briefing.risks.map((item, i) => <div className="horizon-daily-item" key={`${item.title}-${i}`}><span className={`daily-priority ${item.severity || 'medium'}`} /><div><strong>{item.title}</strong><small>{item.detail}</small></div></div>) : <p className="horizon-daily-empty">No material risks surfaced.</p>}</div>
        <div className="horizon-daily-section"><div className="horizon-daily-section-title"><TrendingUp size={14} /><span>Opportunities</span></div>{briefing.opportunities.length ? briefing.opportunities.map((item, i) => <div className="horizon-daily-item" key={`${item.title}-${i}`}><span className="daily-priority high" /><div><strong>{item.title}</strong><small>{item.detail}{item.source ? ` · ${item.source}` : ''}</small></div></div>) : <p className="horizon-daily-empty">No new opportunities surfaced.</p>}</div>
      </div>
      {briefing.note && <div className="horizon-daily-note">{briefing.note}</div>}
    </> : null}
  </section>;
}
