/**
 * PlantIntelligenceCard.jsx — Daily Briefing plant card.
 *
 *   <PlantIntelligenceCard briefing={composeFullBriefing(...)} />
 *
 * What this is
 * ────────────
 *   The small Home/Today card the spec calls for. Renders the
 *   composeFullBriefing envelope as a calm "3 plants need
 *   attention" surface. Designed to drop into the Today screen
 *   ALONGSIDE existing cards — not to redesign Home.
 *
 *   Self-hides when there's nothing to say.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • Caller-injected data only.
 *   • All copy via tSafe.
 *   • No marketplace / camera / NGO copy.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);

const S = {
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 14,
    padding: '14px 16px',
    margin: '10px 0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  eyebrow: {
    fontSize: 11, fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 4,
  },
  headline: {
    fontSize: 15, fontWeight: 700, color: '#1F2933',
    margin: 0,
  },
  body: {
    fontSize: 13, color: '#64748B',
    marginTop: 6, lineHeight: 1.5,
  },
  list: {
    margin: '8px 0 0', padding: 0, listStyle: 'none',
  },
  item: {
    fontSize: 13, color: '#1F2933',
    padding: '6px 0',
    borderBottom: '1px solid rgba(31,41,51,0.05)',
  },
};

export default function PlantIntelligenceCard({ briefing }) {
  if (!_isObj(briefing)) return null;
  if ((briefing.plantCount || 0) === 0) return null;

  const headline = _isObj(briefing.headline)
    ? briefing.headline : { key: '', def: '' };
  const list = _arr(briefing.plantsNeedingAttention).slice(0, 4);

  return (
    <section style={S.card} data-testid="plant-intelligence-card">
      <div style={S.eyebrow}>
        {tSafe('briefing.plants.eyebrow', 'Plants')}
      </div>
      <h3 style={S.headline}>
        {tSafe(headline.key, headline.def)}
      </h3>
      {list.length > 0 ? (
        <ul style={S.list}>
          {list.map((p) => (
            <li key={p.id} style={S.item}
              data-testid={`plant-intelligence-item-${p.id}`}>
              {p.commonName || tSafe('plant.unknown', 'Unknown plant')}
              {p.lifecycleStage
                ? ' · ' + tSafe('plant.briefing.stage', 'stage') + ' '
                  + p.lifecycleStage
                : ''}
              {typeof p.healthScore === 'number'
                ? ' · ' + tSafe('plant.briefing.health', 'health') + ' '
                  + p.healthScore
                : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p style={S.body}>
          {tSafe('plant.briefing.checkMyPlants',
            'Open My Plants to review.')}
        </p>
      )}
    </section>
  );
}
