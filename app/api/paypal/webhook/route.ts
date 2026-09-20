import {
  NextRequest,
  NextResponse,
} from "next/server";
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
      "PayPal credentials are not configured.",
    );
  }

  const credentials =
    Buffer.from(
      `${clientId}:${clientSecret}`,
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
      },
    );

  if (!response.ok) {
    throw new Error(
      "Unable to authenticate with PayPal.",
    );
  }

  const data =
    (await response.json()) as {
      access_token?: string;
    };

  if (!data.access_token) {
    throw new Error(
      "PayPal access token missing.",
    );
  }

  return data.access_token;
}

async function verifyWebhookSignature(
  request: NextRequest,
  body: string,
) {
  const webhookId =
    process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    throw new Error(
      "PAYPAL_WEBHOOK_ID is not configured.",
    );
  }

  const transmissionId =
    request.headers.get(
      "paypal-transmission-id",
    );

  const transmissionTime =
    request.headers.get(
      "paypal-transmission-time",
    );

  const certUrl =
    request.headers.get(
      "paypal-cert-url",
    );

  const authAlgo =
    request.headers.get(
      "paypal-auth-algo",
    );

  const transmissionSig =
    request.headers.get(
      "paypal-transmission-sig",
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
      },
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
  value: unknown,
) {
  return typeof value === "string"
    ? value
    : null;
}

