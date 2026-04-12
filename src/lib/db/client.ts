import 'server-only';

import postgres, { type Sql } from 'postgres';

import { getDatabaseEnv } from '@/lib/db/env';

declare global {
  // Reuse the connection pool during local HMR so route handlers do not
  // create a new client on every reload.
  var __missionControlDb__: Sql | undefined;
}

function createDatabaseClient(): Sql {
  const { DATABASE_URL } = getDatabaseEnv();

  return postgres(DATABASE_URL, {
    max: process.env.NODE_ENV === 'production' ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
}

export function getDb(): Sql {
  globalThis.__missionControlDb__ ??= createDatabaseClient();
  return globalThis.__missionControlDb__;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  const sql = getDb();
  await sql`select 1`;
  return true;
}
