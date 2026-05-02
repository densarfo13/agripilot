/**
 * ScanVerificationChecklist — 2–3 yes/no checks the user runs
 * on the affected plant before we commit to a specific named
 * condition (high-confidence ML scan spec §2).
 *
 *   <ScanVerificationChecklist
 *     scanId={result.scanId}
 *     questions={result.verificationQuestions}
 *     onComplete={(summary) => setVerified(summary)}
 *   />
 *
 * UX rules
 *   * Each question is a simple Yes / No tap. No free text.
 *   * Once all questions answered (or user taps Skip), call
 *     `onComplete(summary)` with the count of matched +
 *     mismatched answers so the result card can downgrade.
 *   * Submitting POSTs each answer to /api/scan/feedback so
 *     the server can apply the §2 downgrade and persist the
 *     answers for future ML training.
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * Never throws — fetch + storage calls are guarded.
 *   * Renders nothing when there are no questions.
 */

import { useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const C = {
  ink:     '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.65)',
  border:  'rgba(255,255,255,0.10)',
  green:   '#22C55E',
  amber:   '#F59E0B',
  red:     '#EF4444',
};

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: '14px 16px',
    margin: '12px 0',
    color: C.ink,
  },
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: C.inkSoft },
  title:   { margin: '4px 0 12px', fontSize: 14, fontWeight: 700 },
  q:       {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '10px 0', borderTop: `1px dashed ${C.border}`,
  },
  prompt:  { fontSize: 13, lineHeight: 1.45, color: C.ink },
  row:     { display: 'flex', gap: 8 },
  pill:    {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: 'transparent',
    border: `1px solid ${C.border}`,
    color: C.ink,
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    minHeight: 32,
  },
  pillYes:  { background: 'rgba(34,197,94,0.18)',  color: '#86EFAC', borderColor: 'rgba(34,197,94,0.32)' },
  pillNo:   { background: 'rgba(239,68,68,0.16)', color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.32)' },
  summary:  { marginTop: 12, fontSize: 12, color: C.inkSoft, lineHeight: 1.45 },
  skipBtn:  {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    color: C.inkSoft,
    fontSize: 12,
    textDecoration: 'underline',
    marginTop: 4,
    padding: '4px 0',
  },
};

async function _postAnswer(scanId, questionId, answer) {
  if (!scanId || !questionId) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    await fetch('/api/scan/feedback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scanId,
        userFeedback: 'verification',
        verificationAnswer: { questionId, answer },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
  } catch { /* swallow */ }
}

export default function ScanVerificationChecklist({
  scanId, questions, onComplete,
}) {
  useTranslation();
  const [answers, setAnswers] = useState({});
  const [skipped, setSkipped] = useState(false);

  if (!Array.isArray(questions) || questions.length === 0) return null;
  if (skipped) return null;

  const allAnswered = questions.every((q) => q && q.id && answers[q.id]);

  function handleAnswer(q, value) {
    if (!q || !q.id) return;
    if (answers[q.id]) return; // already answered — ignore
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    try { trackEvent('scan_verification_answer', { scanId, questionId: q.id, value }); }
    catch { /* swallow */ }
    _postAnswer(scanId, q.id, value);

    // When the user finishes the last question, compute the
    // summary and tell the parent so it can downgrade the
    // displayed tier per spec §2.
    const allDone = questions.every((qq) => qq && qq.id && next[qq.id]);
    if (allDone && typeof onComplete === 'function') {
      let matched = 0;
      let mismatched = 0;
      for (const qq of questions) {
        const a = next[qq.id];
        if (!a) continue;
        if (a === qq.expected) matched += 1;
        else                   mismatched += 1;
      }
      try {
        onComplete({
          asked:      questions.length,
          answered:   questions.length,
          matched,
          mismatched,
          downgrade:  mismatched > 0,
          confirmed:  mismatched === 0,
        });
      } catch { /* swallow */ }
    }
  }

  function handleSkip() {
    setSkipped(true);
    try { trackEvent('scan_verification_skipped', { scanId, asked: questions.length }); }
    catch { /* swallow */ }
    if (typeof onComplete === 'function') {
      try {
        onComplete({
          asked:      questions.length,
          answered:   0,
          matched:    0,
          mismatched: 0,
          downgrade:  false,
          confirmed:  false,
          skipped:    true,
        });
      } catch { /* swallow */ }
    }
  }

  return (
    <section
      style={S.card}
      data-testid="scan-verification-checklist"
      data-all-answered={allAnswered ? 'true' : 'false'}
    >
      <span style={S.eyebrow}>
        {tStrict('scan.verify.eyebrow', 'Quick checks')}
      </span>
      <h3 style={S.title}>
        {tStrict('scan.verify.title',
          'Help us narrow this down — a few yes/no checks.')}
      </h3>
      {questions.map((q) => {
        if (!q || !q.id) return null;
        const a = answers[q.id];
        return (
          <div key={q.id} style={S.q} data-testid={`scan-verify-q-${q.id}`}>
            <span style={S.prompt}>{q.prompt}</span>
            <div style={S.row}>
              <button
                type="button"
                onClick={() => handleAnswer(q, 'yes')}
                style={a === 'yes' ? { ...S.pill, ...S.pillYes } : S.pill}
                data-testid={`scan-verify-${q.id}-yes`}
                aria-pressed={a === 'yes'}
              >
                {tStrict('scan.verify.yes', 'Yes')}
              </button>
              <button
                type="button"
                onClick={() => handleAnswer(q, 'no')}
                style={a === 'no' ? { ...S.pill, ...S.pillNo } : S.pill}
                data-testid={`scan-verify-${q.id}-no`}
                aria-pressed={a === 'no'}
              >
                {tStrict('scan.verify.no', 'No')}
              </button>
            </div>
          </div>
        );
      })}
      {!allAnswered ? (
        <button
          type="button"
          onClick={handleSkip}
          style={S.skipBtn}
          data-testid="scan-verify-skip"
        >
          {tStrict('scan.verify.skip', 'Skip these checks')}
        </button>
      ) : (
        <div style={S.summary}>
          {tStrict('scan.verify.thanks',
            'Thanks \u2014 your answers help us be more accurate.')}
        </div>
      )}
    </section>
  );
}
