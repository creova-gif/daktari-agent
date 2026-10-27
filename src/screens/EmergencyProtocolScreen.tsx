import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius, shadow, shared } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EmergencyProtocol'>;
};

type TriageCategory = 'immediate' | 'delayed' | 'minor' | 'expectant';
type STARTStep = 'breathing' | 'resp_rate' | 'pulse' | 'commands' | 'result';

const TRIAGE_COLORS: Record<TriageCategory, { bg: string; text: string; label: string; emoji: string; action: string }> = {
  immediate: { bg: '#FDEDEC', text: '#E74C3C', label: 'MARA MOJA (T1)', emoji: '🔴', action: 'Tibu SASA — maisha yanatishiwa' },
  delayed:   { bg: '#FEF9E7', text: '#F39C12', label: 'BAADAYE (T2)',    emoji: '🟡', action: 'Tibu baada ya T1 — hali thabiti' },
  minor:     { bg: '#EAFAF1', text: '#27AE60', label: 'WADOGO (T3)',     emoji: '🟢', action: 'Watembea — waweze kusubiri' },
  expectant: { bg: '#1A1D23', text: '#888',     label: 'HATUWEZI (T4)',   emoji: '⬛', action: 'Majeraha mabaya sana — hatuwezi kumsaidia' },
};

const EMERGENCY_CONTACTS = [
  { label: 'Simu ya Dharura Tanzania', number: '112', icon: '🚑' },
  { label: 'Daktari Agent Hotline',    number: '0800-2392', icon: '🩺' },
  { label: 'Polisi / Zima Moto',       number: '115', icon: '🚒' },
  { label: 'Hospitali ya Wilaya',      number: '0800-HOSPITALI', icon: '🏥' },
];

interface STARTState {
  step: STARTStep;
  is_breathing: boolean | null;
  resp_rate: 'none' | 'ok' | 'fast';
  has_pulse: boolean | null;
  can_follow: boolean | null;
}

