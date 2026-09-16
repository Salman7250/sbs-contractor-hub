import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Clock3,
  DollarSign,
  MoreHorizontal,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import NewCompanyForm from "./new-company-form";

type Company = {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: string | null;
  created_at: string;
};

type Subscription = {
  company_id: string;
  status: string | null;
  amount: number | null;
  plan_id: string | null;
};

type Plan = {
  id: string;
  name: string;
  slug: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusStyles(status: string | null) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";

    case "trial":
      return "bg-blue-50 text-blue-700 ring-blue-600/10";

    case "suspended":
      return "bg-amber-50 text-amber-700 ring-amber-600/10";

    case "cancelled":
      return "bg-red-50 text-red-700 ring-red-600/10";

    default:
      return "bg-slate-100 text-slate-600 ring-slate-500/10";
  }
}

function getSubscriptionStyles(status: string | null) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";

    case "trialing":
      return "bg-blue-50 text-blue-700";

    case "past_due":
      return "bg-amber-50 text-amber-700";

    case "cancelled":
    case "canceled":
      return "bg-red-50 text-red-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatSubscriptionStatus(status: string | null) {
  if (!status) return "No subscription";

  if (status === "trialing") return "Trialing";

  if (status === "past_due") return "Past due";

  if (status === "cancelled" || status === "canceled") {
    return "Cancelled";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function AdminCompaniesPage() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const [
    companiesResult,
    subscriptionsResult,
    plansResult,
    membersResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(
        `
          id,
          name,
          slug,
          email,
          phone,
          city,
          state,
          country,
          status,
          created_at
        `
      )
      .order("created_at", { ascending: false }),

    supabase
      .from("subscriptions")
      .select(
        `
          company_id,
          status,
          amount,
          plan_id
        `
      ),

    supabase
      .from("plans")
      .select("id, name, slug"),

    supabase
      .from("company_members")
      .select("company_id"),
  ]);

  if (companiesResult.error) {
    throw new Error(companiesResult.error.message);
  }

  if (subscriptionsResult.error) {
    throw new Error(subscriptionsResult.error.message);
  }

  if (plansResult.error) {
    throw new Error(plansResult.error.message);
  }

  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  const companies = (companiesResult.data ?? []) as Company[];
  const subscriptions =
    (subscriptionsResult.data ?? []) as Subscription[];
  const plans = (plansResult.data ?? []) as Plan[];
  const members = membersResult.data ?? [];

  const planMap = new Map(
    plans.map((plan) => [plan.id, plan])
  );

  const subscriptionMap = new Map(
    subscriptions.map((subscription) => [
      subscription.company_id,
      subscription,
    ])
  );

  const memberCountMap = new Map<string, number>();

  for (const member of members) {
    const current =
      memberCountMap.get(member.company_id) ?? 0;

    memberCountMap.set(member.company_id, current + 1);
  }

  const activeCompanies = companies.filter(
    (company) => company.status === "active"
  ).length;

  const trialCompanies = companies.filter(
    (company) => company.status === "trial"
  ).length;

  const suspendedCompanies = companies.filter(
    (company) => company.status === "suspended"
  ).length;

  const payingCompanies = subscriptions.filter(
    (subscription) =>
      subscription.status === "active" &&
      Number(subscription.amount ?? 0) > 0
  ).length;

  const mrr = subscriptions
    .filter(
      (subscription) =>
        subscription.status === "active"
    )
    .reduce(
      (total, subscription) =>
        total + Number(subscription.amount ?? 0),
      0
    );

  const starterCount = companies.filter((company) => {
    const subscription = subscriptionMap.get(company.id);

    if (!subscription?.plan_id) return false;

    return (
      planMap.get(subscription.plan_id)?.slug ===
      "starter"
    );
  }).length;

  const professionalCount = companies.filter((company) => {
    const subscription = subscriptionMap.get(company.id);

    if (!subscription?.plan_id) return false;

    const slug = planMap.get(subscription.plan_id)?.slug;

    return (
      slug === "professional" ||
      slug === "pro"
    );
  }).length;

  const businessCount = companies.filter((company) => {
    const subscription = subscriptionMap.get(company.id);

    if (!subscription?.plan_id) return false;

    return (
      planMap.get(subscription.plan_id)?.slug ===
      "business"
    );
  }).length;

  return (
    <div className="min-h-full bg-[#f3f5f8]">
      {/* Header */}
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Building2 className="h-4 w-4" />
            Platform Management
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Companies
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage every business workspace on the SBS
            platform, including subscriptions, users and
            account status.
          </p>
        </div>

        <NewCompanyForm />
      </div>

      {/* Stats */}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Total Companies"
          value={companies.length}
          icon={<Building2 className="h-5 w-5" />}
        />

        <StatCard
          label="Active"
          value={activeCompanies}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="green"
        />

        <StatCard
          label="Trial"
          value={trialCompanies}
          icon={<Clock3 className="h-5 w-5" />}
          accent="blue"
        />

        <StatCard
          label="Suspended"
          value={suspendedCompanies}
          icon={<ShieldAlert className="h-5 w-5" />}
          accent="amber"
        />

        <StatCard
          label="Paying"
          value={payingCompanies}
          icon={<Users className="h-5 w-5" />}
          accent="green"
        />

        <StatCard
          label="MRR"
          value={formatCurrency(mrr)}
          icon={<DollarSign className="h-5 w-5" />}
          accent="green"
        />
      </div>

      {/* Plan overview */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <PlanCard
          name="Starter"
          count={starterCount}
          description="Core product operations"
        />

        <PlanCard
          name="Professional"
          count={professionalCount}
          description="Advanced operations & automation"
        />

        <PlanCard
          name="Business"
          count={businessCount}
          description="Full platform capabilities"
        />
      </div>

      {/* Toolbar */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              placeholder="Search companies..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              disabled
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterButton label="All Companies" active />
            <FilterButton label="Active" />
            <FilterButton label="Trial" />
            <FilterButton label="Suspended" />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {companies.length}
            </span>{" "}
            {companies.length === 1
              ? "company"
              : "companies"}
          </p>

          <p className="text-xs text-slate-400">
            Latest companies first
          </p>
        </div>
      </div>

      {/* Companies table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {companies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <TableHeader>Company</TableHeader>
                  <TableHeader>Plan</TableHeader>
                  <TableHeader>Subscription</TableHeader>
                  <TableHeader>Users</TableHeader>
                  <TableHeader>Location</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Created</TableHeader>
                  <TableHeader>
                    <span className="sr-only">
                      Actions
                    </span>
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {companies.map((company) => {
                  const subscription =
                    subscriptionMap.get(company.id);

                  const plan = subscription?.plan_id
                    ? planMap.get(subscription.plan_id)
                    : null;

                  const memberCount =
                    memberCountMap.get(company.id) ?? 0;

                  return (
                    <tr
                      key={company.id}
                      className="group transition hover:bg-slate-50/80"
                    >
                      {/* Company */}
                      <td className="px-5 py-5">
                        <Link
                          href={`/sbs-admin/companies/${company.id}`}
                          className="block"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                              {company.name
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-900 transition group-hover:text-emerald-700">
                                {company.name}
                              </div>

                              <div className="mt-0.5 truncate text-xs text-slate-400">
                                {company.slug ||
                                  "No slug"}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-5">
                        {plan ? (
                          <div>
                            <div className="text-sm font-semibold text-slate-800">
                              {plan.name}
                            </div>

                            <div className="mt-0.5 text-xs text-slate-400">
                              {subscription?.amount
                                ? `${formatCurrency(
                                    Number(
                                      subscription.amount
                                    )
                                  )}/month`
                                : "Custom billing"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            No plan
                          </span>
                        )}
                      </td>

                      {/* Subscription */}
                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${getSubscriptionStyles(
                            subscription?.status ??
                              null
                          )}`}
                        >
                          {formatSubscriptionStatus(
                            subscription?.status ??
                              null
                          )}
                        </span>
                      </td>

                      {/* Users */}
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <Users className="h-4 w-4 text-slate-400" />
                          {memberCount}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-5 py-5">
                        <div className="max-w-[180px] truncate text-sm text-slate-600">
                          {[
                            company.city,
                            company.state,
                            company.country,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${getStatusStyles(
                            company.status
                          )}`}
                        >
                          {company.status ||
                            "Unknown"}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-5 py-5 text-sm text-slate-500">
                        {new Date(
                          company.created_at
                        ).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-5 text-right">
                        <Link
                          href={`/sbs-admin/companies/${company.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                          aria-label={`Manage ${company.name}`}
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Building2 className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              No companies yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Customer companies will appear here once
              they are provisioned on the SBS platform.
            </p>

            <div className="mt-5">
              <NewCompanyForm />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = "slate",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: "slate" | "green" | "blue" | "amber";
}) {
  const iconStyles = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconStyles[accent]}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-2xl font-bold tracking-tight text-slate-950">
          {value}
        </div>

        <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  name,
  count,
  description,
}: {
  name: string;
  count: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {name}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {description}
          </div>
        </div>

        <div className="rounded-xl bg-slate-100 px-3 py-2 text-lg font-bold text-slate-900">
          {count}
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/2 rounded-full bg-emerald-500" />
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
      {children}
    </th>
  );
}