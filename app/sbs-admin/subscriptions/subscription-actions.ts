"use server";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const ACTIVE_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
  "expired",
] as const;

type SubscriptionStatus =
  (typeof ACTIVE_STATUSES)[number];

function getString(
  formData: FormData,
  key: string
): string {
  return String(formData.get(key) ?? "").trim();
}

function getNullableString(
  formData: FormData,
  key: string
): string | null {
  const value = getString(formData, key);
  return value || null;
}

function getAmount(
  formData: FormData,
  key = "amount"
): number {
  const value = getString(formData, key);

  if (!value) {
    return 0;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(
      "Amount must be a valid non-negative number."
    );
  }

  return amount;
}

function getDateOrNull(
  formData: FormData,
  key: string
): string | null {
  const value = getString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `${key} must be a valid date.`
    );
  }

  return date.toISOString();
}

function validateStatus(
  value: string
): SubscriptionStatus {
  if (
    !ACTIVE_STATUSES.includes(
      value as SubscriptionStatus
    )
  ) {
    throw new Error(
      "Invalid subscription status."
    );
  }

  return value as SubscriptionStatus;
}

/* ============================================================
   CREATE SUBSCRIPTION
============================================================ */

export async function createSubscription(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const companyId = getString(
    formData,
    "companyId"
  );

  const planId = getString(
    formData,
    "planId"
  );

  const status = validateStatus(
    getString(formData, "status") ||
      "active"
  );

  const billingCycle =
    getString(
      formData,
      "billingCycle"
    ) || "monthly";

  const amount = getAmount(formData);

  const currency =
    getString(
      formData,
      "currency"
    ) || "USD";

  const currentPeriodStart =
    getDateOrNull(
      formData,
      "currentPeriodStart"
    );

  const currentPeriodEnd =
    getDateOrNull(
      formData,
      "currentPeriodEnd"
    );

  if (!companyId) {
    throw new Error(
      "Company is required."
    );
  }

  if (!planId) {
    throw new Error(
      "Plan is required."
    );
  }

  if (
    currentPeriodStart &&
    currentPeriodEnd &&
    new Date(currentPeriodEnd) <
      new Date(currentPeriodStart)
  ) {
    throw new Error(
      "The subscription end date cannot be before the start date."
    );
  }

  /*
   * Keep one active subscription per company.
   * Cancel any currently active/trialing subscription
   * before creating the new one.
   */
  if (
    status === "active" ||
    status === "trialing" ||
    status === "paused" ||
    status === "past_due"
  ) {
    const { error: cancelError } =
      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "company_id",
          companyId
        )
        .in("status", [
          "trialing",
          "active",
          "past_due",
          "paused",
        ]);

    if (cancelError) {
      throw new Error(
        cancelError.message ||
          "Unable to replace the existing subscription."
      );
    }
  }

  const { data, error } =
    await supabase
      .from("subscriptions")
      .insert({
        company_id: companyId,
        plan_id: planId,
        status,
        billing_cycle:
          billingCycle,
        amount,
        currency:
          currency.toUpperCase(),
        current_period_start:
          currentPeriodStart,
        current_period_end:
          currentPeriodEnd,
      })
      .select(
        "id, company_id, plan_id, status, billing_cycle, amount, currency, current_period_start, current_period_end"
      )
      .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to create subscription."
    );
  }

  revalidatePath(
    "/sbs-admin/subscriptions"
  );

  revalidatePath(
    "/sbs-admin/companies"
  );

  return data;
}

/* ============================================================
   UPDATE SUBSCRIPTION
============================================================ */

