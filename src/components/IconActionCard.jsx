/**
 * IconActionCard — large, mobile-first action tile for the farmer
 * home / hub surface.
 *
 * Each card is icon-first (the only universally readable element in
 * a low-literacy context) plus a short translated title and an
 * optional one-line subtitle. A built-in 🔊 VoiceButton reads the
 * title (and subtitle, if present) aloud so a farmer who can't read
 * the language fluently can still navigate.
 *
 * Visible text rules
 * ──────────────────
 *   • Title and subtitle MUST come from `titleKey` / `subtitleKey`,
 *     resolved via tStrict — i.e. no English leak in non-English UI.
 *   • Caller MAY pass an explicit `titleFallback` / `subtitleFallback`
 *     for extra safety; these are treated as deliberate caller
 *     decisions and used only when the key is missing.
 *   • Crop names should never be rendered through this card directly;
 *     the caller resolves them via getCropLabelSafe(value, lang, t).
 *
 * Layout
 * ──────
 *   ┌─────────────────────────┐
 *   │ 🌱        🔊            │   ← icon (xl) + voice button
 *   │ Title                   │
 *   │ subtitle (optional)     │
 *   └─────────────────────────┘
 *
 * In low-literacy mode (driven by AppSettings or localStorage flag,
 * see useLowLiteracyMode) the icon scales up and the subtitle is
 * hidden by default to reduce reading load.
 *
 * Props
 * ─────
 *   icon             string — emoji or single character; required
 *   titleKey         string — required; resolved via tStrict
 *   titleFallback    string — caller fallback (used only on missing key)
 *   subtitleKey      string — optional
 *   subtitleFallback string — optional caller fallback
 *   onClick          () => void — optional handler; whole card is the hit target
 *   showVoice        boolean = true — set false to hide the speaker
 *   className        string — extra classes
 *   ariaKey          string — i18n key for aria-label override
 */

import { useCallback, useMemo } from 'react';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tStrict } from '../i18n/strictT.js';
import VoiceButton from './VoiceButton.jsx';
import useLowLiteracyMode from '../hooks/useLowLiteracyMode.js';

export default function IconActionCard({
  icon = '•',
  titleKey,
  titleFallback = '',
  subtitleKey = '',
  subtitleFallback = '',
  onClick,
  showVoice = true,
  className = '',
  ariaKey = '',
}) {
  // Subscribe to language change — bound t() not used here, but the
  // hook re-renders the card when language flips, which causes
  // tStrict() (called below at render) to pick the new value.
  useTranslation();
  const { enabled: simpleMode } = useLowLiteracyMode();

  const title    = useMemo(() => tStrict(titleKey, titleFallback),       [titleKey, titleFallback, simpleMode]);
  const subtitle = useMemo(() => subtitleKey ? tStrict(subtitleKey, subtitleFallback) : '', [subtitleKey, subtitleFallback, simpleMode]);

  // Combined string for voice playback. Reading icon name aloud is
  // useless ("rocket"), so we read title + subtitle only.
  const spoken = subtitle ? `${title}. ${subtitle}` : title;

  const handleClick = useCallback(() => {
    if (typeof onClick === 'function') {
      try { onClick(); } catch { /* never propagate from a card click */ }
    }
  }, [onClick]);

  const handleKey = useCallback((e) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [onClick, handleClick]);

  const aria = ariaKey ? tStrict(ariaKey, title) : title;

  const cls = [
    'icon-action-card',
    simpleMode ? 'icon-action-card--simple' : '',
    onClick ? 'icon-action-card--clickable' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={aria}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKey : undefined}
    >
      <div className="icon-action-card__row">
        <span className="icon-action-card__icon" aria-hidden="true">{icon}</span>
        {showVoice && spoken ? (
          <VoiceButton
            text={spoken}
            // Forward the title key so the engine can hit the
            // prerecorded-clip / provider-TTS tiers in voiceService
            // when a matching prompt exists (mainly Twi clips).
            labelKey={titleKey}
            size={simpleMode ? 'lg' : 'md'}
            className="icon-action-card__voice"
          />
        ) : null}
      </div>
      {title ? <div className="icon-action-card__title">{title}</div> : null}
      {!simpleMode && subtitle ? (
        <div className="icon-action-card__subtitle">{subtitle}</div>
      ) : null}
    </div>
  );
}
