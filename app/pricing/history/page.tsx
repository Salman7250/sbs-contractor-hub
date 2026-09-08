"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Filter,
  Package,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type PriceHistoryRow = {
  id: string;
  company_id: string;
  variant_id: string;
  price_list_id: string | null;
  old_price: number | null;
  new_price: number;
  change_type: string;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
  variant: {
    name: string;
    sku: string | null;
    product: {
      name: string;
      brand: string | null;
    } | null;
  } | null;
  price_list: {
    name: string;
    code: string | null;
    currency: string;
  } | null;
  changed_profile: {
    full_name: string | null;
  } | null;
};

type HistoryFilter = "all" | "increase" | "decrease" | "created";

const PAGE_SIZE = 20;

function formatCurrency(
  amount: number | null | undefined,
  currency = "USD"
) {
  if (amount === null || amount === undefined) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatShortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getChangeDirection(row: PriceHistoryRow) {
  if (row.old_price === null || row.old_price === undefined) {
    return "created";
  }

  if (row.new_price > row.old_price) {
    return "increase";
  }

  if (row.new_price < row.old_price) {
    return "decrease";
  }

  return "same";
}

function getChangePercent(row: PriceHistoryRow) {
  if (
    row.old_price === null ||
    row.old_price === undefined ||
    row.old_price === 0
  ) {
    return null;
  }

  return ((row.new_price - row.old_price) / row.old_price) * 100;
}

function getInitials(name: string | null | undefined) {
  if (!name) {
    return "—";
  }

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${
    parts[parts.length - 1][0] ?? ""
  }`.toUpperCase();
}

export default function PricingHistoryPage() {
  const supabase = useMemo(() => createClient(), []);

  const [history, setHistory] = useState<PriceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [priceListFilter, setPriceListFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const [page, setPage] = useState(1);

  const loadHistory = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error(
            "You must be signed in to view pricing history."
          );
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership was found for your account."
          );
        }

        /*
         * IMPORTANT:
         *
         * price_history.changed_by references auth.users(id),
         * not profiles(id) through a foreign key.
         *
         * Therefore we load price history first and then fetch
         * profiles separately.
         */
        const { data, error } = await supabase
          .from("price_history")
          .select(
            `
              id,
              company_id,
              variant_id,
              price_list_id,
              old_price,
              new_price,
              change_type,
              reason,
              changed_by,
              created_at,
              variant:product_variants (
                name,
                sku,
                product:products (
                  name,
                  brand
                )
              ),
              price_list:price_lists (
                name,
                code,
                currency
              )
            `
          )
          .eq("company_id", membership.company_id)
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        const rawRows = data ?? [];

        /*
         * Normalize Supabase relationship results.
         */
        const normalizedRows = rawRows.map((row) => {
          const rawVariant = row.variant;
          const rawPriceList = row.price_list;

          const variant = Array.isArray(rawVariant)
            ? rawVariant[0] ?? null
            : rawVariant ?? null;

          const priceList = Array.isArray(rawPriceList)
            ? rawPriceList[0] ?? null
            : rawPriceList ?? null;

          const rawProduct = variant?.product;

          return {
            ...row,
            variant: variant
              ? {
                  ...variant,
                  product: Array.isArray(rawProduct)
                    ? rawProduct[0] ?? null
                    : rawProduct ?? null,
                }
              : null,
            price_list: priceList,
            changed_profile: null,
          };
        }) as PriceHistoryRow[];

        /*
         * Collect all users who changed pricing.
         */
        const changedByIds = Array.from(
          new Set(
            normalizedRows
              .map((row) => row.changed_by)
              .filter(
                (value): value is string => Boolean(value)
              )
          )
        );

        /*
         * Load profiles separately.
         *
         * profiles.id corresponds to auth.users.id.
         */
        let profilesById = new Map<
          string,
          { full_name: string | null }
        >();

        if (changedByIds.length > 0) {
          const { data: profiles, error: profilesError } =
            await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", changedByIds);

          if (profilesError) {
            console.warn(
              "Unable to load pricing history profiles:",
              profilesError
            );
          } else {
            profilesById = new Map(
              (profiles ?? []).map((profile) => [
                profile.id,
                {
                  full_name: profile.full_name,
                },
              ])
            );
          }
        }

        /*
         * Attach profile information to each history record.
         */
        const finalRows = normalizedRows.map((row) => ({
          ...row,
          changed_profile: row.changed_by
            ? profilesById.get(row.changed_by) ?? null
            : null,
        }));

        setHistory(finalRows);
        setPage(1);
      } catch (error) {
        console.error(
          "Failed to load pricing history:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load pricing history."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
  queueMicrotask(() => {
    void loadHistory();
  });
}, [loadHistory]);

  const priceLists = useMemo(() => {
    const map = new Map<string, string>();

    history.forEach((row) => {
      if (row.price_list_id && row.price_list?.name) {
        map.set(row.price_list_id, row.price_list.name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [history]);

  const stats = useMemo(() => {
    let increases = 0;
    let decreases = 0;
    let created = 0;

    history.forEach((row) => {
      const direction = getChangeDirection(row);

      if (direction === "increase") {
        increases += 1;
      } else if (direction === "decrease") {
        decreases += 1;
      } else if (direction === "created") {
        created += 1;
      }
    });

    return {
      total: history.length,
      increases,
      decreases,
      created,
    };
  }, [history]);

  const filteredHistory = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return history.filter((row) => {
      const direction = getChangeDirection(row);

      if (filter !== "all") {
        if (
          filter === "increase" &&
          direction !== "increase"
        ) {
          return false;
        }

        if (
          filter === "decrease" &&
          direction !== "decrease"
        ) {
          return false;
        }

        if (
          filter === "created" &&
          direction !== "created"
        ) {
          return false;
        }
      }

      if (
        priceListFilter !== "all" &&
        row.price_list_id !== priceListFilter
      ) {
        return false;
      }

      if (dateFilter !== "all") {
        const createdAt = new Date(row.created_at);
        const now = new Date();

        if (dateFilter === "today") {
          const start = new Date(now);
          start.setHours(0, 0, 0, 0);

          if (createdAt < start) {
            return false;
          }
        }

        if (dateFilter === "7days") {
          const start = new Date(now);
          start.setDate(start.getDate() - 7);

          if (createdAt < start) {
            return false;
          }
        }

        if (dateFilter === "30days") {
          const start = new Date(now);
          start.setDate(start.getDate() - 30);

          if (createdAt < start) {
            return false;
          }
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        row.variant?.name,
        row.variant?.sku,
        row.variant?.product?.name,
        row.variant?.product?.brand,
        row.price_list?.name,
        row.price_list?.code,
        row.change_type,
        row.reason,
        row.changed_profile?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [
    history,
    search,
    filter,
    priceListFilter,
    dateFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredHistory.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredHistory.slice(
      start,
      start + PAGE_SIZE
    );
  }, [filteredHistory, currentPage]);

  

  const clearFilters = () => {
    setSearch("");
    setFilter("all");
    setPriceListFilter("all");
    setDateFilter("all");
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    filter !== "all" ||
    priceListFilter !== "all" ||
    dateFilter !== "all";

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                  <Link
                    href="/pricing/products"
                    className="transition hover:text-slate-900"
                  >
                    Pricing
                  </Link>

                  <ArrowRight className="h-4 w-4" />

                  <span className="font-medium text-slate-900">
                    Price History
                  </span>
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Price History
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Track every pricing change across your
                  products and price lists.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/pricing/products"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Package className="h-4 w-4" />
                  Product Pricing
                </Link>

                <Link
                  href="/pricing/price-lists"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <CircleDollarSign className="h-4 w-4" />
                  Price Lists
                </Link>

                <button
                  type="button"
                  onClick={() => void loadHistory(true)}
                  disabled={refreshing}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      refreshing ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    Unable to load price history
                  </p>

                  <p className="mt-1">
                    {errorMessage}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadHistory(true)}
                  className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Total Changes
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {loading ? "—" : stats.total}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                  <Clock3 className="h-5 w-5 text-slate-700" />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                All recorded pricing events
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Price Increases
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {loading ? "—" : stats.increases}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                  <ArrowRight className="h-5 w-5 -rotate-45 text-emerald-600" />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Prices moved upward
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Price Decreases
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {loading ? "—" : stats.decreases}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                  <ArrowRight className="h-5 w-5 rotate-45 text-amber-600" />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Prices moved downward
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    New Prices
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {loading ? "—" : stats.created}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <CircleDollarSign className="h-5 w-5 text-blue-600" />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Initial pricing records
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-500" />

                  <h2 className="text-sm font-semibold text-slate-900">
                    History Filters
                  </h2>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-950"
                  >
                    <X className="h-4 w-4" />
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                {/* Search */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Search
                  </label>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Product, SKU, price list..."
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>
                </div>

                {/* Change Type */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Change Type
                  </label>

                  <select
                    value={filter}
                    onChange={(event) => {
                      setFilter(
                        event.target.value as HistoryFilter
                      );
                      setPage(1);
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="all">
                      All Changes
                    </option>
                    <option value="increase">
                      Price Increases
                    </option>
                    <option value="decrease">
                      Price Decreases
                    </option>
                    <option value="created">
                      New Prices
                    </option>
                  </select>
                </div>

                {/* Price List */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Price List
                  </label>

                  <select
                    value={priceListFilter}
                    onChange={(event) => {
                      setPriceListFilter(event.target.value);
                      setPage(1);
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="all">
                      All Price Lists
                    </option>

                    {priceLists.map((priceList) => (
                      <option
                        key={priceList.id}
                        value={priceList.id}
                      >
                        {priceList.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </label>

                  <select
                    value={dateFilter}
                    onChange={(event) => {
                      setDateFilter(event.target.value);
                      setPage(1);
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="all">
                      All Time
                    </option>
                    <option value="today">
                      Today
                    </option>
                    <option value="7days">
                      Last 7 Days
                    </option>
                    <option value="30days">
                      Last 30 Days
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Pricing Activity
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {loading
                    ? "Loading pricing history..."
                    : `${filteredHistory.length} ${
                        filteredHistory.length === 1
                          ? "record"
                          : "records"
                      } found`}
                </p>
              </div>

              {!loading &&
                filteredHistory.length > 0 && (
                  <div className="text-xs text-slate-400">
                    Showing{" "}
                    {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(
                      currentPage * PAGE_SIZE,
                      filteredHistory.length
                    )}{" "}
                    of {filteredHistory.length}
                  </div>
                )}
            </div>

            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Product
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Price List
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Previous
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      New Price
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Change
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Changed By
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    Array.from({ length: 6 }).map(
                      (_, index) => (
                        <tr key={index}>
                          <td
                            className="px-5 py-5"
                            colSpan={7}
                          >
                            <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                          </td>
                        </tr>
                      )
                    )
                  ) : paginatedHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-16 text-center"
                      >
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                          <Clock3 className="h-5 w-5 text-slate-500" />
                        </div>

                        <h3 className="mt-4 text-sm font-semibold text-slate-900">
                          No pricing history found
                        </h3>

                        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                          {hasActiveFilters
                            ? "Try adjusting or clearing your filters."
                            : "Price changes will appear here once pricing activity is recorded."}
                        </p>

                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-4 inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Clear filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedHistory.map((row) => {
                      const direction =
                        getChangeDirection(row);

                      const changePercent =
                        getChangePercent(row);

                      const currency =
                        row.price_list?.currency ?? "USD";

                      return (
                        <tr
                          key={row.id}
                          className="transition hover:bg-slate-50"
                        >
                          {/* Product */}
                          <td className="px-5 py-4">
                            <div className="min-w-[220px]">
                              <p className="font-medium text-slate-900">
                                {row.variant?.product?.name ??
                                  row.variant?.name ??
                                  "Unknown product"}
                              </p>

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                {row.variant?.name &&
                                  row.variant.product?.name &&
                                  row.variant.name !==
                                    row.variant.product.name && (
                                    <span>
                                      {row.variant.name}
                                    </span>
                                  )}

                                {row.variant?.sku && (
                                  <>
                                    <span className="text-slate-300">
                                      •
                                    </span>

                                    <span className="font-mono">
                                      SKU: {row.variant.sku}
                                    </span>
                                  </>
                                )}
                              </div>

                              {row.variant?.product?.brand && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {
                                    row.variant.product
                                      .brand
                                  }
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Price List */}
                          <td className="px-5 py-4">
                            {row.price_list ? (
                              <div>
                                <p className="text-sm font-medium text-slate-800">
                                  {row.price_list.name}
                                </p>

                                {row.price_list.code && (
                                  <p className="mt-1 font-mono text-xs text-slate-400">
                                    {row.price_list.code}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">
                                Base pricing
                              </span>
                            )}
                          </td>

                          {/* Previous */}
                          <td className="px-5 py-4 text-right">
                            <span className="text-sm text-slate-500">
                              {formatCurrency(
                                row.old_price,
                                currency
                              )}
                            </span>
                          </td>

                          {/* New */}
                          <td className="px-5 py-4 text-right">
                            <span className="text-sm font-semibold text-slate-900">
                              {formatCurrency(
                                row.new_price,
                                currency
                              )}
                            </span>
                          </td>

                          {/* Change */}
                          <td className="px-5 py-4">
                            <div className="flex flex-col items-start gap-1">
                              {direction ===
                                "increase" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  <ArrowRight className="h-3 w-3 -rotate-45" />
                                  Increase
                                </span>
                              )}

                              {direction ===
                                "decrease" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                  <ArrowRight className="h-3 w-3 rotate-45" />
                                  Decrease
                                </span>
                              )}

                              {direction ===
                                "created" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                  New price
                                </span>
                              )}

                              {direction === "same" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                  No change
                                </span>
                              )}

                              {changePercent !== null && (
                                <span className="text-xs text-slate-400">
                                  {changePercent > 0
                                    ? "+"
                                    : ""}
                                  {changePercent.toFixed(
                                    1
                                  )}
                                  %
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Changed By */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                {getInitials(
                                  row.changed_profile
                                    ?.full_name
                                )}
                              </div>

                              <div>
                                <p className="text-sm font-medium text-slate-800">
                                  {row.changed_profile
                                    ?.full_name ??
                                    "System"}
                                </p>

                                {row.reason && (
                                  <p
                                    className="mt-0.5 max-w-[180px] truncate text-xs text-slate-400"
                                    title={row.reason}
                                  >
                                    {row.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Date */}
                          <td className="px-5 py-4">
                            <div className="min-w-[140px]">
                              <p className="text-sm text-slate-700">
                                {formatShortDate(
                                  row.created_at
                                )}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {new Intl.DateTimeFormat(
                                  "en-US",
                                  {
                                    timeStyle: "short",
                                  }
                                ).format(
                                  new Date(row.created_at)
                                )}
                              </p>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="divide-y divide-slate-200 md:hidden">
              {loading ? (
                Array.from({ length: 5 }).map(
                  (_, index) => (
                    <div key={index} className="p-4">
                      <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
                    </div>
                  )
                )
              ) : paginatedHistory.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Clock3 className="h-5 w-5 text-slate-500" />
                  </div>

                  <h3 className="mt-4 text-sm font-semibold text-slate-900">
                    No pricing history found
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {hasActiveFilters
                      ? "Try adjusting or clearing your filters."
                      : "Pricing activity will appear here."}
                  </p>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-4 inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                paginatedHistory.map((row) => {
                  const direction =
                    getChangeDirection(row);

                  const changePercent =
                    getChangePercent(row);

                  const currency =
                    row.price_list?.currency ?? "USD";

                  return (
                    <div key={row.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {row.variant?.product?.name ??
                              row.variant?.name ??
                              "Unknown product"}
                          </p>

                          <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
                            {row.variant?.name &&
                              row.variant.product?.name &&
                              row.variant.name !==
                                row.variant.product.name && (
                                <span>
                                  {row.variant.name}
                                </span>
                              )}

                            {row.variant?.sku && (
                              <span className="font-mono">
                                SKU: {row.variant.sku}
                              </span>
                            )}
                          </div>
                        </div>

                        {direction ===
                          "increase" && (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                            Increase
                          </span>
                        )}

                        {direction ===
                          "decrease" && (
                          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                            Decrease
                          </span>
                        )}

                        {direction === "created" && (
                          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                            New
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Previous
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {formatCurrency(
                              row.old_price,
                              currency
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            New Price
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              row.new_price,
                              currency
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {row.price_list && (
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-slate-400">
                              Price List
                            </span>

                            <span className="font-medium text-slate-700">
                              {row.price_list.name}
                            </span>
                          </div>
                        )}

                        {changePercent !== null && (
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-slate-400">
                              Change
                            </span>

                            <span
                              className={
                                changePercent > 0
                                  ? "font-medium text-emerald-600"
                                  : "font-medium text-amber-600"
                              }
                            >
                              {changePercent > 0
                                ? "+"
                                : ""}
                              {changePercent.toFixed(1)}
                              %
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-400">
                            Changed By
                          </span>

                          <span className="font-medium text-slate-700">
                            {row.changed_profile
                              ?.full_name ??
                              "System"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-400">
                            Date
                          </span>

                          <span className="text-slate-600">
                            {formatDateTime(
                              row.created_at
                            )}
                          </span>
                        </div>

                        {row.reason && (
                          <div className="border-t border-slate-200 pt-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Reason
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {row.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination */}
            {!loading &&
              filteredHistory.length > 0 &&
              totalPages > 1 && (
                <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    Page {currentPage} of {totalPages}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPage((current) =>
                          Math.max(1, current - 1)
                        )
                      }
                      disabled={currentPage === 1}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Previous
                    </button>

                    <div className="hidden items-center gap-1 sm:flex">
                      {Array.from(
                        {
                          length: totalPages,
                        },
                        (_, index) => index + 1
                      )
                        .filter((pageNumber) => {
                          if (totalPages <= 7) {
                            return true;
                          }

                          if (
                            pageNumber === 1 ||
                            pageNumber === totalPages
                          ) {
                            return true;
                          }

                          return (
                            Math.abs(
                              pageNumber - currentPage
                            ) <= 1
                          );
                        })
                        .map((pageNumber) => (
                          <button
                            key={pageNumber}
                            type="button"
                            onClick={() =>
                              setPage(pageNumber)
                            }
                            className={`h-9 min-w-9 rounded-lg px-3 text-sm font-medium transition ${
                              pageNumber === currentPage
                                ? "bg-slate-950 text-white"
                                : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {pageNumber}
                          </button>
                        ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setPage((current) =>
                          Math.min(
                            totalPages,
                            current + 1
                          )
                        )
                      }
                      disabled={
                        currentPage === totalPages
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
          </div>

          {/* Footer note */}
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />

            <div>
              <p className="text-sm font-medium text-slate-700">
                Pricing audit trail
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Every recorded pricing change is preserved
                here so your team can review historical prices,
                identify when changes happened, and see which
                user made the change.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}