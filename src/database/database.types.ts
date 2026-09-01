import type { getDb } from './client';

export type Database = ReturnType<typeof getDb>;

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export type DatabaseExecutor = Database | Transaction;
