"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

const BUILT_MODULE_SLUGS = new Set([
  "customers",
  "estimates",
  "sales-orders",
  "invoices",
  "payments",
  "products",
  "serial-assets",
  "inventory",
  "warehouses",
  "pricing",
  "suppliers",
  "purchase-orders",
  "expenses",
  "warranty",
  "repairs",
  "rma",
  "service-providers",
  "service-jobs",
  "b2b-client-portal",
  "analytics",
  "employees",
  "documents",
  "settings",
]);

type AccessMode =
  | "enabled"
  | "disabled"
  | "free";

function cleanString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function parseExpiresAt(
  value: FormDataEntryValue | null
) {
  const stringValue = cleanString(value);

  if (!stringValue) {
    return null;
  }

  const date = new Date(
    `${stringValue}T23:59:59`
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "Invalid expiration date."
    );
  }

  return date.toISOString();
}

export async function saveEntitlement(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const companyId = cleanString(
    formData.get("companyId")
  );

  const moduleSlug = cleanString(
    formData.get("moduleSlug")
  );

  const mode =
    cleanString(
      formData.get("mode")
    ) as AccessMode;

  const reason = cleanString(
    formData.get("reason")
  );

  const expiresAt = parseExpiresAt(
    formData.get("expiresAt")
  );

  if (!companyId) {
    throw new Error(
      "Company is required."
    );
  }

  if (!moduleSlug) {
    throw new Error(
      "Module is required."
    );
  }

  if (!BUILT_MODULE_SLUGS.has(moduleSlug)) {
    throw new Error(
      "This module is not part of the built SBS module catalog."
    );
  }

  if (
    mode !== "enabled" &&
    mode !== "disabled" &&
    mode !== "free"
  ) {
    throw new Error(
      "Invalid entitlement mode."
    );
  }

  const [
    companyResult,
    moduleResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle(),

    supabase
      .from("modules")
      .select("id, slug")
      .eq("slug", moduleSlug)
      .maybeSingle(),
  ]);

  if (companyResult.error) {
    throw new Error(
      companyResult.error.message
    );
  }

  if (!companyResult.data) {
    throw new Error(
      "Company not found."
    );
  }

  if (moduleResult.error) {
    throw new Error(
      moduleResult.error.message
    );
  }

  if (!moduleResult.data) {
    throw new Error(
      "Module not found."
    );
  }

  /*
   * Remove any previous manual/free rows for this
   * company/module so the entitlement remains deterministic.
   *
   * Plan rows are NEVER touched.
   */
  const { error: deleteError } =
    await supabase
      .from("company_entitlements")
      .delete()
      .eq("company_id", companyId)
      .eq(
        "module_id",
        moduleResult.data.id
      )
      .in("source", [
        "override",
        "free",
      ]);

  if (deleteError) {
    throw new Error(
      deleteError.message ||
        "Unable to clear the previous entitlement override."
    );
  }

  const source =
    mode === "free"
      ? "free"
      : "override";

  const access =
    mode === "disabled"
      ? "disabled"
      : "enabled";

  const { error: insertError } =
    await supabase
      .from("company_entitlements")
      .insert({
        company_id: companyId,
        module_id: moduleResult.data.id,
        access,
        source,
        expires_at: expiresAt,
        reason: reason || null,
      });

  if (insertError) {
    throw new Error(
      insertError.message ||
        "Unable to save entitlement."
    );
  }

  revalidatePath(
    "/sbs-admin/entitlements"
  );
}

export async function removeEntitlementOverride(
  formData: FormData
) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const companyId = cleanString(
    formData.get("companyId")
  );

  const moduleSlug = cleanString(
    formData.get("moduleSlug")
  );

  if (!companyId || !moduleSlug) {
    throw new Error(
      "Company and module are required."
    );
  }

  if (!BUILT_MODULE_SLUGS.has(moduleSlug)) {
    throw new Error(
      "Invalid module."
    );
  }

  const { data: module, error: moduleError } =
    await supabase
      .from("modules")
      .select("id")
      .eq("slug", moduleSlug)
      .maybeSingle();

  if (moduleError) {
    throw new Error(
      moduleError.message
    );
  }

  if (!module) {
    throw new Error(
      "Module not found."
    );
  }

  /*
   * Only manual/free grants are removed.
   * The plan entitlement remains untouched.
   */
  const { error } =
    await supabase
      .from("company_entitlements")
      .delete()
      .eq("company_id", companyId)
      .eq("module_id", module.id)
      .in("source", [
        "override",
        "free",
      ]);

  if (error) {
    throw new Error(
      error.message ||
        "Unable to remove entitlement override."
    );
  }

  revalidatePath(
    "/sbs-admin/entitlements"
  );
}