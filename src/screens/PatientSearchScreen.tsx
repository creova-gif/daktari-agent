import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Modal, Alert, Switch, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchPatients, createPatient } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius, shadow, shared } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, Patient, District } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PatientSearch'>;
};

const DISTRICTS: { value: District; label: string }[] = [
  { value: 'kibaha',        label: 'Kibaha (Coast)' },
  { value: 'dodoma',        label: 'Dodoma' },
  { value: 'mwanza',        label: 'Mwanza' },
  { value: 'dar_es_salaam', label: 'Dar es Salaam' },
  { value: 'arusha',        label: 'Arusha' },
  { value: 'mbeya',         label: 'Mbeya' },
  { value: 'other',         label: 'Wilaya Nyingine' },
];

export default function PatientSearchScreen({ navigation }: Props) {
  const { chw } = useAuth();
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);

  // New patient form state
  const [newName, setNewName] = useState('');
  const [newSex, setNewSex] = useState<'male' | 'female' | null>(null);
  const [newAgeYears, setNewAgeYears] = useState('');
  const [newAgeMonths, setNewAgeMonths] = useState('');
  const [newVillage, setNewVillage] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPregnant, setNewPregnant] = useState(false);
  const [newDistrict, setNewDistrict] = useState<District>(chw?.district ?? 'other');
  const [creating, setCreating] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!chw) return;
    setSearching(true);
    try {
      const results = await searchPatients(chw.id, q);
      setPatients(results as Patient[]);
    } catch (err) {
      console.error('[PatientSearch]', err);
    } finally {
      setSearching(false);
    }
  }, [chw]);

  useEffect(() => {
    if (query.length === 0) { setPatients([]); return; }
    if (query.length < 2) return;
    const t = setTimeout(() => doSearch(query), 350);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  function resetNewPatientForm() {
    setNewName(''); setNewSex(null); setNewAgeYears('');
    setNewAgeMonths(''); setNewVillage(''); setNewPhone('');
    setNewPregnant(false); setNewDistrict(chw?.district ?? 'other');
  }

  async function handleCreatePatient() {
    if (!chw) return;
    if (!newName.trim() || !newSex || !newVillage.trim() || !(newAgeYears || newAgeMonths)) {
      Alert.alert('Taarifa hazikamiliki', 'Tafadhali jaza jina, jinsia, kijiji, na umri.');
      return;
    }
    setCreating(true);
    try {
      const patient = await createPatient({
        chw_id: chw.id,
        full_name: newName.trim(),
        sex: newSex,
        village: newVillage.trim(),
        district: newDistrict,
        phone: newPhone.trim() || undefined,
        age_years: newAgeYears ? parseInt(newAgeYears, 10) : undefined,
        age_months: newAgeMonths ? parseInt(newAgeMonths, 10) : undefined,
        is_pregnant: newPregnant,
      });
      setShowNewPatient(false);
      resetNewPatientForm();
      // Go directly to new visit with this patient
      navigation.navigate('NewVisit', { patientId: (patient as Patient).id });
    } catch (err) {
      Alert.alert('Hitilafu', 'Imeshindwa kuunda mgonjwa. Jaribu tena.');
    } finally {
      setCreating(false);
    }
  }

  function formatAge(p: Patient) {
    if (p.age_months) return `Miezi ${p.age_months}`;
    if (p.age_years)  return `Miaka ${p.age_years}`;
    return 'Umri ?';
  }

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Rudi</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Tafuta Mgonjwa</Text>
        <TouchableOpacity onPress={() => setShowNewPatient(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Mpya</Text>
        </TouchableOpacity>
      </View>

      {/* Search box */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Andika jina la mgonjwa..."
          placeholderTextColor={colors.inkDim}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="words"
        />
        {searching && <ActivityIndicator color={colors.green} style={{ marginLeft: 8 }} />}
      </View>

      {/* Results */}
      {query.length > 1 && patients.length === 0 && !searching && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Hakuna mgonjwa aliyepatikana kwa "{query}"</Text>
          <TouchableOpacity style={styles.createSuggestion} onPress={() => setShowNewPatient(true)}>
            <Text style={styles.createSuggestionText}>+ Unda mgonjwa mpya</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={patients}
        keyExtractor={p => p.id}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item: p }) => (
          <TouchableOpacity
            style={styles.patientCard}
            onPress={() => navigation.navigate('NewVisit', { patientId: p.id })}
            activeOpacity={0.7}
          >
            <View style={styles.patientAvatar}>
              <Text style={styles.patientAvatarText}>
                {p.sex === 'female' ? '♀' : '♂'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{p.full_name}</Text>
              <Text style={styles.patientMeta}>
                {formatAge(p)} · {p.village} · {p.district}
              </Text>
              {p.is_pregnant && <Text style={styles.pregnantBadge}>🤰 Mjamzito</Text>}
            </View>
            <Text style={{ color: colors.green, fontSize: 20 }}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.length === 0 ? (
            <View style={styles.hintWrap}>
              <Text style={styles.hintIcon}>👥</Text>
              <Text style={styles.hintText}>Andika jina la mgonjwa kutafuta.</Text>
              <Text style={styles.hintSub}>Au bonyeza "+ Mpya" kuunda mgonjwa mpya.</Text>
            </View>
          ) : null
        }
      />

      {/* New Patient Modal */}
      <Modal visible={showNewPatient} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowNewPatient(false); resetNewPatientForm(); }}>
              <Text style={{ color: colors.emergency, fontWeight: '600', fontSize: 15 }}>Funga</Text>
            </TouchableOpacity>
            <Text style={typography.h4}>Mgonjwa Mpya</Text>
            <TouchableOpacity onPress={handleCreatePatient} disabled={creating}>
              {creating
                ? <ActivityIndicator color={colors.green} />
                : <Text style={{ color: colors.green, fontWeight: '700', fontSize: 15 }}>Hifadhi</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: spacing.md }} keyboardShouldPersistTaps="handled">
            <FormField label="JINA KAMILI *">
              <TextInput style={shared.input} placeholder="Fatuma Ally" value={newName}
                onChangeText={setNewName} autoCapitalize="words" />
            </FormField>

            <FormField label="JINSIA *">
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['male', 'female'] as const).map(s => (
                  <TouchableOpacity key={s}
                    style={[styles.sexBtn, newSex === s && styles.sexBtnActive]}
                    onPress={() => setNewSex(s)}>
                    <Text style={[styles.sexTxt, newSex === s && { color: colors.greenDark }]}>
                      {s === 'male' ? '♂ Mme' : '♀ Mke'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FormField>

            <FormField label="UMRI *">
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { marginBottom: 4 }]}>Miaka</Text>
                  <TextInput style={[shared.input, { textAlign: 'center' }]}
                    placeholder="—" value={newAgeYears}
                    onChangeText={v => { setNewAgeYears(v); if (v) setNewAgeMonths(''); }}
                    keyboardType="number-pad" maxLength={3} />
                </View>
                <Text style={typography.bodyMuted}>au</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { marginBottom: 4 }]}>Miezi (&lt;5yrs)</Text>
                  <TextInput style={[shared.input, { textAlign: 'center' }]}
                    placeholder="—" value={newAgeMonths}
                    onChangeText={v => { setNewAgeMonths(v); if (v) setNewAgeYears(''); }}
                    keyboardType="number-pad" maxLength={2} />
                </View>
              </View>
            </FormField>

            <FormField label="KIJIJI / MTAA *">
              <TextInput style={shared.input} placeholder="Kibamba" value={newVillage}
                onChangeText={setNewVillage} autoCapitalize="words" />
            </FormField>

            <FormField label="NAMBA YA SIMU (Si lazima)">
              <TextInput style={shared.input} placeholder="+255 712 000 000"
                value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />
            </FormField>

            {newSex === 'female' && (
              <FormField label="">
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={typography.body}>Ni mjamzito?</Text>
                  <Switch value={newPregnant} onValueChange={setNewPregnant}
                    trackColor={{ true: colors.green, false: colors.border }} />
                </View>
              </FormField>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={[typography.label, { marginBottom: spacing.xs }]}>{label}</Text> : null}
      {children}
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
  addBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.greenLight, borderRadius: radius.full,
  },
  addBtnText: { color: colors.greenDark, fontWeight: '700', fontSize: 14 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    margin: spacing.md, backgroundColor: colors.surface,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: colors.ink },
  emptyWrap: { alignItems: 'center', padding: spacing.xl },
  emptyText: { ...typography.bodyMuted, textAlign: 'center' },
  createSuggestion: {
    marginTop: spacing.md, paddingVertical: 12, paddingHorizontal: 24,
    backgroundColor: colors.greenLight, borderRadius: radius.full,
  },
  createSuggestionText: { color: colors.greenDark, fontWeight: '700' },
  patientCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  patientAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  patientAvatarText: { fontSize: 20 },
  patientName: { ...typography.h4, fontSize: 15 },
  patientMeta: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  pregnantBadge: { ...typography.caption, color: colors.info, marginTop: 3 },
  hintWrap: { alignItems: 'center', paddingTop: spacing.xxl },
  hintIcon: { fontSize: 48, marginBottom: spacing.md },
  hintText: { ...typography.h4, color: colors.inkMuted },
  hintSub: { ...typography.caption, color: colors.inkDim, marginTop: 4 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  sexBtn: {
    flex: 1, padding: 14, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.surface,
  },
  sexBtnActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  sexTxt: { fontSize: 16, fontWeight: '600', color: colors.inkMuted },
});
