import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getVisitWithDetails } from '../lib/supabase';
import { colors, typography, spacing, radius, shadow, shared, getRiskStyle, getConfidenceStyle } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VisitDetail'>;
  route: RouteProp<RootStackParamList, 'VisitDetail'>;
};

export default function VisitDetailScreen({ navigation, route }: Props) {
  const { visitId } = route.params;
  const [visit, setVisit] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVisitWithDetails(visitId)
      .then(v => setVisit(v))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [visitId]);

  if (loading) {
    return (
      <View style={[shared.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  }

  if (!visit) {
    return (
      <View style={[shared.screen, { alignItems: 'center', justifyContent: 'center', padding: spacing.xl }]}>
        <Text style={typography.h4}>Ziara haikupatikana.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.green }}>Rudi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const patient = visit.patients as Record<string, unknown>;
  const aiRecs = visit.ai_recommendations as Array<Record<string, unknown>>;
  const aiRec = aiRecs?.[0];
  const riskStyle = aiRec ? getRiskStyle(aiRec.risk_level as any) : null;
  const confStyle = aiRec ? getConfidenceStyle(aiRec.confidence as any) : null;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('sw-TZ', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatAge() {
    if (patient?.age_months) return `Miezi ${patient.age_months}`;
    if (patient?.age_years) return `Miaka ${patient.age_years}`;
    return 'Umri haujulikani';
  }

  const vitals: { label: string; value: string; warning?: boolean }[] = [
    visit.temperature_c   ? { label: 'Joto',           value: `${visit.temperature_c}°C`, warning: Number(visit.temperature_c) > 38.5 } : null,
    visit.respiratory_rate ? { label: 'Pumzi/Dak',     value: `${visit.respiratory_rate}`, warning: Number(visit.respiratory_rate) > 40 } : null,
    visit.muac_mm         ? { label: 'MUAC',            value: `${visit.muac_mm}mm`, warning: Number(visit.muac_mm) < 115 } : null,
    visit.weight_kg       ? { label: 'Uzito',           value: `${visit.weight_kg}kg` } : null,
    visit.has_pallor      ? { label: 'Pallor',          value: 'Ndiyo', warning: true } : null,
    visit.has_jaundice    ? { label: 'Jaundice',        value: 'Ndiyo', warning: true } : null,
  ].filter(Boolean) as { label: string; value: string; warning?: boolean }[];

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Rudi</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Maelezo ya Ziara</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}>

        {/* Patient card */}
        <View style={[shared.card, { marginBottom: spacing.sm }]}>
          <SectionLabel>MGONJWA</SectionLabel>
          <Text style={styles.patName}>{String(patient?.full_name ?? '')}</Text>
          <Text style={styles.patMeta}>
            {patient?.sex === 'male' ? '♂ Mme' : '♀ Mke'} · {formatAge()} · {String(patient?.village ?? '')}
          </Text>
          {patient?.is_pregnant && <Text style={{ color: colors.info, marginTop: 4, fontSize: 13 }}>🤰 Mjamzito</Text>}
          <Text style={[styles.patMeta, { marginTop: 6 }]}>
            🗓 {formatDate(String(visit.created_at))}
          </Text>
        </View>

        {/* Chief complaint */}
        <View style={[shared.card, { marginBottom: spacing.sm }]}>
          <SectionLabel>MALALAMIKO YA KWANZA</SectionLabel>
          <Text style={styles.bodyText}>{String(visit.chief_complaint_sw)}</Text>

          {(visit.symptoms as string[])?.length > 0 && (
            <View style={styles.symptomsWrap}>
              {(visit.symptoms as string[]).map(s => (
                <View key={s} style={styles.symptomChip}>
                  <Text style={styles.symptomText}>{s}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Vitals */}
        {vitals.length > 0 && (
          <View style={[shared.card, { marginBottom: spacing.sm }]}>
            <SectionLabel>VIPIMO VYA MSINGI</SectionLabel>
            <View style={styles.vitalsGrid}>
              {vitals.map(v => (
                <View key={v.label} style={[styles.vitalCell, v.warning && { backgroundColor: colors.emergencyBg }]}>
                  <Text style={[styles.vitalValue, v.warning && { color: colors.emergency }]}>{v.value}</Text>
                  <Text style={styles.vitalLabel}>{v.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* AI Recommendation */}
        {aiRec && (
          <View style={[shared.card, { marginBottom: spacing.sm, borderWidth: 1.5, borderColor: riskStyle?.border ?? colors.border }]}>
            <View style={styles.aiHeader}>
              <Text style={styles.aiIcon}>🤖</Text>
              <View style={{ flex: 1 }}>
                <SectionLabel>TATHMINI YA DAKTARI AI</SectionLabel>
                <Text style={[styles.patMeta, { marginTop: 0 }]}>{String(aiRec.protocol_cited ?? '')}</Text>
              </View>
              {riskStyle && (
                <View style={[styles.riskBadge, { backgroundColor: riskStyle.bg, borderColor: riskStyle.border }]}>
                  <Text style={[styles.riskText, { color: riskStyle.text }]}>
                    {(aiRec.risk_level as string).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.diagLabel}>Utambuzi:</Text>
            <Text style={styles.diagText}>{String(aiRec.likely_diagnosis_sw)}</Text>

            {confStyle && (
              <View style={styles.confRow}>
                <Text style={styles.confLabel}>Uhakika:</Text>
                <Text style={[styles.confValue, { color: confStyle.color }]}>
                  {aiRec.confidence === 'high' ? 'Juu' : aiRec.confidence === 'medium' ? 'Wastani' : 'Chini'}
                  {' '}({Math.round(Number(aiRec.confidence_score) * 100)}%)
                </Text>
              </View>
            )}

            {aiRec.emergency_flag && (
              <View style={styles.emergencyTag}>
                <Text style={styles.emergencyTagText}>🚨 DHARURA — Peleka Hospitali</Text>
              </View>
            )}

            <Text style={[styles.diagLabel, { marginTop: spacing.md }]}>Hatua zilizoshauriwa:</Text>
            <Text style={styles.actionText}>{String(aiRec.recommended_action_sw)}</Text>
          </View>
        )}

        {/* CHW Feedback */}
        <View style={[shared.card, { marginBottom: spacing.sm }]}>
          <SectionLabel>MAONI YA CHW</SectionLabel>
          <View style={styles.feedbackRow}>
            <Text style={typography.body}>Alikubaliana na AI:</Text>
            <Text style={{
              fontWeight: '700',
              color: visit.chw_agreed_with_ai === true ? colors.success :
                     visit.chw_agreed_with_ai === false ? colors.emergency : colors.inkDim,
            }}>
              {visit.chw_agreed_with_ai === true ? '✓ Ndiyo' :
               visit.chw_agreed_with_ai === false ? '✗ Hapana' : '— Haijajulikana'}
            </Text>
          </View>
          {visit.chw_notes && (
            <Text style={[styles.bodyText, { marginTop: spacing.sm }]}>{String(visit.chw_notes)}</Text>
          )}
          {visit.referral_facility && (
            <Text style={[styles.patMeta, { marginTop: 6 }]}>
              🏥 Pelekwa: {String(visit.referral_facility)}
            </Text>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { color: colors.green, fontWeight: '600', fontSize: 15 },
  title: { ...typography.h4 },
  sectionLabel: { ...typography.label, color: colors.green, marginBottom: spacing.sm },
  patName: { ...typography.h3, marginBottom: 4 },
  patMeta: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  bodyText: { ...typography.body, lineHeight: 24 },
  symptomsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  symptomChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: colors.greenLight, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.green + '40',
  },
  symptomText: { fontSize: 12, color: colors.greenDark, fontWeight: '600' },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vitalCell: {
    width: '30%', padding: spacing.sm, backgroundColor: colors.surface2,
    borderRadius: radius.md, alignItems: 'center',
  },
  vitalValue: { fontSize: 18, fontWeight: '700', color: colors.ink },
  vitalLabel: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  aiHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  aiIcon: { fontSize: 28 },
  riskBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.sm, borderWidth: 1.5, alignSelf: 'flex-start',
  },
  riskText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  diagLabel: { ...typography.label, marginBottom: 4 },
  diagText: { fontSize: 17, fontWeight: '700', color: colors.ink, lineHeight: 26 },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  confLabel: { ...typography.caption },
  confValue: { fontWeight: '700', fontSize: 13 },
  emergencyTag: {
    marginTop: spacing.sm, padding: 10,
    backgroundColor: colors.emergencyBg, borderRadius: radius.md,
  },
  emergencyTagText: { color: colors.emergency, fontWeight: '800', fontSize: 14 },
  actionText: { ...typography.body, lineHeight: 26 },
  feedbackRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
});
