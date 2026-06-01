/**
 * Farroway · Scan Risk Scoring Runtime (scan-risk-scoring-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real values via the
 * `_probe()` / `_winVar()` helpers below, and never fabricates data.
 *
 * Given a single normalized detection contract object it produces a calm,
 * per-scan risk score: each sub-risk is LOW/MEDIUM/HIGH/UNKNOWN and EVERY
 * score carries a plain-language explanation. It NEVER predicts an exact
 * harvest figure, money figure, or guaranteed outcome, and never exposes a
 * raw formula in grower-facing wording. Missing data degrades to 'UNKNOWN'.
 */

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

// --- internal pure helpers (never throw) ---------------------------------

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function _obj(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _winVar(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)[name] ?? null;
  }, null);
}

// --- runtime-local types & constants -------------------------------------

type Confidence = 'low' | 'medium' | 'high';
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
type ActionUrgency = 'TODAY' | 'THIS_WEEK' | 'MONITOR' | 'UNKNOWN';

interface ScanRiskScore {
  severityRisk: RiskLevel;
  spreadRisk: RiskLevel;
  cropStageRisk: RiskLevel;
  weatherRisk: RiskLevel;
  yieldReadinessRisk: RiskLevel;
  actionUrgency: ActionUrgency;
  overallRisk: RiskLevel;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

interface ScanRiskScoringEnvelope {
  runtimeVersion: 'scan-risk-scoring-v1';
  initialized: true;
  severityRiskReady: boolean;
  spreadRiskReady: boolean;
  weatherRiskReady: boolean;
  cropStageRiskReady: boolean;
  actionUrgencyReady: boolean;
  noExactYieldPrediction: true;
  limitationsReady: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export const SCAN_RISK_SCORING_VERSION = 'scan-risk-scoring-v1';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

const LIMITATIONS =
  'This is a calm read of the single scan and the context saved on this device. ' +
  'It does not predict an exact yield, harvest amount, or any money figure, and it ' +
  'is not a guaranteed outcome. Where information is missing it is shown as UNKNOWN ' +
  'rather than guessed. Treat it as a gentle watch-list, not advice about chemicals. ' +
  GUIDANCE_TAIL;

// --- pure scoring helpers ------------------------------------------------

/** Normalize any external level-ish value to our calm RiskLevel set. */
function _level(raw: any): RiskLevel {
  return _safe(() => {
    if (raw == null) return 'UNKNOWN';
    const s = String(raw).trim().toLowerCase();
    if (!s) return 'UNKNOWN';
    if (/(high|severe|critical|red|urgent)/.test(s)) return 'HIGH';
    if (/(med|moderate|amber|orange|elevated|watch)/.test(s)) return 'MEDIUM';
    if (/(low|mild|minor|green|none|ok|clear|healthy)/.test(s)) return 'LOW';
    return 'UNKNOWN';
  }, 'UNKNOWN');
}

/** Map a 0..1 numeric score to a RiskLevel (null -> UNKNOWN). */
function _scoreLevel(n: number | null): RiskLevel {
  return _safe(() => {
    if (n == null || !Number.isFinite(n)) return 'UNKNOWN';
    if (n >= 0.66) return 'HIGH';
    if (n >= 0.33) return 'MEDIUM';
    return 'LOW';
  }, 'UNKNOWN');
}

function _num(v: any): number | null {
  return _safe(() => {
    if (v == null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }, null);
}

/** Rank helper so we can take the max across sub-risks (UNKNOWN ignored). */
function _rank(l: RiskLevel): number {
  return l === 'HIGH' ? 3 : l === 'MEDIUM' ? 2 : l === 'LOW' ? 1 : 0;
}

function _maxLevel(levels: RiskLevel[]): RiskLevel {
  return _safe(() => {
    let best = 0;
    for (const l of levels) best = Math.max(best, _rank(l));
    return best === 3 ? 'HIGH' : best === 2 ? 'MEDIUM' : best === 1 ? 'LOW' : 'UNKNOWN';
  }, 'UNKNOWN');
}

// --- severity (from this scan's diseases / pests) -------------------------

function _severityRisk(detection: any): { level: RiskLevel; explanation: string } {
  return _safe(() => {
    const det = _obj(detection);
    if (!det) {
      return {
        level: 'UNKNOWN' as RiskLevel,
        explanation: 'No scan details were provided, so severity cannot be read yet.',
      };
    }
    const diseases = _arr(det.diseases);
    const pests = _arr(det.pests);
    const findings = diseases.concat(pests);
    if (findings.length === 0) {
      // An explicit empty scan is a genuine "looks clear" signal.
      const scanned = det.diseases !== undefined || det.pests !== undefined;
      if (scanned) {
        return {
          level: 'LOW' as RiskLevel,
          explanation: 'This scan did not flag any disease or pest, so severity looks low.',
        };
      }
      return {
        level: 'UNKNOWN' as RiskLevel,
        explanation: 'This scan did not include disease or pest details, so severity is unknown.',
      };
    }

    let best: RiskLevel = 'LOW';
    for (const f of findings) {
      const o = _obj(f);
      if (!o) continue;
      const sev = _level(o.severity ?? o.level ?? o.risk ?? o.grade);
      const conf = _num(o.confidence ?? o.score);
      let lvl: RiskLevel = sev;
      if (sev === 'UNKNOWN') lvl = _scoreLevel(conf); // fall back to confidence proxy
      if (_rank(lvl) > _rank(best)) best = lvl;
    }
    const n = findings.length;
    return {
      level: best,
      explanation:
        'Severity is read from the ' + n + ' issue(s) this scan flagged; the worst single ' +
        'one is treated as ' + best.toLowerCase() + '. A higher reading just means watch it more closely.',
    };
  }, {
    level: 'UNKNOWN' as RiskLevel,
    explanation: 'Severity could not be read from this scan, so it is shown as unknown.',
  });
}

// --- spread (from count / recency of detections this scan) ----------------

function _spreadRisk(detection: any): { level: RiskLevel; explanation: string } {
  return _safe(() => {
    const det = _obj(detection);
    if (!det) {
      return {
        level: 'UNKNOWN' as RiskLevel,
        explanation: 'No scan details were provided, so spread cannot be read yet.',
      };
    }
    const findings = _arr(det.diseases).concat(_arr(det.pests));
    const count = findings.length;

    // Recency: how recently this scan was taken (older context = less certain).
    const ts = _safe(() => {
      const raw = det.timestamp ?? det.scannedAt ?? det.date ?? det.createdAt ?? null;
      if (raw == null) return NaN;
      const n = typeof raw === 'number' ? raw : Date.parse(String(raw));
      return Number.isFinite(n) ? n : NaN;
    }, NaN);
    const ageDays = Number.isFinite(ts) ? (Date.now() - ts) / 86400000 : null;

    if (count === 0) {
      const scanned = det.diseases !== undefined || det.pests !== undefined;
      if (scanned) {
        return {
          level: 'LOW' as RiskLevel,
          explanation: 'Nothing was flagged in this scan, so there is little sign of spread right now.',
        };
      }
      return {
        level: 'UNKNOWN' as RiskLevel,
        explanation: 'This scan did not list detections, so spread cannot be read.',
      };
    }

    // More findings => more sites => higher spread watch.
    let level: RiskLevel = count >= 3 ? 'HIGH' : count >= 2 ? 'MEDIUM' : 'LOW';
    // A clearly stale scan softens the spread read by one calm step.
    if (ageDays != null && ageDays > 14 && level === 'HIGH') level = 'MEDIUM';
    else if (ageDays != null && ageDays > 14 && level === 'MEDIUM') level = 'LOW';

    const recency =
      ageDays == null
        ? 'the scan time is not known'
        : ageDays <= 2
        ? 'this scan is recent'
        : ageDays <= 14
        ? 'this scan is fairly recent'
        : 'this scan is a couple of weeks old';
    return {
      level,
      explanation:
        'Spread is read from how many issues this scan flagged (' + count + ') and how fresh it is — ' +
        recency + '. More findings on a recent scan means a closer watch for spread.',
    };
  }, {
    level: 'UNKNOWN' as RiskLevel,
    explanation: 'Spread could not be read from this scan, so it is shown as unknown.',
  });
}

// --- crop stage (from composed __growthStageHealth probe) -----------------

function _cropStageRisk(): { level: RiskLevel; explanation: string; ready: boolean } {
  return _safe(() => {
    const g = _obj(_probe('__growthStageHealth'));
    if (!g) {
      return {
        level: 'UNKNOWN' as RiskLevel,
        ready: false,
        explanation: 'Growth-stage context is not available, so crop-stage sensitivity is unknown.',
      };
    }
    const stageRaw =
      g.stage ?? g.value ?? (g.value && (g.value as any).stage) ?? g.cropStage ?? null;
    const stage = stageRaw != null ? String(stageRaw).toLowerCase() : '';
    if (!stage || /unknown/.test(stage)) {
      return {
        level: 'UNKNOWN' as RiskLevel,
        ready: true,
        explanation: 'The growth stage is not clear yet, so crop-stage sensitivity is unknown.',
      };
    }
    // Sensitive reproductive / late stages are watched more closely.
    let level: RiskLevel;
    if (/(flower|fruit|bloom|head|grain|pod|cob|ear|reproduct|matur|ripe|harvest)/.test(stage)) {
      level = 'HIGH';
    } else if (/(veget|tiller|grow|establish)/.test(stage)) {
      level = 'MEDIUM';
    } else if (/(seed|germ|sprout|emerg|plant|sow)/.test(stage)) {
      level = 'LOW';
    } else {
      level = 'MEDIUM';
    }
    return {
      level,
      ready: true,
      explanation:
        'Crop-stage sensitivity is read from the current growth stage. Plants at flowering, ' +
        'fruiting or near harvest are more sensitive, so this stage reads ' + level.toLowerCase() + '.',
    };
  }, {
    level: 'UNKNOWN' as RiskLevel,
    ready: false,
    explanation: 'Crop-stage context could not be read, so it is shown as unknown.',
  });
}

// --- weather (from __weatherRiskHealth probe or last snapshot) ------------

function _weatherRisk(): { level: RiskLevel; explanation: string; ready: boolean } {
  return _safe(() => {
    const w = _obj(_probe('__weatherRiskHealth'));
    if (w) {
      const lvl = _level(
        w.level ?? w.overall ?? w.risk ?? w.riskLevel ?? (w.value && (w.value as any).level),
      );
      return {
        level: lvl,
        ready: true,
        explanation:
          'Weather pressure is read from the weather-risk signal for this area. ' +
          'Rain or humid spells can raise disease spread, so this reads ' +
          (lvl === 'UNKNOWN' ? 'as unknown' : lvl.toLowerCase()) + '.',
      };
    }
    // Fall back to a saved snapshot if the probe is absent.
    const snap = _obj(_winVar('__farrowayLastWeather'));
    if (!snap) {
      return {
        level: 'UNKNOWN' as RiskLevel,
        ready: false,
        explanation: 'No weather signal is available, so weather pressure is unknown.',
      };
    }
    const direct = _level(snap.risk ?? snap.riskLevel ?? snap.riskScore);
    if (direct !== 'UNKNOWN') {
      return {
        level: direct,
        ready: true,
        explanation:
          'Weather pressure is read from the saved weather snapshot, which reads ' +
          direct.toLowerCase() + ' for disease-friendly conditions.',
      };
    }
    // Derive a calm proxy from snapshot fields if present.
    const rain = _num(snap.rain ?? snap.precip ?? snap.precipitation ?? snap.rainChance);
    const wind = _num(snap.wind ?? snap.windSpeed);
    const type = _safe(() => String(snap.type ?? snap.condition ?? '').toLowerCase(), '');
    let proxy = 0;
    let any = false;
    if (rain != null) { proxy = Math.max(proxy, rain > 1 ? Math.min(1, rain / 100) : rain); any = true; }
    if (wind != null) { proxy = Math.max(proxy, Math.min(1, wind / 60)); any = true; }
    if (type) { any = true; if (/(storm|flood|hail|heavy|severe)/.test(type)) proxy = Math.max(proxy, 0.85); }
    if (!any) {
      return {
        level: 'UNKNOWN' as RiskLevel,
        ready: false,
        explanation: 'The weather snapshot did not include usable fields, so weather pressure is unknown.',
      };
    }
    const lvl = _scoreLevel(proxy);
    return {
      level: lvl,
      ready: true,
      explanation:
        'Weather pressure is estimated from the saved snapshot (rain, wind or condition). ' +
        'Wetter or stormier conditions read higher, so this reads ' + lvl.toLowerCase() + '.',
    };
  }, {
    level: 'UNKNOWN' as RiskLevel,
    ready: false,
    explanation: 'Weather context could not be read, so it is shown as unknown.',
  });
}

// --- yield readiness (LABEL only — never an exact yield) ------------------

function _yieldReadinessRisk(): { level: RiskLevel; explanation: string; ready: boolean } {
  return _safe(() => {
    const y = _obj(_probe('__yieldReadinessHealth'));
    if (!y) {
      return {
        level: 'UNKNOWN' as RiskLevel,
        ready: false,
        explanation: 'Readiness context is not available, so readiness risk is unknown.',
      };
    }
    // Read the readiness LABEL only. We never read or surface any amount.
    const labelRaw = y.readiness ?? y.value ?? y.label ?? (y.value && (y.value as any).readiness);
    const label = _level(labelRaw); // HIGH readiness, MEDIUM, LOW, or UNKNOWN
    if (label === 'UNKNOWN') {
      return {
        level: 'UNKNOWN' as RiskLevel,
        ready: true,
        explanation: 'The readiness label is not clear yet, so readiness risk is unknown.',
      };
    }
    // Lower readiness => higher risk to a clean finish. Invert the label.
    const risk: RiskLevel = label === 'HIGH' ? 'LOW' : label === 'MEDIUM' ? 'MEDIUM' : 'HIGH';
    return {
      level: risk,
      ready: true,
      explanation:
        'Readiness risk uses only the readiness label (' + label.toLowerCase() + ') — never an exact ' +
        'amount. Lower readiness means more to watch before a clean finish, so this reads ' +
        risk.toLowerCase() + '.',
    };
  }, {
    level: 'UNKNOWN' as RiskLevel,
    ready: false,
    explanation: 'Readiness context could not be read, so it is shown as unknown.',
  });
}

// --- urgency from the sub-risks ------------------------------------------

function _urgency(levels: RiskLevel[]): ActionUrgency {
  return _safe(() => {
    const known = levels.filter((l) => l !== 'UNKNOWN');
    if (known.length === 0) return 'UNKNOWN';
    if (known.some((l) => l === 'HIGH')) return 'TODAY';
    if (known.some((l) => l === 'MEDIUM')) return 'THIS_WEEK';
    return 'MONITOR'; // all known are LOW
  }, 'UNKNOWN');
}

// --- public scorer -------------------------------------------------------

export function scoreScanRisk(detection: unknown) {
  return _safe(
    () => {
      const det = _obj(detection);

      const severity = _severityRisk(det);
      const spread = _spreadRisk(det);
      const stage = _cropStageRisk();
      const weather = _weatherRisk();
      const yieldReadiness = _yieldReadinessRisk();

      const severityRisk = severity.level;
      const spreadRisk = spread.level;
      const cropStageRisk = stage.level;
      const weatherRisk = weather.level;
      const yieldReadinessRisk = yieldReadiness.level;

      const subRisks: RiskLevel[] = [
        severityRisk,
        spreadRisk,
        cropStageRisk,
        weatherRisk,
        yieldReadinessRisk,
      ];

      const overallRisk = _maxLevel(subRisks);
      const actionUrgency = _urgency(subRisks);

      // confidence reflects how many sub-risks we could actually read.
      const knownCount = subRisks.filter((l) => l !== 'UNKNOWN').length;
      const confidence: Confidence =
        knownCount >= 4 ? 'high' : knownCount >= 2 ? 'medium' : 'low';

      // Calm, low-literacy grower-facing wording. No raw formula, no numbers.
      const overallWord =
        overallRisk === 'HIGH'
          ? 'elevated — worth a close look'
          : overallRisk === 'MEDIUM'
          ? 'a little raised — keep a watch'
          : overallRisk === 'LOW'
          ? 'low — keep monitoring'
          : 'not clear yet';

      const urgencyWord =
        actionUrgency === 'TODAY'
          ? 'It is worth checking this plant today.'
          : actionUrgency === 'THIS_WEEK'
          ? 'It is worth a look this week.'
          : actionUrgency === 'MONITOR'
          ? 'Keep monitoring as part of your normal routine.'
          : 'There is not enough information to suggest timing yet.';

      const explanation = _safe(() => {
        const parts: string[] = [];
        parts.push('Overall, this scan reads ' + overallWord + '.');
        parts.push('Severity: ' + severityRisk + ' — ' + severity.explanation);
        parts.push('Spread: ' + spreadRisk + ' — ' + spread.explanation);
        parts.push('Crop stage: ' + cropStageRisk + ' — ' + stage.explanation);
        parts.push('Weather: ' + weatherRisk + ' — ' + weather.explanation);
        parts.push('Readiness: ' + yieldReadinessRisk + ' — ' + yieldReadiness.explanation);
        parts.push(urgencyWord);
        return parts.join(' ');
      }, 'A calm read of this scan. ' + GUIDANCE_TAIL);

      return Object.freeze({
        severityRisk,
        spreadRisk,
        cropStageRisk,
        weatherRisk,
        yieldReadinessRisk,
        actionUrgency,
        overallRisk,
        confidence,
        explanation,
        limitations: LIMITATIONS,
      }) as ScanRiskScore;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      severityRisk: 'UNKNOWN' as RiskLevel,
      spreadRisk: 'UNKNOWN' as RiskLevel,
      cropStageRisk: 'UNKNOWN' as RiskLevel,
      weatherRisk: 'UNKNOWN' as RiskLevel,
      yieldReadinessRisk: 'UNKNOWN' as RiskLevel,
      actionUrgency: 'UNKNOWN' as ActionUrgency,
      overallRisk: 'UNKNOWN' as RiskLevel,
      confidence: 'low' as Confidence,
      explanation:
        'Not enough information to score this scan yet. Severity, spread, crop stage, ' +
        'weather and readiness are all shown as UNKNOWN until data is available. ' +
        GUIDANCE_TAIL,
      limitations: LIMITATIONS,
    }) as ScanRiskScore,
  );
}

// --- health envelope -----------------------------------------------------

export function scanRiskScoringHealth() {
  return _safe(
    () => {
      const stageReady = _cropStageRisk().ready;
      const weatherReady = _weatherRisk().ready;
      const yieldReady = _yieldReadinessRisk().ready;

      // severity/spread/urgency are computed purely from the per-scan input,
      // so the scorer is structurally wired for them whenever it runs.
      const severityRiskReady: boolean = true;
      const spreadRiskReady: boolean = true;
      const actionUrgencyReady: boolean = true;
      const cropStageRiskReady: boolean = stageReady;
      const weatherRiskReady: boolean = weatherReady;

      const readyProbes =
        (cropStageRiskReady ? 1 : 0) +
        (weatherRiskReady ? 1 : 0) +
        (yieldReady ? 1 : 0);
      const confidence: Confidence =
        readyProbes >= 3 ? 'high' : readyProbes >= 1 ? 'medium' : 'low';

      const explanation = _safe(() => {
        const parts: string[] = [];
        parts.push(
          'The per-scan risk scorer is wired. It always reads severity, spread and ' +
            'action urgency from the scan itself.',
        );
        parts.push(
          'Crop-stage context is ' + (cropStageRiskReady ? 'available' : 'not available yet') + ', ' +
            'weather context is ' + (weatherRiskReady ? 'available' : 'not available yet') + ', and ' +
            'readiness context is ' + (yieldReady ? 'available' : 'not available yet') + '.',
        );
        parts.push('It never predicts an exact yield, harvest amount, or money figure.');
        return parts.join(' ');
      }, 'Per-scan risk scorer is wired. ' + GUIDANCE_TAIL);

      return Object.freeze({
        runtimeVersion: 'scan-risk-scoring-v1' as const,
        initialized: true as const,
        severityRiskReady,
        spreadRiskReady,
        weatherRiskReady,
        cropStageRiskReady,
        actionUrgencyReady,
        noExactYieldPrediction: true as const,
        limitationsReady: true as const,
        confidence,
        explanation,
        limitations: LIMITATIONS,
      }) as ScanRiskScoringEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: 'scan-risk-scoring-v1' as const,
      initialized: true as const,
      severityRiskReady: false,
      spreadRiskReady: false,
      weatherRiskReady: false,
      cropStageRiskReady: false,
      actionUrgencyReady: false,
      noExactYieldPrediction: true as const,
      limitationsReady: true as const,
      confidence: 'low' as Confidence,
      explanation:
        'Scan risk scoring is wired but could not read any context yet. ' + GUIDANCE_TAIL,
      limitations: LIMITATIONS,
    }) as ScanRiskScoringEnvelope,
  );
}

// --- installer (same dev-log wrapper shape as siblings) -------------------

export function installScanRiskScoringHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanRiskScoringHealth !== 'function') {
      w.__scanRiskScoringHealth = function () {
        const out = scanRiskScoringHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Scan Risk Scoring]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
