/**
 * DataConsent — the /data-consent route: Farroway's Image and
 * Data Consent Notice.
 *
 * A controlled public rollout needs a dedicated, linkable page
 * that states plainly what images and data Farroway captures,
 * where they go, and how the farmer can say no or withdraw.
 * Complements /privacy (the full policy) with a focused,
 * plain-language consent notice.
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

export default function DataConsent() {
  useTranslation();

  return (
    <main style={STYLES.page} data-screen="data-consent">
      <h1 style={STYLES.h1}>
        {tStrict('consent.title', 'Image and Data Consent Notice')}
      </h1>
      <p style={STYLES.meta}>
        {tStrict('consent.lastUpdated', 'This explains what you are agreeing to when you use Farroway.')}
      </p>

      <p style={STYLES.p}>
        {tStrict(
          'consent.intro',
          'Farroway needs some information to work. This notice explains, in plain language, what photos and data are involved, where they go, and how you can decline or withdraw.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('consent.h.photos', 'Photos you take')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'consent.body.photos',
          'When you scan a crop or plant, the photo is used to produce your result. Photos stay on your device. A photo is only sent off your device if you explicitly choose to share it — for example, to attach it to a support request. Farroway never uploads your photos in the background.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('consent.h.dataset', 'Using images to improve Farroway')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'consent.body.dataset',
          'We would like to learn from scans to make results better. Your images are NOT added to any training set or shared outside Farroway without your clear, separate consent. If we ever ask, it will be an explicit opt-in — never hidden in the background.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('consent.h.location', 'Location')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'consent.body.location',
          'Coarse location helps tailor weather and regional guidance. You can decline location and choose your country or region manually instead. Declining does not block the core features.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('consent.h.analytics', 'Activity data')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'consent.body.analytics',
          'Farroway records anonymised activity (screens viewed, actions taken) to find and fix problems. These records carry no personally-identifying information, stay on your device, and can be cleared from the recovery screen.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('consent.h.withdraw', 'Saying no, and withdrawing consent')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'consent.body.withdraw',
          'You can decline camera or location access at any time in your device settings, and clear on-device Farroway data from the recovery screen. To request a copy or deletion of your account data, email support@farroway.app.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('consent.h.related', 'Related pages')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'consent.body.related',
          'See the Privacy Policy for the full data policy, and the Agricultural Guidance Disclaimer for how to read scan results and recommendations.'
        )}
      </p>
    </main>
  );
}
