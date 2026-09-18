"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  ExternalLink,
  Layers3,
  Loader2,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  createPlan,
  updatePlan,
  type PlanActionInput,
} from "./plan-actions";

/* ============================================================
   TYPES
============================================================ */

type Plan = {
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

type Module = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

type PlanModule = {
  plan_id: string;
  module_id: string;
};

type PlanLimit = {
  id: string;
  plan_id: string;
  limit_key: string;
  limit_value: number | null;
  is_unlimited: boolean;
};

type LimitDraft = {
  limitKey: string;
  limitValue: string;
  isUnlimited: boolean;
};

type Props = {
  plans: Plan[];
  modules: Module[];
  planModules: PlanModule[];
  planLimits: PlanLimit[];
};

/* ============================================================
   SBS BUILT COMMERCIAL MODULES
============================================================ */

/*
 * IMPORTANT
 *
 * These are the modules that currently exist in the SBS
 * customer-facing application.
 *
 * Dashboard and Settings are intentionally excluded because
 * they are platform/application infrastructure rather than
 * commercial modules.
 *
 * "Quotes" in the UI maps to the existing "estimates" module
 * slug.
 *
 * "Analytics" uses the actual "analytics" module slug.
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
 * The visual grouping follows the actual SBS navigation.
 */
const MODULE_GROUPS = [
  {
    title: "Sales",
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
    slugs: [
      "suppliers",
      "purchase-orders",
      "expenses",
    ],
  },

  {
    title: "Service",
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
    slugs: [
      "b2b-client-portal",
      "analytics",
      "employees",
      "documents",
    ],
  },
] as const;

/* ============================================================
   RESOURCE LIMITS
============================================================ */

const LIMIT_LABELS: Record<string, string> = {
  warehouses: "Warehouses",
  employees: "Employees",
  users: "Users",
  products: "Products",
  customers: "Customers",

  suppliers: "Suppliers",

  invoices_per_month:
    "Invoices per month",

  purchase_orders_per_month:
    "Purchase orders per month",

  sales_orders_per_month:
    "Sales orders per month",

  quotes_per_month:
    "Quotes per month",

  service_jobs_per_month:
    "Service jobs per month",

  storage_gb:
    "Storage",
};

const LIMIT_DESCRIPTIONS: Record<string, string> = {
  warehouses:
    "Maximum number of warehouses a company can create.",

  employees:
    "Maximum number of employees available to the company.",

  users:
    "Maximum number of platform users for the company.",

  products:
    "Maximum number of products in the catalog.",

  customers:
    "Maximum number of customers.",

  suppliers:
    "Maximum number of suppliers.",

  invoices_per_month:
    "Maximum number of invoices created per month.",

  purchase_orders_per_month:
    "Maximum number of purchase orders created per month.",

  sales_orders_per_month:
    "Maximum number of sales orders created per month.",

  quotes_per_month:
    "Maximum number of quotes created per month.",

  service_jobs_per_month:
    "Maximum number of service jobs created per month.",

  storage_gb:
    "Maximum document and file storage in gigabytes.",
};

/* ============================================================
   SHARED INPUT
============================================================ */

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

/* ============================================================
   MAIN
============================================================ */

export default function PlanManagement({
  plans,
  modules,
  planModules,
  planLimits,
}: Props) {
  const [
    selectedPlanId,
    setSelectedPlanId,
  ] = useState<string | null>(null);

  const [creating, setCreating] =
    useState(false);

  const selectedPlan = useMemo(
    () =>
      plans.find(
        (plan) =>
          plan.id === selectedPlanId
      ) ?? null,
    [plans, selectedPlanId]
  );

  /*
   * Only modules from the actual built SBS commercial
   * module catalog are shown.
   */
  const builtModules = useMemo(() => {
    const order = new Map<string, number>(
      BUILT_MODULE_SLUGS.map(
        (slug, index) => [
          slug,
          index,
        ]
      )
    );

    return modules
      .filter((module) =>
        order.has(module.slug)
      )
      .sort(
        (a, b) =>
          (order.get(a.slug) ?? 999) -
          (order.get(b.slug) ?? 999)
      );
  }, [modules]);

  function openPlan(
    planId: string
  ) {
    setSelectedPlanId(planId);
    setCreating(false);
  }

  function closeEditor() {
    setSelectedPlanId(null);
    setCreating(false);
  }

  function openCreate() {
    setSelectedPlanId(null);
    setCreating(true);
  }

  return (
    <>
      <div className="space-y-8">
        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-emerald-600" />

              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">
                Configuration
              </span>
            </div>

            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Plan Management
            </h2>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Manage the commercial plans that SBS
              customers can subscribe to.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Create Plan
          </button>
        </div>

        {/* ==================================================
            PLAN LIST
        ================================================== */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {plans.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Layers3 className="mx-auto h-7 w-7 text-slate-300" />

              <p className="mt-3 text-sm font-semibold text-slate-700">
                No plans configured
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Create your first SBS subscription plan.
              </p>

              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Create Plan
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {plans.map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  isOpen={
                    selectedPlanId === plan.id
                  }
                  onToggle={() =>
                    setSelectedPlanId(
                      selectedPlanId === plan.id
                        ? null
                        : plan.id
                    )
                  }
                  onManage={() =>
                    openPlan(plan.id)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==================================================
          EDIT
      ================================================== */}

      {selectedPlan && (
        <PlanEditor
          mode="edit"
          plan={selectedPlan}
          modules={builtModules}
          planModules={planModules}
          planLimits={planLimits}
          onClose={closeEditor}
        />
      )}

      {/* ==================================================
          CREATE
      ================================================== */}

      {creating && (
        <PlanEditor
          mode="create"
          plan={null}
          modules={builtModules}
          planModules={[]}
          planLimits={[]}
          onClose={closeEditor}
        />
      )}
    </>
  );
}

/* ============================================================
   PLAN ROW
============================================================ */

function PlanRow({
  plan,
  isOpen,
  onToggle,
  onManage,
}: {
  plan: Plan;
  isOpen: boolean;
  onToggle: () => void;
  onManage: () => void;
}) {
  return (
    <div>
      <div className="flex w-full items-center gap-4 px-6 py-5 transition hover:bg-slate-50">
        {/* PLAN INFO */}

        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
            {plan.name
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">
                {plan.name}
              </span>

              {plan.is_popular && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                  <Sparkles className="h-3 w-3" />
                  Popular
                </span>
              )}

              <StatusPill
                active={plan.is_active}
              />
            </div>

            <div className="mt-1 font-mono text-[10px] text-slate-400">
              {plan.slug}
            </div>
          </div>

          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-slate-800">
              {formatPlanPrice(
                plan.monthly_price,
                plan.currency
              )}
            </div>

            <div className="mt-0.5 text-[11px] text-slate-400">
              {plan.yearly_price !== null
                ? `${formatPlanPrice(
                    plan.yearly_price,
                    plan.currency
                  )}/yr`
                : "Custom billing"}
            </div>
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </button>

        {/* REAL MANAGE BUTTON */}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onManage();
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 active:scale-[0.98]"
        >
          <Settings2 className="h-3.5 w-3.5" />

          <span className="hidden sm:inline">
            Manage
          </span>
        </button>
      </div>

      {/* EXPANDED DETAILS */}

      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MiniValue
              label="Monthly"
              value={formatPlanPrice(
                plan.monthly_price,
                plan.currency
              )}
            />

            <MiniValue
              label="Yearly"
              value={
                plan.yearly_price !== null
                  ? formatPlanPrice(
                      plan.yearly_price,
                      plan.currency
                    )
                  : "Custom"
              }
            />

            <MiniValue
              label="Currency"
              value={
                plan.currency ?? "USD"
              }
            />

            <MiniValue
              label="PayPal"
              value={
                plan.paypal_product_id
                  ? "Configured"
                  : "Not configured"
              }
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onManage}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
            >
              <Settings2 className="h-4 w-4" />
              Manage {plan.name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PLAN EDITOR
============================================================ */

function PlanEditor({
  mode,
  plan,
  modules,
  planModules,
  planLimits,
  onClose,
}: {
  mode: "create" | "edit";
  plan: Plan | null;
  modules: Module[];
  planModules: PlanModule[];
  planLimits: PlanLimit[];
  onClose: () => void;
}) {
  const initialModuleIds =
    useMemo(() => {
      if (!plan) {
        return [];
      }

      return planModules
        .filter(
          (row) =>
            row.plan_id === plan.id
        )
        .map(
          (row) =>
            row.module_id
        );
    }, [plan, planModules]);

  const initialLimits =
    useMemo(() => {
      if (!plan) {
        return [];
      }

      return planLimits
        .filter(
          (limit) =>
            limit.plan_id === plan.id
        )
        .map(
          (limit): LimitDraft => ({
            limitKey:
              limit.limit_key,

            limitValue:
              limit.limit_value !== null
                ? String(
                    limit.limit_value
                  )
                : "",

            isUnlimited:
              limit.is_unlimited,
          })
        );
    }, [plan, planLimits]);

  /* BASIC */

  const [name, setName] =
    useState(
      plan?.name ?? ""
    );

  const [slug, setSlug] =
    useState(
      plan?.slug ?? ""
    );

  const [description, setDescription] =
    useState(
      plan?.description ?? ""
    );

  /* PRICING */

  const [
    monthlyPrice,
    setMonthlyPrice,
  ] = useState(
    plan?.monthly_price !== null &&
      plan?.monthly_price !== undefined
      ? String(
          plan.monthly_price
        )
      : ""
  );

  const [
    yearlyPrice,
    setYearlyPrice,
  ] = useState(
    plan?.yearly_price !== null &&
      plan?.yearly_price !== undefined
      ? String(
          plan.yearly_price
        )
      : ""
  );

  const [
    currency,
    setCurrency,
  ] = useState(
    plan?.currency ?? "USD"
  );

  /* STATUS */

  const [
    isActive,
    setIsActive,
  ] = useState(
    plan?.is_active ?? true
  );

  const [
    isPopular,
    setIsPopular,
  ] = useState(
    plan?.is_popular ?? false
  );

  /* PAYPAL */

  const [
    paypalProductId,
    setPaypalProductId,
  ] = useState(
    plan?.paypal_product_id ?? ""
  );

  const [
    paypalMonthlyPlanId,
    setPaypalMonthlyPlanId,
  ] = useState(
    plan?.paypal_monthly_plan_id ?? ""
  );

  const [
    paypalYearlyPlanId,
    setPaypalYearlyPlanId,
  ] = useState(
    plan?.paypal_yearly_plan_id ?? ""
  );

  /* MODULES */

  const [
    selectedModuleIds,
    setSelectedModuleIds,
  ] = useState<string[]>(
    initialModuleIds
  );

  /* LIMITS */

  const [limits, setLimits] =
    useState<LimitDraft[]>(
      initialLimits
    );

  /* EDITOR */

  const [
    activeSection,
    setActiveSection,
  ] = useState<
    | "basic"
    | "pricing"
    | "modules"
    | "limits"
    | "paypal"
  >("basic");

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [success, setSuccess] =
    useState<string | null>(
      null
    );

  const isCreate =
    mode === "create";

  /* ==========================================================
     MODULE TOGGLE
  ========================================================== */

  function toggleModule(
    moduleId: string
  ) {
    setSelectedModuleIds(
      (current) =>
        current.includes(moduleId)
          ? current.filter(
              (id) =>
                id !== moduleId
            )
          : [
              ...current,
              moduleId,
            ]
    );
  }

  /* ==========================================================
     LIMIT UPDATE
  ========================================================== */

  function updateLimit(
    index: number,
    patch: Partial<LimitDraft>
  ) {
    setLimits(
      (current) =>
        current.map(
          (limit, i) =>
            i === index
              ? {
                  ...limit,
                  ...patch,
                }
              : limit
        )
    );
  }

  function addLimit() {
    setLimits(
      (current) => [
        ...current,
        {
          limitKey: "",
          limitValue: "",
          isUnlimited: false,
        },
      ]
    );
  }

  function removeLimit(
    index: number
  ) {
    setLimits(
      (current) =>
        current.filter(
          (_, i) =>
            i !== index
        )
    );
  }

  /* ==========================================================
     SAVE
  ========================================================== */

  function handleSave() {
    setError(null);
    setSuccess(null);

    const normalizedName =
      name.trim();

    const normalizedSlug =
      slug
        .trim()
        .toLowerCase();

    if (!normalizedName) {
      setError(
        "Plan name is required."
      );

      setActiveSection(
        "basic"
      );

      return;
    }

    if (!normalizedSlug) {
      setError(
        "Plan slug is required."
      );

      setActiveSection(
        "basic"
      );

      return;
    }

    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        normalizedSlug
      )
    ) {
      setError(
        "Slug may only contain lowercase letters, numbers, and hyphens."
      );

      setActiveSection(
        "basic"
      );

      return;
    }

    const monthly =
      monthlyPrice.trim() === ""
        ? null
        : Number(
            monthlyPrice
          );

    const yearly =
      yearlyPrice.trim() === ""
        ? null
        : Number(
            yearlyPrice
          );

    if (
      monthly !== null &&
      (!Number.isFinite(
        monthly
      ) ||
        monthly < 0)
    ) {
      setError(
        "Enter a valid monthly price."
      );

      setActiveSection(
        "pricing"
      );

      return;
    }

    if (
      yearly !== null &&
      (!Number.isFinite(
        yearly
      ) ||
        yearly < 0)
    ) {
      setError(
        "Enter a valid yearly price."
      );

      setActiveSection(
        "pricing"
      );

      return;
    }

    /* ========================================================
       LIMIT VALIDATION
    ======================================================== */

    const normalizedLimits =
      limits
        .filter(
          (limit) =>
            limit.limitKey.trim()
        )
        .map(
          (limit) => ({
            limitKey:
              limit.limitKey
                .trim()
                .toLowerCase(),

            limitValue:
              limit.isUnlimited ||
              limit.limitValue.trim() === ""
                ? null
                : Number(
                    limit.limitValue
                  ),

            isUnlimited:
              limit.isUnlimited,
          })
        );

    const seenLimits =
      new Set<string>();

    for (
      const limit of
        normalizedLimits
    ) {
      if (
        seenLimits.has(
          limit.limitKey
        )
      ) {
        setError(
          `Duplicate resource limit: ${limit.limitKey}`
        );

        setActiveSection(
          "limits"
        );

        return;
      }

      seenLimits.add(
        limit.limitKey
      );

      if (
        !limit.isUnlimited &&
        (
          limit.limitValue ===
            null ||
          !Number.isFinite(
            limit.limitValue
          ) ||
          limit.limitValue < 0
        )
      ) {
        setError(
          `Enter a valid value for ${limit.limitKey}.`
        );

        setActiveSection(
          "limits"
        );

        return;
      }
    }

    /* ========================================================
       SAVE
    ======================================================== */

    startTransition(
      async () => {
        try {
          if (isCreate) {
            await createPlan({
              name:
                normalizedName,

              slug:
                normalizedSlug,

              description:
                description.trim(),

              monthlyPrice:
                monthly,

              yearlyPrice:
                yearly,

              currency:
                currency
                  .trim()
                  .toUpperCase(),

              isActive,

              isPopular,

              paypalProductId:
                paypalProductId.trim(),

              paypalMonthlyPlanId:
                paypalMonthlyPlanId.trim(),

              paypalYearlyPlanId:
                paypalYearlyPlanId.trim(),

              moduleIds:
                selectedModuleIds,

              limits:
                normalizedLimits,
            });

            setSuccess(
              "Plan created successfully."
            );
          } else {
            if (!plan) {
              throw new Error(
                "Plan not found."
              );
            }

            const payload: PlanActionInput =
              {
                planId:
                  plan.id,

                name:
                  normalizedName,

                slug:
                  normalizedSlug,

                description:
                  description.trim(),

                monthlyPrice:
                  monthly,

                yearlyPrice:
                  yearly,

                currency:
                  currency
                    .trim()
                    .toUpperCase(),

                isActive,

                isPopular,

                paypalProductId:
                  paypalProductId.trim(),

                paypalMonthlyPlanId:
                  paypalMonthlyPlanId.trim(),

                paypalYearlyPlanId:
                  paypalYearlyPlanId.trim(),

                moduleIds:
                  selectedModuleIds,

                limits:
                  normalizedLimits,
              };

            await updatePlan(
              payload
            );

            setSuccess(
              "Plan configuration saved successfully."
            );
          }

          setTimeout(
            () => {
              window.location.reload();
            },
            700
          );
        } catch (
          saveError
        ) {
          setError(
            saveError instanceof
              Error
              ? saveError.message
              : "Unable to save plan."
          );
        }
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* BACKDROP */}

      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!isPending) {
            onClose();
          }
        }}
      />

      {/* MODAL */}

      <div className="relative flex min-h-full items-start justify-center p-4 sm:p-6 lg:p-10">
        <div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* ==================================================
              HEADER
          ================================================== */}

          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                {isCreate ? (
                  <Plus className="h-5 w-5" />
                ) : (
                  <Settings2 className="h-5 w-5" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    {isCreate
                      ? "Create Plan"
                      : `Manage ${plan?.name}`}
                  </h2>

                  {!isCreate &&
                    plan?.is_popular && (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                        Popular
                      </span>
                    )}
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {isCreate
                    ? "Create a new SBS subscription plan."
                    : "Configure pricing, modules, limits, and billing identifiers."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ==================================================
              BODY
          ================================================== */}

          <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
            {/* NAV */}

            <div className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
              <EditorNav
                active={activeSection}
                onChange={
                  setActiveSection
                }
              />
            </div>

            {/* CONTENT */}

            <div className="min-h-[600px]">
              <div className="max-h-[calc(100vh-230px)] overflow-y-auto p-6">
                {activeSection ===
                  "basic" && (
                  <BasicSection
                    name={name}
                    setName={setName}
                    slug={slug}
                    setSlug={setSlug}
                    description={
                      description
                    }
                    setDescription={
                      setDescription
                    }
                    isActive={
                      isActive
                    }
                    setIsActive={
                      setIsActive
                    }
                    isPopular={
                      isPopular
                    }
                    setIsPopular={
                      setIsPopular
                    }
                  />
                )}

                {activeSection ===
                  "pricing" && (
                  <PricingSection
                    monthlyPrice={
                      monthlyPrice
                    }
                    setMonthlyPrice={
                      setMonthlyPrice
                    }
                    yearlyPrice={
                      yearlyPrice
                    }
                    setYearlyPrice={
                      setYearlyPrice
                    }
                    currency={
                      currency
                    }
                    setCurrency={
                      setCurrency
                    }
                  />
                )}

                {activeSection ===
                  "modules" && (
                  <ModulesSection
                    modules={
                      modules
                    }
                    selectedIds={
                      selectedModuleIds
                    }
                    onToggle={
                      toggleModule
                    }
                  />
                )}

                {activeSection ===
                  "limits" && (
                  <LimitsSection
                    limits={
                      limits
                    }
                    onUpdate={
                      updateLimit
                    }
                    onAdd={
                      addLimit
                    }
                    onRemove={
                      removeLimit
                    }
                  />
                )}

                {activeSection ===
                  "paypal" && (
                  <PayPalSection
                    paypalProductId={
                      paypalProductId
                    }
                    setPaypalProductId={
                      setPaypalProductId
                    }
                    paypalMonthlyPlanId={
                      paypalMonthlyPlanId
                    }
                    setPaypalMonthlyPlanId={
                      setPaypalMonthlyPlanId
                    }
                    paypalYearlyPlanId={
                      paypalYearlyPlanId
                    }
                    setPaypalYearlyPlanId={
                      setPaypalYearlyPlanId
                    }
                  />
                )}
              </div>
            </div>
          </div>

          {/* ==================================================
              FOOTER
          ================================================== */}

          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Platform administrator controls
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    handleSave
                  }
                  disabled={
                    isPending
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />

                      {isCreate
                        ? "Creating..."
                        : "Saving..."}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />

                      {isCreate
                        ? "Create Plan"
                        : "Save Changes"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   EDITOR NAV
============================================================ */

function EditorNav({
  active,
  onChange,
}: {
  active:
    | "basic"
    | "pricing"
    | "modules"
    | "limits"
    | "paypal";

  onChange: (
    value:
      | "basic"
      | "pricing"
      | "modules"
      | "limits"
      | "paypal"
  ) => void;
}) {
  const items = [
    {
      id: "basic" as const,
      label: "Basic Information",
      description:
        "Name, description and status",
    },

    {
      id: "pricing" as const,
      label: "Pricing",
      description:
        "Monthly and yearly pricing",
    },

    {
      id: "modules" as const,
      label: "Module Access",
      description:
        "Features included in plan",
    },

    {
      id: "limits" as const,
      label: "Resource Limits",
      description:
        "Usage limits and quotas",
    },

    {
      id: "paypal" as const,
      label: "PayPal",
      description:
        "Payment provider IDs",
    },
  ];

  return (
    <nav className="space-y-1">
      {items.map(
        (item) => {
          const selected =
            active === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                onChange(
                  item.id
                )
              }
              className={`w-full rounded-xl px-3.5 py-3 text-left transition ${
                selected
                  ? "bg-white shadow-sm ring-1 ring-slate-200"
                  : "hover:bg-white/70"
              }`}
            >
              <div
                className={`text-xs font-semibold ${
                  selected
                    ? "text-slate-900"
                    : "text-slate-600"
                }`}
              >
                {item.label}
              </div>

              <div className="mt-1 text-[10px] leading-4 text-slate-400">
                {item.description}
              </div>
            </button>
          );
        }
      )}
    </nav>
  );
}

/* ============================================================
   BASIC SECTION
============================================================ */

function BasicSection({
  name,
  setName,
  slug,
  setSlug,
  description,
  setDescription,
  isActive,
  setIsActive,
  isPopular,
  setIsPopular,
}: {
  name: string;
  setName: (
    value: string
  ) => void;

  slug: string;
  setSlug: (
    value: string
  ) => void;

  description: string;
  setDescription: (
    value: string
  ) => void;

  isActive: boolean;
  setIsActive: (
    value: boolean
  ) => void;

  isPopular: boolean;
  setIsPopular: (
    value: boolean
  ) => void;
}) {
  return (
    <EditorSection
      title="Basic Information"
      description="Define the identity and availability of this plan."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Plan name"
          required
        >
          <input
            value={name}
            onChange={(event) =>
              setName(
                event.target
                  .value
              )
            }
            className={
              inputClass
            }
            placeholder="Professional"
          />
        </Field>

        <Field
          label="Slug"
          required
        >
          <input
            value={slug}
            onChange={(event) =>
              setSlug(
                event.target
                  .value
                  .toLowerCase()
                  .replace(
                    /\s+/g,
                    "-"
                  )
              )
            }
            className={`${inputClass} font-mono`}
            placeholder="professional"
          />
        </Field>
      </div>

      <Field
        label="Description"
        hint="Used wherever the plan is presented to customers."
      >
        <textarea
          value={description}
          onChange={(event) =>
            setDescription(
              event.target
                .value
            )
          }
          rows={4}
          className={`${inputClass} h-auto resize-none py-2.5`}
          placeholder="Advanced tools for growing businesses."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleCard
          checked={
            isActive
          }
          onChange={
            setIsActive
          }
          title="Plan active"
          description="Active plans can be offered to new customers."
        />

        <ToggleCard
          checked={
            isPopular
          }
          onChange={
            setIsPopular
          }
          title="Mark as popular"
          description="Highlight this plan in customer-facing pricing."
        />
      </div>

      <InfoBox>
        Deactivating a plan does not automatically cancel
        existing subscriptions. Existing subscriptions remain
        separate from the plan catalog.
      </InfoBox>
    </EditorSection>
  );
}

/* ============================================================
   PRICING SECTION
============================================================ */

function PricingSection({
  monthlyPrice,
  setMonthlyPrice,
  yearlyPrice,
  setYearlyPrice,
  currency,
  setCurrency,
}: {
  monthlyPrice: string;
  setMonthlyPrice: (
    value: string
  ) => void;

  yearlyPrice: string;
  setYearlyPrice: (
    value: string
  ) => void;

  currency: string;
  setCurrency: (
    value: string
  ) => void;
}) {
  const monthly =
    Number(
      monthlyPrice
    );

  const yearly =
    Number(
      yearlyPrice
    );

  const annualMonthlyEquivalent =
    Number.isFinite(
      monthly
    ) &&
    monthly > 0
      ? monthly * 12
      : null;

  const savings =
    annualMonthlyEquivalent !==
      null &&
    Number.isFinite(
      yearly
    ) &&
    yearly >= 0
      ? annualMonthlyEquivalent -
        yearly
      : null;

  return (
    <EditorSection
      title="Pricing"
      description="Set the current catalog pricing for this plan."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label="Monthly price"
          hint="Leave empty for custom pricing."
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              $
            </span>

            <input
              type="number"
              min="0"
              step="0.01"
              value={
                monthlyPrice
              }
              onChange={(
                event
              ) =>
                setMonthlyPrice(
                  event.target
                    .value
                )
              }
              className={`${inputClass} pl-8`}
              placeholder="79"
            />
          </div>
        </Field>

        <Field
          label="Yearly price"
          hint="Leave empty for custom pricing."
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              $
            </span>

            <input
              type="number"
              min="0"
              step="0.01"
              value={
                yearlyPrice
              }
              onChange={(
                event
              ) =>
                setYearlyPrice(
                  event.target
                    .value
                )
              }
              className={`${inputClass} pl-8`}
              placeholder="790"
            />
          </div>
        </Field>

        <Field label="Currency">
          <select
            value={currency}
            onChange={(
              event
            ) =>
              setCurrency(
                event.target
                  .value
              )
            }
            className={
              inputClass
            }
          >
            <option value="USD">
              USD — US Dollar
            </option>

            <option value="AED">
              AED — UAE Dirham
            </option>

            <option value="EUR">
              EUR — Euro
            </option>

            <option value="GBP">
              GBP — British Pound
            </option>
          </select>
        </Field>
      </div>

      {savings !== null && (
        <div
          className={`rounded-xl border px-4 py-4 ${
            savings >= 0
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="text-xs font-semibold text-slate-800">
            Annual pricing comparison
          </div>

          <div className="mt-1 text-sm text-slate-600">
            {savings >= 0 ? (
              <>
                Annual customers save{" "}
                <strong>
                  {formatMoney(
                    savings,
                    currency
                  )}
                </strong>{" "}
                compared with twelve monthly payments.
              </>
            ) : (
              <>
                The yearly price is higher than twelve monthly
                payments by{" "}
                <strong>
                  {formatMoney(
                    Math.abs(
                      savings
                    ),
                    currency
                  )}
                </strong>
                .
              </>
            )}
          </div>
        </div>
      )}

      <InfoBox>
        Changing these fields changes the current plan catalog
        price. It does not rewrite the billing amount stored on
        existing customer subscriptions.
      </InfoBox>
    </EditorSection>
  );
}

/* ============================================================
   MODULE SECTION
============================================================ */

function ModulesSection({
  modules,
  selectedIds,
  onToggle,
}: {
  modules: Module[];
  selectedIds: string[];
  onToggle: (
    moduleId: string
  ) => void;
}) {
  const selectedCount =
    selectedIds.filter(
      (id) =>
        modules.some(
          (module) =>
            module.id === id
        )
    ).length;

  return (
    <EditorSection
      title="Module Access"
      description="Choose which currently-built SBS modules belong to this plan."
    >
      {/* SUMMARY */}

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Selected modules
          </div>

          <div className="mt-0.5 text-xs text-slate-500">
            {selectedCount} of{" "}
            {modules.length} built modules
          </div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
          <Layers3 className="h-4 w-4" />
        </div>
      </div>

      {/* GROUPS */}

      <div className="space-y-7">
        {MODULE_GROUPS.map(
          (group) => {
            const groupModules =
              group.slugs
                .map(
                  (slug) =>
                    modules.find(
                      (module) =>
                        module.slug ===
                        slug
                    )
                )
                .filter(
                  (
                    module
                  ): module is Module =>
                    Boolean(
                      module
                    )
                );

            if (
              groupModules.length ===
              0
            ) {
              return null;
            }

            return (
              <div
                key={
                  group.title
                }
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {group.title}
                    </h4>

                    <p className="mt-1 text-[10px] text-slate-400">
                      {groupModules.length}{" "}
                      {groupModules.length ===
                      1
                        ? "module"
                        : "modules"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {groupModules.map(
                    (module) => {
                      const selected =
                        selectedIds.includes(
                          module.id
                        );

                      return (
                        <button
                          key={
                            module.id
                          }
                          type="button"
                          onClick={() =>
                            onToggle(
                              module.id
                            )
                          }
                          className={`group rounded-xl border p-4 text-left transition active:scale-[0.99] ${
                            selected
                              ? "border-emerald-200 bg-emerald-50/60"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div
                                className={`text-sm font-semibold ${
                                  selected
                                    ? "text-emerald-900"
                                    : "text-slate-800"
                                }`}
                              >
                                {module.name}
                              </div>

                              <div className="mt-1 truncate font-mono text-[9px] text-slate-400">
                                {module.slug}
                              </div>
                            </div>

                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                selected
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-slate-300 bg-white text-transparent"
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      <InfoBox>
        This list contains only the modules currently built and
        exposed by SBS. Dashboard and Settings are application
        infrastructure and are not treated as paid modules.
      </InfoBox>
    </EditorSection>
  );
}

/* ============================================================
   LIMIT SECTION
============================================================ */

function LimitsSection({
  limits,
  onUpdate,
  onAdd,
  onRemove,
}: {
  limits: LimitDraft[];

  onUpdate: (
    index: number,
    patch: Partial<LimitDraft>
  ) => void;

  onAdd: () => void;

  onRemove: (
    index: number
  ) => void;
}) {
  return (
    <EditorSection
      title="Resource Limits"
      description="Define usage quotas for companies subscribed to this plan."
      action={
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Limit
        </button>
      }
    >
      <div className="space-y-3">
        {limits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
            <CircleHelp className="mx-auto h-5 w-5 text-slate-400" />

            <p className="mt-2 text-sm font-medium text-slate-700">
              No limits configured
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Add a resource limit to control usage.
            </p>
          </div>
        ) : (
          limits.map(
            (
              limit,
              index
            ) => (
              <div
                key={`${limit.limitKey}-${index}`}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                  <Field label="Limit">
                    <select
                      value={
                        limit.limitKey
                      }
                      onChange={(
                        event
                      ) =>
                        onUpdate(
                          index,
                          {
                            limitKey:
                              event
                                .target
                                .value,
                          }
                        )
                      }
                      className={
                        inputClass
                      }
                    >
                      <option value="">
                        Select limit
                      </option>

                      {Object.entries(
                        LIMIT_LABELS
                      ).map(
                        ([
                          key,
                          label,
                        ]) => (
                          <option
                            key={
                              key
                            }
                            value={
                              key
                            }
                          >
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </Field>

                  <Field label="Value">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      disabled={
                        limit.isUnlimited
                      }
                      value={
                        limit.limitValue
                      }
                      onChange={(
                        event
                      ) =>
                        onUpdate(
                          index,
                          {
                            limitValue:
                              event
                                .target
                                .value,
                          }
                        )
                      }
                      className={`${inputClass} ${
                        limit.isUnlimited
                          ? "bg-slate-100 text-slate-400"
                          : ""
                      }`}
                      placeholder="100"
                    />
                  </Field>

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate(
                          index,
                          {
                            isUnlimited:
                              !limit.isUnlimited,
                          }
                        )
                      }
                      className={`h-10 rounded-lg border px-3 text-xs font-semibold transition ${
                        limit.isUnlimited
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {limit.isUnlimited
                        ? "Unlimited"
                        : "Limited"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onRemove(
                          index
                        )
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {limit.limitKey && (
                  <div className="mt-3 text-[11px] leading-5 text-slate-400">
                    {LIMIT_DESCRIPTIONS[
                      limit.limitKey
                    ] ??
                      "Platform resource limit."}
                  </div>
                )}
              </div>
            )
          )
        )}
      </div>

      <InfoBox>
        <strong>Unlimited</strong> is stored as an unlimited
        entitlement rather than as an arbitrary large number.
      </InfoBox>
    </EditorSection>
  );
}

/* ============================================================
   PAYPAL SECTION
============================================================ */

function PayPalSection({
  paypalProductId,
  setPaypalProductId,
  paypalMonthlyPlanId,
  setPaypalMonthlyPlanId,
  paypalYearlyPlanId,
  setPaypalYearlyPlanId,
}: {
  paypalProductId: string;

  setPaypalProductId: (
    value: string
  ) => void;

  paypalMonthlyPlanId: string;

  setPaypalMonthlyPlanId: (
    value: string
  ) => void;

  paypalYearlyPlanId: string;

  setPaypalYearlyPlanId: (
    value: string
  ) => void;
}) {
  return (
    <EditorSection
      title="PayPal Configuration"
      description="Store the PayPal identifiers associated with this plan."
    >
      <Field
        label="PayPal Product ID"
        hint="Example: PROD-XXXXXXXXXXXX"
      >
        <input
          value={
            paypalProductId
          }
          onChange={(event) =>
            setPaypalProductId(
              event.target
                .value
            )
          }
          className={`${inputClass} font-mono`}
          placeholder="PROD-..."
        />
      </Field>

      <Field
        label="PayPal Monthly Plan ID"
        hint="Subscription plan identifier for monthly billing."
      >
        <input
          value={
            paypalMonthlyPlanId
          }
          onChange={(event) =>
            setPaypalMonthlyPlanId(
              event.target
                .value
            )
          }
          className={`${inputClass} font-mono`}
          placeholder="P-..."
        />
      </Field>

      <Field
        label="PayPal Yearly Plan ID"
        hint="Subscription plan identifier for annual billing."
      >
        <input
          value={
            paypalYearlyPlanId
          }
          onChange={(event) =>
            setPaypalYearlyPlanId(
              event.target
                .value
            )
          }
          className={`${inputClass} font-mono`}
          placeholder="P-..."
        />
      </Field>

      <InfoBox>
        These values store provider identifiers only. This
        screen does not create or modify PayPal products or
        charge customers.
      </InfoBox>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <ExternalLink className="h-3.5 w-3.5" />

        PayPal billing operations remain separate from the SBS
        plan catalog.
      </div>
    </EditorSection>
  );
}

/* ============================================================
   SHARED EDITOR SECTION
============================================================ */

function EditorSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {title}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        </div>

        {action}
      </div>

      <div className="space-y-5">
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   FIELD
============================================================ */

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-700">
          {label}
        </span>

        {required && (
          <span className="text-emerald-600">
            *
          </span>
        )}
      </div>

      {children}

      {hint && (
        <div className="mt-1.5 text-[10px] leading-4 text-slate-400">
          {hint}
        </div>
      )}
    </label>
  );
}

/* ============================================================
   TOGGLE CARD
============================================================ */

function ToggleCard({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;

  onChange: (
    value: boolean
  ) => void;

  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(
          !checked
        )
      }
      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
        checked
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
          checked
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 bg-white"
        }`}
      >
        {checked && (
          <Check className="h-3.5 w-3.5" />
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
    </button>
  );
}

/* ============================================================
   INFO BOX
============================================================ */

function InfoBox({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
      {children}
    </div>
  );
}

/* ============================================================
   MINI VALUE
============================================================ */

function MiniValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-slate-800">
        {value}
      </div>
    </div>
  );
}

/* ============================================================
   STATUS
============================================================ */

function StatusPill({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active
            ? "bg-emerald-500"
            : "bg-slate-400"
        }`}
      />

      {active
        ? "Active"
        : "Inactive"}
    </span>
  );
}

/* ============================================================
   CURRENCY
============================================================ */

function formatMoney(
  amount: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    ).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(
      2
    )}`;
  }
}

/* ============================================================
   PLAN PRICE
============================================================ */

function formatPlanPrice(
  amount: number | null,
  currency: string | null
) {
  if (amount === null) {
    return "Custom";
  }

  return formatMoney(
    amount,
    currency ?? "USD"
  );
}