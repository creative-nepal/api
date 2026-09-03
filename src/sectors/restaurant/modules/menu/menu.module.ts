import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { RecipesService } from './recipes.service';
import { MenuRepository } from './menu.repository';
import { MenuService } from './menu.service';

@Module({
  controllers: [MenuController],
  providers: [MenuService, MenuRepository, RecipesService],
  exports: [MenuService, MenuRepository, RecipesService],
})
export class MenuModule {}
