import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser, type CurrentUserType } from '../../auth';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Business, StoredFile } from '../../database/schema';
import { CreateUploadDto, ListFilesQueryDto } from './dto/files.dto';
import type { UploadTicket } from './files.service';
import { FilesService } from './files.service';

@Controller({ path: 'businesses/:businessId/files', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @RequirePermission({ order: ['create'] })
  async createUpload(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateUploadDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<UploadTicket> {
    return this.files.createUpload(business.id, dto, currentUser.id);
  }

  @Post(':fileId/complete')
  @RequirePermission({ order: ['create'] })
  async complete(
    @CurrentBusiness() business: Business,
    @Param('fileId') fileId: string,
  ): Promise<StoredFile> {
    return this.files.complete(business.id, fileId);
  }

  @Get()
  @RequirePermission({ order: ['create'] })
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListFilesQueryDto,
  ): Promise<PaginatedResult<StoredFile>> {
    return this.files.list(
      business.id,
      query.limit,
      query.offset,
      query.purpose,
    );
  }

  @Get(':fileId/download')
  @RequirePermission({ order: ['create'] })
  async download(
    @CurrentBusiness() business: Business,
    @Param('fileId') fileId: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    return this.files.downloadUrl(business.id, fileId);
  }

  @Delete(':fileId')
  @RequirePermission({ product: ['delete'] })
  async remove(
    @CurrentBusiness() business: Business,
    @Param('fileId') fileId: string,
  ): Promise<{ id: string; removed: true }> {
    await this.files.remove(business.id, fileId);
    return { id: fileId, removed: true };
  }
}
