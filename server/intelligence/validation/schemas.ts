/**
 * Farroway Intelligence Module — Zod Validation Schemas
 *
 * Each schema mirrors a DTO from `../types/index.ts` and is used by the
 * `validate` middleware factory to gate incoming requests.
 */

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

import {
  ImageType,
  LikelyIssue,
  ReportStatus,
  VerificationQuestion,
  AnswerValue,
  HotspotSeverity,
  HotspotStatus,
  AlertLevel,
  SentStatus,
  OutcomeStatus,
  FeedbackValue,
  RiskLevel,
  TrendDirection,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reusable UUID v4 string validator. */
const uuid = z.string().uuid();

/** Extract values tuple from a const object for use with z.enum. */
function constValues<T extends Record<string, string>>(obj: T) {
  return Object.values(obj) as [T[keyof T], ...T[keyof T][]];
}

// ---------------------------------------------------------------------------
// DTO schemas
// ---------------------------------------------------------------------------

/** Schema for {@link CreatePestImageDto}. */
export const createPestImageSchema = z.object({
  profileId: uuid,
  imageType: z.enum(constValues(ImageType)),
  imageUrl: z.string().url().max(2048),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
});

/** Schema for {@link CreatePestReportDto}. */
export const createPestReportSchema = z.object({
  profileId: uuid,
  imageIds: z.array(uuid).min(1).max(20),
  cropCycleId: uuid.optional(),
  verificationAnswers: z.record(
    z.enum(constValues(VerificationQuestion)),
    z.enum(constValues(AnswerValue)),
  ),
  notes: z.string().max(2000).optional(),
});

/** Schema for {@link CreateTreatmentDto}. */
export const createTreatmentSchema = z.object({
  pestReportId: uuid,
  actionTaken: z.string().min(1).max(500),
  productUsed: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
  actionDate: z.string().datetime().optional(),
});

/** Schema for {@link CreateOutcomeDto}. */
export const createOutcomeSchema = z.object({
  treatmentActionId: uuid,
  outcomeStatus: z.enum(constValues(OutcomeStatus)),
  followupNotes: z.string().max(2000).optional(),
  followupImageUrl: z.string().url().max(2048).optional(),
  followupDate: z.string().datetime().optional(),
});

/** Schema for {@link SubmitFeedbackDto}. */
export const submitFeedbackSchema = z.object({
  userFeedback: z.enum(constValues(FeedbackValue)),
  helpfulScore: z.number().int().min(0).max(100).optional(),
  confirmedIssue: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
});

/** Schema for {@link IngestSatelliteDto}. */
export const ingestSatelliteSchema = z.object({
  profileId: uuid,
  scanDate: z.string().datetime(),
  imagerySource: z.string().max(255).optional(),
  cloudCover: z.number().min(0).max(100).optional(),
  rawMetadata: z.record(z.string(), z.unknown()).optional(),
});

/** Schema for {@link IngestDroneDto}. */
export const ingestDroneSchema = z.object({
  profileId: uuid,
  hotspotZoneId: uuid.optional(),
  flightDate: z.string().datetime(),
  imageBundleUrl: z.string().url().max(2048).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Schema for {@link ReviewReportDto}. */
export const reviewReportSchema = z.object({
  status: z.enum(constValues(ReportStatus)),
  notes: z.string().max(2000).optional(),
});

/** Schema for {@link ValidateBoundaryDto}. */
export const validateBoundarySchema = z.object({
  validated: z.boolean(),
  notes: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Express middleware factory that validates `req.body` against the supplied
 * Zod schema. On failure it returns a 400 with flattened field errors.
 *
 * @example
 * router.post('/reports', validate(createPestReportSchema), handler);
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}
