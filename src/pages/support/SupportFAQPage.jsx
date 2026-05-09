/**
 * SupportFAQPage — /support/faq
 *
 * Accordion of high-value answers grouped by topic per spec §6:
 *   Scans · Tasks · Weather · Funding · Selling · Language ·
 *   Camera issues · Offline use.
 *
 * STRICT-RULE AUDIT
 *   • Pure presentational. Never throws.
 *   • Inline styles only, Soft Ochre tokens.
 *   • Every visible string via tSafe with English fallbacks so
 *     untranslated locales still show usable copy.
 *   • Lazy-loaded by App.jsx — no support cost on the main bundle.
 */

import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../../components/premium/tokens.js';

// FAQ entries — kept as a flat list so iteration is trivial and
// the order is stable. `key` is the i18n base; question + answer
// derive `key + .q` / `key + .a`. English fallbacks below.
const FAQ_ENTRIES = [
  {
    section: 'scans',
    items: [
      { key: 'support.faq.scans.use',
        q: 'How do I scan a plant or crop?',
        a: 'Open Scan from the bottom tab, tap "Open camera," and aim at the leaf or affected area. You can also upload a photo from your gallery if the camera is unavailable.' },
      { key: 'support.faq.scans.accuracy',
        q: 'Is the scan diagnosis guaranteed?',
        a: 'No. Scan results are guidance only. Local agronomy advice may help confirm treatment options.' },
    ],
  },
  {
    section: 'tasks',
    items: [
      { key: 'support.faq.tasks.add',
        q: 'How do I add a task?',
        a: 'Open Today, then tap "Add task." You can also add scan results to today\'s tasks from the result card.' },
      { key: 'support.faq.tasks.complete',
        q: 'How do I mark a task done?',
        a: 'Tap the task on the Today screen and choose Mark done.' },
    ],
  },
  {
    section: 'weather',
    items: [
      { key: 'support.faq.weather.source',
        q: 'Where does the weather come from?',
        a: 'We use your phone\'s location plus a public weather service. If the location is unavailable, we show calm fallback guidance.' },
    ],
  },
  {
    section: 'funding',
    items: [
      { key: 'support.faq.funding.eligible',
        q: 'How do I check funding eligibility?',
        a: 'Open the Funding tab. Eligibility is based on your farm profile and verification progress.' },
    ],
  },
  {
    section: 'selling',
    items: [
      { key: 'support.faq.selling.list',
        q: 'How do I list a harvest for sale?',
        a: 'Open Sell, tap "Add lot," and fill in the crop, quantity, and asking price. We\'ll match nearby buyers.' },
    ],
  },
  {
    section: 'language',
    items: [
      { key: 'support.faq.language.change',
        q: 'How do I change the language?',
        a: 'Open Settings → Language. We support English, French, Kiswahili, Hausa, Twi, and Hindi.' },
    ],
  },
  {
    section: 'camera',
    items: [
      { key: 'support.faq.camera.black',
        q: 'My camera shows a black screen — what should I do?',
        a: 'Tap "Retry camera" or "Upload photo." If the issue continues, check that another app isn\'t already using your camera, and that camera permission is on in your browser settings.' },
      { key: 'support.faq.camera.permission',
        q: 'I denied camera access by accident.',
        a: 'You can still upload a photo. To re-enable the camera, change the permission in your phone or browser settings, then reopen Scan.' },
    ],
  },
  {
    section: 'offline',
    items: [
      { key: 'support.faq.offline.use',
        q: 'Can I use Farroway offline?',
        a: 'Yes. Today\'s tasks, scan history, and drafts are saved on your device. They sync automatically when your connection returns.' },
    ],
  },
];

const SECTION_LABELS = {
  scans:    { key: 'support.faq.section.scans',    fb: 'Scans' },
  tasks:    { key: 'support.faq.section.tasks',    fb: 'Tasks' },
  weather:  { key: 'support.faq.section.weather',  fb: 'Weather' },
  funding:  { key: 'support.faq.section.funding',  fb: 'Funding' },
  selling:  { key: 'support.faq.section.selling',  fb: 'Selling' },
  language: { key: 'support.faq.section.language', fb: 'Language' },
  camera:   { key: 'support.faq.section.camera',   fb: 'Camera issues' },
  offline:  { key: 'support.faq.section.offline',  fb: 'Offline use' },
};

export default function SupportFAQPage() {
  const navigate = useNavigate();
  // Track open accordion items by `section + index` so each row's
  // expand state is independent.
  const [open, setOpen] = useState({});

  const toggle = useCallback((id) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <main style={S.page} data-testid="support-faq-page">
      <div style={S.container}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={S.backBtn}
          className="ff-tap"
          data-testid="support-faq-back"
        >
          {'← '}{tSafe('common.back', 'Back')}
        </button>

        <header style={S.hero}>
          <h1 style={S.title}>
            {tSafe('support.openFaq', 'Frequently asked questions')}
          </h1>
          <p style={S.subtitle}>
            {tSafe(
              'support.faqIntro',
              'Quick answers to common questions. Tap a question to see the answer.',
            )}
          </p>
        </header>

        {FAQ_ENTRIES.map((group) => {
          const label = SECTION_LABELS[group.section];
          return (
            <section key={group.section} style={S.section}>
              <h2 style={S.sectionTitle}>
                {tSafe(label.key, label.fb)}
              </h2>
              <div style={S.list}>
                {group.items.map((item, idx) => {
                  const id = group.section + '_' + idx;
                  const isOpen = !!open[id];
                  return (
                    <div key={id} style={S.item}>
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        style={S.itemHead}
                        className="ff-tap"
                        aria-expanded={isOpen}
                        data-testid={`support-faq-toggle-${id}`}
                      >
                        <span style={S.itemQ}>
                          {tSafe(item.key + '.q', item.q)}
                        </span>
                        <span style={S.itemChevron} aria-hidden="true">
                          {isOpen ? '−' : '+'}
                        </span>
                      </button>
                      {isOpen ? (
                        <p style={S.itemA}>
                          {tSafe(item.key + '.a', item.a)}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
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
    gap: '1rem',
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
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 800,
    color: T.ochreInk,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  item: {
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusCard,
    boxShadow: T.shadowCard,
    overflow: 'hidden',
  },
  itemHead: {
    appearance: 'none',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    padding: '0.85rem 1rem',
    background: 'transparent',
    border: 'none',
    color: T.ink,
    fontSize: '0.95rem',
    fontWeight: 700,
    textAlign: 'left',
    cursor: 'pointer',
    minHeight: 56,
    fontFamily: 'inherit',
  },
  itemQ: { flex: 1, color: T.ink },
  itemChevron: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: T.ochreInk,
    width: 24,
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemA: {
    margin: 0,
    padding: '0 1rem 0.95rem',
    fontSize: '0.875rem',
    color: T.ink,
    lineHeight: 1.55,
  },
};
