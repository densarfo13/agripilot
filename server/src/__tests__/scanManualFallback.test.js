/**
 * scanManualFallback.test.js — Final Scan Preview + Gallery-First
 * Fix §2 (gallery-first) and §5 (manual issue picker).
 *
 * A low-confidence or AI-unavailable scan must never dead-end:
 * the farmer picks what they see from six options, and the pick
 * is genuinely persisted (journal + follow-up task). When the
 * camera itself fails, the gallery becomes the primary action.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MANUAL_ISSUES } from '../../../src/components/scan/ManualIssuePicker.jsx';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. The six manual issue options (spec §5) ────────────

describe('ManualIssuePicker — manual issue options', () => {
  it('offers exactly the six spec-mandated options', () => {
    const labels = MANUAL_ISSUES.map((i) => i.label);
    expect(labels).toEqual([
      'Yellow leaves', 'Brown spots', 'Insects',
      'Dry soil', 'Mold or rot', 'Not sure',
    ]);
  });

  it('every option maps to a known scan category + a follow-up', () => {
    const validCategories = new Set([
      'disease', 'pest', 'fungal', 'nutrient_deficiency', 'needs_review',
    ]);
    for (const issue of MANUAL_ISSUES) {
      expect(typeof issue.id).toBe('string');
      expect(validCategories.has(issue.category)).toBe(true);
      expect(typeof issue.followUp).toBe('string');
      expect(issue.followUp.length).toBeGreaterThan(0);
    }
  });
});

// ─── 2. The pick is genuinely persisted (spec §5) ─────────

describe('ManualIssuePicker — persistence wiring', () => {
  const src = read('src/components/scan/ManualIssuePicker.jsx');

  it('saves the manual observation to the scan journal', () => {
    expect(src).toMatch(/import \{ saveScanUseful \} from '\.\.\/\.\.\/lib\/scan\/scanHistoryStore\.js'/);
    expect(src).toMatch(/saveScanUseful\(/);
  });

  it('creates a follow-up task via addScanTasks', () => {
    expect(src).toMatch(/import \{ addScanTasks \} from '\.\.\/\.\.\/core\/scanToTask\.js'/);
    expect(src).toMatch(/addScanTasks\(/);
  });

  it('records the pick honestly as a manual observation, not AI', () => {
    expect(src).toMatch(/source:\s*'manual'/);
    expect(src).toMatch(/confidence:\s*'manual'/);
  });

  it('shows a calm "Saved to your journal" confirmation after a pick', () => {
    expect(src).toMatch(/Saved to your journal/);
  });
});

// ─── 3. Gallery-first + manual picker wired into ScanFallback ─

describe('ScanFallback — gallery-first + manual picker', () => {
  const src = read('src/components/scan/ScanFallback.jsx');

  it('defines the camera-fail reason set for gallery-first', () => {
    expect(src).toMatch(/CAMERA_FAIL_REASONS/);
    for (const r of ['camera_unavailable', 'permission_denied', 'unsupported', 'timeout']) {
      expect(src).toMatch(new RegExp("'" + r + "'"));
    }
  });

  it('makes "Use a saved photo" the PRIMARY action when the camera failed', () => {
    expect(src).toMatch(/galleryFirst/);
    // Inspect the gallery-first JSX branch specifically.
    const start = src.indexOf('galleryFirst ? (');
    expect(start).toBeGreaterThan(-1);
    const branch = src.slice(start, src.indexOf(') : (', start));
    expect(branch).toMatch(/Use a saved photo/);
    expect(branch).toMatch(/scan-fallback-upload/);
    expect(branch).toMatch(/S\.primaryBtn/);
  });

  it('renders ManualIssuePicker for low-confidence / AI-unavailable', () => {
    expect(src).toMatch(/import ManualIssuePicker from '\.\/ManualIssuePicker\.jsx'/);
    expect(src).toMatch(/MANUAL_PICKER_REASONS/);
    expect(src).toMatch(/'low_confidence'/);
    expect(src).toMatch(/'ai_unavailable'/);
    expect(src).toMatch(/showManualPicker && <ManualIssuePicker/);
  });
});
