import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
} from '../../database';
import type {
  Business,
  BusinessInvoice,
  InvoiceAuditLogRow,
} from '../../database/schema';
import { fiscalYearLabel } from './fiscal-year';
import {
  InvoicesRepository,
  type ListInvoicesFilters,
} from './invoices.repository';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { computeVatCents } from './vat';

export interface IssueInvoiceParams {
  business: Business;
  branchId: string;
  orderId: string | null;
  subtotalCents: number;
  serviceChargeCents?: number;
  customerId?: string | null;
  customerName?: string | null;
  customerPan?: string | null;
  actorUserId?: string | null;
  issuedAt?: Date;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly invoicesRepository: InvoicesRepository,
    private readonly entitlements: EntitlementsService,
  ) {}

  async issue(
    executor: DatabaseExecutor,
    params: IssueInvoiceParams,
  ): Promise<BusinessInvoice> {
    const { business } = params;

    await this.entitlements.assertInvoiceQuotaAvailable(business.id);

    const issuedAt = params.issuedAt ?? new Date();
    const fiscalYear = fiscalYearLabel(issuedAt, business.fiscalYearStartMonth);

    const invoiceNumber = await this.invoicesRepository.nextInvoiceNumber(
      executor,
      business.id,
      params.branchId,
      fiscalYear,
    );

    const serviceChargeCents = params.serviceChargeCents ?? 0;

    const vatCents = computeVatCents(
      params.subtotalCents + serviceChargeCents,
      business.vatRegistered,
    );

    const invoice = await this.invoicesRepository.insertInvoice(executor, {
      id: randomUUID(),
      businessId: business.id,
      branchId: params.branchId,
      orderId: params.orderId,
      invoiceNumber,
      fiscalYear,
      customerId: params.customerId ?? null,
      customerName: params.customerName ?? null,
      customerPan: params.customerPan ?? null,
      subtotalCents: params.subtotalCents,
      serviceChargeCents,
      vatCents,
      totalCents: params.subtotalCents + serviceChargeCents + vatCents,
      status: 'issued',
      printedCount: 0,
      cbmsStatus: business.cbmsRequired ? 'pending' : null,
      issuedByUserId: params.actorUserId ?? null,
    });

    await this.invoicesRepository.appendAuditLog(executor, {
      id: randomUUID(),
      businessId: business.id,
      invoiceId: invoice.id,
      action: 'issued',
      actorUserId: params.actorUserId ?? null,
      metadata: { invoiceNumber, fiscalYear, branchId: params.branchId },
    });

    if (business.cbmsRequired) {
      await this.invoicesRepository.enqueueCbmsPush(executor, {
        id: randomUUID(),
        businessId: business.id,
        invoiceId: invoice.id,
      });
    }

    return invoice;
  }

  async getById(businessId: string, id: string): Promise<BusinessInvoice> {
    const found = await this.invoicesRepository.findById(businessId, id);

    if (!found) {
      throw new NotFoundException({
        message: 'i18n:errors.invoice.notFound',
        invoiceId: id,
      });
    }

    return found;
  }

  async list(
    filters: ListInvoicesFilters,
  ): Promise<PaginatedResult<BusinessInvoice>> {
    const [data, total] = await Promise.all([
      this.invoicesRepository.findMany(filters),
      this.invoicesRepository.countMany(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async getAuditLog(
    businessId: string,
    invoiceId: string,
  ): Promise<InvoiceAuditLogRow[]> {
    await this.getById(businessId, invoiceId);
    return this.invoicesRepository.findAuditLog(businessId, invoiceId);
  }

  async recordPrint(
    businessId: string,
    id: string,
    actorUserId?: string | null,
  ): Promise<BusinessInvoice> {
    const updated = await this.invoicesRepository.incrementPrintedCount(
      businessId,
      id,
    );

    if (!updated) {
      throw new NotFoundException({
        message: 'i18n:errors.invoice.notFound',
        invoiceId: id,
      });
    }

    await this.invoicesRepository.appendAuditLog(this.db, {
      id: randomUUID(),
      businessId,
      invoiceId: id,
      action: 'printed',
      actorUserId: actorUserId ?? null,
      metadata: { printedCount: updated.printedCount },
    });

    return updated;
  }

  async issueCreditNote(
    business: Business,
    originalInvoiceId: string,
    params: {
      subtotalCents?: number;
      reason?: string;
      actorUserId?: string | null;
    },
  ): Promise<BusinessInvoice> {
    const original = await this.getById(business.id, originalInvoiceId);

    if (original.status === 'credit_note') {
      throw new BadRequestException(
        'i18n:errors.invoice.creditNoteOnCreditNote',
      );
    }

    const subtotalCents = params.subtotalCents ?? original.subtotalCents;

    if (subtotalCents <= 0 || subtotalCents > original.subtotalCents) {
      throw new BadRequestException(
        `Credit amount must be between 1 and ${original.subtotalCents} paisa`,
      );
    }

    const issuedAt = new Date();
    const fiscalYear = fiscalYearLabel(issuedAt, business.fiscalYearStartMonth);

    return this.db.transaction(async (tx) => {
      const invoiceNumber = await this.invoicesRepository.nextInvoiceNumber(
        tx,
        business.id,
        original.branchId,
        fiscalYear,
      );

      const vatCents = computeVatCents(subtotalCents, business.vatRegistered);

      const creditNote = await this.invoicesRepository.insertInvoice(tx, {
        id: randomUUID(),
        businessId: business.id,
        branchId: original.branchId,
        orderId: original.orderId,
        invoiceNumber,
        fiscalYear,
        customerId: original.customerId,
        customerName: original.customerName,
        customerPan: original.customerPan,
        subtotalCents,
        vatCents,
        totalCents: subtotalCents + vatCents,
        status: 'credit_note',
        printedCount: 0,
        cbmsStatus: business.cbmsRequired ? 'pending' : null,
        creditNoteForInvoiceId: original.id,
        issuedByUserId: params.actorUserId ?? null,
      });

      await this.invoicesRepository.appendAuditLog(tx, {
        id: randomUUID(),
        businessId: business.id,
        invoiceId: creditNote.id,
        action: 'credit_note_issued',
        actorUserId: params.actorUserId ?? null,
        metadata: {
          creditNoteForInvoiceId: original.id,
          originalInvoiceNumber: original.invoiceNumber,
          reason: params.reason ?? null,
        },
      });

      if (business.cbmsRequired) {
        await this.invoicesRepository.enqueueCbmsPush(tx, {
          id: randomUUID(),
          businessId: business.id,
          invoiceId: creditNote.id,
        });
      }

      return creditNote;
    });
  }
}
