import { Module } from '@nestjs/common';
import { MembersCoreModule } from '../members/members-core.module';
import { BranchesRepository } from './branches.repository';
import { BranchesService } from './branches.service';

/**
 * BranchScopeGuard resolves the branch and then checks the caller is allowed
 * on it, so MembersCoreModule is re-exported here: every module that imports
 * this one for the guard gets both halves without changing its own imports.
 */
@Module({
  imports: [MembersCoreModule],
  providers: [BranchesService, BranchesRepository],
  exports: [BranchesService, BranchesRepository, MembersCoreModule],
})
export class BranchesCoreModule {}
