/**
 * CardFooterBadges — compact badge row showing time-to-complete,
 * difficulty, and used-by count on a FundingCard.
 *
 * Spec coverage (Funding screen V2 §6)
 *   • time to complete
 *   • difficulty badge
 *   • success count
 *
 * Each badge is suppressed when its data is missing — the row
 * never renders an awkward "(unknown)" placeholder. If all three
 * are missing the whole strip returns null.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational. Reads only the props the caller hands
 *     in (no storage / no analytics).
 *   • Conservative wording: "Used by N farmers" rather than a
 *     success-rate claim we cannot verify.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const S = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  difficultyEasy:   { color: '#86EFAC', borderColor: 'rgba(34,197,94,0.45)',  background: 'rgba(34,197,94,0.10)' },
  difficultyMedium: { color: '#FCD34D', borderColor: 'rgba(252,211,77,0.40)', background: 'rgba(252,211,77,0.10)' },
  difficultyHard:   { color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.40)',  background: 'rgba(239,68,68,0.10)' },
  icon: { fontSize: 12, lineHeight: 1 },
};

function _difficultyKey(diff) {
  const v = String(diff || '').toLowerCase();
  if (v === 'easy')   return { key: 'funding.modal.difficulty.easy',   fallback: 'Easy',   tone: S.difficultyEasy   };
  if (v === 'medium') return { key: 'funding.modal.difficulty.medium', fallback: 'Medium', tone: S.difficultyMedium };
  if (v === 'hard')   return { key: 'funding.modal.difficulty.hard',   fallback: 'Hard',   tone: S.difficultyHard   };
  return null;
}

/**
 * @param {object} props
 * @param {string} [props.timeToComplete]   e.g. "~10 minutes"
 * @param {string} [props.difficulty]       'easy' | 'medium' | 'hard'
 * @param {number} [props.successCount]     used-by count; hidden if absent / 0
 * @param {object} [props.style]
 */
export default function CardFooterBadges({
  timeToComplete,
  difficulty,
  successCount,
  style,
}) {
  useTranslation();

  const time = timeToComplete && String(timeToComplete).trim() ? String(timeToComplete) : '';
  const diff = _difficultyKey(difficulty);
  const usedBy = Number(successCount);
  const showUsedBy = Number.isFinite(usedBy) && usedBy > 0;

  if (!time && !diff && !showUsedBy) return null;

  return (
    <div style={{ ...S.row, ...(style || null) }} data-testid="funding-card-footer-badges">
      {time ? (
        <span style={S.badge} data-testid="funding-badge-time">
          <span style={S.icon} aria-hidden="true">{'\u23F1'}</span>
          <span>{time}</span>
        </span>
      ) : null}
      {diff ? (
        <span
          style={{ ...S.badge, ...diff.tone }}
          data-testid="funding-badge-difficulty"
          data-difficulty={String(difficulty).toLowerCase()}
        >
          <span style={S.icon} aria-hidden="true">{'\uD83D\uDCCA'}</span>
          <span>{tStrict(diff.key, diff.fallback)}</span>
        </span>
      ) : null}
      {showUsedBy ? (
        <span style={S.badge} data-testid="funding-badge-used-by">
          <span style={S.icon} aria-hidden="true">{'\uD83D\uDC65'}</span>
          <span>
            {tStrict('funding.card.usedBy', 'Used by {count} farmers')
              .replace('{count}', String(usedBy))}
          </span>
        </span>
      ) : null}
    </div>
  );
}
