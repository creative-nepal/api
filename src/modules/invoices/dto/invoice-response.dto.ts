import { Exclude, Expose } from 'class-transformer';
import type { BusinessInvoice } from '../../../database/schema';
import { toBikramSambat } from '../fiscal-year';

@Exclude()
export class InvoiceResponseDto {
  @Expose() id: string;
  @Expose() businessId: string;
  @Expose() orderId: string | null;
  @Expose() invoiceNumber: number;
  @Expose() fiscalYear: string;
  @Expose() customerId: string | null;
  @Expose() customerName: string | null;
  @Expose() customerPan: string | null;
  @Expose() subtotalCents: number;
  @Expose() discountCents: number;
  @Expose() serviceChargeCents: number;
  @Expose() vatCents: number;
  @Expose() totalCents: number;
  @Expose() status: string;
  @Expose() printedCount: number;
  @Expose() cbmsStatus: string | null;
  @Expose() creditNoteForInvoiceId: string | null;
  @Expose() createdAt: Date;
  @Expose() issuedAtBs: string;

  constructor(invoice: BusinessInvoice) {
    this.id = invoice.id;
    this.businessId = invoice.businessId;
    this.orderId = invoice.orderId;
    this.invoiceNumber = invoice.invoiceNumber;
    this.fiscalYear = invoice.fiscalYear;
    this.customerId = invoice.customerId;
    this.customerName = invoice.customerName;
    this.customerPan = invoice.customerPan;
    this.subtotalCents = invoice.subtotalCents;
    this.discountCents = invoice.discountCents;
    this.serviceChargeCents = invoice.serviceChargeCents;
    this.vatCents = invoice.vatCents;
    this.totalCents = invoice.totalCents;
    this.status = invoice.status;
    this.printedCount = invoice.printedCount;
    this.cbmsStatus = invoice.cbmsStatus;
    this.creditNoteForInvoiceId = invoice.creditNoteForInvoiceId;
    this.createdAt = invoice.createdAt;
    this.issuedAtBs = toBikramSambat(invoice.createdAt).formatted;
  }
}
