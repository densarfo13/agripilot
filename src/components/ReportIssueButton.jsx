import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client.js';

const ISSUE_TYPES = [
  { value: 'BUG', label: 'Bug' },
  { value: 'DATA_ISSUE', label: 'Data Issue' },
  { value: 'ACCESS_ISSUE', label: 'Access Issue' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request' },
];

const CATEGORIES = [
  { value: 'BLOCKER', label: 'Blocker — cannot proceed' },
  { value: 'FRICTION', label: 'Friction — slows me down' },
  { value: 'TRUST', label: 'Trust — data/security concern' },
  { value: 'FEATURE', label: 'Feature — improvement idea' },
];

// Auto-map category → priority
const CATEGORY_PRIORITY = { BLOCKER: 'HIGH', TRUST: 'HIGH', FRICTION: 'MEDIUM', FEATURE: 'LOW' };
const PRIORITY_LABEL = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
const PRIORITY_COLOR = { HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#71717A' };

const STATUS_STYLE = {
  OPEN: { background: 'rgba(239,68,68,0.15)', color: '#EF4444' },
  IN_PROGRESS: { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  FIXED: { background: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  VERIFIED: { background: 'rgba(34,197,94,0.25)', color: '#22C55E' },
};
const STATUS_LABEL = { OPEN: 'Open', IN_PROGRESS: 'In Progress', FIXED: 'Fixed', VERIFIED: 'Verified' };
const TYPE_LABEL = { BUG: 'Bug', DATA_ISSUE: 'Data', ACCESS_ISSUE: 'Access', FEATURE_REQUEST: 'Feature' };
const CAT_LABEL = { BLOCKER: 'Blocker', FRICTION: 'Friction', TRUST: 'Trust', FEATURE: 'Feature' };

export default function ReportIssueButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('new');
  const [issueType, setIssueType] = useState('BUG');
  const [category, setCategory] = useState('FRICTION');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [myIssues, setMyIssues] = useState([]);
  const [myLoading, setMyLoading] = useState(false);
  const location = useLocation();

  const autoPriority = CATEGORY_PRIORITY[category] || 'MEDIUM';

  const reset = () => { setIssueType('BUG'); setCategory('FRICTION'); setDescription(''); setResult(null); };
  const handleOpen = () => { reset(); setTab('new'); setOpen(true); };
  const handleClose = () => { setOpen(false); setTimeout(reset, 300); };

  const loadMyIssues = () => {
    setMyLoading(true);
    api.get('/issues/mine', { params: { limit: 10 } })
      .then((res) => setMyIssues(res.data.items || []))
      .catch(() => setMyIssues([]))
      .finally(() => setMyLoading(false));
  };

  useEffect(() => { if (open && tab === 'mine') loadMyIssues(); }, [open, tab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      await api.post('/issues', {
        issueType,
        category,
        description: description.trim(),
        pageRoute: location.pathname,
      });
      setResult({ type: 'success', message: 'Issue reported successfully. We will review it shortly.' });
      setDescription('');
    } catch (err) {
      setResult({ type: 'error', message: err.response?.data?.error || 'Failed to submit issue. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button onClick={handleOpen} title="Report an issue" style={styles.fab} aria-label="Report Issue">
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>!</span>
      </button>

      {open && (
        <div style={styles.overlay} onClick={handleClose}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => { setTab('new'); setResult(null); }}
                  style={{ ...styles.tab, ...(tab === 'new' ? styles.tabActive : {}) }}>Report Issue</button>
                <button onClick={() => setTab('mine')}
                  style={{ ...styles.tab, ...(tab === 'mine' ? styles.tabActive : {}) }}>My Issues</button>
              </div>
              <button onClick={handleClose} style={styles.closeBtn}>&times;</button>
            </div>

            {tab === 'new' ? (
              result?.type === 'success' ? (
                <div style={styles.body}>
                  <div className="alert-inline alert-inline-success" style={{ textAlign: 'center', justifyContent: 'center' }}>
                    {result.message}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={reset}>Report Another</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setTab('mine')}>View My Issues</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div style={styles.body}>
                    {result?.type === 'error' && (
                      <div className="alert-inline alert-inline-danger" style={{ marginBottom: '0.75rem' }}>{result.message}</div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Type</label>
                        <select value={issueType} onChange={(e) => setIssueType(e.target.value)} style={styles.input}>
                          {ISSUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Category</label>
                        <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
                          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* Auto-priority indicator */}
                    <div style={{ fontSize: '0.75rem', color: PRIORITY_COLOR[autoPriority], marginBottom: '0.6rem' }}>
                      Priority: <strong>{PRIORITY_LABEL[autoPriority]}</strong> (auto-set from category)
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={styles.label}>Description *</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the issue you're experiencing..."
                        required maxLength={2000} rows={4}
                        style={{ ...styles.input, resize: 'vertical', minHeight: '80px' }} autoFocus />
                      <div style={{ fontSize: '0.72rem', color: '#71717A', textAlign: 'right', marginTop: '0.25rem' }}>
                        {description.length}/2000
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#71717A' }}>
                      Page: <code style={{ color: '#A1A1AA' }}>{location.pathname}</code>
                    </div>
                  </div>
                  <div style={styles.footer}>
                    <button type="button" onClick={handleClose} className="btn btn-outline btn-sm">Cancel</button>
                    <button type="submit" disabled={submitting || !description.trim()} className="btn btn-primary btn-sm">
                      {submitting ? 'Submitting...' : 'Submit Issue'}
                    </button>
                  </div>
                </form>
              )
            ) : (
              <div style={styles.body}>
                {myLoading ? (
                  <div style={{ textAlign: 'center', color: '#71717A', padding: '1rem 0' }}>Loading...</div>
                ) : myIssues.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#71717A', padding: '1rem 0' }}>No issues submitted yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
                    {myIssues.map((issue) => {
                      const sStyle = STATUS_STYLE[issue.status] || {};
                      return (
                        <div key={issue.id} style={{ background: '#1E293B', borderRadius: 6, padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <span style={{ ...sStyle, padding: '0.1rem 0.45rem', borderRadius: 3, fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                {STATUS_LABEL[issue.status] || issue.status}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#A1A1AA' }}>{CAT_LABEL[issue.category] || ''}</span>
                              <span style={{ fontSize: '0.72rem', color: '#A1A1AA' }}>{TYPE_LABEL[issue.issueType]}</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', color: '#71717A' }}>{new Date(issue.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#E5E7EB', lineHeight: 1.35 }}>
                            {issue.description.length > 100 ? issue.description.slice(0, 100) + '...' : issue.description}
                          </div>
                          {issue.adminNote && (
                            <div style={{ fontSize: '0.75rem', color: '#22C55E', marginTop: '0.3rem', fontStyle: 'italic' }}>
                              Note: {issue.adminNote}
                            </div>
                          )}
                          {issue.resolutionNote && (
                            <div style={{ fontSize: '0.75rem', color: '#0891b2', marginTop: '0.2rem', fontStyle: 'italic' }}>
                              Resolution: {issue.resolutionNote}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  fab: {
    position: 'fixed', bottom: '1.5rem', right: '1.5rem', width: '44px', height: '44px',
    borderRadius: '50%', background: '#F59E0B', color: '#fff', border: 'none', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '1.25rem', zIndex: 1000,
  },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 },
  modal: { background: '#162033', borderRadius: '10px', width: '100%', maxWidth: '460px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', borderBottom: '1px solid #243041', color: '#FFFFFF' },
  tab: { background: 'none', border: 'none', color: '#71717A', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: '0.25rem 0', borderBottom: '2px solid transparent' },
  tabActive: { color: '#FFFFFF', borderBottomColor: '#22C55E' },
  closeBtn: { background: 'none', border: 'none', color: '#A1A1AA', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: 0 },
  body: { padding: '1rem 1.25rem' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.75rem 1.25rem', borderTop: '1px solid #243041' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#A1A1AA', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' },
  input: { width: '100%', padding: '0.6rem 0.8rem', background: '#1E293B', border: '1px solid #243041', borderRadius: '6px', color: '#FFFFFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' },
};
