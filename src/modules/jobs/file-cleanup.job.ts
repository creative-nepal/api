import { Injectable } from '@nestjs/common';
import { FilesService } from '../files/files.service';
import type { JobDetail } from './job-runner.service';

const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FileCleanupJob {
  static readonly NAME = 'file-cleanup';

  constructor(private readonly files: FilesService) {}

  async run(): Promise<JobDetail> {
    const pruned = await this.files.pruneAbandoned(
      new Date(Date.now() - ABANDONED_AFTER_MS),
    );

    return { pruned };
  }
}
