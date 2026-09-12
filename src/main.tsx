import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './horizon-command-center';

function MinimalShell() {
  return <main className="minimal-shell" aria-label="Horizon Works">
    <div className="minimal-brand">HORIZON WORKS</div>
    <div className="minimal-state">AI operating layer</div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<MinimalShell />);
