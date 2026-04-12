// ─── Image Analysis Service ────────────────────────────────────────────────
// Image quality assessment and crop issue detection.
// ML inference is stubbed — DB operations and response shapes are production-ready.

import prisma from '../../lib/prisma.js';

// ─── Issue Categories & Weights ────────────────────────────────────────────

const ISSUE_CATEGORIES = [
  { key: 'pest', weight: 0.35, indicators: ['bite_marks', 'holes', 'stippling', 'frass', 'webbing'] },
  { key: 'disease', weight: 0.30, indicators: ['discoloration', 'lesions', 'wilting', 'mold', 'spots'] },
  { key: 'nutrient_deficiency', weight: 0.15, indicators: ['yellowing', 'stunted_growth', 'pale_leaves', 'interveinal_chlorosis'] },
  { key: 'water_heat_stress', weight: 0.12, indicators: ['curling', 'browning_tips', 'drooping', 'scorching'] },
  { key: 'uncertain', weight: 0.08, indicators: ['unclear_pattern', 'mixed_signals'] },
];

/**
 * Select a weighted-random issue category.
 * @returns {{ key: string, indicators: string[] }}
 */
function pickWeightedIssue() {
  const total = ISSUE_CATEGORIES.reduce((sum, c) => sum + c.weight, 0);
  let rand = Math.random() * total;
  for (const cat of ISSUE_CATEGORIES) {
    rand -= cat.weight;
    if (rand <= 0) return cat;
  }
  return ISSUE_CATEGORIES[0];
}

/**
 * Pick a random subset of indicators from an array.
 * @param {string[]} indicators
 * @param {number} min
 * @param {number} max
 * @returns {string[]}
 */
