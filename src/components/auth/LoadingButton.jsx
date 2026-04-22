/**
 * LoadingButton — submit button with a built-in spinner + disabled
 * state. Used across auth forms to standardise the "signing in…"
 * / "sending code…" pattern.
 *
 *   <LoadingButton loading={submitting} loadingText="Signing in…">
 *     Sign in
 *   </LoadingButton>
 *
 * Props:
 *   loading        — when true, button disables itself, swaps the
 *                    label to `loadingText`, and shows a small
 *                    circular spinner on the left
 *   loadingText    — text shown while loading (default: "Loading…")
 *   disabled       — forwarded to the button; OR-combined with
 *                    loading so callers don't need to re-check
 *   style          — merged onto the base style (keeps caller themes)
 *   testId         — data-testid forwarded to the button
 *   ...rest        — forwarded to <button> (type, onClick, form, …)
 *
 * Guard against double-submit is the caller's responsibility (a
 * simple submittingRef pattern is recommended), but the disabled
 * state here covers the common case where the user clicks twice
 * before state has propagated.
 */

export default function LoadingButton({
  children,
  loading = false,
  loadingText = 'Loading…',
  disabled = false,
  style = null,
  testId = null,
  type = 'submit',
  variant = 'primary',
  ...rest
} = {}) {
  const isDisabled = !!disabled || !!loading;
  const base = variant === 'ghost' ? S.ghostBase : S.base;
  return (
    <button
      type={type}
      disabled={isDisabled}
      style={{
        ...base,
        ...(style || {}),
        ...(isDisabled ? S.disabled : null),
      }}
      data-testid={testId || undefined}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    >
      {loading && <span style={S.spinner} aria-hidden="true" />}
      <span>{loading ? loadingText : children}</span>
    </button>
  );
}

const S = {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    minHeight: '2.75rem',          // 44px mobile-friendly tap target
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    border: 'none',
    background: '#22C55E',
    color: '#000',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'opacity 120ms ease',
  },
  ghostBase: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    minHeight: '2.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9375rem',
    cursor: 'pointer',
  },
  disabled: { opacity: 0.6, cursor: 'not-allowed' },
  spinner: {
    width: '0.9375rem',
    height: '0.9375rem',
    borderRadius: '50%',
    border: '2px solid rgba(0,0,0,0.25)',
    borderTopColor: 'rgba(0,0,0,0.75)',
    animation: 'farrowaySpin 640ms linear infinite',
    display: 'inline-block',
  },
};

// Inject the keyframes once per document. Safe to re-run in hot-reload.
if (typeof document !== 'undefined' && !document.getElementById('farroway-spin-kf')) {
  const style = document.createElement('style');
  style.id = 'farroway-spin-kf';
  style.textContent = '@keyframes farrowaySpin { to { transform: rotate(360deg) } }';
  document.head.appendChild(style);
}