export default function EmergencyProtocolScreen({ navigation }: Props) {
  const { chw } = useAuth();
  const [activeTab, setActiveTab] = useState<'triage' | 'contacts' | 'mci' | 'protocols'>('triage');

  // START triage state machine
  const [startState, setSTARTState] = useState<STARTState>({
    step: 'breathing',
    is_breathing: null,
    resp_rate: 'ok',
    has_pulse: null,
    can_follow: null,
  });
  const [triageResult, setTriageResult] = useState<TriageCategory | null>(null);
  const [patientNumber, setPatientNumber] = useState(1);
  const [savedCount, setSavedCount] = useState({ immediate: 0, delayed: 0, minor: 0, expectant: 0 });

  // MCI declaration
  const [showMCIModal, setShowMCIModal] = useState(false);
  const [mciName, setMCIName] = useState('');
  const [mciType, setMCIType] = useState('other');
  const [mciDeclaring, setMCIDeclaring] = useState(false);

  function resetSTART() {
    setSTARTState({ step: 'breathing', is_breathing: null, resp_rate: 'ok', has_pulse: null, can_follow: null });
    setTriageResult(null);
  }

  function computeSTARTResult(state: STARTState): TriageCategory {
    if (!state.is_breathing) return 'expectant';
    if (state.resp_rate === 'none') return 'expectant';
    if (state.resp_rate === 'fast') return 'immediate';  // RR > 30
    if (!state.has_pulse) return 'immediate';
    if (!state.can_follow) return 'immediate';
    return 'delayed';
  }

  function handleSTARTStep(answer: boolean | 'none' | 'ok' | 'fast') {
    const newState = { ...startState };

    switch (startState.step) {
      case 'breathing':
        newState.is_breathing = answer as boolean;
        if (!answer) { setTriageResult('expectant'); return; }
        newState.step = 'resp_rate';
        break;
      case 'resp_rate':
        newState.resp_rate = answer as 'none' | 'ok' | 'fast';
        if (answer === 'none') { setTriageResult('expectant'); return; }
        if (answer === 'fast') { setTriageResult('immediate'); return; }
        newState.step = 'pulse';
        break;
      case 'pulse':
        newState.has_pulse = answer as boolean;
        if (!answer) { setTriageResult('immediate'); return; }
        newState.step = 'commands';
        break;
      case 'commands':
        newState.can_follow = answer as boolean;
        const result = computeSTARTResult({ ...newState, can_follow: answer as boolean });
        setTriageResult(result);
        return;
    }
    setSTARTState(newState);
  }

  function saveTriageResult() {
    if (!triageResult) return;
    setSavedCount(prev => ({ ...prev, [triageResult]: prev[triageResult] + 1 }));
    setPatientNumber(p => p + 1);
    resetSTART();
  }

  async function declareMCI() {
    if (!chw || !mciName.trim()) return;
    setMCIDeclaring(true);
    try {
      await supabase.from('mass_casualty_events').insert({
        district: chw.district,
        event_name: mciName.trim(),
        incident_type: mciType,
        declared_by: chw.id,
        status: 'active',
      });
      setShowMCIModal(false);
      Alert.alert(
        '✅ Tukio Limetangazwa',
        'Msimamizi wako na Hospitali ya Wilaya wamearifiwa. Endelea na triage ya START.',
        [{ text: 'Endelea', onPress: () => setActiveTab('triage') }]
      );
    } catch (err) {
      Alert.alert('Hitilafu', 'Imeshindwa kutangaza tukio. Piga simu 112 moja kwa moja.');
    } finally {
      setMCIDeclaring(false);
    }
  }

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
      {/* Header — red for emergency context */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Rudi</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🚨 Itifaki ya Dharura</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {[
          { id: 'triage',    label: 'START Triage', emoji: '🏷' },
          { id: 'contacts',  label: 'Simu',         emoji: '📞' },
          { id: 'mci',       label: 'Majanga',       emoji: '🆘' },
          { id: 'protocols', label: 'Itifaki',       emoji: '📋' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id as typeof activeTab)}
          >
            <Text style={styles.tabEmoji}>{tab.emoji}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ─── START TRIAGE TAB ─── */}
        {activeTab === 'triage' && (
          <View style={styles.section}>
            {/* Score board */}
            <View style={styles.scoreBoard}>
              {Object.entries(savedCount).map(([cat, count]) => {
                const tc = TRIAGE_COLORS[cat as TriageCategory];
                return (
                  <View key={cat} style={[styles.scoreCell, { backgroundColor: tc.bg }]}>
                    <Text style={styles.scoreEmoji}>{tc.emoji}</Text>
                    <Text style={[styles.scoreNum, { color: tc.text }]}>{count}</Text>
                    <Text style={[styles.scoreLabel, { color: tc.text }]}>
                      {tc.label.split(' ')[0]}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.patientNum}>Mgonjwa #{patientNumber}</Text>

            {/* Triage result */}
            {triageResult ? (
              <View>
                <View style={[
                  styles.resultCard,
                  { backgroundColor: TRIAGE_COLORS[triageResult].bg, borderColor: TRIAGE_COLORS[triageResult].text }
                ]}>
                  <Text style={styles.resultEmoji}>{TRIAGE_COLORS[triageResult].emoji}</Text>
                  <Text style={[styles.resultLabel, { color: TRIAGE_COLORS[triageResult].text }]}>
                    {TRIAGE_COLORS[triageResult].label}
                  </Text>
                  <Text style={[styles.resultAction, { color: TRIAGE_COLORS[triageResult].text }]}>
                    {TRIAGE_COLORS[triageResult].action}
                  </Text>
                </View>
                <TouchableOpacity style={styles.nextBtn} onPress={saveTriageResult}>
                  <Text style={styles.nextBtnText}>Hifadhi → Mgonjwa Mwingine</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resetBtn} onPress={resetSTART}>
                  <Text style={styles.resetBtnText}>↺ Anza Upya</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* START decision tree */
              <View style={styles.startCard}>
                {startState.step === 'breathing' && (
                  <STARTQuestion
                    question="Je, mgonjwa anapumua?"
                    subtitle="Angalia harakati za kifua au usikize pumzi"
                    onYes={() => handleSTARTStep(true)}
                    onNo={() => handleSTARTStep(false)}
                  />
                )}
                {startState.step === 'resp_rate' && (
                  <View>
                    <Text style={styles.startQ}>Kasi ya kupumua ni ngapi?</Text>
                    <Text style={styles.startSub}>Hesabu pumzi kwa sekunde 15, zidisha kwa 4</Text>
                    <View style={styles.threeWayBtns}>
                      <TouchableOpacity style={[styles.threeBtn, { backgroundColor: colors.emergencyBg, borderColor: colors.emergency }]}
                        onPress={() => handleSTARTStep('none')}>
                        <Text style={[styles.threeBtnText, { color: colors.emergency }]}>Hapumui</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.threeBtn, { backgroundColor: colors.greenLight, borderColor: colors.green }]}
                        onPress={() => handleSTARTStep('ok')}>
                        <Text style={[styles.threeBtnText, { color: colors.greenDark }]}>Kawaida (10–30)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.threeBtn, { backgroundColor: colors.warningBg, borderColor: colors.warning }]}
                        onPress={() => handleSTARTStep('fast')}>
                        <Text style={[styles.threeBtnText, { color: colors.warning }]}>Haraka sana (&gt;30)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {startState.step === 'pulse' && (
                  <STARTQuestion
                    question="Je, ana mapigo ya moyo / pulse?"
                    subtitle="Gusa mkono wa ndani wa mkono (radial pulse)"
                    onYes={() => handleSTARTStep(true)}
                    onNo={() => handleSTARTStep(false)}
                  />
                )}
                {startState.step === 'commands' && (
                  <STARTQuestion
                    question="Je, anaweza kufuata maagizo?"
                    subtitle="Sema: 'Piga makofi' au 'Nyanyua mkono wako'"
                    onYes={() => handleSTARTStep(true)}
                    onNo={() => handleSTARTStep(false)}
                  />
                )}
              </View>
            )}

            {/* Minor/walking wounded shortcut */}
            <TouchableOpacity
              style={styles.walkingBtn}
              onPress={() => {
                setSavedCount(prev => ({ ...prev, minor: prev.minor + 1 }));
                setPatientNumber(p => p + 1);
                resetSTART();
              }}
            >
              <Text style={styles.walkingBtnText}>🟢 Anatembea — Mgonjwa Mdogo (T3)</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── CONTACTS TAB ─── */}
        {activeTab === 'contacts' && (
          <View style={styles.section}>
            <View style={styles.sosCard}>
              <Text style={styles.sosTitle}>SOS — Simu ya Kwanza</Text>
              <TouchableOpacity
                style={styles.sosBtn}
                onPress={() => Linking.openURL('tel:112')}
              >
                <Text style={styles.sosBtnText}>📞 Piga 112 — Dharura Tanzania</Text>
              </TouchableOpacity>
            </View>

            {EMERGENCY_CONTACTS.map(c => (
              <TouchableOpacity
                key={c.number}
                style={styles.contactCard}
                onPress={() => Linking.openURL(`tel:${c.number.replace(/-/g, '')}`)}
              >
                <Text style={styles.contactIcon}>{c.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>{c.label}</Text>
                  <Text style={styles.contactNumber}>{c.number}</Text>
                </View>
                <Text style={{ color: colors.green, fontSize: 20 }}>📞</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── MCI TAB ─── */}
        {activeTab === 'mci' && (
          <View style={styles.section}>
            <View style={styles.mciHero}>
              <Text style={styles.mciIcon}>🆘</Text>
              <Text style={styles.mciTitle}>Hali ya Dharura ya Wingi</Text>
              <Text style={styles.mciSub}>
                Bonyeza hapa kutangaza hali ya dharura ya wingi (MCI) kwa wilaya yako.
                Msimamizi na hospitali wataarifiwa mara moja.
              </Text>
              <TouchableOpacity style={styles.mciBtn} onPress={() => setShowMCIModal(true)}>
                <Text style={styles.mciBtnText}>🆘 Tangaza Dharura ya Wingi</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.mciGuide}>
              <Text style={styles.mciGuideTitle}>Maelekezo ya Haraka — MCI</Text>
              {[
                'Usalama wako kwanza — angalia hatari kabla ya kusaidia',
                'Piga simu 112 mara moja',
                'Tangaza MCI kwenye programu hii',
                'Anza triage ya START bila kusita',
                'Usijaribu kutibu wote — triage kwanza',
                'Weka njia ya magari wazi kwa ambulansi',
                'Ongea na msimamizi wako kila dakika 10',
              ].map((step, i) => (
                <View key={i} style={styles.mciStep}>
                  <View style={styles.mciStepNum}>
                    <Text style={styles.mciStepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.mciStepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── PROTOCOLS TAB ─── */}
        {activeTab === 'protocols' && (
          <View style={styles.section}>
            {[
              { emoji: '🧠', title: 'Degedege (Convulsions)', steps: ['Laza mgonjwa upande — usimlazimishe mdomo', 'Ondoa vitu vyote karibu naye', 'Piga wakati — ikiwa zaidi ya dakika 5: DHARURA', 'Peleka hospitali baada ya degedege kumalizika', 'Usipe maji au chakula hadi awe macho kabisa'] },
              { emoji: '❤️', title: 'Mshtuko wa Moyo', steps: ['Laza mgonjwa — usimwache asimame', 'Fungua nguo — ruhusu kupumua', 'Usimpe maji, chakula, au dawa', 'Piga simu 112 HARAKA', 'Ikiwa ana CPR training: anza CPR hadi msaada ufike'] },
              { emoji: '🩸', title: 'Kutokwa Damu Nyingi', steps: ['Vaa gloves ikiwa una', 'Bana jeraha kwa nguvu kwa nguo safi', 'Inua sehemu iliyoumia juu ya moyo', 'Usibane kamba (tourniquet) bila mafunzo', 'Peleka hospitali HARAKA — bana wakati wote njiani'] },
              { emoji: '🤰', title: 'Kujifungua Dharura', steps: ['Mama alale upande wa kushoto', 'Ikiwa mtoto anakuja: pokea — usimlazimishe', 'Baada ya kuzaliwa: joto mtoto na mama pamoja', 'Kata kamba baada ya dakika 1 ikiwa ina mafunzo', 'Toa misoprostol tab 3 kinywani — kuzuia damu', 'Peleka hospitali HARAKA pande zote mbili'] },
              { emoji: '🌊', title: 'Mtu Amezama Maji', steps: ['Usalama wako kwanza — usiruke maji bila kamba', 'Mtoe maji haraka iwezekanavyo', 'Hakikisha anapumua — ikiwa la: CPR', 'Joto mwili wake — blanket au nguo', 'Usimpe maji kunywa kabla ya kuwa macho kabisa', 'Peleka hospitali — matatizo yanaweza kuja baadaye'] },
            ].map(protocol => (
              <View key={protocol.title} style={styles.protocolCard}>
                <View style={styles.protocolHeader}>
                  <Text style={styles.protocolEmoji}>{protocol.emoji}</Text>
                  <Text style={styles.protocolTitle}>{protocol.title}</Text>
                </View>
                {protocol.steps.map((step, i) => (
                  <View key={i} style={styles.protocolStep}>
                    <Text style={styles.protocolNum}>{i + 1}.</Text>
                    <Text style={styles.protocolText}>{step}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* MCI Declaration Modal */}
      <Modal visible={showMCIModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMCIModal(false)}>
              <Text style={{ color: colors.green, fontWeight: '600' }}>Ghairi</Text>
            </TouchableOpacity>
            <Text style={typography.h4}>Tangaza MCI</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            <View style={styles.mciWarning}>
              <Text style={styles.mciWarningText}>
                ⚠️ Tangazo hili litaarifiwa msimamizi wako na hospitali ya wilaya mara moja.
                Tumia tu kwa hali za kweli za dharura za wingi.
              </Text>
            </View>

            <Text style={[typography.label, { marginBottom: spacing.xs, marginTop: spacing.lg }]}>JINA LA TUKIO</Text>
            <TextInput
              style={shared.input}
              placeholder="Mfano: Ajali ya basi — barabara ya Dodoma km 45"
              value={mciName}
              onChangeText={setMCIName}
              autoFocus
            />

            <Text style={[typography.label, { marginBottom: spacing.xs, marginTop: spacing.md }]}>AINA YA TUKIO</Text>
            <View style={styles.typeGrid}>
              {[
                { id: 'accident', label: 'Ajali', emoji: '🚗' },
                { id: 'flood',    label: 'Mafuriko', emoji: '🌊' },
                { id: 'fire',     label: 'Moto', emoji: '🔥' },
                { id: 'epidemic', label: 'Mlipuko wa Ugonjwa', emoji: '🦠' },
                { id: 'collapse', label: 'Kuanguka kwa Jengo', emoji: '🏚' },
                { id: 'other',    label: 'Nyingine', emoji: '🆘' },
              ].map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeBtn, mciType === t.id && styles.typeBtnActive]}
                  onPress={() => setMCIType(t.id)}
                >
                  <Text style={styles.typeEmoji}>{t.emoji}</Text>
                  <Text style={[styles.typeLabel, mciType === t.id && { color: colors.emergency }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.declareMCIBtn, (!mciName.trim() || mciDeclaring) && { opacity: 0.5 }]}
              onPress={declareMCI}
              disabled={!mciName.trim() || mciDeclaring}
            >
              <Text style={styles.declareMCIText}>
                {mciDeclaring ? 'Inatuma...' : '🆘 Tangaza Dharura ya Wingi'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function STARTQuestion({ question, subtitle, onYes, onNo }: {
  question: string; subtitle: string; onYes: () => void; onNo: () => void;
}) {
  return (
    <View>
      <Text style={styles.startQ}>{question}</Text>
      <Text style={styles.startSub}>{subtitle}</Text>
      <View style={styles.yesNo}>
        <TouchableOpacity style={styles.yesBtn} onPress={onYes}>
          <Text style={styles.yesBtnText}>✓ NDIYO</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.noBtn} onPress={onNo}>
          <Text style={styles.noBtnText}>✗ HAPANA</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, backgroundColor: colors.emergency,
  },
  back: { color: '#fff', fontWeight: '600', fontSize: 15 },
  title: { color: '#fff', fontWeight: '800', fontSize: 16 },
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.emergency },
  tabEmoji: { fontSize: 16, marginBottom: 2 },
  tabLabel: { fontSize: 10, color: colors.inkMuted, fontWeight: '600' },
  tabLabelActive: { color: colors.emergency },
  section: { padding: spacing.md },
  scoreBoard: {
    flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md,
  },
  scoreCell: {
    flex: 1, alignItems: 'center', padding: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent',
  },
  scoreEmoji: { fontSize: 18, marginBottom: 2 },
  scoreNum: { fontSize: 24, fontWeight: '800' },
  scoreLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  patientNum: { ...typography.h3, textAlign: 'center', marginBottom: spacing.md },
  startCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, ...shadow.md, marginBottom: spacing.md,
  },
  startQ: { ...typography.h3, marginBottom: spacing.sm },
  startSub: { ...typography.bodyMuted, marginBottom: spacing.lg },
  yesNo: { flexDirection: 'row', gap: spacing.md },
  yesBtn: {
    flex: 1, padding: 16, borderRadius: radius.md,
    backgroundColor: colors.greenLight, borderWidth: 2, borderColor: colors.green,
    alignItems: 'center',
  },
  yesBtnText: { color: colors.greenDark, fontWeight: '800', fontSize: 18 },
  noBtn: {
    flex: 1, padding: 16, borderRadius: radius.md,
    backgroundColor: colors.emergencyBg, borderWidth: 2, borderColor: colors.emergency,
    alignItems: 'center',
  },
  noBtnText: { color: colors.emergency, fontWeight: '800', fontSize: 18 },
  threeWayBtns: { flexDirection: 'row', gap: spacing.sm },
  threeBtn: {
    flex: 1, padding: 12, borderRadius: radius.md,
    borderWidth: 2, alignItems: 'center',
  },
  threeBtnText: { fontWeight: '700', fontSize: 12, textAlign: 'center' },
  resultCard: {
    borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', borderWidth: 2, marginBottom: spacing.md,
  },
  resultEmoji: { fontSize: 56, marginBottom: spacing.sm },
  resultLabel: { fontSize: 22, fontWeight: '800', marginBottom: spacing.sm },
  resultAction: { fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
  nextBtn: {
    backgroundColor: colors.green, borderRadius: radius.md,
    padding: 16, alignItems: 'center', marginBottom: spacing.sm,
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resetBtn: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: 12, alignItems: 'center',
  },
  resetBtnText: { color: colors.inkMuted, fontWeight: '600' },
  walkingBtn: {
    marginTop: spacing.md, padding: 14,
    backgroundColor: colors.greenLight, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.green, alignItems: 'center',
  },
  walkingBtnText: { color: colors.greenDark, fontWeight: '700', fontSize: 14 },
  sosCard: {
    backgroundColor: colors.emergencyBg, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 2, borderColor: colors.emergency, marginBottom: spacing.md,
    alignItems: 'center',
  },
  sosTitle: { ...typography.h3, color: colors.emergency, marginBottom: spacing.md },
  sosBtn: {
    backgroundColor: colors.emergency, borderRadius: radius.md,
    paddingVertical: 16, paddingHorizontal: 32,
  },
  sosBtnText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  contactIcon: { fontSize: 24 },
  contactLabel: { ...typography.body, fontWeight: '600' },
  contactNumber: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  mciHero: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', marginBottom: spacing.md, ...shadow.sm,
  },
  mciIcon: { fontSize: 56, marginBottom: spacing.sm },
  mciTitle: { ...typography.h2, textAlign: 'center', marginBottom: spacing.sm },
  mciSub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },
  mciBtn: {
    backgroundColor: colors.emergency, borderRadius: radius.md,
    paddingVertical: 16, paddingHorizontal: 32,
  },
  mciBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  mciGuide: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  mciGuideTitle: { ...typography.h4, marginBottom: spacing.md, color: colors.emergency },
  mciStep: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm, alignItems: 'flex-start' },
  mciStepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.emergency, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  mciStepNumText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  mciStepText: { ...typography.body, flex: 1, lineHeight: 22 },
  protocolCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  protocolHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  protocolEmoji: { fontSize: 28 },
  protocolTitle: { ...typography.h4 },
  protocolStep: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'flex-start' },
  protocolNum: { color: colors.emergency, fontWeight: '800', width: 20, fontSize: 14, flexShrink: 0 },
  protocolText: { ...typography.body, flex: 1, lineHeight: 22, fontSize: 14 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  mciWarning: {
    backgroundColor: colors.emergencyBg, borderRadius: radius.md, padding: spacing.md,
    borderLeftWidth: 3, borderLeftColor: colors.emergency,
  },
  mciWarningText: { color: colors.emergency, fontSize: 13, lineHeight: 20 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  typeBtn: {
    width: '31%', padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
    backgroundColor: colors.surface,
  },
  typeBtnActive: { borderColor: colors.emergency, backgroundColor: colors.emergencyBg },
  typeEmoji: { fontSize: 24, marginBottom: 4 },
  typeLabel: { ...typography.caption, textAlign: 'center', color: colors.inkMuted },
  declareMCIBtn: {
    backgroundColor: colors.emergency, borderRadius: radius.md,
    padding: 16, alignItems: 'center',
  },
  declareMCIText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
