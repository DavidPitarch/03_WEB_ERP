// Cola offline basada en localStorage con sincronización automática

interface QueuedAction {
  id: string;
  type: 'parte' | 'evidencia';
  payload: unknown;
  created_at: string;
  retries: number;
}

const QUEUE_KEY = 'erp_offline_queue';
const MAX_RETRIES = 5;

function getQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(type: QueuedAction['type'], payload: unknown): string {
  const queue = getQueue();
  const id = crypto.randomUUID();
  queue.push({ id, type, payload, created_at: new Date().toISOString(), retries: 0 });
  saveQueue(queue);
  notifyListeners();
  return id;
}

export function dequeue(id: string) {
  const queue = getQueue().filter((a) => a.id !== id);
  saveQueue(queue);
  notifyListeners();
}

export function getPendingActions(): QueuedAction[] {
  return getQueue();
}

export function getPendingCount(): number {
  return getQueue().length;
}

export function incrementRetry(id: string) {
  const queue = getQueue();
  const item = queue.find((a) => a.id === id);
  if (item) {
    item.retries++;
    if (item.retries >= MAX_RETRIES) {
      const dlq = JSON.parse(localStorage.getItem('erp_offline_dlq') || '[]');
      dlq.push(item);
      localStorage.setItem('erp_offline_dlq', JSON.stringify(dlq));
      saveQueue(queue.filter((a) => a.id !== id));
    } else {
      saveQueue(queue);
    }
  }
  notifyListeners();
}

export async function syncQueue(
  handler: (action: QueuedAction) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const queue = getQueue();
  let synced = 0;
  let failed = 0;

  for (const action of queue) {
    try {
      const ok = await handler(action);
      if (ok) {
        dequeue(action.id);
        synced++;
      } else {
        incrementRetry(action.id);
        failed++;
      }
    } catch {
      incrementRetry(action.id);
      failed++;
    }
  }

  return { synced, failed };
}

// Listener pattern for reactive UI
type Listener = () => void;
const listeners = new Set<Listener>();

export function onQueueChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

// Draft persistence for parte form
const DRAFT_KEY = 'erp_parte_draft';

export function saveDraft(expedienteId: string, citaId: string, data: unknown) {
  localStorage.setItem(`${DRAFT_KEY}_${expedienteId}_${citaId}`, JSON.stringify(data));
}

export function loadDraft(expedienteId: string, citaId: string): unknown | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_KEY}_${expedienteId}_${citaId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(expedienteId: string, citaId: string) {
  localStorage.removeItem(`${DRAFT_KEY}_${expedienteId}_${citaId}`);
}
