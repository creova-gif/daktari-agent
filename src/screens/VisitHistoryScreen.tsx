import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRecentVisits } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius, shadow, shared, getRiskStyle } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VisitHistory'>;
};

type Filter = 'all' | 'in_progress' | 'completed' | 'escalated' | 'referred';

const FILTERS: { value: Filter; label: string; emoji: string }[] = [
  { value: 'all',         label: 'Zote',     emoji: '📋' },
  { value: 'in_progress', label: 'Wazi',     emoji: '⏳' },
  { value: 'completed',   label: 'Imekamilika', emoji: '✅' },
  { value: 'escalated',   label: 'Iliyopandishwa', emoji: '⚠️' },
  { value: 'referred',    label: 'Iliyopelekwa', emoji: '🚑' },
];

export default function VisitHistoryScreen({ navigation }: Props) {
  const { chw } = useAuth();
  const [visits, setVisits] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!chw) return;
    try {
      const data = await getRecentVisits(chw.id, 50);
      setVisits(data as Record<string, unknown>[]);
    } catch (err) {
      console.error('[VisitHistory]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chw]);

  useEffect(() => { load(); }, [load]);

  function onRefresh() { setRefreshing(true); load(); }

  const filtered = filter === 'all'
    ? visits
    : visits.filter(v => v.status === filter);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function formatAge(v: Record<string, unknown>) {
    const p = v.patients as Record<string, unknown> | null;
    if (!p) return '';
    if (p.age_months) return `Miezi ${p.age_months}`;
    if (p.age_years) return `Miaka ${p.age_years}`;
    return '';
  }

  if (loading) {
    return (
      <View style={[shared.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Rudi</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Historia ya Ziara</Text>
        <Text style={[typography.caption, { color: colors.inkMuted }]}>{filtered.length}</Text>
      </View>

      {/* Filter chips */}
      <View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={f => f.value}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
                {f.emoji} {f.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Visit list */}
      <FlatList
        data={filtered}
        keyExtractor={v => String(v.id)}
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
        renderItem={({ item: visit }) => {
          const patient = visit.patients as Record<string, unknown> | null;
          const aiRecs = visit.ai_recommendations as Array<Record<string, unknown>>;
          const aiRec = aiRecs?.[0];
          const riskStyle = aiRec ? getRiskStyle(aiRec.risk_level as any) : null;

          const statusConfig: Record<string, { label: string; color: string }> = {
            in_progress: { label: 'Wazi',            color: colors.warning },
            completed:   { label: 'Imekamilika',     color: colors.success },
            escalated:   { label: 'Iliyopandishwa',  color: colors.emergency },
            referred:    { label: 'Iliyopelekwa',    color: colors.info },
          };
          const sc = statusConfig[String(visit.status)] ?? { label: String(visit.status), color: colors.inkMuted };

          return (
            <TouchableOpacity
              style={styles.visitCard}
              onPress={() => navigation.navigate('VisitDetail', { visitId: String(visit.id) })}
              activeOpacity={0.7}
            >
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>
                    {patient?.full_name ?? 'Mgonjwa'} · {formatAge(visit)}
                  </Text>
                  <Text style={styles.meta}>{patient?.village as string ?? ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={[styles.statusBadge, { backgroundColor: sc.color + '20', borderColor: sc.color }]}>
                    <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                  {riskStyle && (
                    <View style={[styles.riskBadge, { backgroundColor: riskStyle.bg, borderColor: riskStyle.border }]}>
                      <Text style={[styles.riskText, { color: riskStyle.text }]}>
                        {(aiRec?.risk_level as string).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Complaint */}
              <Text style={styles.complaint} numberOfLines={1}>
                📝 {String(visit.chief_complaint_sw ?? '')}
              </Text>

              {/* AI Diagnosis */}
              {aiRec && (
                <Text style={styles.diagnosis} numberOfLines={1}>
                  🤖 {String(aiRec.likely_diagnosis_sw ?? '')}
                </Text>
              )}

              {/* Date */}
              <Text style={styles.date}>{formatDate(String(visit.created_at))}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>
              {filter === 'all' ? 'Hakuna ziara bado.' : `Hakuna ziara za aina hii.`}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
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
  filterRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  filterChipActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  filterTextActive: { color: colors.greenDark },
  visitCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  cardTop: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  patientName: { ...typography.h4, fontSize: 15 },
  meta: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.sm, borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  riskBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.sm, borderWidth: 1,
  },
  riskText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  complaint: { ...typography.caption, color: colors.inkMuted, marginBottom: 4 },
  diagnosis: {
    ...typography.caption, color: colors.inkMuted,
    paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border,
  },
  date: { ...typography.caption, color: colors.inkDim, marginTop: 6, textAlign: 'right' },
  emptyWrap: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { ...typography.bodyMuted, textAlign: 'center' },
});
