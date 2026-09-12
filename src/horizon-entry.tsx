import React from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, X } from 'lucide-react';
import { HorizonAI } from './horizon-ai';
import './horizon-ai.css';

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
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function HorizonOverlay() {
  const [open, setOpen] = React.useState(false);
  const [prospects, setProspects] = React.useState<Prospect[]>(readProspects);

  React.useEffect(() => {
    const sync = () => setProspects(readProspects());
    window.addEventListener('storage', sync);
    const interval = window.setInterval(sync, 1500);
    return () => {
      window.removeEventListener('storage', sync);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <>
      <button className="horizon-fab" onClick={() => setOpen(true)} aria-label="Open Horizon AI">
        <Bot size={17} />
        <span>Horizon AI</span>
        <i />
      </button>
      {open && (
        <div className="horizon-overlay" role="dialog" aria-modal="true" aria-label="Horizon AI">
          <div className="horizon-overlay-backdrop" onClick={() => setOpen(false)} />
          <div className="horizon-overlay-window">
            <button className="horizon-close" onClick={() => setOpen(false)} aria-label="Close Horizon AI"><X size={18} /></button>
            <HorizonAI prospects={prospects} />
          </div>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById('horizon-ai-root')!).render(<HorizonOverlay />);
