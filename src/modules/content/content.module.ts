import { Module } from '@nestjs/common';
import { ContentAdminController } from './content-admin.controller';
import { ContentRevalidationService } from './content-revalidation.service';
import { ContentController } from './content.controller';
import { ContentRepository } from './content.repository';
import { ContentService } from './content.service';

@Module({
  controllers: [ContentController, ContentAdminController],
  providers: [ContentService, ContentRepository, ContentRevalidationService],
  exports: [ContentService],
})
export class ContentModule {}
