-- ═══════════════════════════════════════════════════════════════════════════
-- Daktari Agent — Sprint 2 Schema Additions
-- Migration: 002_sprint2
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── CHW Wellbeing Events ─────────────────────────────────────────────────────
-- Passive signals logged by the app; aggregated into chw_profiles.wellbeing_score
CREATE TABLE chw_wellbeing_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chw_id          UUID NOT NULL REFERENCES chw_profiles(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,   -- 'visit_completed' | 'escalation' | 'off_hours_usage' | 'low_confidence_streak' | 'session_duration'
  signal_value    NUMERIC NOT NULL DEFAULT 0, -- positive = healthy, negative = burnout risk
  metadata        JSONB DEFAULT '{}',
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wellbeing_chw    ON chw_wellbeing_events(chw_id);
CREATE INDEX idx_wellbeing_recent ON chw_wellbeing_events(chw_id, recorded_at DESC);

ALTER TABLE chw_wellbeing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chw_own_wellbeing" ON chw_wellbeing_events
  FOR ALL USING (chw_id = (SELECT id FROM chw_profiles WHERE auth_user_id = auth.uid()));

-- Supervisors can read wellbeing events for their district
CREATE POLICY "supervisor_district_wellbeing" ON chw_wellbeing_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chw_profiles s
      JOIN chw_profiles c ON c.id = chw_wellbeing_events.chw_id
      WHERE s.auth_user_id = auth.uid()
        AND s.role IN ('supervisor', 'admin')
        AND s.district = c.district
    )
  );

-- ─── USSD Sessions ────────────────────────────────────────────────────────────
CREATE TABLE ussd_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_code    TEXT NOT NULL UNIQUE,  -- Africa's Talking session ID
  phone           TEXT NOT NULL,
  chw_id          UUID REFERENCES chw_profiles(id),
  current_step    TEXT NOT NULL DEFAULT 'menu',
  state_data      JSONB DEFAULT '{}',   -- partial visit data accumulated across USSD steps
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX idx_ussd_session_code ON ussd_sessions(session_code);
CREATE INDEX idx_ussd_phone        ON ussd_sessions(phone);
ALTER TABLE ussd_sessions ENABLE ROW LEVEL SECURITY;
-- USSD is server-side only; RLS blocks direct client access
CREATE POLICY "no_direct_ussd_access" ON ussd_sessions FOR ALL USING (FALSE);

-- ─── Voice Transcripts ────────────────────────────────────────────────────────
CREATE TABLE voice_transcripts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id        UUID NOT NULL REFERENCES clinical_visits(id) ON DELETE CASCADE,
  chw_id          UUID NOT NULL REFERENCES chw_profiles(id),
  audio_duration_s NUMERIC,
  transcript_sw   TEXT NOT NULL,  -- Whisper output in Swahili
  language_detected TEXT,         -- e.g. 'sw', 'sw-KE', 'sw-TZ'
  confidence      NUMERIC(4,3),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chw_own_transcripts" ON voice_transcripts
  FOR ALL USING (chw_id = (SELECT id FROM chw_profiles WHERE auth_user_id = auth.uid()));

-- ─── Supervisor Alerts ────────────────────────────────────────────────────────
CREATE TYPE alert_type_enum AS ENUM (
  'emergency_case', 'red_line_triggered', 'chw_wellbeing_low',
  'high_escalation_rate', 'offline_duration', 'stock_out'
);
CREATE TYPE alert_status_enum AS ENUM ('open', 'acknowledged', 'resolved');

CREATE TABLE supervisor_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supervisor_id   UUID REFERENCES chw_profiles(id),
  chw_id          UUID NOT NULL REFERENCES chw_profiles(id),
  visit_id        UUID REFERENCES clinical_visits(id),
  alert_type      alert_type_enum NOT NULL,
  severity        risk_level_enum NOT NULL DEFAULT 'medium',
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  status          alert_status_enum NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_alerts_supervisor ON supervisor_alerts(supervisor_id, status);
CREATE INDEX idx_alerts_chw        ON supervisor_alerts(chw_id);
ALTER TABLE supervisor_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supervisor_own_alerts" ON supervisor_alerts
  FOR ALL USING (
    supervisor_id = (SELECT id FROM chw_profiles WHERE auth_user_id = auth.uid())
    OR chw_id = (SELECT id FROM chw_profiles WHERE auth_user_id = auth.uid())
  );

-- ─── Patient Detail - add medical history fields ──────────────────────────────
ALTER TABLE patients ADD COLUMN IF NOT EXISTS known_conditions TEXT[] DEFAULT '{}';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_medications TEXT[] DEFAULT '{}';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies TEXT[] DEFAULT '{}';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;

-- Auto-update last_visit_at on visit completion
CREATE OR REPLACE FUNCTION update_patient_last_visit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' OR NEW.status = 'referred' THEN
    UPDATE patients SET last_visit_at = NEW.completed_at WHERE id = NEW.patient_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patient_last_visit
  AFTER UPDATE ON clinical_visits
  FOR EACH ROW EXECUTE FUNCTION update_patient_last_visit();

-- ─── View: CHW Dashboard Aggregate ───────────────────────────────────────────
CREATE OR REPLACE VIEW chw_dashboard_stats AS
SELECT
  p.id AS chw_id,
  p.full_name,
  p.district,
  p.wellbeing_score,
  COUNT(DISTINCT pt.id) AS total_patients,
  COUNT(DISTINCT CASE WHEN v.created_at >= CURRENT_DATE THEN v.id END) AS visits_today,
  COUNT(DISTINCT CASE WHEN v.created_at >= CURRENT_DATE - 7 THEN v.id END) AS visits_this_week,
  COUNT(DISTINCT CASE WHEN v.status = 'in_progress' THEN v.id END) AS open_visits,
  COUNT(DISTINCT CASE WHEN ar.emergency_flag = TRUE AND v.created_at >= CURRENT_DATE - 7 THEN v.id END) AS emergencies_this_week,
  COUNT(DISTINCT CASE WHEN ar.chw_agreed_with_ai = FALSE THEN v.id END) AS ai_disagreements,
  ROUND(
    COUNT(DISTINCT CASE WHEN ar.chw_agreed_with_ai = TRUE THEN v.id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT CASE WHEN ar.chw_agreed_with_ai IS NOT NULL THEN v.id END), 0) * 100,
    1
  ) AS ai_agreement_rate_pct
FROM chw_profiles p
LEFT JOIN patients pt ON pt.chw_id = p.id
LEFT JOIN clinical_visits v ON v.chw_id = p.id
LEFT JOIN ai_recommendations ar ON ar.visit_id = v.id
GROUP BY p.id, p.full_name, p.district, p.wellbeing_score;
