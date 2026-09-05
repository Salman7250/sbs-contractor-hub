"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Product = {
  id: string;
  company_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  brand: string | null;
  product_type: "physical" | "digital" | "other";
  status: "active" | "archived" | "draft";
  track_inventory: boolean;
  tax_rate: number;
  created_at: string;
  updated_at: string;
};

type ProductOptionValue = {
  id: string;
  company_id: string;
  option_id: string;
  value: string;
  position: number;
  created_at: string;
};

type ProductOption = {
  id: string;
  company_id: string;
  product_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
  product_option_values: ProductOptionValue[];
};

type ProductVariantValue = {
  id: string;
  company_id: string;
  variant_id: string;
  option_id: string;
  option_value_id: string;
  created_at: string;
};

type ProductVariant = {
  id: string;
  company_id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_variant_values: ProductVariantValue[];
};

type ProductWithVariants = Product & {
  product_options: ProductOption[];
  product_variants: ProductVariant[];
};

type SortKey =
  | "name"
  | "created_at"
  | "selling_price"
  | "cost_price"
  | "margin"
  | "variants";

type SortDirection = "asc" | "desc";

type IconName =
  | "dashboard"
  | "customers"
  | "quotes"
  | "orders"
  | "invoices"
  | "payments"
  | "products"
  | "serials"
  | "inventory"
  | "warehouses"
  | "pricing"
  | "suppliers"
  | "purchases"
  | "expenses"
  | "warranty"
  | "repairs"
  | "rma"
  | "portal"
  | "reports"
  | "employees"
  | "documents"
  | "settings"
  | "search"
  | "filter"
  | "grid"
  | "list"
  | "plus"
  | "package"
  | "layers"
  | "box"
  | "dollar"
  | "edit"
  | "archive"
  | "restore"
  | "more"
  | "refresh"
  | "arrow"
  | "warning"
  | "check"
  | "chevron"
  | "close";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function numberValue(value: string | number | null | undefined) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function getActiveVariants(product: ProductWithVariants) {
  return product.product_variants.filter((variant) => variant.is_active);
}

