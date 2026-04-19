/**
 * normalizeTask — coerce any server/local task payload into a
 * shape the UI can render without null-checking every field.
 *
 * Spec: the Tasks screen must never crash on partial payloads. Servers,
 * imports, migrations, and offline queues all produce slightly different
 * shapes over time. This helper funnels everything into a single stable
 * shape and drops anything that can't be recovered.
 *
 * Returned shape:
 *   {
 *     id:            string          // stable, required
 *     title:         string          // non-empty string
 *     titleKey:      string | null   // i18n key, if any
 *     status:        'pending' | 'done' | 'skipped'
 *     why:           string
 *     next:          string
 *     icon:          string
 *     priority:      number          // 0 lowest, 100 highest
 *     createdAt:     number | null   // ms
 *     dueAt:         number | null   // ms
 *     completedAt:   number | null   // ms
 *     source:        string
 *     meta:          object          // passthrough of extra fields
 *   }
 */

const VALID_STATUS = new Set(['pending', 'done', 'skipped']);

function toStr(v, fallback = '') {
  if (v == null) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

function toNum(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toTs(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const parsed = Date.parse(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/**
 * @param {any} raw
 * @returns {object | null}  normalized task, or null if unsalvageable
 */
export function normalizeTask(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // id must be recoverable — without it the list can't key items.
  const id = toStr(raw.id ?? raw._id ?? raw.taskId ?? raw.uuid, '').trim();
  if (!id) return null;

  // A task with no title at all is useless to render. We accept either
  // a ready string or a titleKey for i18n resolution downstream.
  const title = toStr(raw.title ?? raw.name ?? raw.label, '').trim();
  const titleKey = toStr(raw.titleKey, '').trim() || null;
  if (!title && !titleKey) return null;

  const statusRaw = toStr(raw.status, 'pending').toLowerCase();
  const status = VALID_STATUS.has(statusRaw) ? statusRaw : 'pending';

  return {
    id,
    title: title || '',
    titleKey,
    status,
    why: toStr(raw.why ?? raw.reason, ''),
    next: toStr(raw.next ?? raw.nextStep, ''),
    icon: toStr(raw.icon, '\uD83C\uDF3E'),
    priority: toNum(raw.priority, 0),
    createdAt: toTs(raw.createdAt ?? raw.created_at),
    dueAt: toTs(raw.dueAt ?? raw.due_at ?? raw.deadline),
    completedAt: toTs(raw.completedAt ?? raw.completed_at),
    source: toStr(raw.source, 'unknown'),
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : {},
  };
}

/**
 * Normalize a list, silently dropping anything that can't be recovered.
 * Returns [] for non-array input so callers never need to guard.
 */
export function normalizeTaskList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const t = normalizeTask(item);
    if (t) out.push(t);
  }
  return out;
}
