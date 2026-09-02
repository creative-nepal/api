import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesPlatformController } from './files-platform.controller';
import { FilesPublicController } from './files-public.controller';
import { FilesCoreModule } from './files-core.module';

@Module({
  imports: [FilesCoreModule],
  controllers: [
    FilesController,
    FilesPlatformController,
    FilesPublicController,
  ],
  exports: [FilesCoreModule],
})
export class FilesModule {}
