import React from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, BrainCircuit, Gauge, Settings2, Search, X } from 'lucide-react';
import { HorizonAI } from './horizon-ai';
import { HorizonDailyAI } from './horizon-daily-ai';
import { HORIZON_COMMANDS, findHorizonCommand } from './horizon-command-bus';
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
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [commandQuery, setCommandQuery] = React.useState('');
  const commandInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const sync = () => setProspects(readProspects());
    const runtimeSync = () => { setMode(getHorizonRuntime().mode); setRuntimeTick((v) => v + 1); };
    window.addEventListener('storage', sync);
    const interval = window.setInterval(sync, 1500);
    const unsubscribe = subscribeToHorizonRuntime(runtimeSync);
    touchHorizonActivity();
    return () => { window.removeEventListener('storage', sync); window.clearInterval(interval); unsubscribe(); };
  }, []);

  React.useEffect(() => {
    if (!commandOpen) return;
    commandInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setCommandOpen(false); setCommandQuery(''); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandOpen]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (typing) return;
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        setCommandOpen(true);
      }
      const command = HORIZON_COMMANDS.find((item) => item.shortcut === event.key);
      if (command?.mode) { event.preventDefault(); switchMode(command.mode); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function switchMode(nextMode: HorizonOSMode) {
    setHorizonMode(nextMode);
    setMode(nextMode);
    setCommandOpen(false);
    setCommandQuery('');
  }

  const filteredCommands = HORIZON_COMMANDS.filter((command) => `${command.label} ${command.description}`.toLowerCase().includes(commandQuery.trim().toLowerCase()));

  return <div className="horizon-os">
    <header className="horizon-os-header">
      <div className="horizon-os-brand"><div className="horizon-os-mark"><BrainCircuit size={15} /></div><div><div className="horizon-os-title">Horizon AI</div><div className="horizon-os-subtitle">Horizon Works operating layer</div></div></div>
      <nav className="horizon-os-modes" aria-label="Horizon modes">
        {([['daily', 'Daily'], ['command', 'Command'], ['outreach', 'Outreach']] as Array<[HorizonOSMode, string]>).map(([id, label]) => <button key={id} className={mode === id ? 'active' : ''} onClick={() => switchMode(id)}>{label}</button>)}
      </nav>
      <div className={`horizon-os-health ${health.status}`} title={`${health.ready} ready, ${health.degraded} degraded`}><Gauge size={14} /><span /> {health.label}</div>
      <button className="horizon-os-settings" aria-label="Open Horizon command palette" title="Command palette ( / or Ctrl+K )" onClick={() => setCommandOpen(true)}><Settings2 size={15} /></button>
    </header>
    <div className="horizon-os-runtime-bar"><Activity size={13} /><span>{health.ready} capabilities ready</span><span className="runtime-separator">·</span><span>{prospects.length} outreach records available</span><span className="runtime-separator">·</span><span>Mode: {mode}</span><span className="runtime-separator">·</span><button className="horizon-os-palette-hint" onClick={() => setCommandOpen(true)}>Press / to navigate</button></div>
    <main className="horizon-os-main">
      {(mode === 'daily' || mode === 'command') && <HorizonDailyAI prospects={prospects} />}
      {(mode === 'command' || mode === 'outreach') && <HorizonAI prospects={prospects} />}
      {mode === 'outreach' && <div className="horizon-os-outreach-note"><strong>Outreach workspace preserved.</strong><span>Existing outreach records remain the source of truth and are supplied to Horizon without replacing the outreach data model.</span></div>}
    </main>
    {commandOpen && <div className="horizon-command-overlay" role="presentation" onMouseDown={() => setCommandOpen(false)}><section className="horizon-command-palette" role="dialog" aria-modal="true" aria-label="Horizon command palette" onMouseDown={(event) => event.stopPropagation()}><header><div><span>HORIZON COMMAND</span><strong>Navigate your operating layer</strong></div><button aria-label="Close command palette" onClick={() => setCommandOpen(false)}><X size={15} /></button></header><div className="horizon-command-search"><Search size={14} /><input ref={commandInputRef} value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search commands..." /></div><div className="horizon-command-list">{filteredCommands.map((command) => <button key={command.id} className="horizon-command-item" onClick={() => command.mode && switchMode(command.mode)}><span><strong>{command.label}</strong><small>{command.description}</small></span>{command.shortcut && <kbd>{command.shortcut}</kbd>}</button>)}{filteredCommands.length === 0 && <div className="horizon-command-empty">No matching Horizon command.</div>}</div><footer><span>1–3 switch modes</span><span>Esc closes</span><span>/ or Ctrl+K opens</span></footer></section></div>}
  </div>;
}
const mount = document.createElement('div'); mount.id = 'horizon-command-center'; document.body.appendChild(mount); createRoot(mount).render(<App />);
