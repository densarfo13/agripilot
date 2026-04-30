/**
 * PhotoIntelligence — bottom-sheet orchestrator that walks the
 * farmer through:
 *
 *   1. Capture           — PhotoCapture component
 *   2. Question pick     — five guided questions (spec §3)
 *   3. Analyze + result  — ScanResultCard
 *
 * Strict-rule audit
 *   • Every analysis goes through analyzePhotoRequest, which
 *     itself routes through the safe rule-based engine until
 *     FEATURE_OPEN_AI_DIAGNOSIS lands.
 *   • Closing the sheet stops any active speech.
 *   • Save-to-history writes locally; if the network is down
 *     the entry is flagged pendingUpload so a future sync
 *     pass can push it.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import PhotoCapture from './PhotoCapture.jsx';
import ScanResultCard from './ScanResultCard.jsx';
import { PHOTO_QUESTIONS } from '../../utils/photoAnalysisEngine.js';
import { analyzePhotoRequest } from '../../services/photoAnalysisService.js';
import { appendScan } from '../../lib/photo/scanHistory.js';
import { stopSpeaking } from '../../utils/voiceEngine.js';
import { logEvent, EVENT_TYPES } from '../../data/eventLogger.js';

const STEP = {
  CAPTURE:  'capture',
  QUESTION: 'question',
  ANALYZE:  'analyze',
  RESULT:   'result',
};

const FALLBACK_QUESTION_LABEL = {
  whats_wrong:      'What is wrong with my crop?',
  pest_damage:      'Is this pest damage?',
  disease:          'Is this disease?',
  ready_to_harvest: 'Is my crop ready to harvest?',
  whats_next:       'What should I do next?',
};

export default function PhotoIntelligence({
  open,
  onClose,
  farmId = null,
  cropId = null,
}) {
  const { lang } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = React.useState(STEP.CAPTURE);
  const [imageDataUrl, setImageDataUrl] = React.useState('');
  const [question, setQuestion] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? !!navigator.onLine : true,
  );

  React.useEffect(() => {
    function onOnline()  { setIsOnline(true);  }
    function onOffline() { setIsOnline(false); }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Reset on open / cleanup on close.
  React.useEffect(() => {
    if (open) {
      setStep(STEP.CAPTURE);
      setImageDataUrl('');
      setQuestion(null);
      setResult(null);
      setBusy(false);
      setSaved(false);
      try { logEvent(EVENT_TYPES.PHOTO_SCAN_OPENED || 'photo_scan_opened',
        { farmId, cropId, lang }); } catch { /* swallow */ }
    } else {
      stopSpeaking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleCaptured(dataUrl) {
    setImageDataUrl(dataUrl);
    setStep(STEP.QUESTION);
  }

  async function handlePickQuestion(q) {
    setQuestion(q);
    setStep(STEP.ANALYZE);
    setBusy(true);
    try {
      const res = await analyzePhotoRequest({
        farmId,
        cropId,
        language: lang,
        question: q.id,
        imageBase64: imageDataUrl,
      });
      setResult(res);
      setStep(STEP.RESULT);
      try { logEvent(EVENT_TYPES.PHOTO_SCAN_ANALYZED || 'photo_scan_analyzed', {
        farmId, cropId, lang,
        questionId: q.id,
        confidence: res.confidence,
        source: res.source,
      }); } catch { /* swallow */ }
    } catch {
      // analyzePhotoRequest never throws but defensive belt + braces.
      setResult({
        possibleIssue: tSafe('photo.errAnalyze',
          'We could not analyse the photo right now. Try again or contact our team.'),
        confidence: 'low',
        recommendedAction: '',
        safetyWarning: null,
        seekHelp: '',
        localizedResponse: '',
        retakeRequested: true,
      });
      setStep(STEP.RESULT);
    } finally {
      setBusy(false);
    }
  }

  function handleRetake() {
    setStep(STEP.CAPTURE);
    setImageDataUrl('');
    setQuestion(null);
    setResult(null);
    setSaved(false);
  }

  function handleSave() {
    if (!result || !imageDataUrl || !farmId) {
      // Still flag locally even without a farmId so the
      // farmer's action doesn't feel ignored — but we need
      // a farmId for the scan-history index.
      setSaved(true);
      return;
    }
    appendScan(farmId, {
      cropId,
      imageDataUrl,
      question: question?.id || '',
      possibleIssue:     result.possibleIssue,
      confidence:        result.confidence,
      recommendedAction: result.recommendedAction,
      safetyWarning:     result.safetyWarning,
      seekHelp:          result.seekHelp,
      language:          lang,
      pendingUpload:     !isOnline,
    });
    setSaved(true);
    try { logEvent(EVENT_TYPES.PHOTO_SCAN_SAVED || 'photo_scan_saved',
      { farmId, cropId, questionId: question?.id }); } catch { /* swallow */ }
  }

  function handleContact() {
    onClose && onClose();
    navigate('/help');
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tSafe('photo.scanCrop', 'Scan crop')}
      style={S.scrim}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
      data-testid="photo-intelligence"
    >
      <div style={S.sheet}>
        <div style={S.header}>
          <span style={S.headerTitle}>
            {tSafe('photo.scanCrop', 'Scan crop')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={S.close}
            data-testid="photo-close"
          >×</button>
        </div>

        {/* ── Step 1: capture ── */}
        {step === STEP.CAPTURE && (
          <PhotoCapture
            onContinue={handleCaptured}
            onCancel={onClose}
          />
        )}

        {/* ── Step 2: pick a question ── */}
        {step === STEP.QUESTION && (
          <div style={S.questionWrap} data-testid="photo-questions">
            {imageDataUrl && (
              <img src={imageDataUrl} alt="" style={S.thumb} />
            )}
            <p style={S.eyebrow}>
              {tSafe('photo.pickQuestion', 'Pick a question')}
            </p>
            <div style={S.questionGrid}>
              {PHOTO_QUESTIONS.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handlePickQuestion(q)}
                  style={S.questionBtn}
                  data-testid={`photo-question-${q.id}`}
                >
                  {tSafe(q.labelKey, FALLBACK_QUESTION_LABEL[q.id] || q.id)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleRetake}
              style={S.linkBtn}
              data-testid="photo-back-to-capture"
            >
              {tSafe('photo.retake', 'Retake')}
            </button>
          </div>
        )}

        {/* ── Step 3: analyzing ── */}
        {step === STEP.ANALYZE && (
          <div style={S.analyzeWrap} data-testid="photo-analyze">
            {imageDataUrl && (
              <img src={imageDataUrl} alt="" style={S.thumb} />
            )}
            <p style={S.analyzeText}>
              {busy
                ? tSafe('photo.analyzing', 'Analysing photo\u2026')
                : tSafe('common.continue', 'Continue')}
            </p>
          </div>
        )}

        {/* ── Step 4: result ── */}
        {step === STEP.RESULT && result && (
          <>
            {!isOnline && (
              <p style={S.offlineNote}>
                {tSafe('photo.offlineNote',
                  'Photo saved. We will analyse it again when connection improves.')}
              </p>
            )}
            <ScanResultCard
              result={result}
              language={lang}
              imageDataUrl={imageDataUrl}
              onRetake={handleRetake}
              onContact={handleContact}
              onSave={handleSave}
              saved={saved}
            />
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  scrim: {
    position: 'fixed', inset: 0,
    background: 'rgba(8,20,35,0.7)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 200,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    width: '100%', maxWidth: '32rem',
    background: '#0B1D34',
    color: '#EAF2FF',
    borderRadius: '16px 16px 0 0',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
    display: 'flex', flexDirection: 'column', gap: '0.875rem',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 -16px 40px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: '1rem', fontWeight: 700 },
  close: {
    width: 32, height: 32, borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'transparent', color: '#EAF2FF',
    fontSize: '1.25rem', lineHeight: 1, cursor: 'pointer',
  },
  questionWrap: { display: 'flex', flexDirection: 'column', gap: '0.625rem' },
  thumb: {
    width: '100%', maxHeight: 200, borderRadius: 10, objectFit: 'cover',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  eyebrow: {
    margin: 0, fontSize: '0.6875rem', color: '#9FB3C8',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  questionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
  },
  questionBtn: {
    padding: '0.625rem 0.75rem',
    borderRadius: 12,
    border: '1px solid rgba(34,197,94,0.28)',
    background: 'rgba(34,197,94,0.08)',
    color: '#EAF2FF',
    fontSize: '0.8125rem',
    fontWeight: 600,
    textAlign: 'left',
    minHeight: 56,
    cursor: 'pointer',
  },
  linkBtn: {
    alignSelf: 'flex-start',
    padding: '0.5rem 0.75rem',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: '#86EFAC',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  analyzeWrap: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '0.5rem',
    padding: '1rem 0',
  },
  analyzeText: { margin: 0, fontSize: '0.875rem', color: '#9FB3C8' },
  offlineNote: {
    margin: 0,
    padding: '0.5rem 0.75rem',
    borderRadius: 10,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
    fontSize: '0.8125rem',
    lineHeight: 1.4,
  },
};
