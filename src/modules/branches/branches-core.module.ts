import { Module } from '@nestjs/common';
import { BranchesRepository } from './branches.repository';
import { BranchesService } from './branches.service';

@Module({
  providers: [BranchesService, BranchesRepository],
  exports: [BranchesService, BranchesRepository],
})
export class BranchesCoreModule {}
