// ─── Core Domain Types ────────────────────────────────────────────────────────

export type UserRole = 'chw' | 'supervisor' | 'admin';

export type District =
  | 'kibaha'
  | 'dodoma'
  | 'mwanza'
  | 'dar_es_salaam'
  | 'arusha'
  | 'mbeya'
  | 'other';

export type ConfidenceTier = 'high' | 'medium' | 'low';

export type RiskLevel = 'emergency' | 'high' | 'medium' | 'low';

export type VisitStatus = 'in_progress' | 'completed' | 'escalated' | 'referred';

export type CareerLevel = 'foundation' | 'practitioner' | 'specialist' | 'senior' | 'trainer';

export type CertModule =
  | 'core_primary_care'
  | 'malaria_advanced'
  | 'maternal_health'
  | 'pediatrics_imci'
  | 'tb_management'
  | 'nutrition_sam'
  | 'emergency_triage';

// ─── User / CHW ───────────────────────────────────────────────────────────────

export interface CHWProfile {
  id: string;
  auth_user_id?: string;
  full_name: string;
  phone: string;
  district: District;
  facility_name: string;
  chw_id_number: string;
  role: UserRole;
  is_active: boolean;
  wellbeing_score: number;        // 0–100, Sprint 2
  career_level: CareerLevel;      // Sprint 3
  total_visits: number;           // Sprint 3, maintained by DB trigger
  ai_agreement_rate: number;      // Sprint 3, 0–100 pct
  created_at: string;
}

// ─── Patient ──────────────────────────────────────────────────────────────────

export type PatientSex = 'male' | 'female';

export interface Patient {
  id: string;
  chw_id: string;
  full_name: string;
  age_years: number | null;
  age_months: number | null; // for children under 5
  sex: PatientSex;
  village: string;
  district: District;
  phone?: string;
  is_pregnant?: boolean;
  created_at: string;
}

// ─── Clinical Visit ───────────────────────────────────────────────────────────

export interface ClinicalVisit {
  id: string;
  patient_id: string;
  chw_id: string;
  status: VisitStatus;
  chief_complaint_sw: string; // Swahili input from CHW
  symptoms: string[];         // structured symptom list
  vital_signs?: VitalSigns;
  ai_recommendation?: AIRecommendation;
  chw_notes?: string;
  chw_agreed_with_ai?: boolean; // did CHW accept AI recommendation?
  referral_facility?: string;
  created_at: string;
  completed_at?: string;
}

export interface VitalSigns {
  temperature_c?: number;
  respiratory_rate?: number;
  muac_mm?: number;        // mid-upper arm circumference (malnutrition screening)
  weight_kg?: number;
  has_pallor?: boolean;
  has_jaundice?: boolean;
}

// ─── AI Recommendation ───────────────────────────────────────────────────────

export interface AIRecommendation {
  id: string;
  visit_id: string;
  likely_diagnosis_sw: string;       // Swahili
  likely_diagnosis_en: string;       // English (for supervisor review)
  recommended_action_sw: string;     // Swahili instructions for CHW
  confidence: ConfidenceTier;
  confidence_score: number;          // 0.0 – 1.0
  risk_level: RiskLevel;
  emergency_flag: boolean;
  protocol_cited: string;            // which MoH protocol was referenced
  red_line_triggered: boolean;       // safety gate fired?
  raw_model_output?: string;
  created_at: string;
}

// ─── Safety System ───────────────────────────────────────────────────────────

export interface SafetyCheck {
  passed: boolean;
  red_line_reason?: string;
  escalation_required: boolean;
  escalation_reason?: string;
}

// ─── Offline Queue ────────────────────────────────────────────────────────────

export interface OfflineQueueItem {
  id: string;
  type: 'visit' | 'patient' | 'recommendation';
  payload: Record<string, unknown>;
  created_at: string;
  synced: boolean;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  NewVisit: { patientId?: string };
  PatientSearch: undefined;
  PatientDetail: { patientId: string };
  ClinicalIntake: { visitId: string; patientId: string };
  AIRecommendation: { visitId: string };
  VisitHistory: undefined;
  VisitDetail: { visitId: string };
  Profile: undefined;
  Certification: undefined;
  BenchResults: undefined;
  EmergencyProtocol: undefined;
  Notifications: undefined;
  StockTracker: undefined;
};
