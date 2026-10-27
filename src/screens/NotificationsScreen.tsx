import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getAllNotifications, markNotificationRead, markAllRead,
  subscribeToNotifications, InAppNotification,
} from '../lib/notifications';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius, shadow, shared } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Notifications'>;
};

const NOTIF_ICONS: Record<string, string> = {
  emergency_nearby:    '🚨',
  wellbeing_check:     '💚',
  cert_expiring:       '🎓',
  stock_low:           '💊',
  model_updated:       '🤖',
  mass_casualty_alert: '🆘',
  supervisor_message:  '👤',
  bench_result:        '📊',
};

const NOTIF_COLORS: Record<string, string> = {
  emergency_nearby:    colors.emergency,
  wellbeing_check:     colors.success,
  cert_expiring:       '#9C27B0',
  stock_low:           colors.warning,
  model_updated:       colors.info,
  mass_casualty_alert: colors.emergency,
  supervisor_message:  colors.blue,
  bench_result:        colors.green,
};

export default function NotificationsScreen({ navigation }: Props) {
  const { chw } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!chw) return;
    const data = await getAllNotifications(chw.id);
    setNotifications(data);
    setLoading(false);
    setRefreshing(false);
  }, [chw]);

  useEffect(() => {
    load();

    // Subscribe to realtime new notifications
    if (!chw) return;
    const unsub = subscribeToNotifications(chw.id, (notif) => {
      setNotifications(prev => [notif, ...prev]);
    });
    return unsub;
  }, [chw, load]);

  async function handleRead(notif: InAppNotification) {
    if (!notif.read) {
      await markNotificationRead(notif.id);
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
      );
    }

    // Deep-link navigation based on notification type
    const data = notif.data as Record<string, string>;
    if (notif.type === 'emergency_nearby' || notif.type === 'mass_casualty_alert') {
      navigation.navigate('EmergencyProtocol');
    } else if (notif.type === 'cert_expiring') {
      navigation.navigate('Certification');
    } else if (notif.type === 'bench_result') {
      navigation.navigate('BenchResults');
    } else if (notif.type === 'stock_low') {
      navigation.navigate('StockTracker');
    }
  }

  async function handleMarkAllRead() {
    if (!chw) return;
    await markAllRead(chw.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return 'Sasa hivi';
    if (diffMins < 60) return `Dakika ${diffMins} zilizopita`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `Masaa ${diffHrs} yaliyopita`;
    return d.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' });
  }

  const unreadCount = notifications.filter(n => !n.read).length;

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
        <View>
          <Text style={styles.title}>Arifa</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadBadge}>{unreadCount} mpya</Text>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAll}>Soma Zote</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.green} />
        }
        renderItem={({ item: notif }) => {
          const iconColor = NOTIF_COLORS[notif.type] ?? colors.inkMuted;
          const icon = NOTIF_ICONS[notif.type] ?? '🔔';
          const isEmergency = notif.type === 'emergency_nearby' || notif.type === 'mass_casualty_alert';
          return (
            <TouchableOpacity
              style={[
                styles.notifCard,
                !notif.read && styles.notifCardUnread,
                isEmergency && styles.notifCardEmergency,
              ]}
              onPress={() => handleRead(notif)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
                <Text style={styles.icon}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifTitle, isEmergency && { color: colors.emergency }]}>
                  {notif.title}
                </Text>
                <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                <Text style={styles.notifTime}>{formatTime(notif.created_at)}</Text>
              </View>
              {!notif.read && <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>Hakuna arifa bado.</Text>
            <Text style={styles.emptySubText}>Arifa zitaonekana hapa zinapotumwa na msimamizi wako.</Text>
          </View>
        }
        contentContainerStyle={{ padding: spacing.md }}
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
  title: { ...typography.h4, textAlign: 'center' },
  unreadBadge: { ...typography.caption, color: colors.emergency, textAlign: 'center', marginTop: 1 },
  markAll: { color: colors.info, fontWeight: '600', fontSize: 14 },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  notifCardUnread: {
    backgroundColor: colors.greenLight,
    borderColor: colors.green + '40',
  },
  notifCardEmergency: {
    backgroundColor: colors.emergencyBg,
    borderColor: colors.emergency,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  icon: { fontSize: 22 },
  notifTitle: { ...typography.h4, fontSize: 14, marginBottom: 2 },
  notifBody: { ...typography.caption, color: colors.inkMuted, lineHeight: 18, marginBottom: 4 },
  notifTime: { ...typography.caption, color: colors.inkDim, fontSize: 11 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  empty: { alignItems: 'center', paddingTop: spacing.xxl * 2 },
  emptyIcon: { fontSize: 52, marginBottom: spacing.md },
  emptyText: { ...typography.h4, color: colors.inkMuted },
  emptySubText: { ...typography.caption, color: colors.inkDim, marginTop: 6, textAlign: 'center', maxWidth: 240 },
});
