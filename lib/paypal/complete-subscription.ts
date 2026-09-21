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

function getSubscriptionStatus(
  paypalStatus: string,
  currentStatus: string,
) {
  switch (paypalStatus) {
    case "ACTIVE":
      return "active";

    case "SUSPENDED":
      return "paused";

    case "CANCELLED":
      return "canceled";

    case "EXPIRED":
      return "expired";

    case "APPROVAL_PENDING":
      return "pending";

    default:
      return currentStatus;
  }
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
   * ---------------------------------------------------------
   * Get the authoritative subscription state from PayPal.
   * ---------------------------------------------------------
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

  const paypalStatus =
    paypalSubscription.status ??
    "UNKNOWN";

  /*
   * ---------------------------------------------------------
   * Find the local SBS subscription.
   * ---------------------------------------------------------
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
        trial_ends_at,
        current_period_start,
        current_period_end,
        canceled_at,
        cancel_at_period_end
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

  /*
   * ---------------------------------------------------------
   * Determine whether the company still has an active trial.
   *
   * IMPORTANT:
   *
   * We do NOT convert the trial into an active paid
   * subscription simply because PayPal returned ACTIVE.
   *
   * The SBS trial must remain intact until trial_ends_at.
   * ---------------------------------------------------------
   */

  const now = new Date();

  const trialEndsAt =
    existingSubscription.trial_ends_at
      ? new Date(
          existingSubscription.trial_ends_at,
        )
      : null;

  const trialStillActive =
    existingSubscription.status ===
      "trialing" &&
    trialEndsAt !== null &&
    trialEndsAt.getTime() >
      now.getTime();

  /*
   * ---------------------------------------------------------
   * Determine the normal SBS status.
   * ---------------------------------------------------------
   */

  const mappedStatus =
    getSubscriptionStatus(
      paypalStatus,
      existingSubscription.status,
    );

  /*
   * ---------------------------------------------------------
   * Build the update.
   * ---------------------------------------------------------
   */

  const update: Record<
    string,
    unknown
  > = {
    provider: "paypal",
    provider_subscription_id:
      paypalSubscriptionId,
    updated_at:
      now.toISOString(),
  };

  /*
   * PayPal payer ID.
   */

  if (
    paypalSubscription.subscriber
      ?.payer_id
  ) {
    update.provider_customer_id =
      paypalSubscription.subscriber.payer_id;
  }

  /*
   * ---------------------------------------------------------
   * TRIAL PROTECTION
   *
   * If the company is still inside its SBS free trial,
   * keep the local paid subscription pending.
   *
   * The trial record/date is intentionally NOT changed here.
   * ---------------------------------------------------------
   */

  if (trialStillActive) {
    update.status = "pending";

    /*
     * Do not set started_at to PayPal's start time.
     *
     * The paid subscription has not started yet from the
     * SBS customer's perspective.
     */

    /*
     * We also deliberately do not change:
     *
     * - trial_ends_at
     * - current_period_start
     * - current_period_end
     * - canceled_at
     * - cancel_at_period_end
     */

    update.provider_metadata = {
      paypal_status:
        paypalStatus,

      paypal_plan_id:
        paypalSubscription.plan_id ??
        null,

      paypal_start_time:
        paypalSubscription.start_time ??
        null,

      paypal_next_billing_time:
        paypalSubscription.billing_info
          ?.next_billing_time ??
        null,

      trial_protected: true,

      trial_ends_at:
        existingSubscription.trial_ends_at,

      message:
        "PayPal subscription approved during SBS free trial. Paid subscription remains pending until the trial ends.",
    };
  } else {
    /*
     * -------------------------------------------------------
     * NO ACTIVE TRIAL
     *
     * The subscription can now follow PayPal's authoritative
     * state.
     * -------------------------------------------------------
     */

    update.status = mappedStatus;

    /*
     * Only set the paid subscription dates when the
     * subscription is actually active.
     */

    if (
      paypalStatus === "ACTIVE"
    ) {
      const startTime =
        paypalSubscription.start_time ??
        now.toISOString();

      update.started_at =
        startTime;

      update.current_period_start =
        startTime;

      if (
        paypalSubscription.billing_info
          ?.next_billing_time
      ) {
        update.current_period_end =
          paypalSubscription.billing_info
            .next_billing_time;
      }

      update.canceled_at = null;

      update.cancel_at_period_end =
        false;
    }

    /*
     * Canceled subscriptions.
     */

    if (
      paypalStatus === "CANCELLED" ||
      paypalStatus === "EXPIRED"
    ) {
      update.canceled_at =
        now.toISOString();

      update.cancel_at_period_end =
        false;
    }

    update.provider_metadata = {
      paypal_status:
        paypalStatus,

      paypal_plan_id:
        paypalSubscription.plan_id ??
        null,

      paypal_start_time:
        paypalSubscription.start_time ??
        null,

      paypal_next_billing_time:
        paypalSubscription.billing_info
          ?.next_billing_time ??
        null,
    };
  }

  /*
   * ---------------------------------------------------------
   * Save the local subscription.
   * ---------------------------------------------------------
   */

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
        trial_ends_at,
        current_period_start,
        current_period_end,
        canceled_at,
        cancel_at_period_end
      `,
    )
    .single();

  if (updateError) {
    throw new Error(
      `Unable to update SBS subscription: ${updateError.message}`,
    );
  }

  /*
   * ---------------------------------------------------------
   * IMPORTANT:
   *
   * Do NOT grant/revoke entitlements here.
   *
   * The webhook is responsible for the authoritative
   * subscription lifecycle:
   *
   * trial -> paid active
   * suspended
   * canceled
   * expired
   *
   * This prevents the success page from prematurely
   * activating paid modules.
   * ---------------------------------------------------------
   */

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

    trial: {
      stillActive:
        trialStillActive,

      endsAt:
        existingSubscription.trial_ends_at,
    },
  };
}