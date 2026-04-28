/**
 * Landing — production-ready single-file landing page for Farroway.
 *
 * Route target: mount at `/landing` (or the public root) in your
 * router. Pure UI, no app-side dependencies; drops straight in.
 *
 *   <Route path="/landing" element={<Landing />} />
 *
 * Design notes
 *   • Dark gradient background matching the Farroway app theme
 *     (#0B1D34 → #081423). Green CTA + accents at #22C55E.
 *   • Mobile-first — every section stacks to a single column
 *     below 860 px. Hero + grids reflow at 860 px and 1140 px.
 *   • Smooth scroll via scroll-behavior + in-view fade-in via
 *     IntersectionObserver (graceful fallback when unsupported).
 *   • All imagery is CSS-driven placeholders — no image assets
 *     required, no 404s, no external requests. Drop real webp
 *     assets in later by swapping the `placeholder` helpers.
 *   • Accessible — semantic landmarks (header/main/footer),
 *     aria-labels on every icon-only control, focus-visible ring
 *     on every interactive element, sufficient text contrast.
 */

import { useEffect, useRef, useState } from 'react';

// ──────────────────────────────────────────────────────────────
// Design tokens
// ──────────────────────────────────────────────────────────────
const TOKENS = Object.freeze({
  bgTop:       '#0B1D34',
  bgBottom:    '#040C18',
  surface:     '#111D2E',
  surface2:    '#172740',
  border:      'rgba(255,255,255,0.08)',
  borderStrong:'rgba(255,255,255,0.14)',
  text:        '#EAF2FF',
  textMuted:   '#9FB3C8',
  textDim:     '#6F8299',
  green:       '#22C55E',
  greenSoft:   '#86EFAC',
  greenGlow:   'rgba(34,197,94,0.22)',
});

// ──────────────────────────────────────────────────────────────
// In-view fade hook — applies a visible className when the target
// enters the viewport. Falls back to visible immediately when the
// browser lacks IntersectionObserver.
// ──────────────────────────────────────────────────────────────
function useInView(options = { threshold: 0.15 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, options);
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, inView };
}

