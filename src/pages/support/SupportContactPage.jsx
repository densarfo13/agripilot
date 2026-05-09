/**
 * SupportContactPage — /support/contact
 *
 * Calm, low-literacy-friendly form for reporting an issue.
 * Builds a `mailto:` with a structured body so the user's mail
 * client opens with the message pre-filled. No backend needed
 * for the pilot launch — when an API ships later, only the
 * submit() handler changes.
 *
 * SPEC §7
 *   • name (optional)
 *   • email (optional)
 *   • category (Camera issue / Weather / Scan / Language / Login /
 *     App bug / Other)
 *   • short message
 *   • screenshot (optional, attached as a copy hint)
 *
 * SPEC §8 — offline safety
 *   • Detects navigator.onLine === false.
 *   • Persists draft locally in `farroway_support_draft_v1`.
 *   • On reconnect, surfaces a calm "send now" hint.
 *
 * STRICT-RULE AUDIT
 *   • Pure presentational. Never throws.
 *   • Inline styles only, Soft Ochre tokens.
 *   • Visible text via tSafe with English fallbacks.
 *   • Lazy-loaded via App.jsx.
 *   • Never logs the message body in plaintext analytics
 *     (spec §15).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../../components/premium/tokens.js';
import {
  SUPPORT_CONFIG,
  emailSupportSafe,
} from '../../config/support.js';

const DRAFT_KEY = 'farroway_support_draft_v1';

const CATEGORIES = [
  { id: 'camera',    key: 'support.cameraIssue',    fb: 'Camera issue' },
  { id: 'weather',   key: 'support.weatherIssue',   fb: 'Weather issue' },
  { id: 'scan',      key: 'support.scanIssue',      fb: 'Scan issue' },
  { id: 'language',  key: 'support.languageIssue',  fb: 'Language issue' },
  { id: 'login',     key: 'support.loginIssue',     fb: 'Login issue' },
  { id: 'bug',       key: 'support.appBug',         fb: 'App bug' },
  { id: 'other',     key: 'support.other',          fb: 'Other' },
];

function _readDraft() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch { return null; }
}

function _writeDraft(draft) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* quota / private mode — non-fatal */ }
}

function _clearDraft() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(DRAFT_KEY);
  } catch { /* swallow */ }
}

function _track(event, payload) {
  try {
    import('../../lib/analytics.js').then((mod) => {
      try { mod.safeTrackEvent && mod.safeTrackEvent(event, payload || {}); }
      catch { /* swallow */ }
    }).catch(() => { /* tolerate */ });
  } catch { /* never throw from a logger */ }
}

