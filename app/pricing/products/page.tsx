"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type ProductVariantRow = {
  id: string;
  company_id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  cost_price: number | null;
  selling_price: number | null;
  is_default: boolean;
  is_active: boolean;
  product: {
    name: string;
    brand: string | null;
    category: string | null;
    status: string | null;
  } | null;
};
type PriceList = {
  id: string;
  name: string;
  code: string | null;
  currency: string;
  is_default: boolean;
  is_active: boolean;
};

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

function formatMoney(
  value: number | null | undefined,
  currency: string
) {
  const amount = Number(value ?? 0);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

function getMarginAmount(
  cost: number | null,
  selling: number | null
) {
  return Number(selling ?? 0) - Number(cost ?? 0);
}

function getMarginPercent(
  cost: number | null,
  selling: number | null
) {
  const costValue = Number(cost ?? 0);
  const sellingValue = Number(selling ?? 0);

  if (sellingValue <= 0) {
    return 0;
  }

  return ((sellingValue - costValue) / sellingValue) * 100;
}

function getMarginStatus(marginPercent: number) {
  if (marginPercent < 0) {
    return {
      label: "Loss",
      className:
        "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
    };
  }

  if (marginPercent < 10) {
    return {
      label: "Low margin",
      className:
        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    };
  }

  if (marginPercent < 25) {
    return {
      label: "Healthy",
      className:
        "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    };
  }

  return {
    label: "Strong",
    className:
      "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  };
}

export default function ProductPricingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [company, setCompany] = useState<Company | null>(null);
  const [variants, setVariants] = useState<ProductVariantRow[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = useCallback(
    async (showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
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
            "No company workspace is associated with this account."
          );
        }

        const companyId = membership.company_id;

        const [
          companyResult,
          variantsResult,
          priceListsResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select("id, name, currency")
            .eq("id", companyId)
            .maybeSingle(),

          supabase
            .from("product_variants")
            .select(
              `
                id,
                company_id,
                product_id,
                name,
                sku,
                barcode,
                cost_price,
                selling_price,
                is_default,
                is_active,
                product:products (
                  name,
                  brand,
                  category,
                  status
                )
              `
            )
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("price_lists")
            .select(
              "id, name, code, currency, is_default, is_active"
            )
            .eq("company_id", companyId)
            .order("is_default", {
              ascending: false,
            })
            .order("name", {
              ascending: true,
            }),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (variantsResult.error) {
          throw variantsResult.error;
        }

        if (priceListsResult.error) {
          throw priceListsResult.error;
        }

        setCompany(companyResult.data as Company | null);
        setVariants(
  (variantsResult.data ?? []).map((variant) => ({
    ...variant,
    product: Array.isArray(variant.product)
      ? variant.product[0] ?? null
      : variant.product ?? null,
  })) as ProductVariantRow[]
);
        setPriceLists(
          (priceListsResult.data ?? []) as PriceList[]
        );
      } catch (error) {
        console.error(
          "Failed to load product pricing:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load product pricing."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currency = company?.currency || "USD";

  const filteredVariants = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return variants.filter((variant) => {
      const productName =
        variant.product?.name?.toLowerCase() || "";
      const variantName =
        variant.name?.toLowerCase() || "";
      const sku =
        variant.sku?.toLowerCase() || "";
      const barcode =
        variant.barcode?.toLowerCase() || "";
      const brand =
        variant.product?.brand?.toLowerCase() || "";

      const matchesSearch =
        !query ||
        productName.includes(query) ||
        variantName.includes(query) ||
        sku.includes(query) ||
        barcode.includes(query) ||
        brand.includes(query);

      const marginPercent = getMarginPercent(
        variant.cost_price,
        variant.selling_price
      );

      let matchesStatus = true;

      if (statusFilter === "loss") {
        matchesStatus = marginPercent < 0;
      }

      if (statusFilter === "low") {
        matchesStatus =
          marginPercent >= 0 && marginPercent < 10;
      }

      if (statusFilter === "healthy") {
        matchesStatus =
          marginPercent >= 10 && marginPercent < 25;
      }

      if (statusFilter === "strong") {
        matchesStatus = marginPercent >= 25;
      }

      if (statusFilter === "inactive") {
        matchesStatus = !variant.is_active;
      }

      return matchesSearch && matchesStatus;
    });
  }, [searchValue, statusFilter, variants]);

  const stats = useMemo(() => {
    const activeVariants = variants.filter(
      (variant) => variant.is_active
    );

    const totalCost = activeVariants.reduce(
      (sum, variant) =>
        sum + Number(variant.cost_price ?? 0),
      0
    );

    const totalSelling = activeVariants.reduce(
      (sum, variant) =>
        sum + Number(variant.selling_price ?? 0),
      0
    );

    const totalMargin = totalSelling - totalCost;

    const averageMargin =
      totalSelling > 0
        ? (totalMargin / totalSelling) * 100
        : 0;

    const lowMarginCount = activeVariants.filter(
      (variant) =>
        getMarginPercent(
          variant.cost_price,
          variant.selling_price
        ) < 10
    ).length;

    const lossCount = activeVariants.filter(
      (variant) =>
        getMarginPercent(
          variant.cost_price,
          variant.selling_price
        ) < 0
    ).length;

    return {
      products: activeVariants.length,
      averageMargin,
      lowMarginCount,
      lossCount,
    };
  }, [variants]);

  async function savePrice(
    variant: ProductVariantRow
  ) {
    if (savingId) {
      return;
    }

    const parsedPrice = Number(editingPrice);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setErrorMessage(
        "Enter a valid selling price greater than or equal to 0."
      );
      return;
    }

    const oldPrice = Number(
      variant.selling_price ?? 0
    );

    if (parsedPrice === oldPrice) {
      setEditingId(null);
      setEditingPrice("");
      return;
    }

    try {
      setSavingId(variant.id);
      setErrorMessage("");

      const { data: userResult } =
        await supabase.auth.getUser();

      const user = userResult.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { error: updateError } = await supabase
        .from("product_variants")
        .update({
          selling_price: parsedPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", variant.id)
        .eq("company_id", variant.company_id);

      if (updateError) {
        throw updateError;
      }

      const retailPriceList =
        priceLists.find(
          (priceList) =>
            priceList.code === "RETAIL"
        ) ||
        priceLists.find(
          (priceList) =>
            priceList.is_default
        );

      if (retailPriceList) {
        const { error: historyError } =
          await supabase.from("price_history").insert({
            company_id: variant.company_id,
            variant_id: variant.id,
            price_list_id: retailPriceList.id,
            old_price: oldPrice,
            new_price: parsedPrice,
            change_type: "manual",
            reason: "Updated from Product Pricing",
            changed_by: user.id,
          });

        if (historyError) {
          console.error(
            "Price updated but history could not be recorded:",
            historyError
          );
        }

        const { error: listItemError } =
          await supabase
            .from("price_list_items")
            .upsert(
              {
                company_id: variant.company_id,
                price_list_id:
                  retailPriceList.id,
                variant_id: variant.id,
                price: parsedPrice,
                min_quantity: 1,
                effective_from:
                  new Date().toISOString(),
              },
              {
                onConflict:
                  "price_list_id,variant_id,min_quantity",
              }
            );

        if (listItemError) {
          console.error(
            "Base price updated but retail price list could not be synced:",
            listItemError
          );
        }
      }

      setVariants((current) =>
        current.map((item) =>
          item.id === variant.id
            ? {
                ...item,
                selling_price: parsedPrice,
              }
            : item
        )
      );

      setEditingId(null);
      setEditingPrice("");
    } catch (error) {
      console.error(
        "Failed to save product price:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the price."
      );
    } finally {
      setSavingId(null);
    }
  }

  function startEditing(
    variant: ProductVariantRow
  ) {
    setEditingId(variant.id);
    setEditingPrice(
      Number(variant.selling_price ?? 0).toFixed(2)
    );
    setErrorMessage("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingPrice("");
  }

  return (
    <AppShell
      title="Product Pricing"
      description="Manage selling prices, margins, and pricing health across your products."
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Product Pricing
              </h1>

              {company?.name ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {company.name}
                </span>
              ) : null}
            </div>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Review product costs, selling prices, and
              margins. Base pricing is synchronized with
              your product variants.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void loadData(true)
              }
              disabled={refreshing || loading}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/pricing/price-lists")
              }
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Price Lists
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/pricing/history")
              }
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Price History
            </button>
          </div>
        </div>

        {/* Error */}
        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Active variants
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {loading ? "—" : stats.products}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Products currently available for pricing
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Average margin
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {loading
                ? "—"
                : `${stats.averageMargin.toFixed(1)}%`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Margin based on selling price
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Low-margin items
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {loading ? "—" : stats.lowMarginCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Below 10% margin
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Loss-making items
            </p>
            <p className="mt-2 text-2xl font-semibold text-red-600">
              {loading ? "—" : stats.lossCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Selling price below cost
            </p>
          </div>
        </div>

        {/* Pricing navigation */}
        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() =>
              router.push("/pricing/products")
            }
            className="rounded-xl border border-slate-900 bg-slate-900 p-4 text-left text-white shadow-sm"
          >
            <p className="text-sm font-semibold">
              Product Pricing
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Base prices and margin protection.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push("/pricing/price-lists")
            }
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-sm font-semibold text-slate-900">
              Price Lists
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Retail, wholesale, B2B, and custom pricing.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push("/pricing/history")
            }
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-sm font-semibold text-slate-900">
              Price History
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Track every recorded pricing change.
            </p>
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <label
                htmlFor="pricing-search"
                className="sr-only"
              >
                Search products
              </label>

              <input
                id="pricing-search"
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(event.target.value)
                }
                placeholder="Search product, variant, SKU, barcode, or brand..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ["all", "All"],
                ["strong", "Strong"],
                ["healthy", "Healthy"],
                ["low", "Low margin"],
                ["loss", "Loss"],
                ["inactive", "Inactive"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setStatusFilter(value)
                  }
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                    statusFilter === value
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Price list summary */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Active price lists
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Pricing structures available to this company.
              </p>
            </div>

            <span className="text-xs font-medium text-slate-500">
              {priceLists.filter(
                (item) => item.is_active
              ).length}{" "}
              active
            </span>
          </div>

          <div className="flex flex-wrap gap-2 px-5 py-4">
            {priceLists.length === 0 ? (
              <span className="text-sm text-slate-500">
                No price lists have been configured.
              </span>
            ) : (
              priceLists.map((priceList) => (
                <button
                  key={priceList.id}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/pricing/price-lists/${priceList.id}`
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="font-semibold text-slate-800">
                    {priceList.name}
                  </span>

                  {priceList.is_default ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Default
                    </span>
                  ) : null}

                  <span className="text-slate-400">
                    {priceList.currency}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Product pricing table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Product pricing
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {loading
                  ? "Loading pricing..."
                  : `${filteredVariants.length} of ${variants.length} variants`}
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Currency: {currency}
            </span>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3, 4, 5].map(
                (item) => (
                  <div
                    key={item}
                    className="h-14 animate-pulse rounded-lg bg-slate-100"
                  />
                )
              )}
            </div>
          ) : filteredVariants.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                $
              </div>

              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                No pricing records found
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                {variants.length === 0
                  ? "Create products and variants first. Their base cost and selling prices will appear here."
                  : "Try changing your search or margin filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Product
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      SKU
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cost
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Selling price
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Margin
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Margin %
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredVariants.map(
                    (variant) => {
                      const marginAmount =
                        getMarginAmount(
                          variant.cost_price,
                          variant.selling_price
                        );

                      const marginPercent =
                        getMarginPercent(
                          variant.cost_price,
                          variant.selling_price
                        );

                      const marginStatus =
                        getMarginStatus(
                          marginPercent
                        );

                      const isEditing =
                        editingId === variant.id;

                      const isSaving =
                        savingId === variant.id;

                      return (
                        <tr
                          key={variant.id}
                          className="transition hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-4">
                            <div className="min-w-[240px]">
                              <div className="font-medium text-slate-900">
                                {variant.product
                                  ?.name ||
                                  "Unnamed product"}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>
                                  {variant.name}
                                </span>

                                {variant.product
                                  ?.brand ? (
                                  <>
                                    <span>
                                      •
                                    </span>
                                    <span>
                                      {
                                        variant
                                          .product
                                          .brand
                                      }
                                    </span>
                                  </>
                                ) : null}

                                {!variant.is_active ? (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                    Inactive
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span className="font-mono text-xs text-slate-600">
                              {variant.sku ||
                                "—"}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right">
                            <span className="text-sm font-medium text-slate-800">
                              {formatMoney(
                                variant.cost_price,
                                currency
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editingPrice}
                                  onChange={(
                                    event
                                  ) =>
                                    setEditingPrice(
                                      event.target
                                        .value
                                    )
                                  }
                                  onKeyDown={(
                                    event
                                  ) => {
                                    if (
                                      event.key ===
                                      "Enter"
                                    ) {
                                      void savePrice(
                                        variant
                                      );
                                    }

                                    if (
                                      event.key ===
                                      "Escape"
                                    ) {
                                      cancelEditing();
                                    }
                                  }}
                                  autoFocus
                                  className="h-9 w-28 rounded-lg border border-slate-300 px-2 text-right text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                                />

                                <button
                                  type="button"
                                  disabled={
                                    isSaving
                                  }
                                  onClick={() =>
                                    void savePrice(
                                      variant
                                    )
                                  }
                                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                                >
                                  {isSaving
                                    ? "..."
                                    : "Save"}
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    isSaving
                                  }
                                  onClick={
                                    cancelEditing
                                  }
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm font-semibold text-slate-900">
                                {formatMoney(
                                  variant.selling_price,
                                  currency
                                )}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4 text-right">
                            <span
                              className={`text-sm font-semibold ${
                                marginAmount < 0
                                  ? "text-red-600"
                                  : "text-slate-900"
                              }`}
                            >
                              {formatMoney(
                                marginAmount,
                                currency
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right">
                            <span
                              className={`text-sm font-semibold ${
                                marginPercent < 0
                                  ? "text-red-600"
                                  : marginPercent <
                                      10
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {marginPercent.toFixed(
                                1
                              )}
                              %
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${marginStatus.className}`}
                            >
                              {
                                marginStatus.label
                              }
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            {!isEditing ? (
                              <button
                                type="button"
                                onClick={() =>
                                  startEditing(
                                    variant
                                  )
                                }
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Edit price
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pricing notes */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 shadow-sm">
              i
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Margin protection
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Margin % is calculated as{" "}
                <span className="font-medium text-slate-700">
                  (selling price − cost) ÷ selling price
                </span>
                . Changes made here update the variant's
                base selling price and are recorded in the
                pricing history when possible.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}