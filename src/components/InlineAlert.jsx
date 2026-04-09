import React from 'react';

/**
 * InlineAlert — consistent dismissible alert banner.
 *
 * Replaces ad-hoc inline-styled success/error/warning/info messages
 * with a single consistent pattern using CSS classes from index.css.
 *
 * Props:
 *   variant    — 'success' | 'danger' | 'warning' | 'info' (required)
 *   children   — message content
 *   onDismiss  — optional dismiss handler (shows ✕ button)
 *   action     — optional { label, onClick } for inline retry/action button
 *   className  — additional CSS classes
 */
export default function InlineAlert({ variant, children, onDismiss, action, className = '' }) {
  return (
    <div className={`alert-inline alert-inline-${variant} ${className}`}>
      <span style={{ flex: 1 }}>{children}</span>
      {action && (
        <button className="btn btn-outline btn-sm" style={{ flexShrink: 0 }} onClick={action.onClick}>
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button className="alert-dismiss" onClick={onDismiss} aria-label="Dismiss">✕</button>
      )}
    </div>
  );
}
