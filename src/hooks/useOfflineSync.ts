import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import type { OfflineQueueItem } from '../types';

const QUEUE_KEY = 'daktari_offline_queue';
const SYNC_INTERVAL_MS = 30_000; // try sync every 30s when online

// ─── Core Queue Helpers ───────────────────────────────────────────────────────

async function readQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: OfflineQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueOfflineItem(
  item: Omit<OfflineQueueItem, 'synced'>
): Promise<void> {
  const queue = await readQueue();
  queue.push({ ...item, synced: false });
  await writeQueue(queue);
  console.log(`[OfflineSync] Queued: ${item.type} ${item.entity_id}`);
}

// ─── Sync Logic ───────────────────────────────────────────────────────────────

async function syncPendingItems(chwId: string): Promise<number> {
  const queue = await readQueue();
  const pending = queue.filter(item => !item.synced);
  if (pending.length === 0) return 0;

  let syncedCount = 0;

  for (const item of pending) {
    try {
      if (item.type === 'patient') {
        await supabase.from('patients').upsert(item.payload as object);
      } else if (item.type === 'visit') {
        await supabase.from('clinical_visits').upsert(item.payload as object);
      } else if (item.type === 'recommendation') {
        await supabase.from('ai_recommendations').upsert(item.payload as object);
      }

      item.synced = true;
      syncedCount++;
    } catch (err) {
      console.warn(`[OfflineSync] Failed to sync ${item.type} ${item.entity_id}:`, err);
      // Keep in queue, will retry next cycle
    }
  }

  // Write back with synced statuses updated
  await writeQueue(queue);
  console.log(`[OfflineSync] Synced ${syncedCount}/${pending.length} items`);
  return syncedCount;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  syncing: boolean;
  triggerSync: () => Promise<void>;
}

export function useOfflineSync(chwId: string | undefined): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    const queue = await readQueue();
    setPendingCount(queue.filter(i => !i.synced).length);
  }, []);

  // Trigger manual or automatic sync
  const triggerSync = useCallback(async () => {
    if (!chwId || syncing || !isOnline) return;
    setSyncing(true);
    try {
      await syncPendingItems(chwId);
      await refreshPendingCount();
      setLastSyncAt(new Date());
    } finally {
      setSyncing(false);
    }
  }, [chwId, syncing, isOnline, refreshPendingCount]);

  // Monitor connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) triggerSync(); // sync immediately when connectivity returns
    });
    return () => unsubscribe();
  }, [triggerSync]);

  // Periodic sync
  useEffect(() => {
    refreshPendingCount();
    intervalRef.current = setInterval(() => {
      if (isOnline) triggerSync();
    }, SYNC_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline, triggerSync, refreshPendingCount]);

  return { isOnline, pendingCount, lastSyncAt, syncing, triggerSync };
}
