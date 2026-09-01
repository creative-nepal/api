import type { LoggerService } from '@nestjs/common';
import type { Logger as PinoLoggerService } from 'nestjs-pino';

const SILENCED_LOG_CONTEXTS = new Set([
  'InstanceLoader',
  'NestFactory',
  'RoutesResolver',
  'RouterExplorer',
  'NestApplication',
]);

export class AppLogger implements LoggerService {
  constructor(private readonly logger: PinoLoggerService) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    const context = optionalParams[optionalParams.length - 1];

    if (typeof context === 'string' && SILENCED_LOG_CONTEXTS.has(context)) {
      return;
    }

    this.logger.log(message, ...optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.error(message, ...optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn(message, ...optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug(message, ...optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.verbose(message, ...optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.fatal(message, ...optionalParams);
  }
}
