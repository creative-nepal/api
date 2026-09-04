import { Module } from '@nestjs/common';
import { RolesCoreModule } from '../roles/roles-core.module';
import { BranchRolesService } from './branch-roles.service';
import { SettingsService } from './settings.service';

@Module({
  imports: [RolesCoreModule],
  providers: [SettingsService, BranchRolesService],
  exports: [SettingsService, BranchRolesService],
})
export class SettingsCoreModule {}
