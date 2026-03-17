import { useState, useEffect, useCallback } from 'react';
import { getPendingCount, onQueueChange, syncQueue } from './offline-queue';
import { api } from './api';
import type { CreateParteRequest } from '@erp/types';

export function useNetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
}

export function useQueueCount() {
  const [count, setCount] = useState(getPendingCount);

  useEffect(() => {
    return onQueueChange(() => setCount(getPendingCount()));
  }, []);

  return count;
}

export function useSyncOnReconnect() {
  const online = useNetworkStatus();

  const doSync = useCallback(async () => {
    if (!online) return;
    await syncQueue(async (action) => {
      if (action.type === 'parte') {
        const p = action.payload as CreateParteRequest & { expedienteId: string };
        const res = await api.post(`/claims/${p.expedienteId}/parts`, p);
        return res && 'data' in res && !!res.data;
      }
      return false;
    });
  }, [online]);

  useEffect(() => {
    if (online) {
      doSync();
    }
  }, [online, doSync]);

  useEffect(() => {
    const handler = () => { if (navigator.onLine) doSync(); };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [doSync]);
}
