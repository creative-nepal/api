import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrgPermissionRequest } from '../../auth/access-control';
import { authorizes } from '../access/authorize';
import type { BusinessScopedRequest } from '../decorators/current-business.decorator';

export const REQUIRE_PERMISSION_KEY = 'REQUIRE_BUSINESS_PERMISSION';

export const RequirePermission = (permissions: OrgPermissionRequest) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);

@Injectable()
export class RequirePermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permissions = this.reflector.getAllAndOverride<
      OrgPermissionRequest | undefined
    >(REQUIRE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!permissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<BusinessScopedRequest>();

    if (!request.business || !request.membership || !request.access) {
      throw new InternalServerErrorException(
        'RequirePermissionGuard requires BusinessAccessGuard to run first',
      );
    }

    const role = this.effectiveRole(request);

    if (!authorizes(role, request.access.orgRoles, permissions)) {
      throw new ForbiddenException('i18n:errors.permission.denied');
    }

    return true;
  }

  private effectiveRole(request: BusinessScopedRequest): string {
    const access = request.access;
    const membershipRole = request.membership?.role ?? '';

    if (!access || access.branchRoles.size === 0) {
      return membershipRole;
    }

    const raw = request.headers['x-branch-id'];
    const requested = Array.isArray(raw) ? raw[0] : raw;

    const branchId = requested ?? request.branch?.id ?? access.defaultBranchId;

    if (branchId) {
      return access.branchRoles.get(branchId) ?? membershipRole;
    }

    return membershipRole;
  }
}
