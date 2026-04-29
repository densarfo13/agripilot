/**
 * SmartSuggestionsCard — 2–3 short, decision-relevant hints for the
 * farmer, derived from existing on-page data only. NOT an ML
 * recommender — it's a small rule list that turns
 * stage / readyToSell / score / weather into one-line nudges.
 *
 * Sources (all already loaded by MyFarmPage / its context):
 *   • farm.cropStage / cropStage proximity to harvest
 *   • farm.readyToSell flag (or tasks.readyToSell)
 *   • farm.weather risk
 *   • farm.fundingMatch (optional flag from backend)
 *
 * Output:
 *   Up to 3 cards. Each carries a translated headline, an icon, and
 *   an optional CTA route. Tap navigates via the parent's
 *   `onNavigate(path)` if provided, otherwise via react-router.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { cropLabel } from '../../utils/cropLabel.js';
import { useNavigate } from 'react-router-dom';
import { Lightbulb } from '../icons/lucide.jsx';
import { getSmartSuggestions } from '../../lib/farm/farmFallbacks.js';

const HARVEST_NEAR_STAGES = new Set(['fruiting', 'harvest', 'post_harvest']);

function _interpolate(template, vars) {
  if (!template) return '';
  let out = String(template);
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v == null ? '' : v));
  }
  return out;
}

function _buildSuggestions(farm, lang) {
  const out = [];
  const stage = String(farm?.cropStage || farm?.stage || '').toLowerCase();
  // `crop` is canonical; new code reads only the canonical field.
  const cropName = cropLabel(farm?.crop, lang);
  const readyToSell = farm?.readyToSell === true || farm?.readyForSale === true;
  const weatherHigh = farm?.weather && (farm.weather.risk === 'high' || farm.weather.severe || farm.weather.heavyRain);
  const fundingMatch = farm?.fundingMatch === true || farm?.fundingMatched === true;

  // Per-row icons removed in the bullet-list restyle — the row's
  // ` • ` glyph is the only visual marker. The CTA is preserved
  // (taps still navigate to the right route) but rendered as a
  // tap-the-whole-row affordance to match the visual reference.

  // Rule 1 — harvest-near + crop name → list-for-buyers nudge.
  if (HARVEST_NEAR_STAGES.has(stage)) {
    out.push({
      key: 'harvestReady',
      tone: 'success',
      text: _interpolate(
        tStrict('farm.suggest.harvestReady', ''),
        { crop: cropName },
      ) || '',
      route: '/sell',
    });
  }

  // Rule 2 — already flagged ready to sell.
  if (readyToSell) {
    out.push({
      key: 'listProduce',
      tone: 'success',
      text: tStrict('farm.suggest.listProduce', ''),
      route: '/buyers',
    });
  }

  // Rule 3 — funding match available.
  if (fundingMatch) {
    out.push({
      key: 'fundingMatch',
      tone: 'info',
      text: tStrict('farm.suggest.fundingMatch', ''),
      route: '/opportunities',
    });
  }

  // Rule 4 — high weather risk warning. Always shown last so
  // the positive nudges land first when both are present.
  if (weatherHigh) {
    out.push({
      key: 'weatherRisk',
      tone: 'warn',
      text: tStrict('farm.suggest.weatherRisk', ''),
      route: '/today',
    });
  }

  // Fallback — when nothing else applies, surface a generic
  // "keep tasks current" nudge so the section never goes empty
  // for an active farm.
  if (out.length === 0 && farm) {
    out.push({
      key: 'generic',
      tone: 'info',
      text: tStrict('farm.suggest.generic', ''),
      route: '/tasks',
    });
  }

  return out.slice(0, 3);
}

export default function SmartSuggestionsCard({ farm, lang = 'en', tasks = null, listings = null, fundingMatches = null }) {
  useTranslation();
  const navigate = useNavigate();
  if (!farm) return null;

  // Spec §4: replace the generic single nudge with up to 3
  // contextual suggestions driven by missing-setup signals,
  // ready-to-sell state, and funding matches. The original
  // signal-based rules in `_buildSuggestions` (harvest-near
  // crop-name nudge, weather-risk nudge) stay live — both
  // sources merge here, sorted by priority, capped at 3.
  const ctxSuggestions = getSmartSuggestions(farm, tasks, listings, fundingMatches)
    .map((s) => ({
      key:   s.key,
      tone:  'info',
      // Helper returns { key, fallback, route, priority }; map
      // to the local shape used by the renderer.
      text:  tStrict(s.key, s.fallback),
      route: s.route,
    }))
    .filter((s) => s.text);

  // Layer the legacy rule outputs (harvest-near, weather, etc.)
  // beneath the contextual ones so we don't lose existing
  // behaviour. Topic-dedupe by route so the same destination
  // doesn't show twice.
  const legacy = _buildSuggestions(farm, lang)
    .filter((s) => !ctxSuggestions.some((c) => c.route === s.route));

  const suggestions = [...ctxSuggestions, ...legacy].slice(0, 3);
  if (suggestions.length === 0) return null;

  return (
    <section style={S.card} data-testid="smart-suggestions-card">
      <h2 style={S.title}>
        <Lightbulb size={16} />
        <span style={{ marginLeft: 6 }}>
          {tStrict('farm.suggest.title', '')}
        </span>
      </h2>
      {/* Bullet list — each item tappable to preserve the route
          intent of the original CTA buttons. The visible affordance
          is the dot prefix (matches the visual reference); the
          underlying handler still navigates to the suggestion's
          route, so the data path is unchanged. */}
      <ul style={S.list}>
        {suggestions.map((s) => (
          <li
            key={s.key}
            style={{ ...S.row, color: rowColor(s.tone) }}
            data-suggest={s.key}
            onClick={() => { if (s.route) { try { navigate(s.route); } catch { /* ignore */ } } }}
          >
            <span aria-hidden="true" style={S.bullet}>•</span>
            <span>{s.text || ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function rowColor(tone) {
  if (tone === 'success') return '#86EFAC';
  if (tone === 'warn')    return '#FDE68A';
  return 'rgba(255,255,255,0.85)';
}

const S = {
  card: {
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 12,
    padding: '14px 16px',
    margin: '0 0 12px 0',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
  },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '4px 0',
    fontSize: '0.85rem',
    lineHeight: 1.4,
    cursor: 'pointer',
  },
  bullet: {
    fontWeight: 700,
    flex: '0 0 auto',
  },
};
