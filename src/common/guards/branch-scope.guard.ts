import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { BranchesService } from '../../modules/branches/branches.service';
import type { BusinessScopedRequest } from '../decorators/current-business.decorator';

@Injectable()
export class BranchScopeGuard implements CanActivate {
  constructor(private readonly branchesService: BranchesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BusinessScopedRequest>();

    if (!request.business) {
      throw new InternalServerErrorException(
        'BranchScopeGuard requires BusinessAccessGuard to run first',
      );
    }

    const raw = request.headers['x-branch-id'];
    const requested = Array.isArray(raw) ? raw[0] : raw;

    request.branch = await this.branchesService.resolve(
      request.business.id,
      requested,
    );

    return true;
  }
}
