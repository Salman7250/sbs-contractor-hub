"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

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

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  tracking_mode:
    | "none"
    | "quantity"
    | "batch"
    | "serial"
    | null;
  track_inventory: boolean;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  cost_price: number | string | null;
  selling_price: number | string | null;
  is_active: boolean;
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
  product_id: string;
  variant_id: string;
  warehouse_id: string | null;
  location_id: string | null;
  movement_type: string;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  created_at: string;
};

type InventoryItem = InventoryRow & {
  product: Product | null;
  variant: ProductVariant | null;
  warehouse: Warehouse | null;
  location: WarehouseLocation | null;
};

type InventoryStatus =
  | "all"
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

type SortKey =
  | "product"
  | "quantity"
  | "available"
  | "value"
  | "updated";

type SortDirection = "asc" | "desc";

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

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getAvailable(item: InventoryItem) {
  return Math.max(
    numberValue(item.quantity) -
      numberValue(item.reserved_quantity),
    0
  );
}

function getStatus(
  item: InventoryItem
): Exclude<InventoryStatus, "all"> {
  const quantity = numberValue(item.quantity);
  const available = getAvailable(item);
  const reorderLevel = numberValue(item.reorder_level);

  if (available <= 0 || quantity <= 0) {
    return "out_of_stock";
  }

  if (
    available <= reorderLevel &&
    reorderLevel > 0
  ) {
    return "low_stock";
  }

  return "in_stock";
}

function statusLabel(
  status: Exclude<InventoryStatus, "all">
) {
  switch (status) {
    case "in_stock":
      return "In Stock";

    case "low_stock":
      return "Low Stock";

    case "out_of_stock":
      return "Out of Stock";

    default:
      return status;
  }
}

