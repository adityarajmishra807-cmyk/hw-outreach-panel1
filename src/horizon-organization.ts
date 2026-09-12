export type OrganizationType = 'client' | 'project' | 'task' | 'note';
export type OrganizationStatus = 'active' | 'completed' | 'archived';

export type HorizonRecord = {
  id: string;
  type: OrganizationType;
  title: string;
  data: Record<string, unknown>;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
  source: 'Horizon AI' | 'User';
};

export type OrganizationAction = {
  operation: 'create' | 'update';
  type: OrganizationType;
  title?: string;
  match?: { name?: string; title?: string };
  data?: Record<string, unknown>;
};

const KEY = 'horizon-ai-organized-records';
const EVENT = 'horizon-organization-updated';

function read(): HorizonRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(records: HorizonRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(records));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getOrganizedRecords(options?: { type?: OrganizationType; includeArchived?: boolean }) {
  return read().filter((record) => {
    if (options?.type && record.type !== options.type) return false;
    if (!options?.includeArchived && record.status === 'archived') return false;
    return true;
  });
}

export function applyOrganization(actions: OrganizationAction[]) {
  if (!Array.isArray(actions) || actions.length === 0) return { created: 0, updated: 0, records: getOrganizedRecords() };
  const records = read();
  let created = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const action of actions) {
    if (!['client', 'project', 'task', 'note'].includes(action.type)) continue;
    const data = action.data && typeof action.data === 'object' ? action.data : {};
    const title = clean(action.title) || clean(data.name) || clean(data.title) || clean(data.content) || 'Untitled record';
    const matchName = clean(action.match?.name) || clean(action.match?.title);
    const existing = records.find((record) => {
      if (record.type !== action.type || record.status === 'archived') return false;
      if (matchName) return record.title.toLowerCase() === matchName.toLowerCase();
      return record.title.toLowerCase() === title.toLowerCase();
    });

    if (action.operation === 'update' && existing) {
      existing.data = { ...existing.data, ...data };
      existing.title = title || existing.title;
      existing.updatedAt = now;
      existing.source = 'Horizon AI';
      updated += 1;
      continue;
    }

    if (existing && action.operation === 'create') {
      existing.data = { ...existing.data, ...data };
      existing.updatedAt = now;
      existing.source = 'Horizon AI';
      updated += 1;
      continue;
    }

    records.unshift({
      id: crypto.randomUUID(),
      type: action.type,
      title,
      data,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      source: 'Horizon AI',
    });
    created += 1;
  }

  write(records);
  return { created, updated, records };
}

export function archiveOrganizedRecord(id: string) {
  const records = read();
  const record = records.find((item) => item.id === id);
  if (!record) return;
  record.status = 'archived';
  record.updatedAt = new Date().toISOString();
  write(records);
}

export function subscribeToOrganizationChanges(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
