import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client.js';

const ISSUE_TYPES = [
  { value: 'BUG', label: 'Bug' },
  { value: 'DATA_ISSUE', label: 'Data Issue' },
  { value: 'ACCESS_ISSUE', label: 'Access Issue' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request' },
];

export default function ReportIssueButton() {
  const [open, setOpen] = useState(false);
  const [issueType, setIssueType] = useState('BUG');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success'|'error', message }
  const location = useLocation();

  const reset = () => {
    setIssueType('BUG');
    setDescription('');
    setResult(null);
  };

  const handleOpen = () => {
    reset();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    // Clear success message after close
    setTimeout(reset, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    setResult(null);
    try {
      await api.post('/issues', {
        issueType,
        description: description.trim(),
        pageRoute: location.pathname,
      });
      setResult({ type: 'success', message: 'Issue reported successfully. We will review it shortly.' });
      setDescription('');
      // Auto-close after 2.5s on success
      setTimeout(() => setOpen(false), 2500);
    } catch (err) {
      setResult({ type: 'error', message: err.response?.data?.error || 'Failed to submit issue. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={handleOpen}
        title="Report an issue"
        style={styles.fab}
        aria-label="Report Issue"
      >
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>!</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div style={styles.overlay} onClick={handleClose}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>Report an Issue</span>
              <button onClick={handleClose} style={styles.closeBtn}>&times;</button>
            </div>

            {result?.type === 'success' ? (
              <div style={styles.body}>
                <div className="alert-inline alert-inline-success" style={{ textAlign: 'center', justifyContent: 'center' }}>
                  {result.message}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={styles.body}>
                  {result?.type === 'error' && (
                    <div className="alert-inline alert-inline-danger" style={{ marginBottom: '0.75rem' }}>
                      {result.message}
                    </div>
                  )}

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={styles.label}>Issue Type</label>
                    <select
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value)}
                      style={styles.input}
                    >
                      {ISSUE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={styles.label}>Description *</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the issue you're experiencing..."
                      required
                      maxLength={2000}
                      rows={4}
                      style={{ ...styles.input, resize: 'vertical', minHeight: '80px' }}
                      autoFocus
                    />
                    <div style={{ fontSize: '0.72rem', color: '#71717A', textAlign: 'right', marginTop: '0.25rem' }}>
                      {description.length}/2000
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#71717A' }}>
                    Page: <code style={{ color: '#A1A1AA' }}>{location.pathname}</code> (auto-captured)
                  </div>
                </div>

                <div style={styles.footer}>
                  <button type="button" onClick={handleClose} className="btn btn-outline btn-sm">Cancel</button>
                  <button
                    type="submit"
                    disabled={submitting || !description.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    {submitting ? 'Submitting...' : 'Submit Issue'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  fab: {
    position: 'fixed',
    bottom: '1.5rem',
    right: '1.5rem',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: '#F59E0B',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '1.25rem',
    zIndex: 1000,
    transition: 'transform 0.15s',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  },
  modal: {
    background: '#162033',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #243041',
    color: '#FFFFFF',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#A1A1AA',
    fontSize: '1.5rem',
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
  },
  body: {
    padding: '1rem 1.25rem',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    borderTop: '1px solid #243041',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#A1A1AA',
    marginBottom: '0.35rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  input: {
    width: '100%',
    padding: '0.6rem 0.8rem',
    background: '#1E293B',
    border: '1px solid #243041',
    borderRadius: '6px',
    color: '#FFFFFF',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
};
