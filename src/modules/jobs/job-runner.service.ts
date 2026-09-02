import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import { type Database, InjectDatabase, schema } from '../../database';
import type { JobRun } from '../../database/schema';

export type JobDetail = Record<string, unknown>;

@Injectable()
export class JobRunnerService {
  constructor(
    private readonly logger: PinoLogger,
    @InjectDatabase() private readonly db: Database,
  ) {
    this.logger.setContext(JobRunnerService.name);
  }

  async run(
    name: string,
    trigger: 'schedule' | 'manual',
    work: () => Promise<JobDetail>,
  ): Promise<JobRun> {
    const id = randomUUID();
    const startedAt = new Date();

    await this.db
      .insert(schema.jobRuns)
      .values({ id, name, status: 'running', trigger, startedAt });

    try {
      const detail = await work();
      const finishedAt = new Date();

      const [row] = await this.db
        .update(schema.jobRuns)
        .set({
          status: 'succeeded',
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          detail,
        })
        .where(eq(schema.jobRuns.id, id))
        .returning();

      this.logger.info({ job: name, ...detail }, 'Job finished');
      return row;
    } catch (cause) {
      const finishedAt = new Date();
      const message = cause instanceof Error ? cause.message : String(cause);

      const [row] = await this.db
        .update(schema.jobRuns)
        .set({
          status: 'failed',
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          error: message,
        })
        .where(eq(schema.jobRuns.id, id))
        .returning();

      this.logger.error({ job: name, err: cause }, 'Job failed');
      return row;
    }
  }

  async list(
    limit: number,
    offset: number,
    name?: string,
  ): Promise<{ rows: JobRun[]; total: number }> {
    const where = name ? eq(schema.jobRuns.name, name) : undefined;

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.jobRuns)
        .where(where)
        .orderBy(desc(schema.jobRuns.startedAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(schema.jobRuns).where(where),
    ]);

    return { rows, total: total?.value ?? 0 };
  }

  async lastRunFor(name: string): Promise<JobRun | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.jobRuns)
      .where(eq(schema.jobRuns.name, name))
      .orderBy(desc(schema.jobRuns.startedAt))
      .limit(1);

    return row;
  }

  async isRunning(name: string): Promise<boolean> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.jobRuns)
      .where(
        and(
          eq(schema.jobRuns.name, name),
          eq(schema.jobRuns.status, 'running'),
        ),
      );

    return (row?.value ?? 0) > 0;
  }
}
