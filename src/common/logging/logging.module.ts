import { randomUUID } from 'node:crypto';
import { Global, Module } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LoggerModule, type Params } from 'nestjs-pino';
import { AppConfigService, ConfigModule } from '../../config';

export const REQUEST_ID_HEADER = 'x-request-id';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.confirmPassword',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.otp',
  'req.body.code',
  'req.body.totpCode',
  'req.body.backupCode',
];

const SILENT_ROUTES = new Set(['/api/health', '/health', '/favicon.ico']);

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      providers: [],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Params => ({
        pinoHttp: {
          level: config.logLevel,

          redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },

          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const inbound = req.headers[REQUEST_ID_HEADER];
            const id =
              (Array.isArray(inbound) ? inbound[0] : inbound) || randomUUID();
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },

          autoLogging: {
            ignore: (req: IncomingMessage) =>
              SILENT_ROUTES.has((req.url ?? '').split('?')[0]),
          },

          customLogLevel: (_req, res, err) => {
            if (err) return 'error';
            if (res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },

          serializers: {
            req: (req: IncomingMessage & { query?: unknown }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
              query: req.query,
              userAgent: req.headers['user-agent'],
              ip:
                req.headers['x-forwarded-for'] ??
                (req as unknown as { ip?: string }).ip,
            }),
            res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
          },

          customProps: (req: IncomingMessage) => ({
            requestId: req.id,
          }),

          transport: config.logPretty
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
        },
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
