import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  CurrentMembership,
} from '../../common';
import type { Business, Member } from '../../database/schema';
import { WorkspaceService, type WorkspaceView } from './workspace.service';

@Controller({ path: 'businesses/:businessId/workspace', version: '1' })
@UseGuards(BusinessAccessGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  async resolve(
    @CurrentBusiness() business: Business,
    @CurrentMembership() membership: Member,
  ): Promise<WorkspaceView> {
    return this.workspaceService.resolve(business, membership);
  }
}
