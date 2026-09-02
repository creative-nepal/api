import { Module } from '@nestjs/common';
import { BranchesCoreModule } from './branches-core.module';
import { BranchesController } from './branches.controller';

@Module({
  imports: [BranchesCoreModule],
  controllers: [BranchesController],
  exports: [BranchesCoreModule],
})
export class BranchesModule {}
