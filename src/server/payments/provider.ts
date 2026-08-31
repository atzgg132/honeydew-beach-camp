import "server-only";

export interface ProviderOrder {
  provider: string;
  providerOrderId: string;
  amountPaise: number;
  currency: "INR";
  expiresAt: Date;
  clientData: Record<string, string>;
}

export interface VerifiedPaymentEvent {
  /** Which adapter verified this event. Scopes every lookup and dedupe key. */
  provider: string;
  providerEventId: string;
  eventType: string;
  providerOrderId: string;
  providerPaymentId: string;
  amountPaise: number;
  currency: "INR";
  paidAt: Date;
}

export interface PaymentProvider {
  createOrder(input: {
    idempotencyKey: string;
    amountPaise: number;
    currency: "INR";
    expiresAt: Date;
    metadata: { bookingId: string };
  }): Promise<ProviderOrder>;
  verifyWebhook(input: { rawBody: Uint8Array; headers: Headers }): Promise<VerifiedPaymentEvent>;
}
