import { Hono } from 'hono';
import { runScheduledTasks } from '../scheduled';
export const internalRoutes = new Hono();
internalRoutes.post('/run-scheduled', async (c) => {
    const results = await runScheduledTasks(c.env);
    return c.json({
        data: {
            executed_at: new Date().toISOString(),
            results,
        },
        error: null,
    });
});
