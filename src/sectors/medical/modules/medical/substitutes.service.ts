import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type { MedicalProductData } from '../../../../database/schema';

export interface SubstituteProduct {
  productId: string;
  name: string;
  genericName: string;
  manufacturer: string | null;
  schedule: string | null;
  priceCents: number;
  stockQty: number;
  earliestExpiry: string | null;
}

export interface SubstituteResult {
  productId: string;
  name: string;
  genericName: string | null;
  substitutes: SubstituteProduct[];
}

@Injectable()
export class SubstitutesService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findFor(
    businessId: string,
    productId: string,
  ): Promise<SubstituteResult> {
    const [product] = await this.db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.id, productId),
        ),
      )
      .limit(1);

    if (!product) {
      throw new NotFoundException({
        message: 'i18n:errors.product.notFound',
        productId,
      });
    }

    const genericName = (
      product.sectorData as MedicalProductData | null
    )?.genericName?.trim();

    if (!genericName) {
      return {
        productId: product.id,
        name: product.name,
        genericName: null,
        substitutes: [],
      };
    }

    const rows = await this.db
      .select({
        productId: schema.products.id,
        name: schema.products.name,
        sectorData: schema.products.sectorData,
        priceCents: schema.products.priceCents,
        stockQty: schema.products.stockQty,
        earliestExpiry: sql<string | null>`(
          select min(${schema.productBatches.expiryDate})
          from ${schema.productBatches}
          where ${schema.productBatches.productId} = ${schema.products.id}
            and ${schema.productBatches.isActive} = true
            and ${schema.productBatches.qty} > 0
        )`,
      })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.isActive, true),
          ne(schema.products.id, product.id),
          sql`lower(trim(${schema.products.sectorData} ->> 'genericName')) = ${genericName.toLowerCase()}`,
        ),
      )
      .orderBy(desc(schema.products.stockQty));

    return {
      productId: product.id,
      name: product.name,
      genericName,
      substitutes: rows.map((row) => {
        const data = row.sectorData as MedicalProductData | null;

        return {
          productId: row.productId,
          name: row.name,
          genericName: data?.genericName ?? genericName,
          manufacturer: data?.manufacturer ?? null,
          schedule: data?.schedule ?? null,
          priceCents: row.priceCents,
          stockQty: Number(row.stockQty),
          earliestExpiry: row.earliestExpiry,
        };
      }),
    };
  }
}
