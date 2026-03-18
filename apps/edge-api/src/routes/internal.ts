import { Hono } from 'hono';
import { runScheduledTasks } from '../scheduled';
import type { Env } from '../types';

export const internalRoutes = new Hono<{ Bindings: Env }>();

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
