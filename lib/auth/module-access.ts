import type { SupabaseClient } from "@supabase/supabase-js";

type ModuleAccessRow = {
  module_slug: string;
};

export async function getCompanyModuleAccess(
  supabase: SupabaseClient,
  companyId: string,
) {
  const { data, error } = await supabase.rpc(
    "get_my_module_access",
    { p_company_id: companyId },
  );

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ModuleAccessRow[];

  return rows
    .map((row) => row.module_slug)
    .filter((slug): slug is string => Boolean(slug));
}

export async function hasCompanyModuleAccess(
  supabase: SupabaseClient,
  companyId: string,
  moduleSlug: string,
) {
  const allowedModuleSlugs = await getCompanyModuleAccess(
    supabase,
    companyId,
  );

  return allowedModuleSlugs.includes(moduleSlug);
}
