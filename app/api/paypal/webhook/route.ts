import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyPayPalWebhook,
  type PayPalWebhookEvent,
} from "@/lib/paypal/webhooks";

type SubscriptionResource = {
  id?: string;
  status?: string;
  plan_id?: string;
  custom_id?: string;
  start_time?: string;
  create_time?: string;
  update_time?: string;

  billing_info?: {
    outstanding_balance?: {
      currency_code?: string;
      value?: string;
    };

    cycle_executions?: Array<{
      tenure_type?: string;
      cycles_completed?: number;
      cycles_remaining?: number;
      current_pricing_scheme?: {
        fixed_price?: {
          value?: string;
          currency_code?: string;
        };
      };
    }>;

    next_billing_time?: string;
    failed_payments_count?: number;

    last_payment?: {
      amount?: {
        currency_code?: string;
        value?: string;
      };
      time?: string;
    };

    last_failed_payment?: {
      amount?: {
        currency_code?: string;
        value?: string;
      };
      time?: string;
      reason_code?: string;
      next_payment_retry_time?: string;
    };
  };
};

type PaymentResource = {
  id?: string;

  amount?: {
    total?: string;
    value?: string;
    currency?: string;
    currency_code?: string;
  };

  state?: string;
  payment_mode?: string;
  create_time?: string;
  update_time?: string;

  billing_agreement_id?: string;
  parent_payment?: string;

  transaction_fee?: {
    value?: string;
    currency?: string;
  };

  links?: Array<{
    href?: string;
    rel?: string;
  }>;
};

const SUBSCRIPTION_EVENTS = new Set([
  "BILLING.SUBSCRIPTION.CREATED",
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
]);

const PAYMENT_EVENTS = new Set([
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.REFUNDED",
  "PAYMENT.SALE.REVERSED",
]);

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function getResourceId(
  resource: Record<string, unknown>
): string | null {
  return (
    getString(resource.id) ??
    getString(resource.billing_agreement_id) ??
    getString(resource.parent_payment)
  );
}

function getSubscriptionStatus(
  eventType: string,
  resource: SubscriptionResource
):
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | null {
  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
      return "active";

    case "BILLING.SUBSCRIPTION.CANCELLED":
      return "canceled";

    case "BILLING.SUBSCRIPTION.SUSPENDED":
      return "paused";

    case "BILLING.SUBSCRIPTION.EXPIRED":
      return "canceled";

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      return "past_due";

    case "BILLING.SUBSCRIPTION.CREATED":
      return "incomplete";

    case "BILLING.SUBSCRIPTION.UPDATED": {
      switch (resource.status) {
        case "ACTIVE":
          return "active";

        case "SUSPENDED":
          return "paused";

        case "CANCELLED":
          return "canceled";

        case "EXPIRED":
          return "canceled";

        case "APPROVAL_PENDING":
          return "incomplete";

        /*
         * Unknown PayPal states must NOT
         * downgrade an existing SBS subscription.
         *
         * Returning null tells the caller
         * to leave the local status unchanged.
         */
        default:
          return null;
      }
    }

    default:
      return null;
  }
}

function getPaymentAmount(
  resource: PaymentResource
): {
  amount: number;
  currency: string;
} {
  const rawAmount =
    resource.amount?.value ??
    resource.amount?.total ??
    "0";

  const amount = Number(rawAmount);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(
      "PayPal payment contains an invalid amount."
    );
  }

  const currency =
    resource.amount?.currency_code ??
    resource.amount?.currency ??
    "USD";

  if (!/^[A-Z]{3}$/i.test(currency)) {
    throw new Error(
      "PayPal payment contains an invalid currency."
    );
  }

  return {
    amount,
    currency: currency.toUpperCase(),
  };
}

