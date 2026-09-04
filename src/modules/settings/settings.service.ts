import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type { BusinessSettings } from '../../database/schema';
import type { UpdateSettingsDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async get(businessId: string): Promise<BusinessSettings> {
    const [existing] = await this.db
      .select()
      .from(schema.businessSettings)
      .where(eq(schema.businessSettings.businessId, businessId))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [created] = await this.db
      .insert(schema.businessSettings)
      .values({ businessId })
      .onConflictDoNothing()
      .returning();

    return created ?? this.get(businessId);
  }

  async update(
    businessId: string,
    dto: UpdateSettingsDto,
  ): Promise<BusinessSettings> {
    await this.get(businessId);

    const [row] = await this.db
      .update(schema.businessSettings)
      .set({
        ...(dto.contactPhone !== undefined && {
          contactPhone: dto.contactPhone,
        }),
        ...(dto.contactEmail !== undefined && {
          contactEmail: dto.contactEmail,
        }),
        ...(dto.addressLine !== undefined && { addressLine: dto.addressLine }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.invoiceFooter !== undefined && {
          invoiceFooter: dto.invoiceFooter,
        }),
        ...(dto.receiptWidth !== undefined && {
          receiptWidth: dto.receiptWidth,
        }),
        ...(dto.showLogoOnReceipt !== undefined && {
          showLogoOnReceipt: dto.showLogoOnReceipt,
        }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.defaultLocale !== undefined && {
          defaultLocale: dto.defaultLocale,
        }),
        ...(dto.digestEnabled !== undefined && {
          digestEnabled: dto.digestEnabled,
        }),
        ...(dto.digestHour !== undefined && { digestHour: dto.digestHour }),
        ...(dto.lowStockAlertsEnabled !== undefined && {
          lowStockAlertsEnabled: dto.lowStockAlertsEnabled,
        }),
        ...(dto.expiryAlertsEnabled !== undefined && {
          expiryAlertsEnabled: dto.expiryAlertsEnabled,
        }),
      })
      .where(eq(schema.businessSettings.businessId, businessId))
      .returning();

    return row;
  }
}
