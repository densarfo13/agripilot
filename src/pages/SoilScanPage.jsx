/**
 * SoilScanPage — confidence-safe soil scan v1 capture flow.
 *
 *   <Route path="/scan/soil" element={<SoilScanPage />} />
 *
 * Spec contract (May 2026 Soil Scan v1)
 *   • Take/upload soil photo
 *   • Preview
 *   • Optional visual-cue selection (the engine is honest about
 *     what a still image can prove without lab tests)
 *   • Analyze → confidence-safe result
 *   • Add task / Retake
 *   • Save scan to localStorage history
 *   • Disclaimer: no lab-grade claims
 *
 * Strict-rule audit
 *   • All visible text via tSafe with English fallbacks.
 *   • Inline styles only. Soft Ochre tokens.
 *   • Never throws — every state transition wrapped.
 *   • Wrapped in PremiumPage so the SafeRouteShell error
 *     boundary in App.jsx still catches any render crash.
 */

import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeather } from '../context/WeatherContext.jsx';
import { tSafe } from '../i18n/tSafe.js';
import {
  PremiumPage, PremiumPageHero,
} from '../components/premium/index.js';
import { PREMIUM_TOKENS as T } from '../components/premium/tokens.js';
import {
  analyzeSoilScan, SOIL_SCAN_CUES,
} from '../lib/soilScanEngine.js';
import SoilScanResultCard from '../components/scan/SoilScanResultCard.jsx';

const HISTORY_KEY = 'farroway_scan_history_v1';
const MAX_HISTORY = 50;