function getSubscriptionPaymentAmount(
  resource: SubscriptionResource
): {
  amount: number;
  currency: string;
} {
  const rawAmount =
    resource.billing_info?.last_failed_payment
      ?.amount?.value ??
    resource.billing_info?.outstanding_balance
      ?.value ??
    "0";

  const amount = Number(rawAmount);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(
      "PayPal failed-payment event contains an invalid amount."
    );
  }

  const currency =
    resource.billing_info?.last_failed_payment
      ?.amount?.currency_code ??
    resource.billing_info?.outstanding_balance
      ?.currency_code ??
    "USD";

  if (!/^[A-Z]{3}$/i.test(currency)) {
    throw new Error(
      "PayPal failed-payment event contains an invalid currency."
    );
  }

  return {
    amount,
    currency: currency.toUpperCase(),
  };
}

async function findSubscriptionByPayPalId(
  admin: ReturnType<typeof createAdminClient>,
  paypalSubscriptionId: string
) {
  const {
    data,
    error,
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
        provider_subscription_id
      `
    )
    .eq(
      "provider_subscription_id",
      paypalSubscriptionId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find SBS subscription: ${error.message}`
    );
  }

  return data;
}

async function updateSubscriptionFromPayPal(
  admin: ReturnType<typeof createAdminClient>,
  event: PayPalWebhookEvent
) {
  const resource =
    event.resource as SubscriptionResource;

  const paypalSubscriptionId =
    getString(resource.id);

  if (!paypalSubscriptionId) {
    throw new Error(
      "PayPal subscription event does not contain a subscription ID."
    );
  }

  const existing =
    await findSubscriptionByPayPalId(
      admin,
      paypalSubscriptionId
    );

  /*
   * A subscription webhook can arrive
   * before our local record exists.
   *
   * We deliberately fail here so PayPal
   * retries the event instead of creating
   * an untrusted subscription locally.
   */
  if (!existing) {
    throw new Error(
      `No SBS subscription found for PayPal subscription ${paypalSubscriptionId}.`
    );
  }

  /*
   * PAYMENT.FAILED has its own payment
   * record handling below, but it also
   * changes the subscription lifecycle.
   */
  const newStatus =
    getSubscriptionStatus(
      event.event_type,
      resource
    );

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (newStatus) {
    update.status = newStatus;
  }

  if (resource.start_time) {
    update.started_at =
      resource.start_time;
  }

  if (
    resource.billing_info?.next_billing_time
  ) {
    update.current_period_end =
      resource.billing_info.next_billing_time;
  }

  if (newStatus === "canceled") {
    update.canceled_at =
      resource.update_time ??
      new Date().toISOString();

    update.cancel_at_period_end = false;
  }

  /*
   * For an active subscription, PayPal's
   * next billing time becomes our current
   * period end.
   */
  if (
    newStatus === "active" &&
    resource.billing_info?.next_billing_time
  ) {
    update.current_period_end =
      resource.billing_info.next_billing_time;
  }

  const {
    error,
  } = await admin
    .from("subscriptions")
    .update(update)
    .eq("id", existing.id);

  if (error) {
    throw new Error(
      `Unable to update SBS subscription: ${error.message}`
    );
  }

  return {
    subscriptionId: existing.id,
    companyId: existing.company_id,
    status:
      newStatus ?? existing.status,
  };
}

