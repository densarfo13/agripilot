/**
 * SystemDesignAdvantages — closing reassurance section for the
 * NGO / investor admin dashboard. Seven card-style blocks that
 * describe how the platform produces its numbers, written in
 * confident production-safe language.
 *
 * Pure presentational. No props, no state, no API calls. Mounted
 * once at the bottom of AdminAnalyticsPage so an NGO admin
 * scrolling the dashboard ends on a clear "how this works" beat.
 *
 * i18n
 *   Each card's title + body goes through tSafe(t, key, fallback)
 *   so a translator updating `system.advantages.<n>.title` /
 *   `system.advantages.<n>.body` flows through immediately. The
 *   English fallback is the production copy below.
 */

import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';

const ADVANTAGES = Object.freeze([
  {
    id: 'realtime',
    icon: '\u26A1',          // ⚡
    titleKey: 'system.advantages.realtime.title',
    titleEn:  'Real-Time Performance Intelligence',
    bodyKey:  'system.advantages.realtime.body',
    bodyEn:   'All farmer scores and yield estimates are computed dynamically from live activity, task completion, and farm data. This ensures every insight reflects the most current state without relying on outdated stored values.',
  },
  {
    id: 'scalable',
    icon: '\uD83D\uDE80',    // 🚀
    titleKey: 'system.advantages.scalable.title',
    titleEn:  'Lightweight and Scalable Architecture',
    bodyKey:  'system.advantages.scalable.body',
    bodyEn:   'The platform uses efficient client-side computation for analytics and filtering, enabling fast performance even in low-connectivity environments and at large scale.',
  },
  {
    id: 'unified',
    icon: '\uD83C\uDFAF',    // 🎯
    titleKey: 'system.advantages.unified.title',
    titleEn:  'Unified Farmer Scoring Model',
    bodyKey:  'system.advantages.unified.body',
    bodyEn:   'A single, consistent scoring system evaluates farmer performance across activity, compliance, and engagement. This ensures clarity, comparability, and reliable decision-making.',
  },
  {
    id: 'adaptive',
    icon: '\uD83C\uDF10',    // 🌐
    titleKey: 'system.advantages.adaptive.title',
    titleEn:  'Adaptive Data Coverage',
    bodyKey:  'system.advantages.adaptive.body',
    bodyEn:   'Filters such as country and crop dynamically reflect available farmer data. As new regions and farmers are onboarded, the system automatically expands without requiring manual configuration.',
  },
  {
    id: 'yield',
    icon: '\uD83C\uDF3E',    // 🌾
    titleKey: 'system.advantages.yield.title',
    titleEn:  'Real-Time Yield Estimation',
    bodyKey:  'system.advantages.yield.body',
    bodyEn:   'Expected crop output is calculated using farm size, crop type, and performance score. This provides immediate visibility into production potential for planning and market alignment.',
  },
  {
    id: 'decisionLayer',
    icon: '\uD83E\uDDE9',    // 🧩
    titleKey: 'system.advantages.decisionLayer.title',
    titleEn:  'Zero-Dependency Decision Layer',
    bodyKey:  'system.advantages.decisionLayer.body',
    bodyEn:   'All key insights are derived without requiring additional backend aggregation endpoints, allowing rapid deployment and reduced system complexity.',
  },
  {
    id: 'safety',
    icon: '\uD83D\uDEE1\uFE0F',  // 🛡️
    titleKey: 'system.advantages.safety.title',
    titleEn:  'Production-Safe Data Handling',
    bodyKey:  'system.advantages.safety.body',
    bodyEn:   'The system avoids destructive operations and maintains consistent data structures, ensuring stability across updates and user interactions.',
  },
]);

export default function SystemDesignAdvantages() {
  const { t } = useTranslation();

  return (
    <section style={S.section} data-testid="system-design-advantages">
      <header style={S.head}>
        <h3 style={S.title}>
          {tSafe(t, 'system.advantages.title', 'System Design Advantages')}
        </h3>
        <p style={S.sub}>
          {tSafe(t, 'system.advantages.sub',
            'How the dashboard produces its numbers — built for clarity, speed, and reliability.')}
        </p>
      </header>

      <div style={S.grid}>
        {ADVANTAGES.map((adv, idx) => (
          <article
            key={adv.id}
            style={S.card}
            data-testid={`advantage-${adv.id}`}
          >
            <div style={S.cardHead}>
              <span style={S.iconBox} aria-hidden>{adv.icon}</span>
              <span style={S.index}>{String(idx + 1).padStart(2, '0')}</span>
            </div>
            <h4 style={S.cardTitle}>
              {tSafe(t, adv.titleKey, adv.titleEn)}
            </h4>
            <p style={S.cardBody}>
              {tSafe(t, adv.bodyKey, adv.bodyEn)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

const S = {
  section: {
    background: '#111D2E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '1.25rem 1.125rem',
    color: '#E2E8F0',
    display: 'flex', flexDirection: 'column', gap: '0.875rem',
    marginTop: '1rem',
  },
  head:  { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  title: { margin: 0, fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' },
  sub:   { margin: 0, fontSize: '0.8125rem',
           color: 'rgba(255,255,255,0.55)' },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '0.75rem',
  },

  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '0.875rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    fontSize: '1.25rem',
    lineHeight: 1,
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.25)',
  },
  index: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.06em',
  },
  cardTitle: {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#F8FAFC',
    lineHeight: 1.3,
  },
  cardBody: {
    margin: 0,
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.5,
  },
};
