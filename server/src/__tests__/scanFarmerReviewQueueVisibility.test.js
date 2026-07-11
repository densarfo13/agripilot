import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Repo root — the runner uses cwd=server/, so resolve up 3 from this file.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.resolve(ROOT, rel), 'utf-8');

// P2 — the internal review-queue COUNT is an admin workflow and must never
// reach farmers. The farmer-facing Recent Scans card shows completed history
// only; pending reviews surface as a neutral, COUNTLESS link.
describe('P2 — farmer Recent Scans hides the internal review-queue count', () => {
  const code = read('src/components/scan/RecentScansCard.jsx');

  it('does NOT render the Review Queue count pill', () => {
    expect(code).not.toContain('recent-scans-review-queue');
  });

  it('does NOT compute or expose the untrusted count to farmers', () => {
    expect(code).not.toContain('_reviewCount');
    expect(code).not.toMatch(/\(\{\s*_reviewCount\s*\}\)/);
    expect(code).not.toContain("tSafe('scanReview.queue'");
  });

  it('shows a neutral, countless "Expert reviews pending" link when reviews exist', () => {
    expect(code).toContain('recent-scans-expert-review');
    expect(code).toContain('recentScans.expertReviewPending');
    // The link must carry NO number near it.
    const idx = code.indexOf('recent-scans-expert-review');
    const around = code.slice(idx, idx + 400);
    expect(around).not.toMatch(/\{\s*_?[a-zA-Z]*[Cc]ount\s*\}/);
  });

  it('shows an empty-completed state when there are scans but none completed', () => {
    expect(code).toContain('recent-scans-empty');
    expect(code).toContain('recentScans.noCompleted');
  });

  it('still filters rows to trusted scans via the trust gate', () => {
    expect(code).toContain('evaluateScanTrust');
    expect(code).toContain('_isTrustedRow');
  });
});
