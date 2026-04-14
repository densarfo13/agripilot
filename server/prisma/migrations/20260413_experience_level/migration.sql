-- Add experience_level column to farm_profiles
-- Values: "new" | "experienced" | NULL (not answered yet)

ALTER TABLE "farm_profiles"
ADD COLUMN "experience_level" TEXT;
