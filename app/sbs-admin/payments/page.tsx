import Link from "next/link";
import {
  ArrowDownLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  ExternalLink,
  MoreHorizontal,
  RefreshCcw,
  Search,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

type Payment = {
  id: string;
  company_id: string;
  company_name: string | null;
  subscription_id: string | null;
  provider: string;
  provider_transaction_id: string | null;
  provider_order_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  payment_type: string | null;
  payment_method: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  failure_reason: string | null;
  created_at: string;
  plan_name: string | null;
  billing_cycle: string | null;
};

type SearchParams = {
  q?: string;
  status?: string;
  provider?: string;
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
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStatus(status: string | null) {
  if (!status) {
    return "Unknown";
  }

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function formatPaymentType(type: string | null) {
  if (!type) {
    return "—";
  }

  switch (type) {
    case "subscription":
      return "Subscription";

    case "one_time":
      return "One-time";

    case "refund":
      return "Refund";

    case "adjustment":
      return "Adjustment";

    default:
      return formatStatus(type);
  }
}

function getPaymentStatusStyles(
  status: string | null,
) {
  switch (status) {
    case "succeeded":
      return "bg-emerald-50 text-emerald-700";

    case "pending":
      return "bg-blue-50 text-blue-700";

    case "failed":
      return "bg-red-50 text-red-700";

    case "refunded":
      return "bg-violet-50 text-violet-700";

    case "partially_refunded":
      return "bg-amber-50 text-amber-700";

    case "canceled":
      return "bg-slate-100 text-slate-600";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function getPaymentTypeStyles(
  type: string | null,
) {
  switch (type) {
    case "subscription":
      return "bg-slate-100 text-slate-700";

    case "one_time":
      return "bg-blue-50 text-blue-700";

    case "refund":
      return "bg-violet-50 text-violet-700";

    case "adjustment":
      return "bg-amber-50 text-amber-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function buildFilterHref(
  search: string,
  status: string,
  provider: string,
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

  if (
    provider &&
    provider !== "all"
  ) {
    params.set("provider", provider);
  }

  const query = params.toString();

  return query
    ? `/sbs-admin/payments?${query}`
    : "/sbs-admin/payments";
}

function getFilterLabel(
  status: string,
) {
  switch (status) {
    case "succeeded":
      return "Succeeded";

    case "pending":
      return "Pending";

    case "failed":
      return "Failed";

    case "refunded":
      return "Refunded";

    case "partially_refunded":
      return "Partially Refunded";

    default:
      return "All Payments";
  }
}

export default async function AdminPaymentsPage({
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

  const requestedProvider =
    typeof params.provider === "string"
      ? params.provider
      : "all";

  const allowedStatuses = [
    "all",
    "succeeded",
    "pending",
    "failed",
    "refunded",
    "partially_refunded",
    "canceled",
  ];

  const statusFilter =
    allowedStatuses.includes(
      requestedStatus,
    )
      ? requestedStatus
      : "all";

  const providerFilter =
    requestedProvider === "paypal" ||
    requestedProvider === "all"
      ? requestedProvider
      : "all";

  const { data, error } = await supabase
    .from("payments")
    .select(
      `
        id,
        company_id,
        subscription_id,
        provider,
        provider_transaction_id,
        provider_order_id,
        amount,
        currency,
        status,
        payment_type,
        payment_method,
        paid_at,
        refunded_at,
        failure_reason,
        created_at,
        companies (
          name
        ),
        subscriptions (
          billing_cycle,
          plans (
            name
          )
        )
      `,
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const rawPayments =
    data ?? [];

  const payments: Payment[] =
    rawPayments.map((payment) => {
      const company = Array.isArray(
        payment.companies,
      )
        ? payment.companies[0]
        : payment.companies;

      const subscription =
        Array.isArray(
          payment.subscriptions,
        )
          ? payment.subscriptions[0]
          : payment.subscriptions;

      const plan = subscription
        ? Array.isArray(
            subscription.plans,
          )
          ? subscription.plans[0]
          : subscription.plans
        : null;

      return {
        id: payment.id,
        company_id:
          payment.company_id,
        company_name:
          company?.name ?? null,
        subscription_id:
          payment.subscription_id,
        provider:
          payment.provider,
        provider_transaction_id:
          payment.provider_transaction_id,
        provider_order_id:
          payment.provider_order_id,
        amount:
          payment.amount,
        currency:
          payment.currency,
        status:
          payment.status,
        payment_type:
          payment.payment_type,
        payment_method:
          payment.payment_method,
        paid_at:
          payment.paid_at,
        refunded_at:
          payment.refunded_at,
        failure_reason:
          payment.failure_reason,
        created_at:
          payment.created_at,
        plan_name:
          plan?.name ?? null,
        billing_cycle:
          subscription?.billing_cycle ??
          null,
      };
    });

  /*
   * ----------------------------------------------------
   * PLATFORM STATS
   * ----------------------------------------------------
   */

  const succeededPayments =
    payments.filter(
      (payment) =>
        payment.status ===
        "succeeded",
    );

  const pendingPayments =
    payments.filter(
      (payment) =>
        payment.status ===
        "pending",
    );

  const failedPayments =
    payments.filter(
      (payment) =>
        payment.status ===
        "failed",
    );

  const refundedPayments =
    payments.filter(
      (payment) =>
        payment.status ===
          "refunded" ||
        payment.status ===
          "partially_refunded",
    );

  const collectedAmount =
    succeededPayments.reduce(
      (total, payment) =>
        total +
        Number(
          payment.amount ?? 0,
        ),
      0,
    );

  const pendingAmount =
    pendingPayments.reduce(
      (total, payment) =>
        total +
        Number(
          payment.amount ?? 0,
        ),
      0,
    );

  const refundedAmount =
    refundedPayments.reduce(
      (total, payment) =>
        total +
        Number(
          payment.amount ?? 0,
        ),
      0,
    );

  /*
   * ----------------------------------------------------
   * SEARCH + FILTER
   * ----------------------------------------------------
   */

  const normalizedSearch =
    searchQuery.toLowerCase();

  const filteredPayments =
    payments.filter((payment) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          payment.company_name,
          payment.provider,
          payment.provider_transaction_id,
          payment.provider_order_id,
          payment.plan_name,
          payment.payment_method,
          payment.payment_type,
          payment.currency,
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
        payment.status ===
          statusFilter;

      const matchesProvider =
        providerFilter === "all" ||
        payment.provider ===
          providerFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesProvider
      );
    });

  const hasSearch =
    Boolean(searchQuery);

  const hasStatusFilter =
    statusFilter !== "all";

  const hasProviderFilter =
    providerFilter !== "all";

  const hasFilters =
    hasSearch ||
    hasStatusFilter ||
    hasProviderFilter;

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
            <CreditCard className="h-4 w-4" />

            Platform Billing
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Payments
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Monitor subscription payments,
            provider transactions,
            refunds and billing activity
            across the entire SBS platform.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            PayPal
            <span className="text-emerald-600">
              Connected
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================
          STATS
          ===================================================== */}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Total Payments"
          value={payments.length}
          icon={
            <CreditCard className="h-5 w-5" />
          }
        />

        <StatCard
          label="Succeeded"
          value={
            succeededPayments.length
          }
          icon={
            <CheckCircle2 className="h-5 w-5" />
          }
          accent="green"
        />

        <StatCard
          label="Pending"
          value={
            pendingPayments.length
          }
          icon={
            <Clock3 className="h-5 w-5" />
          }
          accent="blue"
        />

        <StatCard
          label="Failed"
          value={
            failedPayments.length
          }
          icon={
            <ShieldAlert className="h-5 w-5" />
          }
          accent="amber"
        />

        <StatCard
          label="Refunded"
          value={
            refundedPayments.length
          }
          icon={
            <RefreshCcw className="h-5 w-5" />
          }
        />

        <StatCard
          label="Collected"
          value={formatCurrency(
            collectedAmount,
          )}
          icon={
            <DollarSign className="h-5 w-5" />
          }
          accent="green"
        />
      </div>

      {/* =====================================================
          BILLING OVERVIEW
          ===================================================== */}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <BillingCard
          label="Collected"
          value={formatCurrency(
            collectedAmount,
          )}
          description="Successfully captured payments"
          icon={
            <ArrowDownLeft className="h-5 w-5" />
          }
          accent="green"
        />

        <BillingCard
          label="Pending Value"
          value={formatCurrency(
            pendingAmount,
          )}
          description="Payments awaiting completion"
          icon={
            <Clock3 className="h-5 w-5" />
          }
          accent="blue"
        />

        <BillingCard
          label="Refunded Value"
          value={formatCurrency(
            refundedAmount,
          )}
          description="Refunded or partially refunded"
          icon={
            <RefreshCcw className="h-5 w-5" />
          }
          accent="amber"
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
            action="/sbs-admin/payments"
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
                placeholder="Search payments..."
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />

              {searchQuery ? (
                <Link
                  href={buildFilterHref(
                    "",
                    statusFilter,
                    providerFilter,
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

            {providerFilter !==
            "all" ? (
              <input
                type="hidden"
                name="provider"
                value={
                  providerFilter
                }
              />
            ) : null}
          </form>

          {/* Filters */}

          <div className="flex flex-wrap items-center gap-2">
            <FilterButton
              label="All"
              active={
                statusFilter ===
                  "all" &&
                providerFilter ===
                  "all"
              }
              href={buildFilterHref(
                searchQuery,
                "all",
                "all",
              )}
            />

            <FilterButton
              label="Succeeded"
              active={
                statusFilter ===
                "succeeded"
              }
              href={buildFilterHref(
                searchQuery,
                "succeeded",
                providerFilter,
              )}
            />

            <FilterButton
              label="Pending"
              active={
                statusFilter ===
                "pending"
              }
              href={buildFilterHref(
                searchQuery,
                "pending",
                providerFilter,
              )}
            />

            <FilterButton
              label="Failed"
              active={
                statusFilter ===
                "failed"
              }
              href={buildFilterHref(
                searchQuery,
                "failed",
                providerFilter,
              )}
            />

            <FilterButton
              label="Refunded"
              active={
                statusFilter ===
                  "refunded" ||
                statusFilter ===
                  "partially_refunded"
              }
              href={buildFilterHref(
                searchQuery,
                "refunded",
                providerFilter,
              )}
            />

            <FilterButton
              label="PayPal"
              active={
                providerFilter ===
                "paypal"
              }
              href={buildFilterHref(
                searchQuery,
                statusFilter,
                "paypal",
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
                  filteredPayments.length
                }
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {payments.length}
              </span>{" "}
              {payments.length ===
              1
                ? "payment"
                : "payments"}
            </span>

            {hasFilters ? (
              <>
                <span className="text-slate-300">
                  •
                </span>

                <span className="font-medium text-emerald-700">
                  {filterLabel}
                </span>

                {providerFilter !==
                "all" ? (
                  <span className="font-medium text-slate-500">
                    via PayPal
                  </span>
                ) : null}

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
              Latest transactions
              first
            </span>

            {hasFilters ? (
              <Link
                href="/sbs-admin/payments"
                className="text-xs font-semibold text-slate-600 transition hover:text-emerald-700"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* =====================================================
          PAYMENTS TABLE
          ===================================================== */}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filteredPayments.length >
        0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <TableHeader>
                    Payment
                  </TableHeader>

                  <TableHeader>
                    Company
                  </TableHeader>

                  <TableHeader>
                    Plan
                  </TableHeader>

                  <TableHeader>
                    Amount
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Provider
                  </TableHeader>

                  <TableHeader>
                    Payment Type
                  </TableHeader>

                  <TableHeader>
                    Paid
                  </TableHeader>

                  <TableHeader>
                    <span className="sr-only">
                      Actions
                    </span>
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map(
                  (payment) => (
                    <tr
                      key={
                        payment.id
                      }
                      className="group transition hover:bg-slate-50/80"
                    >
                      {/* Payment */}

                      <td className="px-5 py-5">
                        <div>
                          <div className="font-mono text-xs font-semibold text-slate-800">
                            {payment.provider_transaction_id ||
                              payment.provider_order_id ||
                              payment.id.slice(
                                0,
                                8,
                              )}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            Created{" "}
                            {formatDateTime(
                              payment.created_at,
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Company */}

                      <td className="px-5 py-5">
                        <Link
                          href={`/sbs-admin/companies/${payment.company_id}`}
                          className="group/company flex items-center gap-3"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                            {(
                              payment.company_name ||
                              "CO"
                            )
                              .slice(
                                0,
                                2,
                              )
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900 transition group-hover/company:text-emerald-700">
                              {payment.company_name ||
                                "Unknown company"}
                            </div>

                            <div className="mt-0.5 truncate text-xs text-slate-400">
                              {payment.company_id.slice(
                                0,
                                8,
                              )}
                              ...
                            </div>
                          </div>
                        </Link>
                      </td>

                      {/* Plan */}

                      <td className="px-5 py-5">
                        {payment.plan_name ? (
                          <div>
                            <div className="text-sm font-semibold text-slate-800">
                              {
                                payment.plan_name
                              }
                            </div>

                            <div className="mt-0.5 text-xs text-slate-400">
                              {payment.billing_cycle
                                ? `${payment.billing_cycle} billing`
                                : "Subscription"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            —
                          </span>
                        )}
                      </td>

                      {/* Amount */}

                      <td className="px-5 py-5">
                        <div className="text-sm font-bold text-slate-900">
                          {formatCurrency(
                            Number(
                              payment.amount ??
                                0,
                            ),
                            payment.currency ||
                              "USD",
                          )}
                        </div>

                        <div className="mt-0.5 text-xs uppercase text-slate-400">
                          {payment.currency ||
                            "USD"}
                        </div>
                      </td>

                      {/* Status */}

                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${getPaymentStatusStyles(
                            payment.status,
                          )}`}
                        >
                          {formatStatus(
                            payment.status,
                          )}
                        </span>
                      </td>

                      {/* Provider */}

                      <td className="px-5 py-5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[10px] font-bold uppercase text-blue-700">
                            PP
                          </div>

                          <div>
                            <div className="text-sm font-semibold capitalize text-slate-700">
                              {
                                payment.provider
                              }
                            </div>

                            <div className="mt-0.5 text-xs text-slate-400">
                              {payment.payment_method ||
                                "Provider billing"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Payment Type */}

                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${getPaymentTypeStyles(
                            payment.payment_type,
                          )}`}
                        >
                          {formatPaymentType(
                            payment.payment_type,
                          )}
                        </span>
                      </td>

                      {/* Paid */}

                      <td className="px-5 py-5">
                        <div className="text-sm text-slate-600">
                          {formatDate(
                            payment.paid_at,
                          )}
                        </div>

                        {payment.refunded_at ? (
                          <div className="mt-0.5 text-xs text-violet-600">
                            Refunded{" "}
                            {formatDate(
                              payment.refunded_at,
                            )}
                          </div>
                        ) : null}

                        {payment.failure_reason ? (
                          <div className="mt-0.5 max-w-[160px] truncate text-xs text-red-500">
                            {
                              payment.failure_reason
                            }
                          </div>
                        ) : null}
                      </td>

                      {/* Actions */}

                      <td className="px-5 py-5 text-right">
                        <Link
                          href={`/sbs-admin/payments/${payment.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                          aria-label={`View payment ${payment.id}`}
                          title="View payment"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </Link>
                      </td>
                    </tr>
                  ),
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
                <CreditCard className="h-7 w-7" />
              )}
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              {hasFilters
                ? "No matching payments"
                : "No payments yet"}
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {hasFilters
                ? "No payment records match the current search or filters. Try changing your filters or clearing the search."
                : "Payment transactions will appear here once customers complete billing through the connected payment provider."}
            </p>

            {hasFilters ? (
              <div className="mt-5 flex items-center justify-center gap-3">
                <Link
                  href="/sbs-admin/payments"
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Clear filters
                </Link>

                <Link
                  href={buildFilterHref(
                    "",
                    statusFilter,
                    providerFilter,
                  )}
                  className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  View{" "}
                  {filterLabel}
                </Link>
              </div>
            ) : (
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-blue-500" />

                Awaiting first
                payment
              </div>
            )}
          </div>
        )}
      </div>

      {/* =====================================================
          PROVIDER STATUS
          ===================================================== */}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-500" />

                <h2 className="text-sm font-semibold text-slate-900">
                  PayPal Billing
                </h2>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                PayPal is currently the configured
                subscription provider for SBS
                billing.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ProviderMetric
              label="Payments recorded"
              value={payments.length}
            />

            <ProviderMetric
              label="Successful"
              value={
                succeededPayments.length
              }
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-slate-500" />

                <h2 className="text-sm font-semibold text-slate-900">
                  Payment Events
                </h2>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Provider webhook events are stored
                separately for reconciliation and
                audit processing.
              </p>
            </div>

            <Link
              href="/sbs-admin/payments/events"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-800"
            >
              View events
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-400" />

              <span className="text-xs font-semibold text-slate-700">
                Webhook ledger ready
              </span>
            </div>

            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Incoming PayPal events can be reconciled
              against payment and subscription records.
            </p>
          </div>
        </section>
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
   BILLING CARD
   ============================================================ */

function BillingCard({
  label,
  value,
  description,
  icon,
  accent,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  accent:
    | "green"
    | "blue"
    | "amber";
}) {
  const iconStyles = {
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
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </div>

          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </div>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconStyles[accent]}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        {description}
      </div>
    </div>
  );
}

/* ============================================================
   PROVIDER METRIC
   ============================================================ */

function ProviderMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-lg font-bold text-slate-900">
        {value.toLocaleString()}
      </div>

      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
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