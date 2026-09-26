import Link from "next/link";

import {
  CheckCircle2,
  Clock3,
  DollarSign,
  Edit3,
  Gift,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

import {
  createDiscount,
  deleteDiscount,
  toggleDiscount,
  updateDiscount,
} from "./actions";

import CopyDiscountCode from "./copy-discount-code";
import DiscountForm from "./discount-form";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  q?: string;
  status?: string;
  type?: string;
  create?: string;
  edit?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

type Company = {
  id: string;
  name: string;
};

type Plan = {
  id: string;
  name: string;
  slug: string;
};

type Discount = {
  id: string;
  company_id: string | null;
  plan_id: string | null;
  name: string;
  code: string | null;

  discount_type:
    | "percentage"
    | "fixed";

  discount_value: number;

  duration_type:
    | "one_time"
    | "one_month"
    | "three_months"
    | "six_months"
    | "twelve_months"
    | "lifetime"
    | "custom";

  starts_at: string;
  expires_at: string | null;

  billing_cycle:
    | "monthly"
    | "yearly"
    | null;

  is_active: boolean;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  duration_value: number | null;

  duration_unit:
    | "days"
    | "weeks"
    | "months"
    | "years"
    | null;

  max_redemptions: number | null;
  redemption_count: number;
};

function getDurationLabel(
  discount: Discount,
) {
  switch (discount.duration_type) {
    case "one_time":
      return "One time";

    case "one_month":
      return "1 month";

    case "three_months":
      return "3 months";

    case "six_months":
      return "6 months";

    case "twelve_months":
      return "12 months";

    case "lifetime":
      return "Lifetime";

    case "custom":
      if (
        discount.duration_value &&
        discount.duration_unit
      ) {
        return `${discount.duration_value} ${discount.duration_unit}`;
      }

      return "Custom";

    default:
      return "Lifetime";
  }
}

function getDiscountLabel(
  discount: Discount,
) {
  if (
    discount.discount_type ===
    "percentage"
  ) {
    return `${discount.discount_value}%`;
  }

  return `$${Number(
    discount.discount_value,
  ).toFixed(2)}`;
}

function getStatus(
  discount: Discount,
) {
  if (!discount.is_active) {
    return "disabled";
  }

  if (
    discount.expires_at &&
    new Date(
      discount.expires_at,
    ).getTime() < Date.now()
  ) {
    return "expired";
  }

  if (
    discount.max_redemptions !==
      null &&
    discount.redemption_count >=
      discount.max_redemptions
  ) {
    return "limit_reached";
  }

  return "active";
}

function getStatusLabel(
  status: string,
) {
  switch (status) {
    case "active":
      return "Active";

    case "expired":
      return "Expired";

    case "disabled":
      return "Disabled";

    case "limit_reached":
      return "Limit reached";

    default:
      return status;
  }
}

function getStatusStyles(
  status: string,
) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";

    case "expired":
      return "bg-slate-100 text-slate-600 ring-slate-500/10";

    case "disabled":
      return "bg-red-50 text-red-700 ring-red-600/10";

    case "limit_reached":
      return "bg-amber-50 text-amber-700 ring-amber-600/10";

    default:
      return "bg-slate-100 text-slate-600 ring-slate-500/10";
  }
}

function buildHref(
  search: string,
  status: string,
  type: string,
) {
  const params =
    new URLSearchParams();

  if (search.trim()) {
    params.set(
      "q",
      search.trim(),
    );
  }

  if (
    status &&
    status !== "all"
  ) {
    params.set(
      "status",
      status,
    );
  }

  if (
    type &&
    type !== "all"
  ) {
    params.set(
      "type",
      type,
    );
  }

  const query =
    params.toString();

  return query
    ? `/sbs-admin/discounts?${query}`
    : "/sbs-admin/discounts";
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Date(
    value,
  ).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}

