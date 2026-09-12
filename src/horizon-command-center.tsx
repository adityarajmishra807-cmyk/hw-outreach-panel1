import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrainCircuit, Settings2 } from 'lucide-react';
import { HorizonAI } from './horizon-ai';
import './horizon-command-center.css';

type Prospect = { id: string; name: string; handle: string; niche: string; score: number | null; status: string; reply: string; time: string };
const STORAGE_KEY = 'hw-outreach-prospects';
function readProspects(): Prospect[] { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function App() {
  const [prospects, setProspects] = React.useState<Prospect[]>(readProspects);
  React.useEffect(() => { const sync = () => setProspects(readProspects()); window.addEventListener('storage', sync); const interval = window.setInterval(sync, 1500); return () => { window.removeEventListener('storage', sync); window.clearInterval(interval); }; }, []);
  return <div className="horizon-os">
    <header className="horizon-os-header">
      <div className="horizon-os-brand"><div className="horizon-os-mark"><BrainCircuit size={15} /></div><div><div className="horizon-os-title">Horizon AI</div><div className="horizon-os-subtitle">Horizon Works operating layer</div></div></div>
      <div className="horizon-os-status"><span /> Gemini backbone</div>
      <button className="horizon-os-settings" aria-label="Settings"><Settings2 size={15} /></button>
    </header>
    <main className="horizon-os-main"><HorizonAI prospects={prospects} /></main>
  </div>;
}
const mount = document.createElement('div'); mount.id = 'horizon-command-center'; document.body.appendChild(mount); createRoot(mount).render(<App />);
