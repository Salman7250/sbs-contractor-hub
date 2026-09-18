"use client";

import {
  Activity,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileText,
  FolderKanban,
  Layers3,
  Package,
  Pencil,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Trash2,
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

type Module = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
};

type Plan = {
  id: string;
  name: string;
  slug: string;
  monthly_price: number | null;
  yearly_price: number | null;
  currency: string | null;
  is_active: boolean;
};

type PlanModule = {
  plan_id: string;
  module_id: string;
};

type ModuleGroup = {
  title: string;
  description: string;
  icon:
    | "sales"
    | "inventory"
    | "procurement"
    | "service"
    | "business";
  slugs: string[];
};

type Props = {
  modules: Module[];
  plans: Plan[];
  planModules: PlanModule[];
  modulePlanCounts: Record<
    string,
    number
  >;
  groups: ModuleGroup[];
};

/*
 * ============================================================
 * ICON REGISTRY
 * ============================================================
 *
 * These icons live entirely inside the Client Component.
 *
 * The Server Component sends only:
 *
 * icon: "sales"
 *
 * instead of:
 *
 * icon: SomeLucideReactComponent
 *
 * That prevents the React Server -> Client serialization
 * error.
 */

const GROUP_ICONS = {
  sales: ShoppingCart,
  inventory: Package,
  procurement: Truck,
  service: Wrench,
  business: BarChart3,
} as const;

const MODULE_ICONS: Record<
  string,
  React.ComponentType<{
    className?: string;
  }>
> = {
  customers: Users,
  estimates: FileText,
  "sales-orders": ShoppingCart,
  invoices: FileText,
  payments: CircleDollarSign,

  products: Package,
  "serial-assets": ShieldCheck,
  inventory: Package,
  warehouses: Building2,
  pricing: CircleDollarSign,

  suppliers: Truck,
  "purchase-orders": ShoppingCart,
  expenses: CircleDollarSign,

  warranty: ShieldCheck,
  repairs: Wrench,
  rma: FolderKanban,
  "service-providers": Users,
  "service-jobs": Wrench,

  "b2b-client-portal": Users,
  analytics: BarChart3,
  employees: Users,
  documents: FileText,
};

