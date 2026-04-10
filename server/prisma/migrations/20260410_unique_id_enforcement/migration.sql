-- Unique ID Enforcement Migration
-- Adds missing unique constraints to prevent duplicate records across core entities.
-- All constraints are safe to add: existing data should already be unique if business
-- logic was followed; if not, duplicates must be cleaned first.

-- 1. Farmer national ID unique per organization
-- Prevents registering the same national ID twice within an organization.
-- NULL values are excluded from unique constraints in PostgreSQL (safe for optional field).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_farmers_nationalid_org" ON "farmers" ("national_id", "organization_id");

-- 2. Referral code globally unique
-- Each referral code must be unique across all users to prevent lookup ambiguity.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_referral_code" ON "referrals" ("code");

-- 3. Referral pair unique (one referral per referrer+referee pair)
-- Prevents duplicate referral records between the same two users.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_referral_pair" ON "referrals" ("referrer_id", "referee_id");

-- 4. Review assignment unique per application+reviewer
-- Prevents assigning the same reviewer to the same application twice.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_review_assign_app_reviewer" ON "review_assignments" ("application_id", "reviewer_id");

-- 5. Officer validation unique per season+officer+type
-- Prevents duplicate validation submissions of the same type by the same officer.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_officer_validation_season_officer_type" ON "officer_validations" ("season_id", "officer_id", "validation_type");

-- 6. Recommendation feedback unique per recommendation+user
-- Prevents duplicate feedback submissions on the same recommendation.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_rec_feedback_rec_user" ON "recommendation_feedback" ("recommendation_id", "user_id");

-- 7. Foreign key constraints for previously plain-string FK fields
-- These add referential integrity at the database level for fields that
-- previously stored User IDs as plain strings without FK enforcement.

-- Farmer.assignedOfficerId → User (officer assignment)
ALTER TABLE "farmers" ADD CONSTRAINT "fk_farmers_assigned_officer"
  FOREIGN KEY ("assigned_officer_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Farmer.approvedById → User (approval tracking)
ALTER TABLE "farmers" ADD CONSTRAINT "fk_farmers_approved_by"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- OfficerValidation.officerId → User (validation officer)
ALTER TABLE "officer_validations" ADD CONSTRAINT "fk_officer_validation_officer"
  FOREIGN KEY ("officer_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AutoNotification.userId → User (notification target)
ALTER TABLE "auto_notifications" ADD CONSTRAINT "fk_autonotif_target_user"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
