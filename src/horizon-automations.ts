export type AutomationFrequency = 'hourly' | 'daily' | 'weekly';

export type HorizonAutomation = {
  id: string;
  name: string;
  instruction: string;
  frequency: AutomationFrequency;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
  nextRunAt: string;
};

const KEY = 'horizon-ai-automations';

const intervalMs: Record<AutomationFrequency, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

function read(): HorizonAutomation[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function write(items: HorizonAutomation[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 50)));
  window.dispatchEvent(new Event('horizon-ai-automations-updated'));
}

export function listAutomations() { return read(); }

export function createAutomation(input: Pick<HorizonAutomation, 'name' | 'instruction' | 'frequency'>) {
  const now = Date.now();
  const item: HorizonAutomation = {
    id: crypto.randomUUID(),
    name: input.name.trim().slice(0, 80) || 'Horizon automation',
    instruction: input.instruction.trim().slice(0, 1000),
    frequency: input.frequency,
    enabled: true,
    createdAt: new Date(now).toISOString(),
    nextRunAt: new Date(now + intervalMs[input.frequency]).toISOString(),
  };
  write([item, ...read()]);
  return item;
}

export function toggleAutomation(id: string) {
  const items = read().map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item);
  write(items);
}

export function removeAutomation(id: string) { write(read().filter((item) => item.id !== id)); }

export function markAutomationRun(id: string) {
  const now = Date.now();
  const items = read().map((item) => item.id === id ? {
    ...item,
    lastRunAt: new Date(now).toISOString(),
    nextRunAt: new Date(now + intervalMs[item.frequency]).toISOString(),
  } : item);
  write(items);
}

export function getDueAutomations(now = Date.now()) {
  return read().filter((item) => item.enabled && new Date(item.nextRunAt).getTime() <= now);
}