function _readScanHistory() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _saveScanEntry(entry) {
  try {
    if (typeof localStorage === 'undefined') return;
    const list = _readScanHistory();
    const next = [entry, ...list].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch { /* swallow — never break the flow */ }
}

function _resolveMode() {
  try {
    const v = (typeof localStorage !== 'undefined')
      ? localStorage.getItem('farroway_active_grow_mode') : null;
    return v === 'garden' ? 'garden' : 'farm';
  } catch { return 'farm'; }
}

export default function SoilScanPage() {
  const navigate = useNavigate();
  const { weather } = (() => {
    try { return useWeather(); }
    catch { return { weather: null }; }
  })();
  const fileInputRef = useRef(null);

  const [imageUrl, setImageUrl] = useState('');
  const [userCue,  setUserCue]  = useState(null);
  const [result,   setResult]   = useState(null);
  const [taskAdded, setTaskAdded] = useState(false);
  const [errMsg,   setErrMsg]   = useState('');

  const mode = useMemo(_resolveMode, []);

  function handleFileChange(e) {
    setErrMsg('');
    setResult(null);
    setTaskAdded(false);
    try {
      const file = e && e.target && e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const dataUrl = String(reader.result || '');
          if (!dataUrl) throw new Error('empty');
          setImageUrl(dataUrl);
        } catch {
          setErrMsg(tSafe('soilScan.error.read', 'Could not read that photo. Try again.'));
        }
      };
      reader.onerror = () => {
        setErrMsg(tSafe('soilScan.error.read', 'Could not read that photo. Try again.'));
      };
      reader.readAsDataURL(file);
    } catch {
      setErrMsg(tSafe('soilScan.error.read', 'Could not read that photo. Try again.'));
    }
  }

  function handleAnalyze() {
    if (!imageUrl) {
      setErrMsg(tSafe('soilScan.error.noImage', 'Add a soil photo first.'));
      return;
    }
    try {
      const res = analyzeSoilScan({
        userCue: userCue || null,
        weather,
        mode,
      });
      setResult(res);
      setErrMsg('');
      // Persist the scan so /scan history surfaces still find it.
      try {
        _saveScanEntry({
          id:        'soil-' + Date.now().toString(36),
          kind:      'soil',
          status:    res.status,
          confidence:res.confidence,
          mode,
          thumbnail: imageUrl,
          createdAt: Date.now(),
          issue:     res.status,
          title:     tSafe(res.whatNoticedKey, res.whatNoticedFb),
        });
      } catch { /* swallow */ }
    } catch {
      setErrMsg(tSafe('soilScan.error.analyze', 'Could not analyze that photo. Try again.'));
    }
  }

  function handleRetake() {
    setImageUrl('');
    setUserCue(null);
    setResult(null);
    setTaskAdded(false);
    setErrMsg('');
    try {
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch { /* swallow */ }
  }

  function handleAddTask() {
    if (!result) return;
    try {
      // Lightweight task bridge — pushes a single task item the
      // existing Tasks page can pick up. The full task engine
      // can later consume this directly.
      const list = (() => {
        try {
          const raw = localStorage.getItem('farroway:soilTasks');
          const parsed = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
      })();
      list.unshift({
        id:        'soil-task-' + Date.now().toString(36),
        title:     tSafe(result.taskTitleKey, result.taskTitleFb),
        source:    'soilScan',
        status:    'pending',
        createdAt: Date.now(),
        relatedScanStatus: result.status,
      });
      try { localStorage.setItem('farroway:soilTasks', JSON.stringify(list.slice(0, MAX_HISTORY))); }
      catch { /* swallow */ }
      setTaskAdded(true);
    } catch { /* swallow */ }
  }

  function handleOpenPicker() {
    setErrMsg('');
    try {
      if (fileInputRef.current && typeof fileInputRef.current.click === 'function') {
        fileInputRef.current.click();
      }
    } catch { /* swallow */ }
  }

  return (
    <PremiumPage
      mode={mode === 'garden' ? 'garden' : 'farm'}
      testId="soil-scan-page"
      maxWidth="36rem"
      bottomPad="2rem"
    >
      <PremiumPageHero
        mode={mode === 'garden' ? 'garden' : 'farm'}
        eyebrow={tSafe('soilScan.eyebrow', 'Soil scan')}
        title={tSafe('soilScan.title', 'Check your soil')}
        subtitle={tSafe(
          'soilScan.subtitle',
          'Take a photo for a quick visual soil check.',
        )}
        bgImage="/images/page-hero/scan.svg"
        accent="green"
        testId="soil-scan-hero"
      />

      {/* ── Photo capture / upload ────────────────────────── */}
      {!result && (
        <section style={S.card} data-testid="soil-scan-capture">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              style={S.preview}
              loading="lazy"
              decoding="async"
              data-testid="soil-scan-preview"
            />
          ) : (
            <div style={S.placeholder} data-testid="soil-scan-placeholder">
              <span aria-hidden="true" style={S.placeholderIcon}>{'📷'}</span>
              <span style={S.placeholderText}>
                {tSafe('soilScan.placeholder', 'Add a clear photo of the soil surface.')}
              </span>
            </div>
          )}

          {/* Hidden input — clicked imperatively from the buttons. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={S.hiddenFileInput}
            aria-hidden="true"
            tabIndex={-1}
          />

          <div style={S.captureRow}>
            <button
              type="button"
              onClick={handleOpenPicker}
              style={S.btnPrimary}
              className="ff-tap"
              data-testid="soil-scan-take-photo"
            >
              {imageUrl
                ? tSafe('soilScan.choosePhoto', 'Choose another photo')
                : tSafe('soilScan.takePhoto', 'Take or upload photo')}
            </button>
          </div>

          {/* Optional visual cues — single-select chip row.
              The engine is honest about what a still image can
              prove; the user picking a cue raises confidence
              from 'low' to 'medium' / 'high'. */}
          {imageUrl ? (
            <div style={S.cueBlock}>
              <p style={S.cueLabel}>
                {tSafe('soilScan.cueLabel', 'How does the soil look? (optional)')}
              </p>
              <div style={S.cueRow}>
                {SOIL_SCAN_CUES.map((c) => {
                  const active = userCue === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setUserCue(active ? null : c.key)}
                      style={{
                        ...S.cueChip,
                        background: active ? T.ochreSoft : '#FFFFFF',
                        borderColor: active ? T.ochreBorder : T.border,
                        color: active ? T.ochreInk : T.inkDim,
                      }}
                      className="ff-tap"
                      data-testid={`soil-scan-cue-${c.key}`}
                      aria-pressed={active}
                    >
                      {tSafe(c.labelKey, c.labelFb)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {errMsg ? (
            <p style={S.error} role="alert" data-testid="soil-scan-error">
              {errMsg}
            </p>
          ) : null}

          {imageUrl ? (
            <button
              type="button"
              onClick={handleAnalyze}
              style={S.btnAnalyze}
              className="ff-tap"
              data-testid="soil-scan-analyze"
            >
              {tSafe('soilScan.analyze', 'Analyze soil')}
            </button>
          ) : null}

          <p style={S.privacy}>
            {tSafe(
              'soilScan.privacyNote',
              'Soil photos stay on your device unless you choose to share them.',
            )}
          </p>
        </section>
      )}

      {/* ── Result ─────────────────────────────────────────── */}
      {result ? (
        <SoilScanResultCard
          imageUrl={imageUrl}
          result={result}
          onAddTask={taskAdded ? null : handleAddTask}
          onRetake={handleRetake}
        />
      ) : null}

      {taskAdded ? (
        <p style={S.taskAdded} data-testid="soil-scan-task-added">
          {tSafe('soilScan.taskAddedNote', 'Task added — see it on the Tasks page.')}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => { try { navigate('/scan'); } catch { /* swallow */ } }}
        style={S.backLink}
        className="ff-tap"
        data-testid="soil-scan-back"
      >
        {'← '}
        {tSafe('soilScan.backToScan', 'Back to Scan')}
      </button>
    </PremiumPage>
  );
}

const S = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    padding: '1rem 1rem 1.15rem',
    borderRadius: T.radiusCard,
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
  },
  preview: {
    width: '100%',
    height: 240,
    objectFit: 'cover',
    borderRadius: 14,
    border: `1px solid ${T.border}`,
  },
  placeholder: {
    width: '100%',
    height: 200,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.55rem',
    background: T.ochreSoft,
    border: `1px dashed ${T.ochreBorder}`,
    borderRadius: 14,
    color: T.ochreInk,
    textAlign: 'center',
    padding: '1rem',
  },
  placeholderIcon: { fontSize: '2rem' },
  placeholderText: {
    fontSize: '0.875rem',
    fontWeight: 600,
    maxWidth: 280,
  },
  hiddenFileInput: {
    position: 'absolute',
    width: 1, height: 1,
    margin: -1, padding: 0,
    border: 0, overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  },
  captureRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  btnPrimary: {
    flex: 1,
    padding: '0.85rem 1.25rem',
    border: 'none',
    borderRadius: 999,
    background: 'linear-gradient(180deg, #D4A35F 0%, #B9853F 100%)',
    color: '#FFFFFF',
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 46,
    boxShadow: '0 10px 24px rgba(185,133,63,0.32)',
    fontFamily: 'inherit',
    letterSpacing: '0.005em',
  },
  cueBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  cueLabel: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 700,
    color: T.inkDim,
    letterSpacing: '0.005em',
  },
  cueRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
  },
  cueChip: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    padding: '0.45rem 0.85rem',
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 700,
    minHeight: 32,
    border: '1px solid transparent',
    letterSpacing: '0.005em',
    whiteSpace: 'nowrap',
  },
  btnAnalyze: {
    width: '100%',
    padding: '0.95rem 1.25rem',
    border: 'none',
    borderRadius: 999,
    background: 'linear-gradient(180deg, #5E8E5E 0%, #3F6A3F 100%)',
    color: '#FFFFFF',
    fontSize: '1rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 50,
    boxShadow: '0 10px 24px rgba(63,106,63,0.32)',
    fontFamily: 'inherit',
    letterSpacing: '0.005em',
  },
  error: {
    margin: 0,
    background: 'rgba(209,77,77,0.10)',
    border: '1px solid rgba(209,77,77,0.30)',
    color: '#9B2A2A',
    padding: '0.55rem 0.85rem',
    borderRadius: 10,
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  privacy: {
    margin: 0,
    fontSize: '0.72rem',
    color: T.inkFaint,
    lineHeight: 1.45,
  },
  taskAdded: {
    margin: 0,
    padding: '0.6rem 0.9rem',
    background: 'rgba(94,142,94,0.12)',
    border: '1px solid rgba(94,142,94,0.36)',
    borderRadius: 12,
    color: '#3F6A3F',
    fontSize: '0.85rem',
    fontWeight: 700,
    textAlign: 'center',
  },
  backLink: {
    appearance: 'none',
    fontFamily: 'inherit',
    background: 'transparent',
    border: 'none',
    color: T.ochreInk,
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '0.5rem',
    alignSelf: 'flex-start',
  },
};
