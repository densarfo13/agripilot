/**
 * AdminPolish.jsx — shared admin UI primitives for a high-credibility
 * first impression.
 *
 * Components:
 *   <MetricCard />       — KPI card with big number + small label
 *   <MetricGrid />       — responsive auto-fit grid of MetricCards
 *   <SoftBanner />       — calm info banner (replaces loud red)
 *   <AdminEmptyState />  — reassuring empty state card
 *   <SectionHeader />    — consistent section heading
 *
 * Design principles (spec §§1-5):
 *   • one primary focal area at a time
 *   • metrics: 2rem numbers, 0.75rem labels, consistent height
 *   • calm neutral tones; loud red reserved for true blocking errors
 *   • frosted-glass dark cards matching the existing Farroway theme
 *   • keyboard + screen reader safe — roles + aria where relevant
 *
 * No new dependencies; uses inline styles to match the rest of the
 * admin codebase. Intentionally zero logic — drop-in polish.
 */

import React from 'react';

// ─── Metric card ─────────────────────────────────────────────────
const TONES = Object.freeze({
  neutral: { border: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.04)', num: '#EAF2FF' },
  info:    { border: 'rgba(59,130,246,0.35)',  bg: 'rgba(59,130,246,0.08)', num: '#93C5FD' },
  good:    { border: 'rgba(34,197,94,0.35)',   bg: 'rgba(34,197,94,0.08)',  num: '#86EFAC' },
  warn:    { border: 'rgba(245,158,11,0.35)',  bg: 'rgba(245,158,11,0.08)', num: '#FDE68A' },
  danger:  { border: 'rgba(239,68,68,0.35)',   bg: 'rgba(239,68,68,0.08)',  num: '#FCA5A5' },
});

function toneStyle(tone) { return TONES[tone] || TONES.neutral; }

/**
 * MetricCard — big number, small label, optional delta + hint.
 * Keeps every card the same height (120px) so a row of KPIs never
 * looks jagged.
 */
export function MetricCard({ label, value, hint, tone = 'neutral', testId }) {
  const t = toneStyle(tone);
  return (
    <div
      data-testid={testId || 'metric-card'}
      data-tone={tone}
      style={{
        minHeight: 120, padding: '14px 16px', borderRadius: 14,
        border: `1px solid ${t.border}`, background: t.bg, color: '#EAF2FF',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        boxSizing: 'border-box',
      }}
      role="group"
      aria-label={typeof label === 'string' ? label : undefined}
    >
      <div style={{
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.4,
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '2rem', fontWeight: 700, lineHeight: 1.1,
        color: t.num, letterSpacing: -0.5,
      }}>
        {value}
      </div>
      {hint && (
        <div style={{
          fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)',
          marginTop: 4,
        }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * MetricGrid — responsive row of MetricCards that never collapses
 * awkwardly on tablet widths. 4 across on desktop, 2 on tablet, 1
 * on narrow — by `minmax(180px, 1fr)`.
 */
export function MetricGrid({ children, testId = 'metric-grid' }) {
  return (
    <section
      data-testid={testId}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      {children}
    </section>
  );
}

// ─── Soft banner ─────────────────────────────────────────────────
const BANNER_TONES = Object.freeze({
  info:    { border: 'rgba(59,130,246,0.30)', bg: 'rgba(59,130,246,0.08)', fg: '#BFDBFE' },
  success: { border: 'rgba(34,197,94,0.30)',  bg: 'rgba(34,197,94,0.06)',  fg: '#86EFAC' },
  warn:    { border: 'rgba(245,158,11,0.30)', bg: 'rgba(245,158,11,0.08)', fg: '#FDE68A' },
  // `critical` is the ONLY tone that uses loud red. Reserved for true
  // blocking errors — not for generic API failures.
  critical:{ border: 'rgba(239,68,68,0.40)',  bg: 'rgba(239,68,68,0.08)',  fg: '#FCA5A5' },
});

/**
 * SoftBanner — calm informational banner. Default tone is `info`.
 * Switch to `critical` only for truly blocking issues (auth failure
 * on a page the user must reach, data corruption, etc.). API load
 * failures should use `info` with the fallback copy instead.
 */
export function SoftBanner({ tone = 'info', icon, children, testId, role = 'status' }) {
  const t = BANNER_TONES[tone] || BANNER_TONES.info;
  return (
    <div
      data-testid={testId || 'soft-banner'}
      data-tone={tone}
      role={role}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 12,
        border: `1px solid ${t.border}`, background: t.bg, color: t.fg,
        fontSize: '0.875rem', lineHeight: 1.4,
      }}
    >
      {icon && <span aria-hidden="true" style={{ fontSize: '1rem' }}>{icon}</span>}
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────
/**
 * AdminEmptyState — reassuring contained card for empty tables /
 * zero-result panels. Never leaves a table section looking "broken".
 * Use `tone="positive"` for "everything looks clear" moods;
 * `tone="neutral"` for "no data yet" moods.
 */
export function AdminEmptyState({
  title, body, icon, tone = 'neutral', action, testId,
}) {
  const t = tone === 'positive'
    ? { border: 'rgba(34,197,94,0.25)',  bg: 'rgba(34,197,94,0.04)',  fg: '#86EFAC' }
    : { border: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.03)', fg: 'rgba(255,255,255,0.75)' };
  return (
    <div
      data-testid={testId || 'admin-empty-state'}
      data-tone={tone}
      style={{
        padding: '28px 20px', borderRadius: 14,
        border: `1px solid ${t.border}`, background: t.bg,
        textAlign: 'center', color: t.fg,
      }}
    >
      {icon && (
        <div aria-hidden="true" style={{ fontSize: '1.6rem', marginBottom: 8, opacity: 0.8 }}>
          {icon}
        </div>
      )}
      {title && (
        <div style={{
          fontSize: '1rem', fontWeight: 700, marginBottom: 4, color: '#EAF2FF',
        }}>
          {title}
        </div>
      )}
      {body && (
        <div style={{ fontSize: '0.875rem', maxWidth: 420, margin: '0 auto' }}>
          {body}
        </div>
      )}
      {action && (
        <div style={{ marginTop: 14 }}>{action}</div>
      )}
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────
/**
 * SectionHeader — consistent H3-style heading with a subtle rule.
 * Keeps sections visually separated without stacking heavy borders.
 */
export function SectionHeader({ title, hint, right, testId }) {
  return (
    <header
      data-testid={testId || 'section-header'}
      style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, margin: '22px 0 10px',
      }}
    >
      <div>
        <h3 style={{
          margin: 0, fontSize: '0.95rem', fontWeight: 700,
          letterSpacing: 0.2, color: '#EAF2FF',
        }}>
          {title}
        </h3>
        {hint && (
          <div style={{
            fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)',
            marginTop: 2,
          }}>
            {hint}
          </div>
        )}
      </div>
      {right}
    </header>
  );
}

// ─── Exports ──────────────────────────────────────────────────────
export const _internal = Object.freeze({ TONES, BANNER_TONES });
export default { MetricCard, MetricGrid, SoftBanner, AdminEmptyState, SectionHeader };
