import { Injectable } from '@nestjs/common';
import { count, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { SortDirection } from '../../common/dto/list-query.dto';
import {
  resolveOrderBy,
  type SortableColumns,
} from '../../common/repository/sorting';
import { type Database, InjectDatabase, schema } from '../../database';
import type { User } from '../../database/schema';

const SORTABLE: SortableColumns = {
  name: schema.user.name,
  email: schema.user.email,
  createdAt: schema.user.createdAt,
};

export interface FindUsersOptions {
  limit: number;
  offset: number;
  sortBy?: string;
  sortDirection: SortDirection;
  search?: string;
}

@Injectable()
export class UsersRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findById(id: string): Promise<User | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, id))
      .limit(1);
    return row;
  }

  async findMany(
    options: FindUsersOptions,
  ): Promise<{ rows: User[]; total: number }> {
    const where = this.buildWhere(options.search);

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.user)
        .where(where)
        .orderBy(
          resolveOrderBy(
            SORTABLE,
            options.sortBy,
            options.sortDirection,
            schema.user.createdAt,
          ),
        )
        .limit(options.limit)
        .offset(options.offset),
      this.db.select({ value: count() }).from(schema.user).where(where),
    ]);

    return { rows, total: total?.value ?? 0 };
  }

  async updateName(id: string, name: string): Promise<User | undefined> {
    const [row] = await this.db
      .update(schema.user)
      .set({ name })
      .where(eq(schema.user.id, id))
      .returning();
    return row;
  }

  private buildWhere(search: string | undefined): SQL | undefined {
    const term = search?.trim();

    if (!term) {
      return undefined;
    }

    return or(
      ilike(schema.user.name, `%${term}%`),
      ilike(schema.user.email, `%${term}%`),
    );
  }
}
