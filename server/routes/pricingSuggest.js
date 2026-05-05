/**
 * pricingSuggest.js — Phase 7A: lightweight pricing suggestion endpoint.
 *
 *   GET /api/v2/pricing/suggest
 *     ?crop=maize
 *     &country=GH        (optional)
 *     &region=AS         (optional)
 *     &windowDays=30     (optional, clamped to [7, 90])
 *
 * Resolves via the existing 4-layer fallback ladder in
 * server/src/modules/marketplace/priceInsights.js:
 *   1. LOCAL  — region-scoped recent listings
 *   2. COUNTRY — country-scoped recent listings
 *   3. GLOBAL — static USD band per crop
 *   4. FALLBACK — generic $0.20–$1.00/kg
 *
 * Response when real listings exist (sampleSize > 0):
 *   { noData: false, suggested, confidence, sampleSize, currency, source, trend }
 *
 * Response when only static fallback available (sampleSize === 0):
 *   { noData: true, message: 'Not enough local price data yet' }
 *
 * Security:
 *   • No auth required — aggregate data only, zero PII.
 *   • No buyer or farmer identifiers in any response field.
 *   • rate-limited by the global limiter in app.js.
 *
 * Failure modes:
 *   • Prisma unavailable → fallback to static USD bands → valid response.
 *   • Unknown crop → fallback → noData: true.
 *   • Any uncaught error → 500, client shows "Not enough local price data yet".
 */
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { buildPriceInsight } from '../src/modules/marketplace/priceInsights.js';

const prisma = new PrismaClient();
const router = express.Router();

// ─── GET /api/v2/pricing/suggest ──────────────────────────
router.get('/suggest', async (req, res) => {
  const crop = typeof req.query.crop === 'string'
    ? req.query.crop.trim()
    : '';

  if (!crop) {
    return res.status(400).json({ error: 'crop is required' });
  }

  const country    = typeof req.query.country === 'string'    ? req.query.country.trim()    : null;
  const region     = typeof req.query.region  === 'string'    ? req.query.region.trim()     : null;
  const windowDays = Math.min(90, Math.max(7,
    parseInt(req.query.windowDays, 10) || 30,
  ));

  try {
    const insight = await buildPriceInsight(prisma, {
      crop, country, region, windowDays,
    });

    if (!insight) {
      return res.json({
        noData:  true,
        message: 'Not enough local price data yet',
      });
    }

    // Only expose real market data (sampleSize > 0). Static global-USD
    // bands are internal fallback values — we never show them as
    // "suggested price" because they are not local market signals.
    if (insight.sampleSize === 0) {
      return res.json({
        noData:  true,
        message: 'Not enough local price data yet',
      });
    }

    // Real data — strip internal fields, expose only what the UI needs.
    return res.json({
      noData:     false,
      suggested:  insight.suggested,   // { low, high, typical, median }
      confidence: insight.confidence,  // 'low' | 'medium' | 'high'
      sampleSize: insight.sampleSize,
      currency:   insight.currency,
      source:     insight.source,      // 'local' | 'country'
      trend:      insight.trend,       // 'up' | 'down' | 'stable' | null
    });
  } catch {
    // Do not propagate errors — client shows "Not enough local price data yet".
    return res.status(500).json({
      noData:  true,
      message: 'Not enough local price data yet',
    });
  }
});

export default router;
