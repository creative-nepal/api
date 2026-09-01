import { Exclude, Expose } from 'class-transformer';
import type { ProductBatch } from '../../../database/schema';

@Exclude()
export class BatchResponseDto {
  @Expose() id: string;
  @Expose() businessId: string;
  @Expose() productId: string;
  @Expose() batchNo: string;
  @Expose() expiryDate: string;
  @Expose() qty: number;
  @Expose() costPriceCents: number;
  @Expose() isActive: boolean;
  @Expose() isExpired: boolean;
  @Expose() daysToExpiry: number;
  @Expose() createdAt: Date;

  constructor(batch: ProductBatch) {
    this.id = batch.id;
    this.businessId = batch.businessId;
    this.productId = batch.productId;
    this.batchNo = batch.batchNo;
    this.expiryDate = batch.expiryDate;
    this.qty = Number(batch.qty);
    this.costPriceCents = batch.costPriceCents;
    this.isActive = batch.isActive;

    const expiry = new Date(`${batch.expiryDate}T00:00:00Z`);
    const today = new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    this.daysToExpiry = Math.round((expiry.getTime() - todayUtc) / 86_400_000);
    this.isExpired = this.daysToExpiry <= 0;
    this.createdAt = batch.createdAt;
  }
}
