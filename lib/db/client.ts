// WM-03: Singleton pg Pool.
//
// WHY A SINGLETON?
//   Next.js hot-reload in development re-evaluates modules on every
//   change. Without globalThis caching, each reload would create a
//   new pool and leak connections. In production (PM2 cluster mode),
//   each worker gets its own singleton — naturally limited to `max`.
//
// POOL SETTINGS:
//   max: 10        — never exhaust the default 100 PG connections
//   idleTimeout    — release idle clients to free DB resources
//   connectTimeout — fail fast rather than hang on bad credentials

import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new Pool({
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME     ?? 'postgres',
    user:     process.env.DB_USER     ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    max:                    10,
    idleTimeoutMillis:      30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on('error', (err) => {
    console.error('[DB Pool] Idle client error:', err.message);
  });

  return pool;
}

// Re-use pool across hot reloads in dev; always fresh in production
export const db: Pool =
  process.env.NODE_ENV === 'production'
    ? createPool()
    : (globalThis.__pgPool ??= createPool());