async function processFailedSubscriptionPayment(
  admin: ReturnType<typeof createAdminClient>,
  event: PayPalWebhookEvent
) {
  const resource =
    event.resource as SubscriptionResource;

  const paypalSubscriptionId =
    getString(resource.id);

  if (!paypalSubscriptionId) {
    throw new Error(
      "PayPal failed-payment event does not contain a subscription ID."
    );
  }

  const subscription =
    await findSubscriptionByPayPalId(
      admin,
      paypalSubscriptionId
    );

  if (!subscription) {
    throw new Error(
      `No SBS subscription could be mapped to PayPal failed payment for subscription ${paypalSubscriptionId}.`
    );
  }

  const {
    amount,
    currency,
  } =
    getSubscriptionPaymentAmount(
      resource
    );

  /*
   * The PayPal event ID is used as the
   * SBS idempotency key for failed
   * subscription-payment events.
   *
   * This is intentionally NOT the PayPal
   * subscription ID because one subscription
   * can have many failed payment attempts.
   */
  const providerTransactionId =
    `failed-${event.id}`;

  const {
    data: existingPayment,
    error:
      existingPaymentError,
  } = await admin
    .from("payments")
    .select(
      `
        id,
        company_id,
        subscription_id,
        status
      `
    )
    .eq(
      "provider_transaction_id",
      providerTransactionId
    )
    .maybeSingle();

  if (existingPaymentError) {
    throw new Error(
      `Unable to check existing failed payment: ${existingPaymentError.message}`
    );
  }

  if (existingPayment) {
    return {
      paymentId: existingPayment.id,
      companyId:
        existingPayment.company_id,
      subscriptionId:
        existingPayment.subscription_id,
      alreadyProcessed: true,
    };
  }

  const {
    data: payment,
    error: paymentError,
  } = await admin
    .from("payments")
    .insert({
      company_id:
        subscription.company_id,

      subscription_id:
        subscription.id,

      provider:
        "paypal",

      provider_transaction_id:
        providerTransactionId,

      provider_order_id:
        paypalSubscriptionId,

      amount,

      currency,

      status:
        "failed",

      payment_type:
        "subscription",

      payment_method:
        "paypal",

      paid_at:
        null,

      refunded_at:
        null,

      failure_reason:
        resource.billing_info
          ?.last_failed_payment
          ?.reason_code ??
        "PayPal subscription payment failed.",

      metadata: {
        paypal_event_id:
          event.id,

        paypal_event_type:
          event.event_type,

        paypal_subscription_id:
          paypalSubscriptionId,

        failed_payments_count:
          resource.billing_info
            ?.failed_payments_count ??
          null,

        failed_payment_time:
          resource.billing_info
            ?.last_failed_payment
            ?.time ??
          null,

        next_payment_retry_time:
          resource.billing_info
            ?.last_failed_payment
            ?.next_payment_retry_time ??
          null,

        failure_reason_code:
          resource.billing_info
            ?.last_failed_payment
            ?.reason_code ??
          null,

        paypal_resource:
          event.resource,
      },
    })
    .select(
      `
        id,
        company_id,
        subscription_id,
        status
      `
    )
    .single();

  if (paymentError) {
    const {
      data: concurrentPayment,
    } = await admin
      .from("payments")
      .select(
        `
          id,
          company_id,
          subscription_id,
          status
        `
      )
      .eq(
        "provider_transaction_id",
        providerTransactionId
      )
      .maybeSingle();

    if (concurrentPayment) {
      return {
        paymentId:
          concurrentPayment.id,
        companyId:
          concurrentPayment.company_id,
        subscriptionId:
          concurrentPayment.subscription_id,
        alreadyProcessed: true,
      };
    }

    throw new Error(
      `Unable to create failed SBS payment: ${paymentError.message}`
    );
  }

  return {
    paymentId: payment.id,
    companyId:
      payment.company_id,
    subscriptionId:
      payment.subscription_id,
    alreadyProcessed: false,
  };
}

