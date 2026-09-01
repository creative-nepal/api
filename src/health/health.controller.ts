import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { DatabaseHealthIndicator } from './database.health-indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DatabaseHealthIndicator,
  ) {}

  @Get()
  @AllowAnonymous()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.isHealthy('database')]);
  }
}
