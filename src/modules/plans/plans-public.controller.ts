import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ListPlansQueryDto } from './dto/plan-request.dto';
import { PlanResponseDto } from './dto/plan-response.dto';
import { PlansService } from './plans.service';

@Controller({ path: 'public/plans', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class PlansPublicController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @AllowAnonymous()
  async list(@Query() query: ListPlansQueryDto): Promise<PlanResponseDto[]> {
    const result = await this.plansService.list({
      ...query,
      isActive: true,
      limit: 50,
      offset: 0,
    });

    return result.data.map((plan) => new PlanResponseDto(plan));
  }
}
