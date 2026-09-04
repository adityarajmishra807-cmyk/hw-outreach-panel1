import React from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowUpRight, BarChart3, CheckCircle2, ChevronDown, Clock3, Filter, Instagram, LayoutDashboard, MessageCircle, MoreHorizontal, Plus, Search, Send, Settings, Sparkles, Target, Users, Zap } from 'lucide-react';
import './index.css';

const prospects = [
  { name: 'ABC Cafe', handle: '@abc_cafe', niche: 'Restaurant', score: 92, status: 'Interested', reply: 'Yes, send it over', time: '12 min ago' },
  { name: 'Royal Salon', handle: '@royalsalon', niche: 'Beauty', score: 87, status: 'Waiting', reply: '—', time: '31 min ago' },
  { name: 'XYZ Dental', handle: '@xyzdental', niche: 'Healthcare', score: 84, status: 'Interested', reply: 'Sure, would love to see it', time: '46 min ago' },
  { name: 'Northline Fitness', handle: '@northlinefit', niche: 'Fitness', score: 78, status: 'No reply', reply: '—', time: '1 hr ago' },
  { name: 'Meridian Yachts', handle: '@meridianyachts', niche: 'Luxury', score: 95, status: 'Interested', reply: 'Absolutely', time: '2 hrs ago' },
];

const statusClass: Record<string, string> = {
  Interested: 'border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-300',
  Waiting: 'border-amber-400/15 bg-amber-400/[0.07] text-amber-300',
  'No reply': 'border-white/10 bg-white/[0.045] text-white/45',
};

function App() {
  const [active, setActive] = React.useState('Overview');
  const [query, setQuery] = React.useState('');
  const filtered = prospects.filter((p) => `${p.name} ${p.handle} ${p.niche}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={17} /></div>
          <div><div className="brand-title">Horizon Works</div><div className="brand-sub">Outreach</div></div>
        </div>
        <nav className="nav">
          <p className="nav-label">Workspace</p>
          {[
            ['Overview', LayoutDashboard], ['Prospects', Users], ['Campaigns', Send], ['Demo Requests', Target], ['Analytics', BarChart3],
          ].map(([label, Icon]) => (
            <button key={label as string} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => setActive(label as string)}><Icon size={17} /> <span>{label as string}</span>{label === 'Demo Requests' && <span className="nav-badge">6</span>}</button>
          ))}
          <p className="nav-label nav-bottom">System</p>
          <button className={`nav-item ${active === 'Settings' ? 'active' : ''}`} onClick={() => setActive('Settings')}><Settings size={17} /><span>Settings</span></button>
        </nav>
        <div className="account-card">
          <div className="avatar">AD</div>
          <div className="account-copy"><div>Aditya</div><span>Horizon Works</span></div>
          <ChevronDown size={15} className="account-chevron" />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">HORIZON WORKS / OUTREACH</p><h1>{active}</h1></div>
          <div className="top-actions">
            <div className="connection"><span className="pulse"/> Instagram not connected <ChevronDown size={14}/></div>
            <button className="icon-btn" aria-label="Notifications"><Activity size={17}/></button>
            <button className="primary-btn"><Plus size={16}/> Add prospects</button>
          </div>
        </header>

        {active === 'Overview' && <>
          <section className="hero-strip">
            <div><div className="hero-kicker"><Instagram size={14}/> Outreach control center</div><h2>Know who you contacted.<br/><span>Know who wants the demo.</span></h2><p>Track prospecting, DMs, replies and demo requests in one clean workspace. AI classification is ready to plug in.</p></div>
            <div className="hero-side"><div className="hero-side-label">TODAY</div><div className="hero-side-value">21</div><div className="hero-side-meta">interested prospects</div></div>
          </section>

          <section className="metrics-grid">
            {[
              ['Prospects', '500', '+24 today', Users, 'blue'],
              ['DMs Sent', '500', '100% of queued', Send, 'violet'],
              ['Replies', '73', '14.6% reply rate', MessageCircle, 'cyan'],
              ['Interested', '21', '4.2% interest rate', Target, 'green'],
            ].map(([label, value, meta, Icon, tone]) => <div className="metric-card" key={label as string}><div className={`metric-icon ${tone}`}><Icon size={17}/></div><div className="metric-label">{label as string}</div><div className="metric-value">{value as string}</div><div className="metric-meta">{meta as string}</div></div>)}
          </section>

          <section className="two-col">
            <div className="panel large-panel">
              <div className="panel-head"><div><p className="section-kicker">Pipeline</p><h3>Outreach funnel</h3></div><button className="ghost-btn">Last 7 days <ChevronDown size={14}/></button></div>
              <div className="funnel">
                {[
                  ['Prospects', 500, 100, '500 added'],
                  ['DMs sent', 500, 100, '100%'],
                  ['Replies', 73, 14.6, '14.6%'],
                  ['Interested', 21, 4.2, '4.2%'],
                  ['Demos sent', 12, 2.4, '2.4%'],
                ].map(([label, value, pct, note]) => <div className="funnel-row" key={label as string}><div className="funnel-info"><span>{label as string}</span><strong>{value as number}</strong></div><div className="funnel-track"><div className="funnel-fill" style={{width: `${Math.max((pct as number) * 100 / 100, 3)}%`}} /></div><div className="funnel-note">{note as string}</div></div>)}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><div><p className="section-kicker">Action queue</p><h3>Demo requests</h3></div><button className="text-btn" onClick={() => setActive('Demo Requests')}>View all <ArrowUpRight size={14}/></button></div>
              <div className="request-list">
                {prospects.filter(p => p.status === 'Interested').map(p => <div className="request-item" key={p.handle}><div className="mini-avatar">{p.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div><div className="request-copy"><strong>{p.name}</strong><span>{p.handle}</span></div><span className="request-time">{p.time}</span></div>)}
              </div>
              <button className="queue-btn" onClick={() => setActive('Demo Requests')}>Review 3 interested prospects <ArrowUpRight size={14}/></button>
            </div>
          </section>

          <section className="panel prospects-panel">
            <div className="panel-head"><div><p className="section-kicker">Prospect activity</p><h3>Latest outreach</h3></div><div className="table-actions"><div className="search-wrap"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search prospects"/></div><button className="ghost-btn"><Filter size={14}/> Filter</button></div></div>
            <div className="table-wrap"><table><thead><tr><th>Business</th><th>Industry</th><th>Score</th><th>DM status</th><th>Reply</th><th>Updated</th><th></th></tr></thead><tbody>{filtered.map(p => <tr key={p.handle}><td><div className="business-cell"><div className="mini-avatar">{p.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div><div><strong>{p.name}</strong><span>{p.handle}</span></div></div></td><td><span className="muted-cell">{p.niche}</span></td><td><span className="score"><Zap size={12}/>{p.score}</span></td><td><span className={`status-pill ${statusClass[p.status] || statusClass['No reply']}`}>{p.status}</span></td><td className="reply-cell">{p.reply}</td><td className="muted-cell">{p.time}</td><td><button className="more-btn"><MoreHorizontal size={17}/></button></td></tr>)}</tbody></table></div>
          </section>
        </>}

        {active !== 'Overview' && <section className="empty-state panel"><div className="empty-icon"><Sparkles size={20}/></div><h2>{active}</h2><p>This module is scaffolded in the foundation build. The data model and API layer can be connected next.</p><button className="primary-btn" onClick={() => setActive('Overview')}>Back to overview</button></section>}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
