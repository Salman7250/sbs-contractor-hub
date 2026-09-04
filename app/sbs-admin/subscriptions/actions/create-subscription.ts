"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

export async function createSubscription(formData: FormData) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const companyId = String(
    formData.get("company_id") || ""
  ).trim();

  const planId = String(
    formData.get("plan_id") || ""
  ).trim();

  const status = String(
    formData.get("status") || "trialing"
  ).trim();

  const billingCycle = String(
    formData.get("billing_cycle") || "monthly"
  ).trim();

  const trialDaysRaw = String(
    formData.get("trial_days") || "14"
  ).trim();

  const trialDays = Number(trialDaysRaw);

  /* -------------------------------------------------------
     VALIDATION
  ------------------------------------------------------- */

  if (!companyId) {
    return {
      success: false,
      error: "Please select a company.",
    };
  }

  if (!planId) {
    return {
      success: false,
      error: "Please select a plan.",
    };
  }

  if (
    !["trialing", "active", "paused"].includes(
      status
    )
  ) {
    return {
      success: false,
      error: "Invalid subscription status.",
    };
  }

  if (
    !["monthly", "yearly"].includes(
      billingCycle
    )
  ) {
    return {
      success: false,
      error: "Invalid billing cycle.",
    };
  }

  if (
    !Number.isFinite(trialDays) ||
    trialDays < 0 ||
    trialDays > 365
  ) {
    return {
      success: false,
      error:
        "Trial period must be between 0 and 365 days.",
    };
  }

  /* -------------------------------------------------------
     VERIFY COMPANY
  ------------------------------------------------------- */

  const {
    data: company,
    error: companyError,
  } = await supabase
    .from("companies")
    .select("id, name, currency")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) {
    console.error("Company lookup error:", {
      message: companyError.message,
      code: companyError.code,
      details: companyError.details,
      hint: companyError.hint,
    });

    return {
      success: false,
      error:
        companyError.message ||
        "Unable to verify the selected company.",
    };
  }

  if (!company) {
    return {
      success: false,
      error: "Selected company does not exist.",
    };
  }

  /* -------------------------------------------------------
     VERIFY PLAN
  ------------------------------------------------------- */

  const {
    data: plan,
    error: planError,
  } = await supabase
    .from("plans")
    .select(
      "id, name, slug, monthly_price, yearly_price, is_active"
    )
    .eq("id", planId)
    .maybeSingle();

  if (planError) {
    console.error("Plan lookup error:", {
      message: planError.message,
      code: planError.code,
      details: planError.details,
      hint: planError.hint,
    });

    return {
      success: false,
      error:
        planError.message ||
        "Unable to verify the selected plan.",
    };
  }

  if (!plan) {
    return {
      success: false,
      error: "Selected plan does not exist.",
    };
  }

  if (!plan.is_active) {
    return {
      success: false,
      error:
        "The selected plan is not active.",
    };
  }

  /* -------------------------------------------------------
     CALCULATE SUBSCRIPTION AMOUNT
  ------------------------------------------------------- */

  const amount =
    billingCycle === "yearly"
      ? Number(plan.yearly_price ?? 0)
      : Number(plan.monthly_price ?? 0);

  if (!Number.isFinite(amount) || amount < 0) {
    return {
      success: false,
      error:
        "The selected plan has an invalid price.",
    };
  }

  /* -------------------------------------------------------
     DATES
  ------------------------------------------------------- */

  const now = new Date();

  const startedAt = now.toISOString();

  const trialEndsAt =
    status === "trialing"
      ? new Date(
          now.getTime() +
            trialDays *
              24 *
              60 *
              60 *
              1000
        ).toISOString()
      : null;

  let currentPeriodEnd: string;

  if (status === "trialing") {
    currentPeriodEnd =
      trialEndsAt ??
      now.toISOString();
  } else if (billingCycle === "yearly") {
    const end = new Date(now);

    end.setUTCFullYear(
      end.getUTCFullYear() + 1
    );

    currentPeriodEnd =
      end.toISOString();
  } else {
    const end = new Date(now);

    end.setUTCMonth(
      end.getUTCMonth() + 1
    );

    currentPeriodEnd =
      end.toISOString();
  }

  /* -------------------------------------------------------
     CHECK FOR EXISTING ACTIVE/TRIAL SUBSCRIPTION
  ------------------------------------------------------- */

  const {
    data: existingSubscription,
    error: existingSubscriptionError,
  } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("company_id", companyId)
    .in("status", [
      "trialing",
      "active",
      "past_due",
      "paused",
      "incomplete",
    ])
    .limit(1)
    .maybeSingle();

  if (existingSubscriptionError) {
    console.error(
      "Existing subscription lookup error:",
      {
        message:
          existingSubscriptionError.message,
        code: existingSubscriptionError.code,
        details:
          existingSubscriptionError.details,
        hint: existingSubscriptionError.hint,
      }
    );

    return {
      success: false,
      error:
        existingSubscriptionError.message ||
        "Unable to check the company's existing subscription.",
    };
  }

  if (existingSubscription) {
    return {
      success: false,
      error:
        "This company already has an active subscription. Manage the existing subscription instead.",
    };
  }

  /* -------------------------------------------------------
     CREATE SUBSCRIPTION
  ------------------------------------------------------- */

  const {
    data: subscription,
    error: subscriptionError,
  } = await supabase
    .from("subscriptions")
    .insert({
      company_id: companyId,
      plan_id: planId,
      status,
      billing_cycle: billingCycle,
      amount,
      currency: company.currency || "USD",
      started_at: startedAt,
      trial_ends_at: trialEndsAt,
      current_period_start: startedAt,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: false,
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
        started_at,
        trial_ends_at,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        created_at
      `
    )
    .single();

  if (subscriptionError) {
    console.error(
      "Subscription creation error:",
      {
        message:
          subscriptionError.message,
        code: subscriptionError.code,
        details:
          subscriptionError.details,
        hint: subscriptionError.hint,
      }
    );

    return {
      success: false,
      error:
        subscriptionError.message ||
        "Failed to create subscription.",
    };
  }

  /* -------------------------------------------------------
     REFRESH ADMIN PAGES
  ------------------------------------------------------- */

  revalidatePath(
    "/sbs-admin/subscriptions"
  );

  revalidatePath(
    "/sbs-admin/entitlements"
  );

  revalidatePath(
    "/sbs-admin/companies"
  );

  revalidatePath("/sbs-admin");

  /* -------------------------------------------------------
     SUCCESS
  ------------------------------------------------------- */

  return {
    success: true,
    subscription,
  };
}