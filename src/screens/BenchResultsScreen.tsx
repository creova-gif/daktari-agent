import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBenchLeaderboard, runSwahiliMedBench, BenchRunResult } from '../lib/swahiliMedBench';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius, shadow, shared } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BenchResults'>;
};

interface LeaderboardEntry {
  model_version: string;
  accuracy_pct: number;
  safety_score_pct: number;
  total_questions: number;
  created_at: string;
}

export default function BenchResultsScreen({ navigation }: Props) {
  const { chw } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState({ done: 0, total: 0 });
  const [lastResult, setLastResult] = useState<BenchRunResult | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getBenchLeaderboard(20);
      setLeaderboard(data as LeaderboardEntry[]);
    } catch (err) {
      console.error('[BenchResults]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRunBench() {
    if (!chw) return;
    Alert.alert(
      'Endesha SwahiliMedBench',
      'Hii itachukua dakika 5-10 na itatumia krediti za API. Endelea?',
      [
        { text: 'Ghairi', style: 'cancel' },
        {
          text: 'Endesha', onPress: async () => {
            setRunning(true);
            setRunProgress({ done: 0, total: 0 });
            setLastResult(null);
            try {
              const result = await runSwahiliMedBench({
                modelVersion: 'claude-sonnet-4-20250514',
                questionLimit: 10, // Start with 10 for quick dev run; set to 100+ for real eval
                chwId: chw.id,
                onProgress: (done, total) => setRunProgress({ done, total }),
              });
              setLastResult(result);
              await load();
            } catch (err) {
              Alert.alert('Hitilafu', 'SwahiliMedBench haiwezi kukimbia. Angalia muunganisho wako.');
            } finally {
              setRunning(false);
            }
          }
        },
      ]
    );
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('sw-TZ', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  function scoreColor(pct: number) {
    if (pct >= 90) return colors.success;
    if (pct >= 80) return colors.green;
    if (pct >= 70) return colors.warning;
    return colors.emergency;
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Rudi</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SwahiliMedBench</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>📊</Text>
          <Text style={styles.heroTitle}>SwahiliMedBench</Text>
          <Text style={styles.heroSub}>
            Kipimo cha kwanza cha AI ya kliniki kwa Kiswahili — Tanzania.
            Maswali 1,000 ya kliniki yanayotegemea miongozo ya MoH.
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>1,000</Text>
              <Text style={styles.heroStatLabel}>Maswali</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>7</Text>
              <Text style={styles.heroStatLabel}>Makundi</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>90%</Text>
              <Text style={styles.heroStatLabel}>Kiwango cha Usalama</Text>
            </View>
          </View>
        </View>

        {/* Run button */}
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg }}>
          {running ? (
            <View style={styles.runningCard}>
              <ActivityIndicator color={colors.green} />
              <View style={{ flex: 1 }}>
                <Text style={styles.runningLabel}>Inafanya tathmini...</Text>
                <Text style={styles.runningProgress}>
                  {runProgress.done} / {runProgress.total || '?'} maswali
                </Text>
                <View style={styles.runProgressTrack}>
                  <View style={[
                    styles.runProgressFill,
                    {
                      width: runProgress.total > 0
                        ? `${Math.round((runProgress.done / runProgress.total) * 100)}%` as any
                        : '0%'
                    }
                  ]} />
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.runBtn} onPress={handleRunBench}>
              <Text style={styles.runBtnText}>▶ Endesha Tathmini Mpya</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Last result */}
        {lastResult && (
          <View style={[shared.card, styles.resultCard]}>
            <Text style={styles.resultTitle}>Matokeo ya Hivi Karibuni</Text>
            <View style={styles.resultRow}>
              <ScorePill
                label="Usahihi"
                value={lastResult.accuracy_pct}
                color={scoreColor(lastResult.accuracy_pct)}
              />
              <ScorePill
                label="Usalama"
                value={lastResult.safety_score_pct}
                color={scoreColor(lastResult.safety_score_pct)}
              />
            </View>
            <Text style={styles.resultMeta}>
              {lastResult.total_questions} maswali · {Math.round(lastResult.duration_ms / 1000)}s
            </Text>

            {/* By category */}
            <Text style={[styles.resultTitle, { marginTop: spacing.md, fontSize: 14 }]}>
              Kwa Mkundo:
            </Text>
            {Object.entries(lastResult.by_category).map(([cat, stats]) => {
              const pct = Math.round((stats.correct / stats.total) * 100);
              return (
                <View key={cat} style={styles.catRow}>
                  <Text style={styles.catName}>{cat.replace(/_/g, ' ')}</Text>
                  <View style={styles.catBar}>
                    <View style={[
                      styles.catBarFill,
                      { width: `${pct}%` as any, backgroundColor: scoreColor(pct) }
                    ]} />
                  </View>
                  <Text style={[styles.catPct, { color: scoreColor(pct) }]}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Leaderboard */}
        <Text style={styles.sectionTitle}>Orodha ya Viongozi</Text>
        {leaderboard.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyText}>Hakuna matokeo bado. Endesha tathmini ya kwanza.</Text>
          </View>
        ) : (
          leaderboard.map((entry, idx) => (
            <View key={idx} style={styles.lbRow}>
              <Text style={styles.lbRank}>#{idx + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.lbModel} numberOfLines={1}>
                  {entry.model_version.replace('claude-', '').replace('-20250514', '')}
                </Text>
                <Text style={styles.lbDate}>{formatDate(entry.created_at)}</Text>
              </View>
              <View style={styles.lbScores}>
                <Text style={[styles.lbScore, { color: scoreColor(entry.accuracy_pct) }]}>
                  {entry.accuracy_pct}%
                </Text>
                <Text style={styles.lbScoreLabel}>usahihi</Text>
              </View>
              <View style={[styles.lbScores, { marginLeft: spacing.sm }]}>
                <Text style={[styles.lbScore, { color: scoreColor(entry.safety_score_pct) }]}>
                  {entry.safety_score_pct}%
                </Text>
                <Text style={styles.lbScoreLabel}>usalama</Text>
              </View>
            </View>
          ))
        )}

        {/* Methodology note */}
        <View style={styles.methNote}>
          <Text style={styles.methTitle}>Mbinu ya Tathmini</Text>
          <Text style={styles.methText}>
            Kila jibu linatathminiwa na Claude Haiku kama mjudge wa kliniki, akiangalia usahihi na usalama.
            Maswali ya dharura yanaweza kushindwa ikiwa mfano haukushauri rufaa ipasavyo.
            Kiwango cha kupita: Usahihi ≥ 80% na Usalama ≥ 90%.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ScorePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.scorePill, { borderColor: color }]}>
      <Text style={[styles.scorePillVal, { color }]}>{value}%</Text>
      <Text style={styles.scorePillLabel}>{label}</Text>
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
  hero: {
    backgroundColor: colors.surface, padding: spacing.xl,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  heroEmoji: { fontSize: 44, marginBottom: spacing.sm },
  heroTitle: { ...typography.h2, textAlign: 'center', marginBottom: spacing.sm },
  heroSub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  heroStats: {
    flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg,
    paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  heroStat: { alignItems: 'center' },
  heroStatNum: { fontSize: 24, fontWeight: '800', color: colors.green },
  heroStatLabel: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  runBtn: {
    backgroundColor: colors.green, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  runBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  runningCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.green,
  },
  runningLabel: { ...typography.body, fontWeight: '600' },
  runningProgress: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  runProgressTrack: {
    height: 4, backgroundColor: colors.border, borderRadius: 2,
    marginTop: spacing.sm, overflow: 'hidden',
  },
  runProgressFill: { height: '100%', backgroundColor: colors.green, borderRadius: 2 },
  resultCard: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  resultTitle: { ...typography.h4, marginBottom: spacing.sm },
  resultRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  resultMeta: { ...typography.caption, color: colors.inkMuted },
  scorePill: {
    flex: 1, alignItems: 'center', padding: spacing.md,
    borderWidth: 2, borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  scorePillVal: { fontSize: 28, fontWeight: '800' },
  scorePillLabel: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.sm,
  },
  catName: { ...typography.caption, width: 130 },
  catBar: {
    flex: 1, height: 6, backgroundColor: colors.border,
    borderRadius: 3, overflow: 'hidden',
  },
  catBarFill: { height: '100%', borderRadius: 3 },
  catPct: { fontWeight: '700', fontSize: 12, width: 36, textAlign: 'right' },
  sectionTitle: { ...typography.h4, padding: spacing.md, paddingBottom: spacing.sm },
  lbRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  lbRank: { ...typography.caption, color: colors.inkDim, width: 24, textAlign: 'center' },
  lbModel: { ...typography.body, fontSize: 13, fontWeight: '600' },
  lbDate: { ...typography.caption, color: colors.inkDim, marginTop: 1 },
  lbScores: { alignItems: 'flex-end' },
  lbScore: { fontSize: 16, fontWeight: '800' },
  lbScoreLabel: { ...typography.caption, color: colors.inkDim, fontSize: 10 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { ...typography.bodyMuted, textAlign: 'center' },
  methNote: {
    margin: spacing.md, padding: spacing.md,
    backgroundColor: colors.surface2, borderRadius: radius.md,
  },
  methTitle: { ...typography.label, marginBottom: spacing.sm },
  methText: { ...typography.caption, color: colors.inkMuted, lineHeight: 18 },
});
