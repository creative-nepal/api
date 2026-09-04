import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import { AccessContextService } from '../access/access-context.service';
import type { BusinessScopedRequest } from '../decorators/current-business.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly accessContext: AccessContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BusinessScopedRequest>();

    const userId = request.session?.user?.id;

    if (!userId) {
      throw new UnauthorizedException();
    }

    const businessId = this.resolveBusinessId(request);

    const [row] = await this.db
      .select({
        business: schema.businesses,
        membership: schema.member,
      })
      .from(schema.businesses)
      .innerJoin(
        schema.member,
        and(
          eq(schema.member.organizationId, schema.businesses.organizationId),
          eq(schema.member.userId, userId),
        ),
      )
      .where(eq(schema.businesses.id, businessId))
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        message: 'i18n:errors.business.notFound',
        businessId,
      });
    }

    if (
      row.business.status !== 'active' &&
      !SAFE_METHODS.has(request.method.toUpperCase())
    ) {
      throw new ForbiddenException({
        message: 'i18n:errors.business.inactive',
        businessId,
        status: `i18n:common.status.${row.business.status}`,
      });
    }

    request.business = row.business;
    request.membership = row.membership;

    if (userId) {
      request.access = await this.accessContext.resolve(row.business, userId);
    }

    return true;
  }

  private resolveBusinessId(request: BusinessScopedRequest): string {
    const rawHeader = request.headers['x-business-id'];
    const headerId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const paramId = request.params?.businessId;

    if (headerId && paramId && headerId !== paramId) {
      throw new BadRequestException('i18n:errors.business.idMismatch');
    }

    const businessId = paramId ?? headerId;

    if (!businessId) {
      throw new BadRequestException('i18n:errors.business.idRequired');
    }

    return businessId;
  }
}
