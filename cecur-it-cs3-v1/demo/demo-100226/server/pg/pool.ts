import type { Pool } from 'pg';

/**
 * Optional PostgreSQL + JSONB persistence layer (replaces Firestore for on-prem /
 * air-gap deployments). Enabled only when CS3_PERSISTENCE=postgres and
 * DATABASE_URL is set; otherwise the console keeps its in-memory + Firestore behaviour.
 * Schema: deployment/docker/postgres/init/*.sql
 */
export function isPostgresEnabled(): boolean {
  return process.env.CS3_PERSISTENCE === 'postgres' && !!process.env.DATABASE_URL;
}

let pool: Pool | null = null;

export async function getPool(): Promise<Pool | null> {
  if (!isPostgresEnabled()) return null;
  if (pool) return pool;
  const { Pool: PgPool } = await import('pg');
  if (pool) return pool;
  pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.CS3_PG_POOL_MAX) || 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: Number(process.env.CS3_PG_STATEMENT_TIMEOUT_MS) || 15_000,
    application_name: 'cs3-console',
  });
  pool.on('error', (err) => console.error('[pg] idle client error:', err.message));
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