function getNumber(
  value: unknown,
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
  request: NextRequest,
) {
  const admin =
    createAdminClient();

  let rawBody = "";

  try {
    rawBody =
      await request.text();

    /*
     * ---------------------------------------------------------
     * Verify PayPal signature.
     * ---------------------------------------------------------
     */

    const verified =
      await verifyWebhookSignature(
        request,
        rawBody,
      );

    if (!verified) {
      return NextResponse.json(
        {
          error:
            "Invalid PayPal webhook signature.",
        },
        { status: 401 },
      );
    }

    const event =
      JSON.parse(
        rawBody,
      ) as PayPalWebhook;

    if (!event.id) {
      return NextResponse.json(
        {
          error:
            "Webhook event ID is missing.",
        },
        { status: 400 },
      );
    }

    const eventType =
      event.event_type ??
      "UNKNOWN";

    const resource =
      event.resource ?? {};

    const resourceId =
      getString(
        resource.id,
      );

    /*
     * ---------------------------------------------------------
     * Idempotency.
     * ---------------------------------------------------------
     */

    const {
      data: existingEvent,
      error:
        existingEventError,
    } = await admin
      .from(
        "paypal_webhook_events",
      )
      .select(
        "id, status",
      )
      .eq(
        "provider_event_id",
        event.id,
      )
      .maybeSingle();

    if (existingEventError) {
      console.error(
        "Webhook event lookup error:",
        existingEventError,
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
     * Store webhook event.
     * ---------------------------------------------------------
     */

    const {
      data: webhookEvent,
      error:
        webhookInsertError,
    } = await admin
      .from(
        "paypal_webhook_events",
      )
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
     * Find the SBS subscription.
     *
     * create-subscription stores our local subscription ID
     * inside PayPal custom_id.
     * ---------------------------------------------------------
     */

    const customId =
      getString(
        resource.custom_id,
      );

    let subscription:
      | {
          id: string;
          company_id: string;
          plan_id: string;
          status: string;
          billing_cycle: string;
          amount: number;
          currency: string;
        }
      | null = null;

    if (customId) {
      const {
        data: localSubscription,
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
            currency
          `,
        )
        .eq(
          "id",
          customId,
        )
        .maybeSingle();

      subscription =
        localSubscription;
    }

    /*
     * Fallback:
     * Find using PayPal subscription ID.
     */

    if (
      !subscription &&
      resourceId
    ) {
      const {
        data: localSubscription,
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
            currency
          `,
        )
        .eq(
          "provider_subscription_id",
          resourceId,
        )
        .maybeSingle();

      subscription =
        localSubscription;
    }

    /*
     * Some payment events use billing_agreement_id.
     */

    if (!subscription) {
      const billingAgreementId =
        getString(
          resource.billing_agreement_id,
        );

      if (billingAgreementId) {
        const {
          data: localSubscription,
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
              currency
            `,
          )
          .eq(
            "provider_subscription_id",
            billingAgreementId,
          )
          .maybeSingle();

        subscription =
          localSubscription;
      }
    }

    /*
     * If unrelated to SBS, record and ignore.
     */

    if (!subscription) {
      await admin
        .from(
          "paypal_webhook_events",
        )
        .update({
          status: "ignored",
          processed_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          webhookEvent.id,
        );

      return NextResponse.json({
        success: true,
        ignored: true,
      });
    }

    const subscriptionId =
      subscription.id;

    const paypalSubscriptionId =
      resourceId;

    const now =
      new Date().toISOString();

    /*
     * ---------------------------------------------------------
     * PayPal subscription events.
     * ---------------------------------------------------------
     */

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

    /*
     * ---------------------------------------------------------
     * ACTIVATED
     *
     * THIS IS THE IMPORTANT PART FOR THE TRIAL FLOW.
     *
     * When the customer pays during their trial:
     *
     * OLD:
     *   trialing
     *
     * NEW:
     *   pending -> active
     *
     * The old trial is preserved in the database but is no
     * longer considered the company's active subscription.
     * ---------------------------------------------------------
     */

    if (
      activeEvents.has(
        eventType,
      )
    ) {
      /*
       * First close any other active/trialing subscription
       * belonging to this company.
       *
       * We exclude the newly activated subscription.
       */

      const {
        data:
          previousSubscriptions,
        error:
          previousSubscriptionError,
      } = await admin
        .from("subscriptions")
        .select(
          `
            id,
            status
          `,
        )
        .eq(
          "company_id",
          subscription.company_id,
        )
        .neq(
          "id",
          subscriptionId,
        )
        .in("status", [
          "trialing",
          "pending",
          "active",
          "approved",
        ]);

      if (
        previousSubscriptionError
      ) {
        throw previousSubscriptionError;
      }

      /*
       * Preserve history:
       *
       * trialing -> expired
       *
       * pending -> canceled
       *
       * active/approved -> canceled
       */

      if (
        previousSubscriptions &&
        previousSubscriptions.length >
          0
      ) {
        for (
          const previous of
            previousSubscriptions
        ) {
          const previousStatus =
            previous.status;

          const nextStatus =
            previousStatus ===
            "trialing"
              ? "expired"
              : "canceled";

          await admin
            .from("subscriptions")
            .update({
              status:
                nextStatus,
              canceled_at:
                previousStatus ===
                "trialing"
                  ? null
                  : now,
              updated_at:
                now,
              provider_metadata: {
                replaced_by_subscription_id:
                  subscriptionId,
                replacement_reason:
                  previousStatus ===
                  "trialing"
                    ? "Trial converted to paid subscription"
                    : "Replaced by newly activated subscription",
              },
            })
            .eq(
              "id",
              previous.id,
            );
        }
      }

      /*
       * Activate the newly purchased subscription.
       */

      const billingInfo =
        resource.billing_info;

      let nextBillingTime:
        | string
        | null = null;

      if (
        billingInfo &&
        typeof billingInfo ===
          "object"
      ) {
        nextBillingTime =
          getString(
            (
              billingInfo as Record<
                string,
                unknown
              >
            ).next_billing_time,
          );
      }

      const startTime =
        getString(
          resource.start_time,
        ) ?? now;

      const {
        error:
          activateError,
      } = await admin
        .from("subscriptions")
        .update({
          status: "active",
          provider: "paypal",
          provider_subscription_id:
            paypalSubscriptionId,
          started_at: startTime,
          current_period_start:
            startTime,
          current_period_end:
            nextBillingTime,
          canceled_at: null,
          cancel_at_period_end:
            false,
          updated_at: now,
          provider_metadata: {
            paypal_event:
              eventType,
            paypal_status:
              getString(
                resource.status,
              ),
            converted_from_trial:
              Boolean(
                previousSubscriptions?.some(
                  (previous) =>
                    previous.status ===
                    "trialing",
                ),
              ),
          },
        })
        .eq(
          "id",
          subscriptionId,
        );

      if (activateError) {
        throw activateError;
      }

      /*
       * -------------------------------------------------------
       * Activate plan entitlements.
       * -------------------------------------------------------
       */

      const {
        data: planModules,
        error:
          planModulesError,
      } = await admin
        .from("plan_modules")
        .select(
          `
            module_id
          `,
        )
        .eq(
          "plan_id",
          subscription.plan_id,
        );

      if (planModulesError) {
        throw planModulesError;
      }

      if (
        planModules &&
        planModules.length > 0
      ) {
        for (
          const planModule of
            planModules
        ) {
          const {
            error:
              entitlementError,
          } = await admin
            .from(
              "company_entitlements",
            )
            .upsert(
              {
                company_id:
                  subscription.company_id,
                module_id:
                  planModule.module_id,
                access:
                  "granted",
                source:
                  "subscription",
                subscription_id:
                  subscriptionId,
                expires_at:
                  null,
                reason:
                  "Active PayPal subscription",
              },
              {
                onConflict:
                  "company_id,module_id",
              },
            );

          if (entitlementError) {
            throw entitlementError;
          }
        }
      }
    } else if (
      pendingEvents.has(
        eventType,
      )
    ) {
      /*
       * PayPal created the subscription but the customer has
       * not completed approval yet.
       */

      await admin
        .from("subscriptions")
        .update({
          status: "pending",
          provider: "paypal",
          provider_subscription_id:
            paypalSubscriptionId,
          updated_at: now,
          provider_metadata: {
            paypal_event:
              eventType,
            paypal_status:
              getString(
                resource.status,
              ),
          },
        })
        .eq(
          "id",
          subscriptionId,
        );
    } else if (
      suspendedEvents.has(
        eventType,
      )
    ) {
      await admin
        .from("subscriptions")
        .update({
          status: "suspended",
          updated_at: now,
          provider_metadata: {
            paypal_event:
              eventType,
            paypal_status:
              getString(
                resource.status,
              ),
          },
        })
        .eq(
          "id",
          subscriptionId,
        );

      await admin
        .from(
          "company_entitlements",
        )
        .update({
          access: "revoked",
          reason:
            "PayPal subscription suspended",
        })
        .eq(
          "subscription_id",
          subscriptionId,
        );
    } else if (
      cancelledEvents.has(
        eventType,
      )
    ) {
      await admin
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at: now,
          updated_at: now,
          provider_metadata: {
            paypal_event:
              eventType,
            paypal_status:
              getString(
                resource.status,
              ),
          },
        })
        .eq(
          "id",
          subscriptionId,
        );

      await admin
        .from(
          "company_entitlements",
        )
        .update({
          access: "revoked",
          reason:
            "PayPal subscription canceled",
        })
        .eq(
          "subscription_id",
          subscriptionId,
        );
    } else if (
      expiredEvents.has(
        eventType,
      )
    ) {
      await admin
        .from("subscriptions")
        .update({
          status: "expired",
          updated_at: now,
          provider_metadata: {
            paypal_event:
              eventType,
            paypal_status:
              getString(
                resource.status,
              ),
          },
        })
        .eq(
          "id",
          subscriptionId,
        );

      await admin
        .from(
          "company_entitlements",
        )
        .update({
          access: "revoked",
          reason:
            "PayPal subscription expired",
        })
        .eq(
          "subscription_id",
          subscriptionId,
        );
    }

    /*
     * ---------------------------------------------------------
     * Payment events.
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
        "PAYMENT.CAPTURE.DECLINED",
        "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
      ]);

    if (
      paymentEvents.has(
        eventType,
      )
    ) {
      const amount =
        getNumber(
          resource.amount ??
            resource.gross_amount ??
            resource.total,
        );

      const currency =
        getString(
          resource.currency ??
            (
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
            ),
        ) ??
        subscription.currency;

      const transactionId =
        getString(
          resource.id,
        );

      const paymentDate =
        getString(
          resource.create_time,
        ) ?? now;

      /*
       * Prevent duplicate payment records.
       */

      let existingPayment = null;

      if (transactionId) {
        const {
          data,
        } = await admin
          .from("payments")
          .select("id")
          .eq(
            "provider",
            "paypal",
          )
          .eq(
            "provider_transaction_id",
            transactionId,
          )
          .maybeSingle();

        existingPayment =
          data;
      }

      if (!existingPayment) {
        await admin
          .from("payments")
          .insert({
            company_id:
              subscription.company_id,
            subscription_id:
              subscriptionId,
            provider: "paypal",
            provider_transaction_id:
              transactionId,
            provider_order_id:
              getString(
                resource.parent_payment,
              ),
            amount:
              amount ?? 0,
            currency,
            status: "completed",
            payment_type:
              "subscription",
            payment_method:
              "paypal",
            paid_at:
              paymentDate,
          });
      }
    }

    if (
      failedPaymentEvents.has(
        eventType,
      )
    ) {
      const failureReason =
        getString(
          resource.reason_code,
        ) ??
        getString(
          resource.status,
        ) ??
        "PayPal payment failed.";

      await admin
        .from("payments")
        .insert({
          company_id:
            subscription.company_id,
          subscription_id:
            subscriptionId,
          provider: "paypal",
          provider_transaction_id:
            resourceId,
          amount:
            getNumber(
              resource.amount,
            ) ?? 0,
          currency:
            subscription.currency,
          status: "failed",
          payment_type:
            "subscription",
          payment_method:
            "paypal",
          failure_reason:
            failureReason,
        });

      await admin
        .from("subscriptions")
        .update({
          status: "past_due",
          updated_at: now,
          provider_metadata: {
            paypal_event:
              eventType,
            paypal_status:
              getString(
                resource.status,
              ),
            failure_reason:
              failureReason,
          },
        })
        .eq(
          "id",
          subscriptionId,
        );
    }

    /*
     * ---------------------------------------------------------
     * Mark webhook processed.
     * ---------------------------------------------------------
     */

    await admin
      .from(
        "paypal_webhook_events",
      )
      .update({
        status: "processed",
        processed_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        webhookEvent.id,
      );

    return NextResponse.json({
      success: true,
      eventType,
    });
  } catch (error) {
    console.error(
      "PayPal webhook processing error:",
      error,
    );

    /*
     * We intentionally return 500 here so PayPal can retry
     * an event that failed during processing.
     */

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 500 },
    );
  }
}