export async function updateSubscription(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const subscriptionId =
    getString(
      formData,
      "subscriptionId"
    );

  if (!subscriptionId) {
    throw new Error(
      "Subscription ID is required."
    );
  }

  const companyId =
    getString(
      formData,
      "companyId"
    );

  const planId =
    getString(
      formData,
      "planId"
    );

  const status =
    validateStatus(
      getString(formData, "status")
    );

  const billingCycle =
    getString(
      formData,
      "billingCycle"
    );

  const amount =
    getAmount(formData);

  const currency =
    getString(
      formData,
      "currency"
    ) || "USD";

  const currentPeriodStart =
    getDateOrNull(
      formData,
      "currentPeriodStart"
    );

  const currentPeriodEnd =
    getDateOrNull(
      formData,
      "currentPeriodEnd"
    );

  if (!companyId) {
    throw new Error(
      "Company is required."
    );
  }

  if (!planId) {
    throw new Error(
      "Plan is required."
    );
  }

  if (!billingCycle) {
    throw new Error(
      "Billing cycle is required."
    );
  }

  if (
    currentPeriodStart &&
    currentPeriodEnd &&
    new Date(currentPeriodEnd) <
      new Date(currentPeriodStart)
  ) {
    throw new Error(
      "The subscription end date cannot be before the start date."
    );
  }

  /*
   * If this subscription is being made active,
   * make sure the company does not have another
   * active subscription.
   */
  if (
    status === "active" ||
    status === "trialing" ||
    status === "paused" ||
    status === "past_due"
  ) {
    const { error: deactivateError } =
      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "company_id",
          companyId
        )
        .neq(
          "id",
          subscriptionId
        )
        .in("status", [
          "trialing",
          "active",
          "past_due",
          "paused",
        ]);

    if (deactivateError) {
      throw new Error(
        deactivateError.message ||
          "Unable to update the company's existing subscription."
      );
    }
  }

  const { data, error } =
    await supabase
      .from("subscriptions")
      .update({
        company_id: companyId,
        plan_id: planId,
        status,
        billing_cycle:
          billingCycle,
        amount,
        currency:
          currency.toUpperCase(),
        current_period_start:
          currentPeriodStart,
        current_period_end:
          currentPeriodEnd,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        subscriptionId
      )
      .select(
        "id, company_id, plan_id, status, billing_cycle, amount, currency, current_period_start, current_period_end"
      )
      .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to update subscription."
    );
  }

  revalidatePath(
    "/sbs-admin/subscriptions"
  );

  revalidatePath(
    "/sbs-admin/companies"
  );

  return data;
}

/* ============================================================
   CANCEL SUBSCRIPTION
============================================================ */

export async function cancelSubscription(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const subscriptionId =
    getString(
      formData,
      "subscriptionId"
    );

  if (!subscriptionId) {
    throw new Error(
      "Subscription ID is required."
    );
  }

  const { data, error } =
    await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        subscriptionId
      )
      .select(
        "id, company_id, plan_id, status, billing_cycle, amount, currency, current_period_start, current_period_end"
      )
      .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to cancel subscription."
    );
  }

  revalidatePath(
    "/sbs-admin/subscriptions"
  );

  revalidatePath(
    "/sbs-admin/companies"
  );

  return data;
}

/* ============================================================
   REACTIVATE SUBSCRIPTION
============================================================ */

export async function reactivateSubscription(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const subscriptionId =
    getString(
      formData,
      "subscriptionId"
    );

  if (!subscriptionId) {
    throw new Error(
      "Subscription ID is required."
    );
  }

  const {
    data: existing,
    error: fetchError,
  } = await supabase
    .from("subscriptions")
    .select(
      "id, company_id, plan_id, status, billing_cycle, amount, currency, current_period_start, current_period_end"
    )
    .eq(
      "id",
      subscriptionId
    )
    .single();

  if (fetchError) {
    throw new Error(
      fetchError.message ||
        "Unable to load subscription."
    );
  }

  /*
   * Only one active subscription should
   * exist for a company.
   */
  const { error: deactivateError } =
    await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "company_id",
        existing.company_id
      )
      .neq(
        "id",
        subscriptionId
      )
      .in("status", [
        "trialing",
        "active",
        "past_due",
        "paused",
      ]);

  if (deactivateError) {
    throw new Error(
      deactivateError.message ||
        "Unable to deactivate the company's existing subscription."
    );
  }

  const { data, error } =
    await supabase
      .from("subscriptions")
      .update({
        status: "active",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        subscriptionId
      )
      .select(
        "id, company_id, plan_id, status, billing_cycle, amount, currency, current_period_start, current_period_end"
      )
      .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to reactivate subscription."
    );
  }

  revalidatePath(
    "/sbs-admin/subscriptions"
  );

  revalidatePath(
    "/sbs-admin/companies"
  );

  return data;
}

/* ============================================================
   CHANGE PLAN
============================================================ */

export async function changeSubscriptionPlan(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const subscriptionId =
    getString(
      formData,
      "subscriptionId"
    );

  const planId =
    getString(
      formData,
      "planId"
    );

  if (!subscriptionId) {
    throw new Error(
      "Subscription ID is required."
    );
  }

  if (!planId) {
    throw new Error(
      "Plan is required."
    );
  }

  const { data, error } =
    await supabase
      .from("subscriptions")
      .update({
        plan_id: planId,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        subscriptionId
      )
      .select(
        "id, company_id, plan_id, status, billing_cycle, amount, currency, current_period_start, current_period_end"
      )
      .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to change subscription plan."
    );
  }

  revalidatePath(
    "/sbs-admin/subscriptions"
  );

  revalidatePath(
    "/sbs-admin/companies"
  );

  return data;
}

