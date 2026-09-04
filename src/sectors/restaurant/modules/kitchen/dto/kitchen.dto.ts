import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import {
  KITCHEN_STATUSES,
  type KitchenStatus,
  type KitchenTicket,
} from '../../../../../database/schema';

export class UpdateTicketStatusDto {
  @IsIn(KITCHEN_STATUSES)
  status!: KitchenStatus;
}

export class ListTicketsQueryDto {
  @IsOptional()
  @IsIn(KITCHEN_STATUSES)
  status?: KitchenStatus;

  @IsOptional()
  @IsString()
  station?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  openOnly?: boolean;
}

export interface KitchenTicketLine {
  orderItemId: string;
  name: string;
  quantity: number;
  note: string | null;
  modifiers: Array<{ name: string; label: string }>;
  status: string;
}

export class KitchenTicketResponseDto {
  id: string;
  orderId: string;
  tableId: string | null;
  station: string;
  status: string;
  createdAt: Date;
  items: KitchenTicketLine[];

  constructor(ticket: KitchenTicket, items: KitchenTicketLine[]) {
    this.id = ticket.id;
    this.orderId = ticket.orderId;
    this.tableId = ticket.tableId;
    this.station = ticket.station;
    this.status = ticket.status;
    this.createdAt = ticket.createdAt;
    this.items = items;
  }
}
