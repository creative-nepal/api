import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { BranchesService } from '../../modules/branches/branches.service';
import { MembersService } from '../../modules/members/members.service';
import type { BusinessScopedRequest } from '../decorators/current-business.decorator';

@Injectable()
export class BranchScopeGuard implements CanActivate {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly membersService: MembersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BusinessScopedRequest>();

    if (!request.business) {
      throw new InternalServerErrorException(
        'BranchScopeGuard requires BusinessAccessGuard to run first',
      );
    }

    const raw = request.headers['x-branch-id'];
    const requested = Array.isArray(raw) ? raw[0] : raw;

    const branch = await this.branchesService.resolve(
      request.business.id,
      requested,
    );

    const userId = request.session?.user?.id;

    if (userId) {
      const allowed = await this.membersService.allowedBranchIds(
        request.business.id,
        userId,
      );

      if (allowed && !allowed.includes(branch.id)) {
        throw new ForbiddenException({
          message: 'i18n:errors.member.branchNotAllowed',
          branch: branch.name,
        });
      }
    }

    request.branch = branch;

    return true;
  }
}
