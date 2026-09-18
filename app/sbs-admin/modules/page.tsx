import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  Layers3,
  Settings2,
} from "lucide-react";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import ModuleManagement from "./module-management";

type ModuleRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
};

type PlanRow = {
  id: string;
  name: string;
  slug: string;
  monthly_price: number | null;
  yearly_price: number | null;
  currency: string | null;
  is_active: boolean;
};

type PlanModuleRow = {
  plan_id: string;
  module_id: string;
};

/*
 * These are the modules currently built into SBS.
 *
 * Dashboard is application infrastructure and is not a
 * commercial module.
 *
 * Quotes -> estimates
 * Analytics -> analytics
 *
 * Total: 23
 */
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
] as const;

/*
 * IMPORTANT:
 *
 * Do NOT put Lucide components in this server-side object.
 * Only serializable strings are passed to the client component.
 */
const MODULE_GROUPS = [
  {
    title: "Sales",
    description:
      "Customer and sales workflow capabilities.",
    icon: "sales",
    slugs: [
      "customers",
      "estimates",
      "sales-orders",
      "invoices",
      "payments",
    ],
  },
  {
    title: "Products & Inventory",
    description:
      "Product, inventory, warehouse, and pricing capabilities.",
    icon: "inventory",
    slugs: [
      "products",
      "serial-assets",
      "inventory",
      "warehouses",
      "pricing",
    ],
  },
  {
    title: "Procurement",
    description:
      "Supplier purchasing and expense management.",
    icon: "procurement",
    slugs: [
      "suppliers",
      "purchase-orders",
      "expenses",
    ],
  },
  {
    title: "Service",
    description:
      "Warranty, repair, RMA, and service operations.",
    icon: "service",
    slugs: [
      "warranty",
      "repairs",
      "rma",
      "service-providers",
      "service-jobs",
    ],
  },
  {
    title: "Business",
    description:
      "Client portal, analytics, people, and documents.",
    icon: "business",
    slugs: [
      "b2b-client-portal",
      "analytics",
      "employees",
      "documents",
    ],
  },
] as const;

export default async function AdminModulesPage() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const [
    modulesResult,
    plansResult,
    planModulesResult,
  ] = await Promise.all([
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
      .order("monthly_price", {
        ascending: true,
        nullsFirst: false,
      }),

    supabase
      .from("plan_modules")
      .select(
        `
          plan_id,
          module_id
        `
      ),
  ]);

  if (modulesResult.error) {
    throw new Error(
      modulesResult.error.message ||
        "Unable to load platform modules."
    );
  }

  if (plansResult.error) {
    throw new Error(
      plansResult.error.message ||
        "Unable to load subscription plans."
    );
  }

  if (planModulesResult.error) {
    throw new Error(
      planModulesResult.error.message ||
        "Unable to load module plan assignments."
    );
  }

  const moduleOrder = new Map<string, number>(
    BUILT_MODULE_SLUGS.map(
      (slug, index) => [slug, index]
    )
  );

  /*
   * Only show the 23 modules actually built into SBS.
   */
  const modules: ModuleRow[] = (
    modulesResult.data ?? []
  )
    .filter((module) =>
      moduleOrder.has(module.slug)
    )
    .sort(
      (a, b) =>
        (moduleOrder.get(a.slug) ?? 999) -
        (moduleOrder.get(b.slug) ?? 999)
    )
    .map((module) => ({
      id: module.id,
      name: module.name,
      slug: module.slug,
      description: module.description,
      is_active: Boolean(module.is_active),
    }));

  const plans: PlanRow[] = (
    plansResult.data ?? []
  ).map((plan) => ({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
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
  }));

  const planModules: PlanModuleRow[] = (
    planModulesResult.data ?? []
  ).map((row) => ({
    plan_id: row.plan_id,
    module_id: row.module_id,
  }));

  /*
   * Build plan access counts per module.
   */
  const plansByModule = new Map<
    string,
    Set<string>
  >();

  for (const row of planModules) {
    if (!plansByModule.has(row.module_id)) {
      plansByModule.set(
        row.module_id,
        new Set<string>()
      );
    }

    plansByModule
      .get(row.module_id)!
      .add(row.plan_id);
  }

  const modulePlanCounts: Record<
    string,
    number
  > = Object.fromEntries(
    Array.from(
      plansByModule.entries()
    ).map(
      ([moduleId, planIds]) => [
        moduleId,
        planIds.size,
      ]
    )
  );

  const activeModules = modules.filter(
    (module) => module.is_active
  ).length;

  const inactiveModules =
    modules.length - activeModules;

  const activePlans = plans.filter(
    (plan) => plan.is_active
  );

  /*
   * Serialize the group configuration.
   *
   * This is the critical fix:
   * icon is a string, NOT a React component.
   */
  const groups = MODULE_GROUPS.map(
    (group) => ({
      title: group.title,
      description: group.description,
      icon: group.icon,
      slugs: [...group.slugs],
    })
  );

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
            Modules
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Manage the commercial capabilities available
            across SBS, control module availability, and
            configure which subscription plans include each
            module.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {modules.length} built modules
        </div>
      </div>

      {/* =====================================================
          STATS
      ====================================================== */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ModuleStat
          label="Built Modules"
          value={modules.length}
          icon={Layers3}
        />

        <ModuleStat
          label="Active Modules"
          value={activeModules}
          icon={CheckCircle2}
        />

        <ModuleStat
          label="Inactive Modules"
          value={inactiveModules}
          icon={Activity}
          warning={inactiveModules > 0}
        />

        <ModuleStat
          label="Active Plans"
          value={activePlans.length}
          icon={Building2}
        />
      </div>

      {/* =====================================================
          MANAGEMENT
      ====================================================== */}

      <ModuleManagement
        modules={modules}
        plans={plans}
        planModules={planModules}
        modulePlanCounts={modulePlanCounts}
        groups={groups}
      />

      {/* =====================================================
          ARCHITECTURE
      ====================================================== */}

      <section className="grid gap-5 lg:grid-cols-3">
        <ArchitectureCard
          icon={Layers3}
          title="Module Registry"
          description="The modules table is the source of truth for the commercial capabilities exposed by SBS."
        />

        <ArchitectureCard
          icon={Settings2}
          title="Plan Access"
          description="plan_modules determines which subscription plans include each commercial module."
        />

        <ArchitectureCard
          icon={BarChart3}
          title="Entitlements"
          description="Company-level entitlement logic can later override plan access without changing the commercial module catalog."
        />
      </section>

      {/* =====================================================
          NOTICE
      ====================================================== */}

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-sm font-semibold text-blue-700">
            i
          </div>

          <div>
            <h3 className="text-sm font-semibold text-blue-900">
              Module architecture
            </h3>

            <p className="mt-1 text-xs leading-5 text-blue-700/80">
              This page is connected to the platform module
              registry and plan_modules assignments. Module
              changes affect future entitlement evaluation;
              they do not rewrite historical billing records.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function ModuleStat({
  label,
  value,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{
    className?: string;
  }>;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>

        <span
          className={`h-2 w-2 rounded-full ${
            warning
              ? "bg-amber-500"
              : "bg-emerald-500"
          }`}
        />
      </div>

      <div className="mt-5">
        <div className="text-3xl font-bold tracking-tight text-slate-900">
          {value.toLocaleString()}
        </div>

        <div className="mt-1 text-sm font-medium text-slate-700">
          {label}
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