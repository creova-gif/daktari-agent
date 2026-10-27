-- ═══════════════════════════════════════════════════════════════════════════
-- Daktari Agent — Sprint 4 Schema
-- Migration: 004_sprint4
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Push Notification Tokens ─────────────────────────────────────────────────
CREATE TABLE push_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chw_id          UUID NOT NULL REFERENCES chw_profiles(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  platform        TEXT NOT NULL DEFAULT 'android',   -- 'android' | 'ios'
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_tokens_chw ON push_tokens(chw_id) WHERE is_active;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chw_own_tokens" ON push_tokens
  FOR ALL USING (chw_id = (SELECT id FROM chw_profiles WHERE auth_user_id = auth.uid()));

-- ─── In-app Notifications ─────────────────────────────────────────────────────
CREATE TYPE notif_type_enum AS ENUM (
  'emergency_nearby',       -- another CHW escalated in same district
  'wellbeing_check',        -- supervisor check-in
  'cert_expiring',          -- certification about to expire
  'stock_low',              -- medicine at your facility running low
  'model_updated',          -- new model version available to download
  'mass_casualty_alert',    -- district-wide mass casualty event declared
  'supervisor_message',     -- direct message from supervisor
  'bench_result'            -- bench run completed
);

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chw_id          UUID NOT NULL REFERENCES chw_profiles(id) ON DELETE CASCADE,
  type            notif_type_enum NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  data            JSONB DEFAULT '{}',       -- deep-link params or extra context
  read            BOOLEAN NOT NULL DEFAULT FALSE,
  sent_push       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_chw_unread ON notifications(chw_id, read, created_at DESC)
  WHERE NOT read;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chw_own_notifications" ON notifications
  FOR ALL USING (chw_id = (SELECT id FROM chw_profiles WHERE auth_user_id = auth.uid()));

-- ─── Medicine Formulary ───────────────────────────────────────────────────────
CREATE TABLE formulary_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generic_name    TEXT NOT NULL,
  generic_name_sw TEXT NOT NULL,          -- Swahili name used in CHW training
  brand_names     TEXT[] DEFAULT '{}',
  category        TEXT NOT NULL,          -- 'antimalarial'|'antibiotic'|'analgesic'|'supplement'|'vaccine'|'other'
  dosage_forms    TEXT[] DEFAULT '{}',    -- ['tablet','syrup','injection']
  is_chw_approved BOOLEAN NOT NULL DEFAULT TRUE,   -- CHW scope of practice
  weight_dosing   BOOLEAN NOT NULL DEFAULT FALSE,  -- requires weight-based calc?
  moh_approved    BOOLEAN NOT NULL DEFAULT TRUE,
  contraindications TEXT[] DEFAULT '{}',
  notes_sw        TEXT,                    -- Swahili prescribing notes
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE formulary_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_formulary" ON formulary_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─── Facility Stock ───────────────────────────────────────────────────────────
CREATE TABLE facility_stock (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_name   TEXT NOT NULL,
  district        district_enum NOT NULL,
  formulary_item_id UUID NOT NULL REFERENCES formulary_items(id),
  quantity_available INTEGER NOT NULL DEFAULT 0,
  reorder_level   INTEGER NOT NULL DEFAULT 10,
  last_restocked_at TIMESTAMPTZ,
  reported_by     UUID REFERENCES chw_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(facility_name, formulary_item_id)
);

CREATE INDEX idx_stock_facility  ON facility_stock(facility_name);
CREATE INDEX idx_stock_district  ON facility_stock(district);
CREATE INDEX idx_stock_low       ON facility_stock(district, quantity_available)
  WHERE quantity_available <= reorder_level;

ALTER TABLE facility_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_stock" ON facility_stock
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "chw_update_stock" ON facility_stock
  FOR UPDATE USING (
    reported_by = (SELECT id FROM chw_profiles WHERE auth_user_id = auth.uid())
  );

-- ─── Medicine Dispensing Records ──────────────────────────────────────────────
-- Tracks what was dispensed per visit — creates pharmacovigilance data layer
CREATE TABLE dispensing_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id        UUID NOT NULL REFERENCES clinical_visits(id) ON DELETE CASCADE,
  chw_id          UUID NOT NULL REFERENCES chw_profiles(id),
  formulary_item_id UUID NOT NULL REFERENCES formulary_items(id),
  quantity        INTEGER NOT NULL DEFAULT 1,
  dosage_sw       TEXT NOT NULL,             -- instructions in Swahili
  dispensed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispensing_visit ON dispensing_records(visit_id);
CREATE INDEX idx_dispensing_chw   ON dispensing_records(chw_id);
CREATE INDEX idx_dispensing_item  ON dispensing_records(formulary_item_id, dispensed_at DESC);

ALTER TABLE dispensing_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chw_own_dispensing" ON dispensing_records
  FOR ALL USING (chw_id = (SELECT id FROM chw_profiles WHERE auth_user_id = auth.uid()));

-- ─── Mass Casualty Events ─────────────────────────────────────────────────────
CREATE TYPE mci_status_enum AS ENUM ('active', 'contained', 'resolved');

CREATE TABLE mass_casualty_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district        district_enum NOT NULL,
  event_name      TEXT NOT NULL,
  description     TEXT,
  incident_type   TEXT NOT NULL DEFAULT 'other',  -- 'flood'|'fire'|'accident'|'epidemic'|'other'
  status          mci_status_enum NOT NULL DEFAULT 'active',
  declared_by     UUID REFERENCES chw_profiles(id),
  declared_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  total_casualties INTEGER DEFAULT 0,
  coordinates     POINT                          -- PostGIS point for mapping
);

