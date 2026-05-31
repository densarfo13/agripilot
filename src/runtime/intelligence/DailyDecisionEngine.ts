// Farroway · Farmer Daily Decision Engine (daily-decision-v1)
// Composition-only, self-contained decision-support runtime.
// No project imports. Reads ONLY from probe globals and localStorage.
// Pure, SSR-safe, never throws, returns frozen envelopes.

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

// ---- Types ----
type Priority = 'high' | 'medium' | 'low';
type Confidence = 'low' | 'medium' | 'high';

interface Action {
  text: string;
  reason: string;
  priority: Priority;
  source: string;
}

interface DailyDecisionEnvelope {
  runtimeVersion: 'daily-decision-v1';
  initialized: true;
  actions: Action[];
  value: number;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

const _arr = (v: any): any[] => (Array.isArray(v) ? v : []);
const _str = (v: any): string => (typeof v === 'string' ? v : '');
const _num = (v: any): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

function _ensureTail(s: string): string {
  const base = (s || '').trim();
  if (!base) return GUIDANCE_TAIL;
  return base.endsWith(GUIDANCE_TAIL) ? base : base + ' ' + GUIDANCE_TAIL;
}

// Friendly crop label extracted defensively from a record.
function _cropOf(rec: any): string {
  return _safe(() => {
    if (!rec || typeof rec !== 'object') return '';
    const cand = rec.crop || rec.cropName || rec.plant || rec.plantName ||
      rec.species || rec.name || (rec.label && rec.label.name);
    const s = _str(cand).trim();
    return s ? s.toLowerCase() : '';
  }, '');
}

// Is a task overdue or open? Defensive across shapes.
function _taskState(t: any): { open: boolean; overdue: boolean; label: string } {
  return _safe(() => {
    if (!t || typeof t !== 'object') return { open: false, overdue: false, label: '' };
    const status = _str(t.status || t.state).toLowerCase();
    const done = t.done === true || t.completed === true ||
      status === 'done' || status === 'completed' || status === 'complete';
    const open = !done;
    let overdue = false;
    const dueRaw = t.dueAt || t.due || t.dueDate || t.scheduledFor || t.when;
    const dueMs = _safe(() => {
      if (typeof dueRaw === 'number' && isFinite(dueRaw)) return dueRaw;
      if (typeof dueRaw === 'string' && dueRaw) { const d = Date.parse(dueRaw); return isNaN(d) ? null : d; }
      return null;
    }, null);
    if (open && dueMs !== null) overdue = dueMs < Date.now();
    if (open && (t.overdue === true || status === 'overdue')) overdue = true;
    const label = _str(t.title || t.name || t.text || t.label || t.action).trim();
    return { open, overdue, label };
  }, { open: false, overdue: false, label: '' });
}

export function dailyDecisionHealth(): DailyDecisionEnvelope {
  return _safe<DailyDecisionEnvelope>(() => {
    const dataSources: string[] = [];

    // ---- Gather REAL data defensively ----
    const tasks = _arr(_ls('farroway_cached_tasks'));
    if (tasks.length) dataSources.push('farroway_cached_tasks');

    const scans = _arr(_ls('farroway_scan_history_v1'));
    if (scans.length) dataSources.push('farroway_scan_history_v1');

    const plants = _arr(_ls('farroway_managed_plants'));
    if (plants.length) dataSources.push('farroway_managed_plants');

    const trend = _probe('__trendHealth');
    if (trend && typeof trend === 'object') dataSources.push('__trendHealth');

    const weatherRisk = _probe('__weatherRiskHealth');
    if (weatherRisk && typeof weatherRisk === 'object') dataSources.push('__weatherRiskHealth');

    const candidates: Array<Action & { _rank: number }> = [];
    const pr = (p: Priority) => (p === 'high' ? 0 : p === 'medium' ? 1 : 2);

    // ---- 1. Overdue / open tasks ----
    _safe(() => {
      let overdueAction: Action | null = null;
      let openAction: Action | null = null;
      for (const t of tasks) {
        const st = _taskState(t);
        if (!st.open) continue;
        if (st.overdue && !overdueAction) {
          const what = st.label ? st.label.toLowerCase() : 'task';
          overdueAction = {
            text: 'Complete your overdue ' + what + '.',
            reason: 'This task is past its date. Finishing it keeps your plants on track.',
            priority: 'high',
            source: 'farroway_cached_tasks',
          };
        } else if (!st.overdue && !openAction) {
          const what = st.label ? st.label.toLowerCase() : 'task';
          openAction = {
            text: 'Do your planned ' + what + ' today.',
            reason: 'You have this task open. A small step today helps.',
            priority: 'medium',
            source: 'farroway_cached_tasks',
          };
        }
      }
      if (overdueAction) candidates.push({ ...overdueAction, _rank: pr('high') });
      if (openAction) candidates.push({ ...openAction, _rank: pr('medium') });
    }, null);

    // ---- 2. Recent scan results: worsening / follow-up ----
    _safe(() => {
      // Use the most recent scan as the focus; require a real crop or finding.
      const recent = scans.length ? scans[scans.length - 1] : null;
      if (!recent || typeof recent !== 'object') return;
      const crop = _cropOf(recent);
      const findingRaw = _str(recent.disease || recent.condition || recent.diagnosis ||
        recent.issue || recent.result || (recent.label && recent.label.name)).toLowerCase();
      const healthyLike = /healthy|no\s*disease|none|normal/.test(findingRaw);
      const hasIssue = !!findingRaw && !healthyLike;

      if (hasIssue && crop) {
        candidates.push({
          text: 'Check ' + crop + ' leaves for worsening spots.',
          reason: 'Your last scan noticed something on the ' + crop + '. A quick look helps you catch changes early.',
          priority: 'high',
          source: 'farroway_scan_history_v1',
          _rank: pr('high'),
        });
        candidates.push({
          text: 'Upload a follow-up photo for ' + crop + '.',
          reason: 'A new photo lets you compare and see if things are getting better or worse.',
          priority: 'medium',
          source: 'farroway_scan_history_v1',
          _rank: pr('medium'),
        });
      } else if (crop) {
        candidates.push({
          text: 'Upload a follow-up photo for ' + crop + '.',
          reason: 'Regular photos build a clearer picture of how your ' + crop + ' is doing.',
          priority: 'low',
          source: 'farroway_scan_history_v1',
          _rank: pr('low'),
        });
      }
    }, null);

    // ---- 3. Trend signal ----
    _safe(() => {
      if (!trend || typeof trend !== 'object') return;
      const dir = _str((trend as any).direction || (trend as any).trend || (trend as any).value).toLowerCase();
      const worsening = /worse|declin|down|negativ|drop/.test(dir);
      if (worsening) {
        candidates.push({
          text: 'Look over your plants for any new changes.',
          reason: 'Recent records suggest things may be slipping. A gentle check today is a good idea.',
          priority: 'medium',
          source: '__trendHealth',
          _rank: pr('medium'),
        });
      }
    }, null);

    // ---- 4. Weather risk ----
    _safe(() => {
      if (!weatherRisk || typeof weatherRisk !== 'object') return;
      const lvl = _str((weatherRisk as any).level || (weatherRisk as any).risk || (weatherRisk as any).value).toLowerCase();
      const score = _num((weatherRisk as any).score);
      const high = /high|severe|elevat/.test(lvl) || (score !== null && score >= 70);
      const medium = /med|moder/.test(lvl) || (score !== null && score >= 40 && score < 70);
      if (high) {
        candidates.push({
          text: 'Plan for the weather and protect young plants.',
          reason: 'The weather outlook looks demanding. A little planning keeps your plants safer.',
          priority: 'high',
          source: '__weatherRiskHealth',
          _rank: pr('high'),
        });
      } else if (medium) {
        candidates.push({
          text: 'Keep an eye on the weather today.',
          reason: 'Conditions may change. Watching the sky helps you decide on watering and care.',
          priority: 'low',
          source: '__weatherRiskHealth',
          _rank: pr('low'),
        });
      }
    }, null);

    // ---- No real data at all ----
    if (!candidates.length) {
      return Object.freeze({
        runtimeVersion: 'daily-decision-v1',
        initialized: true,
        actions: [],
        value: 0,
        confidence: 'low',
        dataSources,
        explanation: _ensureTail('Not enough data yet — scan or add a task to get daily guidance.'),
        limitations: 'Guidance grows as you add tasks, scans, and farm details. With little history, advice stays general.',
      } as DailyDecisionEnvelope);
    }

    // ---- Rank, de-duplicate by text, keep TOP 3 ----
    const seen: Record<string, boolean> = {};
    const ordered = candidates
      .slice()
      .sort((a, b) => a._rank - b._rank)
      .filter((c) => {
        const key = c.text.toLowerCase();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      })
      .slice(0, 3)
      .map((c) => Object.freeze({
        text: c.text,
        reason: c.reason,
        priority: c.priority,
        source: c.source,
      } as Action));

    // ---- Confidence from breadth of real sources ----
    const sourceCount = dataSources.length;
    let confidence: Confidence = 'low';
    if (sourceCount >= 3) confidence = 'high';
    else if (sourceCount === 2) confidence = 'medium';

    const value = ordered.length;

    return Object.freeze({
      runtimeVersion: 'daily-decision-v1',
      initialized: true,
      actions: Object.freeze(ordered) as unknown as Action[],
      value,
      confidence,
      dataSources,
      explanation: _ensureTail(
        'Your top ' + value + ' action' + (value === 1 ? '' : 's') +
        ' for today, built from your tasks, scans, and conditions. Start with the first one.'
      ),
      limitations: 'Built only from your saved tasks, scans, trend, and weather signals. It cannot see your whole field, and more data makes guidance sharper.',
    } as DailyDecisionEnvelope);
  }, Object.freeze({
    runtimeVersion: 'daily-decision-v1',
    initialized: true,
    actions: [],
    value: 0,
    confidence: 'low',
    dataSources: [],
    explanation: _ensureTail('Not enough data yet — scan or add a task to get daily guidance.'),
    limitations: 'Guidance grows as you add tasks, scans, and farm details. With little history, advice stays general.',
  } as DailyDecisionEnvelope));
}

export function installDailyDecisionHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__dailyDecisionHealth !== 'function') {
      w.__dailyDecisionHealth = function () {
        const out = dailyDecisionHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Daily Decision]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
