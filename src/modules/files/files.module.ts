import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesAdminController } from './files-admin.controller';
import { FilesPublicController } from './files-public.controller';
import { FilesCoreModule } from './files-core.module';

@Module({
  imports: [FilesCoreModule],
  controllers: [FilesController, FilesAdminController, FilesPublicController],
  exports: [FilesCoreModule],
})
export class FilesModule {}
