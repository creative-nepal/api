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
import type { BusinessScopedRequest } from '../decorators/current-business.decorator';

export const REQUIRE_PERMISSION_KEY = 'REQUIRE_BUSINESS_PERMISSION';

export const RequirePermission = (permissions: OrgPermissionRequest) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);

@Injectable()
export class RequirePermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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
}
