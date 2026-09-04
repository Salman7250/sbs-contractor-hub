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

function getString(
  value: unknown
): string | null {
  return typeof value === "string" &&
    value.trim()
    ? value
    : null;
}

function getResourceId(
  resource: Record<string, unknown>
): string | null {
  return (
    getString(resource.id) ??
    getString(
      resource.billing_agreement_id
    ) ??
    getString(
      resource.parent_payment
    )
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
  | "incomplete_expired" {
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

        default:
          return "incomplete";
      }
    }

    default:
      return "incomplete";
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

  const amount =
    Number(rawAmount);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw new Error(
      "PayPal payment contains an invalid amount."
    );
  }

  const currency =
    resource.amount?.currency_code ??
    resource.amount?.currency ??
    "USD";

  if (
    !/^[A-Z]{3}$/i.test(currency)
  ) {
    throw new Error(
      "PayPal payment contains an invalid currency."
    );
  }

  return {
    amount,
    currency:
      currency.toUpperCase(),
  };
}

async function findSubscriptionByPayPalId(
  admin: ReturnType<
    typeof createAdminClient
  >,
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
  admin: ReturnType<
    typeof createAdminClient
  >,
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
   * We do not create a local subscription
   * blindly here because we need a trusted
   * company + plan mapping.
   */
  if (!existing) {
    throw new Error(
      `No SBS subscription found for PayPal subscription ${paypalSubscriptionId}.`
    );
  }

  const newStatus =
    getSubscriptionStatus(
      event.event_type,
      resource
    );

  const update: Record<
    string,
    unknown
  > = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (
    resource.start_time
  ) {
    update.started_at =
      resource.start_time;
  }

  if (
    resource.billing_info
      ?.next_billing_time
  ) {
    update.current_period_end =
      resource.billing_info.next_billing_time;
  }

  if (
    newStatus ===
    "canceled"
  ) {
    update.canceled_at =
      new Date().toISOString();

    update.cancel_at_period_end =
      false;
  }

  if (
    event.event_type ===
    "BILLING.SUBSCRIPTION.UPDATED"
  ) {
    /*
     * Do not automatically clear
     * cancel_at_period_end based only
     * on a generic UPDATED event.
     *
     * PayPal's subscription state is
     * authoritative for cancellation,
     * while SBS keeps its own billing
     * lifecycle fields.
     */
  }

  const {
    error,
  } = await admin
    .from("subscriptions")
    .update(update)
    .eq(
      "id",
      existing.id
    );

  if (error) {
    throw new Error(
      `Unable to update SBS subscription: ${error.message}`
    );
  }

  /*
   * Entitlements are synchronized by
   * the existing database trigger on
   * subscriptions.
   */
  return {
    subscriptionId:
      existing.id,
    companyId:
      existing.company_id,
    status:
      newStatus,
  };
}

async function processPaymentEvent(
  admin: ReturnType<
    typeof createAdminClient
  >,
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

  if (
    paypalSubscriptionId
  ) {
    subscription =
      await findSubscriptionByPayPalId(
        admin,
        paypalSubscriptionId
      );
  }

  /*
   * If PayPal didn't provide a billing
   * agreement ID, try the subscription
   * ID from the event resource when
   * available.
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
        "id, company_id, subscription_id"
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
        paymentId:
          data.id,
        companyId:
          data.company_id,
        subscriptionId:
          data.subscription_id,
        alreadyProcessed:
          true,
      };
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
      break;

    case "PAYMENT.SALE.REVERSED":
      status = "failed";
      paymentType =
        "adjustment";
      break;

    default:
      throw new Error(
        `Unsupported PayPal payment event: ${event.event_type}`
      );
  }

  /*
   * Idempotency:
   *
   * The provider transaction ID is
   * unique at the application level.
   *
   * We check before inserting so
   * duplicate PayPal deliveries do not
   * create duplicate payments.
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
      paymentId
    )
    .maybeSingle();

  if (
    existingPaymentError
  ) {
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
      alreadyProcessed:
        true,
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
        paymentId,

      provider_order_id:
        paypalSubscriptionId,

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

      metadata: {
        paypal_event_id:
          event.id,

        paypal_event_type:
          event.event_type,

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
    /*
     * A concurrent webhook could have
     * inserted the same transaction.
     *
     * Re-check before treating it as a
     * fatal error.
     */
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
        paymentId
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
        alreadyProcessed:
          true,
      };
    }

    throw new Error(
      `Unable to create SBS payment: ${paymentError.message}`
    );
  }

  return {
    paymentId:
      payment.id,
    companyId:
      payment.company_id,
    subscriptionId:
      payment.subscription_id,
    alreadyProcessed:
      false,
  };
}

async function storeWebhookEvent(
  admin: ReturnType<
    typeof createAdminClient
  >,
  event: PayPalWebhookEvent
) {
  const resourceId =
    getResourceId(
      event.resource
    );

  /*
   * provider_event_id has a UNIQUE
   * constraint.
   *
   * Using upsert makes webhook receipt
   * itself idempotent.
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
  admin: ReturnType<
    typeof createAdminClient
  >,
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
  admin: ReturnType<
    typeof createAdminClient
  >,
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
     * Check whether this event was
     * already successfully processed.
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
      | Record<
          string,
          unknown
        >
      | null = null;

    /*
     * Subscription lifecycle events.
     */
    if (
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
     * We deliberately reject unexpected
     * events rather than silently treating
     * them as successful.
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
     * Return 500 so PayPal knows the
     * event was not successfully
     * processed and can retry it.
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