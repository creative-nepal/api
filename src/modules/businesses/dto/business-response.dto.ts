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
  @Expose() fiscalYearStartMonth: number;
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
    this.fiscalYearStartMonth = business.fiscalYearStartMonth;
    this.status = business.status;
    this.createdAt = business.createdAt;
    this.updatedAt = business.updatedAt;
  }
}
