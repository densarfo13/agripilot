/**
 * PrivacyPolicy — minimal /privacy route required for App Store
 * submission. The submission process needs a privacy URL on the
 * App Store Connect listing AND a reachable in-app surface for
 * users to read it.
 *
 * The wording here is a starter — the legal team should review
 * before public launch. Until then, the document covers the
 * categories the App Store privacy nutrition label asks about:
 *
 *   • Location           — used for region UX + weather
 *   • Camera / photos    — used for crop scans (stored on device)
 *   • Analytics          — anonymised event log
 *   • Account data       — email + farm profile
 *
 * No PII collection beyond the explicit account profile fields
 * happens client-side; the analytics store carries flag values,
 * context strings, and free-text the user typed themselves.
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

export default function PrivacyPolicy() {
  useTranslation();

  return (
    <main style={STYLES.page} data-screen="privacy-policy">
      <h1 style={STYLES.h1}>{tStrict('privacy.title', 'Privacy Policy')}</h1>
      <p style={STYLES.meta}>
        {tStrict('privacy.lastUpdated', 'Last updated: pre-launch draft. Review with legal before public release.')}
      </p>

      <p style={STYLES.p}>
        {tStrict(
          'privacy.intro',
          'Farroway is a farming companion app. This page summarises what data we collect, why we collect it, and how it is stored. The full text below is a starter draft; the team will publish the final version on the App Store listing before submission.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('privacy.h.location', 'Location')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'privacy.body.location',
          'Farroway uses your country and (when you allow it) coarse device location to tailor regional guidance and weather. You can refuse location at any time and choose your country manually. We do not sell your location.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('privacy.h.camera', 'Camera and photos')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'privacy.body.camera',
          'Crop and plant photos are captured for the scan feature. Photos remain on your device unless you choose to share one with the support team. We never upload photos in the background.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('privacy.h.analytics', 'Analytics')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'privacy.body.analytics',
          'We record anonymised events (page views, button taps, feedback responses) so we can improve the app. The local event log lives on your device and can be cleared from Settings. No personally-identifying information is included in event payloads.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('privacy.h.account', 'Account data')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'privacy.body.account',
          'When you create an account, we store your email address, farm profile (crop, size, country), and any feedback you choose to send. We never share account data with third parties for advertising.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('privacy.h.contact', 'Contact')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'privacy.body.contact',
          'For privacy questions, reach us at support@farroway.app.'
        )}
      </p>
    </main>
  );
}
