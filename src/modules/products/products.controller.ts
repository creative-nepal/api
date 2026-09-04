import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Business } from '../../database/schema';
import {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/product-request.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ExportQueryDto, sendReport } from '../../common/reporting';
import type { DownloadResponse } from '../../common/reporting/spreadsheet';
import { ImportProductsDto } from './dto/product-import.dto';
import { ProductsExportService } from './products-export.service';
import {
  type ImportSummary,
  ProductsImportService,
} from './products-import.service';
import { ProductsService } from './products.service';

@Controller({ path: 'businesses/:businessId/products', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly exportService: ProductsExportService,
    private readonly importService: ProductsImportService,
  ) {}

  @Get('export')
  @RequirePermission({ product: ['create'] })
  async export(
    @CurrentBusiness() business: Business,
    @Query() query: ExportQueryDto,
    @Res() response: DownloadResponse,
  ): Promise<void> {
    sendReport(
      response,
      await this.exportService.export(
        business,
        query.format ?? 'xlsx',
        query.search,
        query.limit ?? 5_000,
      ),
    );
  }

  @Post('import')
  @RequirePermission({ product: ['create'] })
  async import(
    @CurrentBusiness() business: Business,
    @Body() dto: ImportProductsDto,
  ): Promise<ImportSummary> {
    return this.importService.import(business, dto);
  }

  @Get()
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListProductsQueryDto,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    const result = await this.productsService.list({
      businessId: business.id,
      ...query,
    });

    return {
      ...result,
      data: result.data.map((product) => new ProductResponseDto(product)),
    };
  }

  @Get(':productId')
  async getById(
    @CurrentBusiness() business: Business,
    @Param('productId') productId: string,
  ): Promise<ProductResponseDto> {
    return new ProductResponseDto(
      await this.productsService.getById(business.id, productId),
    );
  }

  @Post()
  @RequirePermission({ product: ['create'] })
  async create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return new ProductResponseDto(
      await this.productsService.create(business, dto),
    );
  }

  @Patch(':productId')
  @RequirePermission({ product: ['update'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return new ProductResponseDto(
      await this.productsService.update(business, productId, dto),
    );
  }

  @Delete(':productId')
  @RequirePermission({ product: ['delete'] })
  async deactivate(
    @CurrentBusiness() business: Business,
    @Param('productId') productId: string,
  ): Promise<ProductResponseDto> {
    return new ProductResponseDto(
      await this.productsService.deactivate(business.id, productId),
    );
  }
}
