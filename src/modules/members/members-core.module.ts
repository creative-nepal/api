import { Module } from '@nestjs/common';
import { MembersRepository } from './members.repository';
import { MembersService } from './members.service';

@Module({
  providers: [MembersService, MembersRepository],
  exports: [MembersService, MembersRepository],
})
export class MembersCoreModule {}
