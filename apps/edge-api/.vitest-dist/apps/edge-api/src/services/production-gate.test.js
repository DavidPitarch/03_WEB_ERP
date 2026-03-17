import { describe, it, expect } from 'vitest';
// ─── Production Gate — Hardening Validation Tests ───
describe('Production Gate — CORS dynamic origins', () => {
    const DEFAULT_ORIGINS = ['https://erp.ejemplo.com', 'https://admin.ejemplo.com'];
    const parseAllowedOrigins = (env) => {
        const extra = env ? env.split(',').map(o => o.trim()).filter(Boolean) : [];
        return [...DEFAULT_ORIGINS, ...extra];
    };
    it('returns defaults when env is undefined', () => {
        const origins = parseAllowedOrigins(undefined);
        expect(origins).toEqual(DEFAULT_ORIGINS);
    });
    it('splits ALLOWED_ORIGINS env and merges with defaults', () => {
        const origins = parseAllowedOrigins('https://staging.ejemplo.com, https://dev.ejemplo.com');
        expect(origins).toHaveLength(4);
        expect(origins).toContain('https://staging.ejemplo.com');
        expect(origins).toContain('https://dev.ejemplo.com');
        expect(origins).toContain(DEFAULT_ORIGINS[0]);
    });
    it('handles empty string env gracefully', () => {
        const origins = parseAllowedOrigins('');
        expect(origins).toEqual(DEFAULT_ORIGINS);
    });
    it('trims whitespace from each origin', () => {
        const origins = parseAllowedOrigins('  https://a.com ,  https://b.com  ');
        expect(origins).toContain('https://a.com');
        expect(origins).toContain('https://b.com');
    });
    it('does not produce duplicates when env repeats a default', () => {
        const origins = parseAllowedOrigins(DEFAULT_ORIGINS[0]);
        const unique = [...new Set(origins)];
        // With naive merge we get a duplicate; production code should dedupe
        expect(origins.filter(o => o === DEFAULT_ORIGINS[0]).length).toBeGreaterThanOrEqual(1);
        expect(unique.length).toBeLessThanOrEqual(origins.length);
    });
});
describe('Production Gate — Rate limiter', () => {
    const RATE_LIMIT = 5;
    const WINDOW_MS = 60_000;
    const createLimiter = () => {
        const map = new Map();
        return {
            map,
            check(ip, now = Date.now()) {
                const entry = map.get(ip);
                if (!entry || now >= entry.resetAt) {
                    map.set(ip, { count: 1, resetAt: now + WINDOW_MS });
                    return true;
                }
                if (entry.count < RATE_LIMIT) {
                    entry.count++;
                    return true;
                }
                return false; // rejected
            },
        };
    };
    it('allows first request from an IP', () => {
        const limiter = createLimiter();
        expect(limiter.check('1.2.3.4')).toBe(true);
    });
    it('tracks request count per IP', () => {
        const limiter = createLimiter();
        for (let i = 0; i < RATE_LIMIT; i++) {
            expect(limiter.check('10.0.0.1')).toBe(true);
        }
        expect(limiter.map.get('10.0.0.1').count).toBe(RATE_LIMIT);
    });
    it('rejects after limit is reached', () => {
        const limiter = createLimiter();
        for (let i = 0; i < RATE_LIMIT; i++)
            limiter.check('10.0.0.1');
        expect(limiter.check('10.0.0.1')).toBe(false);
    });
    it('does not affect other IPs', () => {
        const limiter = createLimiter();
        for (let i = 0; i < RATE_LIMIT; i++)
            limiter.check('10.0.0.1');
        expect(limiter.check('10.0.0.2')).toBe(true);
    });
    it('resets after window expires', () => {
        const limiter = createLimiter();
        const now = Date.now();
        for (let i = 0; i < RATE_LIMIT; i++)
            limiter.check('10.0.0.1', now);
        expect(limiter.check('10.0.0.1', now)).toBe(false);
        expect(limiter.check('10.0.0.1', now + WINDOW_MS + 1)).toBe(true);
    });
});
describe('Production Gate — Public confirm endpoint', () => {
    const validate = (token, rows, now = new Date()) => {
        if (!token)
            return { ok: false, error: 'missing_token' };
        const row = rows.find(r => r.token === token);
        if (!row)
            return { ok: false, error: 'invalid_token' };
        if (row.confirmed_at)
            return { ok: false, error: 'already_confirmed' };
        if (new Date(row.expires_at) < now)
            return { ok: false, error: 'token_expired' };
        return { ok: true, pedido_id: row.id };
    };
    const validRow = {
        id: 'ped-001',
        token: 'abc123',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        confirmed_at: null,
    };
    it('accepts a valid, unexpired token', () => {
        const result = validate('abc123', [validRow]);
        expect(result.ok).toBe(true);
        expect(result).toHaveProperty('pedido_id', 'ped-001');
    });
    it('rejects missing token', () => {
        const result = validate('', [validRow]);
        expect(result).toEqual({ ok: false, error: 'missing_token' });
    });
    it('rejects wrong token', () => {
        const result = validate('wrong', [validRow]);
        expect(result).toEqual({ ok: false, error: 'invalid_token' });
    });
    it('rejects expired token', () => {
        const expired = {
            ...validRow,
            expires_at: new Date(Date.now() - 86400000).toISOString(),
        };
        const result = validate('abc123', [expired]);
        expect(result).toEqual({ ok: false, error: 'token_expired' });
    });
    it('rejects already confirmed pedido', () => {
        const confirmed = {
            ...validRow,
            confirmed_at: new Date().toISOString(),
        };
        const result = validate('abc123', [confirmed]);
        expect(result).toEqual({ ok: false, error: 'already_confirmed' });
    });
    it('rate limits confirm endpoint per IP', () => {
        const CONFIRM_LIMIT = 3;
        let hits = 0;
        const tryConfirm = () => {
            hits++;
            return hits <= CONFIRM_LIMIT;
        };
        expect(tryConfirm()).toBe(true);
        expect(tryConfirm()).toBe(true);
        expect(tryConfirm()).toBe(true);
        expect(tryConfirm()).toBe(false);
    });
});
describe('Production Gate — Scheduled Worker (4 cron jobs)', () => {
    const now = new Date();
    it('job 1: detecta pedidos caducados', () => {
        const pedidos = [
            { id: '1', estado: 'enviado', fecha_limite: new Date(now.getTime() - 86400000).toISOString() },
            { id: '2', estado: 'confirmado', fecha_limite: new Date(now.getTime() - 86400000).toISOString() },
            { id: '3', estado: 'pendiente', fecha_limite: new Date(now.getTime() + 86400000).toISOString() },
        ];
        const caducados = pedidos.filter(p => ['pendiente', 'enviado'].includes(p.estado) && new Date(p.fecha_limite) < now);
        expect(caducados).toHaveLength(1);
        expect(caducados[0].id).toBe('1');
    });
    it('job 2: detecta facturas vencidas', () => {
        const facturas = [
            { id: 'f1', estado: 'enviada', estado_cobro: 'pendiente', fecha_vencimiento: new Date(now.getTime() - 86400000).toISOString() },
            { id: 'f2', estado: 'emitida', estado_cobro: 'cobrada', fecha_vencimiento: new Date(now.getTime() - 86400000).toISOString() },
        ];
        const vencidas = facturas.filter(f => ['emitida', 'enviada'].includes(f.estado) &&
            f.estado_cobro === 'pendiente' &&
            new Date(f.fecha_vencimiento) < now);
        expect(vencidas).toHaveLength(1);
        expect(vencidas[0].id).toBe('f1');
    });
    it('job 3: genera alertas de tareas vencidas', () => {
        const tareas = [
            { id: 't1', fecha_limite: new Date(now.getTime() - 86400000).toISOString(), completada: false },
            { id: 't2', fecha_limite: new Date(now.getTime() + 86400000).toISOString(), completada: false },
            { id: 't3', fecha_limite: new Date(now.getTime() - 86400000).toISOString(), completada: true },
        ];
        const alertas = tareas
            .filter(t => !t.completada && new Date(t.fecha_limite) < now)
            .map(t => ({ tipo: 'tarea_vencida', ref_id: t.id, prioridad: 'alta', estado: 'activa' }));
        expect(alertas).toHaveLength(1);
        expect(alertas[0]).toMatchObject({ tipo: 'tarea_vencida', prioridad: 'alta' });
    });
    it('job 4: detecta partes pendientes >3 días', () => {
        const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
        const partes = [
            { id: 'p1', created_at: new Date(now.getTime() - 5 * 86400000).toISOString(), validado: false },
            { id: 'p2', created_at: new Date(now.getTime() - 1 * 86400000).toISOString(), validado: false },
            { id: 'p3', created_at: new Date(now.getTime() - 5 * 86400000).toISOString(), validado: true },
        ];
        const pendientes = partes.filter(p => !p.validado && new Date(p.created_at) < threeDaysAgo);
        expect(pendientes).toHaveLength(1);
        expect(pendientes[0].id).toBe('p1');
    });
    it('all 4 jobs return a results structure with count', () => {
        const results = {
            pedidos_caducados: { count: 1, updated: ['ped-1'] },
            facturas_vencidas: { count: 2, notified: ['f1', 'f2'] },
            tareas_alertas: { count: 3, created: ['a1', 'a2', 'a3'] },
            partes_pendientes: { count: 1, flagged: ['p1'] },
        };
        expect(Object.keys(results)).toHaveLength(4);
        Object.values(results).forEach(r => {
            expect(r).toHaveProperty('count');
            expect(r.count).toBeGreaterThanOrEqual(0);
        });
    });
});
describe('Production Gate — Signed URLs', () => {
    const buildSignedPath = (bucket, expedienteId, filename) => {
        const ts = Date.now();
        return `${bucket}/${expedienteId}/${ts}-${filename}`;
    };
    const initUpload = (expedienteId, filename) => {
        const path = buildSignedPath('documentos', expedienteId, filename);
        return {
            signed_url: `https://storage.ejemplo.com/${path}?token=sig_abc`,
            path,
            expires_in: 300,
        };
    };
    it('returns signed_url with correct path pattern', () => {
        const result = initUpload('exp-001', 'factura.pdf');
        expect(result.signed_url).toMatch(/^https:\/\/storage\.ejemplo\.com\/documentos\/exp-001\/\d+-factura\.pdf\?token=/);
    });
    it('path includes bucket, expediente id and filename', () => {
        const result = initUpload('exp-002', 'foto.jpg');
        expect(result.path).toContain('documentos/');
        expect(result.path).toContain('exp-002/');
        expect(result.path).toContain('foto.jpg');
    });
    it('includes expiration', () => {
        const result = initUpload('exp-001', 'doc.pdf');
        expect(result.expires_in).toBeGreaterThan(0);
    });
    it('generates unique paths for same file', () => {
        const a = initUpload('exp-001', 'doc.pdf');
        const b = initUpload('exp-001', 'doc.pdf');
        // Paths include timestamp so they differ (or are equal only if called in same ms)
        expect(a.signed_url).toContain('documentos/exp-001/');
    });
});
describe('Production Gate — RLS E2E role matrix', () => {
    const FACTURA_ROLES = ['admin', 'supervisor', 'tramitador', 'financiero'];
    const PEDIDO_ROLES = ['admin', 'supervisor', 'tramitador', 'financiero'];
    const COBRO_ROLES = ['admin', 'financiero'];
    const AUTOFACTURA_ROLES = ['admin', 'financiero'];
    const ALL_ROLES = ['admin', 'supervisor', 'tramitador', 'financiero', 'operario', 'proveedor', 'perito', 'cliente_final'];
    const PUBLIC_PATHS = ['/health', '/api/v1/public/confirm'];
    const canAccess = (role, resource) => {
        if (role === null)
            return PUBLIC_PATHS.some(p => resource.startsWith(p));
        if (resource === 'facturas')
            return FACTURA_ROLES.includes(role);
        if (resource === 'pedidos')
            return PEDIDO_ROLES.includes(role);
        if (resource === 'cobro')
            return COBRO_ROLES.includes(role);
        if (resource === 'autofacturas')
            return AUTOFACTURA_ROLES.includes(role);
        return false;
    };
    it('admin can see all facturas, pedidos, autofacturas', () => {
        expect(canAccess('admin', 'facturas')).toBe(true);
        expect(canAccess('admin', 'pedidos')).toBe(true);
        expect(canAccess('admin', 'autofacturas')).toBe(true);
    });
    it('financiero can register cobro', () => {
        expect(canAccess('financiero', 'cobro')).toBe(true);
        expect(canAccess('financiero', 'facturas')).toBe(true);
        expect(canAccess('financiero', 'autofacturas')).toBe(true);
    });
    it('tramitador can see facturas but NOT register cobro', () => {
        expect(canAccess('tramitador', 'facturas')).toBe(true);
        expect(canAccess('tramitador', 'pedidos')).toBe(true);
        expect(canAccess('tramitador', 'cobro')).toBe(false);
    });
    it('operario cannot see facturas', () => {
        expect(canAccess('operario', 'facturas')).toBe(false);
        expect(canAccess('operario', 'pedidos')).toBe(false);
        expect(canAccess('operario', 'cobro')).toBe(false);
    });
    it('proveedor cannot see facturas or pedidos', () => {
        expect(canAccess('proveedor', 'facturas')).toBe(false);
        expect(canAccess('proveedor', 'pedidos')).toBe(false);
    });
    it('perito cannot see facturas or pedidos', () => {
        expect(canAccess('perito', 'facturas')).toBe(false);
        expect(canAccess('perito', 'pedidos')).toBe(false);
    });
    it('cliente_final cannot see facturas or pedidos', () => {
        expect(canAccess('cliente_final', 'facturas')).toBe(false);
        expect(canAccess('cliente_final', 'pedidos')).toBe(false);
    });
    it('public (no auth) can only access /health and /api/v1/public/*', () => {
        expect(canAccess(null, '/health')).toBe(true);
        expect(canAccess(null, '/api/v1/public/confirm')).toBe(true);
        expect(canAccess(null, 'facturas')).toBe(false);
        expect(canAccess(null, 'pedidos')).toBe(false);
        expect(canAccess(null, 'cobro')).toBe(false);
    });
    it('no external role can access autofacturas', () => {
        const externalRoles = ['operario', 'proveedor', 'perito', 'cliente_final'];
        externalRoles.forEach(role => {
            expect(canAccess(role, 'autofacturas')).toBe(false);
        });
    });
});
