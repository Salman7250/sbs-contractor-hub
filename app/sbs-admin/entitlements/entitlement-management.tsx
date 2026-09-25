"use client";

import {
  AlertCircle,
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Calculator,
  Check,
  ChevronDown,
  CircleOff,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileUp,
  FileText,
  HardDrive,
  Landmark,
  Layers3,
  LockKeyhole,
  Package,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Wrench,
  X,
} from "lucide-react";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  removeEntitlementOverride,
  saveEntitlement,
} from "./entitlement-actions";

type Company = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type Plan = {
  id: string;
  name: string;
  slug: string;
};

type Subscription = {
  id: string;
  company_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  current_period_end: string | null;
};

type Module = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
};

type PlanModule = {
  id: string;
  plan_id: string;
  module_id: string;
};

type Entitlement = {
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

type Props = {
  companies: Company[];
  plans: Plan[];
  subscriptions: Subscription[];
  modules: Module[];
  planModules: PlanModule[];
  entitlements: Entitlement[];
};

type EffectiveAccess = {
  access:
    | "enabled"
    | "disabled"
    | "unavailable";

  source:
    | "plan"
    | "override"
    | "free"
    | "none";

  expiresAt: string | null;
  reason: string | null;
  entitlementId: string | null;
};

export default function EntitlementManagement({
  companies,
  plans,
  subscriptions,
  modules,
  planModules,
  entitlements,
}: Props) {
  const [
    selectedCompanyId,
    setSelectedCompanyId,
  ] = useState(
    companies[0]?.id ?? ""
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("all");

  const [
    editorModule,
    setEditorModule,
  ] = useState<Module | null>(null);

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const selectedCompany =
    companies.find(
      (company) =>
        company.id ===
        selectedCompanyId
    );

  const activeSubscription =
    subscriptions.find(
      (subscription) =>
        subscription.company_id ===
          selectedCompanyId &&
        [
          "trialing",
          "active",
          "past_due",
          "paused",
        ].includes(
          subscription.status
        )
    );

  const selectedPlan =
    plans.find(
      (plan) =>
        plan.id ===
        activeSubscription?.plan_id
    );

  const portalModule =
    modules.find(
      (module) =>
        module.slug ===
        "b2b-client-portal"
    );

  const categories = useMemo(() => {
    const values = new Set<string>();

    for (const module of modules) {
      if (module.category) {
        values.add(module.category);
      }
    }

    return Array.from(values).sort();
  }, [modules]);

  const getEffectiveAccess = (
    module: Module
  ): EffectiveAccess => {
    const companyEntitlements =
      entitlements
        .filter(
          (item) =>
            item.company_id ===
              selectedCompanyId &&
            item.module_id ===
              module.id
        )
        .sort(
          (a, b) =>
            new Date(
              b.updated_at
            ).getTime() -
            new Date(
              a.updated_at
            ).getTime()
        );

    const manual =
      companyEntitlements.find(
        (item) =>
          item.source ===
            "override" ||
          item.source === "free"
      );

    if (manual) {
      if (
        manual.expires_at &&
        new Date(
          manual.expires_at
        ).getTime() <
          Date.now()
      ) {
        // Expired manual entitlement.
        // Fall through to plan access.
      } else {
        return {
          access: manual.access,
          source: manual.source,
          expiresAt:
            manual.expires_at,
          reason:
            manual.reason,
          entitlementId:
            manual.id,
        };
      }
    }

    if (!activeSubscription) {
      return {
        access: "unavailable",
        source: "none",
        expiresAt: null,
        reason: null,
        entitlementId: null,
      };
    }

    const includedInPlan =
      planModules.some(
        (item) =>
          item.plan_id ===
            activeSubscription.plan_id &&
          item.module_id ===
            module.id
      );

    if (includedInPlan) {
      const planEntitlement =
        companyEntitlements.find(
          (item) =>
            item.source === "plan"
        );

      return {
        access: "enabled",
        source: "plan",
        expiresAt:
          planEntitlement?.expires_at ??
          activeSubscription.current_period_end,
        reason:
          planEntitlement?.reason ??
          null,
        entitlementId:
          planEntitlement?.id ??
          null,
      };
    }

    return {
      access: "unavailable",
      source: "none",
      expiresAt: null,
      reason: null,
      entitlementId: null,
    };
  };

  const portalAccess =
    portalModule
      ? getEffectiveAccess(
          portalModule
        )
      : {
          access: "unavailable",
          source: "none",
          expiresAt: null,
          reason: null,
          entitlementId: null,
        };

  const filteredModules =
    modules.filter((module) => {
      const normalizedSearch =
        search.toLowerCase();

      const matchesSearch =
        !search ||
        module.name
          .toLowerCase()
          .includes(
            normalizedSearch
          ) ||
        module.slug
          .toLowerCase()
          .includes(
            normalizedSearch
          );

      const matchesCategory =
        categoryFilter === "all" ||
        module.category ===
          categoryFilter;

      return (
        matchesSearch &&
        matchesCategory
      );
    });

  const effectiveRows =
    modules.map((module) => ({
      module,
      access:
        getEffectiveAccess(module),
    }));

  const enabledCount =
    effectiveRows.filter(
      ({ access }) =>
        access.access ===
        "enabled"
    ).length;

  const overrideCount =
    effectiveRows.filter(
      ({ access }) =>
        access.source ===
        "override"
    ).length;

  const freeCount =
    effectiveRows.filter(
      ({ access }) =>
        access.source ===
        "free"
    ).length;

  const unavailableCount =
    effectiveRows.filter(
      ({ access }) =>
        access.access ===
        "unavailable"
    ).length;

  function submitEntitlement(
    formData: FormData
  ) {
    startTransition(async () => {
      try {
        await saveEntitlement(
          formData
        );

        setEditorModule(null);
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Unable to save entitlement."
        );
      }
    });
  }

  function removeOverride(
    module: Module
  ) {
    const formData =
      new FormData();

    formData.set(
      "companyId",
      selectedCompanyId
    );

    formData.set(
      "moduleSlug",
      module.slug
    );

    startTransition(async () => {
      try {
        await removeEntitlementOverride(
          formData
        );
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Unable to remove override."
        );
      }
    });
  }

  function enableClientPortal() {
    if (!selectedCompanyId) {
      window.alert(
        "Please select a company first."
      );
      return;
    }

    const formData =
      new FormData();

    formData.set(
      "companyId",
      selectedCompanyId
    );

    formData.set(
      "moduleSlug",
      "b2b-client-portal"
    );

    formData.set(
      "mode",
      "free"
    );

    formData.set(
      "reason",
      "Client Portal enabled by platform administrator."
    );

    startTransition(async () => {
      try {
        await saveEntitlement(
          formData
        );
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Unable to enable Client Portal."
        );
      }
    });
  }

  function disableClientPortal() {
    if (!selectedCompanyId) {
      return;
    }

    if (
      !window.confirm(
        "Disable Client Portal access for this company?"
      )
    ) {
      return;
    }

    const formData =
      new FormData();

    formData.set(
      "companyId",
      selectedCompanyId
    );

    formData.set(
      "moduleSlug",
      "b2b-client-portal"
    );

    startTransition(async () => {
      try {
        await removeEntitlementOverride(
          formData
        );
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Unable to disable Client Portal."
        );
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
            <ShieldCheck className="h-4 w-4" />

            Platform Management
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Entitlements
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Control company-level access to SBS
            modules without changing the
            customer&apos;s subscription plan or
            locked-in pricing.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          <LockKeyhole className="h-4 w-4" />

          Platform Admin
        </div>
      </div>

      {/* COMPANY SELECTOR */}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[minmax(280px,1fr)_auto] lg:items-end">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Company
            </label>

            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <select
                value={
                  selectedCompanyId
                }
                onChange={(event) =>
                  setSelectedCompanyId(
                    event.target.value
                  )
                }
                className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {companies.map(
                  (company) => (
                    <option
                      key={company.id}
                      value={company.id}
                    >
                      {company.name}
                    </option>
                  )
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {selectedCompany && (
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={
                  selectedCompany.status
                }
                tone={
                  selectedCompany.status ===
                  "active"
                    ? "green"
                    : "slate"
                }
              />

              {selectedPlan && (
                <StatusPill
                  label={`Plan: ${selectedPlan.name}`}
                  tone="blue"
                />
              )}

              {activeSubscription && (
                <StatusPill
                  label={
                    activeSubscription.billing_cycle
                  }
                  tone="slate"
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* CLIENT PORTAL ACCESS */}

      {selectedCompany && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-white to-white px-6 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    portalAccess.access ===
                    "enabled"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Users className="h-5 w-5" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">
                      Client Portal Access
                    </h2>

                    <StatusPill
                      label={
                        portalAccess.access ===
                        "enabled"
                          ? "Enabled"
                          : portalAccess.access ===
                              "disabled"
                            ? "Disabled"
                            : "Not Enabled"
                      }
                      tone={
                        portalAccess.access ===
                        "enabled"
                          ? "green"
                          : portalAccess.access ===
                              "disabled"
                            ? "red"
                            : "slate"
                      }
                    />
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    B2B Client Portal for{" "}
                    <span className="font-medium text-slate-700">
                      {selectedCompany.name}
                    </span>
                    .
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {portalAccess.access ===
                  "enabled" && (
                  <button
                    type="button"
                    disabled={
                      isPending
                    }
                    onClick={
                      disableClientPortal
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CircleOff className="h-3.5 w-3.5" />

                    Disable Portal
                  </button>
                )}

                {portalAccess.access !==
                  "enabled" && (
                  <button
                    type="button"
                    disabled={
                      isPending ||
                      !portalModule
                    }
                    onClick={
                      enableClientPortal
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />

                    {isPending
                      ? "Enabling..."
                      : "Enable Client Portal"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-5 md:grid-cols-3">
            <PortalInfo
              label="Module"
              value={
                portalModule?.name ??
                "B2B Client Portal"
              }
            />

            <PortalInfo
              label="Access Type"
              value={
                portalAccess.source ===
                "free"
                  ? "Free Grant"
                  : portalAccess.source ===
                      "override"
                    ? "Company Override"
                    : portalAccess.source ===
                        "plan"
                      ? "Subscription Plan"
                      : "Not Enabled"
              }
            />

            <PortalInfo
              label="Expiration"
              value={
                portalAccess.expiresAt
                  ? formatDate(
                      portalAccess.expiresAt
                    )
                  : portalAccess.access ===
                      "enabled"
                    ? "No expiration"
                    : "—"
              }
            />
          </div>

          {portalAccess.reason && (
            <div className="border-t border-slate-100 px-6 py-4">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">
                  Reason:
                </span>{" "}
                {portalAccess.reason}
              </p>
            </div>
          )}

          <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

              <p className="text-xs leading-5 text-slate-500">
                Enabling this gives the company
                access to the B2B Client Portal.
                It does not change the company&apos;s
                subscription plan or billing price.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* STATS */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Enabled Modules"
          value={enabledCount}
          detail={`of ${modules.length} built modules`}
          icon={Check}
          tone="green"
        />

        <StatCard
          label="Manual Overrides"
          value={overrideCount}
          detail="Company-specific access"
          icon={ShieldCheck}
          tone="blue"
        />

        <StatCard
          label="Free Grants"
          value={freeCount}
          detail="Independent of plan access"
          icon={Sparkles}
          tone="amber"
        />

        <StatCard
          label="Not Included"
          value={unavailableCount}
          detail="Not available on current plan"
          icon={CircleOff}
          tone="slate"
        />
      </div>

      {/* MODULE ACCESS */}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Module Access
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Effective access for{" "}
              <span className="font-medium text-slate-700">
                {selectedCompany?.name ??
                  "this company"}
              </span>
              .
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search modules..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-56"
              />
            </div>

            <div className="relative">
              <select
                value={
                  categoryFilter
                }
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value
                  )
                }
                className="h-10 appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="all">
                  All categories
                </option>

                {categories.map(
                  (category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  )
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredModules.map(
            (module) => {
              const access =
                getEffectiveAccess(
                  module
                );

              return (
                <ModuleRow
                  key={module.id}
                  module={module}
                  access={access}
                  disabled={
                    isPending
                  }
                  onManage={() =>
                    setEditorModule(
                      module
                    )
                  }
                  onRemoveOverride={() =>
                    removeOverride(
                      module
                    )
                  }
                />
              );
            }
          )}

          {filteredModules.length ===
            0 && (
            <div className="px-6 py-12 text-center">
              <Search className="mx-auto h-6 w-6 text-slate-300" />

              <p className="mt-3 text-sm font-medium text-slate-700">
                No modules found
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try another search or
                category.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ARCHITECTURE */}

      <section className="grid gap-4 lg:grid-cols-3">
        <ArchitectureCard
          icon={Layers3}
          title="Plan Access"
          description="The customer's subscription plan provides the default module access through plan_modules."
        />

        <ArchitectureCard
          icon={ShieldCheck}
          title="Company Override"
          description="A platform admin can enable or disable a module for one company without changing the customer's plan."
        />

        <ArchitectureCard
          icon={Sparkles}
          title="Free Grant"
          description="A module can be granted independently of the company's plan, optionally with an expiration date."
        />
      </section>

      {/* EDITOR */}

      {editorModule && (
        <EntitlementEditor
          module={
            editorModule
          }
          companyId={
            selectedCompanyId
          }
          currentAccess={getEffectiveAccess(
            editorModule
          )}
          disabled={
            isPending
          }
          onClose={() =>
            setEditorModule(null)
          }
          onSubmit={
            submitEntitlement
          }
        />
      )}
    </div>
  );
}

/* ============================================================
   PORTAL INFO
============================================================ */

function PortalInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-slate-800">
        {value}
      </div>
    </div>
  );
}

/* ============================================================
   MODULE ICON
============================================================ */

function ModuleIcon({
  slug,
  className = "h-5 w-5",
}: {
  slug: string;
  className?: string;
}) {
  const icons: Record<
    string,
    React.ComponentType<{
      className?: string;
    }>
  > = {
    customers: Users,
    estimates: ClipboardCheck,
    "sales-orders": ShoppingCart,
    invoices: Receipt,
    payments: Landmark,

    products: Package,
    "serial-assets": HardDrive,
    inventory: Boxes,
    warehouses: Building2,
    pricing: Calculator,

    suppliers: Truck,
    "purchase-orders": ClipboardList,
    expenses: FileText,

    warranty: ShieldCheck,
    repairs: Wrench,
    rma: RotateCcw,
    "service-providers":
      BriefcaseBusiness,
    "service-jobs": Wrench,

    "b2b-client-portal": Users,
    analytics: BarChart3,
    employees: Users,
    documents: FileUp,
    settings: Settings,

    crm: Users,
    leads: Search,
    jobs: BriefcaseBusiness,
    reports: BarChart3,
  };

  const Icon =
    icons[slug] ?? Layers3;

  return (
    <Icon
      className={className}
    />
  );
}

/* ============================================================
   MODULE ROW
============================================================ */

function ModuleRow({
  module,
  access,
  disabled,
  onManage,
  onRemoveOverride,
}: {
  module: Module;
  access: EffectiveAccess;
  disabled: boolean;
  onManage: () => void;
  onRemoveOverride: () => void;
}) {
  const enabled =
    access.access ===
    "enabled";

  const unavailable =
    access.access ===
    "unavailable";

  return (
    <div className="flex flex-col gap-5 px-6 py-5 transition hover:bg-slate-50/70 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            enabled
              ? "bg-emerald-50 text-emerald-700"
              : unavailable
                ? "bg-slate-100 text-slate-400"
                : "bg-blue-50 text-blue-700"
          }`}
        >
          <ModuleIcon
            slug={module.slug}
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {module.name}
            </h3>

            <AccessBadge
              access={access}
            />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[10px] text-slate-400">
              {module.slug}
            </span>

            {module.category && (
              <>
                <span className="text-slate-300">
                  •
                </span>

                <span className="text-[11px] text-slate-400">
                  {module.category}
                </span>
              </>
            )}
          </div>

          {module.description && (
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              {module.description}
            </p>
          )}

          {access.reason && (
            <div className="mt-2 text-[11px] text-slate-400">
              Reason:{" "}
              <span className="text-slate-600">
                {access.reason}
              </span>
            </div>
          )}

          {access.expiresAt && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock3 className="h-3 w-3" />

              Expires{" "}
              {formatDate(
                access.expiresAt
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 lg:justify-end">
        {(access.source ===
          "override" ||
          access.source ===
            "free") && (
          <button
            type="button"
            disabled={disabled}
            onClick={
              onRemoveOverride
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />

            Reset
          </button>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={onManage}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck className="h-3.5 w-3.5" />

          Manage
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ENTITLEMENT EDITOR
============================================================ */

function EntitlementEditor({
  module,
  companyId,
  currentAccess,
  disabled,
  onClose,
  onSubmit,
}: {
  module: Module;
  companyId: string;
  currentAccess: EffectiveAccess;
  disabled: boolean;
  onClose: () => void;
  onSubmit: (
    formData: FormData
  ) => void;
}) {
  const defaultMode =
    currentAccess.source ===
    "free"
      ? "free"
      : currentAccess.source ===
          "override"
        ? currentAccess.access ===
          "disabled"
          ? "disabled"
          : "enabled"
        : "enabled";

  const [
    mode,
    setMode,
  ] = useState<
    "enabled" |
      "disabled" |
      "free"
  >(defaultMode);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ModuleIcon
                slug={module.slug}
              />
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Manage Entitlement
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                {module.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          action={onSubmit}
          className="space-y-5 p-6"
        >
          <input
            type="hidden"
            name="companyId"
            value={companyId}
          />

          <input
            type="hidden"
            name="moduleSlug"
            value={module.slug}
          />

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Access
            </label>

            <div className="grid gap-2">
              <AccessOption
                value="enabled"
                selected={
                  mode ===
                  "enabled"
                }
                title="Enable override"
                description="Give this company access even if the current plan does not include the module."
                onClick={() =>
                  setMode(
                    "enabled"
                  )
                }
              />

              <AccessOption
                value="disabled"
                selected={
                  mode ===
                  "disabled"
                }
                title="Disable access"
                description="Explicitly block this module for this company, even if their plan includes it."
                onClick={() =>
                  setMode(
                    "disabled"
                  )
                }
              />

              <AccessOption
                value="free"
                selected={
                  mode === "free"
                }
                title="Free grant"
                description="Grant this module independently of the company's subscription plan."
                onClick={() =>
                  setMode("free")
                }
              />
            </div>
          </div>

          <input
            type="hidden"
            name="mode"
            value={mode}
          />

          <div>
            <label
              htmlFor="expiresAt"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Expiration
            </label>

            <input
              id="expiresAt"
              name="expiresAt"
              type="date"
              defaultValue={
                currentAccess.expiresAt
                  ? currentAccess.expiresAt.slice(
                      0,
                      10
                    )
                  : ""
              }
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />

            <p className="mt-1.5 text-[11px] text-slate-400">
              Leave empty for no expiration.
            </p>
          </div>

          <div>
            <label
              htmlFor="reason"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Reason
            </label>

            <textarea
              id="reason"
              name="reason"
              defaultValue={
                currentAccess.reason ??
                ""
              }
              rows={3}
              placeholder="Why is this entitlement being changed?"
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />

              <p className="text-xs leading-5 text-blue-700">
                This changes the company's
                module entitlement only. It
                does not change the customer's
                subscription plan or
                subscription price.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={disabled}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" />

              {disabled
                ? "Saving..."
                : "Save Entitlement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   ACCESS OPTION
============================================================ */

function AccessOption({
  value,
  selected,
  title,
  description,
  onClick,
}: {
  value: string;
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
        selected
          ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-slate-300"
        }`}
      >
        {selected && (
          <Check className="h-3 w-3" />
        )}
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-800">
          {title}
        </div>

        <div className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </div>
      </div>

      <input
        type="radio"
        value={value}
        checked={selected}
        onChange={onClick}
        className="sr-only"
      />
    </button>
  );
}

/* ============================================================
   ACCESS BADGE
============================================================ */

function AccessBadge({
  access,
}: {
  access: EffectiveAccess;
}) {
  if (
    access.source ===
    "override"
  ) {
    if (
      access.access ===
      "disabled"
    ) {
      return (
        <StatusPill
          label="Override • Disabled"
          tone="red"
        />
      );
    }

    return (
      <StatusPill
        label="Override • Enabled"
        tone="blue"
      />
    );
  }

  if (
    access.source === "free"
  ) {
    return (
      <StatusPill
        label="Free Grant"
        tone="amber"
      />
    );
  }

  if (
    access.source === "plan"
  ) {
    return (
      <StatusPill
        label="Plan"
        tone="green"
      />
    );
  }

  return (
    <StatusPill
      label="Not Included"
      tone="slate"
    />
  );
}

/* ============================================================
   STATUS PILL
============================================================ */

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone:
    | "green"
    | "blue"
    | "amber"
    | "red"
    | "slate";
}) {
  const classes = {
    green:
      "bg-emerald-50 text-emerald-700",
    blue:
      "bg-blue-50 text-blue-700",
    amber:
      "bg-amber-50 text-amber-700",
    red:
      "bg-red-50 text-red-700",
    slate:
      "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${classes[tone]}`}
    >
      {label}
    </span>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  tone:
    | "green"
    | "blue"
    | "amber"
    | "slate";
}) {
  const iconClasses = {
    green:
      "bg-emerald-50 text-emerald-700",
    blue:
      "bg-blue-50 text-blue-700",
    amber:
      "bg-amber-50 text-amber-700",
    slate:
      "bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClasses[tone]}`}
      >
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
   DATE
============================================================ */

function formatDate(
  value: string
) {
  try {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    ).format(new Date(value));
  } catch {
    return value;
  }
}