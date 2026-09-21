import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type BillingCycle = "monthly" | "yearly";

type RequestBody = {
  planSlug?: string;
  billingCycle?: BillingCycle;
};

type PayPalTokenResponse = {
  access_token?: string;
};

type PayPalSubscriptionResponse = {
  id?: string;
  status?: string;
  links?: Array<{
    href: string;
    rel: string;
    method?: string;
  }>;
};

type ExistingSubscription = {
  id: string;
  status: string;
  provider_subscription_id: string | null;
  plan_id: string;
  billing_cycle: string;
  trial_ends_at: string | null;
};

function getPayPalBaseUrl() {
  const environment =
    process.env.PAYPAL_ENVIRONMENT ?? "sandbox";

  return environment === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

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
      body: "grant_type=client_credentials",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Unable to authenticate with PayPal: ${text}`,
    );
  }

  const data =
    (await response.json()) as PayPalTokenResponse;

  if (!data.access_token) {
    throw new Error(
      "PayPal did not return an access token.",
    );
  }

  return data.access_token;
}

export async function POST(
  request: NextRequest,
) {
  try {
    const supabase = await createClient();

    /*
     * ---------------------------------------------------------
     * Authenticate user.
     * ---------------------------------------------------------
     */

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to continue.",
        },
        { status: 401 },
      );
    }

    /*
     * ---------------------------------------------------------
     * Read request.
     * ---------------------------------------------------------
     */

    const body =
      (await request.json()) as RequestBody;

    const planSlug =
      body.planSlug?.trim().toLowerCase() ?? "";

    const billingCycle =
      body.billingCycle === "yearly"
        ? "yearly"
        : body.billingCycle === "monthly"
          ? "monthly"
          : null;

    if (!planSlug) {
      return NextResponse.json(
        {
          error: "A plan is required.",
        },
        { status: 400 },
      );
    }

    if (!billingCycle) {
      return NextResponse.json(
        {
          error:
            "A valid billing cycle is required.",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * Resolve user's company.
     * ---------------------------------------------------------
     */

    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("company_members")
      .select(
        `
          company_id,
          role
        `,
      )
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "Membership lookup error:",
        membershipError,
      );

      return NextResponse.json(
        {
          error:
            "Unable to determine your business workspace.",
        },
        { status: 500 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "Your business workspace has not been created yet.",
        },
        { status: 400 },
      );
    }

    /*
     * Only workspace owner can start billing.
     */

    if (membership.role !== "owner") {
      return NextResponse.json(
        {
          error:
            "Only the workspace owner can activate billing.",
        },
        { status: 403 },
      );
    }

    const admin = createAdminClient();

    /*
     * ---------------------------------------------------------
     * Resolve plan SERVER-SIDE.
     * ---------------------------------------------------------
     */

    const {
      data: plan,
      error: planError,
    } = await admin
      .from("plans")
      .select(
        `
          id,
          name,
          slug,
          monthly_price,
          yearly_price,
          currency,
          is_active,
          paypal_monthly_plan_id,
          paypal_yearly_plan_id
        `,
      )
      .eq("slug", planSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      console.error(
        "Plan lookup error:",
        planError,
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify the selected plan.",
        },
        { status: 500 },
      );
    }

    if (!plan) {
      return NextResponse.json(
        {
          error:
            "The selected plan is not available.",
        },
        { status: 400 },
      );
    }

    /*
     * Enterprise uses sales flow.
     */

    if (plan.slug === "enterprise") {
      return NextResponse.json(
        {
          error:
            "Enterprise subscriptions require contacting our team.",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * Resolve PayPal plan.
     * ---------------------------------------------------------
     */

    const paypalPlanId =
      billingCycle === "monthly"
        ? plan.paypal_monthly_plan_id
        : plan.paypal_yearly_plan_id;

    const amount =
      billingCycle === "monthly"
        ? plan.monthly_price
        : plan.yearly_price;

    if (!paypalPlanId) {
      return NextResponse.json(
        {
          error:
            `PayPal is not configured for the ${plan.name} ${billingCycle} plan.`,
        },
        { status: 400 },
      );
    }

    if (
      amount === null ||
      amount === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "The selected plan does not have a valid price.",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * Find existing subscriptions.
     *
     * IMPORTANT:
     *
     * trialing does NOT block checkout.
     * ---------------------------------------------------------
     */

    const {
      data: existingSubscriptions,
      error: existingError,
    } = await admin
      .from("subscriptions")
      .select(
        `
          id,
          status,
          provider_subscription_id,
          plan_id,
          billing_cycle,
          trial_ends_at
        `,
      )
      .eq(
        "company_id",
        membership.company_id,
      )
      .in("status", [
        "trialing",
        "pending",
        "active",
        "approved",
      ])
      .order("created_at", {
        ascending: false,
      });

    if (existingError) {
      console.error(
        "Existing subscription lookup error:",
        existingError,
      );

      return NextResponse.json(
        {
          error:
            "Unable to check your current subscription.",
        },
        { status: 500 },
      );
    }

    const subscriptions =
      (existingSubscriptions ??
        []) as ExistingSubscription[];

    /*
     * ---------------------------------------------------------
     * ACTIVE subscription blocks new checkout.
     * ---------------------------------------------------------
     */

    const activeSubscription =
      subscriptions.find(
        (subscription) =>
          subscription.status === "active" ||
          subscription.status === "approved",
      );

    if (activeSubscription) {
      return NextResponse.json(
        {
          error:
            "Your workspace already has an active subscription.",
        },
        { status: 409 },
      );
    }

    /*
     * ---------------------------------------------------------
     * Detect current trial.
     * ---------------------------------------------------------
     */

    const trialSubscription =
      subscriptions.find(
        (subscription) =>
          subscription.status === "trialing" &&
          subscription.trial_ends_at,
      );

    const hasActiveTrial =
      Boolean(trialSubscription);

    const trialEndsAt =
      trialSubscription?.trial_ends_at ?? null;

    /*
     * ---------------------------------------------------------
     * Existing pending checkout.
     *
     * Cancel only the pending checkout.
     *
     * NEVER cancel the active trial here.
     * ---------------------------------------------------------
     */

    const existingPending =
      subscriptions.find(
        (subscription) =>
          subscription.status === "pending",
      );

    if (
      existingPending?.provider_subscription_id
    ) {
      await admin
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
          provider_metadata: {
            reason:
              "Replaced by a new checkout attempt",
          },
        })
        .eq(
          "id",
          existingPending.id,
        );
    }

    /*
     * ---------------------------------------------------------
     * Create LOCAL pending subscription.
     *
     * This record does not activate the paid plan.
     *
     * If a trial exists, the trial continues separately.
     * ---------------------------------------------------------
     */

    const {
      data: localSubscription,
      error: insertError,
    } = await admin
      .from("subscriptions")
      .insert({
        company_id:
          membership.company_id,

        plan_id:
          plan.id,

        status: "pending",

        billing_cycle:
          billingCycle,

        amount,

        base_amount:
          amount,

        discount_value: 0,

        price_override: false,

        currency:
          plan.currency,

        provider: "paypal",

        provider_metadata: {
          created_by_user_id:
            user.id,

          plan_slug:
            plan.slug,

          billing_cycle:
            billingCycle,

          created_during_trial:
            hasActiveTrial,

          trial_preserved:
            hasActiveTrial,

          scheduled_start:
            trialEndsAt,

          checkout_created_at:
            new Date().toISOString(),
        },

        cancel_at_period_end:
          false,
      })
      .select("id")
      .single();

    if (
      insertError ||
      !localSubscription
    ) {
      console.error(
        "Subscription insert error:",
        insertError,
      );

      return NextResponse.json(
        {
          error:
            "Unable to create the subscription.",
        },
        { status: 500 },
      );
    }

    /*
     * ---------------------------------------------------------
     * Get PayPal access token.
     * ---------------------------------------------------------
     */

    const accessToken =
      await getPayPalAccessToken();

    /*
     * ---------------------------------------------------------
     * Build return URLs.
     * ---------------------------------------------------------
     */

    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "http://localhost:3000";

    const returnUrl =
      `${origin}/billing/paypal/success`;

    const cancelUrl =
      `${origin}/billing/paypal/cancel`;

    /*
     * ---------------------------------------------------------
     * Build PayPal subscription payload.
     *
     * IMPORTANT:
     *
     * When the customer is still on trial, we send
     * start_time equal to the trial end.
     *
     * This tells PayPal not to start the paid
     * subscription immediately.
     * ---------------------------------------------------------
     */

    const paypalPayload: Record<
      string,
      unknown
    > = {
      plan_id: paypalPlanId,

      custom_id:
        localSubscription.id,

      subscriber: {
        email_address:
          user.email,
      },

      application_context: {
        brand_name:
          "Sharif Business Solutions",

        locale: "en-US",

        user_action:
          "SUBSCRIBE_NOW",

        shipping_preference:
          "NO_SHIPPING",

        return_url:
          returnUrl,

        cancel_url:
          cancelUrl,
      },
    };

    /*
     * Only schedule a future start when there
     * is a real active trial end date.
     */

    if (trialEndsAt) {
      const trialEnd =
        new Date(trialEndsAt);

      if (
        !Number.isNaN(
          trialEnd.getTime(),
        ) &&
        trialEnd.getTime() >
          Date.now()
      ) {
        paypalPayload.start_time =
          trialEnd.toISOString();
      }
    }

    /*
     * ---------------------------------------------------------
     * Create PayPal subscription.
     * ---------------------------------------------------------
     */

    const paypalResponse =
      await fetch(
        `${getPayPalBaseUrl()}/v1/billing/subscriptions`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",

            Prefer:
              "return=representation",
          },

          body:
            JSON.stringify(
              paypalPayload,
            ),

          cache: "no-store",
        },
      );

    /*
     * ---------------------------------------------------------
     * Handle PayPal failure.
     * ---------------------------------------------------------
     */

    if (!paypalResponse.ok) {
      const text =
        await paypalResponse.text();

      console.error(
        "PayPal subscription creation failed:",
        text,
      );

      await admin
        .from("subscriptions")
        .update({
          status: "failed",

          updated_at:
            new Date().toISOString(),

          provider_metadata: {
            created_by_user_id:
              user.id,

            plan_slug:
              plan.slug,

            billing_cycle:
              billingCycle,

            created_during_trial:
              hasActiveTrial,

            scheduled_start:
              trialEndsAt,

            paypal_error:
              text,
          },
        })
        .eq(
          "id",
          localSubscription.id,
        );

      return NextResponse.json(
        {
          error:
            "PayPal could not start the subscription. Please try again.",
        },
        { status: 502 },
      );
    }

    /*
     * ---------------------------------------------------------
     * Read PayPal response.
     * ---------------------------------------------------------
     */

    const paypalSubscription =
      (await paypalResponse.json()) as PayPalSubscriptionResponse;

    if (!paypalSubscription.id) {
      await admin
        .from("subscriptions")
        .update({
          status: "failed",

          updated_at:
            new Date().toISOString(),

          provider_metadata: {
            created_by_user_id:
              user.id,

            plan_slug:
              plan.slug,

            billing_cycle:
              billingCycle,

            paypal_error:
              "PayPal did not return a subscription ID.",
          },
        })
        .eq(
          "id",
          localSubscription.id,
        );

      throw new Error(
        "PayPal did not return a subscription ID.",
      );
    }

    /*
     * ---------------------------------------------------------
     * Find PayPal approval URL.
     * ---------------------------------------------------------
     */

    const approvalUrl =
      paypalSubscription.links?.find(
        (link) =>
          link.rel === "approve",
      )?.href;

    if (!approvalUrl) {
      await admin
        .from("subscriptions")
        .update({
          status: "failed",

          updated_at:
            new Date().toISOString(),

          provider_metadata: {
            created_by_user_id:
              user.id,

            plan_slug:
              plan.slug,

            billing_cycle:
              billingCycle,

            paypal_error:
              "PayPal did not return an approval URL.",
          },
        })
        .eq(
          "id",
          localSubscription.id,
        );

      throw new Error(
        "PayPal did not return an approval URL.",
      );
    }

    /*
     * ---------------------------------------------------------
     * Save PayPal subscription ID.
     *
     * Still PENDING.
     *
     * We do NOT activate the local paid subscription here.
     * PayPal/webhook confirmation handles that.
     * ---------------------------------------------------------
     */

    const {
      error: updateError,
    } = await admin
      .from("subscriptions")
      .update({
        provider:
          "paypal",

        provider_subscription_id:
          paypalSubscription.id,

        updated_at:
          new Date().toISOString(),

        provider_metadata: {
          created_by_user_id:
            user.id,

          plan_slug:
            plan.slug,

          billing_cycle:
            billingCycle,

          paypal_status:
            paypalSubscription.status ??
            "APPROVAL_PENDING",

          created_during_trial:
            hasActiveTrial,

          trial_preserved:
            hasActiveTrial,

          scheduled_start:
            trialEndsAt,
        },
      })
      .eq(
        "id",
        localSubscription.id,
      );

    if (updateError) {
      console.error(
        "Subscription update error:",
        updateError,
      );
    }

    /*
     * ---------------------------------------------------------
     * Return approval URL to browser.
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      subscriptionId:
        localSubscription.id,

      paypalSubscriptionId:
        paypalSubscription.id,

      approvalUrl,

      createdDuringTrial:
        hasActiveTrial,

      trialPreserved:
        hasActiveTrial,

      scheduledStart:
        trialEndsAt,
    });
  } catch (error) {
    console.error(
      "Create PayPal subscription error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start PayPal checkout.",
      },
      { status: 500 },
    );
  }
}