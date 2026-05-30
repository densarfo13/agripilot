/**
 * src/runtime/adoption/index.ts — wave-39 adoption-readiness
 * barrel. Composes farmer/gardener/NGO/buyer onboarding probes
 * plus the knowledge-coverage probe. Each runtime owns one
 * window.__* global; this barrel only re-exports the surface.
 *
 * The composite verdict is owned by GoLiveHealthRuntime — this
 * barrel never produces a verdict of its own.
 */

export {
  onboardingHealth,
  installOnboardingHealthGlobal,
} from './OnboardingHealthRuntime';
export {
  ONBOARDING_HEALTH_RUNTIME_VERSION,
  type OnboardingHealth,
} from './onboardingHealthContracts';

export {
  ngoOnboardingHealth,
  installNGOOnboardingHealthGlobal,
  NGO_ONBOARDING_HEALTH_RUNTIME_VERSION,
  type NGOOnboardingHealth,
} from './NGOOnboardingHealthRuntime';

export {
  buyerOnboardingHealth,
  installBuyerOnboardingHealthGlobal,
  BUYER_ONBOARDING_HEALTH_RUNTIME_VERSION,
  type BuyerOnboardingHealth,
} from './BuyerOnboardingHealthRuntime';

export {
  knowledgeCoverageHealth,
  installKnowledgeCoverageHealthGlobal,
  KNOWLEDGE_COVERAGE_HEALTH_RUNTIME_VERSION,
  KNOWLEDGE_TARGETS,
  type KnowledgeCoverageHealth,
} from './KnowledgeCoverageHealthRuntime';

/**
 * installAdoptionGlobals — installs all four wave-39 globals in a
 * single call. Idempotent. Returns true iff EVERY install succeeded.
 */
export function installAdoptionGlobals(): boolean {
  let ok = true;
  try {
    const o = require('./OnboardingHealthRuntime');
    if (typeof o.installOnboardingHealthGlobal === 'function') {
      ok = !!o.installOnboardingHealthGlobal() && ok;
    }
  } catch { ok = false; }
  try {
    const n = require('./NGOOnboardingHealthRuntime');
    if (typeof n.installNGOOnboardingHealthGlobal === 'function') {
      ok = !!n.installNGOOnboardingHealthGlobal() && ok;
    }
  } catch { ok = false; }
  try {
    const b = require('./BuyerOnboardingHealthRuntime');
    if (typeof b.installBuyerOnboardingHealthGlobal === 'function') {
      ok = !!b.installBuyerOnboardingHealthGlobal() && ok;
    }
  } catch { ok = false; }
  try {
    const k = require('./KnowledgeCoverageHealthRuntime');
    if (typeof k.installKnowledgeCoverageHealthGlobal === 'function') {
      ok = !!k.installKnowledgeCoverageHealthGlobal() && ok;
    }
  } catch { ok = false; }
  return ok;
}
