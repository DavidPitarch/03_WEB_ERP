/**
 * Structured request logger middleware.
 *
 * Emits one JSON line per request with:
 *   - correlation_id  (from incoming x-correlation-id header or generated)
 *   - method, path, status, duration_ms
 *   - error + stack on uncaught exceptions
 *
 * Sets the 'correlationId' context variable and echoes it back
 * via the x-correlation-id response header, enabling end-to-end tracing.
 */
export function requestLoggerMiddleware() {
    return async (c, next) => {
        const correlationId = c.req.header('x-correlation-id') ?? crypto.randomUUID();
        c.header('x-correlation-id', correlationId);
        c.set('correlationId', correlationId);
        const start = Date.now();
        const method = c.req.method;
        const path = new URL(c.req.url).pathname;
        try {
            await next();
            const status = c.res.status;
            const duration = Date.now() - start;
            const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
            console.log(JSON.stringify({
                level,
                correlation_id: correlationId,
                method,
                path,
                status,
                duration_ms: duration,
                env: c.env.ENVIRONMENT,
                ts: new Date().toISOString(),
            }));
        }
        catch (err) {
            const duration = Date.now() - start;
            console.error(JSON.stringify({
                level: 'error',
                correlation_id: correlationId,
                method,
                path,
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
                duration_ms: duration,
                env: c.env.ENVIRONMENT,
                ts: new Date().toISOString(),
            }));
            throw err;
        }
    };
}
