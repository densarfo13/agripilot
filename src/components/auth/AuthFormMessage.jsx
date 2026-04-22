/**
 * AuthFormMessage — standardised error / success / info banner for
 * auth forms.
 *
 *   <AuthFormMessage tone="error"   message="Invalid email or password" />
 *   <AuthFormMessage tone="success" message="Password reset successful" />
 *   <AuthFormMessage tone="info"    message="Session expired. Please sign in again." />
 *
 * Props:
 *   tone        — 'error' | 'success' | 'info' (default 'error')
 *   message     — string or null. When null/empty, the banner
 *                 renders nothing (so callers can unconditionally
 *                 drop it in without guarding themselves).
 *   role        — override for the aria role (defaults: alert for
 *                 error, status for success/info)
 *   testId      — optional data-testid
 *
 * The component is visual-only — no dismiss button, no animation
 * magic; a caller clears the message by setting state back to ''.
 */

export default function AuthFormMessage({
  tone = 'error',
  message = null,
  role = null,
  testId = null,
} = {}) {
  if (!message) return null;
  const palette = TONE[tone] || TONE.error;
  const ariaRole = role || (tone === 'error' ? 'alert' : 'status');
  return (
    <div
      role={ariaRole}
      style={{
        ...S.wrap,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
      }}
      data-testid={testId || `auth-form-message-${tone}`}
    >
      {message}
    </div>
  );
}

const TONE = {
  error:   { bg: 'rgba(252,165,165,0.1)', border: 'rgba(252,165,165,0.3)', fg: '#FCA5A5' },
  success: { bg: 'rgba(134,239,172,0.1)', border: 'rgba(134,239,172,0.35)', fg: '#86EFAC' },
  info:    { bg: 'rgba(147,197,253,0.1)', border: 'rgba(147,197,253,0.3)', fg: '#BFDBFE' },
};

const S = {
  wrap: {
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    lineHeight: 1.45,
    marginBottom: '0.5rem',
    wordBreak: 'break-word',
  },
};
