import { Exclude, Expose } from 'class-transformer';
import type { Order, OrderItem } from '../../../database/schema';
import { InvoiceResponseDto } from '../../invoices/dto/invoice-response.dto';
import type { BusinessInvoice } from '../../../database/schema';

@Exclude()
export class OrderItemResponseDto {
  @Expose() id: string;
  @Expose() productId: string | null;
  @Expose() menuItemId: string | null;
  @Expose() productName: string;
  @Expose() note: string | null;
  @Expose() modifiers: Array<{
    name: string;
    label: string;
    priceDeltaCents: number;
  }>;
  @Expose() quantity: number;
  @Expose() unitPriceCents: number;
  @Expose() discountCents: number;
  @Expose() lineTotalCents: number;
  @Expose() invoiceId: string | null;
  @Expose() batchId: string | null;

  constructor(item: OrderItem) {
    this.id = item.id;
    this.productId = item.productId;
    this.menuItemId = item.menuItemId;
    this.productName = item.productName;
    this.note = item.note;
    this.modifiers = item.modifiers;
    this.invoiceId = item.invoiceId;
    this.batchId = item.batchId;
    this.quantity = Number(item.quantity);
    this.unitPriceCents = item.unitPriceCents;
    this.discountCents = item.discountCents;
    this.lineTotalCents = item.lineTotalCents;
  }
}

@Exclude()
export class OrderResponseDto {
  @Expose() id: string;
  @Expose() businessId: string;
  @Expose() customerId: string | null;
  @Expose() status: string;
  @Expose() tokenNumber: number | null;
  @Expose() promisedAt: Date | null;
  @Expose() tableId: string | null;
  @Expose() source: string;
  @Expose() subtotalCents: number;
  @Expose() channelId: string | null;
  @Expose() channelCommissionCents: number;
  @Expose() discountCents: number;
  @Expose() serviceChargeCents: number;
  @Expose() taxCents: number;
  @Expose() totalCents: number;
  @Expose() sectorData: Record<string, unknown>;
  @Expose() createdAt: Date;
  @Expose() items: OrderItemResponseDto[];
  @Expose() invoice: InvoiceResponseDto | null;

  constructor(
    order: Order,
    items: OrderItem[] = [],
    invoice?: BusinessInvoice | null,
  ) {
    this.id = order.id;
    this.businessId = order.businessId;
    this.customerId = order.customerId;
    this.status = order.status;
    this.tokenNumber = order.tokenNumber;
    this.promisedAt = order.promisedAt;
    this.tableId = order.tableId;
    this.source = order.source;
    this.subtotalCents = order.subtotalCents;
    this.channelId = order.channelId;
    this.channelCommissionCents = order.channelCommissionCents;
    this.discountCents = order.discountCents;
    this.serviceChargeCents = order.serviceChargeCents;
    this.taxCents = order.taxCents;
    this.totalCents = order.totalCents;
    this.sectorData = order.sectorData;
    this.createdAt = order.createdAt;
    this.items = items.map((item) => new OrderItemResponseDto(item));
    this.invoice = invoice ? new InvoiceResponseDto(invoice) : null;
  }
}
