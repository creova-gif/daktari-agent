import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getVisitWithDetails, saveRecommendation, completeVisit } from '../lib/supabase';
import { runClinicalAgent } from '../lib/clinicalAgent';
import { WellbeingTracker } from '../lib/wellbeing';
import { recordLocalTrainingSignal, syncGradientsIfReady } from '../lib/federatedLearning';
import { useAuth } from '../hooks/useAuth';
import {
  colors, typography, spacing, radius, shadow, shared,
  getRiskStyle, getConfidenceStyle,
} from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList, AIRecommendation } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AIRecommendation'>;
  route: RouteProp<RootStackParamList, 'AIRecommendation'>;
};

type Phase = 'loading' | 'ready' | 'completing' | 'done' | 'error';

export default function AIRecommendationScreen({ navigation, route }: Props) {
  const { visitId } = route.params;
  const { chw } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [visit, setVisit] = useState<Record<string, unknown> | null>(null);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [chwAgreed, setCHWAgreed] = useState<boolean | null>(null);
  const [chwNotes, setCHWNotes] = useState('');
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation for loading
  useEffect(() => {
    if (phase === 'loading') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [phase]);

  useEffect(() => {
    loadAndAnalyze();
  }, [visitId]);

  async function loadAndAnalyze() {
    try {
      // Load visit details
      const visitData = await getVisitWithDetails(visitId);
      setVisit(visitData);

      const patient = visitData.patients as Record<string, unknown>;

      // Run the clinical agent
      const result = await runClinicalAgent({
        visitId,
        chiefComplaintSw: String(visitData.chief_complaint_sw),
        symptoms: (visitData.symptoms as string[]) ?? [],
        vitals: {
          temperature_c: visitData.temperature_c as number | undefined,
          respiratory_rate: visitData.respiratory_rate as number | undefined,
          muac_mm: visitData.muac_mm as number | undefined,
          weight_kg: visitData.weight_kg as number | undefined,
          has_pallor: visitData.has_pallor as boolean | undefined,
          has_jaundice: visitData.has_jaundice as boolean | undefined,
        },
        patientAge: {
          years: patient?.age_years as number | undefined,
          months: patient?.age_months as number | undefined,
        },
        patientSex: patient?.sex as 'male' | 'female' | undefined,
        isPregnant: patient?.is_pregnant as boolean | undefined,
        district: String(chw?.district ?? 'other'),
      });

      // Save recommendation to Supabase
      const saved = await saveRecommendation(result.recommendation);
      setRecommendation(saved as AIRecommendation);
      setPhase('ready');
    } catch (err) {
      console.error('[AIRec] Error:', err);
      setPhase('error');
    }
  }

  async function handleComplete(agreed: boolean) {
    if (!recommendation) return;
    setCHWAgreed(agreed);
    setPhase('completing');

    try {
      const isEmergency = recommendation.emergency_flag;
      const isHighRisk = recommendation.risk_level === 'emergency' || recommendation.risk_level === 'high';

      await completeVisit(visitId, {
        chw_agreed_with_ai: agreed,
        status: isEmergency ? 'referred' : 'completed',
        referral_facility: isEmergency ? 'Hospitali ya Wilaya' : undefined,
      });

      // ── Wellbeing tracking ──────────────────────────────────────────────
      if (chw) {
        WellbeingTracker.visitCompleted(chw.id);
        if (agreed) WellbeingTracker.aiAgreed(chw.id);
        else        WellbeingTracker.aiDisagreed(chw.id);
        if (isEmergency) WellbeingTracker.escalationFired(chw.id);
        if (recommendation.red_line_triggered) WellbeingTracker.redLineFired(chw.id);
        if (recommendation.confidence === 'low') WellbeingTracker.lowConfidence(chw.id);

        // ── Federated learning signal (privacy-safe — no patient data synced) ──
        await recordLocalTrainingSignal({
          chwId: chw.id,
          district: chw.district,
          symptomCount: Array.isArray((visit as Record<string,unknown>)?.symptoms)
            ? ((visit as Record<string,unknown>).symptoms as string[]).length : 0,
          hadVitals: Boolean((visit as Record<string,unknown>)?.temperature_c),
          confidenceScore: recommendation.confidence_score,
          riskLevel: recommendation.risk_level,
          chwAgreed: agreed,
          emergencyFlag: recommendation.emergency_flag,
          redLineTriggered: recommendation.red_line_triggered,
        });
        await syncGradientsIfReady(chw.id, true);
      }

      setPhase('done');

      if (isEmergency) {
        Alert.alert(
          '🚨 DHARURA — Hatua ya Haraka',
          'Piga simu msimamizi wako wa wilaya SASA HIVI na umpe taarifa hii.\n\nNamba ya dharura: 0800-AFYA (0800-2392)',
          [
            { text: 'Piga Simu', style: 'default' },
            { text: 'Rudi Nyumbani', onPress: () => navigation.navigate('Dashboard') },
          ]
        );
      } else {
        navigation.navigate('Dashboard');
      }
    } catch (err) {
      Alert.alert('Hitilafu', 'Imeshindwa kukamilisha ziara. Jaribu tena.');
      setPhase('ready');
    }
  }

  // ─── Loading State ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <SafeAreaView style={[shared.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.View style={[styles.aiOrb, { opacity: pulseAnim }]}>
          <Text style={styles.aiOrbIcon}>🧠</Text>
        </Animated.View>
        <Text style={[typography.h3, { marginTop: spacing.lg, textAlign: 'center' }]}>
          Daktari AI anafikiria...
        </Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.sm, textAlign: 'center', maxWidth: 280 }]}>
          Inafanya uchambuzi wa dalili na miongozo ya MoH Tanzania.
        </Text>
        <ActivityIndicator color={colors.green} style={{ marginTop: spacing.lg }} />
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={[shared.screen, { alignItems: 'center', justifyContent: 'center', padding: spacing.xl }]}>
        <Text style={{ fontSize: 48 }}>⚠️</Text>
        <Text style={[typography.h3, { marginTop: spacing.md, textAlign: 'center' }]}>
          Hitilafu ya AI
        </Text>
        <Text style={[typography.bodyMuted, { textAlign: 'center', marginTop: spacing.sm }]}>
          Daktari AI haiwezi kutoa tathmini sasa hivi. Wasiliana na msimamizi wako.
        </Text>
        <TouchableOpacity style={[shared.primaryButton, { marginTop: spacing.xl, paddingHorizontal: 32 }]}
          onPress={() => navigation.navigate('Dashboard')}>
          <Text style={shared.primaryButtonText}>Rudi Nyumbani</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!recommendation) return null;

  const riskStyle = getRiskStyle(recommendation.risk_level);
  const confStyle = getConfidenceStyle(recommendation.confidence);
  const isEmergency = recommendation.emergency_flag || recommendation.red_line_triggered;

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Emergency Banner */}
        {isEmergency && (
          <View style={styles.emergencyHeader}>
            <Text style={styles.emergencyHeaderText}>
              🚨 DHARURA — PELEKA HOSPITALI SASA HIVI
            </Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.aiLogo, isEmergency && { backgroundColor: colors.emergencyBg }]}>
            <Text style={styles.aiLogoText}>🤖</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>TATHMINI YA DAKTARI AI</Text>
            <Text style={styles.headerSub}>Inategemea miongozo ya MoH Tanzania</Text>
          </View>
          {/* Risk Badge */}
          <View style={[styles.riskBadge, { backgroundColor: riskStyle.bg, borderColor: riskStyle.border }]}>
            <Text style={[styles.riskText, { color: riskStyle.text }]}>
              {recommendation.risk_level.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Main Diagnosis Card */}
        <View style={[styles.diagCard, isEmergency && { borderColor: colors.emergency, borderWidth: 2 }]}>
          <Text style={styles.diagLabel}>UTAMBUZI UNAOWEZEKANA</Text>
          <Text style={styles.diagText}>{recommendation.likely_diagnosis_sw}</Text>

          {/* Confidence */}
          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>Uhakika:</Text>
            <View style={[styles.confidenceDot, { backgroundColor: confStyle.color }]} />
            <Text style={[styles.confidenceValue, { color: confStyle.color }]}>
              {recommendation.confidence === 'high' ? 'Juu' :
               recommendation.confidence === 'medium' ? 'Wastani' : 'Chini'}
              {' '}({Math.round(recommendation.confidence_score * 100)}%)
            </Text>
          </View>

          <Text style={styles.protocolCited}>
            📋 Itifaki: {recommendation.protocol_cited}
          </Text>
        </View>

        {/* Red Line Warning */}
        {recommendation.red_line_triggered && (
          <View style={styles.redLineCard}>
            <Text style={styles.redLineTitle}>⛔ ONYO LA USALAMA</Text>
            <Text style={styles.redLineBody}>
              Mapendekezo ya awali yamezuiwa na mfumo wa usalama. Pata msaada wa daktari.
            </Text>
          </View>
        )}

        {/* Recommended Action */}
        <View style={styles.actionCard}>
          <Text style={styles.actionLabel}>HATUA ZINAZOSHAURIWA</Text>
          <Text style={styles.actionText}>{recommendation.recommended_action_sw}</Text>
        </View>

        {/* Patient context summary */}
        {visit && (
          <View style={styles.contextCard}>
            <Text style={styles.contextLabel}>MUHTASARI WA KESI</Text>
            <Text style={styles.contextText}>
              Malalamiko: {String((visit as any).chief_complaint_sw ?? '')}
            </Text>
            {(visit as any).symptoms?.length > 0 && (
              <Text style={styles.contextText}>
                Dalili: {((visit as any).symptoms as string[]).join(', ')}
              </Text>
            )}
          </View>
        )}

        {/* CHW Agreement */}
        {phase === 'ready' && (
          <View style={styles.agreementSection}>
            <Text style={styles.agreementTitle}>Je, unakubaliana na tathmini hii?</Text>
            <Text style={styles.agreementSub}>
              Wewe ndiye mtaalamu. AI ni msaidizi wako, si mkurugenzi.
            </Text>
            <View style={styles.agreementBtns}>
              <TouchableOpacity
                style={[styles.agreeBtn, { borderColor: colors.green, backgroundColor: colors.greenLight }]}
                onPress={() => handleComplete(true)}
              >
                <Text style={[styles.agreeBtnText, { color: colors.greenDark }]}>
                  ✓ Nakubaliana — Endelea
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.agreeBtn, { borderColor: colors.warning, backgroundColor: colors.warningBg }]}
                onPress={() => handleComplete(false)}
              >
                <Text style={[styles.agreeBtnText, { color: colors.warning }]}>
                  ✗ Sikubaliani — Andika Maoni
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {phase === 'completing' && (
          <View style={[styles.agreementSection, { alignItems: 'center' }]}>
            <ActivityIndicator color={colors.green} size="large" />
            <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>Inakamilisha ziara...</Text>
          </View>
        )}

        {/* Safety Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚕️ Daktari AI ni msaidizi wa kliniki — si mbadala wa daktari. Daima tumia hukumu yako ya kitaalamu. Kwa dharura yoyote, piga simu 0800-AFYA (0800-2392).
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  emergencyHeader: {
    backgroundColor: colors.emergency, padding: spacing.md,
  },
  emergencyHeaderText: { color: '#fff', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  aiLogo: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  aiLogoText: { fontSize: 26 },
  headerLabel: { ...typography.label, color: colors.green },
  headerSub: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  riskBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.sm, borderWidth: 1.5,
  },
  riskText: { fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  aiOrb: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },
  aiOrbIcon: { fontSize: 48 },
  diagCard: {
    margin: spacing.md, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  diagLabel: { ...typography.label, color: colors.green, marginBottom: spacing.sm },
  diagText: { fontSize: 20, fontWeight: '700', color: colors.ink, lineHeight: 28, marginBottom: spacing.md },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  confidenceLabel: { ...typography.caption },
  confidenceDot: { width: 10, height: 10, borderRadius: 5 },
  confidenceValue: { ...typography.caption, fontWeight: '700' },
  protocolCited: { ...typography.caption, color: colors.inkMuted, marginTop: 4 },
  redLineCard: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.emergencyBg, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 2, borderColor: colors.emergency,
  },
  redLineTitle: { fontWeight: '800', color: colors.emergency, fontSize: 15, marginBottom: 6 },
  redLineBody: { ...typography.body, color: colors.emergency },
  actionCard: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.greenLight, borderRadius: radius.lg, padding: spacing.lg,
    borderLeftWidth: 4, borderLeftColor: colors.green,
  },
  actionLabel: { ...typography.label, color: colors.greenDark, marginBottom: spacing.sm },
  actionText: { fontSize: 16, color: colors.greenDark, lineHeight: 26, fontWeight: '500' },
  contextCard: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md,
  },
  contextLabel: { ...typography.label, marginBottom: spacing.sm },
  contextText: { ...typography.caption, color: colors.inkMuted, marginBottom: 4 },
  agreementSection: {
    margin: spacing.md, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm,
  },
  agreementTitle: { ...typography.h4, marginBottom: 4 },
  agreementSub: { ...typography.caption, color: colors.inkMuted, marginBottom: spacing.md },
  agreementBtns: { gap: spacing.sm },
  agreeBtn: {
    padding: 16, borderRadius: radius.md,
    borderWidth: 2, alignItems: 'center',
  },
  agreeBtnText: { fontSize: 16, fontWeight: '700' },
  disclaimer: {
    margin: spacing.md, padding: spacing.md,
    backgroundColor: colors.surface2, borderRadius: radius.md,
  },
  disclaimerText: { ...typography.caption, color: colors.inkMuted, lineHeight: 18, textAlign: 'center' },
});
