import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function SBSAdminDashboard() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const [
    companiesResult,
    usersResult,
    activeResult,
    trialResult,
    recentCompaniesResult,
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
      .select("id", { count: "exact", head: true })
      .eq("status", "trial"),

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
      .limit(5),
  ]);

  const totalCompanies = companiesResult.count ?? 0;
  const totalUsers = usersResult.count ?? 0;
  const activeCompanies = activeResult.count ?? 0;
  const trialCompanies = trialResult.count ?? 0;

  const recentCompanies =
    recentCompaniesResult.data ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Platform Dashboard
        </h1>

        <p className="mt-2 text-slate-400">
          Overview of your SBS platform, companies, users,
          subscriptions, and system activity.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Companies"
          value={totalCompanies}
          icon="◫"
          href="/sbs-admin/companies"
        />

        <StatCard
          label="Active Companies"
          value={activeCompanies}
          icon="✓"
          href="/sbs-admin/companies"
        />

        <StatCard
          label="Companies on Trial"
          value={trialCompanies}
          icon="◷"
          href="/sbs-admin/companies"
        />

        <StatCard
          label="Company Users"
          value={totalUsers}
          icon="♙"
          href="/sbs-admin/users"
        />
      </div>

      {/* Main grid */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Recent companies */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] xl:col-span-2">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <h2 className="font-semibold text-white">
                Recent Companies
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Latest companies provisioned on SBS.
              </p>
            </div>

            <Link
              href="/sbs-admin/companies"
              className="text-sm font-medium text-slate-400 transition hover:text-white"
            >
              View all →
            </Link>
          </div>

          {recentCompanies.length > 0 ? (
            <div className="divide-y divide-white/10">
              {recentCompanies.map((company) => (
                <div
                  key={company.id}
                  className="flex flex-col gap-4 px-6 py-5 transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white">
                      {company.name
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate font-medium text-white">
                        {company.name}
                      </div>

                      <div className="mt-1 truncate text-xs text-slate-500">
                        {company.email ||
                          company.slug ||
                          "No contact information"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <StatusBadge status={company.status} />

                    <div className="hidden text-right sm:block">
                      <div className="text-xs text-slate-500">
                        Created
                      </div>

                      <div className="mt-1 text-sm text-slate-300">
                        {new Date(
                          company.created_at
                        ).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center">
              <div className="text-sm font-medium text-slate-300">
                No companies yet
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Create your first customer company to get
                started.
              </p>

              <Link
                href="/sbs-admin/companies"
                className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Create Company
              </Link>
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="font-semibold text-white">
              Quick Actions
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Common platform administration tasks.
            </p>
          </div>

          <div className="space-y-2 p-4">
            <QuickAction
              href="/sbs-admin/companies"
              icon="+"
              title="Create Company"
              description="Provision a new customer tenant"
            />

            <QuickAction
              href="/sbs-admin/users"
              icon="♙"
              title="Manage Users"
              description="View platform and company users"
            />

            <QuickAction
              href="/sbs-admin/plans"
              icon="$"
              title="Manage Plans"
              description="Configure SaaS pricing plans"
            />

            <QuickAction
              href="/sbs-admin/modules"
              icon="◈"
              title="Manage Modules"
              description="Configure available platform modules"
            />

            <QuickAction
              href="/sbs-admin/settings"
              icon="⚙"
              title="Platform Settings"
              description="Manage global SBS settings"
            />
          </div>
        </section>
      </div>

      {/* Platform status */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-6 py-5">
          <h2 className="font-semibold text-white">
            Platform Status
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Current status of core SBS services.
          </p>
        </div>

        <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
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
            status="Not Configured"
            warning
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm text-slate-200">
          {icon}
        </div>

        <span className="text-xs text-slate-600 transition group-hover:text-slate-400">
          →
        </span>
      </div>

      <div className="mt-5">
        <div className="text-3xl font-bold tracking-tight text-white">
          {value.toLocaleString()}
        </div>

        <div className="mt-1 text-sm text-slate-500">
          {label}
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({
  status,
}: {
  status: string | null;
}) {
  const normalized = status?.toLowerCase();

  const className =
    normalized === "active"
      ? "bg-emerald-500/10 text-emerald-400"
      : normalized === "trial"
        ? "bg-blue-500/10 text-blue-400"
        : normalized === "suspended"
          ? "bg-amber-500/10 text-amber-400"
          : "bg-red-500/10 text-red-400";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${className}`}
    >
      {status || "Unknown"}
    </span>
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
      className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition hover:border-white/10 hover:bg-white/[0.04]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm text-slate-200">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-200">
          {title}
        </div>

        <div className="mt-0.5 truncate text-xs text-slate-500">
          {description}
        </div>
      </div>

      <span className="text-slate-600">→</span>
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
    <div className="bg-slate-950 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-300">
          {name}
        </span>

        <span
          className={`h-2 w-2 rounded-full ${
            warning
              ? "bg-amber-400"
              : "bg-emerald-400"
          }`}
        />
      </div>

      <div
        className={`mt-2 text-xs ${
          warning
            ? "text-amber-400"
            : "text-emerald-400"
        }`}
      >
        {status}
      </div>
    </div>
  );
}