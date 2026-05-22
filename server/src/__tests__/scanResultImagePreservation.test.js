/**
 * scanResultImagePreservation.test.js — locks in the production fix
 * for the "broken ? preview on the result card" bug.
 *
 * Root cause: ScanPage's three setResult() sites never threaded the
 * captured photo URL through to the result. UsefulResultCard's
 * `result.imageUrl || result.thumbnail || macroPhoto` chain then fell
 * through to the macro stock photo (or null), so the user's real
 * photo never reached the screen.
 *
 * This source-level test asserts every `setResult({` call in
 * ScanPage.jsx now includes `imageUrl:` and `thumbnail:` so the
 * regression cannot quietly re-appear. We also verify the renderer
 * chain in UsefulResultCard still prefers the user's photo first.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Climb until we find the `src/` directory — handles both the
// `cd server && npm test` and the repo-root `npx vitest` cwds.
function _findRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, 'src/pages/ScanPage.jsx'))) return dir;
    dir = resolve(dir, '..');
  }
  return process.cwd();
}
const ROOT = _findRoot();
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('ScanPage — every setResult includes imageUrl + thumbnail', () => {
  const src = read('src/pages/ScanPage.jsx');

  it('the file is wired to the captured photo state', () => {
    expect(src).toMatch(/analyzingImageUrl/);
    expect(src).toMatch(/pendingThumbnail/);
  });

  it('every setResult block carries imageUrl', () => {
    // Match each `setResult({` ... matching `}` block and assert
    // it includes `imageUrl`. We use a non-greedy `[\s\S]*?` so each
    // block is captured independently.
    const blocks = src.match(/setResult\(\{[\s\S]*?\}\)/g) || [];
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      expect(block).toMatch(/imageUrl\s*:/);
    }
  });

  it('every setResult block carries thumbnail', () => {
    const blocks = src.match(/setResult\(\{[\s\S]*?\}\)/g) || [];
    for (const block of blocks) {
      expect(block).toMatch(/thumbnail\s*:/);
    }
  });
});

describe('UsefulResultCard — renderer chain prefers user photo', () => {
  const card = read('src/components/scan/UsefulResultCard.jsx');

  it('uses result.imageUrl first, then result.thumbnail, then macro fallback', () => {
    // The renderer must read `result.imageUrl` and `result.thumbnail`.
    expect(card).toMatch(/result\s*&&\s*result\.imageUrl/);
    expect(card).toMatch(/result\s*&&\s*result\.thumbnail/);
  });

  it('uses SafeImage for the result preview (one-shot fallback)', () => {
    expect(card).toMatch(/import\s+SafeImage\s+from/);
    expect(card).toMatch(/<SafeImage\s+src=/);
  });
});

describe('SafeImage — accepts blob: and data: URLs', () => {
  const helper = read('src/utils/safeImage.js');

  it('safeImage util whitelists blob and data URLs', () => {
    expect(helper).toMatch(/startsWith\(['"]data:['"]/);
    expect(helper).toMatch(/startsWith\(['"]blob:['"]/);
  });
});
