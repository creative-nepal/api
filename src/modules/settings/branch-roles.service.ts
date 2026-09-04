import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type { BranchRole, Business } from '../../database/schema';
import { AccessContextService } from '../../common/access/access-context.service';
import { RolesService } from '../roles/roles.service';

export interface BranchRoleView {
  branchId: string;
  branchName: string;
  userId: string;
  role: string;
}

@Injectable()
export class BranchRolesService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly rolesService: RolesService,
    private readonly accessContext: AccessContextService,
  ) {}

  async businessUsesBranchRoles(businessId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.branchRoles.id })
      .from(schema.branchRoles)
      .where(eq(schema.branchRoles.businessId, businessId))
      .limit(1);

    return Boolean(row);
  }

  async roleFor(
    businessId: string,
    branchId: string,
    userId: string,
  ): Promise<string | null> {
    const [row] = await this.db
      .select({ role: schema.branchRoles.role })
      .from(schema.branchRoles)
      .where(
        and(
          eq(schema.branchRoles.businessId, businessId),
          eq(schema.branchRoles.branchId, branchId),
          eq(schema.branchRoles.userId, userId),
        ),
      )
      .limit(1);

    return row?.role ?? null;
  }

  async listForBusiness(businessId: string): Promise<BranchRoleView[]> {
    const rows = await this.db
      .select({
        branchId: schema.branchRoles.branchId,
        branchName: schema.branches.name,
        userId: schema.branchRoles.userId,
        role: schema.branchRoles.role,
      })
      .from(schema.branchRoles)
      .innerJoin(
        schema.branches,
        eq(schema.branches.id, schema.branchRoles.branchId),
      )
      .where(eq(schema.branchRoles.businessId, businessId));

    return rows;
  }

  async set(
    business: Business,
    branchId: string,
    userId: string,
    role: string,
  ): Promise<BranchRole> {
    await this.rolesService.assertAssignable(business.organizationId, role);

    const [branch] = await this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.businessId, business.id),
          eq(schema.branches.id, branchId),
        ),
      )
      .limit(1);

    if (!branch) {
      throw new NotFoundException({
        message: 'i18n:errors.branch.notFound',
        branchId,
      });
    }

    const [row] = await this.db
      .insert(schema.branchRoles)
      .values({
        id: randomUUID(),
        businessId: business.id,
        branchId,
        userId,
        role,
      })
      .onConflictDoUpdate({
        target: [schema.branchRoles.branchId, schema.branchRoles.userId],
        set: { role },
      })
      .returning();

    this.accessContext.invalidateBusiness(business.id);

    return row;
  }

  async clear(
    businessId: string,
    branchId: string,
    userId: string,
  ): Promise<void> {
    await this.db
      .delete(schema.branchRoles)
      .where(
        and(
          eq(schema.branchRoles.businessId, businessId),
          eq(schema.branchRoles.branchId, branchId),
          eq(schema.branchRoles.userId, userId),
        ),
      );

    this.accessContext.invalidateBusiness(businessId);
  }
}