async function processPaymentEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: PayPalWebhookEvent
) {
  const resource =
    event.resource as PaymentResource;

  const paymentId =
    getString(resource.id);

  if (!paymentId) {
    throw new Error(
      "PayPal payment event does not contain a payment ID."
    );
  }

  const paypalSubscriptionId =
    getString(
      resource.billing_agreement_id
    );

  let subscription:
    | Awaited<
        ReturnType<
          typeof findSubscriptionByPayPalId
        >
      >
    | null = null;

  if (paypalSubscriptionId) {
    subscription =
      await findSubscriptionByPayPalId(
        admin,
        paypalSubscriptionId
      );
  }

  /*
   * For some PayPal payment events,
   * billing_agreement_id may be absent.
   *
   * parent_payment can be useful for
   * finding an existing SBS payment.
   */
  if (
    !subscription &&
    getString(resource.parent_payment)
  ) {
    const {
      data,
      error,
    } = await admin
      .from("payments")
      .select(
        `
          id,
          company_id,
          subscription_id
        `
      )
      .eq(
        "provider_transaction_id",
        paymentId
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to look up existing payment: ${error.message}`
      );
    }

    if (data) {
      return {
        paymentId: data.id,
        companyId:
          data.company_id,
        subscriptionId:
          data.subscription_id,
        alreadyProcessed: true,
      };
    }
  }

  /*
   * Refund events can reference the
   * original sale, so if PayPal does not
   * provide a billing agreement ID we
   * attempt to map the refund through the
   * original transaction.
   */
  if (
    !subscription &&
    event.event_type ===
      "PAYMENT.SALE.REFUNDED"
  ) {
    const {
      data,
      error,
    } = await admin
      .from("payments")
      .select(
        `
          id,
          company_id,
          subscription_id
        `
      )
      .eq(
        "provider_transaction_id",
        paymentId
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to map PayPal refund to original payment: ${error.message}`
      );
    }

    if (data) {
      subscription =
        await findSubscriptionById(
          admin,
          data.subscription_id
        );
    }
  }

  if (!subscription) {
    throw new Error(
      `No SBS subscription could be mapped to PayPal payment ${paymentId}.`
    );
  }

  const {
    amount,
    currency,
  } =
    getPaymentAmount(
      resource
    );

  let status:
    | "succeeded"
    | "refunded"
    | "failed"
    | "canceled";

  let paymentType:
    | "subscription"
    | "refund"
    | "adjustment";

  /*
   * IMPORTANT:
   *
   * Refunds must NOT reuse the original
   * provider_transaction_id.
   *
   * Otherwise the original successful
   * payment would make the refund appear
   * to be a duplicate.
   */
  let providerTransactionId =
    paymentId;

  switch (event.event_type) {
    case "PAYMENT.SALE.COMPLETED":
      status = "succeeded";
      paymentType =
        "subscription";
      break;

    case "PAYMENT.SALE.REFUNDED":
      status = "refunded";
      paymentType =
        "refund";

      providerTransactionId =
        `refund-${event.id}`;
      break;

    case "PAYMENT.SALE.REVERSED":
      status = "failed";
      paymentType =
        "adjustment";

      providerTransactionId =
        `reversed-${event.id}`;
      break;

    default:
      throw new Error(
        `Unsupported PayPal payment event: ${event.event_type}`
      );
  }

  /*
   * Application-level idempotency.
   *
   * Successful sale:
   *   original PayPal transaction ID
   *
   * Refund:
   *   refund + PayPal event ID
   *
   * Reversal:
   *   reversed + PayPal event ID
   */
  const {
    data: existingPayment,
    error:
      existingPaymentError,
  } = await admin
    .from("payments")
    .select(
      `
        id,
        company_id,
        subscription_id,
        status
      `
    )
    .eq(
      "provider_transaction_id",
      providerTransactionId
    )
    .maybeSingle();

  if (existingPaymentError) {
    throw new Error(
      `Unable to check existing payment: ${existingPaymentError.message}`
    );
  }

  if (existingPayment) {
    return {
      paymentId:
        existingPayment.id,
      companyId:
        existingPayment.company_id,
      subscriptionId:
        existingPayment.subscription_id,
      alreadyProcessed: true,
    };
  }

  const {
    data: payment,
    error: paymentError,
  } = await admin
    .from("payments")
    .insert({
      company_id:
        subscription.company_id,

      subscription_id:
        subscription.id,

      provider:
        "paypal",

      provider_transaction_id:
        providerTransactionId,

      provider_order_id:
        paypalSubscriptionId ??
        paymentId,

      amount,

      currency,

      status,

      payment_type:
        paymentType,

      payment_method:
        "paypal",

      paid_at:
        event.event_type ===
        "PAYMENT.SALE.COMPLETED"
          ? resource.create_time ??
            new Date().toISOString()
          : null,

      refunded_at:
        event.event_type ===
        "PAYMENT.SALE.REFUNDED"
          ? resource.update_time ??
            new Date().toISOString()
          : null,

      failure_reason:
        event.event_type ===
        "PAYMENT.SALE.REVERSED"
          ? "PayPal payment was reversed."
          : null,

      metadata: {
        paypal_event_id:
          event.id,

        paypal_event_type:
          event.event_type,

        paypal_original_transaction_id:
          paymentId,

        paypal_subscription_id:
          paypalSubscriptionId,

        paypal_parent_payment:
          resource.parent_payment ??
          null,

        paypal_resource:
          event.resource,
      },
    })
    .select(
      `
        id,
        company_id,
        subscription_id,
        status
      `
    )
    .single();

  if (paymentError) {
    const {
      data: concurrentPayment,
    } = await admin
      .from("payments")
      .select(
        `
          id,
          company_id,
          subscription_id,
          status
        `
      )
      .eq(
        "provider_transaction_id",
        providerTransactionId
      )
      .maybeSingle();

    if (concurrentPayment) {
      return {
        paymentId:
          concurrentPayment.id,
        companyId:
          concurrentPayment.company_id,
        subscriptionId:
          concurrentPayment.subscription_id,
        alreadyProcessed: true,
      };
    }

    throw new Error(
      `Unable to create SBS payment: ${paymentError.message}`
    );
  }

  /*
   * A successful PayPal sale means the
   * subscription should be active.
   *
   * This is deliberately handled here
   * instead of relying exclusively on the
   * subscription webhook because payment
   * and subscription events can arrive in
   * different orders.
   */
  if (
    event.event_type ===
    "PAYMENT.SALE.COMPLETED"
  ) {
    const {
      error:
        subscriptionUpdateError,
    } = await admin
      .from("subscriptions")
      .update({
        status: "active",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        subscription.id
      )
      .in("status", [
        "incomplete",
        "past_due",
      ]);

    if (subscriptionUpdateError) {
      throw new Error(
        `Payment succeeded but SBS subscription could not be activated: ${subscriptionUpdateError.message}`
      );
    }
  }

  return {
    paymentId:
      payment.id,
    companyId:
      payment.company_id,
    subscriptionId:
      payment.subscription_id,
    alreadyProcessed: false,
  };
}

