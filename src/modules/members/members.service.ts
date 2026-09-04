import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business } from '../../database/schema';
import type {
  ListMembersQueryDto,
  SetMemberBranchesDto,
} from './dto/member.dto';
import { AccessContextService } from '../../common/access/access-context.service';
import { MembersRepository } from './members.repository';

export interface MemberView {
  memberId: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  joinedAt: Date;
  /** Empty means every branch — a restriction is opt-in. */
  branchIds: string[];
  allBranches: boolean;
}

@Injectable()
export class MembersService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly membersRepository: MembersRepository,
    private readonly accessContext: AccessContextService,
  ) {}

  async list(
    business: Business,
    query: ListMembersQueryDto,
  ): Promise<PaginatedResult<MemberView>> {
    const { rows, total } = await this.membersRepository.findMany({
      organizationId: business.organizationId,
      search: query.search,
      role: query.role,
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    });

    const branchesByUser = await this.membersRepository.branchesForUsers(
      business.id,
      rows.map((row) => row.userId),
    );

    const data = rows.map((row) => {
      const branchIds = branchesByUser.get(row.userId) ?? [];

      return {
        ...row,
        branchIds,
        allBranches: branchIds.length === 0,
      };
    });

    const filtered = query.branchId
      ? data.filter(
          (member) =>
            member.allBranches ||
            member.branchIds.includes(query.branchId as string),
        )
      : data;

    return {
      data: filtered,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Branch ids a user may act on, or null when they are unrestricted.
   * Restriction is opt-in: a member with no assignment reaches every branch,
   * which keeps single-branch businesses and existing staff working.
   */
  async allowedBranchIds(
    businessId: string,
    userId: string,
  ): Promise<string[] | null> {
    const byUser = await this.membersRepository.branchesForUsers(businessId, [
      userId,
    ]);

    const branchIds = byUser.get(userId) ?? [];

    return branchIds.length === 0 ? null : branchIds;
  }

  async setBranches(
    business: Business,
    memberId: string,
    dto: SetMemberBranchesDto,
  ): Promise<MemberView> {
    const member = await this.membersRepository.findMemberById(
      business.organizationId,
      memberId,
    );

    if (!member) {
      throw new NotFoundException({
        message: 'i18n:errors.member.notFound',
        memberId,
      });
    }

    const branches = await this.db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.businessId, business.id));

    const unknown = dto.branchIds.filter(
      (branchId) => !branches.some((branch) => branch.id === branchId),
    );

    if (unknown.length > 0) {
      throw new BadRequestException({
        message: 'i18n:errors.member.unknownBranch',
        branchId: unknown[0],
      });
    }

    await this.db.transaction(async (tx) => {
      const teamIds: string[] = [];

      for (const branch of branches) {
        teamIds.push(
          await this.membersRepository.ensureTeamForBranch(
            tx,
            business.organizationId,
            branch.id,
            branch.name,
            branch.teamId,
          ),
        );
      }

      const keep = await tx
        .select({ teamId: schema.branches.teamId })
        .from(schema.branches)
        .where(
          and(
            eq(schema.branches.businessId, business.id),
            inArray(
              schema.branches.id,
              dto.branchIds.length > 0 ? dto.branchIds : ['__none__'],
            ),
            isNotNull(schema.branches.teamId),
          ),
        );

      await this.membersRepository.replaceTeamMemberships(
        tx,
        member.userId,
        teamIds,
        keep
          .map((row) => row.teamId)
          .filter((teamId): teamId is string => teamId !== null),
      );
    });

    this.accessContext.invalidateBusiness(business.id);

    return {
      ...member,
      branchIds: dto.branchIds,
      allBranches: dto.branchIds.length === 0,
    };
  }
}
