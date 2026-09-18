import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type PayPalWebhook = {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
  resource_type?: string;
  create_time?: string;
};

function getPayPalBaseUrl() {
  return process.env.PAYPAL_ENVIRONMENT === "live"
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
      "PayPal credentials are not configured."
    );
  }

  const credentials =
    Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

  const response =
    await fetch(
      `${getPayPalBaseUrl()}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Basic ${credentials}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          "grant_type=client_credentials",
        cache: "no-store",
      }
    );

  if (!response.ok) {
    throw new Error(
      "Unable to authenticate with PayPal."
    );
  }

  const data =
    (await response.json()) as {
      access_token?: string;
    };

  if (!data.access_token) {
    throw new Error(
      "PayPal access token missing."
    );
  }

  return data.access_token;
}

async function verifyWebhookSignature(
  request: NextRequest,
  body: string
) {
  const webhookId =
    process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    throw new Error(
      "PAYPAL_WEBHOOK_ID is not configured."
    );
  }

  const transmissionId =
    request.headers.get(
      "paypal-transmission-id"
    );

  const transmissionTime =
    request.headers.get(
      "paypal-transmission-time"
    );

  const certUrl =
    request.headers.get(
      "paypal-cert-url"
    );

  const authAlgo =
    request.headers.get(
      "paypal-auth-algo"
    );

  const transmissionSig =
    request.headers.get(
      "paypal-transmission-sig"
    );

  if (
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  ) {
    return false;
  }

  const accessToken =
    await getPayPalAccessToken();

  const response =
    await fetch(
      `${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
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
          webhook_event:
            JSON.parse(body),
        }),
        cache: "no-store",
      }
    );

  if (!response.ok) {
    return false;
  }

  const result =
    (await response.json()) as {
      verification_status?: string;
    };

  return (
    result.verification_status ===
    "SUCCESS"
  );
}

function getString(
  value: unknown
) {
  return typeof value === "string"
    ? value
    : null;
}

