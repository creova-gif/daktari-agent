import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFacilityStock, getLowStockAlerts, updateStock, getCHWFormulary, FacilityStock } from '../lib/formulary';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius, shadow, shared } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'StockTracker'>;
};

export default function StockTrackerScreen({ navigation }: Props) {
  const { chw } = useAuth();
  const [stock, setStock] = useState<FacilityStock[]>([]);
  const [lowAlerts, setLowAlerts] = useState<FacilityStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stock' | 'low' | 'formulary'>('stock');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FacilityStock | null>(null);
  const [newQty, setNewQty] = useState('');
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!chw) return;
    try {
      const [s, l] = await Promise.all([
        getFacilityStock(chw.facility_name),
        getLowStockAlerts(chw.district),
      ]);
      setStock(s);
      setLowAlerts(l);
    } catch (err) {
      console.error('[Stock]', err);
    } finally {
      setLoading(false);
    }
  }, [chw]);

  useEffect(() => { load(); }, [load]);

  async function handleUpdateStock() {
    if (!chw || !selectedItem || !newQty) return;
    setUpdating(true);
    try {
      await updateStock({
        facilityName: chw.facility_name,
        formularyItemId: selectedItem.formulary_item_id,
        newQuantity: parseInt(newQty, 10),
        chwId: chw.id,
      });
      setShowUpdateModal(false);
      setNewQty('');
      await load();
      Alert.alert('✓ Imehifadhiwa', 'Idadi ya dawa imesasishwa.');
    } catch (err) {
      Alert.alert('Hitilafu', 'Imeshindwa kusasisha stok. Jaribu tena.');
    } finally {
      setUpdating(false);
    }
  }

  function stockLevel(item: FacilityStock): 'critical' | 'low' | 'ok' {
    if (item.quantity_available === 0) return 'critical';
    if (item.quantity_available <= item.reorder_level) return 'low';
    return 'ok';
  }

  function stockColor(level: 'critical' | 'low' | 'ok') {
    return { critical: colors.emergency, low: colors.warning, ok: colors.success }[level];
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
        <View>
          <Text style={styles.title}>Stok ya Dawa</Text>
          <Text style={styles.facility}>{chw?.facility_name}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Low stock banner */}
      {lowAlerts.length > 0 && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => setActiveTab('low')}
        >
          <Text style={styles.alertBannerText}>
            ⚠️ Dawa {lowAlerts.length} zinaisha — bonyeza kuona
          </Text>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={styles.tabBar}>
        {[
          { id: 'stock',     label: 'Stok Yangu', emoji: '📦' },
          { id: 'low',       label: `Zinaisha (${lowAlerts.length})`, emoji: '⚠️' },
          { id: 'formulary', label: 'Formulary', emoji: '📋' },
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

      {/* ─── MY STOCK ─── */}
      {activeTab === 'stock' && (
        <FlatList
          data={stock}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => {
            const level = stockLevel(item);
            const col = stockColor(level);
            const medicine = item.formulary_items;
            const pct = Math.min(100, Math.round(
              (item.quantity_available / Math.max(item.reorder_level * 2, 1)) * 100
            ));
            return (
              <View style={styles.stockCard}>
                <View style={styles.stockCardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stockName}>
                      {medicine?.generic_name_sw ?? item.formulary_item_id}
                    </Text>
                    <Text style={styles.stockCategory}>
                      {medicine?.category?.replace(/_/g, ' ') ?? ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.stockQty, { color: col }]}>
                      {item.quantity_available}
                    </Text>
                    <Text style={styles.stockUnit}>vipi</Text>
                  </View>
                </View>

                {/* Stock bar */}
                <View style={styles.stockBarTrack}>
                  <View style={[styles.stockBarFill, { width: `${pct}%` as any, backgroundColor: col }]} />
                </View>

                <View style={styles.stockCardBottom}>
                  <Text style={[styles.stockLevel, { color: col }]}>
                    {level === 'critical' ? '🔴 Imeisha' : level === 'low' ? '⚠️ Inaisha' : '✓ Inatosha'}
                  </Text>
                  <TouchableOpacity
                    style={styles.updateBtn}
                    onPress={() => { setSelectedItem(item); setNewQty(String(item.quantity_available)); setShowUpdateModal(true); }}
                  >
                    <Text style={styles.updateBtnText}>Sasisha</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>Hakuna dawa zilizorekodiwa kwa kituo hiki bado.</Text>
            </View>
          }
        />
      )}

      {/* ─── LOW STOCK ─── */}
      {activeTab === 'low' && (
        <FlatList
          data={lowAlerts}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => {
            const level = stockLevel(item);
            const col = stockColor(level);
            const medicine = item.formulary_items;
            return (
              <View style={[styles.lowCard, { borderColor: col }]}>
                <Text style={[styles.lowIcon, { color: col }]}>
                  {level === 'critical' ? '🔴' : '⚠️'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stockName}>{medicine?.generic_name_sw ?? ''}</Text>
                  <Text style={styles.stockCategory}>{item.facility_name}</Text>
                  <Text style={[styles.lowQtyLabel, { color: col }]}>
                    Imebaki: {item.quantity_available} / Kiwango cha Kuagiza: {item.reorder_level}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyText}>Hakuna dawa zinazoisha sasa hivi.</Text>
            </View>
          }
        />
      )}

      {/* ─── FORMULARY ─── */}
      {activeTab === 'formulary' && (
        <FormularyTab />
      )}

      {/* Update stock modal */}
      <Modal visible={showUpdateModal} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowUpdateModal(false)}>
              <Text style={{ color: colors.emergency, fontWeight: '600' }}>Ghairi</Text>
            </TouchableOpacity>
            <Text style={typography.h4}>Sasisha Stok</Text>
            <TouchableOpacity onPress={handleUpdateStock} disabled={updating}>
              {updating
                ? <ActivityIndicator color={colors.green} />
                : <Text style={{ color: colors.green, fontWeight: '700' }}>Hifadhi</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={{ padding: spacing.xl }}>
            <Text style={typography.h3}>
              {(selectedItem?.formulary_items as any)?.generic_name_sw ?? ''}
            </Text>
            <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: spacing.xl }]}>
              {chw?.facility_name}
            </Text>
            <Text style={[typography.label, { marginBottom: spacing.sm }]}>IDADI MPYA (VIPI)</Text>
            <TextInput
              style={[shared.input, { fontSize: 32, textAlign: 'center', height: 80 }]}
              value={newQty}
              onChangeText={setNewQty}
              keyboardType="number-pad"
              autoFocus
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function FormularyTab() {
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCHWFormulary().then(d => { setItems(d); setLoading(false); });
  }, []);

  const filtered = query.trim()
    ? items.filter(i =>
        i.generic_name_sw.toLowerCase().includes(query.toLowerCase()) ||
        i.generic_name.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  if (loading) return <ActivityIndicator color={colors.green} style={{ marginTop: 48 }} />;

  return (
    <>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Tafuta dawa..."
          placeholderTextColor={colors.inkDim}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        renderItem={({ item }) => (
          <View style={styles.formularyCard}>
            <View style={styles.formularyTop}>
              <Text style={styles.formularyName}>{item.generic_name_sw}</Text>
              <View style={[styles.chw_badge,
                { backgroundColor: item.is_chw_approved ? colors.greenLight : colors.emergencyBg }]}>
                <Text style={{ fontSize: 10, fontWeight: '700',
                  color: item.is_chw_approved ? colors.greenDark : colors.emergency }}>
                  {item.is_chw_approved ? 'CHW ✓' : 'Si CHW'}
                </Text>
              </View>
            </View>
            <Text style={styles.formularyEn}>{item.generic_name}</Text>
            {item.notes_sw && (
              <Text style={styles.formularyNotes}>{item.notes_sw}</Text>
            )}
            <View style={styles.formularyMeta}>
              <Text style={styles.formularyMetaText}>{item.category.replace(/_/g, ' ')}</Text>
              {item.weight_dosing && <Text style={styles.formularyMetaText}>📊 Uzito</Text>}
            </View>
          </View>
        )}
      />
    </>
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
  facility: { ...typography.caption, color: colors.inkMuted, textAlign: 'center', marginTop: 1 },
  alertBanner: {
    backgroundColor: colors.warningBg, padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.warning,
  },
  alertBannerText: { color: colors.warning, fontWeight: '700', textAlign: 'center' },
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.green },
  tabEmoji: { fontSize: 14, marginBottom: 2 },
  tabLabel: { fontSize: 10, color: colors.inkMuted, fontWeight: '600' },
  tabLabelActive: { color: colors.greenDark },
  stockCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  stockCardRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  stockName: { ...typography.h4, fontSize: 14 },
  stockCategory: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  stockQty: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  stockUnit: { ...typography.caption, color: colors.inkDim },
  stockBarTrack: {
    height: 6, backgroundColor: colors.border,
    borderRadius: 3, overflow: 'hidden', marginBottom: spacing.sm,
  },
  stockBarFill: { height: '100%', borderRadius: 3 },
  stockCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stockLevel: { fontWeight: '700', fontSize: 12 },
  updateBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: colors.greenLight, borderRadius: radius.full,
  },
  updateBtnText: { color: colors.greenDark, fontWeight: '700', fontSize: 13 },
  lowCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 2, ...shadow.sm,
  },
  lowIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  lowQtyLabel: { ...typography.caption, fontWeight: '700', marginTop: 4 },
  searchWrap: {
    padding: spacing.md, paddingBottom: 0,
  },
  searchInput: {
    ...shared.input, marginBottom: spacing.sm,
  },
  formularyCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  formularyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  formularyName: { ...typography.h4, fontSize: 14, flex: 1 },
  chw_badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, flexShrink: 0 },
  formularyEn: { ...typography.caption, color: colors.inkMuted, marginBottom: spacing.sm },
  formularyNotes: { ...typography.caption, color: colors.info, lineHeight: 18, marginBottom: spacing.sm },
  formularyMeta: { flexDirection: 'row', gap: spacing.md },
  formularyMetaText: { ...typography.caption, color: colors.inkDim },
  empty: { alignItems: 'center', paddingTop: spacing.xxl * 2 },
  emptyIcon: { fontSize: 52, marginBottom: spacing.md },
  emptyText: { ...typography.bodyMuted, textAlign: 'center', maxWidth: 280 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
});
