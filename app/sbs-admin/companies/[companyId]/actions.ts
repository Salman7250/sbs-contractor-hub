"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  success: boolean;
  error?: string;
};

async function getAdminContext() {
  const platformAdmin =
    await requirePlatformAdmin();

  const supabase =
    await createClient();

  return {
    supabase,
    userId:
      platformAdmin.user.id,
  };
}

async function logActivity(
  supabase: any,
  userId: string,
  companyId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  beforeData: unknown,
  afterData: unknown,
  reason: string | null = null,
) {
  const result =
    await supabase
      .from(
        "platform_activity_logs",
      )
      .insert({
        actor_user_id:
          userId,
        company_id:
          companyId,
        action,
        entity_type:
          entityType,
        entity_id:
          entityId,
        before_data:
          beforeData,
        after_data:
          afterData,
        reason,
      });

  if (result.error) {
    console.error(
      "Platform activity log failed:",
      result.error,
    );
  }
}

export async function changeCompanyPlan({
  companyId,
  subscriptionId,
  planId,
  billingCycle,
}: {
  companyId: string;
  subscriptionId: string;
  planId: string;
  billingCycle:
    | "monthly"
    | "yearly";
}): Promise<ActionResult> {
  try {
    const {
      supabase,
      userId,
    } = await getAdminContext();

    if (!subscriptionId) {
      return {
        success: false,
        error:
          "This company does not have a subscription.",
      };
    }

    const {
      data: currentSubscription,
      error: currentError,
    } = await supabase
      .from("subscriptions")
      .select(
        "id, company_id, plan_id, status, billing_cycle, amount, currency",
      )
      .eq("id", subscriptionId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (currentError) {
      throw currentError;
    }

    if (!currentSubscription) {
      return {
        success: false,
        error:
          "Subscription not found.",
      };
    }

    const {
      data: plan,
      error: planError,
    } = await supabase
      .from("plans")
      .select(
        "id, name, monthly_price, yearly_price, currency, is_active",
      )
      .eq("id", planId)
      .maybeSingle();

    if (planError) {
      throw planError;
    }

    if (!plan) {
      return {
        success: false,
        error:
          "Selected plan was not found.",
      };
    }

    if (plan.is_active === false) {
      return {
        success: false,
        error:
          "This plan is inactive and cannot be assigned.",
      };
    }

    const amount =
      billingCycle ===
      "yearly"
        ? Number(
            plan.yearly_price ??
              0,
          )
        : Number(
            plan.monthly_price ??
              0,
          );

    const {
      data: updatedSubscription,
      error: updateError,
    } = await supabase
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        billing_cycle:
          billingCycle,
        amount,
        currency:
          plan.currency ??
          "USD",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", subscriptionId)
      .eq("company_id", companyId)
      .select(
        "id, plan_id, billing_cycle, amount, currency, status",
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    const {
      error: syncError,
    } = await supabase.rpc(
      "sync_subscription_entitlements",
      {
        p_subscription_id:
          subscriptionId,
      },
    );

    if (syncError) {
      throw syncError;
    }

    await logActivity(
      supabase,
      userId,
      companyId,
      "change_plan",
      "subscription",
      subscriptionId,
      currentSubscription,
      updatedSubscription,
      `Changed company plan to ${plan.name}.`,
    );

    revalidateCompany(
      companyId,
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "changeCompanyPlan:",
      error,
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to change company plan.",
    };
  }
}

export async function extendCompanyTrial({
  companyId,
  subscriptionId,
  days,
}: {
  companyId: string;
  subscriptionId: string;
  days: number;
}): Promise<ActionResult> {
  try {
    const {
      supabase,
      userId,
    } = await getAdminContext();

    if (
      !Number.isFinite(days) ||
      days < 1 ||
      days > 3650
    ) {
      return {
        success: false,
        error:
          "Trial extension must be between 1 and 3650 days.",
      };
    }

    const {
      data: subscription,
      error: fetchError,
    } = await supabase
      .from("subscriptions")
      .select(
        "id, company_id, status, trial_ends_at",
      )
      .eq("id", subscriptionId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!subscription) {
      return {
        success: false,
        error:
          "Subscription not found.",
      };
    }

    const now =
      new Date();

    const existingEnd =
      subscription.trial_ends_at
        ? new Date(
            subscription.trial_ends_at,
          )
        : null;

    const base =
      existingEnd &&
      existingEnd.getTime() >
        now.getTime()
        ? existingEnd
        : now;

    const newEnd =
      new Date(
        base.getTime() +
          days *
            24 *
            60 *
            60 *
            1000,
      );

    const {
      data: updated,
      error: updateError,
    } = await supabase
      .from("subscriptions")
      .update({
        status:
          "trialing",
        trial_ends_at:
          newEnd.toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", subscriptionId)
      .eq("company_id", companyId)
      .select(
        "id, status, trial_ends_at",
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    const {
      error: companyError,
    } = await supabase
      .from("companies")
      .update({
        status: "trial",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", companyId);

    if (companyError) {
      throw companyError;
    }

    await logActivity(
      supabase,
      userId,
      companyId,
      "extend_trial",
      "subscription",
      subscriptionId,
      subscription,
      updated,
      `Extended trial by ${days} days.`,
    );

    revalidateCompany(
      companyId,
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "extendCompanyTrial:",
      error,
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to extend trial.",
    };
  }
}

export async function setCompanyModuleAccess({
  companyId,
  moduleId,
  enabled,
  reason,
}: {
  companyId: string;
  moduleId: string;
  enabled: boolean;
  reason?: string | null;
}): Promise<ActionResult> {
  try {
    const {
      supabase,
      userId,
    } = await getAdminContext();

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from("company_entitlements")
      .select(
        "id, company_id, module_id, access, source, expires_at, reason",
      )
      .eq("company_id", companyId)
      .eq("module_id", moduleId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const newAccess =
      enabled
        ? "enabled"
        : "disabled";

    const {
      data: updated,
      error: upsertError,
    } = await supabase
      .from(
        "company_entitlements",
      )
      .upsert(
        {
          company_id:
            companyId,
          module_id:
            moduleId,
          access:
            newAccess,
          source:
            "admin",
          reason:
            reason ??
            "Platform administrator override",
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "company_id,module_id",
        },
      )
      .select(
        "id, company_id, module_id, access, source, expires_at, reason",
      )
      .single();

    if (upsertError) {
      throw upsertError;
    }

    await logActivity(
      supabase,
      userId,
      companyId,
      enabled
        ? "enable_module"
        : "disable_module",
      "company_entitlement",
      existing?.id ??
        updated.id,
      existing,
      updated,
      reason ?? null,
    );

    revalidateCompany(
      companyId,
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "setCompanyModuleAccess:",
      error,
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to update module access.",
    };
  }
}

export async function setCompanyLimitOverride({
  companyId,
  limitKey,
  limitValue,
  isUnlimited,
  reason,
}: {
  companyId: string;
  limitKey: string;
  limitValue:
    | number
    | null;
  isUnlimited: boolean;
  reason:
    | string
    | null;
}): Promise<ActionResult> {
  try {
    const {
      supabase,
      userId,
    } = await getAdminContext();

    if (!limitKey.trim()) {
      return {
        success: false,
        error:
          "A limit key is required.",
      };
    }

    if (
      !isUnlimited &&
      (limitValue === null ||
        limitValue < 0)
    ) {
      return {
        success: false,
        error:
          "A valid numeric limit is required.",
      };
    }

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from(
        "company_limit_overrides",
      )
      .select("*")
      .eq("company_id", companyId)
      .eq(
        "limit_key",
        limitKey,
      )
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const {
      data: updated,
      error: upsertError,
    } = await supabase
      .from(
        "company_limit_overrides",
      )
      .upsert(
        {
          company_id:
            companyId,
          limit_key:
            limitKey,
          limit_value:
            isUnlimited
              ? null
              : limitValue,
          is_unlimited:
            isUnlimited,
          reason:
            reason ||
            null,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "company_id,limit_key",
        },
      )
      .select("*")
      .single();

    if (upsertError) {
      throw upsertError;
    }

    await logActivity(
      supabase,
      userId,
      companyId,
      "override_limit",
      "company_limit_override",
      updated.id,
      existing,
      updated,
      reason,
    );

    revalidateCompany(
      companyId,
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "setCompanyLimitOverride:",
      error,
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to save limit override.",
    };
  }
}

export async function removeCompanyLimitOverride({
  companyId,
  limitKey,
}: {
  companyId: string;
  limitKey: string;
}): Promise<ActionResult> {
  try {
    const {
      supabase,
      userId,
    } = await getAdminContext();

    const {
      data: existing,
      error: fetchError,
    } = await supabase
      .from(
        "company_limit_overrides",
      )
      .select("*")
      .eq("company_id", companyId)
      .eq(
        "limit_key",
        limitKey,
      )
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!existing) {
      return {
        success: true,
      };
    }

    const {
      error: deleteError,
    } = await supabase
      .from(
        "company_limit_overrides",
      )
      .delete()
      .eq("company_id", companyId)
      .eq(
        "limit_key",
        limitKey,
      );

    if (deleteError) {
      throw deleteError;
    }

    await logActivity(
      supabase,
      userId,
      companyId,
      "remove_limit_override",
      "company_limit_override",
      existing.id,
      existing,
      null,
      "Removed company resource limit override.",
    );

    revalidateCompany(
      companyId,
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "removeCompanyLimitOverride:",
      error,
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to remove limit override.",
    };
  }
}

export async function toggleCompanySuspension({
  companyId,
  suspended,
}: {
  companyId: string;
  suspended: boolean;
}): Promise<ActionResult> {
  try {
    const {
      supabase,
      userId,
    } = await getAdminContext();

    const {
      data: company,
      error: fetchError,
    } = await supabase
      .from("companies")
      .select(
        "id, name, status",
      )
      .eq("id", companyId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!company) {
      return {
        success: false,
        error:
          "Company not found.",
      };
    }

    const newStatus =
      suspended
        ? "suspended"
        : "active";

    const {
      data: updated,
      error: updateError,
    } = await supabase
      .from("companies")
      .update({
        status:
          newStatus,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", companyId)
      .select(
        "id, name, status",
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    await logActivity(
      supabase,
      userId,
      companyId,
      suspended
        ? "suspend_company"
        : "reactivate_company",
      "company",
      companyId,
      company,
      updated,
      suspended
        ? "Company suspended by platform administrator."
        : "Company reactivated by platform administrator.",
    );

    revalidateCompany(
      companyId,
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "toggleCompanySuspension:",
      error,
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to change company status.",
    };
  }
}

function revalidateCompany(
  companyId: string,
) {
  revalidatePath(
    `/sbs-admin/companies/${companyId}`,
  );

  revalidatePath(
    "/sbs-admin/companies",
  );

  revalidatePath(
    "/sbs-admin",
  );
}