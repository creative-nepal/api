import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase } from '../../../../database';
import type { ServiceAppointment } from '../../../../database/schema';
import { EntitlementsService } from '../../../../modules/entitlements/entitlements.service';
import { ServicesRepository } from '../services/services.repository';
import { AppointmentsRepository } from './appointments.repository';
import type {
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
} from './dto/appointments.dto';

const TERMINAL_STATUSES = new Set(['completed', 'no_show', 'canceled']);

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly appointmentsRepository: AppointmentsRepository,
    private readonly servicesRepository: ServicesRepository,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(
    businessId: string,
    query: ListAppointmentsQueryDto,
  ): Promise<PaginatedResult<ServiceAppointment>> {
    const { rows, total } = await this.appointmentsRepository.findMany({
      businessId,
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      status: query.status,
      staffUserId: query.staffUserId,
      customerId: query.customerId,
      from: query.from,
      to: query.to,
    });

    return { data: rows, total, limit: query.limit, offset: query.offset };
  }

  async getById(
    businessId: string,
    appointmentId: string,
  ): Promise<ServiceAppointment> {
    const found = await this.appointmentsRepository.findById(
      businessId,
      appointmentId,
    );

    if (!found) {
      throw new NotFoundException({
        message: 'i18n:errors.services.appointmentNotFound',
        appointmentId,
      });
    }

    return found;
  }

  async book(
    businessId: string,
    dto: CreateAppointmentDto,
  ): Promise<ServiceAppointment> {
    const item = await this.servicesRepository.findItemById(
      businessId,
      dto.serviceItemId,
    );

    if (!item) {
      throw new NotFoundException({
        message: 'i18n:errors.services.itemNotFound',
        serviceItemId: dto.serviceItemId,
      });
    }

    if (!item.isActive) {
      throw new BadRequestException({
        message: 'i18n:errors.services.itemInactive',
        serviceItemId: dto.serviceItemId,
      });
    }

    await this.assertAppointmentQuota(businessId);

    if (dto.membershipId) {
      const membership = await this.servicesRepository.findMembershipById(
        businessId,
        dto.membershipId,
      );

      if (!membership) {
        throw new NotFoundException({
          message: 'i18n:errors.services.membershipNotFound',
          membershipId: dto.membershipId,
        });
      }

      if (membership.serviceItemId !== dto.serviceItemId) {
        throw new BadRequestException(
          'i18n:errors.services.membershipServiceMismatch',
        );
      }
    }

    return this.appointmentsRepository.insert({
      id: randomUUID(),
      businessId,
      serviceItemId: dto.serviceItemId,
      customerId: dto.customerId ?? null,
      membershipId: dto.membershipId ?? null,
      staffUserId: dto.staffUserId ?? null,
      scheduledAt: new Date(dto.scheduledAt),
      durationMinutes: dto.durationMinutes ?? item.durationMinutes,
      status: 'booked',
      note: dto.note ?? null,
    });
  }

  async setStatus(
    businessId: string,
    appointmentId: string,
    status: string,
  ): Promise<ServiceAppointment> {
    const appointment = await this.getById(businessId, appointmentId);

    if (TERMINAL_STATUSES.has(appointment.status)) {
      throw new ConflictException({
        message: 'i18n:errors.services.appointmentFinal',
        status: `i18n:common.appointmentStatus.${appointment.status}`,
      });
    }

    if (status === 'booked') {
      throw new BadRequestException('i18n:errors.services.appointmentReopen');
    }

    return this.db.transaction(async (tx) => {
      const updated = await this.appointmentsRepository.updateStatus(
        tx,
        businessId,
        appointmentId,
        status,
        status === 'completed' ? new Date() : null,
      );

      if (!updated) {
        throw new NotFoundException({
          message: 'i18n:errors.services.appointmentNotFound',
          appointmentId,
        });
      }

      if (status === 'completed' && appointment.membershipId) {
        const consumed = await this.appointmentsRepository.consumeSession(
          tx,
          businessId,
          appointment.membershipId,
        );

        if (!consumed) {
          throw new ConflictException({
            message: 'i18n:errors.services.membershipExhausted',
            membershipId: appointment.membershipId,
          });
        }
      }

      return updated;
    });
  }

  private async assertAppointmentQuota(businessId: string): Promise<void> {
    const limit = await this.entitlements.getLimit(
      businessId,
      'maxAppointmentsPerMonth',
    );

    if (limit === undefined || limit <= 0) {
      return;
    }

    const since = new Date();
    since.setMonth(since.getMonth() - 1);

    const used = await this.appointmentsRepository.countInPeriod(
      businessId,
      since,
    );

    if (used >= limit) {
      throw new BadRequestException({
        message: 'i18n:errors.services.appointmentQuotaExceeded',
        limit,
      });
    }
  }
}
