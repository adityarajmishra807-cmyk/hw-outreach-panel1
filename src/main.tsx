import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Filter,
  Instagram,
  LayoutDashboard,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  Target,
  Users,
  X,
} from 'lucide-react';
import './index.css';

type Prospect = {
  id: string;
  name: string;
  handle: string;
  niche: string;
  score: number | null;
  status: 'New' | 'Queued' | 'Sent' | 'Replied' | 'Interested' | 'Not interested';
  reply: string;
  time: string;
};

type InstagramStatus = {
  connected: boolean;
  account?: { id: string; username?: string; name?: string; account_type?: string };
  error?: string;
};

const STORAGE_KEY = 'hw-outreach-prospects';

function loadProspects(): Prospect[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Prospect[]) : [];
  } catch {
    return [];
  }
}

function saveProspects(items: Prospect[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

const navItems = [
  ['Overview', LayoutDashboard],
  ['Prospects', Users],
  ['Campaigns', Send],
  ['Demo Requests', Target],
  ['Analytics', BarChart3],
] as const;

function App() {
  const [active, setActive] = React.useState('Overview');
  const [query, setQuery] = React.useState('');
  const [prospects, setProspects] = React.useState<Prospect[]>(loadProspects);
  const [showAdd, setShowAdd] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', handle: '', niche: '' });
  const [instagram, setInstagram] = React.useState<InstagramStatus>({ connected: false });
  const [checkingInstagram, setCheckingInstagram] = React.useState(true);

  const checkInstagram = React.useCallback(async () => {
    setCheckingInstagram(true);
    try {
      const response = await fetch('/api/instagram/status', { cache: 'no-store' });
      const data = (await response.json()) as InstagramStatus;
      setInstagram(data);
    } catch (error) {
      setInstagram({ connected: false, error: error instanceof Error ? error.message : 'Connection check failed' });
    } finally {
      setCheckingInstagram(false);
    }
  }, []);

  React.useEffect(() => {
    checkInstagram();
  }, [checkInstagram]);

  React.useEffect(() => {
    saveProspects(prospects);
  }, [prospects]);

  const filtered = prospects.filter((p) =>
    `${p.name} ${p.handle} ${p.niche}`.toLowerCase().includes(query.toLowerCase()),
  );

  const sent = prospects.filter((p) => ['Sent', 'Replied', 'Interested', 'Not interested'].includes(p.status)).length;
  const replies = prospects.filter((p) => ['Replied', 'Interested', 'Not interested'].includes(p.status)).length;
  const interested = prospects.filter((p) => p.status === 'Interested').length;
  const replyRate = sent ? `${((replies / sent) * 100).toFixed(1)}%` : '—';
  const interestRate = sent ? `${((interested / sent) * 100).toFixed(1)}%` : '—';

  function addProspect(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const handle = form.handle.trim().replace(/^@/, '');
    const niche = form.niche.trim();
    if (!name || !handle) return;
    const next: Prospect = {
      id: crypto.randomUUID(),
      name,
      handle: `@${handle}`,
      niche: niche || 'Uncategorized',
      score: null,
      status: 'New',
      reply: '—',
      time: 'Just now',
    };
    setProspects((current) => [next, ...current]);
    setForm({ name: '', handle: '', niche: '' });
    setShowAdd(false);
    setActive('Prospects');
  }

  const connectionLabel = checkingInstagram
    ? 'Checking Instagram…'
    : instagram.connected
      ? `Instagram connected${instagram.account?.username ? ` · @${instagram.account.username}` : ''}`
      : 'Instagram not connected';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span>HW</span></div>
          <div>
            <div className="brand-title">Horizon Works</div>
            <div className="brand-sub">Outreach</div>
          </div>
        </div>

        <nav className="nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map(([label, Icon]) => (
            <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => setActive(label)}>
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'Demo Requests' && interested > 0 && <span className="nav-badge">{interested}</span>}
            </button>
          ))}
          <p className="nav-label nav-bottom">System</p>
          <button className={`nav-item ${active === 'Settings' ? 'active' : ''}`} onClick={() => setActive('Settings')}>
            <Settings size={16} strokeWidth={1.8} /><span>Settings</span>
          </button>
        </nav>

        <div className="account-card">
          <div className="avatar">HW</div>
          <div className="account-copy"><div>Horizon Works</div><span>Workspace owner</span></div>
          <ChevronDown size={15} className="account-chevron" />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">HORIZON WORKS / OUTREACH</p>
            <h1>{active}</h1>
          </div>
          <div className="top-actions">
            <button className="connection" onClick={checkInstagram} title={instagram.error || 'Click to refresh Instagram status'}>
              <span className="connection-dot" /> {connectionLabel} <ChevronDown size={13} />
            </button>
            <button className="icon-btn" aria-label="Activity"><Activity size={16} /></button>
            <button className="primary-btn" onClick={() => setShowAdd(true)}><Plus size={15} /> Add prospect</button>
          </div>
        </header>

        {active === 'Overview' && (
          <>
            <section className="hero-strip">
              <div>
                <div className="hero-kicker"><Instagram size={14} /> Outreach control center</div>
                <h2>Turn outreach into a<br /><span>measurable pipeline.</span></h2>
                <p>Manage prospects, track outreach, identify interested businesses, and hand qualified leads to the Demo Engine.</p>
              </div>
              <div className="hero-side">
                <div className="hero-side-label">CURRENT STATUS</div>
                <div className="hero-side-value">{prospects.length === 0 ? '—' : interested}</div>
                <div className="hero-side-meta">demo requests</div>
              </div>
            </section>

            <section className="metrics-grid">
              {[
                ['Prospects', prospects.length === 0 ? '—' : String(prospects.length), 'Total in workspace', Users],
                ['DMs Sent', sent === 0 ? '—' : String(sent), 'Awaiting real activity', Send],
                ['Replies', replies === 0 ? '—' : String(replies), sent ? `${replyRate} reply rate` : 'No data yet', MessageCircle],
                ['Interested', interested === 0 ? '—' : String(interested), sent ? `${interestRate} interest rate` : 'No data yet', Target],
              ].map(([label, value, meta, Icon]) => (
                <div className="metric-card" key={label as string}>
                  <div className="metric-icon"><Icon size={17} /></div>
                  <div className="metric-label">{label as string}</div>
                  <div className="metric-value">{value as string}</div>
                  <div className="metric-meta">{meta as string}</div>
                </div>
              ))}
            </section>

            <section className="two-col">
              <div className="panel large-panel">
                <div className="panel-head">
                  <div><p className="section-kicker">Pipeline</p><h3>Outreach funnel</h3></div>
                  <button className="ghost-btn">Last 7 days <ChevronDown size={13} /></button>
                </div>
                {prospects.length === 0 ? (
                  <EmptyPanel icon={<Send size={20} />} title="No outreach activity yet" text="Add your first prospect to start building the pipeline." action="Add prospect" onAction={() => setShowAdd(true)} />
                ) : (
                  <div className="funnel">
                    {[
                      ['Prospects', prospects.length],
                      ['DMs sent', sent],
                      ['Replies', replies],
                      ['Interested', interested],
                    ].map(([label, value]) => {
                      const pct = prospects.length ? Math.max(((value as number) / prospects.length) * 100, value ? 4 : 0) : 0;
                      return <div className="funnel-row" key={label as string}>
                        <div className="funnel-info"><span>{label as string}</span><strong>{value as number}</strong></div>
                        <div className="funnel-track"><div className="funnel-fill" style={{ width: `${pct}%` }} /></div>
                        <div className="funnel-note">{value as number ? `${Math.round(pct)}%` : '—'}</div>
                      </div>;
                    })}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div><p className="section-kicker">Action queue</p><h3>Demo requests</h3></div>
                  <button className="text-btn" onClick={() => setActive('Demo Requests')}>View all <ArrowUpRight size={14} /></button>
                </div>
                {interested === 0 ? (
                  <div className="small-empty"><Target size={18} /><strong>No demo requests</strong><span>Interested prospects will appear here.</span></div>
                ) : (
                  <div className="request-list">
                    {prospects.filter((p) => p.status === 'Interested').slice(0, 4).map((p) => (
                      <div className="request-item" key={p.id}>
                        <div className="mini-avatar">{initials(p.name)}</div>
                        <div className="request-copy"><strong>{p.name}</strong><span>{p.handle}</span></div>
                        <span className="request-time">{p.time}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className="queue-btn" onClick={() => setActive('Demo Requests')}>Open demo requests <ArrowUpRight size={14} /></button>
              </div>
            </section>

            <section className="panel prospects-panel">
              <div className="panel-head">
                <div><p className="section-kicker">Prospect activity</p><h3>Latest outreach</h3></div>
                <div className="table-actions">
                  <div className="search-wrap"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search prospects" /></div>
                  <button className="ghost-btn"><Filter size={14} /> Filter</button>
                </div>
              </div>
              {filtered.length === 0 ? (
                <EmptyPanel icon={<Users size={20} />} title={query ? 'No matching prospects' : 'Your prospect list is empty'} text={query ? 'Try another search.' : 'Add businesses to begin tracking your outreach.'} action={query ? undefined : 'Add prospect'} onAction={query ? undefined : () => setShowAdd(true)} />
              ) : (
                <div className="table-wrap"><table><thead><tr><th>Business</th><th>Industry</th><th>Score</th><th>DM status</th><th>Reply</th><th>Updated</th><th /></tr></thead><tbody>{filtered.slice(0, 8).map((p) => (
                  <tr key={p.id}><td><div className="business-cell"><div className="mini-avatar">{initials(p.name)}</div><div><strong>{p.name}</strong><span>{p.handle}</span></div></div></td><td className="muted-cell">{p.niche}</td><td>{p.score == null ? <span className="unrated">—</span> : <span className="score"><span>{p.score}</span>/100</span>}</td><td><span className="status-pill">{p.status}</span></td><td className="reply-cell">{p.reply}</td><td className="muted-cell">{p.time}</td><td><button className="more-btn"><MoreHorizontal size={17} /></button></td></tr>
                ))}</tbody></table></div>
              )}
            </section>
          </>
        )}

        {active === 'Prospects' && <ProspectsView prospects={filtered} query={query} setQuery={setQuery} onAdd={() => setShowAdd(true)} />}
        {active === 'Campaigns' && <ModuleEmpty icon={<Send size={21} />} title="Campaigns" text={instagram.connected ? 'Instagram is connected. Campaign sending controls can now use the server-side Instagram integration.' : 'Campaign creation and sending controls will appear once the Instagram connection is configured.'} action={instagram.connected ? 'Refresh connection' : 'Connect Instagram'} onAction={checkInstagram} />}
        {active === 'Demo Requests' && <DemoRequestsView prospects={prospects} onCreateDemo={() => window.open('https://demo-workspace1.vercel.app/dashboard/create', '_blank', 'noopener,noreferrer')} />}
        {active === 'Analytics' && <ModuleEmpty icon={<BarChart3 size={21} />} title="Analytics" text="Performance charts will populate automatically once real outreach events are connected." action="Back to overview" onAction={() => setActive('Overview')} />}
        {active === 'Settings' && <ModuleEmpty icon={<Settings size={21} />} title="Settings" text="Workspace settings, account connections, AI configuration, and permissions will live here." action="Back to overview" onAction={() => setActive('Overview')} />}
      </main>

      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <form className="modal" onSubmit={addProspect} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><p className="section-kicker">New prospect</p><h3>Add a business</h3></div><button type="button" className="icon-btn" onClick={() => setShowAdd(false)} aria-label="Close"><X size={16} /></button></div>
            <label>Business name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Meridian Yachts" /></label>
            <label>Instagram handle<input required value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="e.g. meridianyachts" /></label>
            <label>Industry <span className="optional">optional</span><input value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} placeholder="e.g. Luxury travel" /></label>
            <div className="modal-actions"><button type="button" className="ghost-btn wide" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="primary-btn">Add prospect <Check size={15} /></button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function ProspectsView({ prospects, query, setQuery, onAdd }: { prospects: Prospect[]; query: string; setQuery: React.Dispatch<React.SetStateAction<string>>; onAdd: () => void }) {
  return <section className="page-section"><div className="page-heading"><div><p className="eyebrow">WORKSPACE / PROSPECTS</p><h2>Prospects</h2><p>Keep every business, Instagram handle, and outreach status in one place.</p></div><button className="primary-btn" onClick={onAdd}><Plus size={15} /> Add prospect</button></div><div className="panel"><div className="table-toolbar"><div className="search-wrap large-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by business, handle, or industry" /></div><button className="ghost-btn"><Filter size={14} /> Filter</button></div>{prospects.length === 0 ? <EmptyPanel icon={<Users size={20} />} title={query ? 'No matching prospects' : 'No prospects yet'} text={query ? 'Try another search.' : 'Add your first business to start building the outreach list.'} action={query ? undefined : 'Add prospect'} onAction={query ? undefined : onAdd} /> : <div className="table-wrap"><table><thead><tr><th>Business</th><th>Industry</th><th>Score</th><th>Status</th><th>Reply</th><th>Updated</th></tr></thead><tbody>{prospects.map((p) => <tr key={p.id}><td><div className="business-cell"><div className="mini-avatar">{initials(p.name)}</div><div><strong>{p.name}</strong><span>{p.handle}</span></div></div></td><td className="muted-cell">{p.niche}</td><td>{p.score == null ? '—' : `${p.score}/100`}</td><td><span className="status-pill">{p.status}</span></td><td className="reply-cell">{p.reply}</td><td className="muted-cell">{p.time}</td></tr>)}</tbody></table></div>}</div></section>;
}

function DemoRequestsView({ prospects, onCreateDemo }: { prospects: Prospect[]; onCreateDemo: () => void }) {
  const interested = prospects.filter((p) => p.status === 'Interested');
  return <section className="page-section"><div className="page-heading"><div><p className="eyebrow">WORKSPACE / DEMO REQUESTS</p><h2>Demo requests</h2><p>Prospects who have explicitly shown interest in receiving a website demo.</p></div></div><div className="panel">{interested.length === 0 ? <EmptyPanel icon={<Target size={20} />} title="No demo requests yet" text="When a prospect asks to see the demo, they will appear here ready for handoff to the Demo Engine." /> : <div className="demo-grid">{interested.map((p) => <div className="demo-card" key={p.id}><div className="mini-avatar large">{initials(p.name)}</div><div className="demo-card-main"><strong>{p.name}</strong><span>{p.handle} · {p.niche}</span><small>Requested {p.time}</small></div><button className="primary-btn" onClick={onCreateDemo}>Create demo <ArrowUpRight size={14} /></button></div>)}</div>}</div></section>;
}

function EmptyPanel({ icon, title, text, action, onAction }: { icon: React.ReactNode; title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty-panel"><div className="empty-icon">{icon}</div><h4>{title}</h4><p>{text}</p>{action && onAction && <button className="ghost-btn" onClick={onAction}>{action} <ArrowUpRight size={13} /></button>}</div>;
}

function ModuleEmpty({ icon, title, text, action, onAction }: { icon: React.ReactNode; title: string; text: string; action: string; onAction?: () => void }) {
  return <section className="page-section"><div className="panel module-empty"><div className="empty-icon">{icon}</div><p className="eyebrow">MODULE</p><h2>{title}</h2><p>{text}</p><button className="ghost-btn" onClick={onAction}>{action}</button></div></section>;
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

createRoot(document.getElementById('root')!).render(<App />);
