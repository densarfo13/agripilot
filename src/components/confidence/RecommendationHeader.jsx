/**
 * RecommendationHeader — renders the tier-appropriate headline
 * and subheadline for the recommendation screen based on a
 * confidence object. Drops into any recommendations page to
 * replace a hardcoded string.
 *
 * Usage:
 *   <RecommendationHeader
 *     confidence={recommendationConfidence}
 *     t={t}
 *   />
 *
 * If `t` is not provided, the fallback English strings from
 * confidenceWording.js are used. This keeps the component usable
 * even before i18n keys are added.
 */

import {
  recommendationHeaderKey,
  recommendationSubheaderKey,
} from '../../utils/confidenceWording.js';

function resolve(t, { key, fallback }) {
  if (typeof t !== 'function') return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
}

export default function RecommendationHeader({
  confidence,
  t = null,
  className = '',
  titleTag: TitleTag = 'h2',
  subtitleTag: SubtitleTag = 'p',
}) {
  const header    = recommendationHeaderKey(confidence);
  const subheader = recommendationSubheaderKey(confidence);
  const level     = confidence?.level || 'medium';
  return (
    <div
      className={`recommendation-header recommendation-header--${level} ${className}`.trim()}
      data-confidence-level={level}
    >
      <TitleTag className="recommendation-header__title">
        {resolve(t, header)}
      </TitleTag>
      <SubtitleTag className="recommendation-header__subtitle">
        {resolve(t, subheader)}
      </SubtitleTag>
    </div>
  );
}
