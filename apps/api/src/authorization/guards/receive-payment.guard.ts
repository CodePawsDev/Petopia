import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import { AuthorizationService } from '../authorization.service';

@Injectable()
export class ReceivePaymentGuard implements CanActivate {
  constructor(private readonly authorizationService: AuthorizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    const branchId = request.params['branchId'];

    if (typeof branchId !== 'string' || !isUUID(branchId)) {
      throw new BadRequestException('Invalid branch ID');
    }

    await this.authorizationService.requireReceivePayment(
      request.currentUser.id,
      branchId,
    );

    return true;
  }
}
