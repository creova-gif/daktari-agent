import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createVisit, updateVisitVitals } from '../lib/supabase';
import { quickEmergencyScreen } from '../lib/clinicalAgent';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius, shadow, shared } from '../lib/theme';
import VoiceInputButton from '../components/VoiceInputButton';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NewVisit'>;
  route: RouteProp<RootStackParamList, 'NewVisit'>;
};

// Common symptom chips in Swahili
const COMMON_SYMPTOMS = [
  'Homa', 'Kikohozi', 'Maumivu ya kichwa', 'Kuhara',
  'Kutapika', 'Maumivu ya tumbo', 'Maumivu ya mwili', 'Uchovu',
  'Kupoteza hamu ya kula', 'Degedege', 'Upele wa ngozi',
  'Maumivu ya macho', 'Msamba / pua', 'Ugumu wa kupumua',
  'Pallor', 'Jaundice',
];

type Step = 'patient' | 'complaint' | 'symptoms' | 'vitals';

export default function NewVisitScreen({ navigation, route }: Props) {
  const { chw } = useAuth();
  const [step, setStep] = useState<Step>('patient');

  // Patient Info
  const [patientName, setPatientName] = useState('');
  const [patientSex, setPatientSex] = useState<'male' | 'female' | null>(null);
  const [ageYears, setAgeYears] = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [village, setVillage] = useState('');
  const [isPregnant, setIsPregnant] = useState(false);

  // Complaint
  const [complaint, setComplaint] = useState('');

  // Symptoms
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  // Vitals
  const [tempC, setTempC] = useState('');
  const [rr, setRR] = useState('');
  const [muac, setMUAC] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [hasPallor, setHasPallor] = useState(false);
  const [hasJaundice, setHasJaundice] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // ─── Emergency quick check ───────────────────────────────────────────────
  const isEmergency = quickEmergencyScreen(complaint, selectedSymptoms);

  function toggleSymptom(s: string) {
    setSelectedSymptoms(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  // ─── Step validation ─────────────────────────────────────────────────────
  function canAdvance(): boolean {
    if (step === 'patient') return !!patientName.trim() && !!patientSex && !!village.trim() && !!(ageYears || ageMonths);
    if (step === 'complaint') return complaint.trim().length >= 10;
    return true;
  }

  function advance() {
    const steps: Step[] = ['patient', 'complaint', 'symptoms', 'vitals'];
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  }

  function back() {
    const steps: Step[] = ['patient', 'complaint', 'symptoms', 'vitals'];
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
    else navigation.goBack();
  }

  // ─── Submit & navigate to AI recommendation ───────────────────────────────
  async function handleSubmit() {
    if (!chw) return;
    setSubmitting(true);
    try {
      // 1. Create patient record
      const { createPatient } = await import('../lib/supabase');
      const patient = await createPatient({
        chw_id: chw.id,
        full_name: patientName.trim(),
        sex: patientSex!,
        village: village.trim(),
        district: chw.district,
        age_years: ageYears ? parseInt(ageYears, 10) : undefined,
        age_months: ageMonths ? parseInt(ageMonths, 10) : undefined,
        is_pregnant: isPregnant,
      });

      // 2. Create clinical visit
      const visit = await createVisit({
        patient_id: patient.id,
        chw_id: chw.id,
        chief_complaint_sw: complaint.trim(),
        symptoms: selectedSymptoms,
      });

      // 3. Save vitals if provided
      const hasVitals = tempC || rr || muac || weightKg || hasPallor || hasJaundice;
      if (hasVitals) {
        await updateVisitVitals(visit.id, {
          temperature_c: tempC ? parseFloat(tempC) : undefined,
          respiratory_rate: rr ? parseInt(rr, 10) : undefined,
          muac_mm: muac ? parseInt(muac, 10) : undefined,
          weight_kg: weightKg ? parseFloat(weightKg) : undefined,
          has_pallor: hasPallor,
          has_jaundice: hasJaundice,
        });
      }

      // 4. Navigate to AI recommendation screen
      navigation.replace('AIRecommendation', { visitId: visit.id });
    } catch (err) {
      Alert.alert('Hitilafu', 'Imeshindwa kuanza ziara. Jaribu tena.');
      console.error('[NewVisit] Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Step progress indicator ─────────────────────────────────────────────
  const steps: Step[] = ['patient', 'complaint', 'symptoms', 'vitals'];
  const stepIdx = steps.indexOf(step);

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.backBtn}>
          <Text style={styles.backText}>← Rudi</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ziara Mpya</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        {steps.map((s, i) => (
          <View
            key={s}
            style={[styles.progressDot, i <= stepIdx && { backgroundColor: colors.green }]}
          />
        ))}
      </View>

      {/* Emergency Banner */}
      {isEmergency && (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyText}>
            🚨 DALILI ZA DHARURA ZIMETAMBULIWA — Peleka hospitali SASA
          </Text>
        </View>
      )}

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ─── STEP: Patient Info ─── */}
        {step === 'patient' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Maelezo ya Mgonjwa</Text>
            <Text style={styles.stepSub}>Jaza taarifa za msingi za mgonjwa.</Text>

            <Field label="JINA KAMILI" required>
              <TextInput
                style={shared.input}
                placeholder="Mfano: Fatuma Ally"
                value={patientName}
                onChangeText={setPatientName}
                autoCapitalize="words"
              />
            </Field>

            <Field label="KIJIJI / MTAA" required>
              <TextInput
                style={shared.input}
                placeholder="Mfano: Kibamba"
                value={village}
                onChangeText={setVillage}
                autoCapitalize="words"
              />
            </Field>

            <Field label="JINSIA" required>
              <View style={styles.sexRow}>
                {(['male', 'female'] as const).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sexBtn, patientSex === s && styles.sexBtnActive]}
                    onPress={() => setPatientSex(s)}
                  >
                    <Text style={[styles.sexBtnText, patientSex === s && styles.sexBtnTextActive]}>
                      {s === 'male' ? '♂ Mme' : '♀ Mke'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            <Field label="UMRI">
              <View style={styles.ageRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ageSubLabel}>Miaka</Text>
                  <TextInput
                    style={[shared.input, { textAlign: 'center' }]}
                    placeholder="—"
                    value={ageYears}
                    onChangeText={v => { setAgeYears(v); if (v) setAgeMonths(''); }}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
                <Text style={styles.ageOr}>au</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ageSubLabel}>Miezi (chini ya miaka 5)</Text>
                  <TextInput
                    style={[shared.input, { textAlign: 'center' }]}
                    placeholder="—"
                    value={ageMonths}
                    onChangeText={v => { setAgeMonths(v); if (v) setAgeYears(''); }}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>
            </Field>

            {patientSex === 'female' && (
              <Field label="">
                <View style={styles.switchRow}>
                  <Text style={typography.body}>Ni mjamzito?</Text>
                  <Switch
                    value={isPregnant}
                    onValueChange={setIsPregnant}
                    trackColor={{ true: colors.green, false: colors.border }}
                    thumbColor={colors.surface}
                  />
                </View>
              </Field>
            )}
          </View>
        )}

        {/* ─── STEP: Chief Complaint ─── */}
        {step === 'complaint' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Malalamiko ya Kwanza</Text>
            <Text style={styles.stepSub}>Andika au zungumza kwa Kiswahili tatizo la mgonjwa.</Text>

            {/* Voice input */}
            <VoiceInputButton
              onTranscript={(text) => setComplaint(prev => prev ? prev + ' ' + text : text)}
              placeholder="Bonyeza 🎙 kuzungumza, au andika chini"
            />

            <Field label="MALALAMIKO (KISWAHILI)" required>
              <TextInput
                style={[shared.input, styles.textArea]}
                placeholder="Mfano: Mtoto ana homa kali tangu jana usiku, ana degedege, na hawezi kunywa maji..."
                value={complaint}
                onChangeText={setComplaint}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </Field>
            <Text style={styles.charCount}>{complaint.length} herufi (kiwango cha chini: 10)</Text>

            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>💡 Vidokezo:</Text>
              <Text style={styles.tipText}>
                • Lini tatizo lilianza?{'\n'}
                • Kitu chochote kilichofanya tatizo kuwa baya zaidi?{'\n'}
                • Je, mgonjwa amechukua dawa yoyote?
              </Text>
            </View>
          </View>
        )}

        {/* ─── STEP: Symptoms ─── */}
        {step === 'symptoms' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Dalili Zilizobainishwa</Text>
            <Text style={styles.stepSub}>Chagua dalili zote zinazoonekana.</Text>

            <View style={styles.chipGrid}>
              {COMMON_SYMPTOMS.map(s => {
                const active = selectedSymptoms.includes(s);
                const isEmergencySymptom = ['Degedege', 'Ugumu wa kupumua', 'Pallor', 'Jaundice'].includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.chip,
                      active && styles.chipActive,
                      active && isEmergencySymptom && { backgroundColor: colors.emergencyBg, borderColor: colors.emergency },
                    ]}
                    onPress={() => toggleSymptom(s)}
                  >
                    <Text style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                      active && isEmergencySymptom && { color: colors.emergency },
                    ]}>
                      {active ? '✓ ' : ''}{s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedSymptoms.length > 0 && (
              <View style={styles.selectedCount}>
                <Text style={{ color: colors.green, fontWeight: '600' }}>
                  {selectedSymptoms.length} dalili zimechaguliwa
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ─── STEP: Vitals ─── */}
        {step === 'vitals' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Vipimo vya Msingi</Text>
            <Text style={styles.stepSub}>Jaza vipimo unavyovipima. (Si lazima kila kitu)</Text>

            <View style={styles.vitalsGrid}>
              <VitalInput label="Joto" unit="°C" placeholder="37.5" value={tempC} onChange={setTempC} keyboardType="decimal-pad" warning={parseFloat(tempC) > 38.5} />
              <VitalInput label="Mapigo ya Pumzi" unit="/dak" placeholder="20" value={rr} onChange={setRR} keyboardType="number-pad" warning={parseInt(rr, 10) > 40} />
              <VitalInput label="MUAC" unit="mm" placeholder="125" value={muac} onChange={setMUAC} keyboardType="number-pad" warning={parseInt(muac, 10) < 115} />
              <VitalInput label="Uzito" unit="kg" placeholder="12.5" value={weightKg} onChange={setWeightKg} keyboardType="decimal-pad" />
            </View>

            {muac && parseInt(muac, 10) < 115 && (
              <View style={styles.vitalWarning}>
                <Text style={styles.vitalWarningText}>⚠️ MUAC chini ya 115mm — SAM (Severe Acute Malnutrition). Peleka hospitali.</Text>
              </View>
            )}

            <Field label="UCHUNGUZI WA MACHO">
              <View style={styles.switchRow}>
                <Text style={typography.body}>Pallor (Weupe wa macho / midomo)</Text>
                <Switch value={hasPallor} onValueChange={setHasPallor}
                  trackColor={{ true: colors.emergency, false: colors.border }}
                  thumbColor={colors.surface} />
              </View>
              <View style={[styles.switchRow, { marginTop: spacing.sm }]}>
                <Text style={typography.body}>Jaundice (Njano ya macho / ngozi)</Text>
                <Switch value={hasJaundice} onValueChange={setHasJaundice}
                  trackColor={{ true: colors.warning, false: colors.border }}
                  thumbColor={colors.surface} />
              </View>
            </Field>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        {step !== 'vitals' ? (
          <TouchableOpacity
            style={[shared.primaryButton, { flex: 1 }, !canAdvance() && { opacity: 0.5 }]}
            onPress={advance}
            disabled={!canAdvance()}
          >
            <Text style={shared.primaryButtonText}>Endelea →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[shared.primaryButton, { flex: 1, backgroundColor: colors.greenDark }, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={shared.primaryButtonText}>
              {submitting ? 'Inatuma...' : '🤖 Pata Tathmini ya AI →'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text style={[typography.label, { marginBottom: spacing.xs }]}>
          {label}{required && <Text style={{ color: colors.emergency }}> *</Text>}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function VitalInput({ label, unit, placeholder, value, onChange, keyboardType, warning }: {
  label: string; unit: string; placeholder: string; value: string;
  onChange: (v: string) => void; keyboardType: any; warning?: boolean;
}) {
  return (
    <View style={styles.vitalField}>
      <Text style={[typography.label, { marginBottom: 4 }]}>{label}</Text>
      <View style={[styles.vitalInputRow, warning && { borderColor: colors.warning, borderWidth: 2 }]}>
        <TextInput
          style={styles.vitalInput}
          placeholder={placeholder}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
        />
        <Text style={styles.vitalUnit}>{unit}</Text>
      </View>
      {warning && <Text style={{ color: colors.warning, fontSize: 11, marginTop: 2 }}>⚠️ Angalia</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  backText: { color: colors.green, fontWeight: '600', fontSize: 15 },
  headerTitle: { ...typography.h4 },
  progressRow: {
    flexDirection: 'row', gap: 6, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, backgroundColor: colors.surface,
  },
  progressDot: {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border,
  },
  emergencyBanner: {
    backgroundColor: colors.emergency, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center',
  },
  emergencyText: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 },
  scroll: { flex: 1 },
  stepContent: { padding: spacing.md },
  stepTitle: { ...typography.h2, marginBottom: 4 },
  stepSub: { ...typography.bodyMuted, marginBottom: spacing.lg },
  sexRow: { flexDirection: 'row', gap: spacing.sm },
  sexBtn: {
    flex: 1, padding: 14, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.surface,
  },
  sexBtnActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  sexBtnText: { fontSize: 16, fontWeight: '600', color: colors.inkMuted },
  sexBtnTextActive: { color: colors.greenDark },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ageOr: { ...typography.bodyMuted, paddingHorizontal: 4 },
  ageSubLabel: { ...typography.caption, marginBottom: 4, color: colors.inkMuted },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  textArea: { height: 120, paddingTop: 12 },
  charCount: { ...typography.caption, color: colors.inkDim, marginTop: 4, textAlign: 'right' },
  tipBox: {
    backgroundColor: colors.infoBg, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.md,
    borderLeftWidth: 3, borderLeftColor: colors.info,
  },
  tipTitle: { fontWeight: '700', color: colors.info, marginBottom: 6, fontSize: 14 },
  tipText: { ...typography.caption, color: colors.info, lineHeight: 20 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  chipText: { fontSize: 14, color: colors.inkMuted, fontWeight: '500' },
  chipTextActive: { color: colors.greenDark, fontWeight: '700' },
  selectedCount: {
    marginTop: spacing.md, padding: spacing.sm,
    backgroundColor: colors.greenLight, borderRadius: radius.md,
    alignItems: 'center',
  },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  vitalField: { width: '47%' },
  vitalInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, overflow: 'hidden',
  },
  vitalInput: { flex: 1, padding: 12, fontSize: 16, color: colors.ink },
  vitalUnit: { paddingHorizontal: 10, color: colors.inkMuted, fontWeight: '600', fontSize: 13 },
  vitalWarning: {
    backgroundColor: colors.emergencyBg, borderRadius: radius.md,
    padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.emergency,
    marginBottom: spacing.md,
  },
  vitalWarningText: { color: colors.emergency, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.md, paddingBottom: 32,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    flexDirection: 'row',
  },
});
