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

// Inline shield — keeps the logo bullet-proof (no <img> load,
// no 404 race, no dark-on-dark transparency failure).
function LogoMark({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={S.logoSvg}
    >
      <defs>
        <linearGradient id="fwLogoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#86EFAC" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
      </defs>
      {/* Shield outline */}
      <path
        d="M16 2 L28 6 V16 C28 23 22 28 16 30 C10 28 4 23 4 16 V6 Z"
        fill="url(#fwLogoGrad)"
        stroke="#052e16"
        strokeWidth="1.25"
      />
      {/* Sprout */}
      <path
        d="M16 22 V13"
        stroke="#052e16" strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 13 C12 13 10 10 10 8 C13 8 16 10 16 13 Z"
        fill="#052e16"
      />
      <path
        d="M16 13 C20 13 22 10 22 8 C19 8 16 10 16 13 Z"
        fill="#052e16"
      />
    </svg>
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
            Launching a smarter farming assistant
          </div>
        </FadeIn>

        <FadeIn delay={60}>
          <h1 style={S.h1}>
            Farming decisions made <span style={S.gradText}>simple</span>,
            from first seed to harvest.
          </h1>
        </FadeIn>

        <FadeIn delay={120}>
          <p style={S.heroSub}>
            Farroway turns crop data, weather, and local practice into a
            daily plan every farmer can follow on a phone — even offline.
            No experience required. No jargon. Just what to do today.
          </p>
        </FadeIn>

        <FadeIn delay={180}>
          <div style={S.ctaRow}>
            <a href="#cta" style={S.ctaPrimary} className="fw-btn-primary">
              Get early access
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
    borderRadius: 8,
    // Subtle green glow ring so the shield reads on the dark bg.
    boxShadow: `0 0 0 4px rgba(34,197,94,0.14)`,
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
