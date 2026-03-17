import type { Context } from 'hono';

export function getRequestIp(c: Context): string | null {
  const forwarded = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for');
  if (!forwarded) {
    return null;
  }

  const [ip] = forwarded.split(',');
  return ip?.trim() || null;
}
