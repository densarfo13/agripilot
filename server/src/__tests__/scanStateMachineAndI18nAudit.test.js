/**
 * scanStateMachineAndI18nAudit.test.js — verifies the two new
 * modules from the Permanent Scan + Language Fix:
 *   • src/core/scan/scanStateMachine.js
 *   • src/core/i18n/i18nAudit.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SCAN_STATE, SCAN_EVENT,
  nextScanState, canRunClassifier, classifierGate,
} from '../../../src/core/scan/scanStateMachine.js';
import {
  runI18nAudit, installI18nAuditHook,
} from '../../../src/core/i18n/i18nAudit.js';

// ─── scan state machine ──────────────────────────────────

describe('scanStateMachine — happy-path flow', () => {
  it('idle → choosing → preview_ready → analyzing → result_ready → saved', () => {
    let s = SCAN_STATE.IDLE;
    s = nextScanState(s, SCAN_EVENT.CHOOSE_GALLERY); expect(s).toBe(SCAN_STATE.CHOOSING);
    s = nextScanState(s, SCAN_EVENT.PREVIEW_READY);  expect(s).toBe(SCAN_STATE.PREVIEW_READY);
    s = nextScanState(s, SCAN_EVENT.ANALYZE_START);  expect(s).toBe(SCAN_STATE.ANALYZING);
    s = nextScanState(s, SCAN_EVENT.ANALYZE_OK);     expect(s).toBe(SCAN_STATE.RESULT_READY);
    s = nextScanState(s, SCAN_EVENT.SAVE_OK);        expect(s).toBe(SCAN_STATE.SAVED);
  });

  it('camera and gallery both reach choosing', () => {
    expect(nextScanState(SCAN_STATE.IDLE, SCAN_EVENT.CHOOSE_CAMERA))
      .toBe(SCAN_STATE.CHOOSING);
    expect(nextScanState(SCAN_STATE.IDLE, SCAN_EVENT.CHOOSE_GALLERY))
      .toBe(SCAN_STATE.CHOOSING);
  });
});

describe('scanStateMachine — failed_image path (the spec rule)', () => {
  it('image load fail during choose → failed_image', () => {
    expect(nextScanState(SCAN_STATE.CHOOSING, SCAN_EVENT.IMAGE_LOAD_FAIL))
      .toBe(SCAN_STATE.FAILED_IMAGE);
  });

  it('image load fail mid-analyze ALSO → failed_image (never publishes a result)', () => {
    expect(nextScanState(SCAN_STATE.ANALYZING, SCAN_EVENT.IMAGE_LOAD_FAIL))
      .toBe(SCAN_STATE.FAILED_IMAGE);
  });

  it('image load fail during preview ALSO → failed_image', () => {
    expect(nextScanState(SCAN_STATE.PREVIEW_READY, SCAN_EVENT.IMAGE_LOAD_FAIL))
      .toBe(SCAN_STATE.FAILED_IMAGE);
  });

  it('retake from failed_image → idle (operator can choose another)', () => {
    expect(nextScanState(SCAN_STATE.FAILED_IMAGE, SCAN_EVENT.RETAKE))
      .toBe(SCAN_STATE.IDLE);
  });
});

describe('scanStateMachine — failed_analysis path', () => {
  it('analyze fail → failed_analysis', () => {
    expect(nextScanState(SCAN_STATE.ANALYZING, SCAN_EVENT.ANALYZE_FAIL))
      .toBe(SCAN_STATE.FAILED_ANALYSIS);
  });

  it('user can retry from failed_analysis → analyzing', () => {
    expect(nextScanState(SCAN_STATE.FAILED_ANALYSIS, SCAN_EVENT.ANALYZE_START))
      .toBe(SCAN_STATE.ANALYZING);
  });
});

describe('scanStateMachine — invalid transitions', () => {
  it('invalid event returns the current state unchanged', () => {
    expect(nextScanState(SCAN_STATE.IDLE, SCAN_EVENT.ANALYZE_START)).toBe(SCAN_STATE.IDLE);
    expect(nextScanState(SCAN_STATE.PREVIEW_READY, SCAN_EVENT.SAVE_OK))
      .toBe(SCAN_STATE.PREVIEW_READY);
  });

  it('unknown state falls back to idle', () => {
    expect(nextScanState('bogus', SCAN_EVENT.CHOOSE_GALLERY))
      .toBe(SCAN_STATE.CHOOSING);
  });

  it('never throws on garbage input', () => {
    expect(() => nextScanState(null, null)).not.toThrow();
    expect(() => nextScanState(undefined, undefined)).not.toThrow();
  });
});

// ─── classifier gate — the safety rule ───────────────────

describe('canRunClassifier — the safety gate', () => {
  it('false on idle / choosing / failed_image / saved / result_ready', () => {
    expect(canRunClassifier(SCAN_STATE.IDLE)).toBe(false);
    expect(canRunClassifier(SCAN_STATE.CHOOSING)).toBe(false);
    expect(canRunClassifier(SCAN_STATE.FAILED_IMAGE)).toBe(false);
    expect(canRunClassifier(SCAN_STATE.SAVED)).toBe(false);
    expect(canRunClassifier(SCAN_STATE.RESULT_READY)).toBe(false);
  });

  it('true on preview_ready / analyzing when no image supplied', () => {
    expect(canRunClassifier(SCAN_STATE.PREVIEW_READY)).toBe(true);
    expect(canRunClassifier(SCAN_STATE.ANALYZING)).toBe(true);
  });

  it('false on preview_ready with a broken image record', () => {
    expect(canRunClassifier(SCAN_STATE.PREVIEW_READY, {})).toBe(false);
    expect(canRunClassifier(SCAN_STATE.PREVIEW_READY,
      { objectUrl: '', size: 0 })).toBe(false);
  });

  it('true on preview_ready with a valid image record', () => {
    expect(canRunClassifier(SCAN_STATE.PREVIEW_READY,
      { objectUrl: 'blob:x', size: 1024 })).toBe(true);
    expect(canRunClassifier(SCAN_STATE.PREVIEW_READY,
      { dataUrlBackup: 'data:image/jpeg;base64,...', size: 2048 })).toBe(true);
  });

  it('never throws on garbage input', () => {
    expect(() => canRunClassifier(null)).not.toThrow();
    expect(() => canRunClassifier('bogus', null)).not.toThrow();
  });
});

describe('classifierGate — message envelopes', () => {
  it('failed_image → message envelope contains "could not be loaded"', () => {
    const r = classifierGate(SCAN_STATE.FAILED_IMAGE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('failed_image');
    expect(r.message.fallback).toMatch(/could not be loaded/i);
    expect(r.message.key).toBeTruthy();
  });

  it('idle/choosing → "choose a photo" message', () => {
    const r = classifierGate(SCAN_STATE.IDLE);
    expect(r.ok).toBe(false);
    expect(r.message.fallback).toMatch(/choose/i);
  });

  it('preview_ready + valid record → ok: true', () => {
    expect(classifierGate(SCAN_STATE.PREVIEW_READY, { objectUrl: 'blob:x', size: 10 }).ok)
      .toBe(true);
  });

  it('never throws on garbage input', () => {
    expect(() => classifierGate(null)).not.toThrow();
  });
});

// ─── i18n audit ──────────────────────────────────────────

describe('runI18nAudit', () => {
  beforeEach(() => {
    // Reset minimal browser shim
    globalThis.window = globalThis.window || {};
    globalThis.document = undefined;
  });

  it('returns a skipped report under SSR context', () => {
    delete globalThis.window;
    delete globalThis.document;
    const r = runI18nAudit();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('ssr_context');
  });

  it('returns empty candidates when locale is English', () => {
    globalThis.window = { __farrowayLocale: 'en' };
    globalThis.document = {
      documentElement: { lang: 'en' },
      body:            { tagName: 'BODY' },
      createTreeWalker: () => ({ nextNode: () => null }),
    };
    const r = runI18nAudit();
    expect(r.ok).toBe(true);
    expect(r.isEnglishLocale).toBe(true);
    expect(r.candidates).toEqual([]);
  });

  it('flags long English words under a non-English locale', () => {
    globalThis.window = { __farrowayLocale: 'sw' };
    let walkerCalls = 0;
    const nodes = [
      _mkTextNode('Continue tomorrow', 'BUTTON'),
      _mkTextNode('Selamat siang', 'SPAN'),       // not English-looking under our heuristic
      _mkTextNode('Submit', 'BUTTON'),            // short
      _mkTextNode('Open Journal Entry', 'A'),     // English
    ];
    globalThis.document = {
      documentElement: { lang: 'sw' },
      body:            { tagName: 'BODY' },
      createTreeWalker: () => ({
        nextNode: () => walkerCalls < nodes.length ? nodes[walkerCalls++] : null,
      }),
    };
    const r = runI18nAudit();
    expect(r.ok).toBe(true);
    expect(r.locale).toBe('sw');
    expect(r.candidates.length).toBeGreaterThan(0);
    const snippets = r.candidates.map((c) => c.snippet);
    expect(snippets.some((s) => /continue/i.test(s))).toBe(true);
  });

  it('respects data-i18n-ignore=true', () => {
    globalThis.window = { __farrowayLocale: 'fr' };
    let i = 0;
    const ignoredParent = {
      tagName: 'SPAN',
      getAttribute: (a) => a === 'data-i18n-ignore' ? 'true' : null,
      parentElement: null,
    };
    const node = {
      nodeValue: 'English brand label',
      parentElement: ignoredParent,
    };
    globalThis.document = {
      documentElement: { lang: 'fr' },
      body: { tagName: 'BODY' },
      createTreeWalker: () => ({ nextNode: () => i++ === 0 ? node : null }),
    };
    const r = runI18nAudit();
    expect(r.candidates).toEqual([]);
  });

  it('never throws on garbage input', () => {
    delete globalThis.window;
    delete globalThis.document;
    expect(() => runI18nAudit()).not.toThrow();
    expect(() => runI18nAudit({ strict: true })).not.toThrow();
  });
});

describe('installI18nAuditHook', () => {
  beforeEach(() => { delete globalThis.window; });

  it('returns false under SSR', () => {
    expect(installI18nAuditHook()).toBe(false);
  });

  it('installs window.__i18nAudit and returns true', () => {
    globalThis.window = {};
    expect(installI18nAuditHook()).toBe(true);
    expect(typeof globalThis.window.__i18nAudit).toBe('function');
  });

  it('idempotent — does not overwrite an existing __i18nAudit', () => {
    const existing = () => 'pre-existing';
    globalThis.window = { __i18nAudit: existing };
    installI18nAuditHook();
    expect(globalThis.window.__i18nAudit).toBe(existing);
  });
});

// helper
function _mkTextNode(text, parentTag) {
  return {
    nodeValue: text,
    parentElement: { tagName: parentTag, getAttribute: () => null, parentElement: null },
  };
}
