"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlanActionInput = {
  planId: string;

  name: string;
  slug: string;
  description: string;

  monthlyPrice: number | null;
  yearlyPrice: number | null;
  currency: string;

  isActive: boolean;
  isPopular: boolean;

  paypalProductId: string;
  paypalMonthlyPlanId: string;
  paypalYearlyPlanId: string;

  moduleIds: string[];

  limits: Array<{
    limitKey: string;
    limitValue: number | null;
    isUnlimited: boolean;
  }>;
};

export async function updatePlan(
  input: PlanActionInput
) {
  /*
   * ---------------------------------------------------------
   * SECURITY
   * ---------------------------------------------------------
   *
   * Never trust the client component.
   * Every mutation independently verifies platform-admin
   * access.
   */
  await requirePlatformAdmin();

  if (!input.planId) {
    throw new Error(
      "Plan ID is required."
    );
  }

  const name =
    input.name.trim();

  const slug =
    input.slug
      .trim()
      .toLowerCase();

  const description =
    input.description.trim();

  const currency =
    input.currency
      .trim()
      .toUpperCase();

  if (!name) {
    throw new Error(
      "Plan name is required."
    );
  }

  if (!slug) {
    throw new Error(
      "Plan slug is required."
    );
  }

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      slug
    )
  ) {
    throw new Error(
      "Plan slug may only contain lowercase letters, numbers, and hyphens."
    );
  }

  if (!currency) {
    throw new Error(
      "Currency is required."
    );
  }

  if (
    input.monthlyPrice !== null &&
    (!Number.isFinite(
      input.monthlyPrice
    ) ||
      input.monthlyPrice < 0)
  ) {
    throw new Error(
      "Monthly price must be a valid non-negative number."
    );
  }

  if (
    input.yearlyPrice !== null &&
    (!Number.isFinite(
      input.yearlyPrice
    ) ||
      input.yearlyPrice < 0)
  ) {
    throw new Error(
      "Yearly price must be a valid non-negative number."
    );
  }

  const supabase =
    createAdminClient();

  /*
   * ---------------------------------------------------------
   * VERIFY PLAN EXISTS
   * ---------------------------------------------------------
   */

  const {
    data: existingPlan,
    error: existingPlanError,
  } = await supabase
    .from("plans")
    .select(
      `
        id,
        name,
        slug,
        monthly_price,
        yearly_price,
        currency,
        is_active
      `
    )
    .eq(
      "id",
      input.planId
    )
    .maybeSingle();

  if (existingPlanError) {
    throw new Error(
      existingPlanError.message
    );
  }

  if (!existingPlan) {
    throw new Error(
      "The selected plan no longer exists."
    );
  }

  /*
   * ---------------------------------------------------------
   * VERIFY SLUG IS UNIQUE
   * ---------------------------------------------------------
   */

  const {
    data: duplicateSlug,
    error: duplicateSlugError,
  } = await supabase
    .from("plans")
    .select("id")
    .eq("slug", slug)
    .neq("id", input.planId)
    .maybeSingle();

  if (duplicateSlugError) {
    throw new Error(
      duplicateSlugError.message
    );
  }

  if (duplicateSlug) {
    throw new Error(
      `The slug "${slug}" is already used by another plan.`
    );
  }

  /*
   * ---------------------------------------------------------
   * POPULAR PLAN
   * ---------------------------------------------------------
   *
   * SBS pricing currently uses one highlighted/popular plan.
   * If this plan becomes popular, clear the flag from all
   * other plans first.
   */

  if (input.isPopular) {
    const {
      error: clearPopularError,
    } = await supabase
      .from("plans")
      .update({
        is_popular: false,
      })
      .neq(
        "id",
        input.planId
      );

    if (clearPopularError) {
      throw new Error(
        clearPopularError.message
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * UPDATE PLAN CATALOG
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   *
   * We update the PLAN catalog price only.
   *
   * We do NOT update subscriptions here.
   *
   * This preserves the grandfathered-pricing architecture:
   *
   * Plan price = current catalog price
   * Subscription price = customer's agreed price
   */

  const {
    error: planError,
  } = await supabase
    .from("plans")
    .update({
      name,
      slug,
      description:
        description || null,
      monthly_price:
        input.monthlyPrice,
      yearly_price:
        input.yearlyPrice,
      currency,
      is_active:
        input.isActive,
      is_popular:
        input.isPopular,
      paypal_product_id:
        input.paypalProductId.trim() ||
        null,
      paypal_monthly_plan_id:
        input.paypalMonthlyPlanId.trim() ||
        null,
      paypal_yearly_plan_id:
        input.paypalYearlyPlanId.trim() ||
        null,
    })
    .eq(
      "id",
      input.planId
    );

  if (planError) {
    throw new Error(
      planError.message
    );
  }

  /*
   * ---------------------------------------------------------
   * MODULE ACCESS
   * ---------------------------------------------------------
   */

  const uniqueModuleIds =
    Array.from(
      new Set(
        input.moduleIds.filter(
          Boolean
        )
      )
    );

  /*
   * Verify every selected module exists
   * and is currently active.
   */
  if (uniqueModuleIds.length > 0) {
    const {
      data: selectedModules,
      error: selectedModulesError,
    } = await supabase
      .from("modules")
      .select(
        "id, is_active"
      )
      .in(
        "id",
        uniqueModuleIds
      );

    if (selectedModulesError) {
      throw new Error(
        selectedModulesError.message
      );
    }

    const activeModuleIds =
      new Set(
        (selectedModules ?? [])
          .filter(
            (module) =>
              module.is_active
          )
          .map(
            (module) =>
              module.id
          )
      );

    const invalidModuleIds =
      uniqueModuleIds.filter(
        (id) =>
          !activeModuleIds.has(
            id
          )
      );

    if (
      invalidModuleIds.length > 0
    ) {
      throw new Error(
        "One or more selected modules are inactive or do not exist."
      );
    }
  }

  /*
   * Delete current plan-module mapping.
   */
  const {
    error: deletePlanModulesError,
  } = await supabase
    .from("plan_modules")
    .delete()
    .eq(
      "plan_id",
      input.planId
    );

  if (deletePlanModulesError) {
    throw new Error(
      deletePlanModulesError.message
    );
  }

  /*
   * Insert the new mapping.
   */
  if (uniqueModuleIds.length > 0) {
    const rows =
      uniqueModuleIds.map(
        (moduleId) => ({
          plan_id:
            input.planId,
          module_id:
            moduleId,
        })
      );

    const {
      error: insertPlanModulesError,
    } = await supabase
      .from("plan_modules")
      .insert(rows);

    if (insertPlanModulesError) {
      throw new Error(
        insertPlanModulesError.message
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * RESOURCE LIMITS
   * ---------------------------------------------------------
   */

  const normalizedLimits =
    input.limits
      .filter(
        (limit) =>
          limit.limitKey.trim()
      )
      .map((limit) => ({
        limitKey:
          limit.limitKey
            .trim()
            .toLowerCase(),
        limitValue:
          limit.isUnlimited
            ? null
            : limit.limitValue,
        isUnlimited:
          Boolean(
            limit.isUnlimited
          ),
      }));

  /*
   * Validate duplicate limit keys.
   */
  const limitKeys =
    normalizedLimits.map(
      (limit) =>
        limit.limitKey
    );

  const duplicateLimitKeys =
    limitKeys.filter(
      (key, index) =>
        limitKeys.indexOf(
          key
        ) !== index
    );

  if (
    duplicateLimitKeys.length > 0
  ) {
    throw new Error(
      `Duplicate resource limit: ${duplicateLimitKeys[0]}`
    );
  }

  /*
   * Validate values.
   */
  for (const limit of normalizedLimits) {
    if (
      !limit.isUnlimited &&
      (limit.limitValue === null ||
        !Number.isFinite(
          limit.limitValue
        ) ||
        limit.limitValue < 0)
    ) {
      throw new Error(
        `Invalid value for resource limit "${limit.limitKey}".`
      );
    }
  }

  /*
   * Existing limit keys.
   */
  const {
    data: existingLimits,
    error: existingLimitsError,
  } = await supabase
    .from("plan_limits")
    .select(
      "id, limit_key"
    )
    .eq(
      "plan_id",
      input.planId
    );

  if (existingLimitsError) {
    throw new Error(
      existingLimitsError.message
    );
  }

  const desiredKeys =
    new Set(
      normalizedLimits.map(
        (limit) =>
          limit.limitKey
      )
    );

  /*
   * Remove limits no longer present
   * in the editor.
   */
  const limitIdsToDelete =
    (existingLimits ?? [])
      .filter(
        (existing) =>
          !desiredKeys.has(
            existing.limit_key
          )
      )
      .map(
        (existing) =>
          existing.id
      );

  if (
    limitIdsToDelete.length > 0
  ) {
    const {
      error: deleteLimitsError,
    } = await supabase
      .from("plan_limits")
      .delete()
      .in(
        "id",
        limitIdsToDelete
      );

    if (deleteLimitsError) {
      throw new Error(
        deleteLimitsError.message
      );
    }
  }

  /*
   * Upsert desired limits.
   */
  if (
    normalizedLimits.length > 0
  ) {
    const limitRows =
      normalizedLimits.map(
        (limit) => ({
          plan_id:
            input.planId,
          limit_key:
            limit.limitKey,
          limit_value:
            limit.limitValue,
          is_unlimited:
            limit.isUnlimited,
        })
      );

    const {
      error: upsertLimitsError,
    } = await supabase
      .from("plan_limits")
      .upsert(
        limitRows,
        {
          onConflict:
            "plan_id,limit_key",
        }
      );

    if (upsertLimitsError) {
      throw new Error(
        upsertLimitsError.message
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * ENTITLEMENT SYNCHRONIZATION
   * ---------------------------------------------------------
   *
   * The plan-module catalog has changed, so refresh the
   * subscription entitlements generated from plan access.
   *
   * This does NOT modify subscription billing prices.
   */
  const {
    error: syncError,
  } = await supabase.rpc(
    "sync_all_subscription_entitlements"
  );

  if (syncError) {
    throw new Error(
      `Plan saved, but subscription entitlements could not be synchronized: ${syncError.message}`
    );
  }

  /*
   * ---------------------------------------------------------
   * REVALIDATE ADMIN PAGES
   * ---------------------------------------------------------
   */

  revalidatePath(
    "/sbs-admin/plans"
  );

  revalidatePath(
    "/sbs-admin"
  );

  revalidatePath(
    "/sbs-admin/companies"
  );

  return {
    success: true,
    planId: input.planId,
  };
}

export async function createPlan(
  input: Omit<PlanActionInput, "planId">
) {
  await requirePlatformAdmin();

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const description = input.description.trim();
  const currency = input.currency.trim().toUpperCase();

  if (!name) {
    throw new Error("Plan name is required.");
  }

  if (!slug) {
    throw new Error("Plan slug is required.");
  }

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    throw new Error(
      "Plan slug may only contain lowercase letters, numbers, and hyphens."
    );
  }

  if (!currency) {
    throw new Error("Currency is required.");
  }

  if (
    input.monthlyPrice !== null &&
    (!Number.isFinite(input.monthlyPrice) ||
      input.monthlyPrice < 0)
  ) {
    throw new Error(
      "Monthly price must be a valid non-negative number."
    );
  }

  if (
    input.yearlyPrice !== null &&
    (!Number.isFinite(input.yearlyPrice) ||
      input.yearlyPrice < 0)
  ) {
    throw new Error(
      "Yearly price must be a valid non-negative number."
    );
  }

  const supabase = createAdminClient();

  /*
   * ---------------------------------------------------------
   * CHECK SLUG
   * ---------------------------------------------------------
   */

  const {
    data: existingSlug,
    error: slugError,
  } = await supabase
    .from("plans")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (slugError) {
    throw new Error(slugError.message);
  }

  if (existingSlug) {
    throw new Error(
      `The slug "${slug}" is already used by another plan.`
    );
  }

  /*
   * ---------------------------------------------------------
   * POPULAR PLAN
   * ---------------------------------------------------------
   */

  if (input.isPopular) {
    const { error } = await supabase
      .from("plans")
      .update({
        is_popular: false,
      })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      throw new Error(error.message);
    }
  }

  /*
   * ---------------------------------------------------------
   * CREATE PLAN
   * ---------------------------------------------------------
   */

  const {
    data: newPlan,
    error: planError,
  } = await supabase
    .from("plans")
    .insert({
      name,
      slug,
      description: description || null,
      monthly_price: input.monthlyPrice,
      yearly_price: input.yearlyPrice,
      currency,
      is_active: input.isActive,
      is_popular: input.isPopular,
      paypal_product_id:
        input.paypalProductId.trim() || null,
      paypal_monthly_plan_id:
        input.paypalMonthlyPlanId.trim() || null,
      paypal_yearly_plan_id:
        input.paypalYearlyPlanId.trim() || null,
    })
    .select("id")
    .single();

  if (planError) {
    throw new Error(planError.message);
  }

  if (!newPlan) {
    throw new Error(
      "Plan was created but its ID could not be returned."
    );
  }

  /*
   * ---------------------------------------------------------
   * MODULE ACCESS
   * ---------------------------------------------------------
   */

  const uniqueModuleIds = Array.from(
    new Set(
      input.moduleIds.filter(Boolean)
    )
  );

  if (uniqueModuleIds.length > 0) {
    const {
      data: selectedModules,
      error: modulesError,
    } = await supabase
      .from("modules")
      .select("id, is_active")
      .in("id", uniqueModuleIds);

    if (modulesError) {
      throw new Error(modulesError.message);
    }

    const activeModuleIds = new Set(
      (selectedModules ?? [])
        .filter((module) => module.is_active)
        .map((module) => module.id)
    );

    const invalidModule = uniqueModuleIds.find(
      (id) => !activeModuleIds.has(id)
    );

    if (invalidModule) {
      throw new Error(
        "One or more selected modules are inactive or do not exist."
      );
    }

    const moduleRows = uniqueModuleIds.map(
      (moduleId) => ({
        plan_id: newPlan.id,
        module_id: moduleId,
      })
    );

    const {
      error: moduleInsertError,
    } = await supabase
      .from("plan_modules")
      .insert(moduleRows);

    if (moduleInsertError) {
      /*
       * Best-effort cleanup so we don't leave an empty/broken
       * plan behind if module configuration fails.
       */
      await supabase
        .from("plans")
        .delete()
        .eq("id", newPlan.id);

      throw new Error(
        moduleInsertError.message
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * RESOURCE LIMITS
   * ---------------------------------------------------------
   */

  const normalizedLimits =
    input.limits
      .filter(
        (limit) =>
          limit.limitKey.trim()
      )
      .map((limit) => ({
        limitKey:
          limit.limitKey
            .trim()
            .toLowerCase(),
        limitValue:
          limit.isUnlimited
            ? null
            : limit.limitValue,
        isUnlimited:
          Boolean(limit.isUnlimited),
      }));

  const seenLimitKeys = new Set<string>();

  for (const limit of normalizedLimits) {
    if (
      seenLimitKeys.has(limit.limitKey)
    ) {
      throw new Error(
        `Duplicate resource limit: ${limit.limitKey}`
      );
    }

    seenLimitKeys.add(limit.limitKey);

    if (
      !limit.isUnlimited &&
      (limit.limitValue === null ||
        !Number.isFinite(
          limit.limitValue
        ) ||
        limit.limitValue < 0)
    ) {
      throw new Error(
        `Invalid value for resource limit "${limit.limitKey}".`
      );
    }
  }

  if (normalizedLimits.length > 0) {
    const limitRows =
      normalizedLimits.map(
        (limit) => ({
          plan_id: newPlan.id,
          limit_key: limit.limitKey,
          limit_value: limit.limitValue,
          is_unlimited:
            limit.isUnlimited,
        })
      );

    const {
      error: limitsError,
    } = await supabase
      .from("plan_limits")
      .insert(limitRows);

    if (limitsError) {
      /*
       * Best-effort cleanup.
       */
      await supabase
        .from("plan_modules")
        .delete()
        .eq(
          "plan_id",
          newPlan.id
        );

      await supabase
        .from("plans")
        .delete()
        .eq(
          "id",
          newPlan.id
        );

      throw new Error(
        limitsError.message
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * REVALIDATE
   * ---------------------------------------------------------
   */

  revalidatePath(
    "/sbs-admin/plans"
  );

  revalidatePath(
    "/sbs-admin"
  );

  revalidatePath(
    "/sbs-admin/companies"
  );

  return {
    success: true,
    planId: newPlan.id,
  };
}