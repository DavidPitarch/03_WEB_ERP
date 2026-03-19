import type { ApiResult } from '@erp/types';

const API_BASE = '/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res.json();
}

export const publicApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};
