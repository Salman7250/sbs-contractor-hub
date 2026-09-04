"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

export async function grantEntitlement(formData: FormData) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const companyId = String(
    formData.get("company_id") ?? ""
  ).trim();

  const moduleId = String(
    formData.get("module_id") ?? ""
  ).trim();

  const access = String(
    formData.get("access") ?? "enabled"
  ).trim();

  const source = String(
    formData.get("source") ?? "override"
  ).trim();

  const expiresAtRaw = String(
    formData.get("expires_at") ?? ""
  ).trim();

  const reasonRaw = String(
    formData.get("reason") ?? ""
  ).trim();

  if (!companyId) {
    return {
      success: false,
      error: "Please select a company.",
    };
  }

  if (!moduleId) {
    return {
      success: false,
      error: "Please select a module.",
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
        error: "Expiration date must be in the future.",
      };
    }

    expiresAt = parsed.toISOString();
  }

  const { data: company, error: companyError } =
    await supabase
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .maybeSingle();

  if (companyError) {
    console.error("Company lookup error:", companyError);

    return {
      success: false,
      error: companyError.message,
    };
  }

  if (!company) {
    return {
      success: false,
      error: "Selected company does not exist.",
    };
  }

  const { data: module, error: moduleError } =
    await supabase
      .from("modules")
      .select("id, name, slug, is_active")
      .eq("id", moduleId)
      .maybeSingle();

  if (moduleError) {
    console.error("Module lookup error:", moduleError);

    return {
      success: false,
      error: moduleError.message,
    };
  }

  if (!module) {
    return {
      success: false,
      error: "Selected module does not exist.",
    };
  }

  if (!module.is_active) {
    return {
      success: false,
      error: "The selected module is not active.",
    };
  }

  const { data: existing, error: existingError } =
    await supabase
      .from("company_entitlements")
      .select("id, source")
      .eq("company_id", companyId)
      .eq("module_id", moduleId)
      .maybeSingle();

  if (existingError) {
    console.error(
      "Existing entitlement lookup error:",
      existingError
    );

    return {
      success: false,
      error: existingError.message,
    };
  }

  if (existing) {
    return {
      success: false,
      error:
        "This company already has an entitlement for this module. Use Manage instead.",
    };
  }

  const { data: entitlement, error } =
    await supabase
      .from("company_entitlements")
      .insert({
        company_id: companyId,
        module_id: moduleId,
        access,
        source,
        expires_at: expiresAt,
        reason: reasonRaw || null,
      })
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
      "Entitlement creation error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Failed to create entitlement.",
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