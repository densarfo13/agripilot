/**
 * SmartText — composable label that combines an optional icon, a
 * strict translation lookup, and an optional tap-to-hear voice
 * button in one element.
 *
 * The component is intentionally small. It exists so per-page UI
 * code stops carrying a flat list of `<span aria-label="…">{icon}</span>`
 * + `tStrict(...)` + `<VoiceButton text={...} />` trios.
 *
 *   <SmartText k="farmerActions.tasks" icon="✅" />
 *   <SmartText k="farmerActions.scanCrop" icon="📸" speak />
 *   <SmartText k="some.key" fallback="Tap to start" />
 *
 * Props
 * ─────
 *   k          (required) i18n key, resolved via tStrict
 *   fallback   string used only when the key is missing — never an
 *               English auto-fallback (strict no-leak rule)
 *   icon       optional emoji / single character, prefixed
 *   speak      when true, renders a VoiceButton that speaks the
 *               resolved text in the active language
 *   className  extra class names appended to the wrapper
 *   as         optional element name ('span' default)
 *
 * Visible text
 * ────────────
 * All visible text routes through the existing strict translator
 * (`tStrict`), so a missing key in non-English UI returns the
 * caller-supplied fallback — never the English value.
 */

import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import VoiceButton from '../components/VoiceButton.jsx';

export default function SmartText({
  k,
  fallback = '',
  icon = '',
  speak = false,
  className = '',
  as: Tag = 'span',
}) {
  // Subscribe to language change — label refreshes on flip.
  useTranslation();

  const text = tStrict(k, fallback);
  const display = text || fallback || '';

  return (
    <Tag className={('smart-text ' + className).trim()}>
      {icon ? <span className="smart-text__icon" aria-hidden="true">{icon}</span> : null}
      {icon && display ? ' ' : null}
      {display ? <span className="smart-text__label">{display}</span> : null}
      {speak && display ? (
        <VoiceButton
          text={display}
          // Forward the i18n key so voiceEngine can hit the
          // prerecorded clip / provider TTS path when a matching
          // prompt exists (mainly Twi).
          labelKey={k}
          size="sm"
          className="smart-text__voice"
        />
      ) : null}
    </Tag>
  );
}
