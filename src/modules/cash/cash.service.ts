import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
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
  BusinessInvoice,
  CashMovement,
  CashSession,
  InvoicePayment,
  NewInvoicePayment,
} from '../../database/schema';
import { InvoicesService } from '../invoices/invoices.service';
import {
  CashRepository,
  type ListCashSessionsFilters,
  type MethodTotal,
} from './cash.repository';
import { expectedCashCents, varianceCents } from './till-arithmetic';
import type {
  CashMovementDto,
  CloseCashSessionDto,
  OpenCashSessionDto,
  PaymentDto,
} from './dto/cash.dto';

export interface CashSessionSummary {
  session: CashSession;
  methodTotals: MethodTotal[];
  cashSalesCents: number;
  paidInCents: number;
  paidOutCents: number;
  expectedCashCents: number;
  movements: CashMovement[];
}

@Injectable()
export class CashService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly cashRepository: CashRepository,
    private readonly invoicesService: InvoicesService,
  ) {}

  async open(
    businessId: string,
    branchId: string,
    dto: OpenCashSessionDto,
    actorUserId: string,
  ): Promise<CashSession> {
    const alreadyOpen = await this.cashRepository.findOpenSession(
      businessId,
      branchId,
    );

    if (alreadyOpen) {
      throw new ConflictException('i18n:errors.cash.sessionAlreadyOpen');
    }

    return this.cashRepository.insertSession({
      id: randomUUID(),
      businessId,
      branchId,
      status: 'open',
      openingFloatCents: dto.openingFloatCents,
      openedByUserId: actorUserId,
      note: dto.note ?? null,
    });
  }

  async list(
    filters: ListCashSessionsFilters,
  ): Promise<PaginatedResult<CashSession>> {
    const [data, total] = await Promise.all([
      this.cashRepository.findManySessions(filters),
      this.cashRepository.countSessions(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async current(
    businessId: string,
    branchId: string,
  ): Promise<CashSessionSummary | null> {
    const session = await this.cashRepository.findOpenSession(
      businessId,
      branchId,
    );

    return session ? this.summarise(session) : null;
  }

  async getById(businessId: string, id: string): Promise<CashSessionSummary> {
    return this.summarise(await this.requireSession(businessId, id));
  }

  async addMovement(
    businessId: string,
    sessionId: string,
    dto: CashMovementDto,
    actorUserId: string,
  ): Promise<CashMovement> {
    const session = await this.requireSession(businessId, sessionId);

    if (session.status !== 'open') {
      throw new ConflictException('i18n:errors.cash.sessionClosed');
    }

    return this.cashRepository.insertMovement({
      id: randomUUID(),
      businessId,
      cashSessionId: sessionId,
      direction: dto.direction,
      amountCents: dto.amountCents,
      reason: dto.reason,
      actorUserId,
    });
  }

  async close(
    businessId: string,
    sessionId: string,
    dto: CloseCashSessionDto,
    actorUserId: string,
  ): Promise<CashSessionSummary> {
    const session = await this.requireSession(businessId, sessionId);

    if (session.status !== 'open') {
      throw new ConflictException('i18n:errors.cash.sessionClosed');
    }

    const summary = await this.summarise(session);

    const closed = await this.cashRepository.closeSession(
      businessId,
      sessionId,
      {
        countedCashCents: dto.countedCashCents,
        expectedCashCents: summary.expectedCashCents,
        varianceCents: varianceCents(
          dto.countedCashCents,
          summary.expectedCashCents,
        ),
        closedByUserId: actorUserId,
        note: dto.note ?? null,
      },
    );

    if (!closed) {
      throw new ConflictException('i18n:errors.cash.sessionClosed');
    }

    return { ...summary, session: closed };
  }

  async recordPayments(
    executor: DatabaseExecutor,
    params: {
      businessId: string;
      branchId: string;
      invoice: BusinessInvoice;
      payments: PaymentDto[];
      actorUserId: string | null;
    },
  ): Promise<InvoicePayment[]> {
    const { businessId, branchId, invoice, payments, actorUserId } = params;

    const tendered = payments.reduce(
      (total, payment) => total + payment.amountCents,
      0,
    );

    const alreadyPaid = await this.cashRepository.paidTotalForInvoice(
      executor,
      businessId,
      invoice.id,
    );

    if (alreadyPaid + tendered > invoice.totalCents) {
      throw new BadRequestException({
        message: 'i18n:errors.cash.overTender',
        due: invoice.totalCents - alreadyPaid,
      });
    }

    const session = await this.cashRepository.findOpenSession(
      businessId,
      branchId,
    );

    const takesCash = payments.some((payment) => payment.method === 'cash');

    if (takesCash && !session) {
      throw new BadRequestException('i18n:errors.cash.noOpenSession');
    }

    return this.cashRepository.insertPayments(
      executor,
      payments.map<NewInvoicePayment>((payment) => ({
        id: randomUUID(),
        businessId,
        branchId,
        invoiceId: invoice.id,
        cashSessionId: session?.id ?? null,
        method: payment.method,
        amountCents: payment.amountCents,
        reference: payment.reference ?? null,
        actorUserId,
      })),
    );
  }

  async settleInvoice(
    businessId: string,
    branchId: string,
    invoiceId: string,
    payments: PaymentDto[],
    actorUserId: string,
  ): Promise<InvoicePayment[]> {
    const invoice = await this.invoicesService.getById(businessId, invoiceId);

    return this.db.transaction((tx) =>
      this.recordPayments(tx, {
        businessId,
        branchId,
        invoice,
        payments,
        actorUserId,
      }),
    );
  }

  async paymentsForInvoice(
    businessId: string,
    invoiceId: string,
  ): Promise<InvoicePayment[]> {
    return this.cashRepository.findPaymentsForInvoice(businessId, invoiceId);
  }

  private async summarise(session: CashSession): Promise<CashSessionSummary> {
    const [methodTotals, movementTotals, movements] = await Promise.all([
      this.cashRepository.methodTotalsForSession(session.id),
      this.cashRepository.movementTotals(session.id),
      this.cashRepository.findMovements(session.id),
    ]);

    const cashSalesCents =
      methodTotals.find((total) => total.method === 'cash')?.amountCents ?? 0;

    const expected = expectedCashCents({
      openingFloatCents: session.openingFloatCents,
      cashSalesCents,
      paidInCents: movementTotals.paidInCents,
      paidOutCents: movementTotals.paidOutCents,
    });

    return {
      session,
      methodTotals,
      cashSalesCents,
      paidInCents: movementTotals.paidInCents,
      paidOutCents: movementTotals.paidOutCents,
      expectedCashCents: expected,
      movements,
    };
  }

  private async requireSession(
    businessId: string,
    id: string,
  ): Promise<CashSession> {
    const found = await this.cashRepository.findSessionById(businessId, id);

    if (!found) {
      throw new NotFoundException({
        message: 'i18n:errors.cash.sessionNotFound',
        sessionId: id,
      });
    }

    return found;
  }
}
