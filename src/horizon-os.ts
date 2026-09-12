export type HorizonOSMode = 'daily' | 'command' | 'outreach';
export type HorizonCapabilityStatus = 'ready' | 'degraded' | 'unavailable';

export type HorizonCapability = {
  id: string;
  name: string;
  description: string;
  status: HorizonCapabilityStatus;
  phase: string;
};

export type HorizonRuntimeSnapshot = {
  mode: HorizonOSMode;
  sessionStartedAt: number;
  lastActivityAt: number;
  capabilities: HorizonCapability[];
};

const STORAGE_KEY = 'horizon-os-runtime-v1';
const capabilities: HorizonCapability[] = [
  { id: 'organization', name: 'Automatic organization', description: 'Turns unstructured updates into durable workspace records.', status: 'ready', phase: '2' },
  { id: 'memory', name: 'Persistent memory', description: 'Keeps explicit durable context available across sessions.', status: 'ready', phase: '3' },
  { id: 'context', name: 'Context engine', description: 'Ranks workspace context before each AI request.', status: 'ready', phase: '4' },
  { id: 'knowledge', name: 'Knowledge brain', description: 'Provides searchable workspace knowledge to Horizon.', status: 'ready', phase: '5' },
  { id: 'tools', name: 'Controlled tools', description: 'Restricts mutations to an allowlisted tool policy.', status: 'ready', phase: '6' },
  { id: 'audit', name: 'Activity / audit', description: 'Records important Horizon actions and failures.', status: 'ready', phase: '7' },
  { id: 'proactive', name: 'Proactive intelligence', description: 'Surfaces high-signal actions without waiting for a prompt.', status: 'ready', phase: '8' },
  { id: 'automations', name: 'Automations', description: 'Stores and schedules recurring workspace instructions.', status: 'degraded', phase: '9' },
  { id: 'agents', name: 'Specialized agents', description: 'Routes work to focused roles with scoped tools.', status: 'ready', phase: '10' },
  { id: 'daily', name: 'Daily AI', description: 'Builds a grounded daily operating brief.', status: 'ready', phase: '11' },
];

let sessionStartedAt = Date.now();
let mode: HorizonOSMode = 'command';
const listeners = new Set<() => void>();

function notify() { listeners.forEach((listener) => listener()); }

export function getHorizonCapabilities(): HorizonCapability[] { return capabilities.map((capability) => ({ ...capability })); }

export function getHorizonRuntime(): HorizonRuntimeSnapshot {
  let lastActivityAt = sessionStartedAt;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as { sessionStartedAt?: number; lastActivityAt?: number; mode?: HorizonOSMode };
    if (Number.isFinite(stored.sessionStartedAt)) sessionStartedAt = Number(stored.sessionStartedAt);
    if (stored.mode === 'daily' || stored.mode === 'command' || stored.mode === 'outreach') mode = stored.mode;
    if (Number.isFinite(stored.lastActivityAt)) lastActivityAt = Number(stored.lastActivityAt);
  } catch { /* localStorage is optional */ }
  return { mode, sessionStartedAt, lastActivityAt, capabilities: getHorizonCapabilities() };
}

export function setHorizonMode(nextMode: HorizonOSMode) {
  mode = nextMode;
  persistActivity();
  notify();
}

export function touchHorizonActivity() {
  persistActivity();
  notify();
}

function persistActivity() {
  const now = Date.now();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionStartedAt, lastActivityAt: now, mode })); } catch { /* private browsing/storage quotas must not break Horizon */ }
}

export function subscribeToHorizonRuntime(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHorizonHealth(): { label: string; status: HorizonCapabilityStatus; ready: number; degraded: number; unavailable: number } {
  const current = getHorizonCapabilities();
  const ready = current.filter((item) => item.status === 'ready').length;
  const degraded = current.filter((item) => item.status === 'degraded').length;
  const unavailable = current.filter((item) => item.status === 'unavailable').length;
  return { label: unavailable ? 'Limited' : degraded ? 'Operational with limits' : 'Operational', status: unavailable ? 'unavailable' : degraded ? 'degraded' : 'ready', ready, degraded, unavailable };
}
