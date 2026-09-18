import "server-only";

import { getCompanyModuleAccess } from "@/lib/auth/module-access";
import { createClient } from "@/lib/supabase/server";

export type WorkspaceNavigationAccess = {
  allowedModuleSlugs: string[];
  permissionKeys: string[];
};

type PermissionRow = {
  module: string;
  action: string;
};

/**
 * Reads the request-scoped navigation access snapshot before the client shell
 * renders. Any failure returns no module access, so subscription navigation
 * fails closed.
 */
export async function getWorkspaceNavigationAccess(): Promise<WorkspaceNavigationAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      allowedModuleSlugs: [],
      permissionKeys: [],
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.company_id) {
    if (membershipError) {
      console.error(
        "Unable to resolve workspace membership:",
        membershipError,
      );
    }

    return {
      allowedModuleSlugs: [],
      permissionKeys: [],
    };
  }

  try {
    const [allowedModuleSlugs, permissionResult] = await Promise.all([
      getCompanyModuleAccess(supabase, membership.company_id),
      supabase.rpc("employee_get_my_permissions", {
        p_company_id: membership.company_id,
      }),
    ]);

    if (permissionResult.error) {
      throw permissionResult.error;
    }

    const permissionRows =
      (permissionResult.data ?? []) as PermissionRow[];

    const permissionKeys = permissionRows
      .filter((row) => row.module && row.action)
      .map((row) => `${row.module}:${row.action}`);

    return {
      allowedModuleSlugs,
      permissionKeys,
    };
  } catch (error) {
    console.error("Unable to resolve workspace access:", error);

    return {
      allowedModuleSlugs: [],
      permissionKeys: [],
    };
  }
}
