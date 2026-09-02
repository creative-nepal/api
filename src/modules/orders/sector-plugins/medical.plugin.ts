import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../../auth/auth.config';
import { schema } from '../../../database';
import { DRUG_SCHEDULES } from '../../../database/schema';
import type {
  DrugSchedule,
  Product,
  ProductBatch,
  Sector,
} from '../../../database/schema';
import { BatchesRepository } from '../../batches/batches.repository';
import { ProductsRepository } from '../../products/products.repository';
import type { CheckoutItemDto } from '../dto/order-request.dto';
import type {
  CheckoutCommitted,
  CheckoutContext,
  CheckoutLine,
  SectorPlugin,
} from './sector-plugin.interface';

const QUANTITY_SCALE = 3;

function scheduleOf(product: Product | null): DrugSchedule {
  const schedule = product?.sectorData?.schedule;

  return typeof schedule === 'string' &&
    (DRUG_SCHEDULES as readonly string[]).includes(schedule)
    ? (schedule as DrugSchedule)
    : 'otc';
}

function needsPrescription(schedule: DrugSchedule): boolean {
  return schedule === 'prescription' || schedule === 'controlled';
}

@Injectable()
export class MedicalSectorPlugin implements SectorPlugin {
  readonly sector: Sector = 'medical';
  readonly billsOnCreate = true;

  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly batchesRepository: BatchesRepository,
  ) {}

  beforeCreate(): void {}

  async onLineItemAdd(
    context: CheckoutContext,
    item: CheckoutItemDto,
  ): Promise<CheckoutLine[]> {
    if (!item.productId) {
      throw new BadRequestException('productId is required');
    }

    const product = await this.productsRepository.findById(
      context.business.id,
      item.productId,
    );

    if (!product || !product.isActive) {
      throw new NotFoundException(`Product ${item.productId} is unavailable`);
    }

    const candidates = item.batchId
      ? await this.resolveOverriddenBatch(context, item.batchId, product)
      : await this.batchesRepository.findDispensable(
          context.executor,
          context.business.id,
          product.id,
        );

    const lines = await this.allocateFefo(context, product, item, candidates);

    await this.batchesRepository.syncProductStock(
      context.executor,
      context.business.id,
      product.id,
    );

    return lines;
  }

  async beforeCheckout(
    context: CheckoutContext,
    lines: CheckoutLine[],
  ): Promise<void> {
    const schedules = new Set(lines.map((line) => scheduleOf(line.product)));

    const restricted = [...schedules].filter(needsPrescription);

    if (restricted.length === 0) {
      return;
    }

    await this.assertMayDispense(context, restricted);

    if (!context.dto.prescription) {
      throw new BadRequestException('i18n:errors.prescription.required');
    }

    if (schedules.has('controlled') && !context.dto.buyerIdentity) {
      throw new BadRequestException('i18n:errors.prescription.buyerIdRequired');
    }
  }

  async afterCheckout(
    context: CheckoutContext,
    committed: CheckoutCommitted,
  ): Promise<void> {
    const { executor, business } = context;

    const invoice = committed.invoice;

    if (!invoice) {
      throw new InternalServerErrorException(
        'Medical checkout completed without an invoice',
      );
    }

    let prescriptionId: string | null = null;

    if (context.dto.prescription) {
      const [row] = await executor
        .insert(schema.prescriptions)
        .values({
          id: randomUUID(),
          businessId: business.id,
          orderId: committed.order.id,
          doctorName: context.dto.prescription.doctorName,
          patientName: context.dto.prescription.patientName,
          attachmentFileId: context.dto.prescription.attachmentFileId ?? null,
        })
        .returning();
      prescriptionId = row.id;
    }

    const controlledLines = committed.lines.filter(
      (line) => scheduleOf(line.product) === 'controlled',
    );

    if (controlledLines.length > 0) {
      const buyer = context.dto.buyerIdentity;

      await executor.insert(schema.controlledSubstanceRegister).values(
        controlledLines.map((line) => ({
          id: randomUUID(),
          businessId: business.id,
          orderId: committed.order.id,
          invoiceId: invoice.id,
          productId: (line.product as Product).id,
          batchId: line.batchId as string,
          quantity: line.quantity.toFixed(QUANTITY_SCALE),
          buyerName: committed.customer?.name ?? 'Unknown',
          buyerIdType: buyer?.idType ?? 'citizenship',
          buyerIdNumber: buyer?.idNumber ?? '',
          prescriptionId,
          dispensedByUserId: context.actorUserId,
        })),
      );
    }

    if (context.dto.insurance) {
      await executor.insert(schema.insuranceClaims).values({
        id: randomUUID(),
        businessId: business.id,
        orderId: committed.order.id,
        invoiceId: invoice.id,
        provider: context.dto.insurance.provider,
        policyNumber: context.dto.insurance.policyNumber,
        claimedAmountCents:
          context.dto.insurance.claimedAmountCents ?? invoice.totalCents,
        status: 'draft',
      });
    }
  }

  private async assertMayDispense(
    context: CheckoutContext,
    restricted: DrugSchedule[],
  ): Promise<void> {
    const permissions = {
      dispense: restricted.map((schedule) => schedule),
    };

    const result = await auth.api.hasPermission({
      headers: fromNodeHeaders(context.headers),
      body: {
        organizationId: context.business.organizationId,
        permissions: permissions as Record<string, string[]>,
      },
    });

    if (!result?.success) {
      throw new ForbiddenException({
        message: 'i18n:errors.permission.dispenseOnly',
        schedules: restricted.join(' / '),
      });
    }
  }

  private async resolveOverriddenBatch(
    context: CheckoutContext,
    batchId: string,
    product: Product,
  ): Promise<ProductBatch[]> {
    const batch = await this.batchesRepository.findById(
      context.business.id,
      batchId,
    );

    if (!batch || batch.productId !== product.id) {
      throw new NotFoundException(
        `Batch ${batchId} not found for product ${product.id}`,
      );
    }

    return [batch];
  }

  private async allocateFefo(
    context: CheckoutContext,
    product: Product,
    item: CheckoutItemDto,
    candidates: ProductBatch[],
  ): Promise<CheckoutLine[]> {
    const lines: CheckoutLine[] = [];
    let remaining = item.quantity;

    for (const candidate of candidates) {
      if (remaining <= 0) break;

      const available = Number(candidate.qty);
      if (available <= 0) continue;

      const take = Math.min(available, remaining);
      const takeText = take.toFixed(QUANTITY_SCALE);

      const updated = await this.batchesRepository.decrementQty(
        context.executor,
        context.business.id,
        candidate.id,
        takeText,
      );

      if (!updated) {
        continue;
      }

      lines.push({
        product,
        quantity: take,
        unitPriceCents: product.priceCents,
        lineTotalCents: Math.round(product.priceCents * take),
        batchId: candidate.id,
      });

      remaining = Number((remaining - take).toFixed(QUANTITY_SCALE));
    }

    if (remaining > 0) {
      throw new ConflictException({
        message: 'i18n:errors.stock.insufficientUnexpired',
        productId: product.id,
        shortfall: remaining,
      });
    }

    return lines;
  }
}