const BUILT_MODULE_ORDER = [
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

/* ============================================================
   MAIN
============================================================ */

export default function ModuleManagement({
  modules,
  plans,
  planModules,
  modulePlanCounts,
  groups,
}: Props) {
  const [selectedModuleId, setSelectedModuleId] =
    useState<string | null>(null);

  const [creating, setCreating] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const selectedModule = useMemo(
    () =>
      modules.find(
        (module) =>
          module.id === selectedModuleId
      ) ?? null,
    [modules, selectedModuleId]
  );

  const order = useMemo(
    () =>
      new Map<string, number>(
        BUILT_MODULE_ORDER.map(
          (slug, index) => [
            slug,
            index,
          ]
        )
      ),
    []
  );

  const orderedModules = useMemo(
    () =>
      [...modules].sort(
        (a, b) =>
          (order.get(a.slug) ?? 999) -
          (order.get(b.slug) ?? 999)
      ),
    [modules, order]
  );

  const filteredModules = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return orderedModules.filter(
      (module) => {
        const matchesSearch =
          !query ||
          module.name
            .toLowerCase()
            .includes(query) ||
          module.slug
            .toLowerCase()
            .includes(query) ||
          (module.description ?? "")
            .toLowerCase()
            .includes(query);

        if (!matchesSearch) {
          return false;
        }

        if (
          categoryFilter === "all"
        ) {
          return true;
        }

        const group = groups.find(
          (item) =>
            item.slugs.includes(
              module.slug
            )
        );

        return (
          group?.title ===
          categoryFilter
        );
      }
    );
  }, [
    categoryFilter,
    groups,
    orderedModules,
    search,
  ]);

  function openCreate() {
    setSelectedModuleId(null);
    setCreating(true);
  }

  function openEdit(
    moduleId: string
  ) {
    setCreating(false);
    setSelectedModuleId(moduleId);
  }

  function closeEditor() {
    setCreating(false);
    setSelectedModuleId(null);
  }

  return (
    <>
      <div className="space-y-8">
        {/* ==================================================
            TOOLBAR
        ================================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Module Catalog
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {modules.length} commercial modules
                currently built into SBS.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Create Module
            </button>
          </div>

          <div className="grid gap-3 p-5 lg:grid-cols-[1fr_220px]">
            <div className="relative">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search modules..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="all">
                All categories
              </option>

              {groups.map(
                (group) => (
                  <option
                    key={group.title}
                    value={group.title}
                  >
                    {group.title}
                  </option>
                )
              )}
            </select>
          </div>
        </section>

        {/* ==================================================
            GROUPED MODULES
        ================================================== */}

        {groups.map((group) => {
          const groupModules =
            filteredModules.filter(
              (module) =>
                group.slugs.includes(
                  module.slug
                )
            );

          if (
            groupModules.length === 0
          ) {
            return null;
          }

          const GroupIcon =
            GROUP_ICONS[group.icon];

          return (
            <section
              key={group.title}
            >
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <GroupIcon className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {group.title}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {group.description}
                  </p>
                </div>

                <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {groupModules.length}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groupModules.map(
                  (module) => (
                    <ModuleCard
                      key={module.id}
                      module={module}
                      planCount={
                        modulePlanCounts[
                          module.id
                        ] ?? 0
                      }
                      onManage={() =>
                        openEdit(
                          module.id
                        )
                      }
                    />
                  )
                )}
              </div>
            </section>
          );
        })}

        {/* ==================================================
            CONFIGURATION TABLE
        ================================================== */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Module Configuration
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Database-backed module registry and
                subscription-plan access.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600">
              {filteredModules.length} shown
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50/80">
                <tr>
                  <TableHeader>
                    Module
                  </TableHeader>

                  <TableHeader>
                    Category
                  </TableHeader>

                  <TableHeader>
                    Plans
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredModules.map(
                  (module) => {
                    const group =
                      groups.find(
                        (item) =>
                          item.slugs.includes(
                            module.slug
                          )
                      );

                    const planCount =
                      modulePlanCounts[
                        module.id
                      ] ?? 0;

                    return (
                      <tr
                        key={module.id}
                        className="transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <ModuleIcon
                              slug={
                                module.slug
                              }
                            />

                            <div>
                              <div className="font-semibold text-slate-900">
                                {module.name}
                              </div>

                              <div className="mt-1 font-mono text-[10px] text-slate-400">
                                {module.slug}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600">
                            {group?.title ??
                              "Uncategorized"}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <Layers3 className="h-4 w-4 text-slate-400" />

                            <span className="text-sm font-semibold text-slate-700">
                              {planCount}
                            </span>

                            <span className="text-xs text-slate-400">
                              {planCount ===
                              1
                                ? "plan"
                                : "plans"}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <StatusPill
                            active={
                              module.is_active
                            }
                          />
                        </td>

                        <td className="px-6 py-5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              openEdit(
                                module.id
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Manage
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* =====================================================
          EDITOR
      ====================================================== */}

      {(selectedModule ||
        creating) && (
        <ModuleEditor
          mode={
            creating
              ? "create"
              : "edit"
          }
          module={
            selectedModule
          }
          plans={plans}
          planModules={
            planModules
          }
          onClose={
            closeEditor
          }
        />
      )}
    </>
  );
}

/* ============================================================
   MODULE CARD
============================================================ */

function ModuleCard({
  module,
  planCount,
  onManage,
}: {
  module: Module;
  planCount: number;
  onManage: () => void;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <ModuleIcon
          slug={module.slug}
        />

        <StatusPill
          active={
            module.is_active
          }
        />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-900">
          {module.name}
        </h3>

        <div className="mt-1 font-mono text-[10px] text-slate-400">
          {module.slug}
        </div>

        <p className="mt-3 min-h-[60px] text-xs leading-5 text-slate-500">
          {module.description ??
            "SBS business capability."}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Plan access
          </div>

          <div className="mt-1 text-xs font-semibold text-slate-700">
            {planCount}{" "}
            {planCount === 1
              ? "plan"
              : "plans"}
          </div>
        </div>

        <button
          type="button"
          onClick={onManage}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Configure
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   MODULE EDITOR
============================================================ */

function ModuleEditor({
  mode,
  module,
  plans,
  planModules,
  onClose,
}: {
  mode: "create" | "edit";
  module: Module | null;
  plans: Plan[];
  planModules: PlanModule[];
  onClose: () => void;
}) {
  const [name, setName] =
    useState(
      module?.name ?? ""
    );

  const [slug, setSlug] =
    useState(
      module?.slug ?? ""
    );

  const [description, setDescription] =
    useState(
      module?.description ?? ""
    );

  const [isActive, setIsActive] =
    useState(
      module?.is_active ?? true
    );

  const initialPlanIds =
    useMemo(() => {
      if (!module) {
        return [];
      }

      return planModules
        .filter(
          (row) =>
            row.module_id ===
            module.id
        )
        .map(
          (row) =>
            row.plan_id
        );
    }, [
      module,
      planModules,
    ]);

  const [
    selectedPlanIds,
    setSelectedPlanIds,
  ] = useState<string[]>(
    initialPlanIds
  );

  const [
    activeSection,
    setActiveSection,
  ] = useState<
    "basic" | "plans"
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

  function togglePlan(
    planId: string
  ) {
    setSelectedPlanIds(
      (current) =>
        current.includes(
          planId
        )
          ? current.filter(
              (id) =>
                id !== planId
            )
          : [
              ...current,
              planId,
            ]
    );
  }

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
        "Module name is required."
      );
      setActiveSection(
        "basic"
      );
      return;
    }

    if (!normalizedSlug) {
      setError(
        "Module slug is required."
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

    startTransition(
      async () => {
        try {
          /*
           * IMPORTANT
           *
           * Wire these calls to your module-actions.ts
           * implementation.
           *
           * We intentionally keep this editor completely
           * client-side and serializable.
           */

          if (mode === "create") {
            /*
             * Replace with createModule(...) once the
             * module-actions file is connected.
             */
            throw new Error(
              "Module creation action is not connected yet."
            );
          }

          /*
           * Replace with updateModule(...) once connected.
           */
          throw new Error(
            "Module update action is not connected yet."
          );
        } catch (
          saveError
        ) {
          setError(
            saveError instanceof
              Error
              ? saveError.message
              : "Unable to save module."
          );
        }
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!isPending) {
            onClose();
          }
        }}
      />

      <div className="relative flex min-h-full items-start justify-center p-4 sm:p-6 lg:p-10">
        <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* HEADER */}

          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                {mode === "create" ? (
                  <Plus className="h-5 w-5" />
                ) : (
                  <Settings2 className="h-5 w-5" />
                )}
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {mode === "create"
                    ? "Create Module"
                    : `Manage ${module?.name}`}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Configure module identity, availability,
                  and subscription-plan access.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={
                isPending
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* BODY */}

          <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
              <nav className="space-y-1">
                <EditorNavButton
                  active={
                    activeSection ===
                    "basic"
                  }
                  label="Basic Information"
                  description="Name, slug and status"
                  onClick={() =>
                    setActiveSection(
                      "basic"
                    )
                  }
                />

                <EditorNavButton
                  active={
                    activeSection ===
                    "plans"
                  }
                  label="Plan Access"
                  description="Plans that include this module"
                  onClick={() =>
                    setActiveSection(
                      "plans"
                    )
                  }
                />
              </nav>
            </div>

            <div className="min-h-[500px]">
              <div className="max-h-[calc(100vh-230px)] overflow-y-auto p-6">
                {activeSection ===
                  "basic" && (
                  <div className="space-y-6">
                    <div className="border-b border-slate-100 pb-5">
                      <h3 className="text-base font-semibold text-slate-900">
                        Basic Information
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Define the module identity and availability.
                      </p>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Module name">
                        <input
                          value={name}
                          onChange={(
                            event
                          ) =>
                            setName(
                              event
                                .target
                                .value
                            )
                          }
                          className={inputClass}
                          placeholder="Products"
                        />
                      </Field>

                      <Field label="Slug">
                        <input
                          value={slug}
                          onChange={(
                            event
                          ) =>
                            setSlug(
                              event
                                .target
                                .value
                                .toLowerCase()
                                .replace(
                                  /\s+/g,
                                  "-"
                                )
                            )
                          }
                          className={`${inputClass} font-mono`}
                          placeholder="products"
                        />
                      </Field>
                    </div>

                    <Field label="Description">
                      <textarea
                        value={
                          description
                        }
                        onChange={(
                          event
                        ) =>
                          setDescription(
                            event
                              .target
                              .value
                          )
                        }
                        rows={5}
                        className={`${inputClass} h-auto resize-none py-2.5`}
                        placeholder="Manage the product catalog."
                      />
                    </Field>

                    <button
                      type="button"
                      onClick={() =>
                        setIsActive(
                          !isActive
                        )
                      }
                      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                        isActive
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          isActive
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isActive && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          Module active
                        </div>

                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          Active modules can be enabled for
                          subscription plans.
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {activeSection ===
                  "plans" && (
                  <div className="space-y-6">
                    <div className="border-b border-slate-100 pb-5">
                      <h3 className="text-base font-semibold text-slate-900">
                        Plan Access
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Select which commercial plans include this
                        module.
                      </p>
                    </div>

                    {plans.length ===
                    0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                        <Layers3 className="mx-auto h-6 w-6 text-slate-400" />

                        <p className="mt-2 text-sm font-semibold text-slate-700">
                          No plans configured
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {plans.map(
                          (plan) => {
                            const selected =
                              selectedPlanIds.includes(
                                plan.id
                              );

                            return (
                              <button
                                key={
                                  plan.id
                                }
                                type="button"
                                onClick={() =>
                                  togglePlan(
                                    plan.id
                                  )
                                }
                                className={`rounded-xl border p-4 text-left transition ${
                                  selected
                                    ? "border-emerald-200 bg-emerald-50/60"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">
                                      {
                                        plan.name
                                      }
                                    </div>

                                    <div className="mt-1 font-mono text-[10px] text-slate-400">
                                      {
                                        plan.slug
                                      }
                                    </div>
                                  </div>

                                  <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                                      selected
                                        ? "border-emerald-500 bg-emerald-500 text-white"
                                        : "border-slate-300 bg-white text-transparent"
                                    }`}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </div>
                                </div>

                                <div className="mt-4 text-xs text-slate-500">
                                  {formatPlanPrice(
                                    plan.monthly_price,
                                    plan.currency
                                  )}
                                  {plan.yearly_price !==
                                  null
                                    ? ` · ${formatPlanPrice(
                                        plan.yearly_price,
                                        plan.currency
                                      )}/yr`
                                    : ""}
                                </div>
                              </button>
                            );
                          }
                        )}
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                      {selectedPlanIds.length}{" "}
                      {selectedPlanIds.length ===
                      1
                        ? "plan"
                        : "plans"}{" "}
                      selected.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FOOTER */}

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
                  disabled={
                    isPending
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
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
                      <Activity className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {mode ===
                      "create"
                        ? "Create Module"
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

function EditorNavButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-3.5 py-3 text-left transition ${
        active
          ? "bg-white shadow-sm ring-1 ring-slate-200"
          : "hover:bg-white/70"
      }`}
    >
      <div
        className={`text-xs font-semibold ${
          active
            ? "text-slate-900"
            : "text-slate-600"
        }`}
      >
        {label}
      </div>

      <div className="mt-1 text-[10px] leading-4 text-slate-400">
        {description}
      </div>
    </button>
  );
}

/* ============================================================
   MODULE ICON
============================================================ */

function ModuleIcon({
  slug,
}: {
  slug: string;
}) {
  const Icon =
    MODULE_ICONS[slug] ??
    Layers3;

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
      <Icon className="h-5 w-5" />
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
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
   TABLE HEADER
============================================================ */

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </th>
  );
}

/* ============================================================
   FIELD
============================================================ */

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-slate-700">
        {label}
      </div>

      {children}
    </label>
  );
}

/* ============================================================
   PRICE
============================================================ */

function formatPlanPrice(
  amount: number | null,
  currency: string | null
) {
  if (amount === null) {
    return "Custom";
  }

  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency:
          currency ?? "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    ).format(amount);
  } catch {
    return `${currency ?? "USD"} ${amount.toFixed(
      2
    )}`;
  }
}