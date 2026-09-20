import { createAdminClient } from "@/lib/supabase/admin";

type PayPalSubscription = {
  id?: string;
  status?: string;
  start_time?: string;
  create_time?: string;
  update_time?: string;
  subscriber?: {
    payer_id?: string;
    email_address?: string;
  };
  billing_info?: {
    next_billing_time?: string;
    cycle_executions?: Array<{
      tenure_type?: string;
      cycles_completed?: number;
      cycles_remaining?: number;
    }>;
  };
  plan_id?: string;
};

function getPayPalBaseUrl() {
  const environment =
    process.env.PAYPAL_ENVIRONMENT ?? "sandbox";

  return environment === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken() {
  const clientId =
    process.env.PAYPAL_CLIENT_ID;

  const clientSecret =
    process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal credentials are not configured.",
    );
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`,
  ).toString("base64");

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
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `PayPal authentication failed: ${body}`,
    );
  }

  const data =
    (await response.json()) as {
      access_token?: string;
    };

  if (!data.access_token) {
    throw new Error(
      "PayPal did not return an access token.",
    );
  }

  return data.access_token;
}

async function getPayPalSubscription(
  paypalSubscriptionId: string,
) {
  const accessToken =
    await getPayPalAccessToken();

  const response = await fetch(
    `${getPayPalBaseUrl()}/v1/billing/subscriptions/${encodeURIComponent(
      paypalSubscriptionId,
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
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
      `PayPal subscription lookup failed (${response.status}): ${JSON.stringify(
        data,
      )}`,
    );
  }

  return data as PayPalSubscription;
}

export async function completePayPalSubscription(
  paypalSubscriptionId: string,
) {
  if (!paypalSubscriptionId) {
    throw new Error(
      "PayPal subscription ID is required.",
    );
  }

  const admin =
    createAdminClient();

  /*
   * Ask PayPal for the authoritative
   * subscription state.
   */
  const paypalSubscription =
    await getPayPalSubscription(
      paypalSubscriptionId,
    );

  if (
    paypalSubscription.id !==
    paypalSubscriptionId
  ) {
    throw new Error(
      "PayPal returned a different subscription ID.",
    );
  }

  /*
   * Find the SBS subscription that was
   * created when checkout started.
   */
  const {
    data: existingSubscription,
    error: lookupError,
  } = await admin
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
        provider,
        provider_customer_id,
        provider_subscription_id,
        started_at,
        current_period_start,
        current_period_end
      `,
    )
    .eq(
      "provider_subscription_id",
      paypalSubscriptionId,
    )
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Unable to find SBS subscription: ${lookupError.message}`,
    );
  }

  if (!existingSubscription) {
    throw new Error(
      "SBS subscription was not found for this PayPal subscription.",
    );
  }

  const paypalStatus =
    paypalSubscription.status ??
    "UNKNOWN";

  /*
   * PayPal subscription states:
   *
   * ACTIVE     -> SBS active
   * SUSPENDED  -> SBS paused
   * CANCELLED  -> SBS canceled
   * EXPIRED    -> SBS canceled
   * APPROVAL_PENDING -> SBS pending
   */
  let nextStatus =
    existingSubscription.status;

  switch (paypalStatus) {
    case "ACTIVE":
      nextStatus = "active";
      break;

    case "SUSPENDED":
      nextStatus = "paused";
      break;

    case "CANCELLED":
      nextStatus = "canceled";
      break;

    case "EXPIRED":
      nextStatus = "canceled";
      break;

    case "APPROVAL_PENDING":
      nextStatus = "pending";
      break;

    default:
      /*
       * Do not invent an active state if
       * PayPal gives us an unknown status.
       */
      nextStatus =
        existingSubscription.status;
      break;
  }

  const update: Record<
    string,
    unknown
  > = {
    status: nextStatus,
    provider: "paypal",
    provider_subscription_id:
      paypalSubscriptionId,
    updated_at:
      new Date().toISOString(),
  };

  if (
    paypalSubscription.subscriber
      ?.payer_id
  ) {
    update.provider_customer_id =
      paypalSubscription.subscriber.payer_id;
  }

  if (
    paypalSubscription.start_time
  ) {
    update.started_at =
      paypalSubscription.start_time;

    update.current_period_start =
      paypalSubscription.start_time;
  }

  if (
    paypalSubscription.billing_info
      ?.next_billing_time
  ) {
    update.current_period_end =
      paypalSubscription.billing_info
        .next_billing_time;
  }

  if (nextStatus === "canceled") {
    update.canceled_at =
      new Date().toISOString();

    update.cancel_at_period_end =
      false;
  }

  const {
    data: updatedSubscription,
    error: updateError,
  } = await admin
    .from("subscriptions")
    .update(update)
    .eq(
      "id",
      existingSubscription.id,
    )
    .select(
      `
        id,
        company_id,
        plan_id,
        status,
        billing_cycle,
        amount,
        currency,
        provider,
        provider_customer_id,
        provider_subscription_id,
        started_at,
        current_period_start,
        current_period_end
      `,
    )
    .single();

  if (updateError) {
    throw new Error(
      `Unable to update SBS subscription: ${updateError.message}`,
    );
  }

  return {
    subscription:
      updatedSubscription,
    paypal: {
      id: paypalSubscription.id,
      status: paypalStatus,
      planId:
        paypalSubscription.plan_id ??
        null,
      startTime:
        paypalSubscription.start_time ??
        null,
      nextBillingTime:
        paypalSubscription.billing_info
          ?.next_billing_time ??
        null,
    },
  };
}