/**
 * GuidanceDisclaimer — the /disclaimer route: Farroway's
 * Agricultural Guidance Disclaimer.
 *
 * A controlled public rollout needs a dedicated, linkable page
 * that states plainly what Farroway's guidance IS and IS NOT.
 * The disclaimer text already appears inline across the scan and
 * funding surfaces; this page is the canonical, full version.
 *
 * Wording rules (project trust rules):
 *   • never claim a confirmed diagnosis
 *   • never guarantee a yield or an income
 *   • chemical treatment → consult a local expert
 *   • critical safety guidance is never monetized
 */

import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';

const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '24px 16px 96px',
    maxWidth: 760,
    margin: '0 auto',
    boxSizing: 'border-box',
    lineHeight: 1.55,
  },
  h1: { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' },
  meta: { margin: '6px 0 24px', fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  h2: { fontSize: 17, fontWeight: 700, color: '#86EFAC', margin: '20px 0 8px' },
  p:  { margin: '0 0 12px', fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  ul: { margin: '0 0 12px 18px', padding: 0, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
};

export default function GuidanceDisclaimer() {
  useTranslation();

  return (
    <main style={STYLES.page} data-screen="guidance-disclaimer">
      <h1 style={STYLES.h1}>
        {tStrict('disclaimer.title', 'Agricultural Guidance Disclaimer')}
      </h1>
      <p style={STYLES.meta}>
        {tStrict('disclaimer.lastUpdated', 'Please read this before relying on any scan result or recommendation.')}
      </p>

      <p style={STYLES.p}>
        {tStrict(
          'disclaimer.intro',
          'Farroway is a farming and gardening companion. It offers helpful guidance based on the photo you take and the information you provide. It is a guide — not a substitute for a qualified agronomist, extension officer, or veterinarian.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('disclaimer.h.scans', 'Scan results are not a diagnosis')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'disclaimer.body.scans',
          'A scan suggests what an issue could possibly or likely be. It never confirms a disease. When confidence is low, Farroway says so and asks you to check more closely. Always inspect the plant yourself, and contact a local expert for anything severe or spreading.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('disclaimer.h.chemicals', 'Chemical and pesticide treatment')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'disclaimer.body.chemicals',
          'Farroway does not prescribe exact chemicals or doses. Any guidance that touches pesticides or chemical treatment tells you to consult a local agricultural expert and to follow the product label. Misused chemicals are dangerous to people, animals, and crops.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('disclaimer.h.outcomes', 'No guarantee of yield or income')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'disclaimer.body.outcomes',
          'Crop suggestions, weather insights, and market information are estimates to help you plan. Farroway does not guarantee a harvest, a yield, or an income. Local conditions, weather, and markets vary and are outside our control.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('disclaimer.h.safety', 'Safety guidance is always free')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'disclaimer.body.safety',
          'Critical safety guidance is never placed behind a payment. If a recommendation affects your safety or your animals’ safety, treat it seriously and seek local help when in doubt.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('disclaimer.h.responsibility', 'Your decisions remain yours')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'disclaimer.body.responsibility',
          'You are responsible for the actions you take on your farm or garden. Use Farroway’s guidance as one input alongside your own experience and local expert advice.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('disclaimer.h.contact', 'Questions')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'disclaimer.body.contact',
          'For questions about Farroway’s guidance, reach us at support@farroway.app.'
        )}
      </p>
    </main>
  );
}
