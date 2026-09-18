/// <reference lib="deno.ns" />

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  create_time?: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    plan_id?: string;
    billing_info?: {
      cycle_executions?: Array<{
        tenure_type?: string;
        sequence?: number;
        cycles_completed?: number;
        cycles_remaining?: number;
        current_pricing_scheme_version?: number;
        total_cycles?: number;
      }>;
    };
    amount?: {
      total?: string;
      value?: string;
      currency?: string;
    };
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
      };
    };
    billing_agreement_id?: string;
    transaction_info?: {
      transaction_id?: string;
      transaction_event_code?: string;
      transaction_initiation_date?: string;
      transaction_updated_date?: string;
      transaction_amount?: {
        value?: string;
        currency_code?: string;
      };
      fee_amount?: {
        value?: string;
        currency_code?: string;
      };
    };
  };
};

type SubscriptionRecord = {
  id: string;
  company_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getPayPalBaseUrl() {
  const environment =
    Deno.env.get("PAYPAL_ENVIRONMENT") ?? "sandbox";

  return environment === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal credentials are not configured."
    );
  }

  const credentials = btoa(
    `${clientId}:${clientSecret}`
  );

  const response = await fetch(
    `${getPayPalBaseUrl()}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body:
        "grant_type=client_credentials",
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `PayPal authentication failed: ${text}`
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
  };

  if (!data.access_token) {
    throw new Error(
      "PayPal did not return an access token."
    );
  }

  return data.access_token;
}

async function paypalRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken =
    await getPayPalAccessToken();

  const headers = new Headers(
    options.headers
  );

  headers.set(
    "Authorization",
    `Bearer ${accessToken}`
  );

  headers.set(
    "Content-Type",
    "application/json"
  );

  headers.set(
    "Accept",
    "application/json"
  );

  const response = await fetch(
    `${getPayPalBaseUrl()}${path}`,
    {
      ...options,
      headers,
    }
  );

  const text = await response.text();

  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `PayPal API error (${response.status}): ${JSON.stringify(
        data
      )}`
    );
  }

  return data as T;
}

async function verifyPayPalWebhook(
  req: Request,
  rawBody: string
) {
  const webhookId =
    Deno.env.get("PAYPAL_WEBHOOK_ID");

  if (!webhookId) {
    throw new Error(
      "PAYPAL_WEBHOOK_ID is not configured."
    );
  }

  const transmissionId =
    req.headers.get(
      "PAYPAL-TRANSMISSION-ID"
    );

  const transmissionTime =
    req.headers.get(
      "PAYPAL-TRANSMISSION-TIME"
    );

  const transmissionSig =
    req.headers.get(
      "PAYPAL-TRANSMISSION-SIG"
    );

  const certUrl =
    req.headers.get(
      "PAYPAL-CERT-URL"
    );

  const authAlgo =
    req.headers.get(
      "PAYPAL-AUTH-ALGO"
    );

  if (
    !transmissionId ||
    !transmissionTime ||
    !transmissionSig ||
    !certUrl ||
    !authAlgo
  ) {
    throw new Error(
      "Missing PayPal webhook verification headers."
    );
  }

  const event =
    JSON.parse(rawBody) as PayPalWebhookEvent;

  const verification =
    await paypalRequest<{
      verification_status?: string;
    }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id:
            transmissionId,
          transmission_sig:
            transmissionSig,
          transmission_time:
            transmissionTime,
          webhook_id: webhookId,
          webhook_event: event,
        }),
      }
    );

  return (
    verification.verification_status ===
    "SUCCESS"
  );
}

function parseCustomId(customId?: string) {
  if (!customId) {
    return null;
  }

  const parts = customId.split(":");

  if (parts.length !== 3) {
    return null;
  }

  const [
    companyId,
    planId,
    billingCycle,
  ] = parts;

  if (
    billingCycle !== "monthly" &&
    billingCycle !== "yearly"
  ) {
    return null;
  }

  return {
    companyId,
    planId,
    billingCycle,
  };
}

function getSubscriptionStatus(
 eventType: string
) {
  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
      return "active";

    case "BILLING.SUBSCRIPTION.SUSPENDED":
      return "past_due";

    case "BILLING.SUBSCRIPTION.CANCELLED":
      return "canceled";

    case "BILLING.SUBSCRIPTION.EXPIRED":
      return "expired";

    default:
      return null;
  }
}

async function findSubscription(
  supabase: ReturnType<typeof createClient>,
  providerSubscriptionId: string
) {
  const { data, error } =
    await supabase
      .from("subscriptions")
      .select(
        `
          id,
          company_id,
          plan_id,
          status,
          billing_cycle,
          amount,
          currency,
          provider_subscription_id,
          current_period_start,
          current_period_end
        `
      )
      .eq(
        "provider_subscription_id",
        providerSubscriptionId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find subscription: ${error.message}`
    );
  }

  return data as SubscriptionRecord | null;
}

