import { Injectable } from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type {
  ControlledSubstanceEntry,
  InsuranceClaim,
} from '../../../../database/schema';

@Injectable()
export class MedicalService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async listControlledRegister(
    businessId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResult<ControlledSubstanceEntry>> {
    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.controlledSubstanceRegister)
        .where(eq(schema.controlledSubstanceRegister.businessId, businessId))
        .orderBy(desc(schema.controlledSubstanceRegister.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(schema.controlledSubstanceRegister)
        .where(eq(schema.controlledSubstanceRegister.businessId, businessId)),
    ]);

    return { data, total: total?.value ?? 0, limit, offset };
  }

  async listInsuranceClaims(
    businessId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResult<InsuranceClaim>> {
    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.insuranceClaims)
        .where(eq(schema.insuranceClaims.businessId, businessId))
        .orderBy(desc(schema.insuranceClaims.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(schema.insuranceClaims)
        .where(eq(schema.insuranceClaims.businessId, businessId)),
    ]);

    return { data, total: total?.value ?? 0, limit, offset };
  }
}
