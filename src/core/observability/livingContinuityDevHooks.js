/**
 * livingContinuityDevHooks.js — pins the Living Farm Continuity §17
 * window globals so production DevTools sessions can inspect the
 * adaptive engines live.
 *
 *   import { installLivingContinuityHooks }
 *     from 'src/core/observability/livingContinuityDevHooks.js';
 *
 *   installLivingContinuityHooks();   // idempotent, SSR-safe
 *
 *   // From DevTools:
 *   window.__farmContinuity()         // home insight envelope
 *   window.__taskReasoning()          // adaptive task envelope
 *   window.__memoryTrace()            // living memory milestones
 *
 * Each function accepts a one-shot input object (so partner QA can
 * pass synthetic inputs from the console) and falls back to a calm
 * empty envelope when nothing is supplied. They NEVER throw and
 * NEVER write to any store — read-only field debug.
 */

import { buildHomeContinuity }   from '../home/homeContinuityEngine.js';
import { generateAdaptiveTask }  from '../tasks/adaptiveTaskEngine.js';
import { buildLivingMemory }     from '../journal/livingMemoryEngine.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _log(label, payload) {
  try { console.log(label, payload); } catch { /* swallow */ }
}

export function installLivingContinuityHooks() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;

    if (!window.__farmContinuity) {
      window.__farmContinuity = function (input) {
        const v = buildHomeContinuity(_isObj(input) ? input : {});
        _log('[Farroway · Home Continuity]', v);
        return v;
      };
    }

    if (!window.__taskReasoning) {
      window.__taskReasoning = function (input) {
        const v = generateAdaptiveTask(_isObj(input) ? input : {});
        _log('[Farroway · Adaptive Task]', v);
        return v;
      };
    }

    if (!window.__memoryTrace) {
      window.__memoryTrace = function (input) {
        const v = buildLivingMemory(_isObj(input) ? input : {});
        _log('[Farroway · Living Memory]', v);
        return v;
      };
    }

    return true;
  }, false);
}

const _module = { installLivingContinuityHooks };
export default _module;
