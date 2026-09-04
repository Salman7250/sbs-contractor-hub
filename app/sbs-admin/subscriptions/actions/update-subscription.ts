"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
  "incomplete",
  "incomplete_expired",
];

export async function updateSubscription(formData: FormData) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const subscriptionId = String(
    formData.get("subscription_id") || ""
  ).trim();

  const status = String(
    formData.get("status") || ""
  ).trim();

  const cancelAtPeriodEnd =
    formData.get("cancel_at_period_end") === "true";

  if (!subscriptionId) {
    return {
      success: false,
      error: "Subscription ID is required.",
    };
  }

  if (!VALID_STATUSES.includes(status)) {
    return {
      success: false,
      error: "Invalid subscription status.",
    };
  }

  // Get the existing subscription first.
  const { data: existing, error: existingError } =
    await supabase
      .from("subscriptions")
      .select(
        `
          id,
          company_id,
          status,
          current_period_end,
          canceled_at
        `
      )
      .eq("id", subscriptionId)
      .maybeSingle();

  if (existingError) {
    console.error(
      "Subscription lookup error:",
      existingError
    );

    return {
      success: false,
      error: "Unable to find the subscription.",
    };
  }

  if (!existing) {
    return {
      success: false,
      error: "Subscription does not exist.",
    };
  }

  const now = new Date().toISOString();

  let canceledAt = existing.canceled_at;

  if (status === "canceled") {
    canceledAt = now;
  } else if (existing.status === "canceled") {
    canceledAt = null;
  }

  /*
   * If the subscription is being immediately canceled,
   * don't leave cancel_at_period_end enabled.
   */
  const finalCancelAtPeriodEnd =
    status === "canceled"
      ? false
      : cancelAtPeriodEnd;

  const { data: updated, error: updateError } =
    await supabase
      .from("subscriptions")
      .update({
        status,
        cancel_at_period_end: finalCancelAtPeriodEnd,
        canceled_at: canceledAt,
        updated_at: now,
      })
      .eq("id", subscriptionId)
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
          canceled_at,
          provider,
          created_at,
          updated_at
        `
      )
      .single();

  if (updateError) {
    console.error(
      "Subscription update error:",
      updateError
    );

    return {
      success: false,
      error:
        updateError.message ||
        "Failed to update subscription.",
    };
  }

  revalidatePath("/sbs-admin/subscriptions");
  revalidatePath("/sbs-admin/entitlements");
  revalidatePath("/sbs-admin/companies");
  revalidatePath("/sbs-admin");

  return {
    success: true,
    subscription: updated,
  };
}