export default async function AdminDiscountsPage({
  searchParams,
}: PageProps) {
  await requirePlatformAdmin();

  const supabase =
    await createClient();

  const params =
    searchParams
      ? await searchParams
      : {};

  const searchQuery =
    typeof params.q === "string"
      ? params.q.trim()
      : "";

  const requestedStatus =
    typeof params.status ===
    "string"
      ? params.status
      : "all";

  const requestedType =
    typeof params.type ===
    "string"
      ? params.type
      : "all";

  const showCreate =
    params.create === "1";

  const editId =
    typeof params.edit === "string"
      ? params.edit
      : "";

  const [
    discountsResult,
    companiesResult,
    plansResult,
  ] = await Promise.all([
    supabase
      .from("company_discounts")
      .select(
        `
          id,
          company_id,
          plan_id,
          name,
          code,
          discount_type,
          discount_value,
          duration_type,
          starts_at,
          expires_at,
          billing_cycle,
          is_active,
          reason,
          created_by,
          created_at,
          updated_at,
          duration_value,
          duration_unit,
          max_redemptions,
          redemption_count
        `,
      )
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("companies")
      .select("id, name")
      .order("name"),

    supabase
      .from("plans")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  if (discountsResult.error) {
    throw new Error(
      discountsResult.error.message,
    );
  }

  if (companiesResult.error) {
    throw new Error(
      companiesResult.error.message,
    );
  }

  if (plansResult.error) {
    throw new Error(
      plansResult.error.message,
    );
  }

  const discounts =
    (discountsResult.data ??
      []) as Discount[];

  const companies =
    (companiesResult.data ??
      []) as Company[];

  const plans =
    (plansResult.data ??
      []) as Plan[];

  const companyMap =
    new Map(
      companies.map(
        (company) => [
          company.id,
          company,
        ],
      ),
    );

  const planMap =
    new Map(
      plans.map(
        (plan) => [
          plan.id,
          plan,
        ],
      ),
    );

  const normalizedSearch =
    searchQuery.toLowerCase();

  const filteredDiscounts =
    discounts.filter(
      (discount) => {
        const status =
          getStatus(discount);

        const matchesSearch =
          !normalizedSearch ||
          [
            discount.name,
            discount.code,
            discount.reason,
            companyMap.get(
              discount.company_id ??
                "",
            )?.name,
            planMap.get(
              discount.plan_id ??
                "",
            )?.name,
          ]
            .filter(Boolean)
            .some(
              (value) =>
                String(value)
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
            );

        const matchesStatus =
          requestedStatus ===
            "all" ||
          status ===
            requestedStatus;

        const matchesType =
          requestedType ===
            "all" ||
          discount.discount_type ===
            requestedType;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesType
        );
      },
    );

  const activeCount =
    discounts.filter(
      (discount) =>
        getStatus(discount) ===
        "active",
    ).length;

  const expiredCount =
    discounts.filter(
      (discount) =>
        getStatus(discount) ===
        "expired",
    ).length;

  const disabledCount =
    discounts.filter(
      (discount) =>
        getStatus(discount) ===
        "disabled",
    ).length;

  const redemptionCount =
    discounts.reduce(
      (total, discount) =>
        total +
        Number(
          discount.redemption_count ??
            0,
        ),
      0,
    );

  const limitedCount =
    discounts.filter(
      (discount) =>
        discount.max_redemptions !==
        null,
    ).length;

  const editDiscount =
    editId
      ? discounts.find(
          (discount) =>
            discount.id ===
            editId,
        ) ?? null
      : null;

  return (
    <div className="min-h-full bg-[#f3f5f8]">
      {/* HEADER */}

      <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Gift className="h-4 w-4" />
            Revenue Management
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Discounts
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Create and manage custom
            subscription discounts,
            promotional offers,
            lifetime deals and
            limited-time pricing
            incentives across SBS.
          </p>
        </div>

        <Link
          href={
            showCreate ||
            editDiscount
              ? "/sbs-admin/discounts"
              : "/sbs-admin/discounts?create=1"
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          {showCreate ||
          editDiscount ? (
            <>
              <XCircle className="h-4 w-4" />
              Close
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Create Discount
            </>
          )}
        </Link>
      </div>

      {/* STATS */}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total Discounts"
          value={discounts.length}
          icon={
            <Gift className="h-5 w-5" />
          }
        />

        <StatCard
          label="Active"
          value={activeCount}
          icon={
            <CheckCircle2 className="h-5 w-5" />
          }
          accent="green"
        />

        <StatCard
          label="Redemptions"
          value={redemptionCount}
          icon={
            <Zap className="h-5 w-5" />
          }
          accent="blue"
        />

        <StatCard
          label="Expired"
          value={expiredCount}
          icon={
            <Clock3 className="h-5 w-5" />
          }
          accent="amber"
        />

        <StatCard
          label="Disabled"
          value={disabledCount}
          icon={
            <XCircle className="h-5 w-5" />
          }
          accent="red"
        />
      </div>

      {/* FEATURE CARDS */}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <FeatureCard
          icon={
            <Percent className="h-5 w-5" />
          }
          title="Percentage Discounts"
          description="Give customers any percentage from 1% to 100% off."
          example="25% off"
          accent="green"
        />

        <FeatureCard
          icon={
            <DollarSign className="h-5 w-5" />
          }
          title="Fixed Amount"
          description="Subtract a specific monetary amount from the subscription."
          example="$50 off"
          accent="blue"
        />

        <FeatureCard
          icon={
            <Clock3 className="h-5 w-5" />
          }
          title="Flexible Duration"
          description="Use lifetime, fixed subscription periods or your own duration."
          example="90 days"
          accent="amber"
        />
      </div>

      {/* TOOLBAR */}

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form
            method="GET"
            action="/sbs-admin/discounts"
            className="w-full lg:max-w-md"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="Search discounts..."
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <FilterButton
              label="All"
              active={
                requestedStatus ===
                "all"
              }
              href={buildHref(
                searchQuery,
                "all",
                requestedType,
              )}
            />

            <FilterButton
              label="Active"
              active={
                requestedStatus ===
                "active"
              }
              href={buildHref(
                searchQuery,
                "active",
                requestedType,
              )}
            />

            <FilterButton
              label="Expired"
              active={
                requestedStatus ===
                "expired"
              }
              href={buildHref(
                searchQuery,
                "expired",
                requestedType,
              )}
            />

            <FilterButton
              label="Disabled"
              active={
                requestedStatus ===
                "disabled"
              }
              href={buildHref(
                searchQuery,
                "disabled",
                requestedType,
              )}
            />

            <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

            <FilterButton
              label="All Types"
              active={
                requestedType ===
                "all"
              }
              href={buildHref(
                searchQuery,
                requestedStatus,
                "all",
              )}
            />

            <FilterButton
              label="Percentage"
              active={
                requestedType ===
                "percentage"
              }
              href={buildHref(
                searchQuery,
                requestedStatus,
                "percentage",
              )}
            />

            <FilterButton
              label="Fixed"
              active={
                requestedType ===
                "fixed"
              }
              href={buildHref(
                searchQuery,
                requestedStatus,
                "fixed",
              )}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {filteredDiscounts.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-700">
              {discounts.length}
            </span>{" "}
            discounts
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>
              {limitedCount} usage-limited
            </span>

            {(searchQuery ||
              requestedStatus !==
                "all" ||
              requestedType !==
                "all") && (
              <Link
                href="/sbs-admin/discounts"
                className="font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Clear filters
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* TABLE */}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filteredDiscounts.length >
        0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <TableHeader>
                    Discount
                  </TableHeader>

                  <TableHeader>
                    Customer
                  </TableHeader>

                  <TableHeader>
                    Offer
                  </TableHeader>

                  <TableHeader>
                    Duration
                  </TableHeader>

                  <TableHeader>
                    Billing
                  </TableHeader>

                  <TableHeader>
                    Usage
                  </TableHeader>

                  <TableHeader>
                    Starts
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    <span className="sr-only">
                      Actions
                    </span>
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredDiscounts.map(
                  (discount) => {
                    const status =
                      getStatus(
                        discount,
                      );

                    const company =
                      discount.company_id
                        ? companyMap.get(
                            discount.company_id,
                          )
                        : null;

                    const plan =
                      discount.plan_id
                        ? planMap.get(
                            discount.plan_id,
                          )
                        : null;

                    return (
                      <tr
                        key={
                          discount.id
                        }
                        className="group transition hover:bg-slate-50/80"
                      >
                        {/* DISCOUNT */}

                        <td className="px-5 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                              {discount.discount_type ===
                              "percentage" ? (
                                <Percent className="h-4 w-4" />
                              ) : (
                                <DollarSign className="h-4 w-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">
                                {
                                  discount.name
                                }
                              </div>

                              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                                {discount.code ? (
                                  <>
                                    <span className="font-mono font-medium text-emerald-700">
                                      {
                                        discount.code
                                      }
                                    </span>

                                    <span>
                                      •
                                    </span>

                                    <CopyDiscountCode
                                      code={
                                        discount.code
                                      }
                                    />
                                  </>
                                ) : null}

                                <span>
                                  {discount.id.slice(
                                    0,
                                    8,
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* CUSTOMER */}

                        <td className="px-5 py-5">
                          <div className="text-sm font-medium text-slate-700">
                            {company?.name ??
                              "All companies"}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {plan?.name ??
                              "All plans"}
                          </div>
                        </td>

                        {/* OFFER */}

                        <td className="px-5 py-5">
                          <div className="text-base font-bold text-slate-900">
                            {getDiscountLabel(
                              discount,
                            )}
                          </div>

                          <div className="mt-1 text-xs capitalize text-slate-400">
                            {
                              discount.discount_type
                            }
                          </div>
                        </td>

                        {/* DURATION */}

                        <td className="px-5 py-5">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {getDurationLabel(
                              discount,
                            )}
                          </span>
                        </td>

                        {/* BILLING */}

                        <td className="px-5 py-5">
                          <span className="text-sm capitalize text-slate-600">
                            {discount.billing_cycle ??
                              "Both"}
                          </span>
                        </td>

                        {/* USAGE */}

                        <td className="px-5 py-5">
                          <div className="text-sm font-medium text-slate-700">
                            {
                              discount.redemption_count
                            }
                            {discount.max_redemptions !==
                            null
                              ? ` / ${discount.max_redemptions}`
                              : " / Unlimited"}
                          </div>
                        </td>

                        {/* START */}

                        <td className="px-5 py-5">
                          <div className="text-sm text-slate-600">
                            {formatDate(
                              discount.starts_at,
                            )}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {discount.expires_at
                              ? `Ends ${formatDate(
                                  discount.expires_at,
                                )}`
                              : "No expiry"}
                          </div>
                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-5">
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${getStatusStyles(
                              status,
                            )}`}
                          >
                            {getStatusLabel(
                              status,
                            )}
                          </span>
                        </td>

                        {/* ACTIONS */}

                        <td className="px-5 py-5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/sbs-admin/discounts?edit=${discount.id}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                              title="Edit discount"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Link>

                            <form
                              action={
                                toggleDiscount
                              }
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={
                                  discount.id
                                }
                              />

                              <input
                                type="hidden"
                                name="next_status"
                                value={
                                  discount.is_active
                                    ? "false"
                                    : "true"
                                }
                              />

                              <button
                                type="submit"
                                title={
                                  discount.is_active
                                    ? "Disable discount"
                                    : "Enable discount"
                                }
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                              >
                                {discount.is_active ? (
                                  <XCircle className="h-4 w-4" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </button>
                            </form>

                            <form
                              action={
                                deleteDiscount
                              }
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={
                                  discount.id
                                }
                              />

                              <button
                                type="submit"
                                title="Delete discount"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Gift className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              No discounts found
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Create your first
              discount or change the
              current search and
              filters.
            </p>

            <div className="mt-5">
              <Link
                href="/sbs-admin/discounts?create=1"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Create Discount
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* LOGIC CARDS */}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <h3 className="mt-5 font-semibold text-slate-900">
            Flexible discount control
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Each discount can target
            a company, a specific
            plan or remain available
            across the platform.
            You control the
            percentage or fixed
            amount, duration,
            billing cycle and
            redemption limit.
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-500">
            Discount
            <br />
            + Plan / Company
            <br />
            + Duration
            <br />
            + Usage Limit
            <br />
            + Billing Cycle
            <br />= Controlled Offer
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Users className="h-5 w-5" />
          </div>

          <h3 className="mt-5 font-semibold text-slate-900">
            Customer-specific offers
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Give individual
            companies special pricing
            without changing the
            public plan price.
            Lifetime deals and
            custom durations are
            stored independently
            from the standard
            subscription plans.
          </p>

          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs leading-5 text-blue-700">
            Standard Plan Price →
            Custom Discount →
            Customer&apos;s Final Price
          </div>
        </div>
      </div>

      {/* DISCOUNT MODAL */}

      {showCreate || editDiscount ? (
        <DiscountForm
          companies={companies}
          plans={plans}
          discount={editDiscount}
          action={
            editDiscount
              ? updateDiscount
              : createDiscount
          }
        />
      ) : null}
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
  accent?:
    | "slate"
    | "green"
    | "blue"
    | "amber"
    | "red";
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
    red:
      "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconStyles[accent]}`}
      >
        {icon}
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

function FeatureCard({
  icon,
  title,
  description,
  example,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  example: string;
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
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconStyles[accent]}`}
      >
        {icon}
      </div>

      <h3 className="mt-5 text-sm font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>

      <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
        Example:{" "}
        <span className="font-semibold text-slate-900">
          {example}
        </span>
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
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