// Convenience wrapper that animates children in on-scroll.
function FadeIn({ children, delay = 0, as = 'div', style = null, ...rest }) {
  const { ref, inView } = useInView();
  const Tag = as;
  return (
    <Tag
      ref={ref}
      style={{
        ...(style || {}),
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 520ms ease ${delay}ms, transform 520ms ease ${delay}ms`,
        willChange: 'opacity, transform',
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// Real Farroway shield — base64-encoded from
// /public/icons/logo-shield.png so the bytes ship inside the
// bundle itself. No network request, no service-worker cache to
// miss, no 404 race. This IS the mark that appears across the
// PWA home-screen / apple-touch icon / nav avatar.
const FARROWAY_LOGO_DATA_URL =
  'data:image/png;base64,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';

function LogoMark({ size = 28 }) {
  return (
    <img
      src={FARROWAY_LOGO_DATA_URL}
      alt=""
      width={size}
      height={size}
      decoding="async"
      aria-hidden="true"
      style={{
        ...S.logoSvg,
        width: size,
        height: size,
        // Match the native icon's rounded-square corners when
        // scaled down to a 28 px nav mark.
        borderRadius: Math.round(size * 0.22),
      }}
    />
  );
}

// ──────────────────────────────────────────────────────────────
// Navbar — sticky, collapses to hamburger below 760 px
// ──────────────────────────────────────────────────────────────
function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '#how',      label: 'How it works' },
    { href: '#why',      label: 'Why it matters' },
    { href: '#vision',   label: 'Vision' },
    { href: '#audience', label: 'Who it\u2019s for' },
  ];

  return (
    <header
      style={{
        ...S.nav,
        background: scrolled
          ? 'rgba(7,16,30,0.78)'
          : 'rgba(7,16,30,0.45)',
        borderBottomColor: scrolled
          ? TOKENS.border
          : 'transparent',
        backdropFilter: 'saturate(140%) blur(10px)',
        WebkitBackdropFilter: 'saturate(140%) blur(10px)',
      }}
    >
      <div style={S.navInner}>
        <a href="#top" style={S.logo} aria-label="Farroway home">
          <LogoMark size={28} />
          <span>Farroway</span>
        </a>

        <nav
          className="fw-desktop-nav"
          style={{ ...S.desktopNav, display: 'none' }}
          aria-label="Primary"
        >
          {links.map((l) => (
            <a key={l.href} href={l.href} style={S.navLink}>
              {l.label}
            </a>
          ))}
        </nav>

        <a href="#cta" className="fw-nav-cta" style={S.navCta}>
          Get early access
        </a>

        <button
          type="button"
          className="fw-hamburger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          style={{ ...S.hamburger, display: 'inline-flex' }}
        >
          <span style={{ ...S.hamLine, transform: menuOpen ? 'translateY(6px) rotate(45deg)' : 'none' }} />
          <span style={{ ...S.hamLine, opacity: menuOpen ? 0 : 1 }} />
          <span style={{ ...S.hamLine, transform: menuOpen ? 'translateY(-6px) rotate(-45deg)' : 'none' }} />
        </button>
      </div>

      {menuOpen && (
        <nav style={S.mobileMenu} aria-label="Mobile primary">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              style={S.mobileLink}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <a
            href="#cta"
            style={{ ...S.mobileLink, ...S.mobileLinkCta }}
            onClick={() => setMenuOpen(false)}
          >
            Get early access
          </a>
        </nav>
      )}
    </header>
  );
}

// ──────────────────────────────────────────────────────────────
// Hero — headline, sub, dual CTA, product silhouette
// ──────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section id="top" style={S.hero}>
      <div style={S.heroGlow} aria-hidden="true" />
      <div style={S.heroInner}>
        <FadeIn>
          <div style={S.pill}>
            <span style={S.pillDot} />
            Know what to do. Grow better.
          </div>
        </FadeIn>

        <FadeIn delay={60}>
          <h1 style={S.h1}>
            <span style={S.gradText}>Know what to do.</span> Grow better.
          </h1>
        </FadeIn>

        <FadeIn delay={120}>
          <p style={S.heroSub}>
            Simple daily guidance for farmers. Real-time visibility
            for organizations. Works on a phone, even offline.
          </p>
        </FadeIn>

        <FadeIn delay={180}>
          <div style={S.ctaRow}>
            <a href="#cta" style={S.ctaPrimary} className="fw-btn-primary">
              Run a 90-day pilot
            </a>
            <a href="#how" style={S.ctaGhost} className="fw-btn-ghost">
              See how it works
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={260}>
          <div style={S.trustRow} aria-label="Trust indicators">
            <span style={S.trustItem}>
              <span style={S.trustDot} /> Built for smallholder farmers
            </span>
            <span style={S.trustItem}>
              <span style={S.trustDot} /> Offline-ready
            </span>
            <span style={S.trustItem}>
              <span style={S.trustDot} /> 6 languages on launch
            </span>
          </div>
        </FadeIn>
      </div>

      <FadeIn delay={340} style={S.heroPreviewWrap}>
        <MockPhone />
      </FadeIn>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Feature Section — "What Farroway Does"
// ──────────────────────────────────────────────────────────────
function FeatureSection() {
  const features = [
    { icon: '🌱', title: 'Crop intelligence',
      body: 'Stage-aware guidance for over 30 crops. Knows what your farm needs today and what comes next.' },
    { icon: '🌦️', title: 'Weather-aware tasks',
      body: 'Daily tasks adapt to rain, heat, and dry spells so farmers act ahead of the forecast — not after.' },
    { icon: '🧭', title: 'Offline-first',
      body: 'Works where the signal doesn\u2019t. Plans, tasks and records sync cleanly the moment the phone reconnects.' },
    { icon: '📈', title: 'Yield + value ranges',
      body: 'Conservative estimates with a real currency band so farmers can plan inputs, storage and buyers.' },
    { icon: '🔔', title: 'Right-sized reminders',
      body: 'In-app first, SMS for critical alerts, email where it makes sense. No spam, no missed harvests.' },
    { icon: '🌐', title: 'Built for every farmer',
      body: 'English, Twi, French, Spanish, Portuguese, Swahili on launch — with canonical crop data everyone shares.' },
  ];

  return (
    <Section id="what" eyebrow="What Farroway does" title="A farm-tech toolkit that fits in a pocket">
      <div style={S.featureGrid} className="fw-feature-grid">
        {features.map((f, i) => (
          <FadeIn key={f.title} delay={i * 40}>
            <div style={S.card} className="fw-card">
              <div style={S.featureIcon} aria-hidden="true">{f.icon}</div>
              <h3 style={S.cardTitle}>{f.title}</h3>
              <p style={S.cardBody}>{f.body}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────
// Steps Section — "How It Works"
// ──────────────────────────────────────────────────────────────
function StepsSection() {
  const steps = [
    { n: '01', title: 'Set up your farm in under a minute',
      body: 'Pick your crop, farm size, country. We do the rest — default units, stage durations, local context.' },
    { n: '02', title: 'We build your plan',
      body: 'Daily tasks, weather action, risk signals and harvest timing — all tied to your crop\u2019s lifecycle.' },
    { n: '03', title: 'You act; the plan updates',
      body: 'Mark tasks done or skipped. The system auto-advances stages as time passes and keeps the plan honest.' },
    { n: '04', title: 'Record the harvest',
      body: 'One tap captures what you harvested. Closes the cycle, shows you the value, sets up the next season.' },
  ];

  return (
    <Section id="how" eyebrow="How it works" title="From planting date to paid harvest — step by step">
      <div style={S.stepsGrid} className="fw-steps-grid">
        {steps.map((s, i) => (
          <FadeIn key={s.n} delay={i * 50}>
            <div style={S.stepCard} className="fw-card">
              <div style={S.stepNum}>{s.n}</div>
              <h3 style={S.cardTitle}>{s.title}</h3>
              <p style={S.cardBody}>{s.body}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────
// Impact Section — "Why It Matters" (mobile + scale)
// ──────────────────────────────────────────────────────────────
function ImpactSection() {
  const stats = [
    { k: '500M+', v: 'smallholder farmers feed most of the world' },
    { k: '40%',   v: 'post-harvest losses we can help prevent' },
    { k: '1 phone', v: 'is all you need — no apps to install per crop' },
  ];

  return (
    <Section id="why" eyebrow="Why it matters" title="The next agriculture boom runs on a phone.">
      <p style={S.lede}>
        Most of the world’s farms are small. Most are mobile-first. Most
        are offline half the day. Farroway is built for that reality — not
        the reverse. The tools that work at 500 million farms have to feel
        like a friend: fast, patient, and always on your side.
      </p>

      <div style={S.statsGrid} className="fw-stats-grid">
        {stats.map((s, i) => (
          <FadeIn key={s.k} delay={i * 50}>
            <div style={S.statCard}>
              <div style={S.statK}>{s.k}</div>
              <div style={S.statV}>{s.v}</div>
            </div>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────
// Vision Section — "Platform Vision"
// ──────────────────────────────────────────────────────────────
function VisionSection() {
  const pillars = [
    { title: 'One canonical crop brain',
      body: 'Stage durations, yields, prices, risks — one source of truth every feature reads from. Add a crop once, every part of the app understands it.' },
    { title: 'Farmer-first observability',
      body: 'Everything the farmer sees is explainable. Timeline estimates, risk signals, price bands — each carries its confidence and its "why".' },
    { title: 'Low-bandwidth by design',
      body: 'Offline queues, cached plans, SMS fallback for the critical stuff. Farroway degrades gracefully, not catastrophically.' },
    { title: 'Open to partners',
      body: 'Schools, co-ops, NGOs and commercial operators plug in without forking the app. Canonical keys make integrations honest.' },
  ];

  return (
    <Section id="vision" eyebrow="Platform vision" title="A shared platform for the next generation of farming">
      <div style={S.visionGrid} className="fw-vision-grid">
        {pillars.map((p, i) => (
          <FadeIn key={p.title} delay={i * 50}>
            <div style={S.visionCard} className="fw-card">
              <div style={S.visionTick} aria-hidden="true">✓</div>
              <div>
                <h3 style={S.cardTitle}>{p.title}</h3>
                <p style={S.cardBody}>{p.body}</p>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────
// Audience Section — "Who It's For"
// ──────────────────────────────────────────────────────────────
function AudienceSection() {
  const audiences = [
    { tag: 'Backyard', title: 'Home + hobby plots',
      body: 'Shorter daily plan, softer language, simple unit options. Perfect for a first-time grower on a balcony or back garden.' },
    { tag: 'Small farm', title: 'Family + co-op farms',
      body: 'Balanced guidance, full crop intelligence, harvest tracking that grows season-on-season with the farm.' },
    { tag: 'Commercial', title: 'Operational farms',
      body: 'Logistics-aware tasks, buyer + storage cues, SMS-first alerts for field teams. Scales to multi-farm operators.' },
  ];

  return (
    <Section id="audience" eyebrow="Who it’s for" title="Different farms. One plan that fits each.">
      <div style={S.audGrid} className="fw-aud-grid">
        {audiences.map((a, i) => (
          <FadeIn key={a.tag} delay={i * 50}>
            <div style={S.audCard} className="fw-card">
              <span style={S.audTag}>{a.tag}</span>
              <h3 style={S.cardTitle}>{a.title}</h3>
              <p style={S.cardBody}>{a.body}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────
// Screenshot Section — "Product Preview"
// ──────────────────────────────────────────────────────────────
function ScreenshotSection() {
  const previews = [
    { title: 'Today\u2019s tasks',
      sub: '1 high-priority, 1–2 medium, optional low — never overwhelming.',
      art: 'tasks' },
    { title: 'Crop journey',
      sub: 'Stage, next stage, days remaining — auto-advancing with time.',
      art: 'timeline' },
    { title: 'Harvest wrap-up',
      sub: 'Capture amount + unit. See value estimate in local currency.',
      art: 'harvest' },
  ];

  return (
    <Section id="preview" eyebrow="Product preview" title="Clean on the eyes. Quick on the thumb.">
      <div style={S.shotsGrid} className="fw-shots-grid">
        {previews.map((p, i) => (
          <FadeIn key={p.title} delay={i * 60}>
            <figure style={S.shotFigure} className="fw-card">
              <div style={S.shotFrame} aria-hidden="true">
                <MockCard variant={p.art} />
              </div>
              <figcaption style={S.shotCap}>
                <div style={S.shotTitle}>{p.title}</div>
                <div style={S.shotSub}>{p.sub}</div>
              </figcaption>
            </figure>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────
// CTA Section
// ──────────────────────────────────────────────────────────────
function CTASection() {
  return (
    <section id="cta" style={S.ctaSection}>
      <div style={S.ctaCard}>
        <FadeIn>
          <h2 style={S.ctaTitle}>Ready to try Farroway?</h2>
        </FadeIn>
        <FadeIn delay={80}>
          <p style={S.ctaSub}>
            We’re onboarding farmers, co-ops and partners for the next
            season. Join early access and help shape the tool your farm
            actually needs.
          </p>
        </FadeIn>
        <FadeIn delay={140}>
          <form
            style={S.ctaForm}
            onSubmit={(e) => e.preventDefault()}
            aria-label="Early access email"
          >
            <input
              type="email"
              required
              placeholder="you@farm.example"
              aria-label="Email address"
              style={S.ctaInput}
            />
            <button type="submit" style={S.ctaPrimary} className="fw-btn-primary">
              Request early access
            </button>
          </form>
        </FadeIn>
        <FadeIn delay={200}>
          <p style={S.ctaFine}>
            No spam. One update when your region opens up.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Footer
// ──────────────────────────────────────────────────────────────
function FooterSection() {
  const year = new Date().getFullYear();
  return (
    <footer style={S.footer} role="contentinfo">
      <div style={S.footerInner}>
        <div>
          <a href="#top" style={S.logo} aria-label="Farroway home">
            <span style={S.logoMark} aria-hidden="true" />
            <span>Farroway</span>
          </a>
          <p style={{ ...S.cardBody, marginTop: '0.5rem', maxWidth: '28rem' }}>
            A farming assistant that speaks every farmer’s language — and
            works whether the signal does or not.
          </p>
        </div>

        <div style={S.footerGrid} className="fw-footer-grid">
          <div>
            <div style={S.footerHead}>Product</div>
            <a href="#how" style={S.footerLink}>How it works</a>
            <a href="#preview" style={S.footerLink}>Preview</a>
            <a href="#cta" style={S.footerLink}>Early access</a>
          </div>
          <div>
            <div style={S.footerHead}>Company</div>
            <a href="#vision" style={S.footerLink}>Vision</a>
            <a href="#audience" style={S.footerLink}>Who it’s for</a>
            <a href="mailto:hello@farroway.app" style={S.footerLink}>Contact</a>
          </div>
          <div>
            <div style={S.footerHead}>Legal</div>
            <a href="#top" style={S.footerLink}>Privacy</a>
            <a href="#top" style={S.footerLink}>Terms</a>
          </div>
        </div>
      </div>
      <div style={S.footerBottom}>
        <span>© {year} Farroway. All rights reserved.</span>
        <span style={S.footerBadge}>Built for farmers everywhere.</span>
      </div>
    </footer>
  );
}

// ──────────────────────────────────────────────────────────────
// Section wrapper — consistent spacing + eyebrow / title
// ──────────────────────────────────────────────────────────────
function Section({ id, eyebrow, title, children }) {
  return (
    <section id={id} style={S.section}>
      <div style={S.sectionInner}>
        <FadeIn>
          <div style={S.eyebrow}>{eyebrow}</div>
        </FadeIn>
        <FadeIn delay={60}>
          <h2 style={S.h2}>{title}</h2>
        </FadeIn>
        {children}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// CSS-driven placeholder "phone" mock for the hero
// ──────────────────────────────────────────────────────────────
function MockPhone() {
  return (
    <div style={S.phone} aria-label="Farroway dashboard preview">
      <div style={S.phoneNotch} aria-hidden="true" />
      <div style={S.phoneScreen}>
        <div style={S.phoneBar}>
          <span style={{ ...S.phoneDot, background: TOKENS.green }} />
          Today, ready
        </div>
        <div style={S.phoneCard}>
          <div style={S.phoneCardTitle}>Crop journey</div>
          <div style={S.phoneCardBar}>
            <div style={{ ...S.phoneCardBarFill, width: '62%' }} />
          </div>
          <div style={S.phoneCardRow}>
            <span>Vegetative</span>
            <span style={{ color: TOKENS.greenSoft }}>62%</span>
          </div>
        </div>
        <div style={S.phoneCard}>
          <div style={S.phoneCardTitle}>Today’s task</div>
          <div style={S.phoneCardPill}>High</div>
          <div style={S.phoneCardBody}>Scout rows for pest pressure</div>
          <button style={S.phoneMiniCta} type="button">Mark done</button>
        </div>
        <div style={S.phoneCard}>
          <div style={S.phoneCardTitle}>Harvest ready in</div>
          <div style={S.phoneCardBig}>14 days</div>
        </div>
      </div>
    </div>
  );
}

// Small mock card for the product preview grid — three variants.
function MockCard({ variant }) {
  if (variant === 'tasks') {
    return (
      <div style={S.mockInner}>
        <div style={{ ...S.phoneCardPill, alignSelf: 'flex-start' }}>High</div>
        <div style={S.phoneCardBody}>Scout rows for pest pressure</div>
        <div style={{ height: 8 }} />
        <div style={{ ...S.phoneCardPill, background: 'rgba(253,224,71,0.16)', color: '#FDE68A', borderColor: 'rgba(253,224,71,0.4)', alignSelf: 'flex-start' }}>Medium</div>
        <div style={S.phoneCardBody}>Check soil moisture in 3 spots</div>
      </div>
    );
  }
  if (variant === 'timeline') {
    return (
      <div style={S.mockInner}>
        <div style={S.phoneCardTitle}>Vegetative → Flowering</div>
        <div style={S.phoneCardBar}><div style={{ ...S.phoneCardBarFill, width: '68%' }} /></div>
        <div style={{ ...S.phoneCardRow, marginTop: 6 }}>
          <span style={{ color: TOKENS.textMuted }}>~18 days left</span>
          <span style={{ color: TOKENS.greenSoft }}>68%</span>
        </div>
      </div>
    );
  }
  return (
    <div style={S.mockInner}>
      <div style={S.phoneCardTitle}>Harvest recorded</div>
      <div style={S.phoneCardBig}>50 bags</div>
      <div style={{ color: TOKENS.greenSoft, fontWeight: 700 }}>≈ ₦1,181,250</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Root
// ──────────────────────────────────────────────────────────────
export default function Landing() {
  // Inject CSS for effects that can't be done inline: responsive
  // breakpoints, hover states, focus-visible, smooth scroll.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (document.getElementById('fw-landing-style')) return undefined;
    const style = document.createElement('style');
    style.id = 'fw-landing-style';
    style.textContent = CSS;
    document.head.appendChild(style);
    return undefined;
  }, []);

  return (
    <div style={S.page}>
      <a href="#top" style={S.skipLink} className="fw-skip">
        Skip to content
      </a>
      <Navbar />
      <main>
        <HeroSection />
        <FeatureSection />
        <StepsSection />
        <ImpactSection />
        <VisionSection />
        <AudienceSection />
        <ScreenshotSection />
        <CTASection />
      </main>
      <FooterSection />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Scoped CSS (hover/focus/responsive)
// ──────────────────────────────────────────────────────────────
const CSS = `
  :root { color-scheme: dark; }
  html { scroll-behavior: smooth; }
  .fw-skip {
    position: absolute; left: -9999px; top: auto;
    width: 1px; height: 1px; overflow: hidden;
  }
  .fw-skip:focus {
    position: fixed; left: 1rem; top: 1rem; width: auto; height: auto;
    padding: .5rem .75rem; background: ${TOKENS.green}; color: #000;
    border-radius: 10px; z-index: 100; font-weight: 700;
  }
  a:focus-visible, button:focus-visible, input:focus-visible {
    outline: 2px solid ${TOKENS.green};
    outline-offset: 2px;
    border-radius: 10px;
  }
  .fw-card { transition: transform .22s ease, border-color .22s ease, background .22s ease; }
  .fw-card:hover { transform: translateY(-2px); border-color: ${TOKENS.borderStrong}; }
  .fw-btn-primary { transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; }
  .fw-btn-primary:hover { transform: translateY(-1px); filter: brightness(1.05); box-shadow: 0 14px 30px ${TOKENS.greenGlow}; }
  .fw-btn-primary:active { transform: translateY(0); }
  .fw-btn-ghost { transition: background .18s ease, border-color .18s ease; }
  .fw-btn-ghost:hover { background: rgba(255,255,255,0.04); border-color: ${TOKENS.borderStrong}; }
  .fw-nav-cta { display: none; }
  @media (min-width: 760px) {
    .fw-desktop-nav { display: inline-flex !important; }
    .fw-nav-cta { display: inline-flex; }
    .fw-hamburger { display: none !important; }
  }
  @media (min-width: 860px) {
    .fw-feature-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .fw-steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .fw-vision-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .fw-aud-grid { grid-template-columns: repeat(3, 1fr) !important; }
    .fw-stats-grid { grid-template-columns: repeat(3, 1fr) !important; }
    .fw-shots-grid { grid-template-columns: repeat(3, 1fr) !important; }
    .fw-footer-grid { grid-template-columns: repeat(3, 1fr) !important; }
  }
  @media (min-width: 1140px) {
    .fw-feature-grid { grid-template-columns: repeat(3, 1fr) !important; }
    .fw-steps-grid { grid-template-columns: repeat(4, 1fr) !important; }
  }
  @keyframes fwFloat {
    0%   { transform: translateY(0); }
    50%  { transform: translateY(-6px); }
    100% { transform: translateY(0); }
  }
`;

// ──────────────────────────────────────────────────────────────
// Inline style atoms
// ──────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    color: TOKENS.text,
    background: `radial-gradient(1200px 600px at 20% -10%, rgba(34,197,94,0.14), transparent 60%),
                 radial-gradient(900px 500px at 100% 10%, rgba(37,99,235,0.08), transparent 55%),
                 linear-gradient(180deg, ${TOKENS.bgTop} 0%, ${TOKENS.bgBottom} 100%)`,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif',
    lineHeight: 1.55,
    WebkitFontSmoothing: 'antialiased',
    overflowX: 'hidden',
  },
  skipLink: { /* overridden by .fw-skip */ },

  // ── Nav ────
  nav: {
    position: 'sticky',
    top: 0, zIndex: 40,
    borderBottom: `1px solid transparent`,
    transition: 'background 180ms ease, border-color 180ms ease',
  },
  navInner: {
    maxWidth: '72rem', margin: '0 auto',
    padding: '0.875rem 1rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '1rem',
  },
  logo: {
    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
    color: TOKENS.text, textDecoration: 'none',
    fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.01em',
  },
  logoSvg: {
    display: 'block',
    // The real shield has its own gradient + furrows and reads
    // cleanly on the dark nav/footer. No extra glow ring needed.
  },
  desktopNav: { gap: '1.25rem', alignItems: 'center' },
  navLink: {
    color: TOKENS.textMuted, textDecoration: 'none',
    fontSize: '0.9375rem', fontWeight: 600,
  },
  navCta: {
    padding: '0.5rem 0.875rem', borderRadius: 12,
    background: TOKENS.green, color: '#00130A',
    fontSize: '0.875rem', fontWeight: 800, textDecoration: 'none',
    boxShadow: `0 10px 24px ${TOKENS.greenGlow}`,
  },
  hamburger: {
    width: 40, height: 40, borderRadius: 10,
    border: `1px solid ${TOKENS.border}`,
    background: 'rgba(255,255,255,0.04)',
    color: TOKENS.text, display: 'none',
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: 3, padding: 0,
    cursor: 'pointer',
  },
  hamLine: {
    display: 'block', width: 18, height: 2, borderRadius: 2,
    background: TOKENS.text, transition: 'transform .18s ease, opacity .18s ease',
  },
  mobileMenu: {
    display: 'flex', flexDirection: 'column',
    padding: '0.5rem 1rem 1rem',
    background: 'rgba(7,16,30,0.95)',
    borderTop: `1px solid ${TOKENS.border}`,
  },
  mobileLink: {
    padding: '0.75rem 0.5rem',
    color: TOKENS.text, textDecoration: 'none',
    borderBottom: `1px solid ${TOKENS.border}`,
    fontWeight: 600,
  },
  mobileLinkCta: {
    marginTop: '0.5rem',
    background: TOKENS.green, color: '#00130A',
    borderRadius: 12, borderBottom: 'none',
    textAlign: 'center', fontWeight: 800,
  },

  // ── Hero ────
  hero: {
    position: 'relative',
    padding: '3.5rem 1rem 2rem',
    maxWidth: '72rem', margin: '0 auto',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center',
    gap: '1.25rem', overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute', inset: '-10%',
    background:
      `radial-gradient(600px 280px at 50% 10%, ${TOKENS.greenGlow}, transparent 60%)`,
    filter: 'blur(8px)', pointerEvents: 'none',
  },
  heroInner: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column',
    gap: '1rem', alignItems: 'center', maxWidth: '44rem',
  },
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '0.4rem 0.75rem',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: TOKENS.greenSoft,
    fontSize: '0.8125rem', fontWeight: 700,
    letterSpacing: '0.01em',
  },
  pillDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: TOKENS.green,
    boxShadow: `0 0 12px ${TOKENS.greenGlow}`,
  },
  h1: {
    margin: 0,
    fontSize: 'clamp(2rem, 5.2vw, 3.5rem)',
    lineHeight: 1.1, fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  gradText: {
    background: `linear-gradient(90deg, ${TOKENS.greenSoft}, ${TOKENS.green})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSub: {
    margin: 0, color: TOKENS.textMuted,
    fontSize: 'clamp(1rem, 1.6vw, 1.125rem)',
    maxWidth: '36rem',
  },
  ctaRow: {
    display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center',
    marginTop: '0.25rem',
  },
  ctaPrimary: {
    padding: '0.85rem 1.25rem',
    borderRadius: 14, border: 'none',
    background: TOKENS.green, color: '#00130A',
    fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
    textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
    boxShadow: `0 14px 30px ${TOKENS.greenGlow}`,
    minHeight: 48,
  },
  ctaGhost: {
    padding: '0.85rem 1.25rem',
    borderRadius: 14,
    border: `1px solid ${TOKENS.borderStrong}`,
    background: 'transparent', color: TOKENS.text,
    fontWeight: 700, fontSize: '1rem',
    textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
    minHeight: 48,
  },
  trustRow: {
    display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem',
    justifyContent: 'center',
    color: TOKENS.textDim, fontSize: '0.8125rem',
    marginTop: '0.75rem',
  },
  trustItem: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  trustDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: TOKENS.greenSoft,
  },
  heroPreviewWrap: {
    width: '100%', maxWidth: '24rem', marginTop: '0.5rem',
    display: 'flex', justifyContent: 'center',
  },

  // ── Phone mock ────
  phone: {
    position: 'relative',
    width: '100%', maxWidth: 320,
    aspectRatio: '9 / 19',
    borderRadius: 34,
    background: 'linear-gradient(180deg, #0D1A2D 0%, #060D1A 100%)',
    border: `1px solid ${TOKENS.borderStrong}`,
    boxShadow:
      '0 40px 80px rgba(0,0,0,0.55), 0 0 0 6px rgba(255,255,255,0.03) inset',
    overflow: 'hidden',
    animation: 'fwFloat 6s ease-in-out infinite',
  },
  phoneNotch: {
    position: 'absolute', top: 10, left: '50%',
    transform: 'translateX(-50%)',
    width: 100, height: 18, borderRadius: 12,
    background: '#050A12',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
    zIndex: 2,
  },
  phoneScreen: {
    position: 'absolute', inset: 10,
    borderRadius: 26,
    padding: '2.25rem 0.75rem 1rem',
    display: 'flex', flexDirection: 'column', gap: '0.625rem',
    background:
      `linear-gradient(180deg, ${TOKENS.bgTop} 0%, #0b1627 100%)`,
    border: `1px solid ${TOKENS.border}`,
  },
  phoneBar: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    color: TOKENS.textMuted, fontSize: '0.6875rem',
    padding: '0.25rem 0.5rem',
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${TOKENS.border}`, borderRadius: 999,
  },
  phoneDot: { width: 6, height: 6, borderRadius: '50%' },
  phoneCard: {
    background: TOKENS.surface,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 14,
    padding: '0.75rem 0.875rem',
    display: 'flex', flexDirection: 'column', gap: 6,
    textAlign: 'left',
  },
  phoneCardTitle: {
    fontSize: '0.6875rem', textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: TOKENS.textDim, fontWeight: 700,
  },
  phoneCardBody: { fontSize: '0.9375rem', fontWeight: 700, color: TOKENS.text },
  phoneCardBig: {
    fontSize: '1.5rem', fontWeight: 800, color: TOKENS.text,
  },
  phoneCardBar: {
    width: '100%', height: 6, borderRadius: 999,
    background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  phoneCardBarFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${TOKENS.green}, ${TOKENS.greenSoft})`,
    borderRadius: 999,
  },
  phoneCardRow: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: '0.75rem', color: TOKENS.textMuted,
  },
  phoneCardPill: {
    fontSize: '0.625rem', fontWeight: 800, padding: '0.15rem 0.5rem',
    background: 'rgba(252,165,165,0.12)', color: '#FCA5A5',
    border: '1px solid rgba(252,165,165,0.35)',
    borderRadius: 999, alignSelf: 'flex-start',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  phoneMiniCta: {
    marginTop: 4, padding: '0.5rem 0.625rem',
    borderRadius: 10, border: 'none',
    background: TOKENS.green, color: '#00130A',
    fontWeight: 800, fontSize: '0.75rem', alignSelf: 'flex-start',
    cursor: 'pointer',
  },

  // ── Section ────
  section: { padding: '3rem 1rem' },
  sectionInner: { maxWidth: '72rem', margin: '0 auto' },
  eyebrow: {
    color: TOKENS.greenSoft, fontSize: '0.75rem', fontWeight: 800,
    letterSpacing: '0.16em', textTransform: 'uppercase',
    marginBottom: 8,
  },
  h2: {
    margin: 0,
    fontSize: 'clamp(1.5rem, 3.2vw, 2.25rem)',
    lineHeight: 1.15, fontWeight: 800,
    letterSpacing: '-0.015em',
    maxWidth: '40rem',
    marginBottom: '1.25rem',
  },

  // ── Feature grid ────
  featureGrid: {
    display: 'grid', gap: '1rem', gridTemplateColumns: '1fr',
  },
  card: {
    background: TOKENS.surface,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 18,
    padding: '1.125rem 1.125rem 1.25rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  cardTitle: {
    margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: TOKENS.text,
  },
  cardBody: {
    margin: 0, fontSize: '0.9375rem', color: TOKENS.textMuted, lineHeight: 1.55,
  },
  featureIcon: {
    width: 42, height: 42, borderRadius: 12,
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: TOKENS.greenSoft,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.25rem',
  },

  // ── Steps grid ────
  stepsGrid: {
    display: 'grid', gap: '1rem', gridTemplateColumns: '1fr',
  },
  stepCard: {
    background: TOKENS.surface,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 18, padding: '1.125rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  stepNum: {
    fontSize: '0.75rem', fontWeight: 800,
    color: TOKENS.greenSoft, letterSpacing: '0.1em',
  },

  // ── Impact ────
  lede: {
    margin: '0 0 1.25rem', fontSize: 'clamp(1rem, 1.5vw, 1.125rem)',
    color: TOKENS.textMuted, maxWidth: '44rem',
  },
  statsGrid: {
    display: 'grid', gap: '1rem', gridTemplateColumns: '1fr',
  },
  statCard: {
    background: TOKENS.surface,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 18, padding: '1.25rem',
    textAlign: 'left',
  },
  statK: {
    fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em',
    background: `linear-gradient(90deg, ${TOKENS.greenSoft}, ${TOKENS.green})`,
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  statV: { color: TOKENS.textMuted, fontSize: '0.9375rem', marginTop: '0.25rem' },

  // ── Vision ────
  visionGrid: {
    display: 'grid', gap: '1rem', gridTemplateColumns: '1fr',
  },
  visionCard: {
    background: TOKENS.surface,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 18, padding: '1.125rem',
    display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
  },
  visionTick: {
    flexShrink: 0,
    width: 28, height: 28, borderRadius: 8,
    background: 'rgba(34,197,94,0.16)',
    color: TOKENS.greenSoft,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.875rem', fontWeight: 900,
    border: '1px solid rgba(34,197,94,0.4)',
  },

  // ── Audience ────
  audGrid: {
    display: 'grid', gap: '1rem', gridTemplateColumns: '1fr',
  },
  audCard: {
    background: TOKENS.surface,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 18, padding: '1.125rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  audTag: {
    alignSelf: 'flex-start',
    fontSize: '0.6875rem', fontWeight: 800,
    color: TOKENS.greenSoft,
    padding: '0.25rem 0.5rem', borderRadius: 999,
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
  },

  // ── Screenshots ────
  shotsGrid: {
    display: 'grid', gap: '1rem', gridTemplateColumns: '1fr',
  },
  shotFigure: {
    margin: 0,
    background: TOKENS.surface,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 20, padding: '1rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  shotFrame: {
    background: `linear-gradient(180deg, #0D1A2D 0%, #060D1A 100%)`,
    borderRadius: 16,
    height: 220,
    border: `1px solid ${TOKENS.border}`,
    padding: '1rem',
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
  },
  mockInner: { display: 'flex', flexDirection: 'column', gap: 6 },
  shotCap: {},
  shotTitle: { fontSize: '1rem', fontWeight: 800, color: TOKENS.text },
  shotSub: { fontSize: '0.875rem', color: TOKENS.textMuted },

  // ── CTA ────
  ctaSection: { padding: '3rem 1rem' },
  ctaCard: {
    maxWidth: '44rem', margin: '0 auto',
    background: `linear-gradient(180deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))`,
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 22, padding: '1.5rem',
    textAlign: 'center',
  },
  ctaTitle: {
    margin: 0, fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    fontWeight: 800, letterSpacing: '-0.015em',
  },
  ctaSub: {
    margin: '0.5rem auto 1rem', color: TOKENS.textMuted,
    maxWidth: '32rem',
  },
  ctaForm: {
    display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
    justifyContent: 'center',
  },
  ctaInput: {
    flex: '1 1 220px',
    minHeight: 48, padding: '0 0.875rem',
    borderRadius: 12,
    border: `1px solid ${TOKENS.borderStrong}`,
    background: '#0A1424', color: TOKENS.text,
    fontSize: '1rem',
    outline: 'none',
    colorScheme: 'dark',
  },
  ctaFine: {
    marginTop: '0.75rem', color: TOKENS.textDim, fontSize: '0.8125rem',
  },

  // ── Footer ────
  footer: {
    marginTop: '2rem',
    borderTop: `1px solid ${TOKENS.border}`,
    padding: '2rem 1rem 1rem',
  },
  footerInner: {
    maxWidth: '72rem', margin: '0 auto',
    display: 'grid', gap: '2rem',
    gridTemplateColumns: '1fr',
  },
  footerGrid: {
    display: 'grid', gap: '1.25rem',
    gridTemplateColumns: 'repeat(2, 1fr)',
  },
  footerHead: {
    color: TOKENS.text, fontWeight: 800, marginBottom: '0.5rem',
    fontSize: '0.875rem', letterSpacing: '0.04em',
  },
  footerLink: {
    display: 'block', color: TOKENS.textMuted, textDecoration: 'none',
    padding: '0.25rem 0', fontSize: '0.9375rem',
  },
  footerBottom: {
    maxWidth: '72rem', margin: '1.5rem auto 0',
    borderTop: `1px solid ${TOKENS.border}`,
    padding: '1rem 0',
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
    color: TOKENS.textDim, fontSize: '0.8125rem',
  },
  footerBadge: {
    color: TOKENS.greenSoft, fontWeight: 700,
  },
};
