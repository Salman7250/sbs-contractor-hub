"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Save,
  X,
} from "lucide-react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type PriceList = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  description: string | null;
  currency: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ProductVariant = {
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

type PriceListItem = {
  id: string;
  price_list_id: string;
  variant_id: string;
  price: number;
  min_quantity: number;
  max_quantity: number | null;
  effective_from: string | null;
  effective_to: string | null;
};

type EditablePrice = {
  price: string;
  minQuantity: string;
  maxQuantity: string;
};

function formatCurrency(
  value: number | null | undefined,
  currency: string
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function calculateMargin(
  cost: number | null | undefined,
  price: number | null | undefined
) {
  const costValue = Number(cost ?? 0);
  const priceValue = Number(price ?? 0);

  if (priceValue <= 0) {
    return costValue > 0 ? -100 : 0;
  }

  return ((priceValue - costValue) / priceValue) * 100;
}

export default function PriceListDetailPage() {
  const params = useParams();
  const priceListId = params.priceListId as string;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");

  const [priceList, setPriceList] =
    useState<PriceList | null>(null);

  const [variants, setVariants] = useState<ProductVariant[]>(
    []
  );

  const [priceItems, setPriceItems] = useState<
    PriceListItem[]
  >([]);

  const [editedPrices, setEditedPrices] = useState<
    Record<string, EditablePrice>
  >({});

  const [search, setSearch] = useState("");
  const [showUnpricedOnly, setShowUnpricedOnly] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadPage = useCallback(
    async (showRefresh = false) => {
      try {
        setErrorMessage("");
        setSuccessMessage("");

        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error("You are not signed in.");
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

        const currentCompanyId = membership.company_id;

        setCompanyId(currentCompanyId);

        const [
          companyResult,
          priceListResult,
          variantsResult,
          itemsResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select("name")
            .eq("id", currentCompanyId)
            .maybeSingle(),

          supabase
            .from("price_lists")
            .select(
              `
                id,
                company_id,
                name,
                code,
                description,
                currency,
                is_default,
                is_active,
                created_at,
                updated_at
              `
            )
            .eq("id", priceListId)
            .eq("company_id", currentCompanyId)
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
            .eq("company_id", currentCompanyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("price_list_items")
            .select(
              `
                id,
                price_list_id,
                variant_id,
                price,
                min_quantity,
                max_quantity,
                effective_from,
                effective_to
              `
            )
            .eq("company_id", currentCompanyId)
            .eq("price_list_id", priceListId),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (priceListResult.error) {
          throw priceListResult.error;
        }

        if (variantsResult.error) {
          throw variantsResult.error;
        }

        if (itemsResult.error) {
          throw itemsResult.error;
        }

        if (!priceListResult.data) {
          throw new Error("Price list not found.");
        }

        const normalizedVariants = (
          variantsResult.data ?? []
        ).map((variant) => ({
          ...variant,
          product: Array.isArray(variant.product)
            ? variant.product[0] ?? null
            : variant.product ?? null,
        })) as ProductVariant[];

        const items = (itemsResult.data ??
          []) as PriceListItem[];

        setCompanyName(companyResult.data?.name ?? "");
        setPriceList(priceListResult.data as PriceList);
        setVariants(normalizedVariants);
        setPriceItems(items);

        const existingItemMap: Record<
          string,
          EditablePrice
        > = {};

        for (const item of items) {
          existingItemMap[item.variant_id] = {
            price: Number(item.price ?? 0).toFixed(2),
            minQuantity: Number(
              item.min_quantity ?? 1
            ).toString(),
            maxQuantity:
              item.max_quantity === null
                ? ""
                : Number(item.max_quantity).toString(),
          };
        }

        /*
         * For variants that do not yet exist in this price list,
         * use the base selling price as the initial suggested
         * price. This makes it easy to create a complete list.
         */
        for (const variant of normalizedVariants) {
          if (!existingItemMap[variant.id]) {
            existingItemMap[variant.id] = {
              price:
                variant.selling_price === null
                  ? ""
                  : Number(
                      variant.selling_price
                    ).toFixed(2),
              minQuantity: "1",
              maxQuantity: "",
            };
          }
        }

        setEditedPrices(existingItemMap);
      } catch (error) {
        console.error(
          "Price list detail load error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load price list."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [priceListId, supabase]
  );

  useEffect(() => {
    if (priceListId) {
      void loadPage();
    }
  }, [loadPage, priceListId]);

  const itemMap = useMemo(() => {
    const map: Record<string, PriceListItem> = {};

    for (const item of priceItems) {
      /*
       * V1 currently uses one quantity tier per variant
       * on this editor: min_quantity = 1.
       *
       * Future versions can support multiple quantity tiers.
       */
      if (!map[item.variant_id]) {
        map[item.variant_id] = item;
      }
    }

    return map;
  }, [priceItems]);

  const filteredVariants = useMemo(() => {
    const query = search.trim().toLowerCase();

    return variants.filter((variant) => {
      const productName = variant.product?.name ?? "";
      const brand = variant.product?.brand ?? "";
      const category = variant.product?.category ?? "";
      const variantName = variant.name ?? "";
      const sku = variant.sku ?? "";
      const barcode = variant.barcode ?? "";

      const matchesSearch =
        !query ||
        productName.toLowerCase().includes(query) ||
        variantName.toLowerCase().includes(query) ||
        brand.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query) ||
        sku.toLowerCase().includes(query) ||
        barcode.toLowerCase().includes(query);

      const existingItem = itemMap[variant.id];

      const currentValue =
        editedPrices[variant.id]?.price ?? "";

      const hasPrice =
        currentValue.trim() !== "" &&
        Number(currentValue) > 0;

      const matchesUnpriced =
        !showUnpricedOnly || !hasPrice;

      /*
       * Inactive variants remain visible because old price-list
       * records may still need to be maintained.
       */
      void existingItem;

      return matchesSearch && matchesUnpriced;
    });
  }, [
    variants,
    search,
    showUnpricedOnly,
    editedPrices,
    itemMap,
  ]);

  const stats = useMemo(() => {
    let priced = 0;
    let unpriced = 0;
    let belowCost = 0;
    let averageMarginTotal = 0;
    let averageMarginCount = 0;

    for (const variant of variants) {
      const price = Number(
        editedPrices[variant.id]?.price ?? ""
      );

      if (!Number.isFinite(price) || price <= 0) {
        unpriced += 1;
        continue;
      }

      priced += 1;

      const cost = Number(variant.cost_price ?? 0);

      if (price < cost) {
        belowCost += 1;
      }

      averageMarginTotal += calculateMargin(
        cost,
        price
      );

      averageMarginCount += 1;
    }

    return {
      total: variants.length,
      priced,
      unpriced,
      belowCost,
      averageMargin:
        averageMarginCount > 0
          ? averageMarginTotal / averageMarginCount
          : 0,
    };
  }, [variants, editedPrices]);

  function updateEditedPrice(
    variantId: string,
    field: keyof EditablePrice,
    value: string
  ) {
    setEditedPrices((current) => ({
      ...current,
      [variantId]: {
        ...(current[variantId] ?? {
          price: "",
          minQuantity: "1",
          maxQuantity: "",
        }),
        [field]: value,
      },
    }));
  }

  function resetVariantPrice(variant: ProductVariant) {
    const existingItem = itemMap[variant.id];

    setEditedPrices((current) => ({
      ...current,
      [variant.id]: {
        price: existingItem
          ? Number(existingItem.price).toFixed(2)
          : variant.selling_price === null
            ? ""
            : Number(
                variant.selling_price
              ).toFixed(2),
        minQuantity: existingItem
          ? Number(existingItem.min_quantity).toString()
          : "1",
        maxQuantity: existingItem?.max_quantity
          ? Number(existingItem.max_quantity).toString()
          : "",
      },
    }));
  }

  async function saveAllPrices() {
    if (!companyId || !priceList) {
      setErrorMessage(
        "Price list or company could not be identified."
      );
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const rowsToUpsert: Array<{
        company_id: string;
        price_list_id: string;
        variant_id: string;
        price: number;
        min_quantity: number;
        max_quantity: number | null;
        effective_from: string;
        updated_at: string;
      }> = [];

      const now = new Date().toISOString();

      for (const variant of variants) {
        const edited = editedPrices[variant.id];

        if (!edited) {
          continue;
        }

        const priceText = edited.price.trim();

        /*
         * Empty price means "not configured" and therefore
         * should not create a price-list row.
         */
        if (!priceText) {
          continue;
        }

        const price = Number(priceText);
        const minQuantity = Number(
          edited.minQuantity || "1"
        );

        const maxQuantity = edited.maxQuantity.trim()
          ? Number(edited.maxQuantity)
          : null;

        if (!Number.isFinite(price) || price < 0) {
          throw new Error(
            `Invalid price for ${
              variant.product?.name ?? variant.name
            }.`
          );
        }

        if (
          !Number.isFinite(minQuantity) ||
          minQuantity <= 0
        ) {
          throw new Error(
            `Invalid minimum quantity for ${
              variant.product?.name ?? variant.name
            }.`
          );
        }

        if (
          maxQuantity !== null &&
          (!Number.isFinite(maxQuantity) ||
            maxQuantity < minQuantity)
        ) {
          throw new Error(
            `Maximum quantity must be greater than or equal to minimum quantity for ${
              variant.product?.name ?? variant.name
            }.`
          );
        }

        rowsToUpsert.push({
          company_id: companyId,
          price_list_id: priceList.id,
          variant_id: variant.id,
          price,
          min_quantity: minQuantity,
          max_quantity: maxQuantity,
          effective_from: now,
          updated_at: now,
        });
      }

      if (rowsToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from("price_list_items")
          .upsert(rowsToUpsert, {
            onConflict:
              "price_list_id,variant_id,min_quantity",
          });

        if (upsertError) {
          throw upsertError;
        }
      }

      /*
       * Remove existing rows for variants whose price was
       * intentionally cleared.
       */
      const idsToRemove: string[] = [];

      for (const item of priceItems) {
        const edited = editedPrices[item.variant_id];

        if (
          edited &&
          edited.price.trim() === ""
        ) {
          idsToRemove.push(item.id);
        }
      }

      if (idsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("price_list_items")
          .delete()
          .eq("company_id", companyId)
          .eq("price_list_id", priceList.id)
          .in("id", idsToRemove);

        if (deleteError) {
          throw deleteError;
        }
      }

      /*
       * Record pricing changes in price_history.
       */
      const historyRows: Array<{
        company_id: string;
        variant_id: string;
        price_list_id: string;
        old_price: number | null;
        new_price: number;
        change_type: string;
        reason: string;
      }> = [];

      for (const variant of variants) {
        const edited = editedPrices[variant.id];

        if (!edited || !edited.price.trim()) {
          continue;
        }

        const newPrice = Number(edited.price);

        if (!Number.isFinite(newPrice)) {
          continue;
        }

        const existingItem = itemMap[variant.id];

        const oldPrice = existingItem
          ? Number(existingItem.price)
          : null;

        if (
          oldPrice === null ||
          oldPrice !== newPrice
        ) {
          historyRows.push({
            company_id: companyId,
            variant_id: variant.id,
            price_list_id: priceList.id,
            old_price: oldPrice,
            new_price: newPrice,
            change_type: "price_list_update",
            reason: `Updated ${priceList.name} price list`,
          });
        }
      }

      if (historyRows.length > 0) {
        const { error: historyError } =
          await supabase
            .from("price_history")
            .insert(historyRows);

        if (historyError) {
          console.error(
            "Price history insert error:",
            historyError
          );
        }
      }

      setSuccessMessage(
        `${priceList.name} pricing was saved successfully.`
      );

      await loadPage(true);
    } catch (error) {
      console.error(
        "Price list save error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save pricing."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-full items-center justify-center bg-slate-50">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading price list...
          </div>
        </div>
      </AppShell>
    );
  }

  if (!priceList) {
    return (
      <AppShell>
        <div className="min-h-full bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <X className="h-6 w-6" />
            </div>

            <h1 className="text-xl font-bold text-slate-950">
              Price list not found
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {errorMessage ||
                "This price list does not exist or you do not have access to it."}
            </p>

            <Link
              href="/pricing/price-lists"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Price Lists
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Link
                  href="/pricing/products"
                  className="hover:text-slate-900"
                >
                  Pricing
                </Link>

                <ChevronRight className="h-4 w-4" />

                <Link
                  href="/pricing/price-lists"
                  className="hover:text-slate-900"
                >
                  Price Lists
                </Link>

                <ChevronRight className="h-4 w-4" />

                <span>{priceList.name}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                  {priceList.name}
                </h1>

                {priceList.is_default && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                    Default
                  </span>
                )}

                {priceList.is_active ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                    Inactive
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                {priceList.code && (
                  <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs">
                    {priceList.code}
                  </span>
                )}

                <span>{priceList.currency}</span>

                {companyName && (
                  <>
                    <span className="text-slate-300">
                      •
                    </span>

                    <span>{companyName}</span>
                  </>
                )}
              </div>

              {priceList.description && (
                <p className="mt-2 max-w-3xl text-sm text-slate-500">
                  {priceList.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/pricing/price-lists"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Price Lists
              </Link>

              <button
                type="button"
                onClick={() => void loadPage(true)}
                disabled={refreshing || saving}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => void saveAllPrices()}
                disabled={saving || refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Pricing
              </button>
            </div>
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Stats */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                  <Package className="h-5 w-5" />
                </div>

                <span className="text-xs text-slate-400">
                  Total
                </span>
              </div>

              <p className="text-2xl font-bold text-slate-950">
                {stats.total}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Product variants
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                  <Check className="h-5 w-5" />
                </div>

                <span className="text-xs text-slate-400">
                  Configured
                </span>
              </div>

              <p className="text-2xl font-bold text-slate-950">
                {stats.priced}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Priced variants
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                  <CircleDollarSign className="h-5 w-5" />
                </div>

                <span className="text-xs text-slate-400">
                  Missing
                </span>
              </div>

              <p className="text-2xl font-bold text-slate-950">
                {stats.unpriced}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Unpriced variants
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
                  <CircleDollarSign className="h-5 w-5" />
                </div>

                <span className="text-xs text-slate-400">
                  Below cost
                </span>
              </div>

              <p className="text-2xl font-bold text-slate-950">
                {stats.belowCost}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Loss-making prices
              </p>
            </div>
          </div>

          {/* Pricing editor */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-950">
                    Price List Items
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Set the price customers should receive
                    when this price list is selected.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search products, SKU..."
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={showUnpricedOnly}
                      onChange={(event) =>
                        setShowUnpricedOnly(
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />

                    Unpriced only
                  </label>
                </div>
              </div>
            </div>

            {filteredVariants.length === 0 ? (
              <div className="flex min-h-[350px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-500">
                  <Package className="h-7 w-7" />
                </div>

                <h3 className="font-semibold text-slate-950">
                  No products found
                </h3>

                <p className="mt-1 max-w-md text-sm text-slate-500">
                  {search
                    ? "Try a different search term."
                    : "There are no product variants available for this company."}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1150px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Product
                        </th>

                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Variant / SKU
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Base Cost
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Base Retail
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          List Price
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Margin
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Quantity
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredVariants.map((variant) => {
                        const edited =
                          editedPrices[variant.id] ?? {
                            price: "",
                            minQuantity: "1",
                            maxQuantity: "",
                          };

                        const listPrice = Number(
                          edited.price || 0
                        );

                        const cost = Number(
                          variant.cost_price ?? 0
                        );

                        const margin = calculateMargin(
                          cost,
                          listPrice
                        );

                        const hasExistingItem =
                          Boolean(
                            itemMap[variant.id]
                          );

                        const priceChanged =
                          hasExistingItem
                            ? Number(
                                itemMap[variant.id]
                                  .price
                              ) !== listPrice
                            : edited.price.trim() !== "";

                        return (
                          <tr
                            key={variant.id}
                            className="transition hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-4">
                              <div>
                                <p className="font-medium text-slate-950">
                                  {variant.product
                                    ?.name ??
                                    "Unnamed product"}
                                </p>

                                <div className="mt-1 flex items-center gap-2">
                                  {variant.product
                                    ?.brand && (
                                    <span className="text-xs text-slate-500">
                                      {
                                        variant.product
                                          .brand
                                      }
                                    </span>
                                  )}

                                  {variant.product
                                    ?.category && (
                                    <>
                                      <span className="text-slate-300">
                                        •
                                      </span>

                                      <span className="text-xs text-slate-400">
                                        {
                                          variant.product
                                            .category
                                        }
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <p className="text-sm font-medium text-slate-700">
                                {variant.name}
                              </p>

                              <div className="mt-1 flex flex-wrap gap-2">
                                {variant.sku && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                                    SKU: {variant.sku}
                                  </span>
                                )}

                                {variant.barcode && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                                    {
                                      variant.barcode
                                    }
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-right text-sm font-medium text-slate-700">
                              {formatCurrency(
                                cost,
                                priceList.currency
                              )}
                            </td>

                            <td className="px-5 py-4 text-right text-sm text-slate-500">
                              {formatCurrency(
                                variant.selling_price,
                                priceList.currency
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <div className="relative w-32">
                                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                    {priceList.currency}
                                  </span>

                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={
                                      edited.price
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateEditedPrice(
                                        variant.id,
                                        "price",
                                        event.target
                                          .value
                                      )
                                    }
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-2 text-right text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    placeholder="0.00"
                                  />
                                </div>

                                {priceChanged && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      resetVariantPrice(
                                        variant
                                      )
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                    title="Reset"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <span
                                className={`text-sm font-semibold ${
                                  margin < 0
                                    ? "text-red-600"
                                    : margin < 15
                                      ? "text-amber-600"
                                      : "text-emerald-600"
                                }`}
                              >
                                {listPrice > 0
                                  ? `${margin.toFixed(
                                      1
                                    )}%`
                                  : "—"}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={
                                    edited.minQuantity
                                  }
                                  onChange={(event) =>
                                    updateEditedPrice(
                                      variant.id,
                                      "minQuantity",
                                      event.target
                                        .value
                                    )
                                  }
                                  className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                  title="Minimum quantity"
                                />

                                <span className="text-slate-300">
                                  –
                                </span>

                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={
                                    edited.maxQuantity
                                  }
                                  onChange={(event) =>
                                    updateEditedPrice(
                                      variant.id,
                                      "maxQuantity",
                                      event.target
                                        .value
                                    )
                                  }
                                  placeholder="∞"
                                  className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                  title="Maximum quantity"
                                />
                              </div>
                            </td>

                            <td className="px-5 py-4 text-right">
                              {!edited.price.trim() ? (
                                <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                                  Not priced
                                </span>
                              ) : listPrice < cost ? (
                                <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                                  Below cost
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                  Priced
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="divide-y divide-slate-100 lg:hidden">
                  {filteredVariants.map((variant) => {
                    const edited =
                      editedPrices[variant.id] ?? {
                        price: "",
                        minQuantity: "1",
                        maxQuantity: "",
                      };

                    const listPrice = Number(
                      edited.price || 0
                    );

                    const cost = Number(
                      variant.cost_price ?? 0
                    );

                    const margin = calculateMargin(
                      cost,
                      listPrice
                    );

                    return (
                      <div
                        key={variant.id}
                        className="p-4 sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-950">
                              {variant.product?.name ??
                                "Unnamed product"}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {variant.name}
                            </p>

                            {variant.sku && (
                              <span className="mt-2 inline-flex rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">
                                SKU: {variant.sku}
                              </span>
                            )}
                          </div>

                          {!edited.price.trim() ? (
                            <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              Not priced
                            </span>
                          ) : listPrice < cost ? (
                            <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                              Below cost
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              Priced
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Cost
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {formatCurrency(
                                cost,
                                priceList.currency
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Base Retail
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {formatCurrency(
                                variant.selling_price,
                                priceList.currency
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="mb-1.5 block text-xs font-medium text-slate-500">
                            Price in this list
                          </label>

                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                {priceList.currency}
                              </span>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={edited.price}
                                onChange={(event) =>
                                  updateEditedPrice(
                                    variant.id,
                                    "price",
                                    event.target.value
                                  )
                                }
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-14 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                placeholder="0.00"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                resetVariantPrice(
                                  variant
                                )
                              }
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                              title="Reset"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-500">
                              Min Qty
                            </label>

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={
                                edited.minQuantity
                              }
                              onChange={(event) =>
                                updateEditedPrice(
                                  variant.id,
                                  "minQuantity",
                                  event.target.value
                                )
                              }
                              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-500">
                              Max Qty
                            </label>

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={
                                edited.maxQuantity
                              }
                              onChange={(event) =>
                                updateEditedPrice(
                                  variant.id,
                                  "maxQuantity",
                                  event.target.value
                                )
                              }
                              placeholder="∞"
                              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-500">
                              Margin
                            </label>

                            <div
                              className={`flex h-10 items-center justify-center rounded-lg border text-sm font-semibold ${
                                listPrice <= 0
                                  ? "border-slate-200 bg-slate-50 text-slate-400"
                                  : margin < 0
                                    ? "border-red-200 bg-red-50 text-red-600"
                                    : margin < 15
                                      ? "border-amber-200 bg-amber-50 text-amber-600"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-600"
                              }`}
                            >
                              {listPrice > 0
                                ? `${margin.toFixed(
                                    1
                                  )}%`
                                : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      Showing{" "}
                      <span className="font-semibold text-slate-700">
                        {filteredVariants.length}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-slate-700">
                        {variants.length}
                      </span>{" "}
                      variants
                    </p>

                    <p className="text-xs text-slate-400">
                      Changes are saved when you click{" "}
                      <span className="font-medium text-slate-600">
                        Save Pricing
                      </span>
                      .
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}