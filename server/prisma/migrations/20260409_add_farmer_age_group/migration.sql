-- Add age_group column to farmers table
-- Stores the farmer's self-reported age bracket: under_25, 25_35, 36_50, over_50
ALTER TABLE "farmers" ADD COLUMN "age_group" TEXT;
