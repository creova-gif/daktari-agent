import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius, shadow, shared } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Certification'>;
};

// ─── Module definitions ───────────────────────────────────────────────────────
const MODULES = [
  {
    id: 'core_primary_care',
    title: 'Huduma za Msingi',
    titleEn: 'Core Primary Care',
    icon: '🩺',
    description: 'Msingi wa kazi ya CHW: tathmini ya mgonjwa, vipimo, rufaa.',
    color: colors.green,
    unlockRequirement: 'Ziara 0+',
    minVisits: 0,
  },
  {
    id: 'malaria_advanced',
    title: 'Malaria — Kina',
    titleEn: 'Advanced Malaria Management',
    icon: '🦟',
    description: 'RDT, dawa za AL, usimamizi wa malaria kali.',
    color: '#E65C00',
    unlockRequirement: 'Ziara 10+',
    minVisits: 10,
  },
  {
    id: 'maternal_health',
    title: 'Afya ya Mama',
    titleEn: 'Maternal Health',
    icon: '🤰',
    description: 'ANC, hatari za ujauzito, msaada wakati wa kujifungua.',
    color: '#C2185B',
    unlockRequirement: 'Ziara 25+',
    minVisits: 25,
  },
  {
    id: 'pediatrics_imci',
    title: 'Afya ya Watoto',
    titleEn: 'Pediatrics & IMCI',
    icon: '👶',
    description: 'IMCI, watoto wachanga, chanjo, lishe.',
    color: '#1976D2',
    unlockRequirement: 'Ziara 25+',
    minVisits: 25,
  },
  {
    id: 'tb_management',
    title: 'TB & DOTS',
    titleEn: 'TB Management',
    icon: '💊',
    description: 'Utambuzi wa TB, DOTS, DOT, usimamizi wa MDR-TB.',
    color: '#5D4037',
    unlockRequirement: 'Ziara 50+',
    minVisits: 50,
  },
  {
    id: 'nutrition_sam',
    title: 'Lishe & SAM',
    titleEn: 'Nutrition & SAM',
    icon: '🥗',
    description: 'MUAC, SAM, MAM, RUTF, lishe ya mama na mtoto.',
    color: '#388E3C',
    unlockRequirement: 'Ziara 50+',
    minVisits: 50,
  },
  {
    id: 'emergency_triage',
    title: 'Dharura & Triage',
    titleEn: 'Emergency Triage',
    icon: '🚨',
    description: 'START triage, utambuzi wa dharura, rufaa ya haraka.',
    color: colors.emergency,
    unlockRequirement: 'Ziara 100+ · Mhitimu wa Msingi',
    minVisits: 100,
  },
] as const;

type ModuleId = typeof MODULES[number]['id'];

interface Certification {
  id: string;
  module: ModuleId;
  level: string;
  score_pct: number;
  issued_at: string;
  expires_at: string;
  is_active: boolean;
}

const LEVEL_CONFIG = {
  foundation:   { label: 'Msingi',    color: '#9E9E9E', icon: '⭐' },
  practitioner: { label: 'Mtaalamu',  color: colors.blue, icon: '⭐⭐' },
  specialist:   { label: 'Bingwa',    color: colors.amber, icon: '⭐⭐⭐' },
  senior:       { label: 'Mkuu',      color: colors.green, icon: '🏆' },
  trainer:      { label: 'Mwalimu',   color: '#9C27B0', icon: '🎓' },
};

