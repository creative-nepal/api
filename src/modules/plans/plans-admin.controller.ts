import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import {
  CreatePlanDto,
  ListPlansQueryDto,
  UpdatePlanDto,
} from './dto/plan-request.dto';
import { PlanResponseDto } from './dto/plan-response.dto';
import { PlansService } from './plans.service';

@Controller({ path: 'plans', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class PlansAdminController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  async list(
    @Query() query: ListPlansQueryDto,
  ): Promise<PaginatedResult<PlanResponseDto>> {
    const result = await this.plansService.list(query);
    return {
      ...result,
      data: result.data.map((plan) => new PlanResponseDto(plan)),
    };
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<PlanResponseDto> {
    return new PlanResponseDto(await this.plansService.getById(id));
  }

  @Post()
  @UserHasPermission({ permissions: { plan: ['create'] } })
  async create(@Body() dto: CreatePlanDto): Promise<PlanResponseDto> {
    return new PlanResponseDto(await this.plansService.create(dto));
  }

  @Patch(':id')
  @UserHasPermission({ permissions: { plan: ['update'] } })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanResponseDto> {
    return new PlanResponseDto(await this.plansService.update(id, dto));
  }

  @Patch(':id/archive')
  @UserHasPermission({ permissions: { plan: ['archive'] } })
  async archive(@Param('id') id: string): Promise<PlanResponseDto> {
    return new PlanResponseDto(await this.plansService.archive(id));
  }
}
