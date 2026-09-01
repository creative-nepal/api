import { asc, desc, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { SortDirection } from '../dto/list-query.dto';

export type SortableColumns = Record<string, PgColumn>;

export function resolveOrderBy(
  columns: SortableColumns,
  sortBy: string | undefined,
  direction: SortDirection,
  fallback: PgColumn,
): SQL {
  const column = (sortBy && columns[sortBy]) || fallback;
  return direction === 'asc' ? asc(column) : desc(column);
}
