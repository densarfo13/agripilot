import { useState } from 'react';

/* ─── Header ─────────────────────────────────────── */
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header style={S.header}>
      <div style={S.headerInner}>
        <a href="/" style={S.logo}>Farroway</a>

        {/* Desktop nav */}
        <nav className="landing-desktop-nav" style={S.desktopNav}>
          <a href="#how-it-works" style={S.navLink}>How it works</a>
          <a href="#why-farroway" style={S.navLink}>Why Farroway</a>
          <a href="#pilot" style={S.navLink}>Pilot</a>
        </nav>

        <a href="#demo" className="landing-header-cta" style={S.headerCta}>Request Demo</a>

        {/* Mobile hamburger */}
        <button
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
          <a href="#how-it-works" style={S.mobileMenuLink} onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#why-farroway" style={S.mobileMenuLink} onClick={() => setMenuOpen(false)}>Why Farroway</a>
          <a href="#pilot" style={S.mobileMenuLink} onClick={() => setMenuOpen(false)}>Pilot</a>
          <a href="#demo" style={S.mobileMenuCta} onClick={() => setMenuOpen(false)}>Request Demo</a>
        </div>
      )}
    </header>
  );
}

/* ─── Hero ────────────────────────────────────────── */
function HeroSection() {
  return (
    <section style={S.hero}>
      <div style={S.sectionInner}>
        <div className="landing-hero-split">
          <div>
            <div style={S.heroBadge}>Farroway</div>

            <h1 style={S.heroTitle}>
              Know what to do. Grow better.
            </h1>

            <p style={S.heroSub}>
              Simple daily guidance for farmers. Real-time visibility for organizations.
            </p>

            <div className="landing-btn-row" style={{ marginTop: '1.75rem' }}>
              <a href="#pilot" style={S.btnPrimary}>Run a 90-day pilot</a>
              <a href="#demo" style={S.btnOutline}>Request Demo</a>
            </div>

            <p style={S.trustLine}>
              Works with low-literacy farmers. Built for real field conditions.
            </p>
          </div>

          <div className="landing-hero-mockup" style={S.heroMockup}>
            <div style={S.mockupPhone}>
              <div style={S.mockupScreen}>
                <div style={S.mockupHeader}>Farroway</div>
                <div style={S.mockupTask}>&#10003; Plant maize — Row 3</div>
                <div style={S.mockupTask}>&#9711; Apply fertilizer</div>
                <div style={S.mockupTask}>&#9711; Check irrigation</div>
                <div style={S.mockupWeather}>26°C — Light rain expected</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Problem ─────────────────────────────────────── */
function ProblemSection() {
  const items = [
    'Manual tracking is slow and inconsistent',
    'Reports are incomplete or inaccurate',
    'Field activity is hard to verify',
    'Data arrives too late to act',
  ];

  return (
    <section className="landing-section" style={S.sectionWhite}>
      <div style={S.sectionInner}>
        <p style={S.sectionLabel}>The problem</p>
        <h2 style={S.sectionHeading}>Tracking farmers shouldn't be this hard</h2>

        <div className="landing-grid-2" style={{ marginTop: '1.5rem' }}>
          {items.map((item) => (
            <div key={item} style={S.problemCard}>
              <span style={S.problemDot} />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <p style={S.closingLine}>
          You don't really know what is happening on the ground.
        </p>
      </div>
    </section>
  );
}

/* ─── Solution ────────────────────────────────────── */
function SolutionSection() {
  return (
    <section className="landing-section" style={S.sectionLight}>
      <div style={S.sectionInner}>
        <p style={S.sectionLabel}>The solution</p>
        <h2 style={S.sectionHeading}>A simple system that works in the field</h2>

        <div className="landing-grid-2" style={{ marginTop: '1.5rem' }}>
          <div style={S.solutionCard}>
            <h3 style={S.solutionCardTitle}>For farmers</h3>
            <p style={S.solutionCardText}>
              Farroway helps farmers know what to do every day, record their work, and submit updates with photos.
            </p>
          </div>
          <div style={S.solutionCard}>
            <h3 style={S.solutionCardTitle}>For organizations</h3>
            <p style={S.solutionCardText}>
              Verify activity, track progress in real time, and generate reliable reports across your entire program.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    { num: '1', title: 'Farmer sets up farm', desc: 'Location, crop, and basic details.' },
    { num: '2', title: 'Farmer adds updates', desc: 'Daily tasks, photos, and progress notes.' },
    { num: '3', title: 'Officer verifies activity', desc: 'Field checks confirm real work.' },
    { num: '4', title: 'Admin sees trusted reports', desc: 'Clean, verified data for decisions.' },
  ];

  return (
    <section id="how-it-works" className="landing-section" style={S.sectionWhite}>
      <div style={S.sectionInner}>
        <p style={S.sectionLabel}>How it works</p>
        <h2 style={S.sectionHeading}>Four simple steps</h2>

        <div className="landing-grid-4" style={{ marginTop: '1.5rem' }}>
          {steps.map((step) => (
            <div key={step.num} style={S.stepCard}>
              <div style={S.stepNum}>{step.num}</div>
              <h3 style={S.stepTitle}>{step.title}</h3>
              <p style={S.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Why Farroway ────────────────────────────────── */
function WhyFarrowaySection() {
  const points = [
    'Works with low literacy',
    'Voice + simple interface',
    'Built for weak internet',
    'Offline-first ready',
    'Structured, verifiable data',
    'Easy onboarding',
  ];

  return (
    <section id="why-farroway" className="landing-section" style={S.sectionLight}>
      <div style={S.sectionInner}>
        <p style={S.sectionLabel}>Why Farroway</p>
        <h2 style={S.sectionHeading}>Built for real farmers, not just dashboards</h2>

        <div className="landing-grid-3" style={{ marginTop: '1.5rem' }}>
          {points.map((point) => (
            <div key={point} style={S.whyCard}>
              <span style={S.checkMark}>&#10003;</span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Value for Organizations ─────────────────────── */
function ValueSection() {
  const items = [
    'Track every farmer clearly',
    'Reduce false reporting',
    'Monitor progress in real time',
    'Generate clean reports',
    'Make better funding and program decisions',
  ];

  return (
    <section className="landing-section" style={S.sectionWhite}>
      <div style={S.sectionInner}>
        <div className="landing-value-split">
          <div>
            <p style={S.sectionLabel}>For organizations</p>
            <h2 style={S.sectionHeading}>Turn farmer activity into trusted data</h2>

            <p style={S.valueIntro}>With Farroway, your team can:</p>

            <div style={S.cardStack}>
              {items.map((item) => (
                <div key={item} style={S.valueCard}>
                  <span style={S.checkMarkGreen}>&#10003;</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-value-visual" style={S.valuePlaceholder}>
            <div style={S.dashboardMock}>
              <div style={S.dashRow}><span style={S.dashLabel}>Active farmers</span><span style={S.dashValue}>127</span></div>
              <div style={S.dashRow}><span style={S.dashLabel}>Tasks completed</span><span style={S.dashValue}>842</span></div>
              <div style={S.dashRow}><span style={S.dashLabel}>Verified reports</span><span style={S.dashValue}>96%</span></div>
              <div style={S.dashRow}><span style={S.dashLabel}>Avg. response time</span><span style={S.dashValue}>1.2 days</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Pilot Offer ─────────────────────────────────── */
function PilotSection() {
  const items = [
    '20 to 50 farmers',
    'Guided onboarding',
    'Full support',
    'Real results in weeks',
  ];

  return (
    <section id="pilot" className="landing-section" style={S.pilotSection}>
      <div className="landing-pilot-center" style={S.sectionInner}>
        <p style={S.sectionLabelWhite}>Get started</p>
        <h2 style={S.pilotHeading}>Start with a simple pilot</h2>

        <p style={S.pilotDesc}>
          We help organizations launch quickly with:
        </p>

        <div className="landing-pilot-items" style={S.pilotList}>
          {items.map((item) => (
            <div key={item} style={S.pilotItem}>
              <span style={S.checkMarkWhite}>&#10003;</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <a href="#demo" style={S.btnPrimaryLg}>Start Pilot</a>
      </div>
    </section>
  );
}

/* ─── Final CTA ───────────────────────────────────── */
function FinalCTASection() {
  return (
    <section id="demo" style={S.sectionWhite}>
      <div style={{ ...S.sectionInner, textAlign: 'center' }}>
        <h2 style={S.sectionHeading}>Ready to see how it works?</h2>

        <div className="landing-btn-row" style={{ marginTop: '1.5rem', alignItems: 'center', justifyContent: 'center' }}>
          <a href="mailto:hello@farroways.com?subject=Demo%20Request" style={S.btnPrimary}>
            Request Demo
          </a>
          <a href="mailto:hello@farroways.com?subject=Pilot%20Request" style={S.btnOutline}>
            Start Pilot
          </a>
        </div>

        <p style={S.finalTagline}>
          Know what to do. Grow better.
        </p>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────── */
function Footer() {
  return (
    <footer style={S.footer}>
      <div style={S.footerInner}>
        <div>
          <div style={S.footerBrand}>Farroway</div>
          <div style={S.footerTagline}>Know what to do. Grow better.</div>
        </div>
        <div style={S.footerRight}>
          <a href="mailto:hello@farroways.com" style={S.footerLink}>hello@farroways.com</a>
          <span style={S.footerCopy}>&copy; {new Date().getFullYear()} Farroway</span>
        </div>
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
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <WhyFarrowaySection />
      <ValueSection />
      <PilotSection />
      <FinalCTASection />
      <Footer />
    </div>
  );
}

/* ─── Responsive helper ───────────────────────────── */
const MQ_MD = '@media (min-width: 768px)';

/* Using CSS-in-JS with a <style> tag won't work for media queries in inline styles.
   Instead we use a simple approach: base styles are mobile-first,
   and we inject a small responsive stylesheet. */
const RESPONSIVE_CSS = `
  /* ── Mobile (base) ── */
  .landing-grid-2 { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  .landing-grid-4 { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  .landing-grid-3 { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
  .landing-btn-row { display: flex; flex-direction: column; gap: 0.75rem; }
  .landing-desktop-nav { display: none; }
  .landing-header-cta { display: none; }
  .landing-hamburger { display: flex; }
  .landing-hero-split { display: block; }
  .landing-hero-mockup { display: none; }
  .landing-value-split { display: block; }
  .landing-value-visual { display: none; }
  .landing-pilot-center { text-align: left; }
  .landing-pilot-items { display: flex; flex-direction: column; }
  .landing-section { padding-top: 3rem; padding-bottom: 3rem; }

  /* ── Tablet (768px) ── */
  @media (min-width: 768px) {
    .landing-grid-2 { grid-template-columns: 1fr 1fr; }
    .landing-grid-4 { grid-template-columns: 1fr 1fr; }
    .landing-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
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
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      align-items: center;
    }
    .landing-hero-mockup { display: flex; justify-content: center; }
    .landing-value-split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      align-items: start;
    }
    .landing-value-visual { display: flex; justify-content: center; padding-top: 2.5rem; }
    .landing-pilot-center { text-align: center; display: flex; flex-direction: column; align-items: center; }
    .landing-pilot-items { display: flex; flex-direction: row; gap: 2rem; justify-content: center; flex-wrap: wrap; }
    .landing-section { padding-top: 5rem; padding-bottom: 5rem; }
  }
`;

/* Inject responsive stylesheet once */
if (typeof document !== 'undefined') {
  const id = 'farroway-landing-css';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = RESPONSIVE_CSS;
    document.head.appendChild(style);
  }
}

/* ─── Rewrite components to use class-based responsive grids ── */

/* We need to override the grid/button containers to use classes.
   Let's refactor the components above to reference className.
   Since inline styles don't support media queries, the grid/button
   containers use className for responsive behavior. */

/* ────────────────────────────────────────────────── */
/* ─── STYLES ─────────────────────────────────────── */
/* ────────────────────────────────────────────────── */

const GREEN = '#16A34A';
const GREEN_DARK = '#15803D';
const GREEN_LIGHT = '#F0FDF4';
const DARK = '#111827';
const GRAY = '#6B7280';
const GRAY_LIGHT = '#F9FAFB';
const BORDER = '#E5E7EB';
const WHITE = '#FFFFFF';

const S = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: DARK,
    background: WHITE,
    minHeight: '100vh',
    overflowX: 'hidden',
  },

  /* Header */
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderBottom: `1px solid ${BORDER}`,
  },
  headerInner: {
    maxWidth: '72rem',
    margin: '0 auto',
    padding: '0 1.25rem',
    height: '3.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: GREEN,
    textDecoration: 'none',
    letterSpacing: '-0.02em',
  },
  desktopNav: {
    alignItems: 'center',
    gap: '2rem',
    fontSize: '0.875rem',
  },
  navLink: {
    color: GRAY,
    textDecoration: 'none',
    fontWeight: 500,
  },
  headerCta: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    background: GREEN,
    color: WHITE,
    padding: '0.5rem 1.125rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    textDecoration: 'none',
    border: 'none',
  },
  hamburger: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.5rem',
    flexDirection: 'column',
    gap: '4px',
  },
  hamburgerLine: {
    display: 'block',
    width: '20px',
    height: '2px',
    background: DARK,
    borderRadius: '1px',
  },
  mobileMenu: {
    padding: '0.75rem 1.25rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    borderBottom: `1px solid ${BORDER}`,
    background: WHITE,
  },
  mobileMenuLink: {
    color: DARK,
    textDecoration: 'none',
    fontSize: '1rem',
    fontWeight: 500,
    padding: '0.5rem 0',
  },
  mobileMenuCta: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    background: GREEN,
    color: WHITE,
    padding: '0.75rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    textDecoration: 'none',
    textAlign: 'center',
  },

  /* Hero */
  hero: {
    background: `linear-gradient(180deg, ${GREEN_LIGHT} 0%, ${WHITE} 100%)`,
    padding: '3rem 0 2.5rem',
  },
  sectionInner: {
    maxWidth: '72rem',
    margin: '0 auto',
    padding: '0 1.25rem',
  },
  heroBadge: {
    display: 'inline-block',
    borderRadius: '9999px',
    background: 'rgba(22,163,74,0.1)',
    border: '1px solid rgba(22,163,74,0.2)',
    padding: '0.25rem 0.875rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: GREEN,
  },
  heroTitle: {
    marginTop: '1.25rem',
    fontSize: 'clamp(1.75rem, 5vw, 3.25rem)',
    fontWeight: 800,
    lineHeight: 1.12,
    color: DARK,
    letterSpacing: '-0.02em',
    maxWidth: '40rem',
  },
  heroSub: {
    marginTop: '1rem',
    fontSize: 'clamp(1rem, 2.5vw, 1.1875rem)',
    lineHeight: 1.55,
    color: GRAY,
    maxWidth: '36rem',
  },
  heroBtnRow: {
    marginTop: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  trustLine: {
    marginTop: '1.25rem',
    fontSize: '0.8125rem',
    color: GRAY,
    fontWeight: 500,
  },

  /* Hero mockup */
  heroMockup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockupPhone: {
    width: '16rem',
    background: WHITE,
    border: `1px solid ${BORDER}`,
    borderRadius: '24px',
    padding: '1.25rem',
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  },
  mockupScreen: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  mockupHeader: {
    fontSize: '1rem',
    fontWeight: 800,
    color: GREEN,
    paddingBottom: '0.5rem',
    borderBottom: `1px solid ${BORDER}`,
  },
  mockupTask: {
    fontSize: '0.8125rem',
    color: DARK,
    fontWeight: 500,
    padding: '0.375rem 0',
  },
  mockupWeather: {
    fontSize: '0.75rem',
    color: GRAY,
    background: GRAY_LIGHT,
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
    marginTop: '0.25rem',
  },

  /* Value dashboard mock */
  valuePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardMock: {
    width: '100%',
    maxWidth: '20rem',
    background: GRAY_LIGHT,
    border: `1px solid ${BORDER}`,
    borderRadius: '16px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  dashRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '0.75rem',
    borderBottom: `1px solid ${BORDER}`,
  },
  dashLabel: {
    fontSize: '0.875rem',
    color: GRAY,
    fontWeight: 500,
  },
  dashValue: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: GREEN_DARK,
  },

  /* Buttons */
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    background: GREEN,
    color: WHITE,
    padding: '0.9375rem 1.5rem',
    fontWeight: 700,
    fontSize: '1rem',
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'center',
  },
  btnPrimaryLg: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    background: WHITE,
    color: GREEN_DARK,
    padding: '1rem 2rem',
    fontWeight: 700,
    fontSize: '1.0625rem',
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    marginTop: '1.5rem',
    textAlign: 'center',
  },
  btnOutline: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    border: `2px solid ${BORDER}`,
    color: DARK,
    padding: '0.875rem 1.5rem',
    fontWeight: 600,
    fontSize: '1rem',
    textDecoration: 'none',
    background: WHITE,
    cursor: 'pointer',
    textAlign: 'center',
  },

  /* Sections */
  sectionWhite: {
    padding: '3rem 0',
    background: WHITE,
  },
  sectionLight: {
    padding: '3rem 0',
    background: GRAY_LIGHT,
  },
  sectionLabel: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: GREEN,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.5rem',
  },
  sectionLabelWhite: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.5rem',
  },
  sectionHeading: {
    fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
    fontWeight: 800,
    lineHeight: 1.15,
    color: DARK,
    letterSpacing: '-0.01em',
    maxWidth: '36rem',
  },

  /* Problem */
  cardStack: {
    marginTop: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  problemCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    background: WHITE,
    border: `1px solid ${BORDER}`,
    borderRadius: '12px',
    padding: '1rem 1.25rem',
    fontSize: '0.9375rem',
    color: DARK,
    fontWeight: 500,
  },
  problemDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#EF4444',
    flexShrink: 0,
  },
  closingLine: {
    marginTop: '1.25rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: DARK,
    fontStyle: 'italic',
  },

  /* Solution */
  solutionGrid: {
    marginTop: '1.5rem',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1rem',
  },
  solutionCard: {
    background: WHITE,
    border: `1px solid ${BORDER}`,
    borderRadius: '16px',
    padding: '1.5rem',
  },
  solutionCardTitle: {
    fontSize: '1.0625rem',
    fontWeight: 700,
    color: DARK,
    margin: 0,
  },
  solutionCardText: {
    marginTop: '0.5rem',
    fontSize: '0.9375rem',
    lineHeight: 1.55,
    color: GRAY,
  },

  /* Steps */
  stepsGrid: {
    marginTop: '1.5rem',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1rem',
  },
  stepCard: {
    background: WHITE,
    border: `1px solid ${BORDER}`,
    borderRadius: '16px',
    padding: '1.5rem',
  },
  stepNum: {
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: '50%',
    background: GREEN,
    color: WHITE,
    fontWeight: 700,
    fontSize: '0.9375rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    marginTop: '0.875rem',
    fontSize: '1.0625rem',
    fontWeight: 700,
    color: DARK,
  },
  stepDesc: {
    marginTop: '0.375rem',
    fontSize: '0.9375rem',
    color: GRAY,
    lineHeight: 1.5,
  },

  /* Why */
  whyGrid: {
    marginTop: '1.5rem',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.75rem',
  },
  whyCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    background: WHITE,
    border: `1px solid ${BORDER}`,
    borderRadius: '12px',
    padding: '1rem 1.25rem',
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: DARK,
  },
  checkMark: {
    color: GREEN,
    fontWeight: 700,
    fontSize: '1.125rem',
    flexShrink: 0,
  },
  checkMarkGreen: {
    color: GREEN,
    fontWeight: 700,
    fontSize: '1.125rem',
    flexShrink: 0,
  },
  checkMarkWhite: {
    color: WHITE,
    fontWeight: 700,
    fontSize: '1.125rem',
    flexShrink: 0,
  },

  /* Value */
  valueIntro: {
    marginTop: '0.75rem',
    fontSize: '1rem',
    color: GRAY,
  },
  valueCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    background: GRAY_LIGHT,
    border: `1px solid ${BORDER}`,
    borderRadius: '12px',
    padding: '1rem 1.25rem',
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: DARK,
  },

  /* Pilot */
  pilotSection: {
    padding: '3.5rem 0',
    background: GREEN_DARK,
    color: WHITE,
  },
  pilotHeading: {
    fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
    fontWeight: 800,
    lineHeight: 1.15,
    color: WHITE,
    maxWidth: '30rem',
  },
  pilotDesc: {
    marginTop: '0.75rem',
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.75)',
  },
  pilotList: {
    marginTop: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  pilotItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '1rem',
    color: WHITE,
    fontWeight: 500,
  },

  /* Final CTA */
  finalBtnRow: {
    marginTop: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    alignItems: 'center',
  },
  finalTagline: {
    marginTop: '1.5rem',
    fontSize: '0.9375rem',
    color: GRAY,
    fontWeight: 500,
    fontStyle: 'italic',
  },

  /* Footer */
  footer: {
    borderTop: `1px solid ${BORDER}`,
    padding: '2rem 0',
    background: GRAY_LIGHT,
  },
  footerInner: {
    maxWidth: '72rem',
    margin: '0 auto',
    padding: '0 1.25rem',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  footerBrand: {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: GREEN,
  },
  footerTagline: {
    fontSize: '0.8125rem',
    color: GRAY,
    marginTop: '0.25rem',
  },
  footerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.25rem',
  },
  footerLink: {
    fontSize: '0.8125rem',
    color: GRAY,
    textDecoration: 'none',
  },
  footerCopy: {
    fontSize: '0.75rem',
    color: '#9CA3AF',
  },
};
