import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { PinoLogger } from 'nestjs-pino';
import { I18N_PREFIX } from '../../i18n/i18n.constants';
import type { Request, Response } from 'express';

type RequestWithId = Request & { id?: string };

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly i18n: I18nService,
  ) {
    this.logger.setContext(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const status: number =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const isServerError = status >= 500;
    const requestId = request.id ?? '';

    if (isServerError) {
      this.logger.error(
        {
          err: exception,
          method: request.method,
          url: request.url,
          status,
          requestId,
        },
        'Unhandled server error',
      );
    } else {
      this.logger.debug(
        { method: request.method, url: request.url, status, requestId },
        'Request failed',
      );
    }

    const translated = this.translate(message, host);

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      ...(typeof translated === 'string'
        ? { message: translated }
        : (translated as Record<string, unknown>)),
    });
  }

  private translate(message: unknown, host: ArgumentsHost): unknown {
    const lang = I18nContext.current(host)?.lang;

    const lookup = (key: string): string => String(this.i18n.t(key, { lang }));

    const render = (value: unknown, args: Record<string, unknown>): unknown => {
      if (typeof value !== 'string' || !value.startsWith(I18N_PREFIX)) {
        return value;
      }

      return lookup(value.slice(I18N_PREFIX.length)).replace(
        /\{(\w+)\}/g,
        (match, name: string) => {
          if (!(name in args)) {
            return match;
          }

          const arg = args[name];

          return typeof arg === 'string' && arg.startsWith(I18N_PREFIX)
            ? lookup(arg.slice(I18N_PREFIX.length))
            : String(arg);
        },
      );
    };

    if (typeof message === 'string') {
      return render(message, {});
    }

    if (!message || typeof message !== 'object' || !('message' in message)) {
      return message;
    }

    const args = message as Record<string, unknown>;
    const inner = args.message;

    if (Array.isArray(inner)) {
      return { ...args, message: inner.map((item) => render(item, args)) };
    }

    return { ...args, message: render(inner, args) };
  }
}
