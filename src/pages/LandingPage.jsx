/**
 * LandingPage — Farroway public marketing page (v3 brand).
 *
 * Mounted at `/welcome` (see App.jsx). Audience: NGOs,
 * governments, foundations, agriculture programs evaluating
 * Farroway for a 90-day pilot. The farmer-facing app lives
 * behind auth on /dashboard etc — this page never collects
 * farm data, only inquiries.
 *
 * Section order (matches the v3 marketing spec):
 *   1.  Header (logo + nav + "Run a 90-Day Pilot" CTA)
 *   2.  Hero
 *   3.  How It Works
 *   4.  Connect Farmers to Buyers
 *   5.  Unlock Funding & Measurable Impact
 *   6.  Built for Global Farmers
 *   7.  Run a 90-Day Pilot (open / global, NOT Ghana-specific)
 *   8.  Why Partners Choose Farroway
 *   9.  The Impact We Create Together
 *   10. Final CTA
 *   11. Footer
 *
 * Strict-rule audit
 *   * No Ghana-specific pilot wording — "Built to scale
 *     globally" is the geo line, the pilot section talks
 *     about "your farmers" / "1 or more regions" only.
 *   * Tagline = the v3 phrase verbatim, sourced from
 *     `FARROWAY_BRAND.tagline`. Old taglines never appear.
 *   * Logo via the central `FarrowayLogo` component so the
 *     mark stays in lockstep with the rest of the app.
 *   * Pure marketing surface — no router hooks, no auth
 *     calls. Drops in / out without affecting routing.
 *   * Mobile-first responsive via `landing-*` classes — see
 *     RESPONSIVE_CSS at the bottom of this file.
 */

import { useState } from 'react';
import FarrowayLogo from '../components/FarrowayLogo.jsx';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