function statusClasses(
  status: Exclude<InventoryStatus, "all">
) {
  switch (status) {
    case "in_stock":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";

    case "low_stock":
      return "bg-amber-50 text-amber-700 ring-amber-200";

    case "out_of_stock":
      return "bg-red-50 text-red-700 ring-red-200";

    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function trackingLabel(
  trackingMode: Product["tracking_mode"]
) {
  switch (trackingMode) {
    case "quantity":
      return "Quantity";

    case "batch":
      return "Batch";

    case "serial":
      return "Serial";

    case "none":
      return "Not tracked";

    default:
      return "Unknown";
  }
}

/* -------------------------------------------------------------------------- */
/* Icon                                                                       */
/* -------------------------------------------------------------------------- */

type IconName =
  | "search"
  | "filter"
  | "package"
  | "warehouse"
  | "layers"
  | "warning"
  | "alert"
  | "check"
  | "arrow"
  | "refresh"
  | "plus"
  | "chevron"
  | "box"
  | "serial"
  | "external";

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

    case "package":
      return (
        <svg {...common}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="m4 7.5 8 4.5 8-4.5" />
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

    case "layers":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 16 9 5 9-5" />
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

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
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

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );

    case "box":
      return (
        <svg {...common}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="M4 7.5 12 12l8-4.5" />
        </svg>
      );

    case "serial":
      return (
        <svg {...common}>
          <rect
            x="4"
            y="5"
            width="16"
            height="14"
            rx="2"
          />
          <path d="M8 9v6M11 9v6M14 9v6M17 9v6" />
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

export default function InventoryPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [currency, setCurrency] = useState("USD");

  const [inventory, setInventory] = useState<
    InventoryItem[]
  >([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>(
    []
  );
  const [warehouses, setWarehouses] = useState<Warehouse[]>(
    []
  );
  const [movements, setMovements] = useState<Movement[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<InventoryStatus>("all");

  const [warehouseFilter, setWarehouseFilter] =
    useState("all");

  const [sortKey, setSortKey] =
    useState<SortKey>("product");

  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");

  const loadInventory = useCallback(
    async (showRefresh = false) => {
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

        const companyId = membership.company_id;

        const [
          companyResult,
          inventoryResult,
          productsResult,
          variantsResult,
          warehousesResult,
          locationsResult,
          movementsResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select("currency")
            .eq("id", companyId)
            .maybeSingle(),

          /*
           * IMPORTANT:
           * Never filter real inventory rows using product tracking
           * metadata here.
           *
           * The inventory table is the authoritative quantity/balance
           * ledger. Every real row must survive enrichment even if
           * product metadata is temporarily incomplete.
           */
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
            .eq("company_id", companyId),

          supabase
            .from("products")
            .select(
              `
                id,
                name,
                brand,
                category,
                tracking_mode,
                track_inventory
              `
            )
            .eq("company_id", companyId)
            .eq("status", "active"),

          supabase
            .from("product_variants")
            .select(
              `
                id,
                product_id,
                name,
                sku,
                barcode,
                cost_price,
                selling_price,
                is_active
              `
            )
            .eq("company_id", companyId)
            .eq("is_active", true),

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
            .eq("is_active", true)
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
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("inventory_movements")
            .select(
              `
                id,
                product_id,
                variant_id,
                warehouse_id,
                location_id,
                movement_type,
                quantity,
                quantity_before,
                quantity_after,
                reason,
                created_at
              `
            )
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            })
            .limit(8),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (inventoryResult.error) {
          throw inventoryResult.error;
        }

        if (productsResult.error) {
          throw productsResult.error;
        }

        if (variantsResult.error) {
          throw variantsResult.error;
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

        const productRows =
          (productsResult.data ?? []) as Product[];

        const variantRows =
          (variantsResult.data ?? []) as ProductVariant[];

        const warehouseRows =
          (warehousesResult.data ?? []) as Warehouse[];

        const locationRows =
          (locationsResult.data ??
            []) as WarehouseLocation[];

        /*
         * Preserve every real inventory row.
         */
        const inventoryRows =
          (inventoryResult.data ?? []) as InventoryRow[];

        const productMap = new Map(
          productRows.map((product) => [
            product.id,
            product,
          ])
        );

        const variantMap = new Map(
          variantRows.map((variant) => [
            variant.id,
            variant,
          ])
        );

        const warehouseMap = new Map(
          warehouseRows.map((warehouse) => [
            warehouse.id,
            warehouse,
          ])
        );

        const locationMap = new Map(
          locationRows.map((location) => [
            location.id,
            location,
          ])
        );

        /*
         * These are the products whose quantity can be represented
         * by the inventory quantity ledger.
         *
         * Serial products are intentionally excluded because their
         * authoritative stock lives in serialized_units.
         *
         * Products with tracking_mode = none are also excluded because
         * they are not inventory-tracked.
         */
        const trackedProductIds = new Set(
          productRows
            .filter(
              (product) =>
                product.tracking_mode === "quantity" ||
                product.tracking_mode === "batch"
            )
            .map((product) => product.id)
        );

        /*
         * Preserve ALL existing inventory rows first.
         */
        const enrichedRealInventory =
          inventoryRows.map((row) => ({
            ...row,
            product:
              productMap.get(row.product_id) ?? null,
            variant:
              variantMap.get(row.variant_id) ?? null,
            warehouse:
              row.warehouse_id
                ? warehouseMap.get(row.warehouse_id) ??
                  null
                : null,
            location:
              row.location_id
                ? locationMap.get(row.location_id) ??
                  null
                : null,
          }));

        /*
         * Add virtual zero-stock rows for tracked variants that do
         * not yet have an inventory row.
         *
         * This allows a newly-created quantity/batch product to appear
         * in Inventory as Out of Stock before its first receipt.
         *
         * We deliberately do NOT create database rows here.
         */
        const existingInventoryVariantIds =
          new Set(
            inventoryRows.map(
              (row) => row.variant_id
            )
          );

        const zeroInventoryRows: InventoryItem[] =
          [];

        for (const variant of variantRows) {
          const product =
            productMap.get(variant.product_id);

          if (!product) {
            continue;
          }

          if (
            !trackedProductIds.has(
              variant.product_id
            )
          ) {
            continue;
          }

          if (
            existingInventoryVariantIds.has(
              variant.id
            )
          ) {
            continue;
          }

          zeroInventoryRows.push({
            id: `virtual-${variant.id}`,
            company_id: companyId,
            product_id: variant.product_id,
            variant_id: variant.id,
            quantity: 0,
            reserved_quantity: 0,
            reorder_level: 0,
            reorder_quantity: 0,
            warehouse_id: null,
            location_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            product,
            variant,
            warehouse: null,
            location: null,
          });
        }

        const enrichedInventory = [
          ...enrichedRealInventory,
          ...zeroInventoryRows,
        ];

        setCurrency(
          typeof companyResult.data?.currency ===
            "string"
            ? companyResult.data.currency
            : "USD"
        );

        setProducts(productRows);
        setVariants(variantRows);
        setWarehouses(warehouseRows);
        setInventory(enrichedInventory);

        setMovements(
          (movementsResult.data ?? []) as Movement[]
        );
      } catch (error) {
        console.error(
          "Inventory load error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load inventory."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    // Initial inventory data load.
    // The function performs async Supabase requests and updates local state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInventory();
  }, [loadInventory]);

  /* ------------------------------------------------------------------------ */
  /* Derived data                                                             */
  /* ------------------------------------------------------------------------ */

  const productMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          product,
        ])
      ),
    [products]
  );

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

  const totalUnits = useMemo(
    () =>
      inventory.reduce(
        (sum, item) =>
          sum + numberValue(item.quantity),
        0
      ),
    [inventory]
  );

  const totalReserved = useMemo(
    () =>
      inventory.reduce(
        (sum, item) =>
          sum +
          numberValue(item.reserved_quantity),
        0
      ),
    [inventory]
  );

  const totalAvailable = Math.max(
    totalUnits - totalReserved,
    0
  );

  const inventoryValue = useMemo(
    () =>
      inventory.reduce((sum, item) => {
        const cost = numberValue(
          item.variant?.cost_price
        );

        return (
          sum +
          numberValue(item.quantity) * cost
        );
      }, 0),
    [inventory]
  );

  const lowStockCount = useMemo(
    () =>
      inventory.filter(
        (item) =>
          getStatus(item) === "low_stock"
      ).length,
    [inventory]
  );

  const outOfStockCount = useMemo(
    () =>
      inventory.filter(
        (item) =>
          getStatus(item) === "out_of_stock"
      ).length,
    [inventory]
  );

  const filteredInventory = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    const rows = inventory.filter((item) => {
      const product = item.product;
      const variant = item.variant;

      const searchMatch =
        !normalizedSearch ||
        product?.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        product?.brand
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        variant?.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        variant?.sku
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        variant?.barcode
          ?.toLowerCase()
          .includes(normalizedSearch);

      const statusMatch =
        statusFilter === "all" ||
        getStatus(item) === statusFilter;

      const warehouseMatch =
        warehouseFilter === "all" ||
        item.warehouse_id === warehouseFilter;

      return (
        searchMatch &&
        statusMatch &&
        warehouseMatch
      );
    });

    rows.sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case "product":
          comparison = (
            a.product?.name ?? ""
          ).localeCompare(
            b.product?.name ?? ""
          );

          if (comparison === 0) {
            comparison = (
              a.variant?.name ?? ""
            ).localeCompare(
              b.variant?.name ?? ""
            );
          }

          break;

        case "quantity":
          comparison =
            numberValue(a.quantity) -
            numberValue(b.quantity);
          break;

        case "available":
          comparison =
            getAvailable(a) -
            getAvailable(b);
          break;

        case "value":
          comparison =
            numberValue(a.quantity) *
              numberValue(
                a.variant?.cost_price
              ) -
            numberValue(b.quantity) *
              numberValue(
                b.variant?.cost_price
              );
          break;

        case "updated":
          comparison =
            new Date(a.updated_at).getTime() -
            new Date(b.updated_at).getTime();
          break;
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });

    return rows;
  }, [
    inventory,
    search,
    statusFilter,
    warehouseFilter,
    sortKey,
    sortDirection,
  ]);

  const recentMovements = useMemo(
    () =>
      movements.map((movement) => ({
        ...movement,
        product:
          productMap.get(
            movement.product_id
          ) ?? null,
        variant:
          variantMap.get(
            movement.variant_id
          ) ?? null,
        warehouse:
          movement.warehouse_id
            ? warehouseMap.get(
                movement.warehouse_id
              ) ?? null
            : null,
      })),
    [
      movements,
      productMap,
      variantMap,
      warehouseMap,
    ]
  );

  /* ------------------------------------------------------------------------ */
  /* Sorting                                                                  */
  /* ------------------------------------------------------------------------ */

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";

    return sortDirection === "asc"
      ? " ↑"
      : " ↓";
  }

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                  */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1600px] px-6 py-8">
            <div className="animate-pulse">
              <div className="h-8 w-48 rounded bg-slate-200" />

              <div className="mt-3 h-4 w-80 rounded bg-slate-200" />

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
                className="mt-6 h-96 rounded-xl bg-white"
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
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-6 py-8">
          {/* Header --------------------------------------------------------- */}

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-900 p-2.5 text-white">
                  <Icon name="package" size={21} />
                </div>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                    Inventory
                  </h1>

                  <p className="mt-1 text-sm text-slate-500">
                    Monitor stock, availability,
                    warehouses, and inventory value.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/inventory/receiving"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Icon name="plus" size={16} />
                Receive Stock
              </Link>

              <Link
                href="/inventory/adjustments"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                <Icon name="layers" size={16} />
                Adjust Stock
              </Link>

              <Link
                href="/serial-numbers"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                <Icon name="serial" size={16} />
                Serial Numbers
              </Link>

              <button
                type="button"
                onClick={() =>
                  void loadInventory(true)
                }
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                <Icon name="refresh" size={16} />

                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
            </div>
          </div>

          {/* Error ---------------------------------------------------------- */}

          {errorMessage ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex items-start gap-3">
                <Icon name="alert" size={18} />

                <div>
                  <div className="font-semibold">
                    Unable to load inventory
                  </div>

                  <div className="mt-1">
                    {errorMessage}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Stats ---------------------------------------------------------- */}

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Inventory Value"
              value={formatMoney(
                inventoryValue,
                currency
              )}
              description="Current stock at cost"
              icon="package"
            />

            <StatCard
              label="Total Units"
              value={totalUnits.toLocaleString()}
              description={`${totalAvailable.toLocaleString()} available`}
              icon="layers"
            />

            <StatCard
              label="Low Stock"
              value={lowStockCount.toLocaleString()}
              description="Items at or below reorder level"
              icon="warning"
            />

            <StatCard
              label="Out of Stock"
              value={outOfStockCount.toLocaleString()}
              description={`${totalReserved.toLocaleString()} units reserved`}
              icon="alert"
            />
          </div>

          {/* Warehouse summary ---------------------------------------------- */}

          <div
            className="mt-6 rounded-xl bg-white p-5"
            style={{
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Warehouses
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Stock currently recorded across
                  your active warehouses.
                </p>
              </div>

              <div className="text-sm text-slate-400">
                {warehouses.length} active{" "}
                {warehouses.length === 1
                  ? "warehouse"
                  : "warehouses"}
              </div>
            </div>

            {warehouses.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <Icon
                  name="warehouse"
                  size={24}
                />

                <div className="mt-2 text-sm font-medium text-slate-700">
                  No active warehouses
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  Create a warehouse before receiving
                  and allocating physical stock.
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {warehouses.map((warehouse) => {
                  const warehouseInventory =
                    inventory.filter(
                      (item) =>
                        item.warehouse_id ===
                        warehouse.id
                    );

                  const units =
                    warehouseInventory.reduce(
                      (sum, item) =>
                        sum +
                        numberValue(
                          item.quantity
                        ),
                      0
                    );

                  const available =
                    warehouseInventory.reduce(
                      (sum, item) =>
                        sum +
                        getAvailable(item),
                      0
                    );

                  return (
                    <button
                      key={warehouse.id}
                      type="button"
                      onClick={() =>
                        setWarehouseFilter(
                          warehouse.id
                        )
                      }
                      className={`rounded-lg p-4 text-left transition ${
                        warehouseFilter ===
                        warehouse.id
                          ? "ring-2 ring-slate-900"
                          : ""
                      }`}
                      style={{
                        border:
                          "1px solid #e2e8f0",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                            <Icon
                              name="warehouse"
                              size={17}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {warehouse.name}
                            </div>

                            <div className="mt-0.5 text-xs text-slate-400">
                              {warehouse.code}
                            </div>
                          </div>
                        </div>

                        <Icon
                          name="chevron"
                          size={16}
                        />
                      </div>

                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <div className="text-lg font-semibold text-slate-950">
                            {units.toLocaleString()}
                          </div>

                          <div className="text-xs text-slate-400">
                            total units
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-medium text-slate-700">
                            {available.toLocaleString()}
                          </div>

                          <div className="text-xs text-slate-400">
                            available
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inventory table ------------------------------------------------ */}

          <div
            className="mt-6 overflow-hidden rounded-xl bg-white"
            style={{
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Stock
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {filteredInventory.length.toLocaleString()}{" "}
                    stock records shown
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative min-w-[260px]">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <Icon
                        name="search"
                        size={17}
                      />
                    </div>

                    <input
                      type="text"
                      value={search}
                      onChange={(event) =>
                        setSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search products, SKU..."
                      className="w-full rounded-lg bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-200"
                      style={{
                        border:
                          "1px solid #e2e8f0",
                      }}
                    />
                  </div>

                  <select
                    value={warehouseFilter}
                    onChange={(event) =>
                      setWarehouseFilter(
                        event.target.value
                      )
                    }
                    className="rounded-lg bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                    style={{
                      border:
                        "1px solid #e2e8f0",
                    }}
                  >
                    <option value="all">
                      All Warehouses
                    </option>

                    {warehouses.map(
                      (warehouse) => (
                        <option
                          key={warehouse.id}
                          value={warehouse.id}
                        >
                          {warehouse.name}
                        </option>
                      )
                    )}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target
                          .value as InventoryStatus
                      )
                    }
                    className="rounded-lg bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                    style={{
                      border:
                        "1px solid #e2e8f0",
                    }}
                  >
                    <option value="all">
                      All Status
                    </option>

                    <option value="in_stock">
                      In Stock
                    </option>

                    <option value="low_stock">
                      Low Stock
                    </option>

                    <option value="out_of_stock">
                      Out of Stock
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {filteredInventory.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Icon
                    name="package"
                    size={22}
                  />
                </div>

                <h3 className="mt-4 text-sm font-semibold text-slate-900">
                  No inventory records found
                </h3>

                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  {inventory.length === 0
                    ? "Inventory will appear here once stock is received or added through an inventory transaction."
                    : "Try changing your search or filters."}
                </p>

                {inventory.length === 0 ? (
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <Link
                      href="/inventory/receiving"
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      <Icon
                        name="plus"
                        size={16}
                      />

                      Receive Stock
                    </Link>

                    <Link
                      href="/inventory/adjustments"
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      style={{
                        border:
                          "1px solid #e2e8f0",
                      }}
                    >
                      <Icon
                        name="layers"
                        size={16}
                      />

                      Adjust Stock
                    </Link>

                    <Link
                      href="/products"
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      style={{
                        border:
                          "1px solid #e2e8f0",
                      }}
                    >
                      <Icon
                        name="package"
                        size={16}
                      />

                      View Products
                    </Link>

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

                      Serialized Stock
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1050px] w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <button
                          type="button"
                          onClick={() =>
                            changeSort("product")
                          }
                          className="hover:text-slate-900"
                        >
                          Product
                          {sortIndicator(
                            "product"
                          )}
                        </button>
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tracking
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <button
                          type="button"
                          onClick={() =>
                            changeSort("quantity")
                          }
                          className="hover:text-slate-900"
                        >
                          Qty
                          {sortIndicator(
                            "quantity"
                          )}
                        </button>
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <button
                          type="button"
                          onClick={() =>
                            changeSort("available")
                          }
                          className="hover:text-slate-900"
                        >
                          Available
                          {sortIndicator(
                            "available"
                          )}
                        </button>
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Warehouse / Location
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <button
                          type="button"
                          onClick={() =>
                            changeSort("value")
                          }
                          className="hover:text-slate-900"
                        >
                          Stock Value
                          {sortIndicator(
                            "value"
                          )}
                        </button>
                      </th>

                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <button
                          type="button"
                          onClick={() =>
                            changeSort("updated")
                          }
                          className="hover:text-slate-900"
                        >
                          Updated
                          {sortIndicator(
                            "updated"
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredInventory.map(
                      (item) => {
                        const product =
                          item.product;

                        const variant =
                          item.variant;

                        const status =
                          getStatus(item);

                        const available =
                          getAvailable(item);

                        const stockValue =
                          numberValue(
                            item.quantity
                          ) *
                          numberValue(
                            variant?.cost_price
                          );

                        return (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100 transition hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-4">
                              <div className="flex min-w-[260px] items-start gap-3">
                                <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-500">
                                  <Icon
                                    name="box"
                                    size={17}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <Link
                                    href={`/inventory/${item.product_id}`}
                                    className="font-medium text-slate-900 hover:text-slate-600"
                                  >
                                    {product?.name ??
                                      "Unknown Product"}
                                  </Link>

                                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                                    {product?.brand ? (
                                      <span>
                                        {
                                          product.brand
                                        }
                                      </span>
                                    ) : null}

                                    {variant?.name ? (
                                      <>
                                        <span>
                                          •
                                        </span>

                                        <span>
                                          {
                                            variant.name
                                          }
                                        </span>
                                      </>
                                    ) : null}

                                    {variant?.sku ? (
                                      <>
                                        <span>
                                          •
                                        </span>

                                        <span>
                                          SKU:{" "}
                                          {
                                            variant.sku
                                          }
                                        </span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                {trackingLabel(
                                  product?.tracking_mode ??
                                    null
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <span className="text-sm font-semibold text-slate-900">
                                {numberValue(
                                  item.quantity
                                ).toLocaleString()}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <div className="text-sm font-semibold text-slate-900">
                                {available.toLocaleString()}
                              </div>

                              {numberValue(
                                item.reserved_quantity
                              ) > 0 ? (
                                <div className="mt-1 text-xs text-amber-600">
                                  {numberValue(
                                    item.reserved_quantity
                                  ).toLocaleString()}{" "}
                                  reserved
                                </div>
                              ) : null}
                            </td>

                            <td className="px-5 py-4">
                              <div className="text-sm font-medium text-slate-700">
                                {item.warehouse
                                  ?.name ??
                                  "Unassigned"}
                              </div>

                              <div className="mt-1 text-xs text-slate-400">
                                {item.location
                                  ? `${item.location.name} (${item.location.code})`
                                  : "No location"}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <div className="text-sm font-medium text-slate-900">
                                {formatMoney(
                                  stockValue,
                                  currency
                                )}
                              </div>

                              <div className="mt-1 text-xs text-slate-400">
                                Cost:{" "}
                                {formatMoney(
                                  numberValue(
                                    variant?.cost_price
                                  ),
                                  currency
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-center">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusClasses(
                                  status
                                )}`}
                              >
                                {statusLabel(
                                  status
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <span className="text-xs text-slate-500">
                                {formatDate(
                                  item.updated_at
                                )}
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
            className="mt-6 rounded-xl bg-white"
            style={{
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div className="flex flex-col gap-2 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Recent Stock Movements
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Latest inventory ledger activity.
                </p>
              </div>

              <span className="text-xs text-slate-400">
                {movements.length} recent{" "}
                {movements.length === 1
                  ? "movement"
                  : "movements"}
              </span>
            </div>

            {recentMovements.length === 0 ? (
              <div className="p-8 text-center">
                <Icon
                  name="layers"
                  size={24}
                />

                <div className="mt-2 text-sm font-medium text-slate-700">
                  No stock movements yet
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  Stock transactions will appear here
                  as inventory activity occurs.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentMovements.map(
                  (movement) => {
                    const isIncoming =
                      [
                        "stock_in",
                        "purchase",
                        "return",
                        "transfer_in",
                        "adjustment_in",
                      ].includes(
                        movement.movement_type
                      );

                    return (
                      <div
                        key={movement.id}
                        className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`mt-0.5 rounded-lg p-2 ${
                              isIncoming
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
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {movement.product
                                ?.name ??
                                "Unknown Product"}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span>
                                {movement.variant
                                  ?.name ??
                                  "Unknown Variant"}
                              </span>

                              <span>•</span>

                              <span className="capitalize">
                                {movement.movement_type.replace(
                                  /_/g,
                                  " "
                                )}
                              </span>

                              {movement.warehouse ? (
                                <>
                                  <span>
                                    •
                                  </span>

                                  <span>
                                    {
                                      movement
                                        .warehouse
                                        .name
                                    }
                                  </span>
                                </>
                              ) : null}
                            </div>

                            {movement.reason ? (
                              <div className="mt-1 text-xs text-slate-500">
                                {
                                  movement.reason
                                }
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-6 sm:justify-end">
                          <div className="text-right">
                            <div
                              className={`text-sm font-semibold ${
                                isIncoming
                                  ? "text-emerald-700"
                                  : "text-red-700"
                              }`}
                            >
                              {isIncoming
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

                          <div className="text-right">
                            <div className="text-xs text-slate-500">
                              {formatDate(
                                movement.created_at
                              )}
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

          {/* Bottom navigation --------------------------------------------- */}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                    name="plus"
                    size={18}
                  />
                </div>

                <Icon
                  name="external"
                  size={15}
                />
              </div>

              <div className="mt-4 text-sm font-semibold text-slate-900">
                Receive Stock
              </div>

              <div className="mt-1 text-xs leading-5 text-slate-500">
                Receive physical stock into a warehouse
                and location through a stock receipt.
              </div>
            </Link>

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
                  name="external"
                  size={15}
                />
              </div>

              <div className="mt-4 text-sm font-semibold text-slate-900">
                Adjust Stock
              </div>

              <div className="mt-1 text-xs leading-5 text-slate-500">
                Correct inventory quantities with
                controlled stock adjustments and ledger
                history.
              </div>
            </Link>

            <Link
              href="/products"
              className="group rounded-xl bg-white p-5 transition hover:border-slate-300"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                  <Icon
                    name="package"
                    size={18}
                  />
                </div>

                <Icon
                  name="external"
                  size={15}
                />
              </div>

              <div className="mt-4 text-sm font-semibold text-slate-900">
                Product Catalog
              </div>

              <div className="mt-1 text-xs leading-5 text-slate-500">
                Manage products, variants, SKUs,
                pricing, and inventory tracking modes.
              </div>
            </Link>

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
                  name="external"
                  size={15}
                />
              </div>

              <div className="mt-4 text-sm font-semibold text-slate-900">
                Serial Numbers
              </div>

              <div className="mt-1 text-xs leading-5 text-slate-500">
                Track serialized units, warranty,
                ownership, repair, RMA, and status.
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}