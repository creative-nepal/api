import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import type { FilePurpose } from '../../database/schema';
import { FilesService } from './files.service';

const PUBLICLY_SERVABLE = new Set<FilePurpose>([
  'content-image',
  'business-logo',
  'product-image',
]);

@Controller({ path: 'public/files', version: '1' })
export class FilesPublicController {
  constructor(private readonly files: FilesService) {}

  @Get(':fileId')
  @AllowAnonymous()
  async serve(
    @Param('fileId') fileId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.files.getByIdUnscoped(fileId);

    if (
      !file ||
      file.status !== 'ready' ||
      !PUBLICLY_SERVABLE.has(file.purpose as FilePurpose)
    ) {
      throw new NotFoundException({
        message: 'i18n:errors.file.notFound',
        fileId,
      });
    }

    const url = await this.files.presignedUrlFor(file);

    response
      .setHeader('Cache-Control', 'public, max-age=240')
      .redirect(302, url);
  }
}
