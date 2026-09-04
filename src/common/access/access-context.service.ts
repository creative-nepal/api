import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business } from '../../database/schema';
import type { StoredRoleRow } from '../../modules/roles/permissions';
import { TtlCache } from './ttl-cache';

/**
 * Short on purpose. Writes invalidate explicitly, so within one instance a
 * revoked permission takes effect immediately and this is only a backstop.
 * Across several instances it bounds how long another one may still honour a
 * permission that has just been revoked — a deployment that cannot accept
 * even that window needs shared invalidation (Redis pub/sub), not a lower
 * number here.
 */
const TTL_MS = 10_000;

export interface BusinessAccessShape {
  usesBranchScoping: boolean;
  usesBranchRoles: boolean;
  defaultBranchId: string | null;
}

export interface ResolvedAccess {
  orgRoles: StoredRoleRow[];
  /** null means unrestricted. */
  allowedBranchIds: string[] | null;
  branchRoles: Map<string, string>;
  /** Used when a request carries no X-Branch-Id, matching BranchScopeGuard. */
  defaultBranchId: string | null;
}

/**
 * Everything the guard stack needs about a caller, resolved once per request.
 *
 * The two caches exist because these reads sit on the hot path of every
 * business-scoped request while their contents change only when an owner
 * edits a role or a branch assignment. Both are invalidated explicitly on
 * those writes, so the TTL is a backstop rather than the mechanism.
 */
@Injectable()
export class AccessContextService {
  private readonly orgRoleCache = new TtlCache<StoredRoleRow[]>(TTL_MS);
  private readonly shapeCache = new TtlCache<BusinessAccessShape>(TTL_MS);

  constructor(@InjectDatabase() private readonly db: Database) {}

  invalidateOrganization(organizationId: string): void {
    this.orgRoleCache.invalidate(organizationId);
  }

  invalidateBusiness(businessId: string): void {
    this.shapeCache.invalidate(businessId);
  }

  async resolve(business: Business, userId: string): Promise<ResolvedAccess> {
    const [orgRoles, shape] = await Promise.all([
      this.orgRolesFor(business.organizationId),
      this.shapeFor(business.id),
    ]);

    if (!shape.usesBranchScoping && !shape.usesBranchRoles) {
      return {
        orgRoles,
        allowedBranchIds: null,
        branchRoles: new Map(),
        defaultBranchId: shape.defaultBranchId,
      };
    }

    const [assignments, branchRoles] = await Promise.all([
      shape.usesBranchScoping
        ? this.assignedBranches(business.id, userId)
        : Promise.resolve<string[]>([]),
      shape.usesBranchRoles
        ? this.branchRolesFor(business.id, userId)
        : Promise.resolve(new Map<string, string>()),
    ]);

    return {
      orgRoles,
      allowedBranchIds: assignments.length === 0 ? null : assignments,
      branchRoles,
      defaultBranchId: shape.defaultBranchId,
    };
  }

  private async orgRolesFor(organizationId: string): Promise<StoredRoleRow[]> {
    const cached = this.orgRoleCache.get(organizationId);

    if (cached) {
      return cached;
    }

    const rows = await this.db
      .select({
        role: schema.organizationRole.role,
        permission: schema.organizationRole.permission,
      })
      .from(schema.organizationRole)
      .where(eq(schema.organizationRole.organizationId, organizationId));

    this.orgRoleCache.set(organizationId, rows);

    return rows;
  }

  private async shapeFor(businessId: string): Promise<BusinessAccessShape> {
    const cached = this.shapeCache.get(businessId);

    if (cached) {
      return cached;
    }

    const [[branchRole], [assignment], [defaultBranch]] = await Promise.all([
      this.db
        .select({ id: schema.branchRoles.id })
        .from(schema.branchRoles)
        .where(eq(schema.branchRoles.businessId, businessId))
        .limit(1),
      this.db
        .select({ id: schema.teamMember.id })
        .from(schema.teamMember)
        .innerJoin(schema.team, eq(schema.team.id, schema.teamMember.teamId))
        .innerJoin(schema.branches, eq(schema.branches.teamId, schema.team.id))
        .where(eq(schema.branches.businessId, businessId))
        .limit(1),
      this.db
        .select({ id: schema.branches.id })
        .from(schema.branches)
        .where(
          and(
            eq(schema.branches.businessId, businessId),
            eq(schema.branches.isDefault, true),
          ),
        )
        .limit(1),
    ]);

    const shape: BusinessAccessShape = {
      usesBranchRoles: Boolean(branchRole),
      usesBranchScoping: Boolean(assignment),
      defaultBranchId: defaultBranch?.id ?? null,
    };

    this.shapeCache.set(businessId, shape);

    return shape;
  }

  private async assignedBranches(
    businessId: string,
    userId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ branchId: schema.branches.id })
      .from(schema.teamMember)
      .innerJoin(schema.team, eq(schema.team.id, schema.teamMember.teamId))
      .innerJoin(schema.branches, eq(schema.branches.teamId, schema.team.id))
      .where(
        and(
          eq(schema.branches.businessId, businessId),
          eq(schema.teamMember.userId, userId),
        ),
      );

    return rows.map((row) => row.branchId);
  }

  private async branchRolesFor(
    businessId: string,
    userId: string,
  ): Promise<Map<string, string>> {
    const rows = await this.db
      .select({
        branchId: schema.branchRoles.branchId,
        role: schema.branchRoles.role,
      })
      .from(schema.branchRoles)
      .where(
        and(
          eq(schema.branchRoles.businessId, businessId),
          eq(schema.branchRoles.userId, userId),
        ),
      );

    return new Map(rows.map((row) => [row.branchId, row.role]));
  }
}
