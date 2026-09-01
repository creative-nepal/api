import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Product } from '../../database/schema';

export interface ProductDelta {
  products: Product[];
  cursor: string | null;
}

@Injectable()
export class SyncService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async productsSince(
    businessId: string,
    updatedSince: string | undefined,
    limit: number,
  ): Promise<ProductDelta> {
    const conditions = [eq(schema.products.businessId, businessId)];

    if (updatedSince) {
      conditions.push(gt(schema.products.updatedAt, new Date(updatedSince)));
    }

    const products = await this.db
      .select()
      .from(schema.products)
      .where(and(...conditions))
      .orderBy(asc(schema.products.updatedAt))
      .limit(limit);

    const cursor =
      products.length > 0
        ? products[products.length - 1].updatedAt.toISOString()
        : (updatedSince ?? null);

    return { products, cursor };
  }
}