async function updateSubscription(
  supabase: ReturnType<typeof createClient>,
  subscriptionId: string,
  event: PayPalWebhookEvent,
  status: string
) {
  const resource = event.resource;

  const updateData: Record<
    string,
    unknown
  > = {
    status,
    provider: "paypal",
    updated_at: new Date().toISOString(),
    provider_metadata: {
      paypal_status:
        resource?.status ?? null,
      paypal_event_type:
        event.event_type ?? null,
      paypal_event_id:
        event.id ?? null,
      paypal_event_time:
        event.create_time ?? null,
    },
  };

  if (status === "active") {
    updateData.started_at =
      resource?.billing_info
        ? new Date().toISOString()
        : null;
  }

  if (
    status === "canceled" ||
    status === "expired"
  ) {
    updateData.canceled_at =
      new Date().toISOString();
    updateData.cancel_at_period_end =
      false;
  }

  const { error } =
    await supabase
      .from("subscriptions")
      .update(updateData)
      .eq("id", subscriptionId);

  if (error) {
    throw new Error(
      `Unable to update subscription: ${error.message}`
    );
  }
}

async function activateEntitlements(
  supabase: ReturnType<typeof createClient>,
  subscription: SubscriptionRecord
) {
  const { data: modules, error } =
    await supabase
      .from("modules")
      .select("id");

  if (error) {
    throw new Error(
      `Unable to load modules: ${error.message}`
    );
  }

  if (!modules?.length) {
    return;
  }

  for (const module of modules) {
    const { error: upsertError } =
      await supabase
        .from("company_entitlements")
        .upsert(
          {
            company_id:
              subscription.company_id,
            module_id: module.id,
            access: "enabled",
            source: "plan",
            subscription_id:
              subscription.id,
            expires_at: null,
            reason:
              "Active PayPal subscription",
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "company_id,module_id",
          }
        );

    if (upsertError) {
      throw new Error(
        `Unable to activate entitlement: ${upsertError.message}`
      );
    }
  }
}

