import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesCoreModule } from './roles-core.module';

@Module({
  imports: [RolesCoreModule],
  controllers: [RolesController],
  exports: [RolesCoreModule],
})
export class RolesModule {}
