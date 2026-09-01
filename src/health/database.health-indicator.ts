import { Injectable } from '@nestjs/common';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import { HealthIndicatorService } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import type { Database } from '../database';
import { InjectDatabase } from '../database';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @InjectDatabase() private readonly db: Database,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.db.execute(sql`SELECT 1`);
      return indicator.up();
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }
}