async function disableEntitlements(
  supabase: ReturnType<typeof createClient>,
  subscription: SubscriptionRecord
) {
  const { error } =
    await supabase
      .from("company_entitlements")
      .update({
        access: "disabled",
        reason:
          "PayPal subscription inactive",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "subscription_id",
        subscription.id
      )
      .eq("source", "plan");

  if (error) {
    throw new Error(
      `Unable to disable entitlements: ${error.message}`
    );
  }
}

async function recordPayment(
  supabase: ReturnType<typeof createClient>,
  subscription: SubscriptionRecord,
  event: PayPalWebhookEvent
) {
  const transaction =
    event.resource?.transaction_info;

  const transactionId =
    transaction?.transaction_id ??
    event.resource?.id ??
    null;

  if (!transactionId) {
    return;
  }

  const amount =
    transaction?.transaction_amount?.value ??
    event.resource?.amount?.value ??
    event.resource?.amount?.total ??
    subscription.amount;

  const currency =
    transaction?.transaction_amount
      ?.currency_code ??
    event.resource?.amount?.currency ??
    subscription.currency;

  const eventType =
    event.event_type ?? "";

  const isCompleted =
    eventType ===
    "PAYMENT.SALE.COMPLETED";

  const isFailed =
    eventType ===
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED";

  const status = isCompleted
    ? "paid"
    : isFailed
      ? "failed"
      : "pending";

  const { data: existing } =
    await supabase
      .from("payments")
      .select("id")
      .eq(
        "provider_transaction_id",
        transactionId
      )
      .maybeSingle();

  if (existing) {
    const { error } =
      await supabase
        .from("payments")
        .update({
          status,
          amount,
          currency,
          paid_at: isCompleted
            ? new Date().toISOString()
            : null,
          failure_reason: isFailed
            ? "PayPal subscription payment failed."
            : null,
          metadata: {
            paypal_event_id:
              event.id ?? null,
            paypal_event_type:
              eventType,
          },
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", existing.id);

    if (error) {
      throw new Error(
        `Unable to update payment: ${error.message}`
      );
    }

    return;
  }

  const { error } =
    await supabase
      .from("payments")
      .insert({
        company_id:
          subscription.company_id,
        subscription_id:
          subscription.id,
        provider: "paypal",
        provider_transaction_id:
          transactionId,
        provider_order_id:
          event.resource
            ?.supplementary_data
            ?.related_ids
            ?.order_id ?? null,
        amount,
        currency,
        status,
        payment_type:
          "subscription",
        payment_method:
          "paypal",
        paid_at: isCompleted
          ? new Date().toISOString()
          : null,
        failure_reason: isFailed
          ? "PayPal subscription payment failed."
          : null,
        metadata: {
          paypal_event_id:
            event.id ?? null,
          paypal_event_type:
            eventType,
        },
      });

  if (error) {
    throw new Error(
      `Unable to record payment: ${error.message}`
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed.",
      },
      405
    );
  }

  try {
    const rawBody =
      await req.text();

    const verified =
      await verifyPayPalWebhook(
        req,
        rawBody
      );

    if (!verified) {
      console.error(
        "PayPal webhook signature verification failed."
      );

      return jsonResponse(
        {
          error:
            "Invalid PayPal webhook signature.",
        },
        401
      );
    }

    const event =
      JSON.parse(
        rawBody
      ) as PayPalWebhookEvent;

    const eventType =
      event.event_type ?? "";

    const resource =
      event.resource;

    console.log(
      `Processing PayPal webhook: ${eventType}`
    );

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Supabase service-role configuration is missing."
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey
      );

    /*
     * Subscription lifecycle events
     */

    const subscriptionStatus =
      getSubscriptionStatus(
        eventType
      );

    if (
      subscriptionStatus &&
      resource?.id
    ) {
      const subscription =
        await findSubscription(
          supabase,
          resource.id
        );

      if (!subscription) {
        /*
         * This can happen if PayPal sends an event
         * before SBS has finished saving the record.
         *
         * We acknowledge the event instead of creating
         * a duplicate subscription here.
         */
        console.warn(
          `No SBS subscription found for PayPal subscription ${resource.id}.`
        );

        return jsonResponse({
          received: true,
          processed: false,
          reason:
            "Subscription not found in SBS.",
        });
      }

      await updateSubscription(
        supabase,
        subscription.id,
        event,
        subscriptionStatus
      );

      if (
        subscriptionStatus ===
        "active"
      ) {
        await activateEntitlements(
          supabase,
          subscription
        );
      }

      if (
        subscriptionStatus ===
          "canceled" ||
        subscriptionStatus ===
          "expired"
      ) {
        await disableEntitlements(
          supabase,
          subscription
        );
      }

      return jsonResponse({
        received: true,
        processed: true,
        eventType,
        subscriptionId:
          subscription.id,
        status:
          subscriptionStatus,
      });
    }

    /*
     * Payment events
     */

    if (
      eventType ===
        "PAYMENT.SALE.COMPLETED" ||
      eventType ===
        "BILLING.SUBSCRIPTION.PAYMENT.FAILED"
    ) {
      const providerSubscriptionId =
        resource?.billing_agreement_id;

      if (!providerSubscriptionId) {
        console.warn(
          "Payment event did not include a billing agreement ID."
        );

        return jsonResponse({
          received: true,
          processed: false,
          reason:
            "No PayPal subscription ID in payment event.",
        });
      }

      const subscription =
        await findSubscription(
          supabase,
          providerSubscriptionId
        );

      if (!subscription) {
        return jsonResponse({
          received: true,
          processed: false,
          reason:
            "Subscription not found in SBS.",
        });
      }

      await recordPayment(
        supabase,
        subscription,
        event
      );

      if (
        eventType ===
        "BILLING.SUBSCRIPTION.PAYMENT.FAILED"
      ) {
        await supabase
          .from("subscriptions")
          .update({
            status: "past_due",
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            subscription.id
          );
      }

      return jsonResponse({
        received: true,
        processed: true,
        eventType,
        subscriptionId:
          subscription.id,
      });
    }

    /*
     * Other PayPal events are safely acknowledged.
     */

    console.log(
      `PayPal webhook acknowledged without database action: ${eventType}`
    );

    return jsonResponse({
      received: true,
      processed: false,
      eventType,
    });
  } catch (error) {
    console.error(
      "PayPal webhook error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to process PayPal webhook.";

    return jsonResponse(
      {
        error: message,
      },
      500
    );
  }
});