export default function CertificationScreen({ navigation }: Props) {
  const { chw } = useAuth();
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<typeof MODULES[number] | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentRunning, setAssessmentRunning] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<{
    score: number; passed: boolean; feedback: string;
  } | null>(null);

  const totalVisits = chw?.total_visits ?? 0;
  const careerLevel = (chw as Record<string, unknown>)?.career_level as string ?? 'foundation';

  const load = useCallback(async () => {
    if (!chw) return;
    const { data } = await supabase
      .from('chw_certifications')
      .select('*')
      .eq('chw_id', chw.id)
      .eq('is_active', true);
    setCerts((data ?? []) as Certification[]);
    setLoading(false);
  }, [chw]);

  useEffect(() => { load(); }, [load]);

  function getCert(moduleId: ModuleId): Certification | undefined {
    return certs.find(c => c.module === moduleId);
  }

  function isUnlocked(module: typeof MODULES[number]): boolean {
    return totalVisits >= module.minVisits;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('sw-TZ', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function isExpiringSoon(iso: string): boolean {
    return new Date(iso).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  }

  async function runAssessment() {
    if (!chw || !selectedModule) return;
    setAssessmentRunning(true);
    setAssessmentResult(null);

    try {
      const { runSwahiliMedBench } = await import('../lib/swahiliMedBench');

      let correctCount = 0;
      let totalCount = 0;
      let safetyPassed = true;

      await runSwahiliMedBench({
        modelVersion: 'claude-sonnet-4-20250514',
        questionLimit: 10,
        categories: [selectedModule.id],
        chwId: chw.id,
        onProgress: (done, total, latest) => {
          totalCount = total;
          if (latest.score >= 0.7) correctCount++;
          if (!latest.safety_passed) safetyPassed = false;
        },
      });

      const scorePct = Math.round((correctCount / Math.max(totalCount, 1)) * 100);
      const passed = scorePct >= 70 && safetyPassed;

      setAssessmentResult({
        score: scorePct,
        passed,
        feedback: passed
          ? `Hongera! Umepita kwa ${scorePct}%. Cheti kitatolewa.`
          : `Umepata ${scorePct}%. Unahitaji 70%+ kupita. Jifunze zaidi na jaribu tena.`,
      });

      if (passed) {
        // Issue certification
        await supabase.from('chw_certifications').upsert({
          chw_id: chw.id,
          module: selectedModule.id,
          level: careerLevel,
          score_pct: scorePct,
          visits_at_cert: totalVisits,
          issued_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
        }, { onConflict: 'chw_id,module' });

        await load();
      }
    } catch (err) {
      Alert.alert('Hitilafu', 'Tathmini haiwezi kukimbia sasa hivi. Jaribu tena.');
      console.error('[Cert] Assessment error:', err);
    } finally {
      setAssessmentRunning(false);
    }
  }

  if (loading) {
    return (
      <View style={[shared.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  const levelConf = LEVEL_CONFIG[careerLevel as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.foundation;
  const certifiedCount = certs.filter(c => c.is_active).length;

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Rudi</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Vyeti vya Kazi</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Career level hero */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>{levelConf.icon}</Text>
          <Text style={[styles.heroLevel, { color: levelConf.color }]}>{levelConf.label}</Text>
          <Text style={styles.heroName}>{chw?.full_name}</Text>
          <Text style={styles.heroMeta}>{totalVisits} Ziara · {certifiedCount} Vyeti</Text>

          {/* Progress to next level */}
          <NextLevelProgress totalVisits={totalVisits} careerLevel={careerLevel} />
        </View>

        {/* Module grid */}
        <Text style={styles.sectionTitle}>Moduli za Mafunzo</Text>

        {MODULES.map(module => {
          const cert = getCert(module.id);
          const unlocked = isUnlocked(module);
          const expiring = cert && isExpiringSoon(cert.expires_at);

          return (
            <TouchableOpacity
              key={module.id}
              style={[
                styles.moduleCard,
                !unlocked && styles.moduleCardLocked,
                cert && { borderColor: module.color, borderWidth: 1.5 },
              ]}
              onPress={() => {
                if (!unlocked) {
                  Alert.alert(
                    'Moduli Imefungwa 🔒',
                    `Unahitaji ${module.unlockRequirement} kufungua moduli hii.\nUna ziara ${totalVisits} sasa hivi.`
                  );
                  return;
                }
                setSelectedModule(module);
                setAssessmentResult(null);
                setShowAssessment(true);
              }}
              activeOpacity={unlocked ? 0.7 : 0.9}
            >
              <View style={[styles.moduleIconWrap, { backgroundColor: module.color + '18' }]}>
                <Text style={styles.moduleIcon}>{module.icon}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.moduleTitle, !unlocked && { color: colors.inkDim }]}>
                  {module.title}
                </Text>
                <Text style={styles.moduleDesc} numberOfLines={1}>{module.description}</Text>
                {!unlocked && (
                  <Text style={styles.unlockLabel}>🔒 {module.unlockRequirement}</Text>
                )}
              </View>

              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {cert ? (
                  <>
                    <View style={[styles.certBadge, { backgroundColor: module.color + '20', borderColor: module.color }]}>
                      <Text style={[styles.certBadgeText, { color: module.color }]}>
                        ✓ {cert.score_pct}%
                      </Text>
                    </View>
                    {expiring && (
                      <Text style={styles.expiringText}>⚠️ Inaisha hivi karibuni</Text>
                    )}
                  </>
                ) : unlocked ? (
                  <View style={styles.startBadge}>
                    <Text style={styles.startBadgeText}>Anza →</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 18, color: colors.inkDim }}>🔒</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Certified modules expiry notice */}
        {certs.some(c => isExpiringSoon(c.expires_at)) && (
          <View style={styles.renewalNotice}>
            <Text style={styles.renewalText}>
              ⚠️ Baadhi ya vyeti vyako vinakaribia kuisha. Fanya upya tathmini kuhifadhi hadhi yako.
            </Text>
          </View>
        )}

      </ScrollView>

      {/* Assessment Modal */}
      <Modal
        visible={showAssessment}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowAssessment(false);
              setAssessmentResult(null);
              setAssessmentRunning(false);
            }}>
              <Text style={{ color: colors.emergency, fontWeight: '600', fontSize: 15 }}>Funga</Text>
            </TouchableOpacity>
            <Text style={typography.h4}>{selectedModule?.title ?? ''}</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, flex: 1 }}>
            <Text style={styles.moduleIcon2}>{selectedModule?.icon}</Text>
            <Text style={styles.assessTitle}>{selectedModule?.titleEn}</Text>
            <Text style={styles.assessDesc}>{selectedModule?.description}</Text>

            <View style={styles.assessInfo}>
              <AssessInfoRow label="Maswali" value="10 ya kliniki" />
              <AssessInfoRow label="Kiwango cha Kupita" value="70%+" />
              <AssessInfoRow label="Lugha" value="Kiswahili" />
              <AssessInfoRow label="Muda" value="~5 dakika" />
              <AssessInfoRow label="Cheti" value="Miaka 1" />
            </View>

            {/* Result display */}
            {assessmentResult && (
              <View style={[
                styles.resultBox,
                { borderColor: assessmentResult.passed ? colors.green : colors.emergency }
              ]}>
                <Text style={styles.resultScore}>
                  {assessmentResult.score}%
                </Text>
                <Text style={[
                  styles.resultLabel,
                  { color: assessmentResult.passed ? colors.success : colors.emergency }
                ]}>
                  {assessmentResult.passed ? '✓ UMEPITA' : '✗ HUJAPITA'}
                </Text>
                <Text style={styles.resultFeedback}>{assessmentResult.feedback}</Text>
              </View>
            )}

            {/* Run button */}
            {!assessmentResult && (
              <TouchableOpacity
                style={[
                  shared.primaryButton,
                  { marginTop: spacing.xl },
                  assessmentRunning && { opacity: 0.6 }
                ]}
                onPress={runAssessment}
                disabled={assessmentRunning}
              >
                {assessmentRunning ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={shared.primaryButtonText}>Inafanya tathmini...</Text>
                  </View>
                ) : (
                  <Text style={shared.primaryButtonText}>🎓 Anza Tathmini →</Text>
                )}
              </TouchableOpacity>
            )}

            {assessmentResult && !assessmentResult.passed && (
              <TouchableOpacity
                style={[shared.primaryButton, { marginTop: spacing.md, backgroundColor: colors.info }]}
                onPress={() => { setAssessmentResult(null); }}
              >
                <Text style={shared.primaryButtonText}>↺ Jaribu Tena</Text>
              </TouchableOpacity>
            )}

            {assessmentRunning && (
              <View style={styles.runningBox}>
                <ActivityIndicator color={colors.green} size="large" />
                <Text style={styles.runningTitle}>SwahiliMedBench inafanya tathmini...</Text>
                <Text style={styles.runningDesc}>
                  AI inakagua majibu yako dhidi ya miongozo ya MoH Tanzania.
                  Subiri dakika 1-2.
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NextLevelProgress({ totalVisits, careerLevel }: { totalVisits: number; careerLevel: string }) {
  const nextLevels = [
    { level: 'practitioner', min: 50, label: 'Mtaalamu' },
    { level: 'specialist', min: 200, label: 'Bingwa' },
    { level: 'senior', min: 500, label: 'Mkuu' },
  ];
  const next = nextLevels.find(l => totalVisits < l.min);
  if (!next || careerLevel === 'senior' || careerLevel === 'trainer') return null;

  const pct = Math.min(100, Math.round((totalVisits / next.min) * 100));
  return (
    <View style={styles.progressWrap}>
      <Text style={styles.progressLabel}>
        Hadi {next.label}: ziara {next.min - totalVisits} zaidi
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
      </View>
      <Text style={styles.progressPct}>{pct}%</Text>
    </View>
  );
}

function AssessInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  heroIcon: { fontSize: 52, marginBottom: spacing.sm },
  heroLevel: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  heroName: { ...typography.h3, marginBottom: 4 },
  heroMeta: { ...typography.caption, color: colors.inkMuted },
  progressWrap: { marginTop: spacing.lg, width: '100%', alignItems: 'center', gap: 4 },
  progressLabel: { ...typography.caption, color: colors.inkMuted },
  progressTrack: {
    width: '80%', height: 6, backgroundColor: colors.border,
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.green, borderRadius: 3 },
  progressPct: { ...typography.caption, color: colors.green, fontWeight: '700' },
  sectionTitle: { ...typography.h4, padding: spacing.md, paddingBottom: spacing.sm },
  moduleCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, ...shadow.sm, borderWidth: 1, borderColor: colors.border,
  },
  moduleCardLocked: { opacity: 0.55 },
  moduleIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  moduleIcon: { fontSize: 26 },
  moduleTitle: { ...typography.h4, fontSize: 15, marginBottom: 2 },
  moduleDesc: { ...typography.caption, color: colors.inkMuted },
  unlockLabel: { ...typography.caption, color: colors.warning, marginTop: 2, fontWeight: '600' },
  certBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1.5,
  },
  certBadgeText: { fontSize: 12, fontWeight: '800' },
  expiringText: { ...typography.caption, color: colors.warning, fontSize: 10 },
  startBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.greenLight, borderRadius: radius.full,
  },
  startBadgeText: { color: colors.greenDark, fontWeight: '700', fontSize: 13 },
  renewalNotice: {
    marginHorizontal: spacing.md, marginTop: spacing.sm,
    backgroundColor: colors.warningBg, borderRadius: radius.md,
    padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.warning,
  },
  renewalText: { ...typography.caption, color: colors.warning, lineHeight: 18 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  moduleIcon2: { fontSize: 56, textAlign: 'center', marginBottom: spacing.sm },
  assessTitle: { ...typography.h2, textAlign: 'center', marginBottom: spacing.sm },
  assessDesc: { ...typography.bodyMuted, textAlign: 'center', marginBottom: spacing.xl },
  assessInfo: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.caption, color: colors.inkMuted },
  infoValue: { ...typography.body, fontWeight: '600', fontSize: 14 },
  resultBox: {
    alignItems: 'center', padding: spacing.xl,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 2, marginTop: spacing.md,
  },
  resultScore: { fontSize: 56, fontWeight: '800', color: colors.ink, lineHeight: 64 },
  resultLabel: { fontSize: 20, fontWeight: '800', marginBottom: spacing.sm },
  resultFeedback: { ...typography.body, textAlign: 'center', color: colors.inkMuted, lineHeight: 22 },
  runningBox: { alignItems: 'center', padding: spacing.xl, gap: spacing.md, marginTop: spacing.xl },
  runningTitle: { ...typography.h4, textAlign: 'center' },
  runningDesc: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22 },
});
