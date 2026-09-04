import { Exclude, Expose } from 'class-transformer';
import type { Business } from '../../../database/schema';

@Exclude()
export class BusinessResponseDto {
  @Expose() id: string;
  @Expose() organizationId: string;
  @Expose() sector: string;
  @Expose() legalName: string;
  @Expose() panNumber: string | null;
  @Expose() vatRegistered: boolean;
  @Expose() cbmsRequired: boolean;
  @Expose() serviceChargePercent: number;
  @Expose() maxDiscountPercent: number;
  @Expose() loyaltyPointsPerHundred: number;
  @Expose() loyaltyPointValueCents: number;
  @Expose() fiscalYearStartMonth: number;
  @Expose() displayName: string | null;
  @Expose() theme: Record<string, unknown>;
  @Expose() status: string;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;

  constructor(business: Business) {
    this.id = business.id;
    this.organizationId = business.organizationId;
    this.sector = business.sector;
    this.legalName = business.legalName;
    this.panNumber = business.panNumber;
    this.vatRegistered = business.vatRegistered;
    this.cbmsRequired = business.cbmsRequired;
    this.displayName = business.displayName;
    this.theme = business.theme ?? {};
    this.serviceChargePercent = business.serviceChargePercent;
    this.maxDiscountPercent = business.maxDiscountPercent;
    this.loyaltyPointsPerHundred = business.loyaltyPointsPerHundred;
    this.loyaltyPointValueCents = business.loyaltyPointValueCents;
    this.fiscalYearStartMonth = business.fiscalYearStartMonth;
    this.status = business.status;
    this.createdAt = business.createdAt;
    this.updatedAt = business.updatedAt;
  }
}
