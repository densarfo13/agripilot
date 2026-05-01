/**
 * Terms — minimal /terms route required for App Store submission.
 * Same reasoning as PrivacyPolicy: the submission listing needs
 * a Terms URL AND a reachable in-app page. Legal review is
 * required before public release.
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
};

export default function Terms() {
  useTranslation();

  return (
    <main style={STYLES.page} data-screen="terms-of-use">
      <h1 style={STYLES.h1}>{tStrict('terms.title', 'Terms of Use')}</h1>
      <p style={STYLES.meta}>
        {tStrict('terms.lastUpdated', 'Last updated: pre-launch draft. Review with legal before public release.')}
      </p>

      <p style={STYLES.p}>
        {tStrict(
          'terms.intro',
          'By installing and using Farroway you agree to the terms below. If you do not agree, please uninstall the app. The team will publish the final version before App Store submission.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('terms.h.useOfApp', 'Use of the app')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'terms.body.useOfApp',
          'Farroway is provided "as is" for personal and small-farm use. We do our best to keep the app accurate, but agriculture is variable; you remain responsible for the decisions you make on your farm or garden.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('terms.h.fundingDisclaimer', 'Funding and program information')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'terms.body.fundingDisclaimer',
          'The Funding Hub shows publicly-available program information. Farroway does not guarantee eligibility, approval, funding amounts, or program availability. Always verify requirements with the official program before applying.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('terms.h.userContent', 'Your content')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'terms.body.userContent',
          'Photos, farm profiles, and feedback you submit remain yours. By using the app, you grant Farroway permission to display your content back to you and (for any content you explicitly send the support team) to use it to help solve your issue.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('terms.h.changes', 'Changes')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'terms.body.changes',
          'We may update these terms as Farroway evolves. Material changes will be announced inside the app before they take effect.'
        )}
      </p>

      <h2 style={STYLES.h2}>{tStrict('terms.h.contact', 'Contact')}</h2>
      <p style={STYLES.p}>
        {tStrict(
          'terms.body.contact',
          'For questions about these terms, reach us at support@farroway.app.'
        )}
      </p>
    </main>
  );
}
