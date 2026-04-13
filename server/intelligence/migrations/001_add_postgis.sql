-- Intelligence Module: PostGIS extension + spatial columns
-- Run after standard Prisma migrations. Prisma manages the base schema;
-- this file adds PostGIS geometry columns alongside existing lat/lng floats.
--
-- Usage:  psql $DATABASE_URL -f server/intelligence/migrations/001_add_postgis.sql

-- 1. Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add geometry columns to farm_profiles (SRID 4326 = WGS-84)
ALTER TABLE farm_profiles
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Backfill from existing lat/lng
UPDATE farm_profiles
  SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geom IS NULL;

-- Spatial index
CREATE INDEX IF NOT EXISTS idx_farm_profiles_geom
  ON farm_profiles USING GIST (geom);

-- 3. Add geometry column to hotspot zones
ALTER TABLE v2_hotspot_zones
  ADD COLUMN IF NOT EXISTS centroid geometry(Point, 4326);

CREATE INDEX IF NOT EXISTS idx_v2_hotspot_zones_centroid
  ON v2_hotspot_zones USING GIST (centroid);

-- 4. Add geometry column to outbreak clusters
ALTER TABLE v2_outbreak_clusters
  ADD COLUMN IF NOT EXISTS centroid geometry(Point, 4326);

CREATE INDEX IF NOT EXISTS idx_v2_outbreak_clusters_centroid
  ON v2_outbreak_clusters USING GIST (centroid);

-- 5. Scoring configuration table (hot-reloadable thresholds)
CREATE TABLE IF NOT EXISTS v2_scoring_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default thresholds
INSERT INTO v2_scoring_config (key, value, description) VALUES
  ('risk_thresholds', '{"low_max":39,"moderate_max":64,"high_max":79}',
   'Farm pest risk level boundaries'),
  ('alert_config', '{"confidence_threshold":55,"duplicate_window_hours":24,"recent_action_window_hours":48,"noise_threshold":3,"noise_window_days":7,"default_expiry_hours":72}',
   'Alert anti-spam pipeline thresholds'),
  ('farm_risk_weights', '{"image_score":0.30,"field_stress_score":0.20,"crop_stage_vulnerability":0.10,"weather_suitability":0.10,"nearby_outbreak_density":0.15,"farm_history_score":0.05,"verification_response_score":0.10}',
   'Farm pest risk scoring weights'),
  ('hotspot_weights', '{"anomaly_intensity":0.35,"temporal_change":0.20,"cluster_compactness":0.15,"crop_sensitivity":0.10,"local_validation_evidence":0.20}',
   'Hotspot scoring weights'),
  ('outbreak_weights', '{"confirmed_reports":0.25,"unconfirmed_signals":0.10,"satellite_anomalies":0.20,"weather_favorability":0.15,"seasonal_baseline_match":0.15,"intervention_failure_rate":0.15}',
   'Regional outbreak scoring weights'),
  ('alert_confidence_weights', '{"model_confidence":0.35,"signal_agreement":0.25,"data_quality":0.15,"spatial_relevance":0.15,"recent_trend_strength":0.10}',
   'Alert confidence scoring weights')
ON CONFLICT (key) DO NOTHING;

-- 6. Background jobs table
CREATE TABLE IF NOT EXISTS v2_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue       TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
  attempts    INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  run_after   TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v2_jobs_queue_status
  ON v2_jobs (queue, status, run_after);

-- 7. Helper: find farms within radius (km) of a point
-- Usage: SELECT * FROM find_farms_within(lng, lat, radius_km);
CREATE OR REPLACE FUNCTION find_farms_within(
  p_lng DOUBLE PRECISION,
  p_lat DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION
) RETURNS TABLE (
  profile_id TEXT,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.id::TEXT AS profile_id,
    ST_Distance(
      fp.geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) / 1000.0 AS distance_km
  FROM farm_profiles fp
  WHERE fp.geom IS NOT NULL
    AND ST_DWithin(
      fp.geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    )
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql STABLE;
