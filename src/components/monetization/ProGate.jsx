/**
 * ProGate — wraps content that should only render for pro users.
 *
 *   <ProGate feature="advanced_insights">
 *     <AdvancedInsightsPanel ... />
 *   </ProGate>
 *
 * Behaviour
 *   • Pro user OR `monetization` flag off → renders children verbatim.
 *   • Free user with flag on → renders an UpgradePrompt with the
 *     given `feature` tag for analytics.
 *
 * Strict-rule audit
 *   • Pure pass-through component; never throws.
 *   • Never gates onboarding or daily-plan surfaces — those flows
 *     do not import this component.
 */

import { isFeatureEnabled } from '../../config/features.js';
import useUserTier from '../../hooks/useUserTier.js';
import UpgradePrompt from './UpgradePrompt.jsx';

export default function ProGate({ feature = 'pro_feature', children, fallback }) {
  const { isPro } = useUserTier();
  const enforced = isFeatureEnabled('monetization');

  if (!enforced || isPro) {
    return <>{children}</>;
  }
  if (fallback !== undefined) return <>{fallback}</>;

  return <UpgradePrompt context={feature} />;
}
