/// <reference lib="deno.ns" />

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};
type RequestBody = {
  companyId: string;
  planId: string;
  billingCycle: "monthly" | "yearly";
};

type PlanRow = {
  id: string;
  name: string;
  slug: string;
  monthly_price: number | null;
  yearly_price: number | null;
  currency: string;
  is_active: boolean;
  paypal_monthly_plan_id: string | null;
  paypal_yearly_plan_id: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
  email: string | null;
};

type SubscriptionRow = {
  id: string;
  company_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  provider: string | null;
  provider_subscription_id: string | null;
};

type PayPalSubscriptionResponse = {
  id?: string;
  status?: string;
  plan_id?: string;
  create_time?: string;
  start_time?: string;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
};

function jsonResponse(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

function getPayPalBaseUrl() {
  const environment =
    Deno.env.get("PAYPAL_ENVIRONMENT") ??
    "sandbox";

  return environment === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken() {
  const clientId =
    Deno.env.get("PAYPAL_CLIENT_ID");

  const clientSecret =
    Deno.env.get("PAYPAL_CLIENT_SECRET");

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
    const body = await response.text();

    throw new Error(
      `PayPal authentication failed: ${body}`
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

function getApprovalUrl(
  links:
    | Array<{
        href: string;
        rel: string;
        method: string;
      }>
    | undefined
) {
  return (
    links?.find(
      (link) => link.rel === "approve"
    )?.href ?? null
  );
}

async function getAuthenticatedUser(
  supabase: SupabaseClient
) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(
      `Unable to authenticate user: ${error.message}`
    );
  }

  if (!user) {
    throw new Error(
      "Authentication required."
    );
  }

  return user;
}

async function verifyCompanyAccess(
  supabase: SupabaseClient,
  userId: string,
  companyId: string
) {
  const { data, error } =
    await supabase
      .from("company_members")
      .select("company_id")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to verify company access: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "You do not have access to this company."
    );
  }
}