-- Triage records for mass casualty events (START triage)
CREATE TYPE triage_category_enum AS ENUM (
  'immediate',    -- T1: life-threatening, treat now (red)
  'delayed',      -- T2: serious but stable (yellow)
  'minor',        -- T3: walking wounded (green)
  'expectant'     -- T4: unsurvivable / deceased (black)
);

CREATE TABLE mci_triage_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID NOT NULL REFERENCES mass_casualty_events(id),
  chw_id          UUID NOT NULL REFERENCES chw_profiles(id),
  triage_number   INTEGER NOT NULL,            -- sequential patient number
  category        triage_category_enum NOT NULL,
  chief_complaint TEXT,
  is_breathing    BOOLEAN,
  resp_rate       SMALLINT,
  can_follow_commands BOOLEAN,
  has_pulse       BOOLEAN,
  transported     BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  triaged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_triage_event ON mci_triage_records(event_id, triage_number);
ALTER TABLE mass_casualty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mci_triage_records   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_mci" ON mass_casualty_events FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_write_mci" ON mass_casualty_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_triage" ON mci_triage_records FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_write_triage" ON mci_triage_records FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── Federated Aggregation Log (server-side record keeping) ──────────────────
CREATE TABLE federated_aggregation_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_version   TEXT NOT NULL,
  input_model_version TEXT NOT NULL,          -- version before aggregation
  output_model_version TEXT NOT NULL,         -- new version after aggregation
  batches_included INTEGER NOT NULL,
  chws_included   INTEGER NOT NULL,
  districts_covered TEXT[] DEFAULT '{}',
  avg_loss_before NUMERIC(8,6),
  avg_loss_after  NUMERIC(8,6),
  aggregation_method TEXT NOT NULL DEFAULT 'fedavg',
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deployed_at     TIMESTAMPTZ                 -- when pushed to devices
);

ALTER TABLE federated_aggregation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_aggregation" ON federated_aggregation_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chw_profiles WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─── Seed: Core Formulary Items ───────────────────────────────────────────────
INSERT INTO formulary_items (generic_name, generic_name_sw, category, dosage_forms, is_chw_approved, weight_dosing, notes_sw) VALUES
('Artemether-Lumefantrine', 'Dawa ya Malaria (AL)', 'antimalarial', ARRAY['tablet'], TRUE, TRUE,
 'Toa kulingana na uzito. Chini ya 5kg: USITOE. 5-14kg: tab 1 × 3 kwa siku 3. 15-24kg: tab 2 × 3 kwa siku 3.'),
('Paracetamol 500mg', 'Paracetamol / Panadol', 'analgesic', ARRAY['tablet','syrup'], TRUE, FALSE,
 'Watu wazima: tab 1-2 kila masaa 6. Watoto: 10-15mg/kg kila masaa 6. Kikomo: mara 4 kwa siku.'),
('Oral Rehydration Salts', 'Chumvi ya Maji (ORS)', 'supplement', ARRAY['powder'], TRUE, FALSE,
 'Changanya kipande 1 na lita 1 maji safi. Toa polepole kila wakati. Usimpa mtoto maji ya kawaida peke yake.'),
('Zinc Sulfate 20mg', 'Zinki', 'supplement', ARRAY['tablet'], TRUE, FALSE,
 'Mtoto chini ya miaka 5 ana kuhara: tab ½ kwa siku 10. Toa pamoja na ORS.'),
('Amoxicillin 250mg', 'Amoxicillin', 'antibiotic', ARRAY['tablet','syrup'], TRUE, TRUE,
 'USITOE bila maagizo ya daktari. CHW anapaswa rufaa kwa kesi za maambukizi.'),
('Mebendazole 500mg', 'Dawa ya Minyoo', 'antibiotic', ARRAY['tablet'], TRUE, FALSE,
 'Watoto zaidi ya miaka 1 na watu wazima: tab 1 mara moja. Rudia baada ya miezi 6.'),
('Vitamin A', 'Vitamini A', 'supplement', ARRAY['capsule'], TRUE, FALSE,
 '6-11 miezi: capsule 1 ya 100,000IU. 12-59 miezi: capsule 1 ya 200,000IU. Toa kila miezi 6.'),
('Iron/Folate', 'Madini ya Chuma na Folate', 'supplement', ARRAY['tablet'], TRUE, FALSE,
 'Mama wajawazito: tab 1 kila siku. Anza mapema kwenye ujauzito. Endela hadi baada ya kujifungua miezi 3.'),
('Misoprostol 200mcg', 'Misoprostol', 'other', ARRAY['tablet'], TRUE, FALSE,
 'Kwa kuzuia kutokwa damu baada ya kujifungua: tab 3 (600mcg) kinywani mara tu baada ya mtoto kuzaliwa.'),
('Ready-to-Use Therapeutic Food', 'RUTF (Plumpy''Nut)', 'supplement', ARRAY['sachet'], TRUE, TRUE,
 'SAM bila matatizo: sachet 3-4 kwa siku kulingana na uzito. USITOE kwa SAM yenye edema — peleka hospitali.');