export default function SupportContactPage() {
  const navigate = useNavigate();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [category, setCategory] = useState('other');
  const [message, setMessage]   = useState('');
  const [offline, setOffline]   = useState(false);
  const [toast, setToast]       = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  // Hydrate from draft on mount.
  useEffect(() => {
    const draft = _readDraft();
    if (draft) {
      if (typeof draft.name === 'string')     setName(draft.name);
      if (typeof draft.email === 'string')    setEmail(draft.email);
      if (typeof draft.category === 'string') setCategory(draft.category);
      if (typeof draft.message === 'string')  setMessage(draft.message);
      setHasDraft(true);
    }
    _track('support_contact_opened', {});
  }, []);

  // Online/offline state — drives the offline banner + the
  // submit-button copy.
  useEffect(() => {
    const update = () => {
      try {
        if (typeof navigator !== 'undefined') {
          setOffline(navigator.onLine === false);
        }
      } catch { /* ignore */ }
    };
    update();
    try {
      if (typeof window !== 'undefined') {
        window.addEventListener('online',  update);
        window.addEventListener('offline', update);
      }
    } catch { /* ignore */ }
    return () => {
      try {
        if (typeof window !== 'undefined') {
          window.removeEventListener('online',  update);
          window.removeEventListener('offline', update);
        }
      } catch { /* ignore */ }
    };
  }, []);

  // Auto-save draft on every change so a tab close mid-typing
  // doesn't lose work.
  useEffect(() => {
    const draft = { name, email, category, message };
    // Only persist when at least one field is non-empty.
    if (name || email || message || category !== 'other') {
      _writeDraft(draft);
      setHasDraft(true);
    } else {
      _clearDraft();
      setHasDraft(false);
    }
  }, [name, email, category, message]);

  const handleSubmit = useCallback(async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!message.trim()) {
      setToast(tSafe('support.messageRequired', 'Please add a short message.'));
      setTimeout(() => setToast(''), 2400);
      return;
    }

    // Build the email body. We DO NOT log the body to analytics
    // — spec §15 forbids plaintext message content in events.
    const cat = CATEGORIES.find((c) => c.id === category) || CATEGORIES[CATEGORIES.length - 1];
    const subject = '[Farroway][' + cat.id + '] ' + tSafe('support.contactTitle', 'Help request');
    const lines = [];
    if (name)  lines.push('Name: '  + name);
    if (email) lines.push('Email: ' + email);
    lines.push('Category: ' + tSafe(cat.key, cat.fb));
    lines.push('');
    lines.push(message);

    _track('support_submit_clicked', {
      category: cat.id,
      hasName:    !!name,
      hasEmail:   !!email,
      messageLen: message.length,
      offline,
    });

    if (offline) {
      setToast(tSafe(
        'support.offlineMessage',
        'You’re offline right now. We saved your message. Try again when connection returns.',
      ));
      setTimeout(() => setToast(''), 3200);
      return;
    }

    const result = await emailSupportSafe({ subject, body: lines.join('\n') });
    if (result.action === 'opened') {
      // Mail app took over. Clear draft only AFTER the user
      // hit "send" in their mail client — but we can't observe
      // that, so we leave the draft in place until the user
      // taps the "Clear draft" affordance OR opens the page
      // again with the field empty.
      _track('support_submit_opened_mail', { category: cat.id });
      return;
    }
    if (result.action === 'copied') {
      setToast(tSafe('support.emailCopied', 'Support email copied.'));
      setTimeout(() => setToast(''), 2400);
      return;
    }
    setToast(tSafe('support.submitFailed', 'Could not open mail. Please try again.'));
    setTimeout(() => setToast(''), 2400);
  }, [name, email, category, message, offline]);

  const handleClearDraft = useCallback(() => {
    _clearDraft();
    setName('');
    setEmail('');
    setCategory('other');
    setMessage('');
    setHasDraft(false);
    setToast(tSafe('support.draftCleared', 'Draft cleared.'));
    setTimeout(() => setToast(''), 1800);
  }, []);

  return (
    <main style={S.page} data-testid="support-contact-page">
      <div style={S.container}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={S.backBtn}
          className="ff-tap"
          data-testid="support-contact-back"
        >
          {'← '}{tSafe('common.back', 'Back')}
        </button>

        <header style={S.hero}>
          <h1 style={S.title}>
            {tSafe('support.reportIssue', 'Report a problem')}
          </h1>
          <p style={S.subtitle}>
            {tSafe(
              'support.contactSubtitle',
              'Tell us what happened. We try to reply ' + SUPPORT_CONFIG.replyWindow + '.',
            )}
          </p>
        </header>

        {offline ? (
          <div style={S.offlineBanner} role="status" data-testid="support-offline-banner">
            {tSafe(
              'support.offlineBanner',
              'You’re offline right now. Support messages can be sent when connection returns.',
            )}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={S.form} data-testid="support-contact-form">
          <Field
            label={tSafe('support.fieldName', 'Your name (optional)')}
            value={name}
            onChange={setName}
            testId="support-field-name"
          />
          <Field
            label={tSafe('support.fieldEmail', 'Your email (optional)')}
            value={email}
            onChange={setEmail}
            type="email"
            inputMode="email"
            autoComplete="email"
            testId="support-field-email"
          />

          <label style={S.label}>
            <span style={S.labelText}>
              {tSafe('support.fieldCategory', 'What is the issue about?')}
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={S.select}
              data-testid="support-field-category"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {tSafe(c.key, c.fb)}
                </option>
              ))}
            </select>
          </label>

          <label style={S.label}>
            <span style={S.labelText}>
              {tSafe('support.fieldMessage', 'Short message')}
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              style={S.textarea}
              placeholder={tSafe(
                'support.messagePlaceholder',
                'Describe what happened, what you were doing, and the device you are using.',
              )}
              data-testid="support-field-message"
            />
          </label>

          <div style={S.actions}>
            <button
              type="submit"
              style={S.btnPrimary}
              className="ff-tap"
              data-testid="support-submit"
            >
              {offline
                ? tSafe('support.submitOffline', 'Save message')
                : tSafe('support.submitIssue',  'Send message')}
            </button>
            {hasDraft ? (
              <button
                type="button"
                onClick={handleClearDraft}
                style={S.btnGhost}
                className="ff-tap"
                data-testid="support-clear-draft"
              >
                {tSafe('support.clearDraft', 'Clear draft')}
              </button>
            ) : null}
          </div>
        </form>

        {toast ? (
          <div role="status" aria-live="polite" style={S.toast} data-testid="support-contact-toast">
            {toast}
          </div>
        ) : null}
      </div>
    </main>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function Field({ label, value, onChange, type = 'text', inputMode, autoComplete, testId }) {
  return (
    <label style={S.label}>
      <span style={S.labelText}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={S.input}
        inputMode={inputMode}
        autoComplete={autoComplete}
        data-testid={testId}
      />
    </label>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${T.bgTop} 0%, ${T.bgBottom} 100%)`,
    color: T.ink,
    padding: '1rem',
    paddingBottom: '5rem',
  },
  container: {
    maxWidth: '32rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: '0.5rem 0.85rem',
    borderRadius: 999,
    border: `1px solid ${T.border}`,
    background: T.panel,
    color: T.ink,
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 40,
    fontFamily: 'inherit',
  },
  hero: { padding: '0.5rem 0 0.25rem' },
  title: { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: T.ink },
  subtitle: { margin: '0.4rem 0 0', color: T.inkDim, fontSize: '0.9375rem', lineHeight: 1.5 },
  offlineBanner: {
    padding: '0.7rem 0.95rem',
    borderRadius: 12,
    background: T.amberSoft,
    border: `1px solid ${T.amberBorder}`,
    color: T.amberInk,
    fontSize: '0.875rem',
    fontWeight: 700,
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    padding: '1rem',
    borderRadius: T.radiusCard,
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
  },
  label: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  labelText: { fontSize: '0.8125rem', fontWeight: 800, color: T.ink, letterSpacing: '0.01em' },
  input: {
    appearance: 'none',
    padding: '0.7rem 0.85rem',
    borderRadius: 10,
    border: `1px solid ${T.borderHi}`,
    background: '#FFFFFF',
    color: T.ink,
    fontSize: '0.95rem',
    minHeight: 44,
    fontFamily: 'inherit',
  },
  select: {
    appearance: 'none',
    padding: '0.7rem 0.85rem',
    borderRadius: 10,
    border: `1px solid ${T.borderHi}`,
    background: '#FFFFFF',
    color: T.ink,
    fontSize: '0.95rem',
    minHeight: 44,
    fontFamily: 'inherit',
  },
  textarea: {
    appearance: 'none',
    padding: '0.7rem 0.85rem',
    borderRadius: 10,
    border: `1px solid ${T.borderHi}`,
    background: '#FFFFFF',
    color: T.ink,
    fontSize: '0.95rem',
    minHeight: 110,
    fontFamily: 'inherit',
    resize: 'vertical',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.6rem',
    marginTop: '0.4rem',
  },
  btnPrimary: {
    flex: '1 1 auto',
    minWidth: 160,
    minHeight: 48,
    padding: '0.85rem 1.25rem',
    border: 'none',
    borderRadius: 999,
    background: `linear-gradient(180deg, ${T.ochre} 0%, ${T.ochreActive} 100%)`,
    color: '#FFFFFF',
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(185,133,63,0.32)',
    fontFamily: 'inherit',
  },
  btnGhost: {
    minWidth: 120,
    minHeight: 48,
    padding: '0.85rem 1.05rem',
    border: `1px solid ${T.border}`,
    borderRadius: 999,
    background: 'transparent',
    color: T.ink,
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  toast: {
    position: 'fixed',
    left: '50%',
    bottom: '1.5rem',
    transform: 'translateX(-50%)',
    padding: '0.7rem 1.1rem',
    borderRadius: 999,
    background: T.ink,
    color: '#FFFFFF',
    fontSize: '0.875rem',
    fontWeight: 700,
    boxShadow: '0 12px 28px -10px rgba(0,0,0,0.4)',
    zIndex: 1000,
  },
};
