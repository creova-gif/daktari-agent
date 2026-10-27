-- ═══════════════════════════════════════════════════════════════════════════
-- Daktari Agent — Supabase Schema
-- Tanzania CHW AI Augmentation Agent
-- Migration: 001_initial_schema
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Districts Enum ──────────────────────────────────────────────────────────
CREATE TYPE district_enum AS ENUM (
  'kibaha', 'dodoma', 'mwanza', 'dar_es_salaam',
  'arusha', 'mbeya', 'other'
);

CREATE TYPE user_role_enum AS ENUM ('chw', 'supervisor', 'admin');
CREATE TYPE visit_status_enum AS ENUM ('in_progress', 'completed', 'escalated', 'referred');
CREATE TYPE confidence_tier_enum AS ENUM ('high', 'medium', 'low');
CREATE TYPE risk_level_enum AS ENUM ('emergency', 'high', 'medium', 'low');
CREATE TYPE patient_sex_enum AS ENUM ('male', 'female');

-- ─── CHW Profiles ────────────────────────────────────────────────────────────
CREATE TABLE chw_profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  phone             TEXT NOT NULL UNIQUE,
  district          district_enum NOT NULL DEFAULT 'other',
  facility_name     TEXT NOT NULL,
  chw_id_number     TEXT NOT NULL UNIQUE,
  role              user_role_enum NOT NULL DEFAULT 'chw',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  wellbeing_score   SMALLINT DEFAULT 100 CHECK (wellbeing_score BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Patients ─────────────────────────────────────────────────────────────────
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chw_id          UUID NOT NULL REFERENCES chw_profiles(id),
  full_name       TEXT NOT NULL,
  age_years       SMALLINT,
  age_months      SMALLINT,   -- for children under 5; mutually exclusive with age_years
  sex             patient_sex_enum NOT NULL,
  village         TEXT NOT NULL,
  district        district_enum NOT NULL,
  phone           TEXT,
  is_pregnant     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT age_check CHECK (
    (age_years IS NOT NULL AND age_months IS NULL) OR
    (age_years IS NULL AND age_months IS NOT NULL)
  )
);

-- ─── Clinical Visits ─────────────────────────────────────────────────────────
CREATE TABLE clinical_visits (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id               UUID NOT NULL REFERENCES patients(id),
  chw_id                   UUID NOT NULL REFERENCES chw_profiles(id),
  status                   visit_status_enum NOT NULL DEFAULT 'in_progress',
  chief_complaint_sw       TEXT NOT NULL,             -- raw Swahili input
  symptoms                 TEXT[] DEFAULT '{}',
  -- Vital Signs (stored flat for query performance)
  temperature_c            NUMERIC(4,1),
  respiratory_rate         SMALLINT,
  muac_mm                  SMALLINT,
  weight_kg                NUMERIC(5,2),
  has_pallor               BOOLEAN DEFAULT FALSE,
  has_jaundice             BOOLEAN DEFAULT FALSE,
  -- CHW feedback
  chw_notes                TEXT,
  chw_agreed_with_ai       BOOLEAN,
  referral_facility        TEXT,
  -- Timestamps
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at             TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AI Recommendations ──────────────────────────────────────────────────────
CREATE TABLE ai_recommendations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id              UUID NOT NULL REFERENCES clinical_visits(id) ON DELETE CASCADE,
  likely_diagnosis_sw   TEXT NOT NULL,
  likely_diagnosis_en   TEXT NOT NULL,
  recommended_action_sw TEXT NOT NULL,
  confidence            confidence_tier_enum NOT NULL,
  confidence_score      NUMERIC(4,3) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  risk_level            risk_level_enum NOT NULL,
  emergency_flag        BOOLEAN NOT NULL DEFAULT FALSE,
  protocol_cited        TEXT NOT NULL,
  red_line_triggered    BOOLEAN NOT NULL DEFAULT FALSE,
  raw_model_output      TEXT,
  model_version         TEXT NOT NULL DEFAULT 'meditron-7b-sw-v0.1',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Offline Sync Queue ───────────────────────────────────────────────────────
CREATE TABLE offline_queue (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chw_id          UUID NOT NULL REFERENCES chw_profiles(id),
  entity_type     TEXT NOT NULL, -- 'visit' | 'patient' | 'recommendation'
  entity_id       UUID NOT NULL,
  payload         JSONB NOT NULL,
  synced          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at       TIMESTAMPTZ
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_patients_chw      ON patients(chw_id);
CREATE INDEX idx_patients_district ON patients(district);
CREATE INDEX idx_visits_chw        ON clinical_visits(chw_id);
CREATE INDEX idx_visits_patient    ON clinical_visits(patient_id);
CREATE INDEX idx_visits_status     ON clinical_visits(status);
CREATE INDEX idx_visits_created    ON clinical_visits(created_at DESC);
CREATE INDEX idx_ai_rec_visit      ON ai_recommendations(visit_id);
CREATE INDEX idx_offline_chw       ON offline_queue(chw_id) WHERE NOT synced;

-- ─── Updated At Trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chw_updated    BEFORE UPDATE ON chw_profiles    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_patient_updated BEFORE UPDATE ON patients        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_visit_updated  BEFORE UPDATE ON clinical_visits  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE chw_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_visits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_queue     ENABLE ROW LEVEL SECURITY;

-- CHW can only see their own profile
CREATE POLICY "chw_own_profile" ON chw_profiles
  FOR ALL USING (auth.uid() = auth_user_id);

-- Supervisors can see all profiles in their district
CREATE POLICY "supervisor_district_profiles" ON chw_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chw_profiles p
      WHERE p.auth_user_id = auth.uid()
      AND p.role IN ('supervisor', 'admin')
      AND p.district = chw_profiles.district
    )
  );

-- CHW sees only their own patients
CREATE POLICY "chw_own_patients" ON patients
  FOR ALL USING (
    chw_id = (SELECT id FROM chw_profiles WHERE auth_user_id = auth.uid())
  );

-- CHW sees only their own visits
CREATE POLICY "chw_own_visits" ON clinical_visits
  FOR ALL USING (
    chw_id = (SELECT id FROM chw_profiles WHERE auth_user_id = auth.uid())
  );

-- AI recommendations accessible via visit ownership
CREATE POLICY "chw_visit_recommendations" ON ai_recommendations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clinical_visits v
      JOIN chw_profiles p ON p.id = v.chw_id
      WHERE v.id = ai_recommendations.visit_id
      AND p.auth_user_id = auth.uid()
    )
  );

-- Offline queue — own records only
CREATE POLICY "chw_own_queue" ON offline_queue
  FOR ALL USING (
    chw_id = (SELECT id FROM chw_profiles WHERE auth_user_id = auth.uid())
  );

-- ─── Seed: Demo CHW (for Railway/Replit testing) ─────────────────────────────
-- Note: Auth user must be created via Supabase Auth first, then update auth_user_id
INSERT INTO chw_profiles (
  full_name, phone, district, facility_name, chw_id_number, role
) VALUES (
  'Amina Rashidi',
  '+255712000001',
  'kibaha',
  'Kibaha District Hospital',
  'TZ-CHW-KIB-001',
  'chw'
);
