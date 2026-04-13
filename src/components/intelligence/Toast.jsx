import React, { useState, useEffect, useCallback, useRef } from 'react';

const TYPE_CONFIG = {
  success: { color: '#22C55E', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', icon: '\u2713' },
  error: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', icon: '\u2717' },
  info: { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)', icon: '\u2139' },
  warning: { color: '#FBBF24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)', icon: '\u26A0' },
};

const ANIMATION_CSS = `
@keyframes toast-slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

let styleInjected = false;
function injectStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = ANIMATION_CSS;
  document.head.appendChild(style);
  styleInjected = true;
}

export default function Toast({ message, type = 'info', onDismiss, id }) {
  useEffect(() => {
    injectStyle();
  }, []);

  useEffect(() => {
    if (!onDismiss) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;

  return (
    <div style={{ ...S.toast, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <span style={{ ...S.icon, color: cfg.color }}>{cfg.icon}</span>
      <span style={S.message}>{message}</span>
      {onDismiss && (
        <button style={S.dismiss} onClick={onDismiss} aria-label="Dismiss">
          \u2715
        </button>
      )}
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={S.container}>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          onDismiss={() => onDismiss(t.id)}
        />
      ))}
    </div>
  );
}

let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = ++toastIdCounter;
    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      if (next.length > 3) return next.slice(next.length - 3);
      return next;
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);

    return id;
  }, []);

  const toast = toasts.length > 0 ? toasts[toasts.length - 1] : null;

  return { toast, toasts, showToast, dismissToast };
}

const S = {
  container: {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 9999,
    pointerEvents: 'none',
    width: '90%',
    maxWidth: '400px',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '10px',
    backdropFilter: 'blur(8px)',
    pointerEvents: 'auto',
    animation: 'toast-slide-up 0.25s ease-out',
  },
  icon: {
    fontSize: '1.1rem',
    fontWeight: 700,
    flexShrink: 0,
    width: '20px',
    textAlign: 'center',
  },
  message: {
    flex: 1,
    fontSize: '0.875rem',
    color: '#F1F5F9',
    lineHeight: 1.4,
  },
  dismiss: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '4px',
    lineHeight: 1,
    flexShrink: 0,
  },
};
