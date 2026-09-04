"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

export async function updateEntitlement(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const entitlementId = String(
    formData.get("entitlement_id") ?? ""
  ).trim();

  const access = String(
    formData.get("access") ?? ""
  ).trim();

  const source = String(
    formData.get("source") ?? ""
  ).trim();

  const expiresAtRaw = String(
    formData.get("expires_at") ?? ""
  ).trim();

  const reasonRaw = String(
    formData.get("reason") ?? ""
  ).trim();

  if (!entitlementId) {
    return {
      success: false,
      error: "Entitlement ID is required.",
    };
  }

  if (!["enabled", "disabled"].includes(access)) {
    return {
      success: false,
      error: "Invalid access value.",
    };
  }

  if (!["override", "free"].includes(source)) {
    return {
      success: false,
      error: "Invalid entitlement source.",
    };
  }

  let expiresAt: string | null = null;

  if (expiresAtRaw) {
    const parsed = new Date(
      `${expiresAtRaw}T23:59:59.999Z`
    );

    if (Number.isNaN(parsed.getTime())) {
      return {
        success: false,
        error: "Invalid expiration date.",
      };
    }

    if (parsed.getTime() <= Date.now()) {
      return {
        success: false,
        error:
          "Expiration date must be in the future.",
      };
    }

    expiresAt = parsed.toISOString();
  }

  const reason = reasonRaw || null;

  /*
   * We intentionally do NOT modify the plan_modules table.
   *
   * This record becomes the company's effective manual
   * entitlement for this module.
   */
  const { data: entitlement, error } =
    await supabase
      .from("company_entitlements")
      .update({
        access,
        source,
        expires_at: expiresAt,
        reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entitlementId)
      .select(
        `
          id,
          company_id,
          module_id,
          access,
          source,
          subscription_id,
          expires_at,
          reason,
          created_at,
          updated_at
        `
      )
      .single();

  if (error) {
    console.error(
      "Entitlement update error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Failed to update entitlement.",
    };
  }

  revalidatePath("/sbs-admin/entitlements");
  revalidatePath("/sbs-admin/companies");
  revalidatePath("/sbs-admin");

  return {
    success: true,
    entitlement,
  };
}