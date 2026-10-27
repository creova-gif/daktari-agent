import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { colors, typography, spacing, radius, shadow, shared } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'>;
};

export default function ProfileScreen({ navigation }: Props) {
  const { chw, signOut } = useAuth();
  const { isOnline, pendingCount, lastSyncAt, syncing, triggerSync } = useOfflineSync(chw?.id);

  async function handleSignOut() {
    Alert.alert(
      'Toka',
      'Una uhakika unataka kutoka kwenye akaunti yako?',
      [
        { text: 'Ghairi', style: 'cancel' },
        {
          text: 'Ndiyo, Toka',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            navigation.replace('Login');
          },
        },
      ]
    );
  }

  const syncTimeLabel = lastSyncAt
    ? lastSyncAt.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
    : 'Haijasawazishwa bado';

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Rudi</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Wasifu</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>

        {/* CHW Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{chw?.full_name?.charAt(0) ?? 'C'}</Text>
          </View>
          <Text style={styles.chwName}>{chw?.full_name}</Text>
          <Text style={styles.chwId}>CHW · {chw?.chw_id_number}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{chw?.role?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Info cards */}
        <InfoCard label="Kituo" value={chw?.facility_name ?? '—'} icon="🏥" />
        <InfoCard label="Wilaya" value={chw?.district ?? '—'} icon="📍" />
        <InfoCard label="Simu" value={chw?.phone ?? '—'} icon="📱" />

        {/* Sync status */}
        <View style={[styles.syncCard, { borderColor: isOnline ? colors.green : colors.warning }]}>
          <View style={styles.syncRow}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.warning }]} />
            <Text style={styles.syncStatus}>
              {isOnline ? 'Unaungana na Mtandao' : 'Nje ya Mtandao (Offline)'}
            </Text>
          </View>
          {pendingCount > 0 && (
            <Text style={styles.pendingText}>
              📤 Data {pendingCount} zinasubiri kusawazishwa
            </Text>
          )}
          <Text style={styles.lastSyncText}>Mara ya mwisho: {syncTimeLabel}</Text>
          <TouchableOpacity
            style={[styles.syncBtn, (!isOnline || syncing) && { opacity: 0.5 }]}
            onPress={triggerSync}
            disabled={!isOnline || syncing}
          >
            {syncing
              ? <ActivityIndicator color={colors.green} size="small" />
              : <Text style={styles.syncBtnText}>↻ Sawazisha Sasa</Text>
            }
          </TouchableOpacity>
        </View>

        {/* App version */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>
            Daktari Agent v0.1.0{'\n'}
            CREOVA Health · Tanzania · 2026{'\n'}
            Inategemea miongozo ya MoH Tanzania
          </Text>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Toka kwenye Akaunti</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
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
  avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md, ...shadow.md,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: colors.greenDark },
  chwName: { ...typography.h2, textAlign: 'center' },
  chwId: { ...typography.caption, color: colors.inkMuted, marginTop: 4 },
  roleBadge: {
    marginTop: spacing.sm, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: colors.greenLight, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.green,
  },
  roleText: { color: colors.greenDark, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  infoIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  infoLabel: { ...typography.label, marginBottom: 2 },
  infoValue: { ...typography.body },
  syncCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 2, ...shadow.sm,
  },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  syncStatus: { fontWeight: '700', fontSize: 15, color: colors.ink },
  pendingText: { ...typography.caption, color: colors.warning, marginBottom: 4 },
  lastSyncText: { ...typography.caption, color: colors.inkMuted },
  syncBtn: {
    marginTop: spacing.md, paddingVertical: 10,
    backgroundColor: colors.greenLight, borderRadius: radius.md,
    alignItems: 'center',
  },
  syncBtnText: { color: colors.greenDark, fontWeight: '700', fontSize: 14 },
  versionSection: {
    padding: spacing.md, alignItems: 'center', marginBottom: spacing.md,
  },
  versionText: { ...typography.caption, color: colors.inkDim, textAlign: 'center', lineHeight: 20 },
  signOutBtn: {
    padding: 16, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.emergency,
    alignItems: 'center',
  },
  signOutText: { color: colors.emergency, fontWeight: '700', fontSize: 16 },
});
