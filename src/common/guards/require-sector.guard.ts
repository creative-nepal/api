import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { SectorKey } from '../../database/schema/sector-keys';
import type { BusinessScopedRequest } from '../decorators/current-business.decorator';

export const REQUIRE_SECTOR_KEY = 'REQUIRE_BUSINESS_SECTOR';

export const RequireSector = (...sectors: SectorKey[]) =>
  SetMetadata(REQUIRE_SECTOR_KEY, sectors);

@Injectable()
export class RequireSectorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const sectors = this.reflector.getAllAndOverride<SectorKey[] | undefined>(
      REQUIRE_SECTOR_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!sectors || sectors.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<BusinessScopedRequest>();
    const business = request.business;

    if (!business) {
      throw new InternalServerErrorException(
        'RequireSectorGuard requires BusinessAccessGuard to run first',
      );
    }

    if (!sectors.includes(business.sector as SectorKey)) {
      throw new ForbiddenException({
        message: 'i18n:errors.business.wrongSector',
        sector: `i18n:common.sector.${business.sector}`,
      });
    }

    return true;
  }
}
