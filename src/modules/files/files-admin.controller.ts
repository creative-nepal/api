import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import { CurrentUser, type CurrentUserType } from '../../auth';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { StoredFile } from '../../database/schema';
import { CreateUploadDto, ListFilesQueryDto } from './dto/files.dto';
import type { UploadTicket } from './files.service';
import { FilesService } from './files.service';

@Controller({ path: 'platform/files', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class FilesAdminController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @UserHasPermission({ permissions: { content: ['update'] } })
  async createUpload(
    @Body() dto: CreateUploadDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<UploadTicket> {
    return this.files.createUpload(null, dto, currentUser.id);
  }

  @Post(':fileId/complete')
  @UserHasPermission({ permissions: { content: ['update'] } })
  async complete(@Param('fileId') fileId: string): Promise<StoredFile> {
    return this.files.complete(null, fileId);
  }

  @Get()
  @UserHasPermission({ permissions: { content: ['update'] } })
  async list(
    @Query() query: ListFilesQueryDto,
  ): Promise<PaginatedResult<StoredFile>> {
    return this.files.list(null, query.limit, query.offset, query.purpose);
  }

  @Get(':fileId/download')
  @UserHasPermission({ permissions: { content: ['update'] } })
  async download(
    @Param('fileId') fileId: string,
  ): Promise<{ url: string; expiresInSeconds: number | null }> {
    return this.files.downloadUrl(null, fileId);
  }

  @Delete(':fileId')
  @UserHasPermission({ permissions: { content: ['delete'] } })
  async remove(
    @Param('fileId') fileId: string,
  ): Promise<{ id: string; removed: true }> {
    await this.files.remove(null, fileId);
    return { id: fileId, removed: true };
  }
}
