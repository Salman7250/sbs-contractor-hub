import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

import EntitlementManagement from "./entitlement-management";

const BUILT_MODULE_SLUGS = [
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
] as const;

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type PlanRow = {
  id: string;
  name: string;
  slug: string;
};

type SubscriptionRow = {
  id: string;
  company_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  current_period_end: string | null;
};

type ModuleRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
};

type PlanModuleRow = {
  id: string;
  plan_id: string;
  module_id: string;
};

type EntitlementRow = {
  id: string;
  company_id: string;
  module_id: string;
  access: "enabled" | "disabled";
  source: "plan" | "override" | "free";
  subscription_id: string | null;
  expires_at: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export default async function AdminEntitlementsPage() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const [
    companiesResult,
    plansResult,
    subscriptionsResult,
    modulesResult,
    planModulesResult,
    entitlementsResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, slug, status")
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("plans")
      .select("id, name, slug")
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from("subscriptions")
      .select(
        `
          id,
          company_id,
          plan_id,
          status,
          billing_cycle,
          amount,
          currency,
          current_period_end
        `
      )
      .in("status", [
        "trialing",
        "active",
        "past_due",
        "paused",
      ])
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("modules")
      .select(
        `
          id,
          name,
          slug,
          description,
          category,
          icon,
          is_active,
          sort_order
        `
      )
      .in("slug", [
        ...BUILT_MODULE_SLUGS,
      ])
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from("plan_modules")
      .select(
        "id, plan_id, module_id"
      ),

    supabase
      .from("company_entitlements")
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
      .order("updated_at", {
        ascending: false,
      }),
  ]);

  if (companiesResult.error) {
    throw new Error(
      companiesResult.error.message ||
        "Unable to load companies."
    );
  }

  if (plansResult.error) {
    throw new Error(
      plansResult.error.message ||
        "Unable to load plans."
    );
  }

  if (subscriptionsResult.error) {
    throw new Error(
      subscriptionsResult.error.message ||
        "Unable to load subscriptions."
    );
  }

  if (modulesResult.error) {
    throw new Error(
      modulesResult.error.message ||
        "Unable to load modules."
    );
  }

  if (planModulesResult.error) {
    throw new Error(
      planModulesResult.error.message ||
        "Unable to load plan modules."
    );
  }

  if (entitlementsResult.error) {
    throw new Error(
      entitlementsResult.error.message ||
        "Unable to load company entitlements."
    );
  }

  const companies: CompanyRow[] =
    companiesResult.data ?? [];

  const plans: PlanRow[] =
    plansResult.data ?? [];

  /*
   * Normalize the Supabase amount value to a number
   * before passing subscriptions to the client component.
   */
  const subscriptions: SubscriptionRow[] = (
    subscriptionsResult.data ?? []
  ).map((row) => ({
    id: row.id,
    company_id: row.company_id,
    plan_id: row.plan_id,
    status: row.status,
    billing_cycle: row.billing_cycle,
    amount: Number(row.amount ?? 0),
    currency: row.currency,
    current_period_end:
      row.current_period_end ?? null,
  }));

  const modules: ModuleRow[] = (
    modulesResult.data ?? []
  )
    .filter((module) =>
      BUILT_MODULE_SLUGS.includes(
        module.slug as (typeof BUILT_MODULE_SLUGS)[number]
      )
    )
    .map((module) => ({
      id: module.id,
      name: module.name,
      slug: module.slug,
      description:
        module.description ?? null,
      category:
        module.category ?? null,
      icon: module.icon ?? null,
      is_active:
        Boolean(module.is_active),
      sort_order:
        Number(module.sort_order ?? 0),
    }));

  const planModules: PlanModuleRow[] =
    (planModulesResult.data ?? []).map(
      (row) => ({
        id: row.id,
        plan_id: row.plan_id,
        module_id: row.module_id,
      })
    );

  const entitlements: EntitlementRow[] = (
    entitlementsResult.data ?? []
  ).map((row) => ({
    id: row.id,
    company_id: row.company_id,
    module_id: row.module_id,

    access:
      row.access === "disabled"
        ? "disabled"
        : "enabled",

    source:
      row.source === "override"
        ? "override"
        : row.source === "free"
          ? "free"
          : "plan",

    subscription_id:
      row.subscription_id ?? null,

    expires_at:
      row.expires_at ?? null,

    reason:
      row.reason ?? null,

    created_at:
      row.created_at,

    updated_at:
      row.updated_at,
  }));

  return (
    <EntitlementManagement
      companies={companies}
      plans={plans}
      subscriptions={subscriptions}
      modules={modules}
      planModules={planModules}
      entitlements={entitlements}
    />
  );
}