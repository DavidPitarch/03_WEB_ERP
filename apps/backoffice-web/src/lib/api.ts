import { supabase } from './supabase';
import type { ApiResult } from '@erp/types';

// En dev: Vite hace proxy de /api → localhost:8787 (no se necesita VITE_API_URL).
// En CF Pages / demo: VITE_API_URL debe apuntar al worker, ej. https://erp-siniestros-api-demo.workers.dev
const API_BASE = import.meta.env.VITE_API_URL
  ? `${(import.meta.env.VITE_API_URL as string).replace(/\/$/, '')}/api/v1`
  : '/api/v1';

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const token = await getToken();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch (networkError) {
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message: 'Sin conexión con el servidor. Comprueba tu red.' },
    } as ApiResult<T>;
  }

  if (!res.ok && res.status >= 500) {
    // Evitar parsear HTML que devuelve Cloudflare en errores de gateway
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return {
        data: null,
        error: { code: `HTTP_${res.status}`, message: `Error del servidor (${res.status}). Inténtalo de nuevo.` },
      } as ApiResult<T>;
    }
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
