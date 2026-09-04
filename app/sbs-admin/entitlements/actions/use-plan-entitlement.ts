"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

export async function usePlanEntitlement(entitlementId: string) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  if (!entitlementId) {
    return {
      success: false,
      error: "Entitlement ID is required.",
    };
  }

  // Find the entitlement and its company/module.
  const { data: entitlement, error: entitlementError } =
    await supabase
      .from("company_entitlements")
      .select(
        `
          id,
          company_id,
          module_id,
          source,
          companies (
            id,
            name
          ),
          modules (
            id,
            name,
            slug
          )
        `
      )
      .eq("id", entitlementId)
      .maybeSingle();

  if (entitlementError) {
    return {
      success: false,
      error: entitlementError.message,
    };
  }

  if (!entitlement) {
    return {
      success: false,
      error: "Entitlement not found.",
    };
  }

  // Find the company's current active/trialing subscription.
  const { data: subscription, error: subscriptionError } =
    await supabase
      .from("subscriptions")
      .select(
        `
          id,
          company_id,
          plan_id,
          status,
          plans (
            id,
            name,
            slug
          )
        `
      )
      .eq("company_id", entitlement.company_id)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (subscriptionError) {
    return {
      success: false,
      error: subscriptionError.message,
    };
  }

  // No active subscription means there is no plan to restore.
  if (!subscription) {
    const { error: deleteError } = await supabase
      .from("company_entitlements")
      .delete()
      .eq("id", entitlementId);

    if (deleteError) {
      return {
        success: false,
        error: deleteError.message,
      };
    }

    revalidatePath("/sbs-admin/entitlements");
    revalidatePath("/sbs-admin/companies");
    revalidatePath("/sbs-admin");

    return {
      success: true,
      message:
        "Manual entitlement removed. The company has no active subscription, so there is no plan access to restore.",
    };
  }

  // Check whether the current plan includes this module.
  const { data: planModule, error: planModuleError } =
    await supabase
      .from("plan_modules")
      .select("plan_id, module_id")
      .eq("plan_id", subscription.plan_id)
      .eq("module_id", entitlement.module_id)
      .maybeSingle();

  if (planModuleError) {
    return {
      success: false,
      error: planModuleError.message,
    };
  }

  // The module is included in the company's current plan.
  if (planModule) {
    const { error: updateError } = await supabase
      .from("company_entitlements")
      .update({
        access: "enabled",
        source: "plan",
        subscription_id: subscription.id,
        expires_at: null,
        reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entitlementId);

    if (updateError) {
      return {
        success: false,
        error: updateError.message,
      };
    }

    revalidatePath("/sbs-admin/entitlements");
    revalidatePath("/sbs-admin/companies");
    revalidatePath("/sbs-admin");

    return {
      success: true,
      message: "Module access restored to the company's current plan.",
    };
  }

  // The module is NOT part of the current plan.
  // Remove the manual entitlement so the company falls back
  // to normal plan-based access.
  const { error: deleteError } = await supabase
    .from("company_entitlements")
    .delete()
    .eq("id", entitlementId);

  if (deleteError) {
    return {
      success: false,
      error: deleteError.message,
    };
  }

  revalidatePath("/sbs-admin/entitlements");
  revalidatePath("/sbs-admin/companies");
  revalidatePath("/sbs-admin");

  return {
    success: true,
    message:
      "Manual entitlement removed because this module is not included in the company's current plan.",
  };
}