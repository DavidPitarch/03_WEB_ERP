import { supabase } from './supabase';
import { enqueue } from './offline-queue';
import type { ApiResult } from '@erp/types';
import { getDemoAgenda, getDemoClaimDetail } from './demo-data';

const API_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/operator`;
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

async function demoRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  await new Promise((r) => setTimeout(r, 300)); // simular latencia

  const method = options.method ?? 'GET';

  if (method === 'GET') {
    if (path.startsWith('/me/agenda')) {
      return { data: getDemoAgenda() as unknown as T, error: null };
    }
    const claimMatch = path.match(/^\/claims\/([^/?]+)/);
    if (claimMatch) {
      return { data: getDemoClaimDetail(claimMatch[1]) as unknown as T, error: null };
    }
  }

  if (method === 'POST') {
    // Parte enviado OK
    if (path.match(/^\/claims\/.+\/parts/)) {
      return { data: { id: 'demo-parte-' + Date.now(), sync_status: 'synced' } as unknown as T, error: null };
    }
    // Upload init
    if (path === '/uploads/init') {
      return {
        data: { upload_id: 'demo-upload-001', signed_url: 'demo://noop', storage_path: 'demo/firma.png' } as unknown as T,
        error: null,
      };
    }
    // Upload complete
    if (path === '/uploads/complete') {
      return { data: { ok: true } as unknown as T, error: null };
    }
  }

  return { data: null, error: { code: 'NOT_FOUND', message: 'Demo: ruta no mapeada' } };
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    return refreshed.session?.access_token ?? '';
  }
  return data.session.access_token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  if (DEMO_MODE) return demoRequest<T>(path, options);
  const token = await getToken();
  if (!token) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión expirada' } };
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (res.status === 401) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session) {
        const retry = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${refreshed.session.access_token}`,
            ...options.headers,
          },
        });
        return retry.json();
      }
      return { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión expirada' } };
    }

    return res.json();
  } catch {
    if (!navigator.onLine) {
      return { data: null, error: { code: 'OFFLINE', message: 'Sin conexión' } };
    }
    return { data: null, error: { code: 'NETWORK_ERROR', message: 'Error de conexión' } };
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};

// Upload directo a signed URL con reintentos
export async function uploadToSignedUrl(signedUrl: string, file: File | Blob): Promise<boolean> {
  if (DEMO_MODE) return true;
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (res.ok) return true;
      if (res.status >= 400 && res.status < 500) return false;
    } catch {
      if (attempt === MAX_RETRIES) return false;
    }
  }
  return false;
}

// Enqueue parte for offline sync
export function enqueueParte(expedienteId: string, payload: unknown): string {
  return enqueue('parte', { expedienteId, ...payload as object });
}

export function isOnline(): boolean {
  return navigator.onLine;
}
