import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { JobSchedulesService } from './job-schedules.service';

@Injectable()
export class JobsBootstrap implements OnApplicationBootstrap {
  constructor(private readonly schedules: JobSchedulesService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.schedules.seedDefaults();
    await this.schedules.applyAll();
  }
}
