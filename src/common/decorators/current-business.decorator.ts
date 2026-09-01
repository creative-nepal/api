import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Business, Member } from '../../database/schema';

export interface BusinessScopedRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string | undefined>;
  session?: { user?: { id: string; role?: string | null } } | null;
  business?: Business;
  membership?: Member;
}

export const CurrentBusiness = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Business => {
    const request = ctx.switchToHttp().getRequest<BusinessScopedRequest>();
    return request.business as Business;
  },
);

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Member => {
    const request = ctx.switchToHttp().getRequest<BusinessScopedRequest>();
    return request.membership as Member;
  },
);
