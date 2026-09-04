import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersCoreModule } from './members-core.module';

@Module({
  imports: [MembersCoreModule],
  controllers: [MembersController],
})
export class MembersModule {}
