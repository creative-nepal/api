import { BadRequestException, Injectable } from '@nestjs/common';
import type { Business, Sector } from '../../../database/schema';
import { MartSectorPlugin } from './mart.plugin';
import { MedicalSectorPlugin } from './medical.plugin';
import { RestaurantSectorPlugin } from './restaurant.plugin';
import type { SectorPlugin } from './sector-plugin.interface';

@Injectable()
export class SectorPluginRegistry {
  private readonly plugins: Map<Sector, SectorPlugin>;

  constructor(
    mart: MartSectorPlugin,
    medical: MedicalSectorPlugin,
    restaurant: RestaurantSectorPlugin,
  ) {
    this.plugins = new Map<Sector, SectorPlugin>([
      [mart.sector, mart],
      [medical.sector, medical],
      [restaurant.sector, restaurant],
    ]);
  }

  resolve(business: Business): SectorPlugin {
    const plugin = this.plugins.get(business.sector as Sector);

    if (!plugin) {
      throw new BadRequestException(
        `Checkout is not implemented for the ${business.sector} sector yet`,
      );
    }

    return plugin;
  }
}
