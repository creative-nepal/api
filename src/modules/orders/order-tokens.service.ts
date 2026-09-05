import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { type DatabaseExecutor, schema } from '../../database';

@Injectable()
export class OrderTokensService {
  async next(
    executor: DatabaseExecutor,
    businessId: string,
    branchId: string,
    timezone: string,
  ): Promise<number> {
    const [today] = await executor.execute<{ day: string }>(
      sql`SELECT to_char((NOW() AT TIME ZONE ${timezone})::date, 'YYYY-MM-DD') AS day`,
    );

    const [row] = await executor
      .insert(schema.orderTokenCounters)
      .values({
        businessId,
        branchId,
        businessDate: today.day,
        lastToken: 1,
      })
      .onConflictDoUpdate({
        target: [
          schema.orderTokenCounters.businessId,
          schema.orderTokenCounters.branchId,
          schema.orderTokenCounters.businessDate,
        ],
        set: {
          lastToken: sql`${schema.orderTokenCounters.lastToken} + 1`,
        },
      })
      .returning({ lastToken: schema.orderTokenCounters.lastToken });

    return row.lastToken;
  }
}
