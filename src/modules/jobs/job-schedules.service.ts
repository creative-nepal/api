import { BadRequestException, Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { eq } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import { type Database, InjectDatabase, schema } from '../../database';
import type { JobSchedule } from '../../database/schema';
import { JobRunnerService } from './job-runner.service';
import { JobsRegistry } from './jobs.registry';

@Injectable()
export class JobSchedulesService {
  constructor(
    private readonly logger: PinoLogger,
    @InjectDatabase() private readonly db: Database,
    private readonly registry: JobsRegistry,
    private readonly runner: JobRunnerService,
    private readonly scheduler: SchedulerRegistry,
  ) {
    this.logger.setContext(JobSchedulesService.name);
  }

  async list(): Promise<JobSchedule[]> {
    return this.db.select().from(schema.jobSchedules);
  }

  async seedDefaults(): Promise<void> {
    for (const job of this.registry.list()) {
      await this.db
        .insert(schema.jobSchedules)
        .values({
          name: job.name,
          cronExpression: job.defaultCron,
          enabled: true,
        })
        .onConflictDoNothing();
    }
  }

  async update(
    name: string,
    patch: { cronExpression?: string; enabled?: boolean },
  ): Promise<JobSchedule> {
    if (!this.registry.get(name)) {
      throw new BadRequestException({
        message: 'i18n:errors.job.unknown',
        name,
      });
    }

    if (patch.cronExpression !== undefined) {
      this.assertValidCron(patch.cronExpression);
    }

    const [row] = await this.db
      .update(schema.jobSchedules)
      .set(patch)
      .where(eq(schema.jobSchedules.name, name))
      .returning();

    if (!row) {
      throw new BadRequestException({
        message: 'i18n:errors.job.unknown',
        name,
      });
    }

    this.applyOne(row);

    return row;
  }

  async applyAll(): Promise<void> {
    for (const row of await this.list()) {
      this.applyOne(row);
    }
  }

  private assertValidCron(expression: string): void {
    try {
      new CronJob(expression, () => undefined);
    } catch {
      throw new BadRequestException({
        message: 'i18n:errors.job.invalidCron',
        expression,
      });
    }
  }

  private applyOne(row: JobSchedule): void {
    const job = this.registry.get(row.name);

    if (!job) {
      return;
    }

    if (this.scheduler.doesExist('cron', row.name)) {
      void this.scheduler.getCronJob(row.name).stop();
      this.scheduler.deleteCronJob(row.name);
    }

    if (!row.enabled) {
      this.logger.info({ job: row.name }, 'Job disabled');
      return;
    }

    const cron = new CronJob(row.cronExpression, () => {
      void this.runner
        .isRunning(row.name)
        .then((running) =>
          running
            ? undefined
            : this.runner.run(row.name, 'schedule', () => job.run()),
        );
    });

    this.scheduler.addCronJob(row.name, cron);
    cron.start();

    this.logger.info(
      { job: row.name, cron: row.cronExpression },
      'Job scheduled',
    );
  }
}
