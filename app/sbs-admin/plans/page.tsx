import {
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Layers3,
} from "lucide-react";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import PlanManagement from "./plan-management";

type PlanRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  currency: string | null;
  is_active: boolean;
  is_popular: boolean;
  paypal_product_id: string | null;
  paypal_monthly_plan_id: string | null;
  paypal_yearly_plan_id: string | null;
};

type ModuleRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
};

type PlanModuleRow = {
  plan_id: string;
  module_id: string;
};

type PlanLimitRow = {
  id: string;
  plan_id: string;
  limit_key: string;
  limit_value: number | null;
  is_unlimited: boolean;
};

type SubscriptionRow = {
  plan_id: string;
  company_id: string;
};

export default async function AdminPlansPage() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const [
    plansResult,
    modulesResult,
    planModulesResult,
    planLimitsResult,
    subscriptionsResult,
  ] = await Promise.all([
    supabase
      .from("plans")
      .select(
        `
          id,
          name,
          slug,
          description,
          monthly_price,
          yearly_price,
          currency,
          is_active,
          is_popular,
          paypal_product_id,
          paypal_monthly_plan_id,
          paypal_yearly_plan_id
        `
      )
      .order("monthly_price", {
        ascending: true,
        nullsFirst: false,
      }),

    supabase
      .from("modules")
      .select(
        `
          id,
          name,
          slug,
          description,
          is_active
        `
      )
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("plan_modules")
      .select(
        `
          plan_id,
          module_id
        `
      ),

    supabase
      .from("plan_limits")
      .select(
        `
          id,
          plan_id,
          limit_key,
          limit_value,
          is_unlimited
        `
      ),

    supabase
      .from("subscriptions")
      .select(
        `
          plan_id,
          company_id
        `
      )
      .in("status", [
        "trialing",
        "active",
        "past_due",
        "paused",
      ]),
  ]);

  /*
   * ---------------------------------------------------------
   * ERROR HANDLING
   * ---------------------------------------------------------
   */

  if (plansResult.error) {
    throw new Error(
      plansResult.error.message ||
        "Unable to load subscription plans."
    );
  }

  if (modulesResult.error) {
    throw new Error(
      modulesResult.error.message ||
        "Unable to load platform modules."
    );
  }

  if (planModulesResult.error) {
    throw new Error(
      planModulesResult.error.message ||
        "Unable to load plan modules."
    );
  }

  if (planLimitsResult.error) {
    throw new Error(
      planLimitsResult.error.message ||
        "Unable to load plan limits."
    );
  }

  if (subscriptionsResult.error) {
    throw new Error(
      subscriptionsResult.error.message ||
        "Unable to load plan subscriptions."
    );
  }

  /*
   * ---------------------------------------------------------
   * PLANS
   * ---------------------------------------------------------
   */

  const plans: PlanRow[] = (
    plansResult.data ?? []
  ).map((plan) => ({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    monthly_price:
      plan.monthly_price !== null
        ? Number(plan.monthly_price)
        : null,
    yearly_price:
      plan.yearly_price !== null
        ? Number(plan.yearly_price)
        : null,
    currency: plan.currency,
    is_active: Boolean(plan.is_active),
    is_popular: Boolean(plan.is_popular),
    paypal_product_id:
      plan.paypal_product_id ?? null,
    paypal_monthly_plan_id:
      plan.paypal_monthly_plan_id ?? null,
    paypal_yearly_plan_id:
      plan.paypal_yearly_plan_id ?? null,
  }));

  /*
   * ---------------------------------------------------------
   * MODULES
   * ---------------------------------------------------------
   */

  const modules: ModuleRow[] = (
    modulesResult.data ?? []
  ).map((module) => ({
    id: module.id,
    name: module.name,
    slug: module.slug,
    description: module.description,
    is_active: Boolean(module.is_active),
  }));

  /*
   * ---------------------------------------------------------
   * PLAN MODULE ASSIGNMENTS
   * ---------------------------------------------------------
   */

  const planModules: PlanModuleRow[] = (
    planModulesResult.data ?? []
  ).map((row) => ({
    plan_id: row.plan_id,
    module_id: row.module_id,
  }));

  /*
   * ---------------------------------------------------------
   * PLAN LIMITS
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   * Include the database ID because plan-management.tsx
   * expects each PlanLimit to have an id.
   * ---------------------------------------------------------
   */

  const planLimits: PlanLimitRow[] = (
    planLimitsResult.data ?? []
  ).map((row) => ({
    id: row.id,
    plan_id: row.plan_id,
    limit_key: row.limit_key,
    limit_value:
      row.limit_value !== null
        ? Number(row.limit_value)
        : null,
    is_unlimited: Boolean(row.is_unlimited),
  }));

  /*
   * ---------------------------------------------------------
   * COMPANY COUNTS
   * ---------------------------------------------------------
   *
   * Count unique companies per plan.
   */

  const companiesByPlan = new Map<
    string,
    Set<string>
  >();

  for (
    const subscription of
      (subscriptionsResult.data ??
        []) as SubscriptionRow[]
  ) {
    if (!subscription.plan_id) {
      continue;
    }

    if (!companiesByPlan.has(subscription.plan_id)) {
      companiesByPlan.set(
        subscription.plan_id,
        new Set<string>()
      );
    }

    companiesByPlan
      .get(subscription.plan_id)!
      .add(subscription.company_id);
  }

  const companyCounts: Record<string, number> =
    Object.fromEntries(
      Array.from(companiesByPlan.entries()).map(
        ([planId, companies]) => [
          planId,
          companies.size,
        ]
      )
    );

  /*
   * ---------------------------------------------------------
   * MODULE COUNTS
   * ---------------------------------------------------------
   */

  const moduleCountsMap = new Map<
    string,
    number
  >();

  for (const row of planModules) {
    moduleCountsMap.set(
      row.plan_id,
      (moduleCountsMap.get(row.plan_id) ?? 0) + 1
    );
  }

  const moduleCounts: Record<string, number> =
    Object.fromEntries(
      moduleCountsMap.entries()
    );

  /*
   * ---------------------------------------------------------
   * ACTIVE PLANS
   * ---------------------------------------------------------
   */

  const activePlans = plans.filter(
    (plan) => plan.is_active
  );

  /*
   * ---------------------------------------------------------
   * SUBSCRIBED COMPANIES
   * ---------------------------------------------------------
   */

  const subscribedCompanies = Array.from(
    companiesByPlan.values()
  ).reduce(
    (total, companies) =>
      total + companies.size,
    0
  );

  /*
   * ---------------------------------------------------------
   * ACTIVE SUBSCRIPTIONS
   * ---------------------------------------------------------
   */

  const activeSubscriptions = (
    subscriptionsResult.data ?? []
  ).filter((subscription) =>
    activePlans.some(
      (plan) =>
        plan.id === subscription.plan_id
    )
  );

  /*
   * ---------------------------------------------------------
   * AVERAGE MONTHLY PRICE
   * ---------------------------------------------------------
   */

  const pricedActivePlans = activePlans.filter(
    (plan) => plan.monthly_price !== null
  );

  const averageMonthlyPrice =
    pricedActivePlans.length > 0
      ? pricedActivePlans.reduce(
          (total, plan) =>
            total +
            Number(plan.monthly_price ?? 0),
          0
        ) / pricedActivePlans.length
      : 0;

  /*
   * ---------------------------------------------------------
   * PAGE
   * ---------------------------------------------------------
   */

  return (
    <div className="space-y-8">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
            <Layers3 className="h-4 w-4" />
            Platform Management
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Plans & Pricing
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Manage SBS subscription plans, pricing,
            module access, resource limits, and
            customer subscription configuration.
          </p>
        </div>
      </div>

      {/* =====================================================
          STATS
      ====================================================== */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PlanStat
          label="Total Plans"
          value={plans.length}
          detail={`${activePlans.length} active`}
          icon={Layers3}
        />

        <PlanStat
          label="Subscribed Companies"
          value={subscribedCompanies}
          detail={`${activeSubscriptions.length} active subscription records`}
          icon={Building2}
        />

        <PlanStat
          label="Average Monthly Price"
          value={formatCurrency(
            averageMonthlyPrice,
            "USD"
          )}
          detail="Across active paid plans"
          icon={CircleDollarSign}
        />

        <PlanStat
          label="Active Plans"
          value={activePlans.length}
          detail={
            plans.length - activePlans.length > 0
              ? `${
                  plans.length -
                  activePlans.length
                } inactive`
              : "All plans active"
          }
          icon={CheckCircle2}
        />
      </div>

      {/* =====================================================
          PLAN MANAGEMENT
      ====================================================== */}

      <PlanManagement
  plans={plans}
  modules={modules}
  planModules={planModules}
  planLimits={planLimits}
/>
      {/* =====================================================
          BILLING ARCHITECTURE
      ====================================================== */}

      <section className="grid gap-5 lg:grid-cols-3">
        <ArchitectureCard
          icon={CircleDollarSign}
          title="Catalog Pricing"
          description="The plan catalog stores the current public price. Changing a plan price will affect future subscriptions, not automatically rewrite existing customer subscription pricing."
        />

        <ArchitectureCard
          icon={Layers3}
          title="Module Entitlements"
          description="Plan access is driven by plan_modules and the existing entitlement system rather than hardcoded plan checks inside individual modules."
        />

        <ArchitectureCard
          icon={Building2}
          title="Customer Subscriptions"
          description="Customer subscriptions remain separate from the plan catalog so billing history, locked-in pricing, discounts, and grandfathered rates can be preserved."
        />
      </section>
    </div>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function PlanStat({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>

      <div className="mt-5">
        <div className="text-2xl font-bold tracking-tight text-slate-900">
          {value}
        </div>

        <div className="mt-1 text-sm font-medium text-slate-700">
          {label}
        </div>

        <div className="mt-1 text-xs text-slate-400">
          {detail}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ARCHITECTURE CARD
============================================================ */

function ArchitectureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function formatCurrency(
  amount: number,
  currency: string,
  withDecimals = true
) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: withDecimals
        ? 2
        : 0,
      maximumFractionDigits: withDecimals
        ? 2
        : 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(
      withDecimals ? 2 : 0
    )}`;
  }
}