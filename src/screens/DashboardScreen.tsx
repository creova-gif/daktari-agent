import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { getDashboardStats, getRecentVisits } from '../lib/supabase';
import { colors, typography, spacing, radius, shadow, shared, getRiskStyle } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

interface Stats { visitsToday: number; totalPatients: number; openVisits: number; }
interface RecentVisit {
  id: string;
  created_at: string;
  status: string;
  chief_complaint_sw: string;
  patients: { full_name: string; village: string; age_years?: number; age_months?: number } | null;
  ai_recommendations: Array<{ likely_diagnosis_sw: string; risk_level: string; confidence: string; emergency_flag: boolean }>;
}

export default function DashboardScreen({ navigation }: Props) {
  const { chw, signOut } = useAuth();
  const [stats, setStats] = useState<Stats>({ visitsToday: 0, totalPatients: 0, openVisits: 0 });
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!chw) return;
    try {
      const [s, v] = await Promise.all([
        getDashboardStats(chw.id),
        getRecentVisits(chw.id, 5),
      ]);
      setStats(s);
      setRecentVisits(v as unknown as RecentVisit[]);
    } catch (err) {
      console.error('[Dashboard] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chw]);

  useEffect(() => { load(); }, [load]);

  function onRefresh() { setRefreshing(true); load(); }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Habari za asubuhi';
    if (h < 17) return 'Habari za mchana';
    return 'Habari za jioni';
  };

  const formatAge = (v: RecentVisit) => {
    const p = v.patients;
    if (!p) return '';
    if (p.age_months) return `Miezi ${p.age_months}`;
    if (p.age_years) return `Miaka ${p.age_years}`;
    return '';
  };

  if (loading) {
    return (
      <View style={[shared.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>Inapakia...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={shared.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.chwName}>{chw?.full_name ?? 'CHW'} 👋</Text>
            <Text style={styles.facility}>{chw?.facility_name} · {chw?.district}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Text style={styles.notifBell}>🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
              <Text style={styles.profileInitial}>
                {chw?.full_name?.charAt(0) ?? 'C'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Open Visit Warning */}
        {stats.openVisits > 0 && (
          <TouchableOpacity
            style={styles.openVisitBanner}
            onPress={() => navigation.navigate('VisitHistory')}
          >
            <Text style={styles.openVisitText}>
              ⚡ Ziara {stats.openVisits} bado hazijakamilika — bonyeza hapa
            </Text>
          </TouchableOpacity>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard label="Leo" value={stats.visitsToday} unit="Ziara" color={colors.green} />
          <StatCard label="Wagonjwa" value={stats.totalPatients} unit="Wote" color={colors.info} />
          <StatCard label="Wazi" value={stats.openVisits} unit="Ziara" color={stats.openVisits > 0 ? colors.warning : colors.success} />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Hatua za Haraka</Text>
        <View style={styles.actionsGrid}>
          <ActionButton
            icon="🩺"
            label="Ziara Mpya"
            sublabel="Anza tathmini ya mgonjwa"
            color={colors.green}
            onPress={() => navigation.navigate('NewVisit', {})}
          />
          <ActionButton
            icon="🔍"
            label="Tafuta Mgonjwa"
            sublabel="Pata rekodi ya mgonjwa"
            color={colors.info}
            onPress={() => navigation.navigate('PatientSearch')}
          />
        </View>
        <View style={styles.actionsGrid}>
          <ActionButton
            icon="📋"
            label="Historia ya Ziara"
            sublabel="Angalia ziara zilizopita"
            color={colors.inkMuted}
            onPress={() => navigation.navigate('VisitHistory')}
          />
          <ActionButton
            icon="🎓"
            label="Vyeti vya Kazi"
            sublabel="Moduli na astashahada"
            color="#9C27B0"
            onPress={() => navigation.navigate('Certification')}
          />
        </View>
        <View style={styles.actionsGrid}>
          <ActionButton
            icon="🚨"
            label="Dharura"
            sublabel="START triage · Itifaki"
            color={colors.emergency}
            onPress={() => navigation.navigate('EmergencyProtocol')}
          />
          <ActionButton
            icon="💊"
            label="Stok ya Dawa"
            sublabel="Hifadhi na angalia dawa"
            color={colors.info}
            onPress={() => navigation.navigate('StockTracker')}
          />
        </View>

        {/* Recent Visits */}
        <Text style={styles.sectionTitle}>Ziara za Hivi Karibuni</Text>
        {recentVisits.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>Hakuna ziara bado leo.</Text>
            <Text style={styles.emptySubText}>Bonyeza "Ziara Mpya" kuanza.</Text>
          </View>
        ) : (
          recentVisits.map(visit => {
            const aiRec = visit.ai_recommendations?.[0];
            const riskStyle = aiRec ? getRiskStyle(aiRec.risk_level as any) : null;
            return (
              <TouchableOpacity
                key={visit.id}
                style={styles.visitCard}
                onPress={() => navigation.navigate('VisitDetail', { visitId: visit.id })}
                activeOpacity={0.7}
              >
                <View style={styles.visitCardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.visitPatient}>{visit.patients?.full_name ?? 'Mgonjwa'}</Text>
                    <Text style={styles.visitMeta}>
                      {formatAge(visit)} · {visit.patients?.village ?? ''}
                    </Text>
                    <Text style={styles.visitComplaint} numberOfLines={1}>
                      {visit.chief_complaint_sw}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {aiRec && riskStyle && (
                      <View style={[styles.riskBadge, { backgroundColor: riskStyle.bg, borderColor: riskStyle.border }]}>
                        <Text style={[styles.riskBadgeText, { color: riskStyle.text }]}>
                          {aiRec.risk_level.toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {aiRec?.emergency_flag && (
                      <Text style={styles.emergencyDot}>🔴 DHARURA</Text>
                    )}
                    <Text style={styles.visitStatus}>{visit.status === 'completed' ? '✓' : '⏳'}</Text>
                  </View>
                </View>
                {aiRec && (
                  <Text style={styles.diagnosis} numberOfLines={1}>
                    🤖 {aiRec.likely_diagnosis_sw}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

function ActionButton({ icon, label, sublabel, color, onPress }: {
  icon: string; label: string; sublabel: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { borderLeftColor: color, borderLeftWidth: 4 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionSublabel}>{sublabel}</Text>
      </View>
      <Text style={{ color: colors.inkDim, fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.lg,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  greeting: { ...typography.caption, color: colors.inkMuted },
  chwName: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 2 },
  facility: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  profileBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  notifBell: { fontSize: 18 },
  profileInitial: { fontSize: 18, fontWeight: '700', color: colors.greenDark },
  openVisitBanner: {
    margin: spacing.md, padding: spacing.md,
    backgroundColor: colors.warningBg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.warning,
  },
  openVisitText: { color: colors.warning, fontWeight: '600', fontSize: 14 },
  statsRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.md, marginTop: spacing.md,
  },
  statCard: {
    flex: 1, backgroundColor: colors.surface, padding: spacing.md,
    borderRadius: radius.md, alignItems: 'center', ...shadow.sm,
  },
  statValue: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  statLabel: { ...typography.label, marginTop: 2 },
  statUnit: { ...typography.caption, color: colors.inkDim },
  sectionTitle: {
    ...typography.h4, paddingHorizontal: spacing.md,
    marginTop: spacing.xl, marginBottom: spacing.sm,
  },
  actionsGrid: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.md, marginBottom: spacing.sm,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, padding: spacing.md,
    borderRadius: radius.md, ...shadow.sm,
  },
  actionIcon: { fontSize: 24 },
  actionLabel: { ...typography.h4, fontSize: 14 },
  actionSublabel: { ...typography.caption, color: colors.inkMuted },
  visitCard: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, ...shadow.sm,
  },
  visitCardRow: { flexDirection: 'row', gap: spacing.sm },
  visitPatient: { ...typography.h4, fontSize: 15 },
  visitMeta: { ...typography.caption, color: colors.inkMuted, marginTop: 1 },
  visitComplaint: { ...typography.caption, color: colors.inkMuted, marginTop: 4, fontStyle: 'italic' },
  riskBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.sm, borderWidth: 1,
  },
  riskBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  emergencyDot: { fontSize: 11, fontWeight: '700', color: colors.emergency },
  visitStatus: { fontSize: 16, color: colors.inkMuted },
  diagnosis: {
    ...typography.caption, color: colors.inkMuted,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  emptyState: { alignItems: 'center', padding: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { ...typography.h4, color: colors.inkMuted },
  emptySubText: { ...typography.caption, color: colors.inkDim, marginTop: 4 },
  colors: { inkMuted: colors.inkMuted, inkDim: colors.inkDim },
});

const inkMuted = colors.inkMuted;
