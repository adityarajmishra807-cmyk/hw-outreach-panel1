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
  match?: { name?: string; title?: string; client?: string; project?: string };
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

function normalized(value: unknown) {
  return clean(value).toLowerCase().replace(/\s+/g, ' ');
}

function recordValue(record: HorizonRecord, key: string) {
  if (key === 'title') return record.title;
  return record.data?.[key];
}

function matches(record: HorizonRecord, action: OrganizationAction) {
  if (record.type !== action.type || record.status === 'archived') return false;
  const match = action.match || {};
  const entries = Object.entries(match).filter(([, value]) => clean(value));
  if (entries.length) return entries.every(([key, value]) => normalized(recordValue(record, key)) === normalized(value));

  const data = action.data || {};
  const candidate = action.title || data.name || data.title || data.content;
  return !!candidate && normalized(record.title) === normalized(candidate);
}

function bucketFor(type: OrganizationType): 'clients' | 'projects' | 'tasks' | 'notes' {
  if (type === 'client') return 'clients';
  if (type === 'project') return 'projects';
  if (type === 'task') return 'tasks';
  return 'notes';
}

function sanitizeData(data: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'string') next[key] = value.trim();
    else next[key] = value;
  }
  return next;
}

export function getOrganizedRecords(options?: { type?: OrganizationType; includeArchived?: boolean }) {
  return read().filter((record) => {
    if (options?.type && record.type !== options.type) return false;
    if (!options?.includeArchived && record.status === 'archived') return false;
    return true;
  });
}

export function applyOrganization(actions: OrganizationAction[]) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { created: 0, updated: 0, records: getOrganizedRecords() };
  }

  const records = read();
  let created = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const action of actions) {
    if (!action || !['client', 'project', 'task', 'note'].includes(action.type)) continue;

    const data = sanitizeData(action.data && typeof action.data === 'object' ? action.data : {});
    const title = clean(action.title) || clean(data.name) || clean(data.title) || clean(data.content) || 'Untitled record';
    const candidate = { ...action, title, data };
    const existing = records.find((record) => matches(record, candidate));

    if (existing) {
      existing.data = { ...existing.data, ...data };
      existing.title = title || existing.title;
      existing.updatedAt = now;
      existing.source = 'Horizon AI';
      updated += 1;
      continue;
    }

    records.unshift({
      id: crypto.randomUUID(),
      type: action.type,
      title,
      data: {
        ...data,
        _links: {
          client: clean(data.client) || clean(action.match?.client) || undefined,
          project: clean(data.project) || clean(action.match?.project) || undefined,
        },
      },
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
