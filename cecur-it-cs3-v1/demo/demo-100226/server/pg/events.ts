import { Client } from 'pg';
import { isPostgresEnabled } from './pool';

export const PG_EVENT_CHANNEL = 'cs3_events';

export interface PgChangeEvent {
  collection: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  id: string;
  ts: string;
}

/**
 * Replaces Firestore onSnapshot listeners: a dedicated connection LISTENs on
 * "cs3_events" (published by cs3.notify_change()) and hands each change to
 * `onChange`, which server.ts pipes into the /api/events SSE stream.
 * Reconnects with capped exponential backoff; returns a stop() function.
 */
export function startPgEventBridge(onChange: (e: PgChangeEvent) => void): () => void {
  if (!isPostgresEnabled()) return () => {};

  let stopped = false;
  let client: Client | null = null;
  let attempt = 0;
  let timer: NodeJS.Timeout | null = null;

  const scheduleReconnect = () => {
    if (stopped || timer) return;
    const delay = Math.min(30_000, 500 * 2 ** attempt++);
    console.warn(`[pg-events] reconnecting in ${delay}ms`);
    timer = setTimeout(() => {
      timer = null;
      void connect();
    }, delay);
  };

  const connect = async () => {
    if (stopped) return;
    const c = new Client({ connectionString: process.env.DATABASE_URL, application_name: 'cs3-console-listen' });
    client = c;
    c.on('error', (err) => {
      console.error('[pg-events] connection error:', err.message);
      c.removeAllListeners();
      c.end().catch(() => {});
      scheduleReconnect();
    });
    c.on('end', () => scheduleReconnect());
    c.on('notification', (msg) => {
      if (msg.channel !== PG_EVENT_CHANNEL || !msg.payload) return;
      try {
        onChange(JSON.parse(msg.payload) as PgChangeEvent);
      } catch (err) {
        console.error('[pg-events] bad payload:', (err as Error).message);
      }
    });
    try {
      await c.connect();
      await c.query(`LISTEN ${PG_EVENT_CHANNEL}`);
      attempt = 0;
      console.log('[pg-events] LISTEN cs3_events active');
    } catch (err) {
      console.error('[pg-events] connect failed:', (err as Error).message);
      c.removeAllListeners();
      c.end().catch(() => {});
      scheduleReconnect();
    }
  };

  void connect();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (client) {
      client.removeAllListeners();
      client.end().catch(() => {});
    }
  };
}
