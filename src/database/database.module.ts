import { Global, Module } from '@nestjs/common';
import { getDb } from './client';
import { DRIZZLE } from './database.constants';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: getDb,
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
