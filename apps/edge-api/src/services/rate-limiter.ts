/**
 * Rate limiter distribuido usando Cloudflare KV.
 *
 * En entornos donde RATE_LIMIT_KV no está vinculado (desarrollo local),
 * cae automáticamente a un Map en memoria. En producción/demo, usa KV
 * para compartir estado entre todos los isolates del Worker.
 *
 * Nota: KV tiene consistencia eventual (~60s). Para rate limiting
 * muy estricto se necesitaría Durable Objects, pero para proteger
 * endpoints públicos contra abuso, KV es suficiente.
 */

// Fallback in-memory para desarrollo local (un solo isolate)
const localMap = new Map<string, { count: number; reset: number }>();

/**
 * Comprueba si la IP ha superado el límite para el endpoint dado.
 * @returns true si la petición está permitida, false si debe bloquearse
 */
export async function checkRateLimit(
  kv: KVNamespace | undefined,
  ip: string,
  endpoint: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!kv) {
    return checkLocalRateLimit(ip, endpoint, limit, windowSeconds * 1000);
  }

  const key = `rl:${endpoint}:${ip}`;

  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= limit) return false;

  // expirationTtl mínimo en KV es 60 segundos
  await kv.put(key, String(count + 1), {
    expirationTtl: Math.max(60, windowSeconds),
  });

  return true;
}

function checkLocalRateLimit(
  ip: string,
  endpoint: string,
  limit: number,
  windowMs: number,
): boolean {
  const key = `${endpoint}:${ip}`;
  const now = Date.now();
  const entry = localMap.get(key);

  if (!entry || now > entry.reset) {
    localMap.set(key, { count: 1, reset: now + windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= limit;
}
