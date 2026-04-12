-- Intelligence trust layers: image quality, confidence, boundary validation, regional confidence

-- 1. V2PestImage: image quality enforcement fields
ALTER TABLE "v2_pest_images"
  ADD COLUMN "blur_score"        DOUBLE PRECISION,
  ADD COLUMN "brightness_score"  DOUBLE PRECISION,
  ADD COLUMN "resolution_ok"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "quality_passed"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "rejection_reason"  TEXT;

-- 2. V2ImageDetection: uncertainty flag
ALTER TABLE "v2_image_detections"
  ADD COLUMN "is_uncertain" BOOLEAN NOT NULL DEFAULT false;

-- 3. V2PestReport: diagnosis result fields
ALTER TABLE "v2_pest_reports"
  ADD COLUMN "likely_issue"       TEXT,
  ADD COLUMN "alternative_issue"  TEXT,
  ADD COLUMN "confidence_score"   DOUBLE PRECISION,
  ADD COLUMN "is_uncertain"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "action_guidance"    JSONB;

-- 4. V2LandBoundary: boundary validation
ALTER TABLE "v2_land_boundaries"
  ADD COLUMN "boundary_confidence" DOUBLE PRECISION,
  ADD COLUMN "validation_status"   TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "validation_reason"   TEXT;

CREATE INDEX "idx_v2_land_boundaries_validation" ON "v2_land_boundaries"("validation_status");

-- 5. V2DistrictRiskScore: regional confidence
ALTER TABLE "v2_district_risk_scores"
  ADD COLUMN "signal_count"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "confidence_level"   TEXT NOT NULL DEFAULT 'low_confidence',
  ADD COLUMN "data_quality_score" DOUBLE PRECISION NOT NULL DEFAULT 0;
