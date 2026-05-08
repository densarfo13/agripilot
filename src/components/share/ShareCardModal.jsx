/**
 * ShareCardModal — bottom-sheet preview + share actions.
 *
 *   <ShareCardModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     plant={plant}                  // PlantProfile from usePlantIdentity
 *     category="general"             // see encouragementCaptions categories
 *     overrideCaption={null}         // optional — caller can provide
 *   />
 *
 * Composition:
 *   1. Title + close
 *   2. Centered ShareableCard preview (square)
 *   3. Action row: [Share] [Copy] [Close]
 *   4. Toast feedback after action
 *
 * Strict-rule audit
 *   • All hooks unconditional.
 *   • Never throws — share orchestrator + clipboard wrapped.
 *   • Esc + backdrop close.
 *   • Localized via tSafe + useStrictTranslation.
 *   • OPT-IN sharing — modal only renders when caller passes open=true.
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { useStrictTranslation } from '../../i18n/useStrictTranslation.js';
import ShareableCard from './ShareableCard.jsx';
import {
  shareCard, canShareNatively, canCopyToClipboard,
} from '../../lib/share/shareCard.js';
import { pickCaption, inferCategory } from '../../lib/share/encouragementCaptions.js';
import {
  renderShareCardPng, triggerPngDownload, canShareImageFiles,
} from '../../lib/share/cardToPng.js';

export default function ShareCardModal({
  open            = false,
  onClose,
  plant           = null,
  category        = null,        // explicit category — overrides inferred
  memory          = null,        // for inferCategory when category is null
  overrideCaption = null,
}) {
  useStrictTranslation();

  // Local state — last action result (for the small toast).
  const [status, setStatus] = useState(null); // 'shared' | 'copied' | 'cancelled' | 'failed' | null

  // Reset toast on open.
  useEffect(() => {
    if (open) setStatus(null);
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e && e.key === 'Escape' && typeof onClose === 'function') onClose();
    };
    try { window.addEventListener('keydown', onKey); }
    catch { /* swallow */ }
    return () => {
      try { window.removeEventListener('keydown', onKey); }
      catch { /* swallow */ }
    };
  }, [open, onClose]);

  // Resolve caption ONCE per open so the user sees a stable value.
  // Caller can override by passing overrideCaption.
  const captionRow = useMemo(() => {
    try {
      if (overrideCaption && overrideCaption.key) return overrideCaption;
      const cat = category || inferCategory(memory);
      return pickCaption({
        category:   cat,
        seed:       plant?.nickname || cat,
        streakDays: memory?.careStreakDays || 0,
      });
    } catch {
      return { key: 'share.caption.general.steady', fallback: 'Steady care makes a difference.' };
    }
  }, [category, memory, overrideCaption, plant]);

  const localizedCaption = tSafe(captionRow.key, captionRow.fallback);
  const stage = plant?.growthStage || 'growing';
  const nickname = (plant?.nickname && plant.nickname !== 'My Plant')
    ? plant.nickname
    : tSafe('plant.fallback.nickname', 'My Plant');

  // Action handlers ────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    setStatus(null);
    const r = await shareCard({
      title:   nickname,
      text:    localizedCaption,
      url:     'https://farroway.app',
      hashtag: tSafe('share.hashtag', '#FarrowayGarden'),
    });
    if (r.ok && r.via === 'native')    setStatus('shared');
    else if (r.ok && r.via === 'clipboard') setStatus('copied');
    else if (r.reason === 'cancelled') setStatus('cancelled');
    else                               setStatus('failed');
  }, [nickname, localizedCaption]);

  // Build the PNG blob shared by Download + Image-share. Returns
  // null when rendering failed (caller surfaces a 'failed' toast).
  const buildPngBlob = useCallback(async () => {
    try {
      return await renderShareCardPng({
        nickname,
        stage,
        photoUrl: plant?.photo || null,
        caption:  localizedCaption,
        brand:    'Farroway',
        size:     720,
      });
    } catch { return null; }
  }, [nickname, stage, plant, localizedCaption]);

  const handleDownload = useCallback(async () => {
    setStatus(null);
    const blob = await buildPngBlob();
    if (!blob) { setStatus('failed'); return; }
    const safeName = (nickname || 'plant')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 32) || 'plant';
    const ok = triggerPngDownload(blob, `farroway-${safeName}.png`);
    setStatus(ok ? 'downloaded' : 'failed');
  }, [buildPngBlob, nickname]);

  const handleShareImage = useCallback(async () => {
    setStatus(null);
    const blob = await buildPngBlob();
    if (!blob) { setStatus('failed'); return; }
    try {
      const file = new File([blob], 'farroway-plant.png', { type: 'image/png' });
      if (typeof navigator !== 'undefined'
          && typeof navigator.share === 'function'
          && (typeof navigator.canShare !== 'function'
              || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          files:  [file],
          title:  nickname,
          text:   `${localizedCaption}  ${tSafe('share.hashtag', '#FarrowayGarden')}`,
        });
        setStatus('shared');
        return;
      }
    } catch (err) {
      const name = err && err.name;
      if (name === 'AbortError' || /abort|cancel/i.test(String(err?.message || ''))) {
        setStatus('cancelled');
        return;
      }
      // Fall through to download.
    }
    // No image share path — fall back to a download so the user
    // still walks away with a shareable file.
    const safeName = (nickname || 'plant')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 32) || 'plant';
    const ok = triggerPngDownload(blob, `farroway-${safeName}.png`);
    setStatus(ok ? 'downloaded' : 'failed');
  }, [buildPngBlob, nickname, localizedCaption]);

  const handleCopy = useCallback(async () => {
    setStatus(null);
    try {
      const payload = `${nickname}\n${localizedCaption}\nhttps://farroway.app`;
      if (typeof navigator !== 'undefined'
          && navigator.clipboard
          && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(payload);
        setStatus('copied');
      } else {
        setStatus('failed');
      }
    } catch {
      setStatus('failed');
    }
  }, [nickname, localizedCaption]);

  if (!open) return null;

  const shareLabel  = canShareNatively() ? tSafe('share.action.share', 'Share') : tSafe('share.action.shareUnsupported', 'Share');
  const copyLabel   = canCopyToClipboard() ? tSafe('share.action.copy', 'Copy text') : null;

  return (
    <div
      style={S.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && typeof onClose === 'function') onClose();
      }}
      data-testid="share-card-modal-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-card-modal-title"
        style={S.sheet}
        data-testid="share-card-modal"
      >
        <header style={S.head}>
          <h2 id="share-card-modal-title" style={S.title}>
            {tSafe('share.modal.title', 'Share your plant moment')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={S.closeBtn}
            aria-label={tSafe('common.close', 'Close')}
            data-testid="share-card-modal-close"
          >
            ✕
          </button>
        </header>

        <div style={S.previewWrap}>
          <ShareableCard
            nickname={nickname}
            stage={stage}
            photo={plant?.photo || null}
            caption={localizedCaption}
          />
        </div>

        {/* Tiny status toast — replaces itself; never accumulates. */}
        {status && (
          <p style={S.toast} data-testid="share-card-status" data-status={status}>
            {status === 'shared'     && tSafe('share.toast.shared',     'Shared.')}
            {status === 'downloaded' && tSafe('share.toast.downloaded', 'Image saved to your device.')}
            {status === 'copied'     && tSafe('share.toast.copied',     'Copied to clipboard.')}
            {status === 'cancelled'  && tSafe('share.toast.cancelled',  'Share cancelled.')}
            {status === 'failed'     && tSafe('share.toast.failed',     'Could not share — try again.')}
          </p>
        )}

        <footer style={S.foot}>
          {/* Image share — primary path on mobile (Instagram, WhatsApp,
              Messages all accept image/png via the native share sheet).
              Renders the SVG → PNG client-side; falls back to a download
              when the platform doesn't support file sharing. */}
          {canShareImageFiles() ? (
            <button
              type="button"
              onClick={handleShareImage}
              style={S.primaryBtn}
              data-testid="share-card-share-image-btn"
            >
              {tSafe('share.action.shareImage', 'Share image')}
            </button>
          ) : null}
          {canShareNatively() && !canShareImageFiles() ? (
            <button
              type="button"
              onClick={handleShare}
              style={S.primaryBtn}
              data-testid="share-card-share-btn"
            >
              {shareLabel}
            </button>
          ) : null}
          {/* Always-available image download — works in every browser
              that supports canvas + URL.createObjectURL (universal
              modern). */}
          <button
            type="button"
            onClick={handleDownload}
            style={canShareImageFiles() || canShareNatively() ? S.secondaryBtn : S.primaryBtn}
            data-testid="share-card-download-btn"
          >
            {tSafe('share.action.download', 'Download image')}
          </button>
          {canCopyToClipboard() ? (
            <button
              type="button"
              onClick={handleCopy}
              style={S.secondaryBtn}
              data-testid="share-card-copy-btn"
            >
              {copyLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={S.cancelBtn}
            data-testid="share-card-cancel-btn"
          >
            {tSafe('common.close', 'Close')}
          </button>
        </footer>

        {/* Calm safety footer — confirms what we share, what we don't. */}
        <p style={S.safetyNote} data-testid="share-card-safety">
          {tSafe('share.safetyNote',
            'Only the card text and a Farroway link are shared — never your location, photos, or contact details.')}
        </p>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const S = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(8,16,12,0.62)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1100,
    animation: 'farroway-fade-in 200ms ease-out',
  },
  sheet: {
    width: '100%',
    maxWidth: '32rem',
    background: 'linear-gradient(180deg, #1A3128 0%, #163826 100%)',
    border:     '1px solid rgba(255,255,255,0.08)',
    borderTopLeftRadius: '20px',
    borderTopRightRadius: '20px',
    boxShadow:  '0 -16px 40px rgba(0,0,0,0.40)',
    display:    'flex',
    flexDirection: 'column',
    maxHeight:  '92vh',
    overflow:   'hidden',
    color:      '#FFFFFF',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    animation:  'farroway-slide-up 220ms ease-out',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.95rem 1.1rem 0.65rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  title: { margin: 0, fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.005em' },
  closeBtn: {
    appearance: 'none', border: 'none', background: 'transparent',
    color: 'rgba(255,255,255,0.65)', fontSize: '1.05rem',
    cursor: 'pointer', padding: '0.35rem 0.6rem',
    borderRadius: '8px',
  },
  previewWrap: {
    padding: '1rem 1rem 0.5rem',
    display: 'flex', justifyContent: 'center',
  },
  toast: {
    margin: '0 1rem 0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#86EFAC',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: '10px',
    textAlign: 'center',
  },
  foot: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    padding: '0.5rem 1rem 0.5rem',
  },
  primaryBtn: {
    flex: '1 1 auto',
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#062714',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: '44px',
  },
  secondaryBtn: {
    flex: '0 0 auto',
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.05)',
    color: '#FFFFFF',
    padding: '0.7rem 1rem',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: '44px',
  },
  cancelBtn: {
    flex: '0 0 auto',
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.65)',
    padding: '0.7rem 1rem',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: '44px',
  },
  safetyNote: {
    margin: '0.4rem 1rem 1rem',
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.5,
    textAlign: 'center',
  },
};
