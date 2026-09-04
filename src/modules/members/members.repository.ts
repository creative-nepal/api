import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, count, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import type { SortDirection } from '../../common/dto/list-query.dto';
import { resolveOrderBy } from '../../common/repository/sorting';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';

const SORTABLE = {
  role: schema.member.role,
  createdAt: schema.member.createdAt,
  name: schema.user.name,
  email: schema.user.email,
};

export interface MemberRow {
  memberId: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  joinedAt: Date;
}

export interface ListMembersOptions {
  organizationId: string;
  search?: string;
  role?: string;
  limit: number;
  offset: number;
  sortBy?: string;
  sortDirection: SortDirection;
}

@Injectable()
export class MembersRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findMany(
    options: ListMembersOptions,
  ): Promise<{ rows: MemberRow[]; total: number }> {
    const where = this.buildWhere(options);

    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          memberId: schema.member.id,
          userId: schema.member.userId,
          role: schema.member.role,
          name: schema.user.name,
          email: schema.user.email,
          joinedAt: schema.member.createdAt,
        })
        .from(schema.member)
        .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
        .where(where)
        .orderBy(
          resolveOrderBy(
            SORTABLE,
            options.sortBy,
            options.sortDirection,
            schema.member.createdAt,
          ),
        )
        .limit(options.limit)
        .offset(options.offset),
      this.db
        .select({ value: count() })
        .from(schema.member)
        .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
        .where(where),
    ]);

    return { rows, total: total?.value ?? 0 };
  }

  async findMemberById(
    organizationId: string,
    memberId: string,
  ): Promise<MemberRow | undefined> {
    const [row] = await this.db
      .select({
        memberId: schema.member.id,
        userId: schema.member.userId,
        role: schema.member.role,
        name: schema.user.name,
        email: schema.user.email,
        joinedAt: schema.member.createdAt,
      })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
      .where(
        and(
          eq(schema.member.organizationId, organizationId),
          eq(schema.member.id, memberId),
        ),
      )
      .limit(1);

    return row;
  }

  /** Branch ids each of these users is explicitly assigned to. */
  async branchesForUsers(
    businessId: string,
    userIds: string[],
  ): Promise<Map<string, string[]>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        userId: schema.teamMember.userId,
        branchId: schema.branches.id,
      })
      .from(schema.teamMember)
      .innerJoin(schema.team, eq(schema.team.id, schema.teamMember.teamId))
      .innerJoin(schema.branches, eq(schema.branches.teamId, schema.team.id))
      .where(
        and(
          eq(schema.branches.businessId, businessId),
          inArray(schema.teamMember.userId, userIds),
        ),
      );

    const byUser = new Map<string, string[]>();

    for (const row of rows) {
      byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.branchId]);
    }

    return byUser;
  }

  async ensureTeamForBranch(
    executor: DatabaseExecutor,
    organizationId: string,
    branchId: string,
    branchName: string,
    existingTeamId: string | null,
  ): Promise<string> {
    if (existingTeamId) {
      return existingTeamId;
    }

    const teamId = randomUUID();
    const now = new Date();

    await executor
      .insert(schema.team)
      .values({ id: teamId, name: branchName, organizationId, createdAt: now });

    await executor
      .update(schema.branches)
      .set({ teamId })
      .where(eq(schema.branches.id, branchId));

    return teamId;
  }

  async replaceTeamMemberships(
    executor: DatabaseExecutor,
    userId: string,
    businessTeamIds: string[],
    keepTeamIds: string[],
  ): Promise<void> {
    if (businessTeamIds.length > 0) {
      await executor
        .delete(schema.teamMember)
        .where(
          and(
            eq(schema.teamMember.userId, userId),
            inArray(schema.teamMember.teamId, businessTeamIds),
          ),
        );
    }

    if (keepTeamIds.length === 0) {
      return;
    }

    await executor.insert(schema.teamMember).values(
      keepTeamIds.map((teamId) => ({
        id: randomUUID(),
        teamId,
        userId,
        createdAt: new Date(),
      })),
    );
  }

  private buildWhere(options: ListMembersOptions): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.member.organizationId, options.organizationId),
    ];

    if (options.role) {
      conditions.push(eq(schema.member.role, options.role));
    }

    if (options.search) {
      const term = `%${options.search}%`;
      const match = or(
        ilike(schema.user.name, term),
        ilike(schema.user.email, term),
      );

      if (match) {
        conditions.push(match);
      }
    }

    return and(...conditions);
  }
}