/* ============================================================
   CHANGE CUSTOM PRICE
============================================================ */

export async function updateSubscriptionPrice(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const subscriptionId =
    getString(
      formData,
      "subscriptionId"
    );

  const amount =
    getAmount(formData);

  const currency =
    getString(
      formData,
      "currency"
    ) || "USD";

  if (!subscriptionId) {
    throw new Error(
      "Subscription ID is required."
    );
  }

  const { data, error } =
    await supabase
      .from("subscriptions")
      .update({
        amount,
        currency:
          currency.toUpperCase(),
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        subscriptionId
      )
      .select(
        "id, company_id, plan_id, status, billing_cycle, amount, currency, current_period_start, current_period_end"
      )
      .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to update subscription price."
    );
  }

  revalidatePath(
    "/sbs-admin/subscriptions"
  );

  return data;
}

/* ============================================================
   GRANT FREE SUBSCRIPTION
============================================================ */

export async function grantFreeSubscription(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const companyId =
    getString(
      formData,
      "companyId"
    );

  const planId =
    getString(
      formData,
      "planId"
    );

  const billingCycle =
    getString(
      formData,
      "billingCycle"
    ) || "monthly";

  const currentPeriodStart =
    getDateOrNull(
      formData,
      "currentPeriodStart"
    );

  const currentPeriodEnd =
    getDateOrNull(
      formData,
      "currentPeriodEnd"
    );

  if (!companyId) {
    throw new Error(
      "Company is required."
    );
  }

  if (!planId) {
    throw new Error(
      "Plan is required."
    );
  }

  /*
   * Remove current active subscription
   * before granting free access.
   */
  const { error: deactivateError } =
    await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "company_id",
        companyId
      )
      .in("status", [
        "trialing",
        "active",
        "past_due",
        "paused",
      ]);

  if (deactivateError) {
    throw new Error(
      deactivateError.message ||
        "Unable to replace the existing subscription."
    );
  }

  const { data, error } =
    await supabase
      .from("subscriptions")
      .insert({
        company_id: companyId,
        plan_id: planId,
        status: "active",
        billing_cycle:
          billingCycle,
        amount: 0,
        currency: "USD",
        current_period_start:
          currentPeriodStart,
        current_period_end:
          currentPeriodEnd,
      })
      .select(
        "id, company_id, plan_id, status, billing_cycle, amount, currency, current_period_start, current_period_end"
      )
      .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to grant free subscription."
    );
  }

  revalidatePath(
    "/sbs-admin/subscriptions"
  );

  revalidatePath(
    "/sbs-admin/companies"
  );

  return data;
}

/* ============================================================
   EXTEND SUBSCRIPTION
============================================================ */

export async function extendSubscription(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const subscriptionId =
    getString(
      formData,
      "subscriptionId"
    );

  const currentPeriodEnd =
    getDateOrNull(
      formData,
      "currentPeriodEnd"
    );

  if (!subscriptionId) {
    throw new Error(
      "Subscription ID is required."
    );
  }

  if (!currentPeriodEnd) {
    throw new Error(
      "New subscription end date is required."
    );
  }

  const { data, error } =
    await supabase
      .from("subscriptions")
      .update({
        current_period_end:
          currentPeriodEnd,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        subscriptionId
      )
      .select(
        "id, company_id, plan_id, status, billing_cycle, amount, currency, current_period_start, current_period_end"
      )
      .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to extend subscription."
    );
  }

  revalidatePath(
    "/sbs-admin/subscriptions"
  );

  return data;
}

/* ============================================================
   DELETE SUBSCRIPTION
============================================================ */

export async function deleteSubscription(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const subscriptionId =
    getString(
      formData,
      "subscriptionId"
    );

  if (!subscriptionId) {
    throw new Error(
      "Subscription ID is required."
    );
  }

  const { error } =
    await supabase
      .from("subscriptions")
      .delete()
      .eq(
        "id",
        subscriptionId
      );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to delete subscription."
    );
  }

  revalidatePath(
    "/sbs-admin/subscriptions"
  );

  revalidatePath(
    "/sbs-admin/companies"
  );

  return {
    success: true,
  };
}