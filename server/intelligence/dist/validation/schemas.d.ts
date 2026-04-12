/**
 * Farroway Intelligence Module — Zod Validation Schemas
 *
 * Each schema mirrors a DTO from `../types/index.ts` and is used by the
 * `validate` middleware factory to gate incoming requests.
 */
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
/** Schema for {@link CreatePestImageDto}. */
export declare const createPestImageSchema: z.ZodObject<{
    profileId: z.ZodString;
    imageType: z.ZodEnum<{
        leaf_closeup: "leaf_closeup";
        whole_plant: "whole_plant";
        field_wide: "field_wide";
        hotspot_photo: "hotspot_photo";
        followup: "followup";
    }>;
    imageUrl: z.ZodString;
    gpsLat: z.ZodOptional<z.ZodNumber>;
    gpsLng: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/** Schema for {@link CreatePestReportDto}. */
export declare const createPestReportSchema: z.ZodObject<{
    profileId: z.ZodString;
    imageIds: z.ZodArray<z.ZodString>;
    cropCycleId: z.ZodOptional<z.ZodString>;
    verificationAnswers: z.ZodRecord<z.ZodEnum<{
        leaves_eaten: "leaves_eaten";
        spreading: "spreading";
        insects_visible: "insects_visible";
        widespread: "widespread";
        recent_rain: "recent_rain";
        recent_heat: "recent_heat";
    }>, z.ZodEnum<{
        yes: "yes";
        no: "no";
        unsure: "unsure";
    }>>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Schema for {@link CreateTreatmentDto}. reportId comes from URL param. */
export declare const createTreatmentSchema: z.ZodObject<{
    actionTaken: z.ZodString;
    productUsed: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    actionDate: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Schema for {@link CreateOutcomeDto}. treatmentId comes from URL param. */
export declare const createOutcomeSchema: z.ZodObject<{
    outcomeStatus: z.ZodEnum<{
        uncertain: "uncertain";
        resolved: "resolved";
        improved: "improved";
        same: "same";
        worse: "worse";
    }>;
    followupNotes: z.ZodOptional<z.ZodString>;
    followupImageUrl: z.ZodOptional<z.ZodString>;
    followupDate: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Schema for {@link SubmitFeedbackDto}. */
export declare const submitFeedbackSchema: z.ZodObject<{
    userFeedback: z.ZodEnum<{
        accurate: "accurate";
        partially_accurate: "partially_accurate";
        inaccurate: "inaccurate";
    }>;
    helpfulScore: z.ZodOptional<z.ZodNumber>;
    confirmedIssue: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Schema for {@link IngestSatelliteDto}. */
export declare const ingestSatelliteSchema: z.ZodObject<{
    profileId: z.ZodString;
    scanDate: z.ZodString;
    imagerySource: z.ZodOptional<z.ZodString>;
    cloudCover: z.ZodOptional<z.ZodNumber>;
    rawMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
/** Schema for {@link IngestDroneDto}. */
export declare const ingestDroneSchema: z.ZodObject<{
    profileId: z.ZodString;
    hotspotZoneId: z.ZodOptional<z.ZodString>;
    flightDate: z.ZodString;
    imageBundleUrl: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
/** Schema for {@link ReviewReportDto}. */
export declare const reviewReportSchema: z.ZodObject<{
    status: z.ZodEnum<{
        open: "open";
        under_review: "under_review";
        confirmed: "confirmed";
        resolved: "resolved";
        false_positive: "false_positive";
    }>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Schema for {@link ValidateBoundaryDto}. */
export declare const validateBoundarySchema: z.ZodObject<{
    validated: z.ZodBoolean;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Schema for admin trigger: score a farm. */
export declare const triggerFarmScoreSchema: z.ZodObject<{
    profileId: z.ZodString;
}, z.core.$strip>;
/** Schema for admin trigger: score a region. */
export declare const triggerRegionScoreSchema: z.ZodObject<{
    regionKey: z.ZodString;
}, z.core.$strip>;
/** Schema for admin trigger: evaluate alert for a farm. */
export declare const triggerAlertEvaluateSchema: z.ZodObject<{
    profileId: z.ZodString;
}, z.core.$strip>;
/**
 * Express middleware factory that validates `req.body` against the supplied
 * Zod schema. On failure it returns a 400 with flattened field errors.
 *
 * @example
 * router.post('/reports', validate(createPestReportSchema), handler);
 */
export declare function validate(schema: z.ZodSchema): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=schemas.d.ts.map