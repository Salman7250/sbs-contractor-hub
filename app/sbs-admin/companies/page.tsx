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
  X,
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
  description: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  currency: string | null;
  is_active: boolean | null;
  is_popular: boolean | null;
  sort_order: number | null;
};

type SearchParams = {
  q?: string;
  status?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

function formatCurrency(
  amount: number,
  currency = "USD",
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusStyles(
  status: string | null,
) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";

    case "trial":
      return "bg-blue-50 text-blue-700 ring-blue-600/10";

    case "suspended":
      return "bg-amber-50 text-amber-700 ring-amber-600/10";

    case "cancelled":
    case "canceled":
      return "bg-red-50 text-red-700 ring-red-600/10";

    default:
      return "bg-slate-100 text-slate-600 ring-slate-500/10";
  }
}

function getSubscriptionStyles(
  status: string | null,
) {
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

function formatSubscriptionStatus(
  status: string | null,
) {
  if (!status) {
    return "No subscription";
  }

  if (status === "trialing") {
    return "Trialing";
  }

  if (status === "past_due") {
    return "Past due";
  }

  if (
    status === "cancelled" ||
    status === "canceled"
  ) {
    return "Cancelled";
  }

  return (
    status.charAt(0).toUpperCase() +
    status.slice(1)
  );
}

function buildFilterHref(
  search: string,
  status: string,
) {
  const params = new URLSearchParams();

  if (search.trim()) {
    params.set("q", search.trim());
  }

  if (
    status &&
    status !== "all"
  ) {
    params.set("status", status);
  }

  const query = params.toString();

  return query
    ? `/sbs-admin/companies?${query}`
    : "/sbs-admin/companies";
}

function getFilterLabel(
  status: string,
) {
  switch (status) {
    case "active":
      return "Active";

    case "trial":
      return "Trial";

    case "suspended":
      return "Suspended";

    default:
      return "All Companies";
  }
}

export default async function AdminCompaniesPage({
  searchParams,
}: PageProps) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const params = searchParams
    ? await searchParams
    : {};

  const searchQuery =
    typeof params.q === "string"
      ? params.q.trim()
      : "";

  const requestedStatus =
    typeof params.status === "string"
      ? params.status
      : "all";

  const allowedStatuses = [
    "all",
    "active",
    "trial",
    "suspended",
  ];

  const statusFilter =
    allowedStatuses.includes(
      requestedStatus,
    )
      ? requestedStatus
      : "all";

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
        `,
      )
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("subscriptions")
      .select(
        `
          company_id,
          status,
          amount,
          plan_id
        `,
      ),

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
          sort_order
        `,
      )
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from("company_members")
      .select("company_id"),
  ]);

  if (companiesResult.error) {
    throw new Error(
      companiesResult.error.message,
    );
  }

  if (subscriptionsResult.error) {
    throw new Error(
      subscriptionsResult.error.message,
    );
  }

  if (plansResult.error) {
    throw new Error(
      plansResult.error.message,
    );
  }

  if (membersResult.error) {
    throw new Error(
      membersResult.error.message,
    );
  }

  const companies =
    (companiesResult.data ??
      []) as Company[];

  const subscriptions =
    (subscriptionsResult.data ??
      []) as Subscription[];

  const plans =
    (plansResult.data ??
      []) as Plan[];

  const members =
    membersResult.data ?? [];

  /*
   * ----------------------------------------------------
   * ACTIVE PLANS
   * ----------------------------------------------------
   */

  const activePlans = plans
    .filter(
      (plan) =>
        plan.is_active !== false,
    )
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) -
        (b.sort_order ?? 0),
    );

  /*
   * ----------------------------------------------------
   * LOOKUP MAPS
   * ----------------------------------------------------
   */

  const planMap = new Map(
    plans.map((plan) => [
      plan.id,
      plan,
    ]),
  );

  const subscriptionMap =
    new Map<string, Subscription>();

  /*
   * If multiple subscriptions somehow
   * exist for a company, prefer an active
   * or trialing subscription.
   */
  for (const subscription of subscriptions) {
    const existing =
      subscriptionMap.get(
        subscription.company_id,
      );

    if (!existing) {
      subscriptionMap.set(
        subscription.company_id,
        subscription,
      );
      continue;
    }

    const preferredStatuses = [
      "active",
      "trialing",
    ];

    const existingPreferred =
      preferredStatuses.includes(
        existing.status ?? "",
      );

    const currentPreferred =
      preferredStatuses.includes(
        subscription.status ?? "",
      );

    if (
      currentPreferred &&
      !existingPreferred
    ) {
      subscriptionMap.set(
        subscription.company_id,
        subscription,
      );
    }
  }

  const memberCountMap =
    new Map<string, number>();

  for (const member of members) {
    const current =
      memberCountMap.get(
        member.company_id,
      ) ?? 0;

    memberCountMap.set(
      member.company_id,
      current + 1,
    );
  }

  /*
   * ----------------------------------------------------
   * PLATFORM STATS
   * ----------------------------------------------------
   */

  const activeCompanies =
    companies.filter(
      (company) =>
        company.status === "active",
    ).length;

  const trialCompanies =
    companies.filter(
      (company) =>
        company.status === "trial",
    ).length;

  const suspendedCompanies =
    companies.filter(
      (company) =>
        company.status === "suspended",
    ).length;

  const payingCompanies =
    subscriptions.filter(
      (subscription) =>
        subscription.status ===
          "active" &&
        Number(
          subscription.amount ?? 0,
        ) > 0,
    ).length;

  /*
   * NOTE:
   * MRR currently follows the stored
   * subscription amount. If multi-currency
   * billing is introduced later, this
   * should be converted into a platform
   * reporting currency.
   */
  const mrr = subscriptions
    .filter(
      (subscription) =>
        subscription.status ===
        "active",
    )
    .reduce(
      (total, subscription) =>
        total +
        Number(
          subscription.amount ?? 0,
        ),
      0,
    );

  /*
   * ----------------------------------------------------
   * PLAN COUNTS
   * ----------------------------------------------------
   */

  const starterCount =
    companies.filter((company) => {
      const subscription =
        subscriptionMap.get(
          company.id,
        );

      if (!subscription?.plan_id) {
        return false;
      }

      return (
        planMap.get(
          subscription.plan_id,
        )?.slug === "starter"
      );
    }).length;

  const professionalCount =
    companies.filter((company) => {
      const subscription =
        subscriptionMap.get(
          company.id,
        );

      if (!subscription?.plan_id) {
        return false;
      }

      const slug =
        planMap.get(
          subscription.plan_id,
        )?.slug;

      return (
        slug === "professional" ||
        slug === "pro"
      );
    }).length;

  const businessCount =
    companies.filter((company) => {
      const subscription =
        subscriptionMap.get(
          company.id,
        );

      if (!subscription?.plan_id) {
        return false;
      }

      return (
        planMap.get(
          subscription.plan_id,
        )?.slug === "business"
      );
    }).length;

  /*
   * ----------------------------------------------------
   * SEARCH + FILTER
   * ----------------------------------------------------
   */

  const normalizedSearch =
    searchQuery.toLowerCase();

  const filteredCompanies =
    companies.filter((company) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          company.name,
          company.slug,
          company.email,
          company.phone,
          company.city,
          company.state,
          company.country,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(
                normalizedSearch,
              ),
          );

      const matchesStatus =
        statusFilter === "all" ||
        company.status ===
          statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });

  const hasSearch =
    Boolean(searchQuery);

  const hasStatusFilter =
    statusFilter !== "all";

  const hasFilters =
    hasSearch ||
    hasStatusFilter;

  const filterLabel =
    getFilterLabel(
      statusFilter,
    );

  return (
    <div className="min-h-full bg-[#f3f5f8]">
      {/* =====================================================
          HEADER
          ===================================================== */}
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
            Manage every business
            workspace on the SBS
            platform, including
            subscriptions, users and
            account status.
          </p>
        </div>

        <NewCompanyForm
          plans={activePlans}
        />
      </div>

      {/* =====================================================
          STATS
          ===================================================== */}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Total Companies"
          value={companies.length}
          icon={
            <Building2 className="h-5 w-5" />
          }
        />

        <StatCard
          label="Active"
          value={activeCompanies}
          icon={
            <CheckCircle2 className="h-5 w-5" />
          }
          accent="green"
        />

        <StatCard
          label="Trial"
          value={trialCompanies}
          icon={
            <Clock3 className="h-5 w-5" />
          }
          accent="blue"
        />

        <StatCard
          label="Suspended"
          value={
            suspendedCompanies
          }
          icon={
            <ShieldAlert className="h-5 w-5" />
          }
          accent="amber"
        />

        <StatCard
          label="Paying"
          value={payingCompanies}
          icon={
            <Users className="h-5 w-5" />
          }
          accent="green"
        />

        <StatCard
          label="MRR"
          value={formatCurrency(mrr)}
          icon={
            <DollarSign className="h-5 w-5" />
          }
          accent="green"
        />
      </div>

      {/* =====================================================
          PLAN OVERVIEW
          ===================================================== */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <PlanCard
          name="Starter"
          count={starterCount}
          description="Core product operations"
          total={companies.length}
        />

        <PlanCard
          name="Professional"
          count={
            professionalCount
          }
          description="Advanced operations & automation"
          total={companies.length}
        />

        <PlanCard
          name="Business"
          count={businessCount}
          description="Full platform capabilities"
          total={companies.length}
        />
      </div>

      {/* =====================================================
          SEARCH + FILTER TOOLBAR
          ===================================================== */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
          <form
            method="GET"
            action="/sbs-admin/companies"
            className="w-full lg:max-w-md"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                name="q"
                defaultValue={
                  searchQuery
                }
                placeholder="Search companies..."
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />

              {searchQuery ? (
                <Link
                  href={buildFilterHref(
                    "",
                    statusFilter,
                  )}
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>

            {statusFilter !==
            "all" ? (
              <input
                type="hidden"
                name="status"
                value={
                  statusFilter
                }
              />
            ) : null}
          </form>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterButton
              label="All Companies"
              active={
                statusFilter ===
                "all"
              }
              href={buildFilterHref(
                searchQuery,
                "all",
              )}
            />

            <FilterButton
              label="Active"
              active={
                statusFilter ===
                "active"
              }
              href={buildFilterHref(
                searchQuery,
                "active",
              )}
            />

            <FilterButton
              label="Trial"
              active={
                statusFilter ===
                "trial"
              }
              href={buildFilterHref(
                searchQuery,
                "trial",
              )}
            />

            <FilterButton
              label="Suspended"
              active={
                statusFilter ===
                "suspended"
              }
              href={buildFilterHref(
                searchQuery,
                "suspended",
              )}
            />
          </div>
        </div>

        {/* Toolbar footer */}
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {
                  filteredCompanies.length
                }
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {companies.length}
              </span>{" "}
              {companies.length ===
              1
                ? "company"
                : "companies"}
            </span>

            {hasFilters ? (
              <>
                <span className="text-slate-300">
                  •
                </span>

                <span className="font-medium text-emerald-700">
                  {filterLabel}
                </span>

                {searchQuery ? (
                  <span className="font-medium text-slate-500">
                    matching "
                    {
                      searchQuery
                    }
                    "
                  </span>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Latest companies
              first
            </span>

            {hasFilters ? (
              <Link
                href="/sbs-admin/companies"
                className="text-xs font-semibold text-slate-600 transition hover:text-emerald-700"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* =====================================================
          COMPANIES TABLE
          ===================================================== */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filteredCompanies.length >
        0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <TableHeader>
                    Company
                  </TableHeader>

                  <TableHeader>
                    Plan
                  </TableHeader>

                  <TableHeader>
                    Subscription
                  </TableHeader>

                  <TableHeader>
                    Users
                  </TableHeader>

                  <TableHeader>
                    Location
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Created
                  </TableHeader>

                  <TableHeader>
                    <span className="sr-only">
                      Actions
                    </span>
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredCompanies.map(
                  (company) => {
                    const subscription =
                      subscriptionMap.get(
                        company.id,
                      );

                    const plan =
                      subscription?.plan_id
                        ? planMap.get(
                            subscription.plan_id,
                          )
                        : null;

                    const memberCount =
                      memberCountMap.get(
                        company.id,
                      ) ?? 0;

                    const billingCurrency =
                      plan?.currency ||
                      "USD";

                    return (
                      <tr
                        key={
                          company.id
                        }
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
                                  .slice(
                                    0,
                                    2,
                                  )
                                  .toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-900 transition group-hover:text-emerald-700">
                                  {
                                    company.name
                                  }
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
                                {
                                  plan.name
                                }
                              </div>

                              <div className="mt-0.5 text-xs text-slate-400">
                                {subscription?.amount !=
                                null
                                  ? `${formatCurrency(
                                      Number(
                                        subscription.amount,
                                      ),
                                      billingCurrency,
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
                                null,
                            )}`}
                          >
                            {formatSubscriptionStatus(
                              subscription?.status ??
                                null,
                            )}
                          </span>
                        </td>

                        {/* Users */}
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Users className="h-4 w-4 text-slate-400" />

                            {
                              memberCount
                            }
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
                              .filter(
                                Boolean,
                              )
                              .join(
                                ", ",
                              ) || "—"}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-5">
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${getStatusStyles(
                              company.status,
                            )}`}
                          >
                            {company.status ||
                              "Unknown"}
                          </span>
                        </td>

                        {/* Created */}
                        <td className="px-5 py-5 text-sm text-slate-500">
                          {new Date(
                            company.created_at,
                          ).toLocaleDateString(
                            "en-US",
                            {
                              month:
                                "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-5 text-right">
                          <Link
                            href={`/sbs-admin/companies/${company.id}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                            aria-label={`Manage ${company.name}`}
                            title={`Manage ${company.name}`}
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ===================================================
             EMPTY / NO RESULTS
             =================================================== */
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              {hasFilters ? (
                <Search className="h-7 w-7" />
              ) : (
                <Building2 className="h-7 w-7" />
              )}
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              {hasFilters
                ? "No matching companies"
                : "No companies yet"}
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {hasFilters
                ? "No companies match the current search or status filter. Try changing your filters or clearing the search."
                : "Customer companies will appear here once they are provisioned on the SBS platform."}
            </p>

            {hasFilters ? (
              <div className="mt-5 flex items-center justify-center gap-3">
                <Link
                  href="/sbs-admin/companies"
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Clear filters
                </Link>

                <Link
                  href={buildFilterHref(
                    "",
                    statusFilter,
                  )}
                  className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  View{" "}
                  {filterLabel}
                </Link>
              </div>
            ) : (
              <div className="mt-5">
                <NewCompanyForm
                  plans={
                    activePlans
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   STAT CARD
   ============================================================ */

function StatCard({
  label,
  value,
  icon,
  accent = "slate",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?:
    | "slate"
    | "green"
    | "blue"
    | "amber";
}) {
  const iconStyles = {
    slate:
      "bg-slate-100 text-slate-600",
    green:
      "bg-emerald-50 text-emerald-700",
    blue:
      "bg-blue-50 text-blue-700",
    amber:
      "bg-amber-50 text-amber-700",
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

/* ============================================================
   PLAN CARD
   ============================================================ */

function PlanCard({
  name,
  count,
  description,
  total,
}: {
  name: string;
  count: number;
  description: string;
  total: number;
}) {
  const percentage =
    total > 0
      ? Math.min(
          100,
          Math.round(
            (count / total) * 100,
          ),
        )
      : 0;

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
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      <div className="mt-2 text-[11px] font-medium text-slate-400">
        {percentage}% of companies
      </div>
    </div>
  );
}

/* ============================================================
   FILTER BUTTON
   ============================================================ */

function FilterButton({
  label,
  active = false,
  href,
}: {
  label: string;
  active?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-lg px-3.5 py-2 text-xs font-semibold transition",
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700",
      ].join(" ")}
    >
      {label}
    </Link>
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
    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
      {children}
    </th>
  );
}