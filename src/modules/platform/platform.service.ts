import { Injectable } from '@nestjs/common';
import type { Business } from '../../database/schema';
import {
  BUSINESS_STATUSES,
  SECTORS,
  SUBSCRIPTION_STATUSES,
} from '../../database/schema';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { enabledSectorMeta } from '../../sectors';
import {
  type CountByKey,
  type PlatformAuditLogRow,
  PlatformRepository,
} from './platform.repository';

const RECENT_BUSINESS_LIMIT = 8;

export interface PlatformOverview {
  businesses: {
    total: number;
    byStatus: Record<string, number>;
    bySector: Record<string, number>;
  };
  subscriptions: {
    total: number;
    byStatus: Record<string, number>;
  };
  cbms: {
    pending: number;
    failed: number;
  };
  recentBusinesses: Business[];
}

export interface SectorDescriptor {
  key: string;
  nameKey: string;
  roleNames: string[];
  planFeatureKeys: string[];
}

function tally(
  rows: CountByKey[],
  keys: readonly string[],
): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(
    keys.map((key) => [key, 0]),
  );

  for (const row of rows) {
    result[row.key] = row.value;
  }

  return result;
}

function total(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

@Injectable()
export class PlatformService {
  constructor(private readonly platformRepository: PlatformRepository) {}

  listSectors(): SectorDescriptor[] {
    return enabledSectorMeta().map((sector) => ({
      key: sector.key,
      nameKey: sector.nameKey,
      roleNames: sector.roleNames,
      planFeatureKeys: sector.planFeatureKeys,
    }));
  }

  async getOverview(): Promise<PlatformOverview> {
    const [
      businessStatuses,
      businessSectors,
      subscriptionStatuses,
      cbmsQueue,
      recentBusinesses,
    ] = await Promise.all([
      this.platformRepository.countBusinessesByStatus(),
      this.platformRepository.countBusinessesBySector(),
      this.platformRepository.countSubscriptionsByStatus(),
      this.platformRepository.countCbmsQueueByStatus(),
      this.platformRepository.findRecentBusinesses(RECENT_BUSINESS_LIMIT),
    ]);

    const byStatus = tally(businessStatuses, BUSINESS_STATUSES);
    const subscriptionsByStatus = tally(
      subscriptionStatuses,
      SUBSCRIPTION_STATUSES,
    );
    const cbms = tally(cbmsQueue, ['pending', 'failed']);

    return {
      businesses: {
        total: total(byStatus),
        byStatus,
        bySector: tally(businessSectors, SECTORS),
      },
      subscriptions: {
        total: total(subscriptionsByStatus),
        byStatus: subscriptionsByStatus,
      },
      cbms: { pending: cbms.pending, failed: cbms.failed },
      recentBusinesses,
    };
  }

  async getAuditLog(
    businessId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResult<PlatformAuditLogRow>> {
    const [data, count] = await Promise.all([
      this.platformRepository.findAuditLog(businessId, limit, offset),
      this.platformRepository.countAuditLog(businessId),
    ]);

    return { data, total: count, limit, offset };
  }
}
