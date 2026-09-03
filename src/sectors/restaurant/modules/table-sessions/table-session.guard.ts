import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  Business,
  RestaurantTable,
  TableSession,
} from '../../../../database/schema';
import { TableSessionsService } from './table-sessions.service';

export interface TableScopedRequest {
  headers: Record<string, string | string[] | undefined>;
  tableSession?: TableSession;
  table?: RestaurantTable;
  business?: Business;
}

@Injectable()
export class TableSessionGuard implements CanActivate {
  constructor(private readonly tableSessionsService: TableSessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TableScopedRequest>();
    const raw = request.headers['x-table-session'];
    const token = Array.isArray(raw) ? raw[0] : raw;

    if (!token) {
      throw new UnauthorizedException('An X-Table-Session header is required');
    }

    const resolved = await this.tableSessionsService.resolve(token);

    request.tableSession = resolved.session;
    request.table = resolved.table;
    request.business = resolved.business;

    return true;
  }
}

export const CurrentTable = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RestaurantTable => {
    const request = ctx.switchToHttp().getRequest<TableScopedRequest>();
    return request.table as RestaurantTable;
  },
);

export const CurrentTableBusiness = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Business => {
    const request = ctx.switchToHttp().getRequest<TableScopedRequest>();
    return request.business as Business;
  },
);
