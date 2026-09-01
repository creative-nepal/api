export interface ChargeRequest {
  amountCents: number;
  currency: string;
  gatewayToken: string;
  idempotencyKey: string;
  description: string;
}

export interface ChargeResult {
  success: boolean;
  reference: string | null;
  failureReason: string | null;
}

export abstract class PaymentGateway {
  abstract readonly provider: string;
  abstract charge(request: ChargeRequest): Promise<ChargeResult>;
}
