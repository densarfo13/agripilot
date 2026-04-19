/**
 * HomeShellV2 — the Home screen's visual contract. Consumes a
 * payload from `buildHomePayload` and renders it with the five
 * fixed regions from the spec:
 *
 *   A. short header (welcome.line1 + welcome.line2)
 *   B. ONE dominant state/task card (card.title)
 *   C. one short why line                  (card.why)
 *   D. one primary CTA                     (card.cta)
 *   E. lightweight progress line           (progress.summary)
 *
 * Secondary items (My Farm / Tasks / Progress / Find best crop)
 * are rendered by the caller BELOW this shell. The shell itself
 * strictly owns the above-the-fold layout so nothing can sneak
 * a competing card in.
 */

export default function HomeShellV2({
  payload = null,
  onCta = null,
  renderAfterCard = null,
  renderProgressAccessory = null,
  className = '',
  style: styleOverride = null,
}) {
  if (!payload || !payload.card) {
    return (
      <section
        className={`home-shell home-shell--empty ${className}`.trim()}
        style={styleOverride || wrapStyle}
      >
        <p style={{ color: '#90a4ae' }}>Loading…</p>
      </section>
    );
  }

  const { welcome, card, progress, displayMode, reminder } = payload;
  const ctaBg = card.level === 'low' ? '#78909c' : '#1b5e20';

  return (
    <section
      className={`home-shell home-shell--${card.variant} home-shell--${displayMode} ${className}`.trim()}
      style={styleOverride || wrapStyle}
      data-display-mode={displayMode}
      data-variant={card.variant}
      data-level={card.level || 'medium'}
      data-reminder={reminder ? 'true' : 'false'}
    >
      {/* ───────── A. Welcome header ───────── */}
      <header style={headerStyle}>
        <h1 style={line1Style}>{welcome?.line1 || '—'}</h1>
        <p style={line2Style}>{welcome?.line2 || ''}</p>
      </header>

      {/* ───────── Confidence prefix (stale / offline) ───────── */}
      {card.confidenceLine && (
        <p style={confidenceLineStyle}>{card.confidenceLine}</p>
      )}

      {/* ───────── B + C. One dominant card ───────── */}
      <article style={cardStyle(card)} role="region" aria-live="polite">
        <div style={cardLabelStyle(card)}>
          {card.variant === 'task' ? '🎯 ' : ''}{card.label}
        </div>
        <h2 style={cardTitleStyle}>{card.title}</h2>

        {card.why && (
          <p style={cardWhyStyle}>
            <strong style={{ marginRight: 4, color: '#37474f' }}>Why:</strong>
            {card.why}
          </p>
        )}

        {card.nextStep && (
          <p style={cardNextStyle}>→ {card.nextStep}</p>
        )}

        {/* ───────── D. Single primary CTA ───────── */}
        {card.cta && (
          <button
            type="button"
            onClick={() => onCta && onCta(card)}
            style={{ ...ctaStyle, background: ctaBg }}
          >
            {card.cta}
          </button>
        )}
      </article>

      {/* Renderer hook for the task engine to insert a small
          accessory (task image, timer, etc.) WITHOUT turning
          the card into a dashboard. */}
      {typeof renderAfterCard === 'function' && renderAfterCard(card)}

      {/* ───────── E. Lightweight progress line ───────── */}
      <footer style={footerStyle}>
        <span style={progressTextStyle} data-variant={progress.variant}>
          {progress.summary}
        </span>
        {typeof renderProgressAccessory === 'function' && renderProgressAccessory(progress)}
      </footer>
    </section>
  );
}

// ─── styles (kept inline; small, static) ─────────────────
const wrapStyle = {
  display: 'flex', flexDirection: 'column', gap: 14,
  maxWidth: 620, margin: '0 auto', padding: '20px 16px 24px',
};

const headerStyle = { display: 'flex', flexDirection: 'column', gap: 2 };
const line1Style = { margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.25, color: '#1b1b1b' };
const line2Style = { margin: 0, fontSize: 14, color: '#546e7a', lineHeight: 1.35 };

const confidenceLineStyle = {
  margin: 0, fontSize: 12, fontStyle: 'italic', color: '#78909c',
};

function cardStyle(card) {
  const highlight =
    card.variant === 'task'       ? '#1b5e20' :
    card.variant === 'stale_safe' ? '#f57c00' :
                                    '#37474f';
  return {
    padding: '16px 16px 14px',
    borderRadius: 14,
    border: `1px solid ${highlight}22`,
    background: '#fff',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    display: 'flex', flexDirection: 'column', gap: 8,
  };
}

function cardLabelStyle(card) {
  const color =
    card.variant === 'task'       ? '#2e7d32' :
    card.variant === 'stale_safe' ? '#e65100' :
                                    '#455a64';
  return {
    fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
    textTransform: 'uppercase', color,
  };
}

const cardTitleStyle = {
  margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: '#1b1b1b',
};

const cardWhyStyle = {
  margin: 0, fontSize: 14, color: '#546e7a', lineHeight: 1.4,
};

const cardNextStyle = {
  margin: '4px 0 0', fontSize: 14, color: '#1b5e20', fontWeight: 600,
};

const ctaStyle = {
  marginTop: 8, padding: '12px 16px', borderRadius: 10,
  border: 0, color: '#fff', fontSize: 16, fontWeight: 700,
  cursor: 'pointer',
};

const footerStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginTop: 2, color: '#78909c', fontSize: 12,
};

const progressTextStyle = { color: '#607d8b' };
