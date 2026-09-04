import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../auth/auth.config';
import type { OrgPermissionRequest } from '../../auth/access-control';
import { and, eq } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import { composePermissions, satisfies } from '../../modules/roles/permissions';
import type { BusinessScopedRequest } from '../decorators/current-business.decorator';

export const REQUIRE_PERMISSION_KEY = 'REQUIRE_BUSINESS_PERMISSION';

export const RequirePermission = (permissions: OrgPermissionRequest) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);

@Injectable()
export class RequirePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectDatabase() private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<
      OrgPermissionRequest | undefined
    >(REQUIRE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!permissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<BusinessScopedRequest>();

    const business = request.business;

    if (!business) {
      throw new InternalServerErrorException(
        'RequirePermissionGuard requires BusinessAccessGuard to run first',
      );
    }

    const branchRole = await this.resolveBranchRole(request);

    if (branchRole) {
      const stored = await this.db
        .select({
          role: schema.organizationRole.role,
          permission: schema.organizationRole.permission,
        })
        .from(schema.organizationRole)
        .where(
          eq(schema.organizationRole.organizationId, business.organizationId),
        );

      const granted = composePermissions(branchRole, stored);

      if (!satisfies(granted, permissions)) {
        throw new ForbiddenException('i18n:errors.permission.denied');
      }

      return true;
    }

    const result = await auth.api.hasPermission({
      headers: fromNodeHeaders(request.headers),
      body: {
        organizationId: business.organizationId,
        permissions: permissions,
      },
    });

    if (!result?.success) {
      throw new ForbiddenException('i18n:errors.permission.denied');
    }

    return true;
  }

  /**
   * A per-branch role, when the business uses them and the caller has one for
   * the branch this request targets. The cheap existence check runs first so
   * businesses that never assign branch roles pay one indexed lookup and skip
   * resolving the branch at all.
   */
  private async resolveBranchRole(
    request: BusinessScopedRequest,
  ): Promise<string | null> {
    const business = request.business;
    const userId = request.session?.user?.id;

    if (!business || !userId) {
      return null;
    }

    const [usesBranchRoles] = await this.db
      .select({ id: schema.branchRoles.id })
      .from(schema.branchRoles)
      .where(eq(schema.branchRoles.businessId, business.id))
      .limit(1);

    if (!usesBranchRoles) {
      return null;
    }

    const raw = request.headers['x-branch-id'];
    const requested = Array.isArray(raw) ? raw[0] : raw;

    const [branch] = requested
      ? await this.db
          .select({ id: schema.branches.id })
          .from(schema.branches)
          .where(
            and(
              eq(schema.branches.businessId, business.id),
              eq(schema.branches.id, requested),
            ),
          )
          .limit(1)
      : await this.db
          .select({ id: schema.branches.id })
          .from(schema.branches)
          .where(
            and(
              eq(schema.branches.businessId, business.id),
              eq(schema.branches.isDefault, true),
            ),
          )
          .limit(1);

    if (!branch) {
      return null;
    }

    const [row] = await this.db
      .select({ role: schema.branchRoles.role })
      .from(schema.branchRoles)
      .where(
        and(
          eq(schema.branchRoles.businessId, business.id),
          eq(schema.branchRoles.branchId, branch.id),
          eq(schema.branchRoles.userId, userId),
        ),
      )
      .limit(1);

    return row?.role ?? null;
  }
}
