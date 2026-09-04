import "server-only";

import { paypalRequest } from "./client";

type PayPalSubscriptionResponse = {
  id: string;
  status?: string;
  plan_id?: string;
  custom_id?: string;
  create_time?: string;
  update_time?: string;
  links?: Array<{
    href: string;
    rel: string;
    method?: string;
  }>;
};

function generateRequestId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function createPayPalSubscription(input: {
  planId: string;
  companyId: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  if (!input.planId) {
    throw new Error(
      "PayPal subscription plan ID is required."
    );
  }

  if (!input.companyId) {
    throw new Error(
      "Company ID is required."
    );
  }

  if (!input.returnUrl) {
    throw new Error(
      "PayPal subscription return URL is required."
    );
  }

  if (!input.cancelUrl) {
    throw new Error(
      "PayPal subscription cancel URL is required."
    );
  }

  const result =
    await paypalRequest<PayPalSubscriptionResponse>(
      "/v1/billing/subscriptions",
      {
        method: "POST",
        headers: {
          "PayPal-Request-Id":
            generateRequestId(
              "sbs-subscription"
            ),
          Prefer:
            "return=representation",
        },
        body: {
          plan_id: input.planId,

          custom_id: input.companyId,

          application_context: {
            brand_name:
              "Sharif Business Solutions",
            locale: "en-US",
            shipping_preference:
              "NO_SHIPPING",
            user_action:
              "SUBSCRIBE_NOW",
            payment_method: {
              payer_selected:
                "PAYPAL",
              payee_preferred:
                "IMMEDIATE_PAYMENT_REQUIRED",
            },
            return_url:
              input.returnUrl,
            cancel_url:
              input.cancelUrl,
          },
        },
      }
    );

  const approvalLink =
    result.links?.find(
      (link) =>
        link.rel === "approve"
    );

  if (!approvalLink?.href) {
    throw new Error(
      "PayPal created the subscription but did not return an approval URL."
    );
  }

  return {
    id: result.id,
    status:
      result.status ??
      "APPROVAL_PENDING",
    planId:
      result.plan_id ??
      input.planId,
    approvalUrl:
      approvalLink.href,
  };
}