async function findSubscriptionById(
  admin: ReturnType<typeof createAdminClient>,
  subscriptionId: string
) {
  const {
    data,
    error,
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
        provider_subscription_id
      `
    )
    .eq(
      "id",
      subscriptionId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find SBS subscription: ${error.message}`
    );
  }

  return data;
}

async function storeWebhookEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: PayPalWebhookEvent
) {
  const resourceId =
    getResourceId(
      event.resource
    );

  /*
   * provider_event_id is protected by
   * a UNIQUE index.
   *
   * This makes receiving the same PayPal
   * event multiple times safe.
   */
  const {
    data,
    error,
  } = await admin
    .from("paypal_webhook_events")
    .upsert(
      {
        provider_event_id:
          event.id,

        event_type:
          event.event_type,

        resource_type:
          event.resource_type ??
          null,

        resource_id:
          resourceId,

        status:
          "received",

        payload:
          event,

        received_at:
          new Date().toISOString(),
      },
      {
        onConflict:
          "provider_event_id",
        ignoreDuplicates:
          true,
      }
    )
    .select(
      "id, status"
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to store PayPal webhook event: ${error.message}`
    );
  }

  return data;
}

async function markWebhookProcessed(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string
) {
  const {
    error,
  } = await admin
    .from("paypal_webhook_events")
    .update({
      status:
        "processed",

      processed_at:
        new Date().toISOString(),

      error_message:
        null,
    })
    .eq(
      "provider_event_id",
      eventId
    );

  if (error) {
    throw new Error(
      `Unable to mark PayPal webhook as processed: ${error.message}`
    );
  }
}

async function markWebhookFailed(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  errorMessage: string
) {
  const {
    error,
  } = await admin
    .from("paypal_webhook_events")
    .update({
      status:
        "failed",

      error_message:
        errorMessage,
    })
    .eq(
      "provider_event_id",
      eventId
    );

  if (error) {
    console.error(
      "Unable to mark PayPal webhook as failed:",
      error
    );
  }
}

export async function POST(
  request: Request
) {
  const admin =
    createAdminClient();

  let event:
    | PayPalWebhookEvent
    | null = null;

  try {
    /*
     * Read the raw body first.
     *
     * PayPal signature verification must
     * receive the exact webhook payload.
     */
    const rawBody =
      await request.text();

    if (!rawBody) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Empty PayPal webhook body.",
        },
        {
          status: 400,
        }
      );
    }

    try {
      event =
        JSON.parse(
          rawBody
        ) as PayPalWebhookEvent;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid JSON webhook body.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !event.id ||
      !event.event_type ||
      !event.resource
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid PayPal webhook payload.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * PayPal signature headers.
     */
    const transmissionId =
      request.headers.get(
        "paypal-transmission-id"
      ) ?? "";

    const transmissionTime =
      request.headers.get(
        "paypal-transmission-time"
      ) ?? "";

    const certUrl =
      request.headers.get(
        "paypal-cert-url"
      ) ?? "";

    const authAlgo =
      request.headers.get(
        "paypal-auth-algo"
      ) ?? "";

    const transmissionSig =
      request.headers.get(
        "paypal-transmission-sig"
      ) ?? "";

    /*
     * NEVER process an unverified
     * PayPal webhook.
     */
    const verified =
      await verifyPayPalWebhook({
        transmissionId,
        transmissionTime,
        certUrl,
        authAlgo,
        transmissionSig,
        webhookEvent:
          event,
      });

    if (!verified) {
      console.error(
        "Rejected unverified PayPal webhook:",
        {
          eventId:
            event.id,
          eventType:
            event.event_type,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "PayPal webhook signature verification failed.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Store the event before processing.
     */
    await storeWebhookEvent(
      admin,
      event
    );

    /*
     * Inspect the stored event.
     */
    const {
      data: existingEvent,
      error:
        existingEventError,
    } = await admin
      .from("paypal_webhook_events")
      .select(
        "id, status"
      )
      .eq(
        "provider_event_id",
        event.id
      )
      .maybeSingle();

    if (
      existingEventError
    ) {
      throw new Error(
        `Unable to inspect webhook event: ${existingEventError.message}`
      );
    }

    /*
     * If this event was successfully
     * processed previously, return success
     * without doing anything again.
     */
    if (
      existingEvent?.status ===
      "processed"
    ) {
      return NextResponse.json(
        {
          success: true,
          duplicate: true,
          message:
            "PayPal webhook was already processed.",
        }
      );
    }

    let result:
      | Record<string, unknown>
      | null = null;

    /*
     * Failed subscription payments need
     * special handling because the PayPal
     * resource is a subscription resource,
     * not a payment resource.
     */
    if (
      event.event_type ===
      "BILLING.SUBSCRIPTION.PAYMENT.FAILED"
    ) {
      result =
        await updateSubscriptionFromPayPal(
          admin,
          event
        );

      const failedPayment =
        await processFailedSubscriptionPayment(
          admin,
          event
        );

      result = {
        ...result,
        failedPayment,
      };
    }

    /*
     * Other subscription lifecycle events.
     */
    else if (
      SUBSCRIPTION_EVENTS.has(
        event.event_type
      )
    ) {
      result =
        await updateSubscriptionFromPayPal(
          admin,
          event
        );
    }

    /*
     * Payment events.
     */
    else if (
      PAYMENT_EVENTS.has(
        event.event_type
      )
    ) {
      result =
        await processPaymentEvent(
          admin,
          event
        );
    }

    /*
     * Unexpected events are rejected
     * rather than silently marked successful.
     */
    else {
      throw new Error(
        `Unsupported PayPal webhook event: ${event.event_type}`
      );
    }

    await markWebhookProcessed(
      admin,
      event.id
    );

    return NextResponse.json(
      {
        success: true,
        eventId:
          event.id,
        eventType:
          event.event_type,
        result,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown PayPal webhook error.";

    console.error(
      "PayPal webhook processing error:",
      {
        eventId:
          event?.id,
        eventType:
          event?.event_type,
        error,
      }
    );

    if (event?.id) {
      await markWebhookFailed(
        admin,
        event.id,
        message
      );
    }

    /*
     * Return 500 so PayPal knows that the
     * event was not successfully processed
     * and can retry it.
     */
    return NextResponse.json(
      {
        success: false,
        error:
          "PayPal webhook processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}