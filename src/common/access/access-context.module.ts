import { Global, Module } from '@nestjs/common';
import { AccessContextService } from './access-context.service';

@Global()
@Module({
  providers: [AccessContextService],
  exports: [AccessContextService],
})
export class AccessContextModule {}
