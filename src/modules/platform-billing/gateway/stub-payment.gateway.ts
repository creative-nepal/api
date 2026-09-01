import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  type ChargeRequest,
  type ChargeResult,
  PaymentGateway,
} from './payment-gateway.interface';

@Injectable()
export class StubPaymentGateway extends PaymentGateway {
  readonly provider = 'stub';

  constructor(private readonly logger: PinoLogger) {
    super();
    this.logger.setContext(StubPaymentGateway.name);
  }

  charge(request: ChargeRequest): Promise<ChargeResult> {
    this.logger.warn(
      {
        amountCents: request.amountCents,
        currency: request.currency,
        description: request.description,
      },
      'No payment gateway configured — simulating a charge',
    );

    if (request.gatewayToken.startsWith('fail_')) {
      return Promise.resolve({
        success: false,
        reference: null,
        failureReason: 'Simulated decline (stub gateway)',
      });
    }

    const reference = createHash('sha256')
      .update(request.idempotencyKey)
      .digest('hex')
      .slice(0, 24);

    return Promise.resolve({
      success: true,
      reference: `stub_${reference}`,
      failureReason: null,
    });
  }
}