function pickIndicators(indicators, min = 1, max = 3) {
  const count = Math.min(indicators.length, min + Math.floor(Math.random() * (max - min + 1)));
  const shuffled = [...indicators].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Clamp a value to 0–100.
 * @param {number} v
 * @returns {number}
 */
function clamp(v) {
  return Math.min(100, Math.max(0, v));
}

// ─── Exported Functions ────────────────────────────────────────────────────

/**
 * Assess image quality for usability in crop analysis.
 *
 * STUB: Replace with real ML model inference (e.g. Sharp for blur/exposure,
 * TensorFlow for content classification). Current implementation returns
 * simulated quality scores.
 *
 * @param {string} imageUrl - URL or path to the image
 * @returns {Promise<{ qualityScore: number, issues: string[], isUsable: boolean }>}
 */
export async function assessImageQuality(imageUrl) {
  try {
    // STUB: Replace with real ML model inference
    // Real implementation would use Sharp to check:
    //   - resolution (min 640x480)
    //   - blur detection (laplacian variance)
    //   - exposure (histogram analysis)
    //   - content relevance (TF model: is this a crop image?)
    const qualityScore = clamp(70 + Math.floor(Math.random() * 26)); // 70-95
    const issues = [];

    // Simulate occasional quality issues
    if (qualityScore < 75) {
      issues.push('slightly_blurry');
    }
    if (Math.random() < 0.1) {
      issues.push('low_contrast');
    }

    const isUsable = qualityScore >= 40 && !issues.includes('unrecognizable');

    console.log(`[Intelligence] Image quality assessed: score=${qualityScore}, usable=${isUsable}, issues=${issues.length}`);
    return { qualityScore, issues, isUsable };
  } catch (error) {
    console.error('[Intelligence] Image quality assessment failed:', error.message);
    return { qualityScore: 0, issues: ['assessment_failed'], isUsable: false };
  }
}

/**
 * Run crop issue detection on a single image.
 *
 * STUB: Replace with real ML model inference (e.g. TensorFlow/ONNX pest
 * classification model). Current implementation generates realistic weighted
 * random results. DB writes are production-ready.
 *
 * @param {string} imageId - V2PestImage ID
 * @returns {Promise<{ detection: object|null, error: string|null }>}
 */
export async function detectCropIssue(imageId) {
  try {
    // Fetch image record
    const image = await prisma.v2PestImage.findUnique({ where: { id: imageId } });
    if (!image) {
      console.log(`[Intelligence] Image not found: ${imageId}`);
      return { detection: null, error: 'image_not_found' };
    }

    // STUB: Replace with real ML model inference
    // Real implementation would:
    //   1. Download image from image.imageUrl
    //   2. Pre-process (resize, normalize)
    //   3. Run through trained pest/disease classifier
    //   4. Post-process predictions into structured output
    const primary = pickWeightedIssue();
    const confidence = clamp(40 + Math.floor(Math.random() * 51)); // 40-90
    const severity = clamp(20 + Math.floor(Math.random() * 61));   // 20-80
    const indicators = pickIndicators(primary.indicators);

    // Pick an alternative issue (different from primary)
    const alternatives = ISSUE_CATEGORIES.filter(c => c.key !== primary.key);
    const altIssue = alternatives[Math.floor(Math.random() * alternatives.length)];

    const detectionMetadata = {
      indicators,
      analysisTimestamp: new Date().toISOString(),
      modelVersion: 'stub-v0.1',
      imageType: image.imageType,
      alternativeConfidence: clamp(confidence * 0.4 + Math.random() * 20),
    };

    // Write detection to DB
    const detection = await prisma.v2ImageDetection.create({
      data: {
        imageId,
        likelyIssue: primary.key,
        alternativeIssue: altIssue.key,
        confidenceScore: Math.round(confidence * 100) / 100,
        severityScore: Math.round(severity * 100) / 100,
        detectionMetadata,
      },
    });

    // Update image quality score if not set
    if (image.qualityScore == null) {
      const { qualityScore } = await assessImageQuality(image.imageUrl);
      await prisma.v2PestImage.update({
        where: { id: imageId },
        data: { qualityScore },
      });
    }

    console.log(`[Intelligence] Detection created: image=${imageId}, issue=${primary.key}, confidence=${confidence}, severity=${severity}`);
    return { detection, error: null };
  } catch (error) {
    console.error('[Intelligence] Crop issue detection failed:', error.message);
    return { detection: null, error: error.message };
  }
}

/**
 * Analyze a set of images and return a consensus detection result.
 *
 * Aggregates individual detections across multiple images, finds the most
 * common issue, averages confidence/severity, and collects all indicators.
 *
 * @param {string[]} imageIds - Array of V2PestImage IDs
 * @returns {Promise<{ consensus: object|null, detectionCount: number, error: string|null }>}
 */
export async function analyzeImageSet(imageIds) {
  try {
    if (!imageIds || imageIds.length === 0) {
      return { consensus: null, detectionCount: 0, error: 'no_image_ids_provided' };
    }

    // Run detection on each image that doesn't have one yet
    const detectionPromises = imageIds.map(async (id) => {
      const existing = await prisma.v2ImageDetection.findFirst({ where: { imageId: id } });
      if (existing) return existing;
      const { detection } = await detectCropIssue(id);
      return detection;
    });

    const detections = (await Promise.all(detectionPromises)).filter(Boolean);

    if (detections.length === 0) {
      return { consensus: null, detectionCount: 0, error: 'no_detections_produced' };
    }

    // Tally issue votes
    const issueVotes = {};
    let totalConfidence = 0;
    let totalSeverity = 0;
    const allIndicators = new Set();

    for (const det of detections) {
      issueVotes[det.likelyIssue] = (issueVotes[det.likelyIssue] || 0) + 1;
      totalConfidence += det.confidenceScore;
      totalSeverity += det.severityScore;

      if (det.detectionMetadata && det.detectionMetadata.indicators) {
        for (const ind of det.detectionMetadata.indicators) {
          allIndicators.add(ind);
        }
      }
    }

    // Find primary and secondary issues
    const sorted = Object.entries(issueVotes).sort((a, b) => b[1] - a[1]);
    const likelyIssue = sorted[0][0];
    const alternativeIssue = sorted.length > 1 ? sorted[1][0] : null;

    const consensus = {
      likelyIssue,
      alternativeIssue,
      confidence: Math.round((totalConfidence / detections.length) * 100) / 100,
      severity: Math.round((totalSeverity / detections.length) * 100) / 100,
      indicators: Array.from(allIndicators),
      imageCount: imageIds.length,
      detectionCount: detections.length,
      voteDistribution: issueVotes,
    };

    console.log(`[Intelligence] Image set analysis: ${detections.length} detections, consensus=${likelyIssue}, confidence=${consensus.confidence}`);
    return { consensus, detectionCount: detections.length, error: null };
  } catch (error) {
    console.error('[Intelligence] Image set analysis failed:', error.message);
    return { consensus: null, detectionCount: 0, error: error.message };
  }
}
