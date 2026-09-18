"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

export type UpdateModuleInput = {
  moduleId: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type UpdateModulePlanAccessInput = {
  moduleId: string;
  planIds: string[];
};

export async function updateModule(
  input: UpdateModuleInput
) {
  await requirePlatformAdmin();

  const moduleId =
    input.moduleId.trim();

  const name =
    input.name.trim();

  if (!moduleId) {
    throw new Error(
      "Module ID is required."
    );
  }

  if (!name) {
    throw new Error(
      "Module name is required."
    );
  }

  const supabase =
    await createClient();

  const { error } =
    await supabase
      .from("modules")
      .update({
        name,
        description:
          input.description,
        is_active:
          input.isActive,
      })
      .eq("id", moduleId);

  if (error) {
    throw new Error(
      error.message ||
        "Unable to update module."
    );
  }

  revalidatePath(
    "/sbs-admin/modules"
  );

  revalidatePath(
    "/sbs-admin/plans"
  );

  return {
    success: true,
  };
}

export async function updateModulePlanAccess(
  input: UpdateModulePlanAccessInput
) {
  await requirePlatformAdmin();

  const moduleId =
    input.moduleId.trim();

  if (!moduleId) {
    throw new Error(
      "Module ID is required."
    );
  }

  const planIds = Array.from(
    new Set(
      input.planIds
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );

  const supabase =
    await createClient();

  /*
   * First remove the module from all plans.
   *
   * Then insert exactly the plan assignments
   * selected in the admin UI.
   *
   * This makes the UI an authoritative editor
   * for this module's plan access.
   */

  const { error: deleteError } =
    await supabase
      .from("plan_modules")
      .delete()
      .eq(
        "module_id",
        moduleId
      );

  if (deleteError) {
    throw new Error(
      deleteError.message ||
        "Unable to clear existing module plan access."
    );
  }

  if (planIds.length > 0) {
    const rows = planIds.map(
      (planId) => ({
        module_id:
          moduleId,
        plan_id:
          planId,
      })
    );

    const { error: insertError } =
      await supabase
        .from("plan_modules")
        .insert(rows);

    if (insertError) {
      throw new Error(
        insertError.message ||
          "Unable to save module plan access."
      );
    }
  }

  revalidatePath(
    "/sbs-admin/modules"
  );

  revalidatePath(
    "/sbs-admin/plans"
  );

  return {
    success: true,
  };
}