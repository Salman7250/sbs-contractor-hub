import { requirePlatformAdmin } from "@/lib/auth/platform-admin";

const modules = [
  {
    name: "CRM",
    slug: "crm",
    category: "Sales",
    description:
      "Manage leads, contacts, customer relationships, and sales activity.",
    icon: "◎",
    status: "active",
    plans: "Professional+",
  },
  {
    name: "Leads",
    slug: "leads",
    category: "Sales",
    description:
      "Capture, organize, qualify, and manage business leads.",
    icon: "◇",
    status: "active",
    plans: "Starter+",
  },
  {
    name: "Customers",
    slug: "customers",
    category: "Sales",
    description:
      "Maintain customer records, contact information, and history.",
    icon: "♙",
    status: "active",
    plans: "Starter+",
  },
  {
    name: "Jobs",
    slug: "jobs",
    category: "Operations",
    description:
      "Track jobs, assignments, scheduling, progress, and completion.",
    icon: "▣",
    status: "active",
    plans: "Professional+",
  },
  {
    name: "Estimates",
    slug: "estimates",
    category: "Finance",
    description:
      "Create and manage estimates and convert approved estimates into jobs.",
    icon: "≡",
    status: "active",
    plans: "Starter+",
  },
  {
    name: "Invoices",
    slug: "invoices",
    category: "Finance",
    description:
      "Create invoices, track balances, and manage customer billing.",
    icon: "$",
    status: "active",
    plans: "Starter+",
  },
  {
    name: "Inventory",
    slug: "inventory",
    category: "Operations",
    description:
      "Manage products, stock levels, suppliers, and inventory movements.",
    icon: "◫",
    status: "planned",
    plans: "Business+",
  },
  {
    name: "Employees",
    slug: "employees",
    category: "People",
    description:
      "Manage employees, roles, assignments, and workforce information.",
    icon: "♟",
    status: "planned",
    plans: "Business+",
  },
  {
    name: "Reports",
    slug: "reports",
    category: "Analytics",
    description:
      "Analyze business performance through reports and operational metrics.",
    icon: "▥",
    status: "planned",
    plans: "Professional+",
  },
  {
    name: "Payments",
    slug: "payments",
    category: "Finance",
    description:
      "Track customer payments, transactions, balances, and payment status.",
    icon: "$",
    status: "planned",
    plans: "Professional+",
  },
  {
    name: "Documents",
    slug: "documents",
    category: "Productivity",
    description:
      "Store and organize business documents and customer files.",
    icon: "□",
    status: "planned",
    plans: "Business+",
  },
  {
    name: "Settings",
    slug: "settings",
    category: "System",
    description:
      "Configure company preferences, users, permissions, and system options.",
    icon: "⚙",
    status: "active",
    plans: "All plans",
  },
];

export default async function AdminModulesPage() {
  await requirePlatformAdmin();

  const activeModules = modules.filter(
    (module) => module.status === "active"
  ).length;

  const plannedModules = modules.filter(
    (module) => module.status === "planned"
  ).length;

  const categories = new Set(
    modules.map((module) => module.category)
  ).size;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Platform Management
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Modules
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Manage the business capabilities available across
            the SBS platform and control which plans can access
            them.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 opacity-50"
        >
          + Create Module
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ModuleStat
          label="Total Modules"
          value={modules.length}
          icon="◈"
        />

        <ModuleStat
          label="Active Modules"
          value={activeModules}
          icon="✓"
        />

        <ModuleStat
          label="Planned Modules"
          value={plannedModules}
          icon="◷"
          warning
        />

        <ModuleStat
          label="Categories"
          value={categories}
          icon="▦"
        />
      </div>

      {/* Module Catalog */}
      <section>
        <div className="mb-5">
          <h2 className="font-semibold text-white">
            Module Catalog
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Business functionality available to SBS customers.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <ModuleCard
              key={module.slug}
              module={module}
            />
          ))}
        </div>
      </section>

      {/* Configuration Table */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-white">
              Module Configuration
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Overview of module availability and plan access.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-xs text-slate-500">
            {modules.length} modules
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Module
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Category
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Access
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>

                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {modules.map((module) => (
                <tr
                  key={module.slug}
                  className="transition hover:bg-white/[0.025]"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white">
                        {module.icon}
                      </div>

                      <div>
                        <div className="font-medium text-white">
                          {module.name}
                        </div>

                        <div className="mt-1 font-mono text-[10px] text-slate-600">
                          {module.slug}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <span className="text-sm text-slate-300">
                      {module.category}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <span className="text-sm text-slate-400">
                      {module.plans}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <ModuleStatus
                      status={module.status}
                    />
                  </td>

                  <td className="px-6 py-5 text-right">
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-600"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Entitlement Architecture */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ArchitectureCard
          icon="◈"
          title="Module Registry"
          description="Every SBS feature will eventually have a unique module definition that can be enabled or disabled."
        />

        <ArchitectureCard
          icon="$"
          title="Plan Access"
          description="Plans will determine which modules are included in a customer's subscription."
        />

        <ArchitectureCard
          icon="✓"
          title="Entitlements"
          description="Individual company access can later be overridden independently of the customer's plan."
        />
      </section>

      {/* Platform Notice */}
      <section className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-5">
        <div className="flex gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-sm text-blue-400">
            i
          </div>

          <div>
            <h3 className="text-sm font-semibold text-blue-300">
              Module access architecture
            </h3>

            <p className="mt-1 text-xs leading-5 text-blue-400/60">
              The module catalog shown here is currently part of
              the platform UI. Database-backed module definitions,
              plan assignments, company overrides, and entitlement
              enforcement will be wired into the platform later.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ModuleCard({
  module,
}: {
  module: (typeof modules)[number];
}) {
  const isActive = module.status === "active";

  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white">
          {module.icon}
        </div>

        <ModuleStatus status={module.status} />
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white">
            {module.name}
          </h3>

          {isActive && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          )}
        </div>

        <div className="mt-1 text-[10px] font-mono text-slate-600">
          {module.slug}
        </div>

        <p className="mt-3 min-h-[60px] text-xs leading-5 text-slate-500">
          {module.description}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-600">
            Available on
          </div>

          <div className="mt-1 text-xs font-medium text-slate-400">
            {module.plans}
          </div>
        </div>

        <button
          type="button"
          disabled
          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-600"
        >
          Configure
        </button>
      </div>
    </div>
  );
}

function ModuleStat({
  label,
  value,
  icon,
  warning = false,
}: {
  label: string;
  value: number;
  icon: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm text-slate-200">
          {icon}
        </div>

        <span
          className={`h-2 w-2 rounded-full ${
            warning
              ? "bg-amber-400"
              : "bg-emerald-400"
          }`}
        />
      </div>

      <div className="mt-5">
        <div className="text-3xl font-bold tracking-tight text-white">
          {value.toLocaleString()}
        </div>

        <div className="mt-1 text-sm text-slate-500">
          {label}
        </div>
      </div>
    </div>
  );
}

function ModuleStatus({
  status,
}: {
  status: string;
}) {
  const active = status === "active";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${
        active
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-amber-500/10 text-amber-400"
      }`}
    >
      {status}
    </span>
  );
}

function ArchitectureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm text-slate-300">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-white">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}