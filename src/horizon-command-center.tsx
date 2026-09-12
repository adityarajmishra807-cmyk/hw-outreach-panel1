import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrainCircuit, ChevronDown, X } from 'lucide-react';
import { HorizonAI } from './horizon-ai';
import './horizon-command-center.css';

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

const STORAGE_KEY = 'hw-outreach-prospects';

function readProspects(): Prospect[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function App() {
  const [open, setOpen] = React.useState(false);
  const [prospects, setProspects] = React.useState<Prospect[]>(readProspects);

  React.useEffect(() => {
    const sync = () => setProspects(readProspects());
    window.addEventListener('storage', sync);
    const interval = window.setInterval(sync, 1200);
    return () => {
      window.removeEventListener('storage', sync);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <>
      <button className="hcc-launcher" onClick={() => setOpen(true)} aria-label="Open Horizon command center">
        <span className="hcc-orbit" />
        <BrainCircuit size={17} />
        <span>Horizon AI</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="hcc-overlay" role="dialog" aria-modal="true" aria-label="Horizon AI command center">
          <button className="hcc-backdrop" aria-label="Close command center" onClick={() => setOpen(false)} />
          <section className="hcc-window">
            <header className="hcc-header">
              <div className="hcc-brand">
                <div className="hcc-mark"><BrainCircuit size={16} /></div>
                <div>
                  <p>HORIZON WORKS</p>
                  <h1>AI Command Center</h1>
                  <span>One place to talk, think, and organize your workspace.</span>
                </div>
              </div>
              <button className="hcc-close" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            </header>
            <div className="hcc-status"><i /> Gemini-ready command surface <span>Workspace: Horizon Works</span></div>
            <div className="hcc-body">
              <HorizonAI prospects={prospects} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const mount = document.createElement('div');
mount.id = 'horizon-command-center';
document.body.appendChild(mount);
createRoot(mount).render(<App />);
