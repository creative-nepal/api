import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import { CurrentUser, type CurrentUserType } from '../../auth';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import {
  ListEmailsQueryDto,
  ListJobRunsQueryDto,
  UpdateJobScheduleDto,
} from './dto/jobs.dto';
import type {
  EmailOutboxRow,
  JobRun,
  JobSchedule,
} from '../../database/schema';
import { EmailOutboxRepository } from '../../email/email-outbox.repository';
import type { NotificationView } from '../notifications/notifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JobRunnerService } from './job-runner.service';
import { JobSchedulesService } from './job-schedules.service';
import { JobsRegistry } from './jobs.registry';

interface JobSummary {
  name: string;
  cronExpression: string;
  enabled: boolean;
  lastRun: JobRun | null;
}

@Controller({ path: 'platform', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class JobsController {
  constructor(
    private readonly registry: JobsRegistry,
    private readonly schedules: JobSchedulesService,
    private readonly runner: JobRunnerService,
    private readonly outbox: EmailOutboxRepository,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('jobs')
  @UserHasPermission({ permissions: { business: ['list-all'] } })
  async listJobs(): Promise<JobSummary[]> {
    const schedules = new Map(
      (await this.schedules.list()).map((row) => [row.name, row]),
    );

    return Promise.all(
      this.registry.list().map(async (job) => {
        const schedule = schedules.get(job.name);

        return {
          name: job.name,
          cronExpression: schedule?.cronExpression ?? job.defaultCron,
          enabled: schedule?.enabled ?? true,
          lastRun: (await this.runner.lastRunFor(job.name)) ?? null,
        };
      }),
    );
  }

  @Patch('jobs/:name/schedule')
  @UserHasPermission({ permissions: { business: ['suspend'] } })
  async updateSchedule(
    @Param('name') name: string,
    @Body() dto: UpdateJobScheduleDto,
  ): Promise<JobSchedule> {
    return this.schedules.update(name, dto);
  }

  @Get('jobs/runs')
  @UserHasPermission({ permissions: { business: ['list-all'] } })
  async listRuns(
    @Query() query: ListJobRunsQueryDto,
  ): Promise<PaginatedResult<JobRun>> {
    const { rows, total } = await this.runner.list(
      query.limit,
      query.offset,
      query.name,
    );

    return { data: rows, total, limit: query.limit, offset: query.offset };
  }

  @Post('jobs/:name/run')
  @UserHasPermission({ permissions: { business: ['suspend'] } })
  async runNow(@Param('name') name: string): Promise<JobRun> {
    const job = this.registry.get(name);

    if (!job) {
      throw new BadRequestException({
        message: 'i18n:errors.job.unknown',
        name,
      });
    }

    if (await this.runner.isRunning(name)) {
      throw new BadRequestException({
        message: 'i18n:errors.job.alreadyRunning',
        name,
      });
    }

    return this.runner.run(name, 'manual', () => job.run());
  }

  @Get('emails')
  @UserHasPermission({ permissions: { business: ['list-all'] } })
  async listEmails(
    @Query() query: ListEmailsQueryDto,
  ): Promise<PaginatedResult<EmailOutboxRow>> {
    const { rows, total } = await this.outbox.list(
      query.limit,
      query.offset,
      query.status,
    );

    return { data: rows, total, limit: query.limit, offset: query.offset };
  }

  @Post('emails/:id/retry')
  @UserHasPermission({ permissions: { business: ['suspend'] } })
  async retryEmail(@Param('id') id: string): Promise<EmailOutboxRow> {
    const row = await this.outbox.requeue(id);

    if (!row) {
      throw new BadRequestException({
        message: 'i18n:errors.job.emailNotFound',
        id,
      });
    }

    return row;
  }

  @Get('notifications')
  @UserHasPermission({ permissions: { business: ['list-all'] } })
  async listPlatformNotifications(
    @CurrentUser() currentUser: CurrentUserType,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<NotificationView>> {
    return this.notifications.list(
      null,
      currentUser.id,
      query.limit,
      query.offset,
    );
  }

  @Post('notifications/read-all')
  @UserHasPermission({ permissions: { business: ['list-all'] } })
  async markPlatformRead(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<{ marked: number }> {
    return {
      marked: await this.notifications.markAllRead(null, currentUser.id),
    };
  }
}
