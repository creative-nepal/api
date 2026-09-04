import { Global, Module } from '@nestjs/common';
import { AccessContextService } from './access-context.service';

/**
 * Global because the guard stack runs on nearly every controller; requiring
 * thirty modules to import it would be noise, and it holds no domain logic.
 */
@Global()
@Module({
  providers: [AccessContextService],
  exports: [AccessContextService],
})
export class AccessContextModule {}
