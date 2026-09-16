import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type RecentCompany = {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
  status: string | null;
  created_at: string;
};

type SubscriptionWithPlan = {
  id: string;
  company_id: string;
  status: string | null;
  amount: number | null;
  currency: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  plans:
    | {
        name: string;
        slug: string;
      }
    | {
        name: string;
        slug: string;
      }[]
    | null;
};

export default async function SBSAdminDashboard() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const [
    companiesResult,
    usersResult,
    activeCompaniesResult,
    recentCompaniesResult,
    subscriptionsResult,
    modulesResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true }),

    supabase
      .from("company_members")
      .select("id", { count: "exact", head: true }),

    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),

    supabase
      .from("companies")
      .select(
        `
          id,
          name,
          slug,
          email,
          status,
          created_at
        `
      )
      .order("created_at", { ascending: false })
      .limit(8),

    supabase
      .from("subscriptions")
      .select(
        `
          id,
          company_id,
          status,
          amount,
          currency,
          trial_ends_at,
          current_period_end,
          plans (
            name,
            slug
          )
        `
      )
      .order("created_at", { ascending: false }),

    supabase
      .from("modules")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  const totalCompanies = companiesResult.count ?? 0;
  const totalUsers = usersResult.count ?? 0;
  const activeCompanies = activeCompaniesResult.count ?? 0;
  const activeModules = modulesResult.count ?? 0;

  const recentCompanies =
    (recentCompaniesResult.data as RecentCompany[] | null) ?? [];

  const subscriptions =
    (subscriptionsResult.data as SubscriptionWithPlan[] | null) ?? [];

  const trialingSubscriptions = subscriptions.filter(
    (subscription) =>
      subscription.status?.toLowerCase() === "trialing"
  );

  const activeSubscriptions = subscriptions.filter((subscription) => {
    const status = subscription.status?.toLowerCase();

    return status === "active" || status === "trialing";
  });

  const mrr = subscriptions
    .filter(
      (subscription) =>
        subscription.status?.toLowerCase() === "active"
    )
    .reduce(
      (total, subscription) =>
        total + Number(subscription.amount ?? 0),
      0
    );

  const expiringTrials = trialingSubscriptions.filter(
    (subscription) => {
      if (!subscription.trial_ends_at) return false;

      const trialEnd = new Date(subscription.trial_ends_at);
      const now = new Date();

      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(
        sevenDaysFromNow.getDate() + 7
      );

      return trialEnd >= now && trialEnd <= sevenDaysFromNow;
    }
  );

  const planDistribution = subscriptions.reduce<
    Record<string, number>
  >((result, subscription) => {
    const plan = getPlan(subscription);

    if (!plan) return result;

    result[plan.slug] =
      (result[plan.slug] ?? 0) + 1;

    return result;
  }, {});

  const totalPlanSubscriptions = Object.values(
    planDistribution
  ).reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-9">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Platform Overview
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Good morning, Admin.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Monitor companies, subscriptions, plans,
              platform access, and the health of your SBS
              SaaS environment from one place.
            </p>
          </div>

          <Link
            href="/sbs-admin/companies"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Manage Companies →
          </Link>
        </div>
      </section>

      {/* Primary Stats */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Platform Overview
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Live figures from your SBS platform.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Companies"
            value={totalCompanies}
            icon="▣"
            href="/sbs-admin/companies"
            accent
          />

          <StatCard
            label="Active Companies"
            value={activeCompanies}
            icon="✓"
            href="/sbs-admin/companies"
          />

          <StatCard
            label="Trialing Companies"
            value={trialingSubscriptions.length}
            icon="◷"
            href="/sbs-admin/subscriptions"
          />

          <StatCard
            label="Company Users"
            value={totalUsers}
            icon="♙"
            href="/sbs-admin/users"
          />
        </div>
      </section>

      {/* Secondary Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="MRR"
          value={formatCurrency(mrr)}
          detail="Active subscriptions"
          icon="$"
        />

        <MetricCard
          label="Active Subscriptions"
          value={activeSubscriptions.length}
          detail="Paid + trialing"
          icon="◫"
        />

        <MetricCard
          label="Expiring Trials"
          value={expiringTrials.length}
          detail="Next 7 days"
          icon="!"
          warning={expiringTrials.length > 0}
        />

        <MetricCard
          label="Active Modules"
          value={activeModules}
          detail="Available platform modules"
          icon="◈"
        />
      </section>

      {/* Main Content */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        {/* Recent Companies */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Recent Companies
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Latest customer companies on the platform.
              </p>
            </div>

            <Link
              href="/sbs-admin/companies"
              className="rounded-lg px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
            >
              View all →
            </Link>
          </div>

          {recentCompanies.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recentCompanies.map((company) => (
                <Link
                  key={company.id}
                  href={`/sbs-admin/companies/${company.id}`}
                  className="flex flex-col gap-4 px-5 py-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <CompanyAvatar name={company.name} />

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {company.name}
                      </div>

                      <div className="mt-1 truncate text-xs text-slate-500">
                        {company.email ||
                          company.slug ||
                          "No contact information"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <StatusBadge status={company.status} />

                    <div className="hidden text-right sm:block">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">
                        Created
                      </div>

                      <div className="mt-1 text-xs text-slate-600">
                        {formatDate(company.created_at)}
                      </div>
                    </div>

                    <span className="text-xs text-slate-400">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No companies yet"
              description="Your first customer company will appear here."
              href="/sbs-admin/companies"
              action="Create Company"
            />
          )}
        </section>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Plan Distribution */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Plan Distribution
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Current subscription mix.
              </p>
            </div>

            <div className="space-y-4 p-5">
              <PlanRow
                name="Starter"
                slug="starter"
                count={planDistribution.starter ?? 0}
                total={totalPlanSubscriptions}
              />

              <PlanRow
                name="Professional"
                slug="professional"
                count={planDistribution.professional ?? 0}
                total={totalPlanSubscriptions}
              />

              <PlanRow
                name="Business"
                slug="business"
                count={planDistribution.business ?? 0}
                total={totalPlanSubscriptions}
              />

              {Object.entries(planDistribution)
                .filter(
                  ([slug]) =>
                    ![
                      "starter",
                      "professional",
                      "business",
                    ].includes(slug)
                )
                .map(([slug, count]) => (
                  <PlanRow
                    key={slug}
                    name={formatPlanName(slug)}
                    slug={slug}
                    count={count}
                    total={totalPlanSubscriptions}
                  />
                ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Quick Actions
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Common platform administration tasks.
              </p>
            </div>

            <div className="space-y-1 p-3">
              <QuickAction
                href="/sbs-admin/companies"
                icon="+"
                title="Create Company"
                description="Provision a new customer"
              />

              <QuickAction
                href="/sbs-admin/plans"
                icon="$"
                title="Manage Plans"
                description="Configure pricing and limits"
              />

              <QuickAction
                href="/sbs-admin/modules"
                icon="◈"
                title="Manage Modules"
                description="Control platform capabilities"
              />

              <QuickAction
                href="/sbs-admin/entitlements"
                icon="✓"
                title="Manage Access"
                description="Override company access"
              />
            </div>
          </section>
        </div>
      </div>

      {/* Platform Status */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Platform Status
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Core SBS platform services.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Operational
            </span>
          </div>
        </div>

        <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          <SystemStatus
            name="Authentication"
            status="Operational"
          />

          <SystemStatus
            name="Database"
            status="Operational"
          />

          <SystemStatus
            name="Tenant Isolation"
            status="Operational"
          />

          <SystemStatus
            name="Billing"
            status={
              subscriptions.length > 0
                ? "Connected"
                : "Not Configured"
            }
            warning={subscriptions.length === 0}
          />
        </div>
      </section>

      {/* Admin Notice */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Platform control center
            </div>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Plans, modules, subscriptions, company
              entitlements and resource limits are managed
              centrally through SBS Admin.
            </p>
          </div>

          <Link
            href="/sbs-admin/companies"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
          >
            Manage Companies →
          </Link>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Components                                                                  */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  icon,
  href,
  accent = false,
}: {
  label: string;
  value: number;
  icon: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        accent
          ? "border-emerald-200"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm ${
            accent
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {icon}
        </div>

        <span className="text-xs text-slate-300 transition group-hover:text-slate-500">
          →
        </span>
      </div>

      <div className="mt-5">
        <div className="text-3xl font-bold tracking-tight text-slate-900">
          {value.toLocaleString()}
        </div>

        <div className="mt-1 text-xs font-medium text-slate-500">
          {label}
        </div>
      </div>
    </Link>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  warning = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.15em] ${
            warning
              ? "text-amber-600"
              : "text-slate-400"
          }`}
        >
          {label}
        </span>

        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs ${
            warning
              ? "bg-amber-50 text-amber-600"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {icon}
        </span>
      </div>

      <div className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </div>

      <div className="mt-1 text-[11px] text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function CompanyAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700">
      {initials || "C"}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string | null;
}) {
  const normalized = status?.toLowerCase();

  let className =
    "bg-slate-100 text-slate-600";

  if (
    normalized === "active" ||
    normalized === "trialing"
  ) {
    className =
      "bg-emerald-50 text-emerald-700";
  } else if (normalized === "trial") {
    className =
      "bg-blue-50 text-blue-700";
  } else if (normalized === "suspended") {
    className =
      "bg-amber-50 text-amber-700";
  } else if (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "expired"
  ) {
    className =
      "bg-red-50 text-red-700";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${className}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function PlanRow({
  name,
  slug,
  count,
  total,
}: {
  name: string;
  slug: string;
  count: number;
  total: number;
}) {
  const percentage =
    total > 0
      ? Math.round((count / total) * 100)
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2 w-2 rounded-full ${
              slug === "starter"
                ? "bg-slate-400"
                : slug === "professional"
                  ? "bg-emerald-500"
                  : slug === "business"
                    ? "bg-blue-500"
                    : "bg-violet-500"
            }`}
          />

          <span className="text-xs font-medium text-slate-700">
            {name}
          </span>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          {count}
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            slug === "starter"
              ? "bg-slate-400"
              : slug === "professional"
                ? "bg-emerald-500"
                : slug === "business"
                  ? "bg-blue-500"
                  : "bg-violet-500"
          }`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500 transition group-hover:bg-emerald-50 group-hover:text-emerald-600">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-700">
          {title}
        </div>

        <div className="mt-0.5 truncate text-[10px] text-slate-500">
          {description}
        </div>
      </div>

      <span className="text-xs text-slate-300 transition group-hover:text-slate-500">
        →
      </span>
    </Link>
  );
}

function SystemStatus({
  name,
  status,
  warning = false,
}: {
  name: string;
  status: string;
  warning?: boolean;
}) {
  return (
    <div className="bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-600">
          {name}
        </span>

        <span
          className={`h-2 w-2 rounded-full ${
            warning
              ? "bg-amber-500"
              : "bg-emerald-500"
          }`}
        />
      </div>

      <div
        className={`mt-2 text-[10px] font-semibold uppercase tracking-wider ${
          warning
            ? "text-amber-600"
            : "text-emerald-600"
        }`}
      >
        {status}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        ▣
      </div>

      <div className="mt-4 text-sm font-semibold text-slate-700">
        {title}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>

      <Link
        href={href}
        className="mt-5 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
      >
        {action}
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function getPlan(
  subscription: SubscriptionWithPlan
) {
  if (!subscription.plans) {
    return null;
  }

  if (Array.isArray(subscription.plans)) {
    return subscription.plans[0] ?? null;
  }

  return subscription.plans;
}

function formatPlanName(slug: string) {
  return slug
    .split("-")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function formatStatus(status: string | null) {
  if (!status) {
    return "Unknown";
  }

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}