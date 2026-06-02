/**
 * PlantSegmentationRuntime.ts — §PHASE 2.
 *
 * HONEST IMPLEMENTATION: this build does not yet ship a real
 * background-removal / plant-segmentation model. Per the standing
 * "no fake intelligence" rule, the runtime is structurally ready but
 * reports status: 'NEEDS_CONFIGURATION' and returns the original
 * image URL unchanged.
 *
 * It DOES provide one real, cheap step: a green-region bounding-box
 * heuristic that crops to the largest contiguous green region when
 * one is clearly present — useful as a coarse pre-crop even without
 * an ML segmenter.
 */

import type { SegmentationResult } from './ScanAccuracyContracts';
import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

/** Heuristic bounding-box crop around the dominant green region.
 *  Returns a NEW image URL (data URL) or null when no segmentation is
 *  possible. Never alters or persists the source image. */
async function _greenBBoxCrop(source: any, originalUrl: string | null)
  : Promise<string | null> {
  return _safe(async () => {
    if (typeof document === 'undefined') return null;
    const w0 = source.width || source.naturalWidth;
    const h0 = source.height || source.naturalHeight;
    if (!w0 || !h0) return null;

    // Downscale work canvas for bbox detection.
    const scale = Math.min(1, 192 / Math.max(w0, h0));
    const sw = Math.max(8, Math.round(w0 * scale));
    const sh = Math.max(8, Math.round(h0 * scale));

    const work = document.createElement('canvas');
    work.width = sw; work.height = sh;
    const wctx = work.getContext && work.getContext('2d');
    if (!wctx) return null;
    wctx.drawImage(source, 0, 0, sw, sh);
    const data = wctx.getImageData(0, 0, sw, sh).data;

    let minX = sw, minY = sh, maxX = -1, maxY = -1;
    let greenCount = 0;
    for (let y = 0, idx = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++, idx += 4) {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        if (g > r + 12 && g > b + 12 && g > 60) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          greenCount++;
        }
      }
    }
    // Require at least 15% green coverage AND a reasonable bbox.
    if (greenCount / (sw * sh) < 0.15 || maxX < minX || maxY < minY) return null;

    // Expand bbox by 10% so leaf edges aren't clipped.
    const padX = Math.round((maxX - minX) * 0.1);
    const padY = Math.round((maxY - minY) * 0.1);
    minX = Math.max(0, minX - padX);
    minY = Math.max(0, minY - padY);
    maxX = Math.min(sw - 1, maxX + padX);
    maxY = Math.min(sh - 1, maxY + padY);
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    // Reject tiny bbox.
    if (bw < sw * 0.25 || bh < sh * 0.25) return null;

    // Map bbox back to original resolution and emit a cropped data URL
    // at original quality (downstream identifier needs detail).
    const ow = Math.round(bw / scale);
    const oh = Math.round(bh / scale);
    const oX = Math.round(minX / scale);
    const oY = Math.round(minY / scale);

    const out = document.createElement('canvas');
    out.width = ow; out.height = oh;
    const octx = out.getContext && out.getContext('2d');
    if (!octx) return null;
    octx.drawImage(source, oX, oY, ow, oh, 0, 0, ow, oh);
    try {
      return out.toDataURL('image/jpeg', 0.85);
    } catch {
      return originalUrl;
    }
  }, null);
}

export async function segmentPlantRegion(source: any, originalUrl: string | null)
  : Promise<Readonly<SegmentationResult>> {
  return _safe(async () => {
    if (typeof document === 'undefined') {
      return Object.freeze<SegmentationResult>({
        segmented: false,
        status: 'NEEDS_CONFIGURATION',
        croppedImageUrl: originalUrl,
        reason: 'Canvas not available — server-side environment.',
        limitations:
          'No real ML segmenter is wired in this build. ' + GUIDANCE_TAIL,
      });
    }
    const cropped = await _greenBBoxCrop(source, originalUrl);
    if (cropped && cropped !== originalUrl) {
      return Object.freeze<SegmentationResult>({
        segmented: true,
        status: 'OK',
        croppedImageUrl: cropped,
        reason: 'Cropped to dominant green region (heuristic — not an ML segmenter).',
        limitations:
          'Heuristic bounding-box only; a real plant/background segmenter is not yet wired. '
          + GUIDANCE_TAIL,
      });
    }
    return Object.freeze<SegmentationResult>({
      segmented: false,
      status: 'NEEDS_CONFIGURATION',
      croppedImageUrl: originalUrl,
      reason: 'Could not isolate a green region — sending original image to identifier.',
      limitations:
        'No real ML segmenter is wired in this build. ' + GUIDANCE_TAIL,
    });
  }, Promise.resolve(Object.freeze<SegmentationResult>({
    segmented: false,
    status: 'FAILED' as const,
    croppedImageUrl: originalUrl,
    reason: 'Segmentation runtime threw.',
    limitations: 'Recoverable failure; original image passed through. ' + GUIDANCE_TAIL,
  })) as any);
}

export function plantSegmentationReady(): boolean {
  return _safe(() => typeof document !== 'undefined'
    && typeof document.createElement === 'function', false);
}
