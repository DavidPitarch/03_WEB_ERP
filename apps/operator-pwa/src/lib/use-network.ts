import { useState, useEffect, useCallback } from 'react';
import { getPendingCount, onQueueChange, syncQueue } from './offline-queue';
import { api, uploadToSignedUrl } from './api';
import { getBlob, deleteBlob } from './offline-blobs';
import type { CreateParteRequest, UploadInitResponse } from '@erp/types';

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
        const p = action.payload as CreateParteRequest & {
          expedienteId: string;
          evidence_blob_keys?: string[];
        };

        let firmaStoragePath = p.firma_storage_path;
        const resolvedEvidenciaIds = [...(p.evidencia_ids ?? [])];

        // Upload firma blob from IndexedDB if stored offline
        if (firmaStoragePath?.startsWith('offline:')) {
          const blobKey = firmaStoragePath.slice('offline:'.length);
          const blob = await getBlob(blobKey);
          if (blob) {
            const initRes = await api.post<UploadInitResponse>('/uploads/init', {
              expediente_id: p.expediente_id,
              filename: 'firma_cliente.png',
              content_type: 'image/png',
            });
            if (initRes && 'data' in initRes && initRes.data) {
              const init = initRes.data as UploadInitResponse;
              const ok = await uploadToSignedUrl(init.signed_url, blob);
              if (ok) {
                await api.post('/uploads/complete', {
                  upload_id: init.upload_id,
                  storage_path: init.storage_path,
                  expediente_id: p.expediente_id,
                  cita_id: p.cita_id,
                  clasificacion: 'general',
                  nombre_original: 'firma_cliente.png',
                  mime_type: 'image/png',
                  tamano_bytes: blob.size,
                });
                firmaStoragePath = init.storage_path;
                await deleteBlob(blobKey);
              }
            }
          }
        }

        // Upload evidence blobs from IndexedDB
        for (const blobKey of (p.evidence_blob_keys ?? [])) {
          const blob = await getBlob(blobKey);
          if (!blob) continue;
          const filename = `foto_${Date.now()}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
          const initRes = await api.post<UploadInitResponse>('/uploads/init', {
            expediente_id: p.expediente_id,
            filename,
            content_type: blob.type || 'image/jpeg',
          });
          if (initRes && 'data' in initRes && initRes.data) {
            const init = initRes.data as UploadInitResponse;
            const ok = await uploadToSignedUrl(init.signed_url, blob);
            if (ok) {
              const completeRes = await api.post<{ id: string }>('/uploads/complete', {
                upload_id: init.upload_id,
                storage_path: init.storage_path,
                expediente_id: p.expediente_id,
                cita_id: p.cita_id,
                clasificacion: 'general',
                nombre_original: filename,
                mime_type: blob.type || 'image/jpeg',
                tamano_bytes: blob.size,
              });
              if (completeRes && 'data' in completeRes && completeRes.data) {
                resolvedEvidenciaIds.push((completeRes.data as any).id);
                await deleteBlob(blobKey);
              }
            }
          }
        }

        const res = await api.post(`/claims/${p.expedienteId}/parts`, {
          ...p,
          firma_storage_path: firmaStoragePath,
          evidencia_ids: resolvedEvidenciaIds,
        });
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
