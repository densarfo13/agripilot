/**
 * NgoProgramTools — surface for NGO admins / government program
 * managers in the Funding Hub (per spec §8).
 *
 * Tools listed match the spec:
 *   • Create farmer program           → existing /admin route
 *   • Invite farmers                  → existing /admin/users route
 *   • Track farmer activity           → existing /admin route (analytics tab)
 *   • Generate impact report          → existing /admin/impact route
 *   • Request Farroway pilot CTA      → mailto: link with subject pre-filled
 *
 * The CTA is the prominent action; the others are quick-link
 * shortcuts that open in the same tab. Each tool fires a
 * `funding_ngo_tool_clicked` analytics event so the admin tile
 * can surface NGO interest.
 *
 * Strict-rule audit
 *   • Visible labels via tStrict.
 *   • External pilot CTA opens in a new tab + carries `noopener`.
 *   • No new routes — all internal links target existing pages.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackFundingEvent } from '../../analytics/fundingAnalytics.js';

const PILOT_MAILTO = 'mailto:partnerships@farroway.app?subject=Farroway%2090-day%20pilot%20inquiry';

const TOOLS = [
  { id: 'create_program',   labelKey: 'funding.ngo.createProgram',  fallback: 'Create farmer program', path: '/admin' },
  { id: 'invite_farmers',   labelKey: 'funding.ngo.inviteFarmers',  fallback: 'Invite farmers',        path: '/admin/users' },
  { id: 'track_activity',   labelKey: 'funding.ngo.trackActivity',  fallback: 'Track farmer activity', path: '/admin' },
  { id: 'impact_report',    labelKey: 'funding.ngo.impactReport',   fallback: 'Generate impact report', path: '/admin/impact' },
];

const STYLES = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '14px 16px',
    background: 'rgba(168,85,247,0.10)',
    border: '1px solid rgba(168,85,247,0.35)',
    borderRadius: 14,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title:  { margin: 0, fontSize: 14, fontWeight: 700, color: '#D8B4FE', letterSpacing: '0.02em', textTransform: 'uppercase' },
  toolsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 8,
  },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 16px',
    borderRadius: 12,
    background: '#A855F7',
    color: '#0B1D34',
    fontWeight: 700,
    fontSize: 15,
    textDecoration: 'none',
    border: '1px solid rgba(168,85,247,0.6)',
  },
  helper: { margin: 0, fontSize: 12, color: 'rgba(216,180,254,0.85)', lineHeight: 1.4 },
};

export default function NgoProgramTools({ context = {} }) {
  // Subscribe to language change.
  useTranslation();

  const handleClick = (toolId) => () => {
    try {
      trackFundingEvent('funding_ngo_tool_clicked', {
        toolId,
        country:  context.country || null,
        userRole: context.userRole || null,
      });
    } catch { /* never propagate */ }
  };

  const handlePilotClick = () => {
    try {
      trackFundingEvent('funding_pilot_inquiry', {
        source: 'ngo_tools_cta',
        country: context.country || null,
        userRole: context.userRole || null,
      });
    } catch { /* never propagate */ }
  };

  return (
    <section style={STYLES.wrap} data-testid="ngo-program-tools">
      <div style={STYLES.header}>
        <h3 style={STYLES.title}>{tStrict('funding.ngo.title', 'Program Tools')}</h3>
      </div>

      <p style={STYLES.helper}>
        {tStrict(
          'funding.ngo.helper',
          'NGO and program tools to start a pilot, invite farmers, and report impact.'
        )}
      </p>

      <div style={STYLES.toolsRow}>
        {TOOLS.map((tool) => (
          <a
            key={tool.id}
            href={tool.path}
            style={STYLES.toolBtn}
            onClick={handleClick(tool.id)}
            data-testid={`ngo-tool-${tool.id}`}
          >
            <span>{tStrict(tool.labelKey, tool.fallback)}</span>
            <span aria-hidden="true">{'\u2192'}</span>
          </a>
        ))}
      </div>

      <a
        href={PILOT_MAILTO}
        target="_blank"
        rel="noopener noreferrer"
        style={STYLES.cta}
        onClick={handlePilotClick}
        data-testid="ngo-pilot-cta"
      >
        <span aria-hidden="true">{'\uD83D\uDE80'}</span>
        {tStrict('funding.ngo.pilotCta', 'Launch a 90-day farmer impact pilot')}
      </a>
    </section>
  );
}
