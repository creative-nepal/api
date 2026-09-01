import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppLogger } from './common/logging/app-logger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppConfigService } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });

  const logger = new AppLogger(app.get(PinoLogger));
  app.useLogger(logger);

  const config = app.get(AppConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(app.get(HttpExceptionFilter));
  app.enableShutdownHooks();

  await app.listen(config.port);
  logger.log(`Application listening on port ${config.port}`, 'Bootstrap');
}

void bootstrap();
