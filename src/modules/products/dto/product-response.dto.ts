import { Exclude, Expose } from 'class-transformer';
import type { Product } from '../../../database/schema';

@Exclude()
export class ProductResponseDto {
  @Expose() id: string;
  @Expose() businessId: string;
  @Expose() name: string;
  @Expose() sku: string | null;
  @Expose() unitType: string;
  @Expose() priceCents: number;
  @Expose() costPriceCents: number;
  @Expose() marginCents: number | null;
  @Expose() stockQty: number;
  @Expose() lowStockThreshold: number;
  @Expose() isLowStock: boolean;
  @Expose() isActive: boolean;
  @Expose() sectorData: Record<string, unknown>;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;

  constructor(product: Product) {
    this.id = product.id;
    this.businessId = product.businessId;
    this.name = product.name;
    this.sku = product.sku;
    this.unitType = product.unitType;
    this.priceCents = product.priceCents;
    this.costPriceCents = product.costPriceCents;
    this.marginCents =
      product.costPriceCents > 0
        ? product.priceCents - product.costPriceCents
        : null;
    this.stockQty = Number(product.stockQty);
    this.lowStockThreshold = Number(product.lowStockThreshold);
    this.isLowStock = this.stockQty <= this.lowStockThreshold;
    this.isActive = product.isActive;
    this.sectorData = product.sectorData;
    this.createdAt = product.createdAt;
    this.updatedAt = product.updatedAt;
  }
}
