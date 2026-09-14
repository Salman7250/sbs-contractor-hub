"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  Archive,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Eye,
  Filter,
  Layers3,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Tags,
  Warehouse,
  X,
} from "lucide-react";

type Product = {
  id: string;
  company_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  brand: string | null;
  product_type: string;
  status: string;
  track_inventory: boolean;
  tax_rate: number;
  tracking_mode: string;
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
  cost_price: number;
  selling_price: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type InventoryStock = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
  reserved_quantity: number;
};

type ProductRow = Product & {
  variants: ProductVariant[];
  stock: number;
  reserved: number;
  available: number;
};

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  physical: "Physical",
  service: "Service",
  digital: "Digital",
};

function StatCard({
  label,
  value,
  helper,
  icon,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div className="stat-copy">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        <div className="stat-helper">{helper}</div>
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getStatusClass(status: string) {
  switch (status) {
    case "active":
      return "status status-active";

    case "inactive":
      return "status status-inactive";

    case "archived":
      return "status status-archived";

    default:
      return "status";
  }
}

function getTrackingLabel(product: Product) {
  const tracked =
    Boolean(product.track_inventory) ||
    normalize(product.tracking_mode) !== "none";

  return tracked ? "Tracked" : "Not Tracked";
}

function isTracked(product: Product) {
  return (
    Boolean(product.track_inventory) ||
    normalize(product.tracking_mode) !== "none"
  );
}

export default function ProductsPage() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [stockRows, setStockRows] = useState<InventoryStock[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [trackingFilter, setTrackingFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");

  const [expandedProductId, setExpandedProductId] =
    useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);

  const loadProducts = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");
      setSuccessMessage("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const {
          data: membership,
          error: membershipError,
        } = await supabase
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
            "No company workspace is available for this account."
          );
        }

        const companyId = membership.company_id;

        const [
          { data: productData, error: productError },
          { data: variantData, error: variantError },
          { data: stockData, error: stockError },
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              `
                id,
                company_id,
                name,
                slug,
                description,
                category,
                brand,
                product_type,
                status,
                track_inventory,
                tax_rate,
                tracking_mode,
                created_at,
                updated_at
              `
            )
            .eq("company_id", companyId)
            .order("name", {
              ascending: true,
            }),

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
                created_at,
                updated_at
              `
            )
            .eq("company_id", companyId)
            .order("is_default", {
              ascending: false,
            })
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("inventory_batch_stock")
            .select(
              `
                product_id,
                variant_id,
                quantity,
                reserved_quantity
              `
            )
            .eq("company_id", companyId),
        ]);

        if (productError) {
          throw productError;
        }

        if (variantError) {
          throw variantError;
        }

        if (stockError) {
          throw stockError;
        }

        setProducts((productData || []) as Product[]);
        setVariants((variantData || []) as ProductVariant[]);
        setStockRows((stockData || []) as InventoryStock[]);
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load products."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase]
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const productRows = useMemo<ProductRow[]>(() => {
    const variantsByProduct = new Map<string, ProductVariant[]>();

    for (const variant of variants) {
      const current =
        variantsByProduct.get(variant.product_id) || [];

      current.push(variant);
      variantsByProduct.set(
        variant.product_id,
        current
      );
    }

    const stockByProduct = new Map<
      string,
      { quantity: number; reserved: number }
    >();

    for (const stock of stockRows) {
      const current = stockByProduct.get(
        stock.product_id
      ) || {
        quantity: 0,
        reserved: 0,
      };

      current.quantity += Number(stock.quantity || 0);
      current.reserved += Number(
        stock.reserved_quantity || 0
      );

      stockByProduct.set(
        stock.product_id,
        current
      );
    }

    return products.map((product) => {
      const stock =
        stockByProduct.get(product.id) || {
          quantity: 0,
          reserved: 0,
        };

      return {
        ...product,
        variants:
          variantsByProduct.get(product.id) || [],
        stock: stock.quantity,
        reserved: stock.reserved,
        available: Math.max(
          stock.quantity - stock.reserved,
          0
        ),
      };
    });
  }, [products, variants, stockRows]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => product.category?.trim())
          .filter(Boolean) as string[]
      )
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [products]);

  const brands = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => product.brand?.trim())
          .filter(Boolean) as string[]
      )
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = normalize(search);

    return productRows.filter((product) => {
      const searchable = [
        product.name,
        product.brand,
        product.category,
        product.slug,
        product.product_type,
        ...product.variants.flatMap((variant) => [
          variant.name,
          variant.sku,
          variant.barcode,
        ]),
      ]
        .filter(Boolean)
        .map((value) => normalize(value))
        .join(" ");

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        product.status === statusFilter;

      const matchesTracking =
        trackingFilter === "all" ||
        (trackingFilter === "tracked" &&
          isTracked(product)) ||
        (trackingFilter === "untracked" &&
          !isTracked(product));

      const matchesCategory =
        categoryFilter === "all" ||
        product.category === categoryFilter;

      const matchesBrand =
        brandFilter === "all" ||
        product.brand === brandFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesTracking &&
        matchesCategory &&
        matchesBrand
      );
    });
  }, [
    productRows,
    search,
    statusFilter,
    trackingFilter,
    categoryFilter,
    brandFilter,
  ]);

  const stats = useMemo(() => {
    const total = products.length;

    const active = products.filter(
      (product) => product.status === "active"
    ).length;

    const tracked = products.filter(isTracked).length;

    const untracked = total - tracked;

    const totalVariants = variants.length;

    const lowStock = productRows.filter(
      (product) =>
        isTracked(product) &&
        product.available <= 0
    ).length;

    return {
      total,
      active,
      tracked,
      untracked,
      totalVariants,
      lowStock,
    };
  }, [products, variants, productRows]);

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    trackingFilter !== "all" ||
    categoryFilter !== "all" ||
    brandFilter !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setTrackingFilter("all");
    setCategoryFilter("all");
    setBrandFilter("all");
  }

  function toggleExpanded(productId: string) {
    setExpandedProductId((current) =>
      current === productId ? null : productId
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="loading-card">
            <div className="spinner" />
            <span>Loading products...</span>
          </div>

          <style jsx>{styles}</style>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              INVENTORY CATALOG
            </div>

            <h1 className="page-title">
              Products
            </h1>

            <p className="page-subtitle">
              Manage your product catalog, variants and
              inventory tracking behavior.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadProducts(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={
                  refreshing ? "spin" : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                router.push("/products/new")
              }
            >
              <Plus size={17} />
              New Product
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="alert alert-error">
            <CircleAlert size={18} />
            <div>
              <strong>Unable to load products</strong>
              <span>{errorMessage}</span>
            </div>

            <button
              type="button"
              className="alert-close"
              onClick={() => setErrorMessage("")}
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        {successMessage ? (
          <div className="alert alert-success">
            <Activity size={18} />
            <span>{successMessage}</span>

            <button
              type="button"
              className="alert-close"
              onClick={() => setSuccessMessage("")}
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        <div className="stats-grid">
          <StatCard
            label="Total Products"
            value={formatNumber(stats.total)}
            helper="Catalog products"
            icon={<Package size={19} />}
          />

          <StatCard
            label="Active"
            value={formatNumber(stats.active)}
            helper="Currently active"
            icon={<Activity size={19} />}
          />

          <StatCard
            label="Tracked"
            value={formatNumber(stats.tracked)}
            helper="Inventory managed"
            icon={<Warehouse size={19} />}
          />

          <StatCard
            label="Not Tracked"
            value={formatNumber(stats.untracked)}
            helper="No inventory tracking"
            icon={<Archive size={19} />}
          />

          <StatCard
            label="Total Variants"
            value={formatNumber(
              stats.totalVariants
            )}
            helper="Product variants"
            icon={<Layers3 size={19} />}
          />

          <StatCard
            label="Out of Stock"
            value={formatNumber(stats.lowStock)}
            helper="Tracked products"
            icon={<CircleAlert size={19} />}
          />
        </div>

        <div className="toolbar-card">
          <div className="search-wrap">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search products, SKU, barcode, brand..."
            />

            {search ? (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearch("")}
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className={`filter-toggle ${
              showFilters ? "active" : ""
            }`}
            onClick={() =>
              setShowFilters((value) => !value)
            }
          >
            <SlidersHorizontal size={16} />
            Filters
            {hasFilters ? (
              <span className="filter-count">
                {
                  [
                    search.trim() !== "",
                    statusFilter !== "all",
                    trackingFilter !== "all",
                    categoryFilter !== "all",
                    brandFilter !== "all",
                  ].filter(Boolean).length
                }
              </span>
            ) : null}
          </button>

          {hasFilters ? (
            <button
              type="button"
              className="clear-filters"
              onClick={clearFilters}
            >
              Clear all
            </button>
          ) : null}
        </div>

        {showFilters ? (
          <div className="filters-card">
            <div className="filter-group">
              <label>Status</label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">
                  All statuses
                </option>
                <option value="active">
                  Active
                </option>
                <option value="inactive">
                  Inactive
                </option>
                <option value="archived">
                  Archived
                </option>
              </select>
            </div>

            <div className="filter-group">
              <label>Inventory Tracking</label>

              <select
                value={trackingFilter}
                onChange={(event) =>
                  setTrackingFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All tracking
                </option>
                <option value="tracked">
                  Tracked
                </option>
                <option value="untracked">
                  Not Tracked
                </option>
              </select>
            </div>

            <div className="filter-group">
              <label>Category</label>

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All categories
                </option>

                {categories.map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Brand</label>

              <select
                value={brandFilter}
                onChange={(event) =>
                  setBrandFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All brands
                </option>

                {brands.map((brand) => (
                  <option
                    key={brand}
                    value={brand}
                  >
                    {brand}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        <div className="content-card">
          <div className="content-card-header">
            <div>
              <div className="section-title">
                Product Catalog
              </div>

              <div className="section-helper">
                {filteredProducts.length ===
                products.length
                  ? `${formatNumber(
                      products.length
                    )} products`
                  : `${formatNumber(
                      filteredProducts.length
                    )} of ${formatNumber(
                      products.length
                    )} products`}
              </div>
            </div>

            <div className="table-meta">
              <Tags size={15} />
              {hasFilters
                ? "Filtered results"
                : "All products"}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Package size={25} />
              </div>

              <h3>
                {products.length === 0
                  ? "No products yet"
                  : "No matching products"}
              </h3>

              <p>
                {products.length === 0
                  ? "Create your first product to start building your catalog."
                  : "Try changing your search or filters."}
              </p>

              <div className="empty-actions">
                {products.length === 0 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      router.push(
                        "/products/new"
                      )
                    }
                  >
                    <Plus size={16} />
                    New Product
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={clearFilters}
                  >
                    <Filter size={16} />
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th className="product-column">
                      Product
                    </th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Variants</th>
                    <th>Tracking</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th className="actions-column">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map(
                    (product) => {
                      const expanded =
                        expandedProductId ===
                        product.id;

                      const defaultVariant =
                        product.variants.find(
                          (variant) =>
                            variant.is_default
                        ) ||
                        product.variants[0];

                      return (
                        <React.Fragment
                          key={product.id}
                        >
                          <tr
                            className={
                              expanded
                                ? "product-row expanded"
                                : "product-row"
                            }
                          >
                            <td>
                              <div className="product-cell">
                                <button
                                  type="button"
                                  className="expand-button"
                                  onClick={() =>
                                    toggleExpanded(
                                      product.id
                                    )
                                  }
                                  aria-label={
                                    expanded
                                      ? "Collapse product"
                                      : "Expand product"
                                  }
                                >
                                  {expanded ? (
                                    <ChevronDown
                                      size={16}
                                    />
                                  ) : (
                                    <ChevronRight
                                      size={16}
                                    />
                                  )}
                                </button>

                                <div className="product-avatar">
                                  <Package
                                    size={18}
                                  />
                                </div>

                                <div className="product-copy">
                                  <button
                                    type="button"
                                    className="product-name"
                                    onClick={() =>
                                      router.push(
                                        `/products/${product.id}`
                                      )
                                    }
                                  >
                                    {product.name}
                                  </button>

                                  <div className="product-sub">
                                    {defaultVariant
                                      ?.sku ||
                                      defaultVariant
                                        ?.barcode ||
                                      PRODUCT_TYPE_LABELS[
                                        product.product_type
                                      ] ||
                                      product.product_type}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="muted-cell">
                                {product.brand ||
                                  "—"}
                              </span>
                            </td>

                            <td>
                              <span className="category-pill">
                                {product.category ||
                                  "Uncategorized"}
                              </span>
                            </td>

                            <td>
                              <div className="variant-count">
                                <Layers3
                                  size={14}
                                />
                                {product.variants.length}
                              </div>
                            </td>

                            <td>
                              <span
                                className={
                                  isTracked(product)
                                    ? "tracking-pill tracked"
                                    : "tracking-pill untracked"
                                }
                              >
                                <span className="tracking-dot" />
                                {getTrackingLabel(
                                  product
                                )}
                              </span>
                            </td>

                            <td>
                              {isTracked(product) ? (
                                <div className="stock-cell">
                                  <strong>
                                    {formatNumber(
                                      product.available
                                    )}
                                  </strong>

                                  <span>
                                    {product.reserved >
                                    0
                                      ? `${formatNumber(
                                          product.reserved
                                        )} reserved`
                                      : "available"}
                                  </span>
                                </div>
                              ) : (
                                <span className="muted-cell">
                                  —
                                </span>
                              )}
                            </td>

                            <td>
                              <span
                                className={getStatusClass(
                                  product.status
                                )}
                              >
                                <span className="status-dot" />
                                {STATUS_LABELS[
                                  product.status
                                ] ||
                                  product.status}
                              </span>
                            </td>

                            <td>
                              <span className="date-cell">
                                {formatDate(
                                  product.updated_at
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="icon-action"
                                  title="View product"
                                  onClick={() =>
                                    router.push(
                                      `/products/${product.id}`
                                    )
                                  }
                                >
                                  <Eye size={16} />
                                </button>

                                <button
                                  type="button"
                                  className="icon-action"
                                  title="Manage product"
                                  onClick={() =>
                                    router.push(
                                      `/products/${product.id}/edit`
                                    )
                                  }
                                >
                                  <SlidersHorizontal
                                    size={16}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {expanded ? (
                            <tr className="variant-detail-row">
                              <td
                                colSpan={9}
                              >
                                <div className="variant-panel">
                                  <div className="variant-panel-header">
                                    <div>
                                      <div className="variant-panel-title">
                                        Variants
                                      </div>
                                      <div className="variant-panel-helper">
                                        {product.variants.length ===
                                        0
                                          ? "No variants configured."
                                          : `${formatNumber(
                                              product
                                                .variants
                                                .length
                                            )} variant${
                                              product
                                                .variants
                                                .length ===
                                              1
                                                ? ""
                                                : "s"
                                            }`}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      className="btn btn-small"
                                      onClick={() =>
                                        router.push(
                                          `/products/${product.id}/edit`
                                        )
                                      }
                                    >
                                      Manage Variants
                                      <ChevronRight
                                        size={15}
                                      />
                                    </button>
                                  </div>

                                  {product
                                    .variants
                                    .length >
                                  0 ? (
                                    <div className="variant-grid">
                                      {product.variants.map(
                                        (
                                          variant
                                        ) => (
                                          <div
                                            key={
                                              variant.id
                                            }
                                            className="variant-card"
                                          >
                                            <div className="variant-card-top">
                                              <div className="variant-icon">
                                                <Layers3
                                                  size={
                                                    16
                                                  }
                                                />
                                              </div>

                                              <div className="variant-name">
                                                {
                                                  variant.name
                                                }

                                                {variant.is_default ? (
                                                  <span className="default-badge">
                                                    Default
                                                  </span>
                                                ) : null}
                                              </div>
                                            </div>

                                            <div className="variant-meta">
                                              <div>
                                                <span>
                                                  SKU
                                                </span>
                                                <strong>
                                                  {variant.sku ||
                                                    "—"}
                                                </strong>
                                              </div>

                                              <div>
                                                <span>
                                                  Barcode
                                                </span>
                                                <strong>
                                                  {variant.barcode ||
                                                    "—"}
                                                </strong>
                                              </div>

                                              <div>
                                                <span>
                                                  Cost
                                                </span>
                                                <strong>
                                                  {new Intl.NumberFormat(
                                                    "en-US",
                                                    {
                                                      style:
                                                        "currency",
                                                      currency:
                                                        "USD",
                                                      maximumFractionDigits: 2,
                                                    }
                                                  ).format(
                                                    Number(
                                                      variant.cost_price ||
                                                        0
                                                    )
                                                  )}
                                                </strong>
                                              </div>

                                              <div>
                                                <span>
                                                  Sell
                                                </span>
                                                <strong>
                                                  {new Intl.NumberFormat(
                                                    "en-US",
                                                    {
                                                      style:
                                                        "currency",
                                                      currency:
                                                        "USD",
                                                      maximumFractionDigits: 2,
                                                    }
                                                  ).format(
                                                    Number(
                                                      variant.selling_price ||
                                                        0
                                                    )
                                                  )}
                                                </strong>
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <div className="variant-empty">
                                      <Layers3
                                        size={18}
                                      />
                                      <span>
                                        This product does
                                        not have any
                                        variants yet.
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <style jsx>{styles}</style>
      </div>
    </AppShell>
  );
}

const styles = `
  .inventory-page {
    min-height: 100%;
    padding: 28px;
  }

  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin-bottom: 7px;
  }

  .eyebrow-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #166534;
    display: inline-block;
  }

  .page-title {
    margin: 0;
    color: #0f172a;
    font-size: 30px;
    line-height: 1.15;
    font-weight: 750;
    letter-spacing: -0.025em;
  }

  .page-subtitle {
    margin: 7px 0 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.5;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn {
    min-height: 40px;
    border-radius: 10px;
    border: 1px solid #d1d5db;
    background: #fff;
    color: #334155;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: 0.15s ease;
  }

  .btn:hover {
    border-color: #94a3b8;
    background: #f8fafc;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    color: #fff;
    background: #166534;
    border-color: #166534;
  }

  .btn-primary:hover {
    background: #14532d;
    border-color: #14532d;
  }

  .btn-secondary {
    background: #fff;
  }

  .btn-small {
    min-height: 34px;
    padding: 0 11px;
    font-size: 12px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .stat-card {
    min-height: 112px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 17px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    box-shadow: 0 2px 7px rgba(15, 23, 42, 0.035);
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #f0fdf4;
    color: #166534;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  .stat-copy {
    min-width: 0;
  }

  .stat-label {
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .stat-value {
    color: #0f172a;
    font-size: 23px;
    font-weight: 750;
    line-height: 1.15;
    margin-top: 5px;
  }

  .stat-helper {
    color: #94a3b8;
    font-size: 11px;
    margin-top: 5px;
    white-space: nowrap;
  }

  .toolbar-card {
    min-height: 64px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 11px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    box-shadow: 0 2px 7px rgba(15, 23, 42, 0.035);
  }

  .search-wrap {
    height: 40px;
    flex: 1;
    min-width: 260px;
    border: 1px solid #dbe1e8;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 11px;
    color: #94a3b8;
    background: #fff;
  }

  .search-wrap:focus-within {
    border-color: #86a98f;
    box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
  }

  .search-wrap input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    color: #0f172a;
    font-size: 13px;
    background: transparent;
  }

  .search-wrap input::placeholder {
    color: #94a3b8;
  }

  .clear-search,
  .alert-close {
    border: 0;
    background: transparent;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 3px;
  }

  .clear-search:hover,
  .alert-close:hover {
    color: #475569;
  }

  .filter-toggle {
    height: 40px;
    border: 1px solid #dbe1e8;
    background: #fff;
    color: #475569;
    border-radius: 10px;
    padding: 0 12px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
    white-space: nowrap;
  }

  .filter-toggle:hover,
  .filter-toggle.active {
    border-color: #a7c2ad;
    color: #166534;
    background: #f7fbf8;
  }

  .filter-count {
    min-width: 19px;
    height: 19px;
    padding: 0 5px;
    border-radius: 999px;
    background: #166534;
    color: #fff;
    font-size: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .clear-filters {
    border: 0;
    background: transparent;
    color: #166534;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    padding: 8px;
  }

  .filters-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 15px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 10px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-group label {
    color: #475569;
    font-size: 11px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.035em;
  }

  .filter-group select {
    height: 38px;
    border: 1px solid #dbe1e8;
    border-radius: 9px;
    padding: 0 10px;
    color: #334155;
    background: #fff;
    outline: none;
    font-size: 13px;
  }

  .filter-group select:focus {
    border-color: #86a98f;
    box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
  }

  .content-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 2px 7px rgba(15, 23, 42, 0.035);
  }

  .content-card-header {
    min-height: 70px;
    padding: 16px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  .section-title {
    color: #0f172a;
    font-size: 15px;
    font-weight: 750;
  }

  .section-helper {
    color: #94a3b8;
    font-size: 12px;
    margin-top: 3px;
  }

  .table-meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #64748b;
    font-size: 12px;
    font-weight: 650;
  }

  .table-scroll {
    overflow-x: auto;
  }

  .products-table {
    width: 100%;
    min-width: 1180px;
    border-collapse: separate;
    border-spacing: 0;
  }

  .products-table th {
    height: 43px;
    padding: 0 14px;
    text-align: left;
    background: #f8fafc;
    color: #64748b;
    border-bottom: 1px solid #e5e7eb;
    font-size: 10px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.055em;
    white-space: nowrap;
  }

  .products-table td {
    padding: 13px 14px;
    border-bottom: 1px solid #eef2f5;
    color: #334155;
    font-size: 13px;
    vertical-align: middle;
  }

  .product-row:hover td {
    background: #fcfdfd;
  }

  .product-row.expanded td {
    background: #fbfdfb;
    border-bottom-color: #e2e8e4;
  }

  .product-column {
    width: 310px;
  }

  .actions-column {
    width: 88px;
    text-align: right !important;
  }

  .product-cell {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .expand-button {
    width: 27px;
    height: 27px;
    flex: 0 0 auto;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #64748b;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .expand-button:hover {
    color: #166534;
    border-color: #b8ccb9;
    background: #f7fbf8;
  }

  .product-avatar {
    width: 36px;
    height: 36px;
    flex: 0 0 auto;
    border-radius: 9px;
    background: #f1f5f9;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-copy {
    min-width: 0;
  }

  .product-name {
    display: block;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: 0;
    background: transparent;
    padding: 0;
    color: #0f172a;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
    text-align: left;
  }

  .product-name:hover {
    color: #166534;
  }

  .product-sub {
    color: #94a3b8;
    font-size: 11px;
    margin-top: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 250px;
  }

  .muted-cell {
    color: #64748b;
  }

  .category-pill {
    display: inline-flex;
    align-items: center;
    max-width: 150px;
    padding: 5px 8px;
    border-radius: 7px;
    background: #f8fafc;
    color: #475569;
    font-size: 11px;
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .variant-count {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #475569;
    font-weight: 700;
  }

  .tracking-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    padding: 5px 8px;
    font-size: 11px;
    font-weight: 750;
    white-space: nowrap;
  }

  .tracking-pill.tracked {
    color: #166534;
    background: #f0fdf4;
  }

  .tracking-pill.untracked {
    color: #64748b;
    background: #f1f5f9;
  }

  .tracking-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: currentColor;
  }

  .stock-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stock-cell strong {
    color: #0f172a;
    font-size: 13px;
  }

  .stock-cell span {
    color: #94a3b8;
    font-size: 10px;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 750;
    white-space: nowrap;
  }

  .status-active {
    color: #166534;
    background: #f0fdf4;
  }

  .status-inactive {
    color: #92400e;
    background: #fffbeb;
  }

  .status-archived {
    color: #64748b;
    background: #f1f5f9;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: currentColor;
  }

  .date-cell {
    color: #64748b;
    white-space: nowrap;
    font-size: 12px;
  }

  .row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;
  }

  .icon-action {
    width: 32px;
    height: 32px;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #64748b;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .icon-action:hover {
    color: #166534;
    border-color: #b8ccb9;
    background: #f7fbf8;
  }

  .variant-detail-row td {
    padding: 0;
    background: #fbfdfb;
  }

  .variant-panel {
    padding: 16px 20px 18px 72px;
    border-bottom: 1px solid #e5e7eb;
  }

  .variant-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 13px;
  }

  .variant-panel-title {
    color: #334155;
    font-size: 12px;
    font-weight: 750;
  }

  .variant-panel-helper {
    color: #94a3b8;
    font-size: 11px;
    margin-top: 2px;
  }

  .variant-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .variant-card {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #fff;
    padding: 12px;
  }

  .variant-card-top {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .variant-icon {
    width: 29px;
    height: 29px;
    flex: 0 0 auto;
    border-radius: 8px;
    background: #f1f5f9;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .variant-name {
    min-width: 0;
    color: #0f172a;
    font-size: 12px;
    font-weight: 750;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .default-badge {
    flex: 0 0 auto;
    padding: 3px 6px;
    border-radius: 999px;
    background: #f0fdf4;
    color: #166534;
    font-size: 9px;
    font-weight: 750;
    text-transform: uppercase;
  }

  .variant-meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 12px;
  }

  .variant-meta > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .variant-meta span {
    color: #94a3b8;
    font-size: 9px;
    text-transform: uppercase;
    font-weight: 750;
    letter-spacing: 0.04em;
  }

  .variant-meta strong {
    color: #475569;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .variant-empty {
    min-height: 65px;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #94a3b8;
    font-size: 12px;
  }

  .empty-state {
    padding: 68px 24px;
    text-align: center;
  }

  .empty-icon {
    width: 52px;
    height: 52px;
    margin: 0 auto 14px;
    border-radius: 14px;
    background: #f1f5f9;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-state h3 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
    font-weight: 750;
  }

  .empty-state p {
    margin: 7px auto 0;
    max-width: 420px;
    color: #94a3b8;
    font-size: 13px;
    line-height: 1.5;
  }

  .empty-actions {
    margin-top: 17px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .loading-card {
    min-height: 280px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #64748b;
    font-size: 13px;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #dbe5de;
    border-top-color: #166534;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spin {
    animation: spin 0.8s linear infinite;
  }

  .alert {
    min-height: 52px;
    border-radius: 12px;
    padding: 11px 13px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    font-size: 13px;
  }

  .alert > div {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .alert strong {
    font-size: 12px;
  }

  .alert span {
    font-size: 12px;
  }

  .alert-error {
    border: 1px solid #fecaca;
    background: #fff7f7;
    color: #991b1b;
  }

  .alert-success {
    border: 1px solid #bbf7d0;
    background: #f0fdf4;
    color: #166534;
  }

  .alert-close {
    margin-left: auto;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1400px) {
    .stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .inventory-page {
      padding: 20px;
    }

    .page-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions .btn {
      flex: 1;
    }

    .filters-card {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .variant-grid {
      grid-template-columns: 1fr;
    }

    .variant-panel {
      padding-left: 20px;
    }
  }

  @media (max-width: 620px) {
    .inventory-page {
      padding: 15px;
    }

    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .toolbar-card {
      flex-wrap: wrap;
    }

    .search-wrap {
      min-width: 100%;
      order: 1;
    }

    .filter-toggle,
    .clear-filters {
      order: 2;
    }

    .filters-card {
      grid-template-columns: 1fr;
    }

    .content-card-header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;