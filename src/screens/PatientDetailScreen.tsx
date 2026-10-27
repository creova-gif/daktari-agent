import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, radius, shadow, shared, getRiskStyle } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList, Patient } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PatientDetail'>;
  route: RouteProp<RootStackParamList, 'PatientDetail'>;
};

interface PatientWithVisits extends Patient {
  known_conditions: string[];
  current_medications: string[];
  allergies: string[];
  last_visit_at?: string;
}

interface VisitSummary {
  id: string;
  created_at: string;
  status: string;
  chief_complaint_sw: string;
  ai_recommendations: Array<{
    likely_diagnosis_sw: string;
    risk_level: string;
    confidence: string;
    emergency_flag: boolean;
  }>;
}

export default function PatientDetailScreen({ navigation, route }: Props) {
  const { patientId } = route.params;
  const [patient, setPatient] = useState<PatientWithVisits | null>(null);
  const [visits, setVisits] = useState<VisitSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [{ data: p }, { data: v }] = await Promise.all([
        supabase.from('patients').select('*').eq('id', patientId).single(),
        supabase
          .from('clinical_visits')
          .select(`
            id, created_at, status, chief_complaint_sw,
            ai_recommendations(likely_diagnosis_sw, risk_level, confidence, emergency_flag)
          `)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);
      if (p) setPatient(p as PatientWithVisits);
      if (v) setVisits(v as VisitSummary[]);
    } catch (err) {
      console.error('[PatientDetail]', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  function formatAge(p: PatientWithVisits) {
    if (p.age_months) return `Miezi ${p.age_months}`;
    if (p.age_years)  return `Miaka ${p.age_years}`;
    return 'Umri haujulikani';
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('sw-TZ', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function riskEmoji(risk: string) {
    return { emergency: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[risk] ?? '⚪';
  }

  if (loading) {
    return (
      <View style={[shared.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={[shared.screen, { alignItems: 'center', justifyContent: 'center', padding: spacing.xl }]}>
        <Text style={typography.h4}>Mgonjwa hakupatikana.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.green }}>Rudi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const emergencyCount = visits.filter(v =>
    v.ai_recommendations?.[0]?.emergency_flag
  ).length;

  const completedCount = visits.filter(v => v.status === 'completed').length;

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Rudi</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Kadi ya Mgonjwa</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('NewVisit', { patientId })}
          style={styles.newVisitBtn}
        >
          <Text style={styles.newVisitText}>+ Ziara</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Hero patient card */}
        <View style={styles.heroCard}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <View style={[
              styles.avatar,
              { backgroundColor: patient.sex === 'female' ? '#FDE8F4' : '#E8F4FD' }
            ]}>
              <Text style={styles.avatarIcon}>
                {patient.sex === 'female' ? '♀' : '♂'}
              </Text>
            </View>
            {patient.is_pregnant && (
              <View style={styles.pregnantBadge}>
                <Text style={{ fontSize: 14 }}>🤰</Text>
              </View>
            )}
          </View>

          <View style={styles.heroInfo}>
            <Text style={styles.patName}>{patient.full_name}</Text>
            <Text style={styles.patMeta}>
              {patient.sex === 'female' ? 'Mke' : 'Mme'} · {formatAge(patient)}
            </Text>
            <Text style={styles.patMeta}>📍 {patient.village} · {patient.district}</Text>
            {patient.phone && (
              <Text style={styles.patMeta}>📱 {patient.phone}</Text>
            )}
            {patient.last_visit_at && (
              <Text style={styles.lastVisit}>
                Ziara ya Mwisho: {formatDate(patient.last_visit_at)}
              </Text>
            )}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill label="Ziara Zote" value={visits.length} color={colors.green} />
          <StatPill label="Zilizokamilika" value={completedCount} color={colors.success} />
          <StatPill label="Dharura" value={emergencyCount} color={emergencyCount > 0 ? colors.emergency : colors.inkDim} />
        </View>

        {/* Medical background */}
        {(patient.known_conditions?.length > 0 ||
          patient.current_medications?.length > 0 ||
          patient.allergies?.length > 0) && (
          <View style={[shared.card, styles.section]}>
            <Text style={styles.sectionTitle}>📋 Historia ya Afya</Text>

            {patient.known_conditions?.length > 0 && (
              <MedSection
                label="Magonjwa Yanayojulikana"
                items={patient.known_conditions}
                color={colors.warning}
              />
            )}
            {patient.current_medications?.length > 0 && (
              <MedSection
                label="Dawa Anazotumia"
                items={patient.current_medications}
                color={colors.info}
              />
            )}
            {patient.allergies?.length > 0 && (
              <MedSection
                label="Mzio wa Dawa"
                items={patient.allergies}
                color={colors.emergency}
              />
            )}
          </View>
        )}

        {/* Visit timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗓 Historia ya Ziara ({visits.length})</Text>

          {visits.length === 0 ? (
            <View style={styles.emptyVisits}>
              <Text style={styles.emptyText}>Hakuna ziara bado.</Text>
              <TouchableOpacity
                style={styles.startVisitBtn}
                onPress={() => navigation.navigate('NewVisit', { patientId })}
              >
                <Text style={styles.startVisitText}>Anza Ziara ya Kwanza →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.timeline}>
              {visits.map((visit, idx) => {
                const aiRec = visit.ai_recommendations?.[0];
                const riskStyle = aiRec ? getRiskStyle(aiRec.risk_level as any) : null;
                const isLast = idx === visits.length - 1;

                return (
                  <TouchableOpacity
                    key={visit.id}
                    style={styles.timelineItem}
                    onPress={() => navigation.navigate('VisitDetail', { visitId: visit.id })}
                    activeOpacity={0.7}
                  >
                    {/* Spine */}
                    <View style={styles.spineCol}>
                      <View style={[
                        styles.spineDot,
                        aiRec?.emergency_flag && { backgroundColor: colors.emergency },
                      ]} />
                      {!isLast && <View style={styles.spineLine} />}
                    </View>

                    {/* Content */}
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineDate}>{formatDate(visit.created_at)}</Text>
                        {riskStyle && (
                          <Text style={{ fontSize: 14 }}>{riskEmoji(aiRec!.risk_level)}</Text>
                        )}
                        <View style={[
                          styles.statusPill,
                          { backgroundColor: visit.status === 'completed'
                              ? colors.successBg
                              : visit.status === 'in_progress'
                              ? colors.warningBg
                              : colors.emergencyBg }
                        ]}>
                          <Text style={[styles.statusPillText, {
                            color: visit.status === 'completed'
                              ? colors.success
                              : visit.status === 'in_progress'
                              ? colors.warning
                              : colors.emergency
                          }]}>
                            {visit.status === 'completed' ? '✓' :
                             visit.status === 'in_progress' ? '⏳' : '🚑'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.complaint} numberOfLines={1}>
                        {visit.chief_complaint_sw}
                      </Text>

                      {aiRec && (
                        <Text style={styles.diagnosis} numberOfLines={1}>
                          🤖 {aiRec.likely_diagnosis_sw}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statPill, { borderColor: color + '30', backgroundColor: color + '10' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MedSection({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[styles.medLabel, { color }]}>{label}</Text>
      <View style={styles.tagRow}>
        {items.map((item, i) => (
          <View key={i} style={[styles.tag, { backgroundColor: color + '15', borderColor: color + '30' }]}>
            <Text style={[styles.tagText, { color }]}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { color: colors.green, fontWeight: '600', fontSize: 15 },
  title: { ...typography.h4 },
  newVisitBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.green, borderRadius: radius.full,
  },
  newVisitText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  heroCard: {
    flexDirection: 'row', gap: spacing.md,
    padding: spacing.lg, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarIcon: { fontSize: 32 },
  pregnantBadge: {
    position: 'absolute', bottom: 0, right: -2,
    backgroundColor: colors.surface, borderRadius: 12, padding: 2,
  },
  heroInfo: { flex: 1 },
  patName: { ...typography.h2, marginBottom: 4 },
  patMeta: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  lastVisit: { ...typography.caption, color: colors.green, marginTop: 6, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', gap: spacing.sm,
    padding: spacing.md,
  },
  statPill: {
    flex: 1, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  statLabel: { ...typography.caption, color: colors.inkMuted, marginTop: 2, textAlign: 'center' },

  section: { padding: spacing.md },
  sectionTitle: { ...typography.h4, marginBottom: spacing.md },
  medLabel: { ...typography.label, marginBottom: spacing.xs },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1,
  },
  tagText: { fontSize: 12, fontWeight: '600' },

  timeline: { paddingLeft: spacing.sm },
  timelineItem: {
    flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm,
  },
  spineCol: { alignItems: 'center', width: 16 },
  spineDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.green, marginTop: 3,
  },
  spineLine: {
    width: 2, flex: 1, backgroundColor: colors.border,
    marginTop: 4, marginBottom: -4,
  },
  timelineContent: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  timelineDate: { ...typography.caption, color: colors.inkMuted, flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  complaint: { ...typography.body, fontSize: 14, lineHeight: 20 },
  diagnosis: { ...typography.caption, color: colors.inkMuted, marginTop: 4 },

  emptyVisits: { alignItems: 'center', padding: spacing.xl },
  emptyText: { ...typography.bodyMuted, marginBottom: spacing.md },
  startVisitBtn: {
    paddingVertical: 12, paddingHorizontal: 24,
    backgroundColor: colors.green, borderRadius: radius.full,
  },
  startVisitText: { color: '#fff', fontWeight: '700' },
});
