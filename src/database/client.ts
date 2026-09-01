import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let instance: PostgresJsDatabase<typeof schema> | undefined;
let sqlClient: postgres.Sql | undefined;

const DEFAULT_POOL_SIZE = 10;

const IDLE_TIMEOUT_SECONDS = 20;

const CONNECT_TIMEOUT_SECONDS = 20;

function resolveSsl(url: string): 'require' | undefined {
  if (process.env.DATABASE_SSL === 'false') {
    return undefined;
  }

  if (process.env.DATABASE_SSL === 'true') {
    return 'require';
  }

  if (/[?&]sslmode=(require|verify-full|verify-ca)/.test(url)) {
    return 'require';
  }

  return process.env.NODE_ENV === 'production' ? 'require' : undefined;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!instance) {
    const url = process.env.DATABASE_URL as string;

    sqlClient = postgres(url, {
      max: Number(process.env.DATABASE_POOL_SIZE ?? DEFAULT_POOL_SIZE),
      idle_timeout: IDLE_TIMEOUT_SECONDS,
      connect_timeout: CONNECT_TIMEOUT_SECONDS,
      ssl: resolveSsl(url),
      onnotice: () => {},
    });

    instance = drizzle(sqlClient, { schema });
  }

  return instance;
}

export function getSqlClient(): postgres.Sql {
  if (!sqlClient) {
    getDb();
  }

  return sqlClient as postgres.Sql;
}