function getNumber(
  value: unknown
) {
  if (
    typeof value === "number"
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const parsed =
      Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

export async function POST(
  request: NextRequest
) {
  const admin =
    createAdminClient();

  let rawBody = "";

  try {
    rawBody =
      await request.text();

    /*
     * ---------------------------------------------------------
     * Verify that the webhook really came from PayPal.
     * ---------------------------------------------------------
     */

    const verified =
      await verifyWebhookSignature(
        request,
        rawBody
      );

    if (!verified) {
      return NextResponse.json(
        {
          error:
            "Invalid PayPal webhook signature.",
        },
        { status: 401 }
      );
    }

    const event =
      JSON.parse(
        rawBody
      ) as PayPalWebhook;

    if (!event.id) {
      return NextResponse.json(
        {
          error:
            "Webhook event ID is missing.",
        },
        { status: 400 }
      );
    }

    const eventType =
      event.event_type ??
      "UNKNOWN";

    const resource =
      event.resource ?? {};

    const resourceId =
      getString(
        resource.id
      );

    /*
     * ---------------------------------------------------------
     * Idempotency.
     *
     * PayPal can send the same event more than once.
     * ---------------------------------------------------------
     */

    const {
      data: existingEvent,
      error: existingEventError,
    } = await admin
      .from("paypal_webhook_events")
      .select("id, status")
      .eq(
        "provider_event_id",
        event.id
      )
      .maybeSingle();

    if (existingEventError) {
      console.error(
        "Webhook event lookup error:",
        existingEventError
      );
    }

    if (existingEvent) {
      return NextResponse.json({
        success: true,
        duplicate: true,
      });
    }

    /*
     * ---------------------------------------------------------
     * Store the event before processing.
     * ---------------------------------------------------------
     */

    const {
      data: webhookEvent,
      error: webhookInsertError,
    } = await admin
      .from("paypal_webhook_events")
      .insert({
        provider_event_id:
          event.id,
        event_type:
          eventType,
        resource_type:
          event.resource_type ??
          null,
        resource_id:
          resourceId,
        status: "received",
        payload: event,
      })
      .select("id")
      .single();

    if (webhookInsertError) {
      /*
       * A concurrent webhook may have inserted the event.
       * Return success so PayPal does not repeatedly retry it.
       */
      if (
        webhookInsertError.code ===
        "23505"
      ) {
        return NextResponse.json({
          success: true,
          duplicate: true,
        });
      }

      throw webhookInsertError;
    }

    /*
     * ---------------------------------------------------------
     * Locate the SBS subscription.
     *
     * Our create-subscription route stores the local SBS
     * subscription ID inside PayPal custom_id.
     * ---------------------------------------------------------
     */

    const customId =
      getString(
        resource.custom_id
      );

    let subscription = null;

    if (customId) {
      const result =
        await admin
          .from("subscriptions")
          .select(
            `
              id,
              company_id,
              plan_id,
              status,
              billing_cycle,
              amount,
              currency
            `
          )
          .eq(
            "id",
            customId
          )
          .maybeSingle();

      subscription =
        result.data;
    }

    /*
     * Fallback: locate by PayPal subscription ID.
     */

    if (
      !subscription &&
      resourceId
    ) {
      const result =
        await admin
          .from("subscriptions")
          .select(
            `
              id,
              company_id,
              plan_id,
              status,
              billing_cycle,
              amount,
              currency
            `
          )
          .eq(
            "provider_subscription_id",
            resourceId
          )
          .maybeSingle();

      subscription =
        result.data;
    }

    /*
     * Some PayPal payment events contain a
     * billing_agreement_id instead of resource.id.
     */

    if (!subscription) {
      const billingAgreementId =
        getString(
          resource.billing_agreement_id
        );

      if (
        billingAgreementId
      ) {
        const result =
          await admin
            .from("subscriptions")
            .select(
              `
                id,
                company_id,
                plan_id,
                status,
                billing_cycle,
                amount,
                currency
              `
            )
            .eq(
              "provider_subscription_id",
              billingAgreementId
            )
            .maybeSingle();

        subscription =
          result.data;
      }
    }

    /*
     * If this event isn't related to one of our subscriptions,
     * record it but don't fail the webhook.
     */

    if (!subscription) {
      await admin
        .from("paypal_webhook_events")
        .update({
          status: "ignored",
          processed_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          webhookEvent.id
        );

      return NextResponse.json({
        success: true,
        ignored: true,
      });
    }

    /*
     * ---------------------------------------------------------
     * Subscription events
     * ---------------------------------------------------------
     */

    const subscriptionId =
      subscription.id;

    const paypalSubscriptionId =
      resourceId;

    const now =
      new Date().toISOString();

    const activeEvents =
      new Set([
        "BILLING.SUBSCRIPTION.ACTIVATED",
        "BILLING.SUBSCRIPTION.RE-ACTIVATED",
      ]);

    const pendingEvents =
      new Set([
        "BILLING.SUBSCRIPTION.CREATED",
        "BILLING.SUBSCRIPTION.APPROVAL_PENDING",
      ]);

    const suspendedEvents =
      new Set([
        "BILLING.SUBSCRIPTION.SUSPENDED",
      ]);

    const cancelledEvents =
      new Set([
        "BILLING.SUBSCRIPTION.CANCELLED",
      ]);

    const expiredEvents =
      new Set([
        "BILLING.SUBSCRIPTION.EXPIRED",
      ]);

    if (
      activeEvents.has(
        eventType
      )
    ) {
      await admin
        .from("subscriptions")
        .update({
          status: "active",
          provider:
            "paypal",
          provider_subscription_id:
            paypalSubscriptionId,
          started_at:
            getString(
              resource.start_time
            ) ?? now,
          current_period_start:
            getString(
              resource.start_time
            ) ?? now,
          current_period_end:
            getString(
              resource.billing_info &&
                typeof resource.billing_info ===
                  "object"
                ? (
                    resource.billing_info as Record<
                      string,
                      unknown
                    >
                  ).next_billing_time
                : null
            ),
          provider_metadata: {
            paypal_event:
              eventType,
            paypal_status:
              getString(
                resource.status
              ),
          },
        })
        .eq(
          "id",
          subscriptionId
        );

      /*
       * Activate company entitlements from plan modules.
       */

      const {
        data: planModules,
      } = await admin
        .from("plan_modules")
        .select(
          `
            module_id
          `
        )
        .eq(
          "plan_id",
          subscription.plan_id
        );

      if (
        planModules &&
        planModules.length > 0
      ) {
        for (
          const planModule of planModules
        ) {
          await admin
            .from(
              "company_entitlements"
            )
            .upsert(
              {
                company_id:
                  subscription.company_id,
                module_id:
                  planModule.module_id,
                access: "granted",
                source:
                  "subscription",
                subscription_id:
                  subscriptionId,
                expires_at: null,
                reason:
                  "Active PayPal subscription",
              },
              {
                onConflict:
                  "company_id,module_id",
              }
            );
        }
      }
    } else if (
      pendingEvents.has(
        eventType
      )
    ) {
      await admin
        .from("subscriptions")
        .update({
          status: "pending",
          provider:
            "paypal",
          provider_subscription_id:
            paypalSubscriptionId,
          provider_metadata: {
            paypal_event:
              eventType,
            paypal_status:
              getString(
                resource.status
              ),
          },
        })
        .eq(
          "id",
          subscriptionId
        );
    } else if (
      suspendedEvents.has(
        eventType
      )
    ) {
      await admin
        .from("subscriptions")
        .update({
          status: "suspended",
          provider_metadata: {
            paypal_event:
              eventType,
            paypal_status:
              getString(
                resource.status
              ),
          },
        })
        .eq(
          "id",
          subscriptionId
        );

      await admin
        .from(
          "company_entitlements"
        )
        .update({
          access: "revoked",
          reason:
            "PayPal subscription suspended",
        })
        .eq(
          "subscription_id",
          subscriptionId
        );
    } else if (
      cancelledEvents.has(
        eventType
      )
    ) {
      await admin
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at: now,
          provider_metadata: {
            paypal_event:
              eventType,
            paypal_status:
              getString(
                resource.status
              ),
          },
        })
        .eq(
          "id",
          subscriptionId
        );

      await admin
        .from(
          "company_entitlements"
        )
        .update({
          access: "revoked",
          reason:
            "PayPal subscription canceled",
        })
        .eq(
          "subscription_id",
          subscriptionId
        );
    } else if (
      expiredEvents.has(
        eventType
      )
    ) {
      await admin
        .from("subscriptions")
        .update({
          status: "expired",
          provider_metadata: {
            paypal_event:
              eventType,
            paypal_status:
              getString(
                resource.status
              ),
          },
        })
        .eq(
          "id",
          subscriptionId
        );

      await admin
        .from(
          "company_entitlements"
        )
        .update({
          access: "revoked",
          reason:
            "PayPal subscription expired",
        })
        .eq(
          "subscription_id",
          subscriptionId
        );
    }

    /*
     * ---------------------------------------------------------
     * Payment events
     * ---------------------------------------------------------
     */

    const paymentEvents =
      new Set([
        "PAYMENT.SALE.COMPLETED",
        "PAYMENT.CAPTURE.COMPLETED",
        "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED",
      ]);

    const failedPaymentEvents =
      new Set([
        "PAYMENT.SALE.DENIED",
        "PAYMENT.CAPTURE.DENIED",
        "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
      ]);

    if (
      paymentEvents.has(
        eventType
      )
    ) {
      const amount =
        getNumber(
          resource.amount &&
            typeof resource.amount ===
              "object"
            ? (
                resource.amount as Record<
                  string,
                  unknown
                >
              ).value
            : resource.amount
        );

      const currency =
        getString(
          resource.amount &&
            typeof resource.amount ===
              "object"
            ? (
                resource.amount as Record<
                  string,
                  unknown
                >
              ).currency_code
            : null
        ) ??
        subscription.currency;

      await admin
        .from("payments")
        .insert({
          company_id:
            subscription.company_id,
          subscription_id:
            subscriptionId,
          provider:
            "paypal",
          provider_transaction_id:
            resourceId,
          provider_order_id:
            getString(
              resource.order_id
            ),
          amount:
            amount ??
            subscription.amount,
          currency,
          status: "completed",
          payment_type:
            "subscription",
          payment_method:
            "paypal",
          paid_at:
            getString(
              resource.create_time
            ) ?? now,
          metadata: {
            paypal_event:
              eventType,
            resource,
          },
        });

      await admin
        .from("subscriptions")
        .update({
          status: "active",
        })
        .eq(
          "id",
          subscriptionId
        );
    }

    if (
      failedPaymentEvents.has(
        eventType
      )
    ) {
      const failureReason =
        getString(
          resource.reason_code
        ) ??
        getString(
          resource.status
        ) ??
        "PayPal payment failed.";

      await admin
        .from("payments")
        .insert({
          company_id:
            subscription.company_id,
          subscription_id:
            subscriptionId,
          provider:
            "paypal",
          provider_transaction_id:
            resourceId,
          provider_order_id:
            getString(
              resource.order_id
            ),
          amount:
            subscription.amount,
          currency:
            subscription.currency,
          status: "failed",
          payment_type:
            "subscription",
          payment_method:
            "paypal",
          failure_reason:
            failureReason,
          metadata: {
            paypal_event:
              eventType,
            resource,
          },
        });
    }

    /*
     * ---------------------------------------------------------
     * Mark webhook processed.
     * ---------------------------------------------------------
     */

    await admin
      .from("paypal_webhook_events")
      .update({
        status: "processed",
        processed_at: now,
        error_message: null,
      })
      .eq(
        "id",
        webhookEvent.id
      );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "PayPal webhook error:",
      error
    );

    /*
     * We intentionally return 500 so PayPal can retry the event
     * when processing failed.
     */

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}