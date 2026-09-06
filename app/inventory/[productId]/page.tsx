"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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
  tracking_mode: "none" | "quantity" | "batch" | "serial" | null;
  track_inventory: boolean;
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
  cost_price: number | string | null;
  selling_price: number | string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type InventoryRow = {
  id: string;
  company_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  reserved_quantity: number;
  reorder_level: number;
  reorder_quantity: number;
  warehouse_id: string | null;
  location_id: string | null;
  created_at: string;
  updated_at: string;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
  is_active: boolean;
};

type Movement = {
  id: string;
  company_id: string;
  product_id: string;
  variant_id: string;
  warehouse_id: string | null;
  location_id: string | null;
  movement_type: string;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function numberValue(
  value: string | number | null | undefined
) {
  const result = Number(value);

  return Number.isFinite(result) ? result : 0;
}

function formatMoney(
  value: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getAvailable(
  inventory: InventoryRow
) {
  return Math.max(
    numberValue(inventory.quantity) -
      numberValue(inventory.reserved_quantity),
    0
  );
}

function trackingLabel(
  mode: Product["tracking_mode"]
) {
  switch (mode) {
    case "quantity":
      return "Quantity tracked";
    case "batch":
      return "Batch tracked";
    case "serial":
      return "Serial tracked";
    case "none":
      return "Inventory not tracked";
    default:
      return "Unknown tracking";
  }
}

function movementIsIncoming(
  movementType: string
) {
  return [
    "stock_in",
    "purchase",
    "return",
    "transfer_in",
    "adjustment_in",
  ].includes(movementType);
}

/* -------------------------------------------------------------------------- */
/* Icon                                                                       */
/* -------------------------------------------------------------------------- */

type IconName =
  | "arrow"
  | "back"
  | "box"
  | "warehouse"
  | "location"
  | "layers"
  | "serial"
  | "refresh"
  | "external"
  | "check"
  | "warning"
  | "alert"
  | "trend"
  | "tag";

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
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    case "back":
      return (
        <svg {...common}>
          <path d="M19 12H5" />
          <path d="m11 18-6-6 6-6" />
        </svg>
      );

    case "box":
      return (
        <svg {...common}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="M4 7.5 12 12l8-4.5" />
          <path d="M12 12v9" />
        </svg>
      );

    case "warehouse":
      return (
        <svg {...common}>
          <path d="M3 10 12 4l9 6" />
          <path d="M5 9v10h14V9" />
          <path d="M9 19v-5h6v5" />
          <path d="M8 11h.01M12 11h.01M16 11h.01" />
        </svg>
      );

    case "location":
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
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

    case "serial":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 9v6M11 9v6M14 9v6M17 9v6" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.7-4L4 9" />
          <path d="M4 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.7 4L20 15" />
          <path d="M20 20v-5h-5" />
        </svg>
      );

    case "external":
      return (
        <svg {...common}>
          <path d="M14 5h5v5" />
          <path d="m19 5-8 8" />
          <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "warning":
      return (
        <svg {...common}>
          <path d="M12 3 2.5 20h19L12 3Z" />
          <path d="M12 9v5" />
          <path d="M12 17h.01" />
        </svg>
      );

    case "alert":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
        </svg>
      );

    case "trend":
      return (
        <svg {...common}>
          <path d="m4 16 5-5 4 3 7-8" />
          <path d="M15 6h5v5" />
        </svg>
      );

    case "tag":
      return (
        <svg {...common}>
          <path d="M20 13 13 20l-9-9V4h7l9 9Z" />
          <path d="M8 8h.01" />
        </svg>
      );

    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Stat Card                                                                  */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: IconName;
}) {
  return (
    <div
      className="rounded-xl bg-white p-5"
      style={{
        border: "1px solid #e2e8f0",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {description}
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-2.5 text-slate-500">
          <Icon name={icon} size={19} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function InventoryProductDetailPage() {
  const params = useParams();
  const productId = String(
    params.productId ?? ""
  );

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [currency, setCurrency] =
    useState("USD");

  const [product, setProduct] =
    useState<Product | null>(null);

  const [variants, setVariants] = useState<
    ProductVariant[]
  >([]);

  const [inventory, setInventory] = useState<
    InventoryRow[]
  >([]);

  const [warehouses, setWarehouses] = useState<
    Warehouse[]
  >([]);

  const [locations, setLocations] = useState<
    WarehouseLocation[]
  >([]);

  const [movements, setMovements] = useState<
    Movement[]
  >([]);

  /* ------------------------------------------------------------------------ */
  /* Load                                                                     */
  /* ------------------------------------------------------------------------ */

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (!productId) {
        setErrorMessage(
          "A product was not specified."
        );
        setLoading(false);
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const {
          data: {
            user,
          },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "You must be signed in to view inventory."
          );
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
            "No company membership was found for this account."
          );
        }

        const companyId =
          membership.company_id;

        const [
          companyResult,
          productResult,
          variantsResult,
          inventoryResult,
          warehousesResult,
          locationsResult,
          movementsResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select("currency")
            .eq("id", companyId)
            .maybeSingle(),

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
                tracking_mode,
                track_inventory,
                created_at,
                updated_at
              `
            )
            .eq("id", productId)
            .eq("company_id", companyId)
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
                created_at,
                updated_at
              `
            )
            .eq("company_id", companyId)
            .eq("product_id", productId)
            .order("is_default", {
              ascending: false,
            })
            .order("name"),

          supabase
            .from("inventory")
            .select(
              `
                id,
                company_id,
                product_id,
                variant_id,
                quantity,
                reserved_quantity,
                reorder_level,
                reorder_quantity,
                warehouse_id,
                location_id,
                created_at,
                updated_at
              `
            )
            .eq("company_id", companyId)
            .eq("product_id", productId),

          supabase
            .from("warehouses")
            .select(
              `
                id,
                name,
                code,
                is_active
              `
            )
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("warehouse_locations")
            .select(
              `
                id,
                warehouse_id,
                name,
                code,
                is_active
              `
            )
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("inventory_movements")
            .select(
              `
                id,
                company_id,
                product_id,
                variant_id,
                warehouse_id,
                location_id,
                movement_type,
                quantity,
                quantity_before,
                quantity_after,
                reason,
                reference_type,
                reference_id,
                notes,
                created_at
              `
            )
            .eq("company_id", companyId)
            .eq("product_id", productId)
            .order("created_at", {
              ascending: false,
            })
            .limit(50),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (productResult.error) {
          throw productResult.error;
        }

        if (variantsResult.error) {
          throw variantsResult.error;
        }

        if (inventoryResult.error) {
          throw inventoryResult.error;
        }

        if (warehousesResult.error) {
          throw warehousesResult.error;
        }

        if (locationsResult.error) {
          throw locationsResult.error;
        }

        if (movementsResult.error) {
          throw movementsResult.error;
        }

        if (!productResult.data) {
          throw new Error(
            "The requested product could not be found."
          );
        }

        setCurrency(
          typeof companyResult.data?.currency ===
            "string"
            ? companyResult.data.currency
            : "USD"
        );

        setProduct(
          productResult.data as Product
        );

        setVariants(
          (variantsResult.data ??
            []) as ProductVariant[]
        );

        setInventory(
          (inventoryResult.data ??
            []) as InventoryRow[]
        );

        setWarehouses(
          (warehousesResult.data ??
            []) as Warehouse[]
        );

        setLocations(
          (locationsResult.data ??
            []) as WarehouseLocation[]
        );

        setMovements(
          (movementsResult.data ??
            []) as Movement[]
        );
      } catch (error) {
        console.error(
          "Inventory product detail load error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load product inventory."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [productId, supabase]
  );

  useEffect(() => {
    // Initial product inventory detail load.
    // The function performs async Supabase requests and updates local state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  /* ------------------------------------------------------------------------ */
  /* Maps                                                                      */
  /* ------------------------------------------------------------------------ */

  const variantMap = useMemo(
    () =>
      new Map(
        variants.map((variant) => [
          variant.id,
          variant,
        ])
      ),
    [variants]
  );

  const warehouseMap = useMemo(
    () =>
      new Map(
        warehouses.map((warehouse) => [
          warehouse.id,
          warehouse,
        ])
      ),
    [warehouses]
  );

  const locationMap = useMemo(
    () =>
      new Map(
        locations.map((location) => [
          location.id,
          location,
        ])
      ),
    [locations]
  );

  /* ------------------------------------------------------------------------ */
  /* Totals                                                                    */
  /* ------------------------------------------------------------------------ */

  const totalUnits = useMemo(
    () =>
      inventory.reduce(
        (sum, row) =>
          sum + numberValue(row.quantity),
        0
      ),
    [inventory]
  );

  const totalReserved = useMemo(
    () =>
      inventory.reduce(
        (sum, row) =>
          sum +
          numberValue(row.reserved_quantity),
        0
      ),
    [inventory]
  );

  const totalAvailable = Math.max(
    totalUnits - totalReserved,
    0
  );

  const totalInventoryValue = useMemo(
    () =>
      inventory.reduce((sum, row) => {
        const variant =
          variantMap.get(row.variant_id);

        return (
          sum +
          numberValue(row.quantity) *
            numberValue(
              variant?.cost_price
            )
        );
      }, 0),
    [inventory, variantMap]
  );

  const totalRetailValue = useMemo(
    () =>
      inventory.reduce((sum, row) => {
        const variant =
          variantMap.get(row.variant_id);

        return (
          sum +
          numberValue(row.quantity) *
            numberValue(
              variant?.selling_price
            )
        );
      }, 0),
    [inventory, variantMap]
  );

  const lowStockLocations = useMemo(
    () =>
      inventory.filter((row) => {
        const available =
          getAvailable(row);

        return (
          numberValue(
            row.reorder_level
          ) > 0 &&
          available <=
            numberValue(
              row.reorder_level
            )
        );
      }).length,
    [inventory]
  );

  const outOfStockLocations = useMemo(
    () =>
      inventory.filter(
        (row) =>
          getAvailable(row) <= 0
      ).length,
    [inventory]
  );

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                  */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1500px] px-6 py-8">
            <div className="animate-pulse">
              <div className="h-5 w-24 rounded bg-slate-200" />
              <div className="mt-5 h-9 w-80 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-96 rounded bg-slate-200" />

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({
                  length: 4,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="h-32 rounded-xl bg-white"
                    style={{
                      border:
                        "1px solid #e2e8f0",
                    }}
                  />
                ))}
              </div>

              <div
                className="mt-6 h-80 rounded-xl bg-white"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Error                                                                    */
  /* ------------------------------------------------------------------------ */

  if (errorMessage || !product) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1500px] px-6 py-8">
            <Link
              href="/inventory"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              <Icon
                name="back"
                size={16}
              />
              Back to Inventory
            </Link>

            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
              <div className="flex items-start gap-3">
                <Icon
                  name="alert"
                  size={20}
                />

                <div>
                  <div className="font-semibold">
                    Unable to load product inventory
                  </div>

                  <div className="mt-1 text-sm">
                    {errorMessage ||
                      "The requested product could not be found."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1500px] px-6 py-8">
          {/* Header --------------------------------------------------------- */}

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link
                href="/inventory"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
              >
                <Icon
                  name="back"
                  size={16}
                />
                Back to Inventory
              </Link>

              <div className="mt-5 flex items-start gap-4">
                <div className="rounded-xl bg-slate-900 p-3 text-white">
                  <Icon
                    name="box"
                    size={23}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                      {product.name}
                    </h1>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        product.status ===
                        "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {product.status}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    {product.brand ? (
                      <span>
                        {product.brand}
                      </span>
                    ) : null}

                    {product.category ? (
                      <>
                        <span>•</span>
                        <span>
                          {product.category}
                        </span>
                      </>
                    ) : null}

                    <span>•</span>

                    <span>
                      {trackingLabel(
                        product.tracking_mode
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/products/${product.id}/edit`}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                Edit Product
                <Icon
                  name="external"
                  size={15}
                />
              </Link>

              {product.tracking_mode ===
              "serial" ? (
                <Link
                  href="/serial-numbers"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  style={{
                    border:
                      "1px solid #e2e8f0",
                  }}
                >
                  <Icon
                    name="serial"
                    size={16}
                  />
                  Serial Numbers
                </Link>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  void loadData(true)
                }
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                <Icon
                  name="refresh"
                  size={16}
                />
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
            </div>
          </div>

          {/* Description --------------------------------------------------- */}

          {product.description ? (
            <div className="mt-5 max-w-4xl text-sm leading-6 text-slate-500">
              {product.description}
            </div>
          ) : null}

          {/* Stats ---------------------------------------------------------- */}

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Units"
              value={totalUnits.toLocaleString()}
              description={`${totalAvailable.toLocaleString()} available`}
              icon="layers"
            />

            <StatCard
              label="Reserved"
              value={totalReserved.toLocaleString()}
              description="Units currently reserved"
              icon="tag"
            />

            <StatCard
              label="Inventory Value"
              value={formatMoney(
                totalInventoryValue,
                currency
              )}
              description="Current stock at cost"
              icon="trend"
            />

            <StatCard
              label="Retail Value"
              value={formatMoney(
                totalRetailValue,
                currency
              )}
              description="Current stock at selling price"
              icon="box"
            />
          </div>

          {/* Alerts --------------------------------------------------------- */}

          {(lowStockLocations > 0 ||
            outOfStockLocations > 0) && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {lowStockLocations > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                  <div className="flex items-start gap-3">
                    <Icon
                      name="warning"
                      size={19}
                    />

                    <div>
                      <div className="text-sm font-semibold">
                        Low stock
                      </div>

                      <div className="mt-1 text-xs leading-5">
                        {lowStockLocations}{" "}
                        {lowStockLocations ===
                        1
                          ? "inventory location is"
                          : "inventory locations are"}{" "}
                        at or below their reorder
                        level.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {outOfStockLocations > 0 ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                  <div className="flex items-start gap-3">
                    <Icon
                      name="alert"
                      size={19}
                    />

                    <div>
                      <div className="text-sm font-semibold">
                        Out of stock
                      </div>

                      <div className="mt-1 text-xs leading-5">
                        {outOfStockLocations}{" "}
                        {outOfStockLocations ===
                        1
                          ? "inventory location has"
                          : "inventory locations have"}{" "}
                        no available units.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Variants ------------------------------------------------------- */}

          <div
            className="mt-6 overflow-hidden rounded-xl bg-white"
            style={{
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Product Variants
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {variants.length}{" "}
                    {variants.length === 1
                      ? "variant"
                      : "variants"}{" "}
                    associated with this product.
                  </p>
                </div>

                <span className="text-xs text-slate-400">
                  {variants.filter(
                    (variant) =>
                      variant.is_active
                  ).length}{" "}
                  active
                </span>
              </div>
            </div>

            {variants.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No variants found for this
                product.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Variant
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        SKU
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Barcode
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Cost
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Selling
                      </th>

                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {variants.map(
                      (variant) => (
                        <tr
                          key={variant.id}
                          className="border-b border-slate-100"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {
                                  variant.name
                                }
                              </span>

                              {variant.is_default ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                  Default
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-500">
                            {variant.sku ||
                              "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-500">
                            {variant.barcode ||
                              "—"}
                          </td>

                          <td className="px-5 py-4 text-right text-sm text-slate-700">
                            {formatMoney(
                              numberValue(
                                variant.cost_price
                              ),
                              currency
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-sm text-slate-700">
                            {formatMoney(
                              numberValue(
                                variant.selling_price
                              ),
                              currency
                            )}
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                variant.is_active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {variant.is_active
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stock by location ---------------------------------------------- */}

          <div
            className="mt-6 overflow-hidden rounded-xl bg-white"
            style={{
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div className="border-b border-slate-200 p-5">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Stock by Warehouse & Location
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Current inventory balances for every
                  warehouse/location assigned to this
                  product.
                </p>
              </div>
            </div>

            {inventory.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Icon
                    name="warehouse"
                    size={22}
                  />
                </div>

                <div className="mt-4 text-sm font-semibold text-slate-900">
                  No stock records
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  This product has not been allocated
                  to a warehouse/location yet.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1050px] w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Variant
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Warehouse
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Location
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Quantity
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Reserved
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Available
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Reorder
                      </th>

                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {inventory.map(
                      (row) => {
                        const variant =
                          variantMap.get(
                            row.variant_id
                          );

                        const warehouse =
                          row.warehouse_id
                            ? warehouseMap.get(
                                row.warehouse_id
                              )
                            : null;

                        const location =
                          row.location_id
                            ? locationMap.get(
                                row.location_id
                              )
                            : null;

                        const available =
                          getAvailable(row);

                        const reorderLevel =
                          numberValue(
                            row.reorder_level
                          );

                        const outOfStock =
                          available <= 0;

                        const lowStock =
                          !outOfStock &&
                          reorderLevel > 0 &&
                          available <=
                            reorderLevel;

                        return (
                          <tr
                            key={row.id}
                            className="border-b border-slate-100"
                          >
                            <td className="px-5 py-4">
                              <div className="text-sm font-semibold text-slate-900">
                                {variant?.name ??
                                  "Unknown Variant"}
                              </div>

                              {variant?.sku ? (
                                <div className="mt-1 text-xs text-slate-400">
                                  SKU:{" "}
                                  {
                                    variant.sku
                                  }
                                </div>
                              ) : null}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <Icon
                                  name="warehouse"
                                  size={15}
                                />

                                <span className="text-sm text-slate-700">
                                  {warehouse?.name ??
                                    "Unassigned"}
                                </span>
                              </div>

                              {warehouse?.code ? (
                                <div className="mt-1 pl-5 text-xs text-slate-400">
                                  {
                                    warehouse.code
                                  }
                                </div>
                              ) : null}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <Icon
                                  name="location"
                                  size={15}
                                />

                                <span className="text-sm text-slate-700">
                                  {location?.name ??
                                    "No location"}
                                </span>
                              </div>

                              {location?.code ? (
                                <div className="mt-1 pl-5 text-xs text-slate-400">
                                  {
                                    location.code
                                  }
                                </div>
                              ) : null}
                            </td>

                            <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                              {numberValue(
                                row.quantity
                              ).toLocaleString()}
                            </td>

                            <td className="px-5 py-4 text-right text-sm text-slate-600">
                              {numberValue(
                                row.reserved_quantity
                              ).toLocaleString()}
                            </td>

                            <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                              {available.toLocaleString()}
                            </td>

                            <td className="px-5 py-4 text-right text-sm text-slate-600">
                              {reorderLevel > 0
                                ? reorderLevel.toLocaleString()
                                : "—"}
                            </td>

                            <td className="px-5 py-4 text-center">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  outOfStock
                                    ? "bg-red-50 text-red-700"
                                    : lowStock
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {outOfStock
                                  ? "Out of Stock"
                                  : lowStock
                                    ? "Low Stock"
                                    : "In Stock"}
                              </span>
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

          {/* Recent movements ----------------------------------------------- */}

          <div
            className="mt-6 overflow-hidden rounded-xl bg-white"
            style={{
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Movement History
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Latest stock ledger activity for this
                    product.
                  </p>
                </div>

                <span className="text-xs text-slate-400">
                  {movements.length} records
                </span>
              </div>
            </div>

            {movements.length === 0 ? (
              <div className="p-10 text-center">
                <Icon
                  name="layers"
                  size={24}
                />

                <div className="mt-3 text-sm font-semibold text-slate-900">
                  No movements yet
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  Stock movements will appear here as
                  inventory activity occurs.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {movements.map(
                  (movement) => {
                    const variant =
                      variantMap.get(
                        movement.variant_id
                      );

                    const warehouse =
                      movement.warehouse_id
                        ? warehouseMap.get(
                            movement.warehouse_id
                          )
                        : null;

                    const location =
                      movement.location_id
                        ? locationMap.get(
                            movement.location_id
                          )
                        : null;

                    const incoming =
                      movementIsIncoming(
                        movement.movement_type
                      );

                    return (
                      <div
                        key={movement.id}
                        className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`rounded-lg p-2 ${
                              incoming
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            <Icon
                              name="arrow"
                              size={17}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {movement.movement_type.replace(
                                  /_/g,
                                  " "
                                )}
                              </span>

                              <span className="text-xs text-slate-400">
                                {variant?.name ??
                                  "Unknown Variant"}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                              {warehouse ? (
                                <span>
                                  {
                                    warehouse.name
                                  }
                                </span>
                              ) : null}

                              {location ? (
                                <>
                                  <span>
                                    •
                                  </span>

                                  <span>
                                    {
                                      location.name
                                    }
                                  </span>
                                </>
                              ) : null}

                              <span>
                                •
                              </span>

                              <span>
                                {formatDateTime(
                                  movement.created_at
                                )}
                              </span>
                            </div>

                            {movement.reason ? (
                              <div className="mt-2 text-xs text-slate-500">
                                {
                                  movement.reason
                                }
                              </div>
                            ) : null}

                            {movement.reference_type ? (
                              <div className="mt-1 text-xs text-slate-400">
                                Reference:{" "}
                                {
                                  movement.reference_type
                                }
                                {movement.reference_id
                                  ? ` • ${movement.reference_id}`
                                  : ""}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-8 lg:justify-end">
                          <div className="text-right">
                            <div
                              className={`text-sm font-semibold ${
                                incoming
                                  ? "text-emerald-700"
                                  : "text-red-700"
                              }`}
                            >
                              {incoming
                                ? "+"
                                : "-"}
                              {numberValue(
                                movement.quantity
                              ).toLocaleString()}
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              {
                                movement.quantity_before
                              }{" "}
                              →{" "}
                              {
                                movement.quantity_after
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* Footer links --------------------------------------------------- */}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Link
              href="/inventory"
              className="group rounded-xl bg-white p-5 transition hover:border-slate-300"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                  <Icon
                    name="box"
                    size={18}
                  />
                </div>

                <Icon
                  name="arrow"
                  size={15}
                />
              </div>

              <div className="mt-4 text-sm font-semibold text-slate-900">
                Inventory Dashboard
              </div>

              <div className="mt-1 text-xs leading-5 text-slate-500">
                Return to the complete inventory overview.
              </div>
            </Link>

            <Link
              href="/inventory/receiving"
              className="group rounded-xl bg-white p-5 transition hover:border-slate-300"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                  <Icon
                    name="layers"
                    size={18}
                  />
                </div>

                <Icon
                  name="arrow"
                  size={15}
                />
              </div>

              <div className="mt-4 text-sm font-semibold text-slate-900">
                Receive Stock
              </div>

              <div className="mt-1 text-xs leading-5 text-slate-500">
                Add incoming physical stock through a
                stock receipt.
              </div>
            </Link>

            {product.tracking_mode ===
            "serial" ? (
              <Link
                href="/serial-numbers"
                className="group rounded-xl bg-white p-5 transition hover:border-slate-300"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                    <Icon
                      name="serial"
                      size={18}
                    />
                  </div>

                  <Icon
                    name="arrow"
                    size={15}
                  />
                </div>

                <div className="mt-4 text-sm font-semibold text-slate-900">
                  Serial Numbers
                </div>

                <div className="mt-1 text-xs leading-5 text-slate-500">
                  View and manage serialized units for this
                  product.
                </div>
              </Link>
            ) : (
              <Link
                href="/inventory/adjustments"
                className="group rounded-xl bg-white p-5 transition hover:border-slate-300"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                    <Icon
                      name="layers"
                      size={18}
                    />
                  </div>

                  <Icon
                    name="arrow"
                    size={15}
                  />
                </div>

                <div className="mt-4 text-sm font-semibold text-slate-900">
                  Adjust Stock
                </div>

                <div className="mt-1 text-xs leading-5 text-slate-500">
                  Correct stock quantities with a controlled
                  adjustment.
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}