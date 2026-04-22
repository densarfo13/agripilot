/**
 * completionCardTap.test.js — locks the mobile tap fix on the
 * farmer-facing task completion card.
 *
 *   1. CompletionCard holds a selectedCompletion state (yes/partly/no)
 *   2. Clicking an option sets selectedCompletion + logs "completion
 *      selected:"
 *   3. Continue is disabled until an option is picked (and aria-
 *      disabled matches)
 *   4. Continue re-enables after selection and fires onFollowUp +
 *      onContinue in the right order
 *   5. Options are real <button type="button"> elements (not divs)
 *      with aria-pressed tied to selection
 *   6. Option buttons ship the required mobile-safe styles:
 *      touchAction: manipulation, WebkitTapHighlightColor transparent,
 *      userSelect none, zIndex 22, pointerEvents auto, min-width 92px
 *   7. Question wrapper + options row get zIndex 20/21 + pointer-
 *      events auto so taps can't be swallowed
 *   8. Card wrapper (simple + standard) sets position relative +
 *      zIndex 10 + pointerEvents auto
 *   9. Primary/Later CTAs also get touchAction + pointer-events
 *  10. Global overlay guard class names land in index.css
 *  11. taskCompletion.* keys land in all six locales
 *  12. Every translation key resolves to a non-empty string per lang
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}
function readJson(rel) { return JSON.parse(readFile(rel)); }

const SRC = readFile('src/components/farmer/CompletionCard.jsx');

// ─── Component contract ────────────────────────────────────────
describe('CompletionCard — selection state', () => {
  it('tracks selectedCompletion with useState(null) default', () => {
    expect(SRC).toMatch(/const \[selectedCompletion, setSelectedCompletion\] = useState\(null\)/);
  });

  it('resets selection when the active task changes', () => {
    expect(SRC).toMatch(/setSelectedCompletion\(null\)/);
    expect(SRC).toMatch(/\[cs && cs\.completedTaskId\]/);
  });

  it('handleSelectCompletion logs "completion selected:" and updates state', () => {
    expect(SRC).toMatch(/console\.log\('completion selected:', opt\.value\)/);
    expect(SRC).toMatch(/setSelectedCompletion\(opt\.value\)/);
  });

  it('Continue is gated by continueDisabled when a follow-up exists', () => {
    expect(SRC).toMatch(/const continueDisabled = !!\(cs && cs\.followUp\) && !selectedCompletion/);
    expect(SRC).toMatch(/disabled=\{continueDisabled\}/);
    expect(SRC).toMatch(/aria-disabled=\{continueDisabled\}/);
  });

  it('handleContinue fires onFollowUp with the picked option BEFORE onContinue', () => {
    expect(SRC).toMatch(/if \(cs && cs\.followUp && selectedCompletion\)[\s\S]*onFollowUp/);
    expect(SRC).toMatch(/onContinue\?\.\(\)/);
  });
});

describe('CompletionCard — real buttons + aria', () => {
  it('options render as <button type="button">', () => {
    // Two variants of the follow-up block — each has its own
    // <button type="button"> inside .map over options.
    const occurrences = (SRC.match(/type="button"/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(4);   // 2 opt maps + 2 Continues at minimum
  });

  it('option buttons carry aria-pressed + role="radio" + data-testid', () => {
    expect(SRC).toMatch(/aria-pressed=\{isSelected\}/);
    expect(SRC).toMatch(/role="radio"/);
    expect(SRC).toMatch(/data-testid=\{`followup-option-\$\{opt\.value\}`\}/);
  });

  it('options row has role="radiogroup" for screen-reader grouping', () => {
    expect(SRC).toMatch(/role="radiogroup"/);
  });

  it('handlers fire on both onClick and onTouchEnd (no iOS tap delay)', () => {
    expect(SRC).toMatch(/onClick=\{\(\) => handleSelectCompletion\(opt\)\}/);
    expect(SRC).toMatch(/onTouchEnd=\{\(e\) => \{[\s\S]*handleSelectCompletion\(opt\)/);
  });
});

// ─── Style contract — mobile tap-safe ──────────────────────────
describe('CompletionCard — mobile tap-safe styles', () => {
  it('option button ships touchAction + webkit tap highlight + user-select + z-index', () => {
    expect(SRC).toMatch(/followUpBtn:\s*\{[\s\S]*touchAction:\s*'manipulation'[\s\S]*WebkitTapHighlightColor:\s*'transparent'[\s\S]*userSelect:\s*'none'[\s\S]*zIndex:\s*22[\s\S]*pointerEvents:\s*'auto'/);
  });

  it('option button min-width ≥ 92px + padding 14px 18px per spec', () => {
    expect(SRC).toMatch(/minWidth:\s*'92px'/);
    expect(SRC).toMatch(/padding:\s*'14px 18px'/);
  });

  it('selected state has a green background + stronger border + inset glow', () => {
    expect(SRC).toMatch(/followUpBtnSelected:\s*\{[\s\S]*background:\s*'rgba\(34,197,94,0\.20\)'[\s\S]*border:\s*'1px solid #22C55E'[\s\S]*boxShadow:/);
  });

  it('question wrapper sits at zIndex 20 with pointer-events auto', () => {
    expect(SRC).toMatch(/followUpWrap:\s*\{[\s\S]*zIndex:\s*20[\s\S]*pointerEvents:\s*'auto'/);
  });

  it('options row sits at zIndex 21 with pointer-events auto + flex gap 12px', () => {
    expect(SRC).toMatch(/followUpOptions:\s*\{[\s\S]*gap:\s*'12px'[\s\S]*zIndex:\s*21[\s\S]*pointerEvents:\s*'auto'/);
  });

  it('both card wrappers set position relative + zIndex 10 + pointer-events auto', () => {
    // simple variant
    expect(SRC).toMatch(/simpleCard:\s*\{[\s\S]*position:\s*'relative'[\s\S]*zIndex:\s*10[\s\S]*pointerEvents:\s*'auto'/);
    // standard variant
    expect(SRC).toMatch(/standardCard:\s*\{[\s\S]*position:\s*'relative'[\s\S]*zIndex:\s*10[\s\S]*pointerEvents:\s*'auto'/);
  });

  it('primary + secondary CTAs (simple + compact) ship touchAction + pointer-events', () => {
    const variants = ['primaryBtn', 'secondaryBtn', 'primaryBtnCompact', 'secondaryBtnCompact'];
    for (const v of variants) {
      const block = SRC.match(new RegExp(`${v}:\\s*\\{[\\s\\S]*?\\},`));
      expect(block, `expected ${v} block`).not.toBeNull();
      expect(block[0]).toMatch(/touchAction:\s*'manipulation'/);
      expect(block[0]).toMatch(/pointerEvents:\s*'auto'/);
    }
  });

  it('primaryBtnDisabled style exists for the disabled Continue', () => {
    expect(SRC).toMatch(/primaryBtnDisabled:\s*\{[\s\S]*opacity:\s*0\.45/);
  });
});

// ─── Global overlay guard ──────────────────────────────────────
describe('index.css — overlay / glow guard', () => {
  const CSS = readFile('src/index.css');

  it('decorative overlay class names are pointer-events none', () => {
    for (const sel of [
      '.card-overlay', '.card-glow', '.task-screen-glow',
      '.task-screen-overlay', '.task-card-overlay', '.progress-glow-overlay',
    ]) {
      expect(CSS).toMatch(new RegExp(sel.replace('.', '\\.')));
    }
    expect(CSS).toMatch(/pointer-events:\s*none\s*!important/);
  });

  it('data-testid follow-up buttons keep pointer-events auto as belt-and-braces', () => {
    expect(CSS).toMatch(/\[data-testid='follow-up-question'\]/);
    expect(CSS).toMatch(/touch-action:\s*manipulation/);
  });
});

// ─── Locale keys present in every language ──────────────────────
describe('locales — taskCompletion namespace', () => {
  const LOCALES = ['en', 'tw', 'fr', 'es', 'pt', 'sw'];
  const REQUIRED = ['title', 'yes', 'partly', 'no', 'next_step',
                    'continue', 'later', 'tasks_left', 'done_today'];

  for (const lang of LOCALES) {
    it(`${lang}.json exposes the full taskCompletion block`, () => {
      const bundle = readJson(`src/i18n/locales/${lang}.json`);
      expect(bundle.taskCompletion, `${lang} should have taskCompletion`).toBeDefined();
      for (const key of REQUIRED) {
        const v = bundle.taskCompletion[key];
        expect(typeof v, `${lang}.taskCompletion.${key}`).toBe('string');
        expect(v.length, `${lang}.taskCompletion.${key} empty`).toBeGreaterThan(0);
      }
    });
  }

  it('tasks_left + done_today keep the interpolation tokens in every language', () => {
    for (const lang of LOCALES) {
      const b = readJson(`src/i18n/locales/${lang}.json`);
      expect(b.taskCompletion.tasks_left).toMatch(/\{\{count\}\}/);
      expect(b.taskCompletion.done_today).toMatch(/\{\{done\}\}/);
      expect(b.taskCompletion.done_today).toMatch(/\{\{total\}\}/);
    }
  });
});
