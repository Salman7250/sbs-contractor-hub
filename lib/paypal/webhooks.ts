import "server-only";

import { paypalRequest } from "./client";

type PayPalWebhookVerificationResponse = {
  verification_status?: "SUCCESS" | "FAILURE";
};

export type PayPalWebhookEvent = {
  id: string;
  create_time?: string;
  resource_type?: string;
  event_version?: string;
  event_type: string;
  summary?: string;
  resource_version?: string;
  resource: Record<string, unknown>;
};

export async function verifyPayPalWebhook(input: {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookEvent: PayPalWebhookEvent;
}): Promise<boolean> {
  const webhookId =
    process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    throw new Error(
      "Missing PAYPAL_WEBHOOK_ID environment variable."
    );
  }

  if (
    !input.transmissionId ||
    !input.transmissionTime ||
    !input.certUrl ||
    !input.authAlgo ||
    !input.transmissionSig
  ) {
    return false;
  }

  const result =
    await paypalRequest<PayPalWebhookVerificationResponse>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: {
          transmission_id:
            input.transmissionId,

          transmission_time:
            input.transmissionTime,

          cert_url:
            input.certUrl,

          auth_algo:
            input.authAlgo,

          transmission_sig:
            input.transmissionSig,

          webhook_id:
            webhookId,

          webhook_event:
            input.webhookEvent,
        },
      }
    );

  return (
    result.verification_status ===
    "SUCCESS"
  );
}