async function getPlan(
  supabase: SupabaseClient,
  planId: string
) {
  const { data, error } =
    await supabase
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
        `
      )
      .eq("id", planId)
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load plan: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "The selected plan does not exist."
    );
  }

  return data as PlanRow;
}

async function getCompany(
  supabase: SupabaseClient,
  companyId: string
) {
  const { data, error } =
    await supabase
      .from("companies")
      .select(
        `
          id,
          name,
          email
        `
      )
      .eq("id", companyId)
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load company: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "The company does not exist."
    );
  }

  return data as CompanyRow;
}

async function findExistingSubscription(
  supabase: SupabaseClient,
  companyId: string
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
          provider,
          provider_subscription_id
        `
      )
      .eq("company_id", companyId)
      .in("status", [
        "trialing",
        "active",
        "past_due",
        "pending",
      ])
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to check existing subscription: ${error.message}`
    );
  }

  return data as SubscriptionRow | null;
}

function getPlanPrice(
  plan: PlanRow,
  billingCycle: "monthly" | "yearly"
) {
  return billingCycle === "monthly"
    ? plan.monthly_price
    : plan.yearly_price;
}

function getPayPalPlanId(
  plan: PlanRow,
  billingCycle: "monthly" | "yearly"
) {
  return billingCycle === "monthly"
    ? plan.paypal_monthly_plan_id
    : plan.paypal_yearly_plan_id;
}

function getReturnUrl() {
  return (
    Deno.env.get(
      "NEXT_PUBLIC_APP_URL"
    ) ??
    Deno.env.get("APP_URL") ??
    "http://localhost:3000"
  );
}

Deno.serve(async (req) => {
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
    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const supabaseAnonKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY"
      );

    if (
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      throw new Error(
        "Supabase environment variables are not configured."
      );
    }

    const authorization =
      req.headers.get(
        "Authorization"
      );

    if (!authorization) {
      return jsonResponse(
        {
          error:
            "Authentication required.",
        },
        401
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },
        }
      );

    const user =
      await getAuthenticatedUser(
        supabase
      );

    const body =
      (await req.json()) as RequestBody;

    const {
      companyId,
      planId,
      billingCycle,
    } = body;

    if (!companyId) {
      return jsonResponse(
        {
          error:
            "companyId is required.",
        },
        400
      );
    }

    if (!planId) {
      return jsonResponse(
        {
          error:
            "planId is required.",
        },
        400
      );
    }

    if (
      billingCycle !== "monthly" &&
      billingCycle !== "yearly"
    ) {
      return jsonResponse(
        {
          error:
            "billingCycle must be monthly or yearly.",
        },
        400
      );
    }

    await verifyCompanyAccess(
      supabase,
      user.id,
      companyId
    );

    const company =
      await getCompany(
        supabase,
        companyId
      );

    const plan =
      await getPlan(
        supabase,
        planId
      );

    if (!plan.is_active) {
      return jsonResponse(
        {
          error:
            "The selected plan is no longer available.",
        },
        400
      );
    }

    const paypalPlanId =
      getPayPalPlanId(
        plan,
        billingCycle
      );

    if (!paypalPlanId) {
      return jsonResponse(
        {
          error:
            `PayPal is not configured for the ${plan.name} ${billingCycle} plan.`,
        },
        400
      );
    }

    const amount =
      getPlanPrice(
        plan,
        billingCycle
      );

    if (
      amount === null ||
      amount === undefined
    ) {
      return jsonResponse(
        {
          error:
            "The selected plan does not have a price for this billing cycle.",
        },
        400
      );
    }

    const existingSubscription =
      await findExistingSubscription(
        supabase,
        companyId
      );

    if (
      existingSubscription?.provider ===
        "paypal" &&
      existingSubscription.provider_subscription_id
    ) {
      return jsonResponse(
        {
          error:
            "This company already has an active or pending PayPal subscription.",
          subscriptionId:
            existingSubscription.id,
          providerSubscriptionId:
            existingSubscription.provider_subscription_id,
        },
        409
      );
    }

    const appUrl =
      getReturnUrl();

    const customId =
      `${companyId}:${planId}:${billingCycle}`;

    const paypalSubscription =
      await paypalRequest<PayPalSubscriptionResponse>(
        "/v1/billing/subscriptions",
        {
          method: "POST",
          headers: {
            Prefer:
              "return=representation",
          },
          body: JSON.stringify({
            plan_id: paypalPlanId,

            custom_id: customId,

            application_context: {
              brand_name:
                "Sharif Business Solutions",
              locale: "en-US",
              user_action:
                "SUBSCRIBE_NOW",
              shipping_preference:
                "NO_SHIPPING",

              return_url:
                `${appUrl}/billing/paypal/success`,

              cancel_url:
                `${appUrl}/billing/paypal/cancel`,
            },

            subscriber: {
              email_address:
                user.email ??
                company.email ??
                undefined,
            },
          }),
        }
      );

    if (
      !paypalSubscription.id
    ) {
      throw new Error(
        "PayPal created the subscription but did not return a subscription ID."
      );
    }

    const approvalUrl =
      getApprovalUrl(
        paypalSubscription.links
      );

    if (!approvalUrl) {
      throw new Error(
        "PayPal created the subscription but did not return an approval URL."
      );
    }

    /*
     * We intentionally create the SBS subscription
     * as pending here.
     *
     * PayPal is the source of truth for whether the
     * customer actually approved the subscription.
     *
     * The webhook will move this to active after
     * PayPal confirms the subscription.
     */

    const { data: subscription, error: subscriptionError } =
      await supabase
        .from("subscriptions")
        .insert({
          company_id: companyId,
          plan_id: planId,
          status: "pending",
          billing_cycle: billingCycle,
          amount,
          base_amount: amount,
          discount_value: 0,
          price_override: false,
          currency: plan.currency,
          provider: "paypal",
          provider_subscription_id:
            paypalSubscription.id,
          provider_metadata: {
            paypal_plan_id:
              paypalPlanId,
            paypal_status:
              paypalSubscription.status ??
              "APPROVAL_PENDING",
            paypal_create_time:
              paypalSubscription.create_time ??
              null,
          },
          cancel_at_period_end:
            false,
        })
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
        .single();

    if (subscriptionError) {
      /*
       * The PayPal subscription now exists.
       *
       * We do NOT silently create another PayPal
       * subscription if the database insert fails.
       *
       * The provider ID is returned so the situation
       * can be reconciled safely.
       */

      console.error(
        "Subscription database insert failed:",
        subscriptionError
      );

      return jsonResponse(
        {
          error:
            "PayPal subscription was created, but SBS could not save the subscription record.",
          providerSubscriptionId:
            paypalSubscription.id,
          approvalUrl,
        },
        500
      );
    }

    return jsonResponse({
      success: true,

      subscription: {
        id: subscription.id,
        status: subscription.status,
        provider:
          subscription.provider,
        providerSubscriptionId:
          subscription.provider_subscription_id,
        billingCycle:
          subscription.billing_cycle,
        amount:
          subscription.amount,
        currency:
          subscription.currency,
      },

      paypal: {
        subscriptionId:
          paypalSubscription.id,
        planId:
          paypalPlanId,
        status:
          paypalSubscription.status ??
          "APPROVAL_PENDING",
        approvalUrl,
      },
    });
  } catch (error) {
    console.error(
      "Create PayPal subscription error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create PayPal subscription.";

    return jsonResponse(
      {
        error: message,
      },
      500
    );
  }
});