function getProductPrices(product: ProductWithVariants) {
  const variants = getActiveVariants(product);

  if (variants.length === 0) {
    return {
      min: 0,
      max: 0,
    };
  }

  const prices = variants.map((variant) =>
    numberValue(variant.selling_price)
  );

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

function getProductCost(product: ProductWithVariants) {
  const variants = getActiveVariants(product);

  if (variants.length === 0) {
    return 0;
  }

  return Math.min(
    ...variants.map((variant) => numberValue(variant.cost_price))
  );
}

function getVariantMargin(variant: ProductVariant) {
  const selling = numberValue(variant.selling_price);
  const cost = numberValue(variant.cost_price);

  if (selling <= 0) {
    return 0;
  }

  return ((selling - cost) / selling) * 100;
}

function getProductMargin(product: ProductWithVariants) {
  const variants = getActiveVariants(product);

  if (variants.length === 0) {
    return 0;
  }

  const total = variants.reduce(
    (sum, variant) => sum + getVariantMargin(variant),
    0
  );

  return total / variants.length;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

/* -------------------------------------------------------------------------- */
/* Icon                                                                       */
/* -------------------------------------------------------------------------- */

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "shrink-0",
  };

  switch (name) {
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );

    case "filter":
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M7 12h10" />
          <path d="M10 18h4" />
        </svg>
      );

    case "grid":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      );

    case "list":
      return (
        <svg {...common}>
          <path d="M8 6h12" />
          <path d="M8 12h12" />
          <path d="M8 18h12" />
          <path d="M4 6h.01" />
          <path d="M4 12h.01" />
          <path d="M4 18h.01" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case "package":
      return (
        <svg {...common}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="m4.5 7.5 7.5 4 7.5-4" />
          <path d="M12 11.5V21" />
        </svg>
      );

    case "layers":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 16 9 5 9-5" />
        </svg>
      );

    case "box":
      return (
        <svg {...common}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="M12 12 4.5 7.5" />
          <path d="m12 12 7.5-4.5" />
        </svg>
      );

    case "dollar":
      return (
        <svg {...common}>
          <path d="M12 2v20" />
          <path d="M17 5.5c-1-1-2.6-1.5-4.5-1.5-3 0-5 1.5-5 3.8 0 5.7 9.5 2.4 9.5 7.3 0 2.2-2 3.4-5 3.4-2 0-3.7-.6-4.8-1.7" />
        </svg>
      );

    case "edit":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z" />
        </svg>
      );

    case "archive":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M5 7v12h14V7" />
          <path d="M7 4h10l2 3H5l2-3Z" />
          <path d="M9 11h6" />
        </svg>
      );

    case "restore":
      return (
        <svg {...common}>
          <path d="M4 12a8 8 0 1 0 2.3-5.7" />
          <path d="M4 4v5h5" />
        </svg>
      );

    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.9-4" />
          <path d="M4 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.9 4" />
          <path d="M20 20v-5h-5" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h13" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    case "warning":
      return (
        <svg {...common}>
          <path d="M12 3 2.8 19a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ProductsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");

  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "draft" | "archived"
  >("all");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "physical" | "digital" | "other"
  >("all");

  const [sortKey, setSortKey] =
    useState<SortKey>("created_at");

  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  const [viewMode, setViewMode] =
    useState<"list" | "grid">("list");

  const [selectedProductIds, setSelectedProductIds] =
    useState<string[]>([]);

  const [actionProductId, setActionProductId] =
    useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Currency                                                                 */
  /* ------------------------------------------------------------------------ */

  const money = useCallback(
    (value: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(numberValue(value)),
    [currency]
  );

  /* ------------------------------------------------------------------------ */
  /* Company                                                                  */
  /* ------------------------------------------------------------------------ */

  const getCompanyMembership = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      throw new Error("You must be signed in.");
    }

    const { data, error: membershipError } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!data?.company_id) {
      throw new Error("No company membership was found.");
    }

    return data.company_id as string;
  }, [router, supabase]);

  const loadCompany = useCallback(
    async (id: string) => {
      const { data, error: companyError } = await supabase
        .from("companies")
        .select("currency")
        .eq("id", id)
        .single();

      if (companyError) {
        throw companyError;
      }

      setCurrency(data?.currency || "USD");
    },
    [supabase]
  );

  /* ------------------------------------------------------------------------ */
  /* Products                                                                 */
  /* ------------------------------------------------------------------------ */

  const loadProducts = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);

      try {
        const [
          productsResult,
          optionsResult,
          optionValuesResult,
          variantsResult,
          variantValuesResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id, company_id, name, slug, description, category, brand, product_type, status, track_inventory, tax_rate, created_at, updated_at"
            )
            .eq("company_id", id)
            .order("created_at", { ascending: false }),

          supabase
            .from("product_options")
            .select(
              "id, company_id, product_id, name, position, created_at, updated_at"
            )
            .eq("company_id", id)
            .order("position", { ascending: true }),

          supabase
            .from("product_option_values")
            .select(
              "id, company_id, option_id, value, position, created_at"
            )
            .eq("company_id", id)
            .order("position", { ascending: true }),

          supabase
            .from("product_variants")
            .select(
              "id, company_id, product_id, name, sku, barcode, cost_price, selling_price, is_default, is_active, created_at, updated_at"
            )
            .eq("company_id", id)
            .order("created_at", { ascending: true }),

          supabase
            .from("product_variant_values")
            .select(
              "id, company_id, variant_id, option_id, option_value_id, created_at"
            )
            .eq("company_id", id),
        ]);

        if (productsResult.error) {
          throw productsResult.error;
        }

        if (optionsResult.error) {
          throw optionsResult.error;
        }

        if (optionValuesResult.error) {
          throw optionValuesResult.error;
        }

        if (variantsResult.error) {
          throw variantsResult.error;
        }

        if (variantValuesResult.error) {
          throw variantValuesResult.error;
        }

        const rawProducts =
          (productsResult.data || []) as Product[];

        const rawOptions =
          (optionsResult.data || []) as ProductOption[];

        const rawOptionValues =
          (optionValuesResult.data ||
            []) as ProductOptionValue[];

        const rawVariants =
          (variantsResult.data || []) as ProductVariant[];

        const rawVariantValues =
          (variantValuesResult.data ||
            []) as ProductVariantValue[];

        const productsWithVariants: ProductWithVariants[] =
          rawProducts.map((product) => {
            const productOptions = rawOptions
              .filter(
                (option) => option.product_id === product.id
              )
              .map((option) => ({
                ...option,
                product_option_values:
                  rawOptionValues.filter(
                    (value) =>
                      value.option_id === option.id
                  ),
              }));

            const productVariants = rawVariants
              .filter(
                (variant) =>
                  variant.product_id === product.id
              )
              .map((variant) => ({
                ...variant,
                product_variant_values:
                  rawVariantValues.filter(
                    (value) =>
                      value.variant_id === variant.id
                  ),
              }));

            return {
              ...product,
              product_options: productOptions,
              product_variants: productVariants,
            };
          });

        setProducts(productsWithVariants);
      } catch (loadError) {
        console.error(loadError);

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load products."
        );
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const id = await getCompanyMembership();

        if (!mounted) {
          return;
        }

        setCompanyId(id);

        await Promise.all([
          loadCompany(id),
          loadProducts(id),
        ]);
      } catch (initError) {
        console.error(initError);

        if (mounted) {
          setError(
            initError instanceof Error
              ? initError.message
              : "Unable to load your workspace."
          );

          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [
    getCompanyMembership,
    loadCompany,
    loadProducts,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Filtering                                                                */
  /* ------------------------------------------------------------------------ */

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = products.filter((product) => {
      const matchesStatus =
        statusFilter === "all" ||
        product.status === statusFilter;

      const matchesType =
        typeFilter === "all" ||
        product.product_type === typeFilter;

      if (!matchesStatus || !matchesType) {
        return false;
      }

      if (!query) {
        return true;
      }

      const variantText = product.product_variants
        .flatMap((variant) => [
          variant.name,
          variant.sku || "",
          variant.barcode || "",
        ])
        .join(" ");

      const optionText = product.product_options
        .flatMap((option) => [
          option.name,
          ...option.product_option_values.map(
            (value) => value.value
          ),
        ])
        .join(" ");

      const searchable = [
        product.name,
        product.description || "",
        product.category || "",
        product.brand || "",
        product.product_type,
        product.status,
        variantText,
        optionText,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    return result.sort((a, b) => {
      let comparison = 0;

      if (sortKey === "name") {
        comparison = a.name.localeCompare(b.name);
      }

      if (sortKey === "created_at") {
        comparison =
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime();
      }

      if (sortKey === "selling_price") {
        comparison =
          getProductPrices(a).min -
          getProductPrices(b).min;
      }

      if (sortKey === "cost_price") {
        comparison =
          getProductCost(a) -
          getProductCost(b);
      }

      if (sortKey === "margin") {
        comparison =
          getProductMargin(a) -
          getProductMargin(b);
      }

      if (sortKey === "variants") {
        comparison =
          a.product_variants.length -
          b.product_variants.length;
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });
  }, [
    products,
    search,
    statusFilter,
    typeFilter,
    sortKey,
    sortDirection,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Statistics                                                               */
  /* ------------------------------------------------------------------------ */

  const stats = useMemo(() => {
    const active = products.filter(
      (product) => product.status === "active"
    ).length;

    const drafts = products.filter(
      (product) => product.status === "draft"
    ).length;

    const archived = products.filter(
      (product) => product.status === "archived"
    ).length;

    const variants = products.reduce(
      (sum, product) =>
        sum + product.product_variants.length,
      0
    );

    const inventoryTracked = products.filter(
      (product) => product.track_inventory
    ).length;

    const margins = products.flatMap((product) =>
      getActiveVariants(product).map(getVariantMargin)
    );

    const averageMargin =
      margins.length > 0
        ? margins.reduce((sum, margin) => sum + margin, 0) /
          margins.length
        : 0;

    return {
      total: products.length,
      active,
      drafts,
      archived,
      variants,
      inventoryTracked,
      averageMargin,
    };
  }, [products]);

  /* ------------------------------------------------------------------------ */
  /* Selection                                                                */
  /* ------------------------------------------------------------------------ */

  function toggleProductSelection(id: string) {
    setSelectedProductIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleSelectAll() {
    if (
      selectedProductIds.length ===
      filteredProducts.length
    ) {
      setSelectedProductIds([]);
      return;
    }

    setSelectedProductIds(
      filteredProducts.map((product) => product.id)
    );
  }

  function changeSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  /* ------------------------------------------------------------------------ */
  /* Archive / Restore                                                        */
  /* ------------------------------------------------------------------------ */

  async function changeProductStatus(
    product: ProductWithVariants
  ) {
    if (!companyId) {
      return;
    }

    setActionProductId(product.id);
    setError(null);

    const nextStatus =
      product.status === "archived"
        ? "active"
        : "archived";

    try {
      const { error: updateError } = await supabase
        .from("products")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id)
        .eq("company_id", companyId);

      if (updateError) {
        throw updateError;
      }

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                status: nextStatus,
              }
            : item
        )
      );
    } catch (statusError) {
      console.error(statusError);

      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to update the product."
      );
    } finally {
      setActionProductId(null);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <AppShell
      title="Products"
      description="Manage your product catalog, pricing, variants, and inventory settings."
      actions={
        <button
          type="button"
          onClick={() => router.push("/products/new")}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Icon name="plus" size={17} />
          Add Product
        </button>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <Icon name="warning" size={18} />

            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                Something went wrong
              </div>

              <div className="mt-0.5 break-words">
                {error}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg p-1 transition hover:bg-red-100"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Summary cards                                                     */}
        {/* ---------------------------------------------------------------- */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            icon="package"
            label="Total Products"
            value={stats.total}
            description="Across your catalog"
          />

          <SummaryCard
            icon="check"
            label="Active"
            value={stats.active}
            description="Currently enabled"
          />

          <SummaryCard
            icon="layers"
            label="Variants"
            value={stats.variants}
            description="Configured variants"
          />

          <SummaryCard
            icon="box"
            label="Inventory Tracked"
            value={stats.inventoryTracked}
            description="Products linked to stock"
          />

          <SummaryCard
            icon="dollar"
            label="Average Margin"
            value={`${stats.averageMargin.toFixed(1)}%`}
            description="Across active variants"
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Catalog                                                            */}
        {/* ---------------------------------------------------------------- */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1 xl:max-w-2xl">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Icon name="search" size={18} />
                </div>

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search products, SKU, barcode, brand, category..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect
                  value={statusFilter}
                  onChange={(value) =>
                    setStatusFilter(
                      value as
                        | "all"
                        | "active"
                        | "draft"
                        | "archived"
                    )
                  }
                  options={[
                    {
                      value: "all",
                      label: "All statuses",
                    },
                    {
                      value: "active",
                      label: "Active",
                    },
                    {
                      value: "draft",
                      label: "Drafts",
                    },
                    {
                      value: "archived",
                      label: "Archived",
                    },
                  ]}
                />

                <FilterSelect
                  value={typeFilter}
                  onChange={(value) =>
                    setTypeFilter(
                      value as
                        | "all"
                        | "physical"
                        | "digital"
                        | "other"
                    )
                  }
                  options={[
                    {
                      value: "all",
                      label: "All types",
                    },
                    {
                      value: "physical",
                      label: "Physical",
                    },
                    {
                      value: "digital",
                      label: "Digital",
                    },
                    {
                      value: "other",
                      label: "Other",
                    },
                  ]}
                />

                <div className="hidden h-6 w-px bg-slate-200 sm:block" />

                <button
                  type="button"
                  onClick={() =>
                    companyId
                      ? void loadProducts(companyId)
                      : undefined
                  }
                  disabled={!companyId || loading}
                  title="Refresh"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="refresh" size={16} />
                </button>

                <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                      viewMode === "list"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                    title="List view"
                  >
                    <Icon name="list" size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                      viewMode === "grid"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                    title="Grid view"
                  >
                    <Icon name="grid" size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>
                  Showing{" "}
                  <strong className="font-semibold text-slate-700">
                    {filteredProducts.length}
                  </strong>{" "}
                  of{" "}
                  <strong className="font-semibold text-slate-700">
                    {products.length}
                  </strong>{" "}
                  products
                </span>

                {selectedProductIds.length > 0 && (
                  <>
                    <span className="text-slate-300">
                      •
                    </span>

                    <span className="font-medium text-blue-600">
                      {selectedProductIds.length} selected
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Icon name="filter" size={14} />

                <span className="text-xs text-slate-400">
                  Sort:
                </span>

                <select
                  value={sortKey}
                  onChange={(event) =>
                    setSortKey(
                      event.target.value as SortKey
                    )
                  }
                  className="rounded-md border-0 bg-transparent py-1 pl-1 pr-7 text-xs font-medium text-slate-700 outline-none focus:ring-0"
                >
                  <option value="created_at">
                    Newest
                  </option>
                  <option value="name">Name</option>
                  <option value="selling_price">
                    Selling price
                  </option>
                  <option value="cost_price">
                    Cost price
                  </option>
                  <option value="margin">Margin</option>
                  <option value="variants">
                    Variants
                  </option>
                </select>

                <button
                  type="button"
                  onClick={() =>
                    setSortDirection((current) =>
                      current === "asc"
                        ? "desc"
                        : "asc"
                    )
                  }
                  className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  title={`Sort ${
                    sortDirection === "asc"
                      ? "descending"
                      : "ascending"
                  }`}
                >
                  {sortDirection === "asc" ? "↑" : "↓"}
                </button>
              </div>
            </div>
          </div>

          {/* Bulk selection */}
          {selectedProductIds.length > 0 && (
            <div className="flex flex-col gap-2 border-b border-blue-100 bg-blue-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-800">
                  {selectedProductIds.length} product
                  {selectedProductIds.length === 1
                    ? ""
                    : "s"}{" "}
                  selected
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedProductIds([])
                  }
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Clear
                </button>
              </div>

              <span className="text-xs text-blue-600">
                Bulk actions will be available as the
                catalog workflow expands.
              </span>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <LoadingState />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              hasProducts={products.length > 0}
              search={search}
              onAddProduct={() =>
                router.push("/products/new")
              }
              onClearFilters={() => {
                setSearch("");
                setStatusFilter("all");
                setTypeFilter("all");
              }}
            />
          ) : viewMode === "list" ? (
            <ProductTable
              products={filteredProducts}
              selectedProductIds={selectedProductIds}
              actionProductId={actionProductId}
              currency={currency}
              money={money}
              onToggleSelection={
                toggleProductSelection
              }
              onToggleSelectAll={toggleSelectAll}
              onView={(id) =>
                router.push(`/products/${id}`)
              }
              onEdit={(id) =>
                router.push(
                  `/products/${id}/edit`
                )
              }
              onChangeStatus={changeProductStatus}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={changeSort}
            />
          ) : (
            <ProductGrid
              products={filteredProducts}
              selectedProductIds={selectedProductIds}
              actionProductId={actionProductId}
              money={money}
              onToggleSelection={
                toggleProductSelection
              }
              onView={(id) =>
                router.push(`/products/${id}`)
              }
              onEdit={(id) =>
                router.push(
                  `/products/${id}/edit`
                )
              }
              onChangeStatus={changeProductStatus}
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Product table                                                              */
/* -------------------------------------------------------------------------- */

function ProductTable({
  products,
  selectedProductIds,
  actionProductId,
  money,
  onToggleSelection,
  onToggleSelectAll,
  onView,
  onEdit,
  onChangeStatus,
  sortKey,
  sortDirection,
  onSort,
}: {
  products: ProductWithVariants[];
  selectedProductIds: string[];
  actionProductId: string | null;
  currency: string;
  money: (value: number) => string;
  onToggleSelection: (id: string) => void;
  onToggleSelectAll: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onChangeStatus: (
    product: ProductWithVariants
  ) => void;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const allSelected =
    products.length > 0 &&
    selectedProductIds.length === products.length;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1050px]">
        <div className="grid grid-cols-[40px_minmax(270px,1.8fr)_130px_150px_110px_120px_110px] items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />

          <SortButton
            label="Product"
            active={sortKey === "name"}
            direction={sortDirection}
            onClick={() => onSort("name")}
          />

          <div>Status</div>

          <SortButton
            label="Pricing"
            active={sortKey === "selling_price"}
            direction={sortDirection}
            onClick={() => onSort("selling_price")}
          />

          <SortButton
            label="Margin"
            active={sortKey === "margin"}
            direction={sortDirection}
            onClick={() => onSort("margin")}
          />

          <div>Inventory</div>

          <div className="text-right">
            Actions
          </div>
        </div>

        {products.map((product) => {
          const prices = getProductPrices(product);
          const margin = getProductMargin(product);
          const selected =
            selectedProductIds.includes(product.id);

          return (
            <div
              key={product.id}
              className={`grid grid-cols-[40px_minmax(270px,1.8fr)_130px_150px_110px_120px_110px] items-center gap-4 border-b border-slate-100 px-5 py-4 transition last:border-b-0 hover:bg-slate-50/70 ${
                selected ? "bg-blue-50/40" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() =>
                  onToggleSelection(product.id)
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />

              <button
                type="button"
                onClick={() => onView(product.id)}
                className="flex min-w-0 items-center gap-3 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                  <Icon name="package" size={18} />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900 hover:text-blue-600">
                    {product.name}
                  </div>

                  <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-slate-400">
                    {product.brand && (
                      <span className="truncate">
                        {product.brand}
                      </span>
                    )}

                    {product.category && (
                      <>
                        {product.brand && (
                          <span>•</span>
                        )}

                        <span className="truncate">
                          {product.category}
                        </span>
                      </>
                    )}

                    <span>•</span>

                    <span>
                      {product.product_variants.length}{" "}
                      {product.product_variants.length ===
                      1
                        ? "variant"
                        : "variants"}
                    </span>
                  </div>
                </div>
              </button>

              <div>
                <StatusBadge status={product.status} />
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {prices.min === prices.max
                    ? money(prices.min)
                    : `${money(prices.min)} – ${money(
                        prices.max
                      )}`}
                </div>

                <div className="mt-0.5 text-xs text-slate-400">
                  {product.product_variants.length}{" "}
                  pricing{" "}
                  {product.product_variants.length === 1
                    ? "configuration"
                    : "configurations"}
                </div>
              </div>

              <div>
                <div
                  className={`text-sm font-semibold ${
                    margin >= 30
                      ? "text-emerald-600"
                      : margin >= 15
                        ? "text-slate-700"
                        : "text-amber-600"
                  }`}
                >
                  {margin.toFixed(1)}%
                </div>

                <div className="mt-0.5 text-xs text-slate-400">
                  avg. margin
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-slate-700">
                  {product.track_inventory
                    ? "Tracked"
                    : "Not tracked"}
                </div>

                <div className="mt-0.5 text-xs text-slate-400">
                  {product.product_type}
                </div>
              </div>

              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => onView(product.id)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  title="View product"
                >
                  <Icon name="arrow" size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => onEdit(product.id)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  title="Edit product"
                >
                  <Icon name="edit" size={16} />
                </button>

                <button
                  type="button"
                  disabled={actionProductId === product.id}
                  onClick={() => onChangeStatus(product)}
                  className={`rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    product.status === "archived"
                      ? "text-blue-600 hover:bg-blue-50"
                      : "text-slate-400 hover:bg-red-50 hover:text-red-600"
                  }`}
                  title={
                    product.status === "archived"
                      ? "Restore product"
                      : "Archive product"
                  }
                >
                  <Icon
                    name={
                      product.status === "archived"
                        ? "restore"
                        : "archive"
                    }
                    size={16}
                  />
                </button>

                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  title="More actions"
                >
                  <Icon name="more" size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Product grid                                                               */
/* -------------------------------------------------------------------------- */

function ProductGrid({
  products,
  selectedProductIds,
  actionProductId,
  money,
  onToggleSelection,
  onView,
  onEdit,
  onChangeStatus,
}: {
  products: ProductWithVariants[];
  selectedProductIds: string[];
  actionProductId: string | null;
  money: (value: number) => string;
  onToggleSelection: (id: string) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onChangeStatus: (
    product: ProductWithVariants
  ) => void;
}) {
  return (
    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product) => {
        const prices = getProductPrices(product);
        const margin = getProductMargin(product);
        const selected =
          selectedProductIds.includes(product.id);

        return (
          <article
            key={product.id}
            className={`rounded-xl border bg-white transition hover:border-slate-300 hover:shadow-sm ${
              selected
                ? "border-blue-300 ring-2 ring-blue-100"
                : "border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between border-b border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() =>
                    onToggleSelection(product.id)
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />

                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                  <Icon name="package" size={18} />
                </div>
              </div>

              <StatusBadge status={product.status} />
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onView(product.id)}
                  className="min-w-0 text-left"
                >
                  <h3 className="truncate text-sm font-semibold text-slate-900 hover:text-blue-600">
                    {product.name}
                  </h3>

                  <p className="mt-1 truncate text-xs text-slate-500">
                    {product.brand ||
                      product.category ||
                      "Product catalog"}
                  </p>
                </button>

                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold capitalize text-slate-600">
                  {product.product_type}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricBox
                  label="Selling"
                  value={
                    prices.min === prices.max
                      ? money(prices.min)
                      : `${money(prices.min)}+`
                  }
                />

                <MetricBox
                  label="Margin"
                  value={`${margin.toFixed(1)}%`}
                />

                <MetricBox
                  label="Variants"
                  value={String(
                    product.product_variants.length
                  )}
                />

                <MetricBox
                  label="Options"
                  value={String(
                    product.product_options.length
                  )}
                />
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {product.track_inventory
                      ? "Inventory tracked"
                      : "Inventory not tracked"}
                  </span>

                  <span className="text-xs text-slate-400">
                    {formatDate(product.created_at)}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onView(product.id)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    View Product
                  </button>

                  <button
                    type="button"
                    onClick={() => onEdit(product.id)}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                    title="Edit product"
                  >
                    <Icon name="edit" size={15} />
                  </button>

                  <button
                    type="button"
                    disabled={
                      actionProductId === product.id
                    }
                    onClick={() =>
                      onChangeStatus(product)
                    }
                    className={`rounded-lg border border-slate-200 bg-white p-2 transition disabled:opacity-50 ${
                      product.status === "archived"
                        ? "text-blue-600 hover:bg-blue-50"
                        : "text-slate-500 hover:bg-red-50 hover:text-red-600"
                    }`}
                    title={
                      product.status === "archived"
                        ? "Restore product"
                        : "Archive product"
                    }
                  >
                    <Icon
                      name={
                        product.status === "archived"
                          ? "restore"
                          : "archive"
                      }
                      size={15}
                    />
                  </button>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small components                                                           */
/* -------------------------------------------------------------------------- */

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-left"
    >
      {label}

      {active && (
        <span>
          {direction === "asc" ? "↑" : "↓"}
        </span>
      )}
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}

function StatusBadge({
  status,
}: {
  status: "active" | "draft" | "archived";
}) {
  const config = {
    active: {
      label: "Active",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    },
    draft: {
      label: "Draft",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
    },
    archived: {
      label: "Archived",
      className:
        "border-slate-200 bg-slate-100 text-slate-600",
      dot: "bg-slate-400",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${config.className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot}`}
      />

      {config.label}
    </span>
  );
}

function MetricBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>

      <div className="mt-1 truncate text-sm font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </div>

          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </div>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
          <Icon name={icon} size={19} />
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        {description}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 p-5">
      {[1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          className="h-16 animate-pulse rounded-lg bg-slate-100"
        />
      ))}
    </div>
  );
}

function EmptyState({
  hasProducts,
  search,
  onAddProduct,
  onClearFilters,
}: {
  hasProducts: boolean;
  search: string;
  onAddProduct: () => void;
  onClearFilters: () => void;
}) {
  const filtered =
    hasProducts || Boolean(search.trim());

  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
        <Icon name="package" size={24} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">
        {filtered
          ? "No products match your filters"
          : "No products yet"}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {filtered
          ? "Try adjusting your search or filters to find the product you're looking for."
          : "Create your first product to start building your catalog, pricing, and inventory records."}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {filtered && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Clear Filters
          </button>
        )}

        {!hasProducts && (
          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Icon name="plus" size={16} />
            Add Product
          </button>
        )}
      </div>
    </div>
  );
}