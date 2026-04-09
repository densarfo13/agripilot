import React from 'react';

/**
 * EmptyState — consistent empty/placeholder for lists, tables, and cards.
 *
 * Props:
 *   icon       — emoji or icon string (default: 📋)
 *   title      — heading text (required)
 *   message    — description text
 *   action     — { label, onClick } for primary CTA button
 *   secondaryAction — { label, onClick } for secondary action
 *   compact    — smaller variant for inline use
 *   variant    — 'default' | 'success' | 'warning' for color theming
 */
export default function EmptyState({ icon = '📋', title, message, action, secondaryAction, compact, variant = 'default' }) {
  const btnBg = variant === 'success' ? 'var(--success)'
    : variant === 'warning' ? 'var(--warning)'
    : 'var(--primary)';

  return (
    <div style={{
      textAlign: 'center',
      padding: compact ? '1.5rem 1rem' : '2.5rem 1.5rem',
      color: 'var(--subtext)',
    }}>
      <div style={{ fontSize: compact ? '1.5rem' : '2rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{
        fontWeight: 600,
        fontSize: compact ? '0.9rem' : '1rem',
        color: 'var(--text)',
        marginBottom: message ? '0.35rem' : action ? '0.75rem' : 0,
      }}>{title}</div>
      {message && (
        <div style={{
          fontSize: compact ? '0.8rem' : '0.875rem',
          lineHeight: 1.5,
          maxWidth: '360px',
          margin: '0 auto',
          marginBottom: action ? '1rem' : 0,
        }}>{message}</div>
      )}
      {(action || secondaryAction) && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {action && (
            <button
              className="btn btn-primary"
              onClick={action.onClick}
              style={{ background: btnBg }}
            >{action.label}</button>
          )}
          {secondaryAction && (
            <button
              className="btn btn-outline"
              onClick={secondaryAction.onClick}
            >{secondaryAction.label}</button>
          )}
        </div>
      )}
    </div>
  );
}
