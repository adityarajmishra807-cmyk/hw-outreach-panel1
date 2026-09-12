import { createRoot } from 'react-dom/client';

// The live Horizon entry is loaded as an independent module from index.html.
// Expose the React root factory so that legacy entry wiring remains functional
// without changing the existing component bundle.
(globalThis as typeof globalThis & { createRoot: typeof createRoot }).createRoot = createRoot;