/* ─── Header ─────────────────────────────────────── */
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: '#how-it-works', label: 'How it works' },
    { href: '#buyers',       label: 'Buyers'       },
    { href: '#impact',       label: 'Impact'       },
    { href: '#global',       label: 'Global'       },
    { href: '#pilot',        label: 'Pilot'        },
  ];

  return (
    <header style={S.header}>
      <div style={S.headerInner}>
        <a href="/" style={S.logoLink} aria-label="Farroway home">
          <FarrowayLogo size={28} variant="onLight" />
        </a>

        <nav className="landing-desktop-nav" style={S.desktopNav}>
          {links.map((l) => (
            <a key={l.href} href={l.href} style={S.navLink}>{l.label}</a>
          ))}
        </nav>

        <a href="#pilot" className="landing-header-cta" style={S.headerCta}>
          Run a 90-Day Pilot
        </a>

        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="landing-hamburger"
          style={S.hamburger}
          aria-label="Toggle menu"
        >
          <span style={S.hamburgerLine} />
          <span style={S.hamburgerLine} />
          <span style={S.hamburgerLine} />
        </button>
      </div>

      {menuOpen && (
        <div style={S.mobileMenu}>
          {links.map((l) => (
            <a key={l.href} href={l.href} style={S.mobileMenuLink}
               onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="#pilot" style={S.mobileMenuCta}
             onClick={() => setMenuOpen(false)}>
            Run a 90-Day Pilot
          </a>
        </div>
      )}
    </header>
  );
}

/* ─── Hero ────────────────────────────────────────── */
function HeroSection() {
  const badges = [
    'Pilot-ready',
    'Impact you can measure',
    'Built to scale globally',
  ];

  return (
    <section style={S.hero}>
      <div style={S.sectionInner}>
        <div className="landing-hero-split">
          <div>
            <div style={S.heroBadge}>
              <FarrowayLogo size={20} variant="onLight" iconOnly />
              <span>Farroway</span>
            </div>

            <h1 style={S.heroTitle}>
              Help farmers take the right actions —{' '}
              <span style={S.heroTitleAccent}>every day.</span>
            </h1>

            <p style={S.heroSub}>
              {FARROWAY_BRAND.subTagline}
            </p>

            <div className="landing-btn-row" style={{ marginTop: '1.75rem' }}>
              <a href="#pilot"          style={S.btnPrimary}>Run a 90-Day Pilot</a>
              <a href="#how-it-works"   style={S.btnOutline}>See How It Works</a>
            </div>

            <div style={S.trustRow}>
              {badges.map((b) => (
                <span key={b} style={S.trustChip}>
                  <span style={S.trustDot} />
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div className="landing-hero-mockup" style={S.heroMockup}>
            <div style={S.mockupPhone}>
              <div style={S.mockupScreen}>
                <div style={S.mockupHeader}>
                  <FarrowayLogo size={16} variant="onDark" />
                </div>
                <div style={S.mockupTagline}>
                  Today&rsquo;s Task
                </div>
                <div style={S.mockupTaskCard}>
                  <strong>Prepare rows for maize</strong>
                  <div style={S.mockupTaskNote}>
                    Why it matters: good rows improve plant
                    growth and yield.
                  </div>
                </div>
                <div style={S.mockupTask}>&#10003; Plant maize — Row 3</div>
                <div style={S.mockupTask}>&#9711; Apply fertilizer</div>
                <div style={S.mockupWeather}>
                  26°C — Light rain expected
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    {
      icon: '✅',
      title: 'Daily Tasks',
      desc:  'Clear actions for today.',
    },
    {
      icon: '🌦️',
      title: 'Weather Alerts',
      desc:  'Real-time updates you can trust.',
    },
    {
      icon: '📈',
      title: 'Track Progress',
      desc:  'Measure impact that matters.',
    },
  ];

  return (
    <section id="how-it-works" className="landing-section" style={S.sectionWhite}>
      <div style={S.sectionInner}>
        <p style={S.sectionLabel}>How it works</p>
        <h2 style={S.sectionHeading}>Three things, every day</h2>

        <div className="landing-grid-3" style={{ marginTop: '2rem' }}>
          {steps.map((s) => (
            <div key={s.title} style={S.howCard}>
              <div style={S.howIcon} aria-hidden="true">{s.icon}</div>
              <h3 style={S.howTitle}>{s.title}</h3>
              <p  style={S.howDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Connect Farmers to Buyers ───────────────────── */
function BuyerSupportSection() {
  const items = [
    'Connects farmers to verified buyers',
    'Matches based on location, crop, and harvest readiness',
    'Buyers get notified when produce is ready',
    'Fairer prices, faster sales, stronger income',
  ];

  return (
    <section id="buyers" className="landing-section" style={S.sectionLight}>
      <div style={S.sectionInner}>
        <p style={S.sectionLabel}>Connect farmers to buyers</p>
        <h2 style={S.sectionHeading}>Better market access. Better income.</h2>

        <div className="landing-grid-2" style={{ marginTop: '2rem' }}>
          <div style={S.cardStack}>
            {items.map((item) => (
              <div key={item} style={S.bulletCard}>
                <span style={S.checkMarkGreen}>&#10003;</span>
                <span>{item}</span>
              </div>
            ))}
            <a href="#pilot" style={{ ...S.btnPrimary, marginTop: '0.75rem',
                                      alignSelf: 'flex-start' }}>
              Support Market Access
            </a>
          </div>

          <div style={S.buyerVisual}>
            <div style={S.buyerCard}>
              <div style={S.buyerCardLabel}>Buyer match</div>
              <div style={S.buyerCardCrop}>Maize — 1.2t ready</div>
              <div style={S.buyerCardMeta}>
                Verified buyer · Within 30km · Notified
              </div>
              <div style={S.buyerCardCta}>Confirmed</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Unlock Funding & Measurable Impact ──────────── */
function FundingSection() {
  const items = [
    'Track real impact data',
    'Generate reports for donors',
    'Strengthen grant applications',
    'Monitor program performance',
  ];

  return (
    <section id="funding" className="landing-section" style={S.sectionWhite}>
      <div style={S.sectionInner}>
        <p style={S.sectionLabel}>Funding & impact reporting</p>
        <h2 style={S.sectionHeading}>
          Unlock funding &amp; measurable impact
        </h2>
        <p style={S.sectionLead}>Stronger programs. More funding.</p>

        <div className="landing-grid-2" style={{ marginTop: '2rem' }}>
          {items.map((item) => (
            <div key={item} style={S.fundingCard}>
              <span style={S.checkMarkGreen}>&#10003;</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <p style={S.fundingFootline}>
          Built for NGOs, governments, and funders.
        </p>
      </div>
    </section>
  );
}

/* ─── Built for Global Farmers ────────────────────── */
function GlobalSection() {
  const items = [
    'Multi-language support',
    'Voice guidance for low-literacy farmers',
    'Region-based crop and weather recommendations',
    'Works across Africa, Asia, and beyond',
    'Simple, local, and scalable',
  ];

  const languages = [
    'English', 'Twi', 'Hausa', 'Kiswahili',
    'Français', 'Hindi', '+ More',
  ];

  return (
    <section id="global" className="landing-section" style={S.sectionLight}>
      <div style={S.sectionInner}>
        <p style={S.sectionLabel}>Built for global farmers</p>
        <h2 style={S.sectionHeading}>Local language. Global impact.</h2>

        <div className="landing-grid-2" style={{ marginTop: '2rem' }}>
          <div style={S.cardStack}>
            {items.map((item) => (
              <div key={item} style={S.bulletCard}>
                <span style={S.checkMarkGreen}>&#10003;</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div style={S.langPanel}>
            <div style={S.langLabel}>Languages on launch</div>
            <div style={S.langChipRow}>
              {languages.map((l) => (
                <span key={l} style={S.langChip}>{l}</span>
              ))}
            </div>
            <p style={S.langNote}>
              Language and crop guidance adapt to each farmer&rsquo;s
              region — no manual setup.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Pilot Section (open/global) ─────────────────── */
function PilotSection() {
  const stats = [
    { value: '20–1,000', label: 'farmers' },
    { value: '1+',       label: 'regions' },
    { value: '90',       label: 'days'    },
  ];

  const items = [
    'Farmer onboarding and training',
    'Daily task delivery',
    'Continuous usage tracking',
    'NGO oversight and reporting',
  ];

  return (
    <section id="pilot" className="landing-section" style={S.pilotSection}>
      <div className="landing-pilot-center" style={S.sectionInner}>
        <p style={S.sectionLabelWhite}>Get started</p>
        <h2 style={S.pilotHeading}>Run a 90-day pilot with Farroway</h2>

        <p style={S.pilotDesc}>
          Test with your farmers. Measure real impact.
        </p>

        <div className="landing-pilot-stats" style={S.pilotStatsRow}>
          {stats.map((s) => (
            <div key={s.label} style={S.pilotStat}>
              <div style={S.pilotStatValue}>{s.value}</div>
              <div style={S.pilotStatLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="landing-pilot-items" style={S.pilotList}>
          {items.map((item) => (
            <div key={item} style={S.pilotItem}>
              <span style={S.checkMarkWhite}>&#10003;</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <a href="#cta" style={S.btnPrimaryLg}>Start a 90-Day Pilot</a>
      </div>
    </section>
  );
}

/* ─── Why Partners Choose Farroway ────────────────── */
function PartnerValueSection() {
  const cards = [
    {
      icon: '🗓️',
      title: 'Daily farmer engagement',
      desc:  'Keeps farmers informed and acting every day.',
    },
    {
      icon: '📊',
      title: 'Measurable impact',
      desc:  'Real-time data and reports to track results.',
    },
    {
      icon: '📡',
      title: 'Works offline',
      desc:  'Built for rural areas with low connectivity.',
    },
    {
      icon: '🤝',
      title: 'Market access',
      desc:  'Helps farmers connect to buyers.',
    },
    {
      icon: '💰',
      title: 'Funding visibility',
      desc:  'Supports donor reporting and grant readiness.',
    },
  ];

  return (
    <section className="landing-section" style={S.sectionWhite}>
      <div style={S.sectionInner}>
        <p style={S.sectionLabel}>Why partners choose Farroway</p>
        <h2 style={S.sectionHeading}>What you get on day one</h2>

        <div className="landing-grid-3" style={{ marginTop: '2rem' }}>
          {cards.map((c) => (
            <div key={c.title} style={S.partnerCard}>
              <div style={S.partnerIcon} aria-hidden="true">{c.icon}</div>
              <h3 style={S.partnerTitle}>{c.title}</h3>
              <p  style={S.partnerDesc}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Impact section ──────────────────────────────── */
function ImpactSection() {
  const items = [
    'Improved farmer productivity',
    'Higher farmer income',
    'Better food security',
    'Stronger communities',
    'Greater climate resilience',
  ];

  return (
    <section id="impact" className="landing-section" style={S.sectionLight}>
      <div style={S.sectionInner}>
        <p style={S.sectionLabel}>The impact we create together</p>
        <h2 style={S.sectionHeading}>Outcomes farmers and partners feel</h2>

        <div className="landing-grid-3" style={{ marginTop: '2rem' }}>
          {items.map((item) => (
            <div key={item} style={S.impactCard}>
              <span style={S.checkMarkGreen}>&#10003;</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* Honesty disclosure: any % yield claim is presented
            as a pilot TARGET, never a guarantee. */}
        <div style={S.pilotTargetCallout}>
          <span style={S.pilotTargetLabel}>Pilot target</span>
          <span style={S.pilotTargetText}>
            20–30% productivity improvement over baseline,
            measured during the 90-day program.
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ───────────────────────────────────── */
function FinalCTASection() {
  return (
    <section id="cta" style={S.sectionDark}>
      <div style={{ ...S.sectionInner, textAlign: 'center' }}>
        <h2 style={S.sectionHeadingDark}>Ready to see how it works?</h2>
        <p style={S.finalCtaSub}>
          We&rsquo;ll walk you through the dashboard, onboarding flow,
          and the 90-day pilot plan.
        </p>

        <div className="landing-btn-row"
             style={{ marginTop: '1.5rem',
                      alignItems: 'center', justifyContent: 'center' }}>
          <a href="mailto:partnership@farroway.app?subject=Pilot%20Request"
             style={S.btnPrimary}>
            Run a 90-Day Pilot
          </a>
          <a href="mailto:partnership@farroway.app?subject=Demo%20Request"
             style={S.btnOutlineLight}>
            Request Demo
          </a>
        </div>

        <p style={S.finalTagline}>{FARROWAY_BRAND.tagline}</p>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────── */
function Footer() {
  return (
    <footer style={S.footer}>
      <div style={S.footerInner} data-fw-footer-grid="1">
        <div style={S.footerBrandBlock}>
          <FarrowayLogo size={28} variant="onDark" />
          <p style={S.footerTagline}>{FARROWAY_BRAND.tagline}</p>
          <p style={S.footerDescription}>
            A daily decision engine for farmers.
          </p>
        </div>

        <div style={S.footerCol}>
          <div style={S.footerColLabel}>Contact</div>
          <a href="mailto:partnership@farroway.app" style={S.footerLink}>
            partnership@farroway.app
          </a>
          <a href="mailto:info@farroway.app" style={S.footerLink}>
            info@farroway.app
          </a>
          <a href="https://www.farroway.app" style={S.footerLink}>
            www.farroway.app
          </a>
          <a href="tel:+12402781437" style={S.footerLink}>
            +1 240 278 1437
          </a>
        </div>

        <div style={S.footerCol}>
          <div style={S.footerColLabel}>Programs</div>
          <a href="#pilot"   style={S.footerLink}>90-Day Pilot</a>
          <a href="#buyers"  style={S.footerLink}>Buyer Support</a>
          <a href="#funding" style={S.footerLink}>Funding & Reporting</a>
          <a href="#global"  style={S.footerLink}>Global Languages</a>
        </div>
      </div>

      <div style={S.footerBottom}>
        <span style={S.footerCopy}>
          &copy; {new Date().getFullYear()} Farroway. All rights reserved.
        </span>
      </div>
    </footer>
  );
}

/* ─── Page ────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div style={S.page}>
      <Header />
      <HeroSection />
      <HowItWorksSection />
      <BuyerSupportSection />
      <FundingSection />
      <GlobalSection />
      <PilotSection />
      <PartnerValueSection />
      <ImpactSection />
      <FinalCTASection />
      <Footer />
    </div>
  );
}

/* ─── Responsive helper ───────────────────────────── */
const RESPONSIVE_CSS = `
  /* ── Mobile (base) ── */
  .landing-grid-2 { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  .landing-grid-3 { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  .landing-grid-4 { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  .landing-btn-row { display: flex; flex-direction: column; gap: 0.75rem; }
  .landing-desktop-nav { display: none; }
  .landing-header-cta { display: none; }
  .landing-hamburger { display: flex; }
  .landing-hero-split { display: block; }
  .landing-hero-mockup { display: none; }
  .landing-pilot-center { text-align: left; }
  .landing-pilot-items { display: flex; flex-direction: column; }
  .landing-pilot-stats { display: flex; flex-direction: row; gap: 1.25rem; flex-wrap: wrap; justify-content: flex-start; }
  .landing-section { padding-top: 3rem; padding-bottom: 3rem; }

  /* ── Tablet (768px) ── */
  @media (min-width: 768px) {
    .landing-grid-2 { grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .landing-grid-3 { grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem; }
    .landing-grid-4 { grid-template-columns: 1fr 1fr; }
    .landing-btn-row { flex-direction: row; }
    .landing-desktop-nav { display: flex; }
    .landing-header-cta { display: inline-flex; }
    .landing-hamburger { display: none; }
    .landing-section { padding-top: 4rem; padding-bottom: 4rem; }
  }

  /* ── Desktop (1024px) ── */
  @media (min-width: 1024px) {
    .landing-grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
    .landing-hero-split {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 3rem;
      align-items: center;
    }
    .landing-hero-mockup { display: flex; justify-content: center; }
    .landing-pilot-center { text-align: center; display: flex; flex-direction: column; align-items: center; }
    .landing-pilot-items { display: flex; flex-direction: row; gap: 2rem; justify-content: center; flex-wrap: wrap; }
    .landing-pilot-stats { justify-content: center; gap: 3rem; }
    .landing-section { padding-top: 5rem; padding-bottom: 5rem; }
  }
`;

if (typeof document !== 'undefined') {
  const id = 'farroway-landing-css';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = RESPONSIVE_CSS;
    document.head.appendChild(style);
  }
}

/* ────────────────────────────────────────────────── */
/* ─── STYLES ─────────────────────────────────────── */
/* ────────────────────────────────────────────────── */

const GREEN       = C.green;       // #22C55E
const GREEN_LIME  = C.lightGreen;  // #A3E635
const NAVY        = C.navy;        // #0B1220
const NAVY_PANEL  = C.darkPanel;   // #111A2E
const WHITE       = C.white;       // #FFFFFF
const GREEN_DARK  = '#15803D';
const GREEN_TINT  = '#F0FDF4';
const GRAY        = '#475569';
const GRAY_DARK   = '#1E293B';
const GRAY_SOFT   = '#64748B';
const GRAY_LIGHT  = '#F8FAFC';
const BORDER      = '#E2E8F0';

const S = {
  page: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", '
              + 'Roboto, sans-serif',
    color: NAVY,
    background: WHITE,
    minHeight: '100vh',
    overflowX: 'hidden',
  },

  /* ─── Header ─────────────────────────── */
  header: {
    position: 'sticky', top: 0, zIndex: 50,
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderBottom: `1px solid ${BORDER}`,
  },
  headerInner: {
    maxWidth: '76rem', margin: '0 auto',
    padding: '0 1.25rem', height: '3.75rem',
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoLink: { display: 'inline-flex', alignItems: 'center',
              textDecoration: 'none' },
  desktopNav: { alignItems: 'center', gap: '1.75rem',
                fontSize: '0.9375rem' },
  navLink: { color: GRAY, textDecoration: 'none',
             fontWeight: 500 },
  headerCta: {
    alignItems: 'center', justifyContent: 'center',
    borderRadius: '10px', background: GREEN, color: WHITE,
    padding: '0.55rem 1.125rem', fontSize: '0.9375rem',
    fontWeight: 700, textDecoration: 'none', border: 'none',
  },
  hamburger: { background: 'none', border: 'none',
               cursor: 'pointer', padding: '0.5rem',
               flexDirection: 'column', gap: '4px' },
  hamburgerLine: { display: 'block', width: '20px',
                   height: '2px', background: NAVY,
                   borderRadius: '1px' },
  mobileMenu: {
    padding: '0.75rem 1.25rem 1rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    borderBottom: `1px solid ${BORDER}`, background: WHITE,
  },
  mobileMenuLink: { color: NAVY, textDecoration: 'none',
                    fontSize: '1rem', fontWeight: 500,
                    padding: '0.5rem 0' },
  mobileMenuCta: {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', borderRadius: '10px',
    background: GREEN, color: WHITE, padding: '0.75rem',
    fontSize: '0.9375rem', fontWeight: 700,
    textDecoration: 'none', textAlign: 'center',
  },

  /* ─── Hero ───────────────────────────── */
  hero: {
    background: `linear-gradient(180deg, ${GREEN_TINT} 0%, ${WHITE} 100%)`,
    padding: '3.5rem 0 3rem',
  },
  sectionInner: { maxWidth: '76rem', margin: '0 auto',
                  padding: '0 1.25rem' },
  heroBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
    background: WHITE, border: `1px solid ${BORDER}`,
    borderRadius: '999px', padding: '0.4rem 0.85rem',
    fontSize: '0.8125rem', fontWeight: 700, color: NAVY,
    marginBottom: '1.25rem',
  },
  heroTitle: {
    fontSize: 'clamp(2rem, 5vw, 3.25rem)',
    fontWeight: 800, lineHeight: 1.08,
    letterSpacing: '-0.02em', margin: 0, color: NAVY,
  },
  heroTitleAccent: { color: GREEN_DARK },
  heroSub: {
    marginTop: '1.25rem', fontSize: '1.0625rem',
    lineHeight: 1.55, color: GRAY, maxWidth: '34rem',
  },
  trustRow: {
    marginTop: '1.75rem', display: 'flex',
    flexWrap: 'wrap', gap: '0.5rem',
  },
  trustChip: {
    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
    background: WHITE, border: `1px solid ${BORDER}`,
    borderRadius: '999px', padding: '0.4rem 0.85rem',
    fontSize: '0.8125rem', fontWeight: 600, color: NAVY,
  },
  trustDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: GREEN,
  },
  heroMockup: { width: '100%' },
  mockupPhone: {
    width: '17rem', height: '34rem',
    background: NAVY, borderRadius: '2rem',
    padding: '0.85rem',
    boxShadow: '0 24px 60px rgba(11,18,32,0.18)',
    border: '8px solid #1F2937',
  },
  mockupScreen: {
    height: '100%', borderRadius: '1.4rem',
    background: NAVY_PANEL, padding: '1rem',
    display: 'flex', flexDirection: 'column', gap: '0.7rem',
    color: WHITE, fontSize: '0.875rem',
  },
  mockupHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  mockupTagline: {
    color: GREEN_LIME, fontSize: '0.75rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  mockupTaskCard: {
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.45)',
    borderRadius: '0.85rem', padding: '0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  mockupTaskNote: { color: 'rgba(255,255,255,0.7)',
                    fontSize: '0.8125rem' },
  mockupTask: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '0.65rem', padding: '0.55rem 0.75rem',
  },
  mockupWeather: {
    marginTop: 'auto', color: 'rgba(255,255,255,0.7)',
    fontSize: '0.8125rem', borderTop: '1px solid rgba(255,255,255,0.08)',
    paddingTop: '0.65rem',
  },

  /* ─── Buttons ────────────────────────── */
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: '0.5rem',
    background: GREEN, color: WHITE,
    padding: '0.85rem 1.4rem', borderRadius: '12px',
    fontWeight: 700, fontSize: '1rem',
    textDecoration: 'none', border: 'none',
    boxShadow: '0 8px 24px rgba(34,197,94,0.25)',
  },
  btnPrimaryLg: {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center',
    background: GREEN, color: WHITE,
    padding: '1rem 1.75rem', borderRadius: '14px',
    fontWeight: 800, fontSize: '1.0625rem',
    textDecoration: 'none', marginTop: '1.75rem',
    boxShadow: '0 10px 28px rgba(34,197,94,0.32)',
  },
  btnOutline: {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center',
    background: WHITE, color: NAVY,
    padding: '0.85rem 1.4rem', borderRadius: '12px',
    fontWeight: 700, fontSize: '1rem',
    textDecoration: 'none', border: `1px solid ${BORDER}`,
  },
  btnOutlineLight: {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent', color: WHITE,
    padding: '0.85rem 1.4rem', borderRadius: '12px',
    fontWeight: 700, fontSize: '1rem',
    textDecoration: 'none',
    border: '1px solid rgba(255,255,255,0.25)',
  },

  /* ─── Section base ───────────────────── */
  sectionWhite: { background: WHITE },
  sectionLight: { background: GRAY_LIGHT },
  sectionDark:  { background: NAVY, color: WHITE,
                  padding: '4.5rem 0' },
  sectionLabel: {
    color: GREEN_DARK, fontSize: '0.8125rem',
    fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.1em', margin: 0,
  },
  sectionLabelWhite: {
    color: GREEN_LIME, fontSize: '0.8125rem',
    fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.1em', margin: 0,
  },
  sectionHeading: {
    fontSize: 'clamp(1.625rem, 3.5vw, 2.25rem)',
    fontWeight: 800, lineHeight: 1.15,
    letterSpacing: '-0.02em',
    margin: '0.5rem 0 0', color: NAVY,
  },
  sectionHeadingDark: {
    fontSize: 'clamp(1.625rem, 3.5vw, 2.25rem)',
    fontWeight: 800, lineHeight: 1.15,
    letterSpacing: '-0.02em',
    margin: 0, color: WHITE,
  },
  sectionLead: {
    color: GRAY, fontSize: '1rem',
    margin: '0.75rem 0 0',
  },

  /* ─── How It Works cards ─────────────── */
  howCard: {
    background: WHITE, border: `1px solid ${BORDER}`,
    borderRadius: '1rem', padding: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
    boxShadow: '0 1px 2px rgba(11,18,32,0.04)',
  },
  howIcon: { fontSize: '1.5rem' },
  howTitle: { margin: 0, fontSize: '1.125rem',
              fontWeight: 800, color: NAVY },
  howDesc:  { margin: 0, color: GRAY, fontSize: '0.9375rem',
              lineHeight: 1.5 },

  /* ─── Buyer Support ──────────────────── */
  cardStack: { display: 'flex', flexDirection: 'column',
               gap: '0.65rem' },
  bulletCard: {
    display: 'flex', alignItems: 'flex-start',
    gap: '0.75rem',
    background: WHITE, border: `1px solid ${BORDER}`,
    borderRadius: '12px', padding: '0.875rem 1rem',
    fontSize: '0.9375rem', color: GRAY_DARK,
  },
  checkMarkGreen: {
    color: GREEN_DARK, fontWeight: 800, flexShrink: 0,
    fontSize: '1rem', lineHeight: 1.3,
  },
  buyerVisual: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', minHeight: '14rem',
  },
  buyerCard: {
    width: '100%', maxWidth: '22rem',
    background: NAVY, color: WHITE,
    borderRadius: '1rem', padding: '1.25rem',
    boxShadow: '0 16px 40px rgba(11,18,32,0.22)',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  buyerCardLabel: { color: GREEN_LIME, fontSize: '0.75rem',
                    fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em' },
  buyerCardCrop: { fontSize: '1.25rem', fontWeight: 800 },
  buyerCardMeta: { color: 'rgba(255,255,255,0.7)',
                   fontSize: '0.875rem' },
  buyerCardCta: {
    marginTop: '0.5rem', alignSelf: 'flex-start',
    background: GREEN, color: WHITE,
    padding: '0.4rem 0.85rem', borderRadius: '999px',
    fontSize: '0.8125rem', fontWeight: 700,
  },

  /* ─── Funding ────────────────────────── */
  fundingCard: {
    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    background: GRAY_LIGHT, border: `1px solid ${BORDER}`,
    borderRadius: '12px', padding: '1rem 1.1rem',
    fontSize: '0.9375rem', color: GRAY_DARK,
  },
  fundingFootline: {
    marginTop: '1.5rem', color: GRAY_SOFT,
    fontSize: '0.9375rem', fontStyle: 'italic',
  },

  /* ─── Global ─────────────────────────── */
  langPanel: {
    background: WHITE, border: `1px solid ${BORDER}`,
    borderRadius: '1rem', padding: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  langLabel: { color: GREEN_DARK, fontSize: '0.75rem',
               fontWeight: 700, textTransform: 'uppercase',
               letterSpacing: '0.1em' },
  langChipRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  langChip: {
    display: 'inline-flex', alignItems: 'center',
    background: GREEN_TINT, color: GREEN_DARK,
    border: `1px solid ${GREEN}`,
    padding: '0.4rem 0.85rem', borderRadius: '999px',
    fontSize: '0.8125rem', fontWeight: 700,
  },
  langNote: { margin: 0, color: GRAY,
              fontSize: '0.875rem', lineHeight: 1.5 },

  /* ─── Pilot Section ──────────────────── */
  pilotSection: {
    background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_PANEL} 100%)`,
    color: WHITE,
  },
  pilotHeading: {
    fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
    fontWeight: 800, lineHeight: 1.15,
    letterSpacing: '-0.02em',
    margin: '0.5rem 0 0', color: WHITE,
  },
  pilotDesc: { color: 'rgba(255,255,255,0.78)',
               fontSize: '1.0625rem', marginTop: '0.85rem' },
  pilotStatsRow: { marginTop: '1.75rem' },
  pilotStat: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '14px', padding: '1rem 1.25rem',
    minWidth: '8rem',
  },
  pilotStatValue: { color: WHITE, fontSize: '1.625rem',
                    fontWeight: 800, lineHeight: 1.1 },
  pilotStatLabel: { color: 'rgba(255,255,255,0.7)',
                    fontSize: '0.8125rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginTop: '0.25rem' },
  pilotList: { marginTop: '1.5rem', gap: '0.75rem' },
  pilotItem: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    color: 'rgba(255,255,255,0.92)', fontSize: '0.9375rem',
  },
  checkMarkWhite: { color: GREEN_LIME, fontWeight: 800 },

  /* ─── Partner Value ──────────────────── */
  partnerCard: {
    background: WHITE, border: `1px solid ${BORDER}`,
    borderRadius: '1rem', padding: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
    boxShadow: '0 1px 2px rgba(11,18,32,0.04)',
  },
  partnerIcon: { fontSize: '1.5rem' },
  partnerTitle: { margin: 0, fontSize: '1.0625rem',
                  fontWeight: 800, color: NAVY },
  partnerDesc: { margin: 0, color: GRAY,
                 fontSize: '0.9375rem', lineHeight: 1.5 },

  /* ─── Impact ─────────────────────────── */
  impactCard: {
    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    background: WHITE, border: `1px solid ${BORDER}`,
    borderRadius: '12px', padding: '1rem 1.1rem',
    fontSize: '0.9375rem', color: GRAY_DARK,
  },
  pilotTargetCallout: {
    marginTop: '2rem',
    background: GREEN_TINT, border: `1px solid ${GREEN}`,
    borderRadius: '14px', padding: '1rem 1.25rem',
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
  },
  pilotTargetLabel: {
    color: GREEN_DARK, fontSize: '0.75rem',
    fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  pilotTargetText: { color: GRAY_DARK, fontSize: '0.9375rem',
                     lineHeight: 1.5 },

  /* ─── Final CTA ──────────────────────── */
  finalCtaSub: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: '1.0625rem',
    marginTop: '0.85rem', textAlign: 'center',
  },
  finalTagline: {
    marginTop: '2rem', color: GREEN_LIME,
    fontSize: '0.9375rem', fontWeight: 700,
    letterSpacing: '0.02em',
  },

  /* ─── Footer ─────────────────────────── */
  footer: { background: NAVY, color: WHITE,
            paddingTop: '3rem' },
  footerInner: {
    maxWidth: '76rem', margin: '0 auto',
    padding: '0 1.25rem',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '2rem',
  },
  footerBrandBlock: {
    display: 'flex', flexDirection: 'column', gap: '0.65rem',
    maxWidth: '24rem',
  },
  footerTagline: {
    margin: 0, color: GREEN_LIME, fontSize: '0.9375rem',
    fontWeight: 600,
  },
  footerDescription: { margin: 0,
                       color: 'rgba(255,255,255,0.7)',
                       fontSize: '0.875rem' },
  footerCol: { display: 'flex', flexDirection: 'column',
               gap: '0.5rem' },
  footerColLabel: {
    color: GREEN_LIME, fontSize: '0.75rem',
    fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: '0.25rem',
  },
  footerLink: { color: 'rgba(255,255,255,0.78)',
                textDecoration: 'none',
                fontSize: '0.9375rem', lineHeight: 1.6 },
  footerBottom: {
    maxWidth: '76rem', margin: '0 auto',
    padding: '1.5rem 1.25rem',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    marginTop: '2.5rem',
  },
  footerCopy: { color: 'rgba(255,255,255,0.55)',
                fontSize: '0.8125rem' },
};

/* ─── Footer responsive — desktop two-up ───────── */
if (typeof document !== 'undefined') {
  const id = 'farroway-landing-footer-css';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @media (min-width: 768px) {
        [data-fw-footer-grid="1"] {
          grid-template-columns: 2fr 1fr 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
