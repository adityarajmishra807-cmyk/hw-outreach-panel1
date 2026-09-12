import React from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, BrainCircuit, Gauge, Settings2 } from 'lucide-react';
import { HorizonAI } from './horizon-ai';
import { HorizonDailyAI } from './horizon-daily-ai';
import { getHorizonHealth, getHorizonRuntime, setHorizonMode, subscribeToHorizonRuntime, touchHorizonActivity, type HorizonOSMode } from './horizon-os';
import './horizon-clean.css';
import './horizon-daily-ai.css';

type Prospect = { id: string; name: string; handle: string; niche: string; score: number | null; status: string; reply: string; time: string };
const STORAGE_KEY = 'hw-outreach-prospects';
function readProspects(): Prospect[] { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }

function App() {
  const [prospects, setProspects] = React.useState<Prospect[]>(readProspects);
  const [, setRuntimeTick] = React.useState(0);
  const runtime = getHorizonRuntime();
  const health = getHorizonHealth();
  const [mode, setMode] = React.useState<HorizonOSMode>(runtime.mode);

  React.useEffect(() => {
    const sync = () => setProspects(readProspects());
    const runtimeSync = () => { setMode(getHorizonRuntime().mode); setRuntimeTick((v) => v + 1); };
    window.addEventListener('storage', sync);
    const interval = window.setInterval(sync, 1500);
    const unsubscribe = subscribeToHorizonRuntime(runtimeSync);
    touchHorizonActivity();
    return () => { window.removeEventListener('storage', sync); window.clearInterval(interval); unsubscribe(); };
  }, []);

  function switchMode(nextMode: HorizonOSMode) {
    setHorizonMode(nextMode);
    setMode(nextMode);
  }

  return <div className="horizon-os">
    <header className="horizon-os-header">
      <div className="horizon-os-brand"><div className="horizon-os-mark"><BrainCircuit size={15} /></div><div><div className="horizon-os-title">Horizon AI</div><div className="horizon-os-subtitle">Horizon Works operating layer</div></div></div>
      <nav className="horizon-os-modes" aria-label="Horizon modes">
        {([['daily', 'Daily'], ['command', 'Command'], ['outreach', 'Outreach']] as Array<[HorizonOSMode, string]>).map(([id, label]) => <button key={id} className={mode === id ? 'active' : ''} onClick={() => switchMode(id)}>{label}</button>)}
      </nav>
      <div className={`horizon-os-health ${health.status}`} title={`${health.ready} ready, ${health.degraded} degraded`}><Gauge size={14} /><span /> {health.label}</div>
      <button className="horizon-os-settings" aria-label="Settings"><Settings2 size={15} /></button>
    </header>
    <div className="horizon-os-runtime-bar"><Activity size={13} /><span>{health.ready} capabilities ready</span><span className="runtime-separator">·</span><span>{prospects.length} outreach records available</span><span className="runtime-separator">·</span><span>Mode: {mode}</span></div>
    <main className="horizon-os-main">
      {(mode === 'daily' || mode === 'command') && <HorizonDailyAI prospects={prospects} />}
      {(mode === 'command' || mode === 'outreach') && <HorizonAI prospects={prospects} />}
      {mode === 'outreach' && <div className="horizon-os-outreach-note"><strong>Outreach workspace preserved.</strong><span>Existing outreach records remain the source of truth and are supplied to Horizon without replacing the outreach data model.</span></div>}
    </main>
  </div>;
}
const mount = document.createElement('div'); mount.id = 'horizon-command-center'; document.body.appendChild(mount); createRoot(mount).render(<App />);
