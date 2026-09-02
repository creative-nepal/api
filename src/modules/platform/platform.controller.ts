import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { PlatformAuditLogRow } from './platform.repository';
import { PlatformService } from './platform.service';
import type { PlatformOverview, SectorDescriptor } from './platform.service';

@Controller({ path: 'platform', version: '1' })
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('sectors')
  listSectors(): SectorDescriptor[] {
    return this.platformService.listSectors();
  }

  @Get('overview')
  @UserHasPermission({ permissions: { business: ['list-all'] } })
  async getOverview(): Promise<PlatformOverview> {
    return this.platformService.getOverview();
  }

  @Get('businesses/:businessId/audit-log')
  @UserHasPermission({ permissions: { audit: ['view-all'] } })
  async getAuditLog(
    @Param('businessId') businessId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<PlatformAuditLogRow>> {
    return this.platformService.getAuditLog(
      businessId,
      query.limit,
      query.offset,
    );
  }
}
