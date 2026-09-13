"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Warehouse = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  is_active: boolean;
  is_default: boolean;
  notes: string | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  tracking_mode: string | null;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
  cost_price: number | null;
  selling_price: number | null;
};

type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  parent_location_id: string | null;
  name: string;
  code: string | null;
  location_type: string | null;
  is_active: boolean;
};

type Batch = {
  id: string;
  product_id: string;
  variant_id: string | null;
  lot_number: string;
  received_at: string | null;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
  status: string | null;
};

type BatchStock = {
  id: string;
  batch_id: string;
  product_id: string;
  variant_id: string | null;
  warehouse_id: string;
  location_id: string | null;
  quantity: number;
  reserved_quantity: number;
};

type InventoryRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  reserved_quantity: number;
  reorder_level: number | null;
  reorder_quantity: number | null;
  warehouse_id: string | null;
  location_id: string | null;
};

type SerializedUnit = {
  id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
  barcode: string | null;
  status: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  batch_id: string | null;
  cost_price: number | null;
};

type InventoryMovement = {
  id: string;
  product_id: string;
  variant_id: string | null;
  movement_type: string;
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  created_at: string;
  location_id: string | null;
  batch_id: string | null;
  unit_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
};

type StockPosition = {
  key: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string;
  sku: string;
  trackingMode: string;
  quantity: number;
  reserved: number;
  available: number;
  value: number;
  unitCost: number;
  locationCount: number;
  batchCount: number;
};

type LocationPosition = {
  locationId: string | null;
  locationName: string;
  locationCode: string;
  quantity: number;
  reserved: number;
  available: number;
  value: number;
  skuCount: number;
  batchCount: number;
};

type StatusFilter =
  | "all"
  | "available"
  | "reserved"
  | "low"
  | "out";

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(Number(value ?? 0));
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function titleCase(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClasses(
  status: string | null | undefined,
) {
  const normalized = String(status ?? "").toLowerCase();

  if (
    normalized === "available" ||
    normalized === "active"
  ) {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "#bbf7d0",
    };
  }

  if (
    normalized === "reserved" ||
    normalized === "allocated"
  ) {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "#bfdbfe",
    };
  }

  if (
    normalized === "low" ||
    normalized === "quarantined"
  ) {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "#fde68a",
    };
  }

  if (
    normalized === "out" ||
    normalized === "depleted" ||
    normalized === "damaged"
  ) {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fecaca",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#374151",
    border: "#e5e7eb",
  };
}

export default function WarehouseDetailPage() {
  const params = useParams<{ id: string }>();
  const warehouseId = params.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [warehouse, setWarehouse] =
    useState<Warehouse | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>(
    [],
  );
  const [locations, setLocations] = useState<
    WarehouseLocation[]
  >([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchStock, setBatchStock] = useState<BatchStock[]>(
    [],
  );
  const [inventory, setInventory] = useState<InventoryRow[]>(
    [],
  );
  const [serializedUnits, setSerializedUnits] = useState<
    SerializedUnit[]
  >([]);
  const [movements, setMovements] = useState<
    InventoryMovement[]
  >([]);

  const [activeTab, setActiveTab] = useState<
    "overview" | "stock" | "locations" | "serials" | "movements"
  >("overview");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const loadPage = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Your session has expired.");
        }

        const { data: memberships, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id);

        if (membershipError) {
          throw new Error(membershipError.message);
        }

        if (!memberships?.length) {
          throw new Error(
            "No company workspace is available for your account.",
          );
        }

        const companyId = memberships[0].company_id;

        const warehouseResult = await supabase
          .from("warehouses")
          .select(`
            id,
            company_id,
            name,
            code,
            address,
            city,
            state,
            country,
            is_active,
            is_default,
            notes
          `)
          .eq("company_id", companyId)
          .eq("id", warehouseId)
          .maybeSingle();

        if (warehouseResult.error) {
          throw new Error(
            warehouseResult.error.message,
          );
        }

        if (!warehouseResult.data) {
          throw new Error("Warehouse not found.");
        }

        const activeWarehouse =
          warehouseResult.data as Warehouse;

        const [
          productsResult,
          variantsResult,
          locationsResult,
          batchesResult,
          batchStockResult,
          inventoryResult,
          serializedUnitsResult,
          movementsResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(`
              id,
              name,
              brand,
              category,
              tracking_mode
            `)
            .eq("company_id", companyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("product_variants")
            .select(`
              id,
              product_id,
              name,
              sku,
              cost_price,
              selling_price
            `)
            .eq("company_id", companyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("warehouse_locations")
            .select(`
              id,
              warehouse_id,
              parent_location_id,
              name,
              code,
              location_type,
              is_active
            `)
            .eq("company_id", companyId)
            .eq("warehouse_id", warehouseId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("inventory_batches")
            .select(`
              id,
              product_id,
              variant_id,
              lot_number,
              received_at,
              quantity_received,
              unit_cost,
              total_cost,
              status
            `)
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("inventory_batch_stock")
            .select(`
              id,
              batch_id,
              product_id,
              variant_id,
              warehouse_id,
              location_id,
              quantity,
              reserved_quantity
            `)
            .eq("company_id", companyId)
            .eq("warehouse_id", warehouseId),

          supabase
            .from("inventory")
            .select(`
              id,
              product_id,
              variant_id,
              quantity,
              reserved_quantity,
              reorder_level,
              reorder_quantity,
              warehouse_id,
              location_id
            `)
            .eq("company_id", companyId)
            .eq("warehouse_id", warehouseId),

          supabase
            .from("serialized_units")
            .select(`
              id,
              product_id,
              variant_id,
              serial_number,
              barcode,
              status,
              warehouse_id,
              location_id,
              batch_id,
              cost_price
            `)
            .eq("company_id", companyId)
            .eq("warehouse_id", warehouseId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("inventory_movements")
            .select(`
              id,
              product_id,
              variant_id,
              movement_type,
              quantity,
              quantity_before,
              quantity_after,
              created_at,
              warehouse_id,
              location_id,
              batch_id,
              unit_id,
              reference_type,
              reference_id
            `)
            .eq("company_id", companyId)
            .eq("warehouse_id", warehouseId)
            .order("created_at", {
              ascending: false,
            })
            .limit(100),
        ]);

        if (productsResult.error) {
          throw new Error(productsResult.error.message);
        }

        if (variantsResult.error) {
          throw new Error(variantsResult.error.message);
        }

        if (locationsResult.error) {
          throw new Error(
            locationsResult.error.message,
          );
        }

        if (batchesResult.error) {
          throw new Error(batchesResult.error.message);
        }

        if (batchStockResult.error) {
          throw new Error(
            batchStockResult.error.message,
          );
        }

        if (inventoryResult.error) {
          throw new Error(
            inventoryResult.error.message,
          );
        }

        if (serializedUnitsResult.error) {
          throw new Error(
            serializedUnitsResult.error.message,
          );
        }

        if (movementsResult.error) {
          throw new Error(
            movementsResult.error.message,
          );
        }

        setWarehouse(activeWarehouse);
        setProducts(
          (productsResult.data as Product[]) ?? [],
        );
        setVariants(
          (variantsResult.data as ProductVariant[]) ?? [],
        );
        setLocations(
          (locationsResult.data as WarehouseLocation[]) ?? [],
        );
        setBatches(
          (batchesResult.data as Batch[]) ?? [],
        );
        setBatchStock(
          (batchStockResult.data as BatchStock[]) ?? [],
        );
        setInventory(
          (inventoryResult.data as InventoryRow[]) ?? [],
        );
        setSerializedUnits(
          (serializedUnitsResult.data as SerializedUnit[]) ??
            [],
        );
        setMovements(
          (movementsResult.data as InventoryMovement[]) ?? [],
        );
      } catch (error) {
        console.error(
          "Failed to load warehouse:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load warehouse.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase, warehouseId],
  );

  useEffect(() => {
    if (warehouseId) {
      void loadPage();
    }
  }, [loadPage, warehouseId]);

  const productMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          product,
        ]),
      ),
    [products],
  );

  const variantMap = useMemo(
    () =>
      new Map(
        variants.map((variant) => [
          variant.id,
          variant,
        ]),
      ),
    [variants],
  );

  const locationMap = useMemo(
    () =>
      new Map(
        locations.map((location) => [
          location.id,
          location,
        ]),
      ),
    [locations],
  );

  const batchMap = useMemo(
    () =>
      new Map(
        batches.map((batch) => [
          batch.id,
          batch,
        ]),
      ),
    [batches],
  );

  const inventoryMap = useMemo(() => {
    const map = new Map<string, InventoryRow>();

    for (const row of inventory) {
      const key = `${row.product_id}:${row.variant_id ?? "default"}:${row.location_id ?? "none"}`;

      map.set(key, row);
    }

    return map;
  }, [inventory]);

  const stockPositions = useMemo<StockPosition[]>(() => {
    const grouped = new Map<
      string,
      {
        productId: string;
        variantId: string | null;
        quantity: number;
        reserved: number;
        value: number;
        unitCostTotal: number;
        locationIds: Set<string>;
        batchIds: Set<string>;
      }
    >();

    for (const row of batchStock) {
      const key = `${row.product_id}:${row.variant_id ?? "default"}`;

      const batch = batchMap.get(row.batch_id);

      const entry = grouped.get(key) ?? {
        productId: row.product_id,
        variantId: row.variant_id,
        quantity: 0,
        reserved: 0,
        value: 0,
        unitCostTotal: 0,
        locationIds: new Set<string>(),
        batchIds: new Set<string>(),
      };

      const quantity = Number(row.quantity ?? 0);
      const reserved = Number(
        row.reserved_quantity ?? 0,
      );

      const unitCost = Number(
        batch?.unit_cost ?? 0,
      );

      entry.quantity += quantity;
      entry.reserved += reserved;
      entry.value += quantity * unitCost;
      entry.unitCostTotal +=
        quantity * unitCost;

      if (row.location_id) {
        entry.locationIds.add(row.location_id);
      }

      entry.batchIds.add(row.batch_id);

      grouped.set(key, entry);
    }

    return Array.from(grouped.values())
      .map((entry) => {
        const product = productMap.get(
          entry.productId,
        );

        const variant = entry.variantId
          ? variantMap.get(entry.variantId)
          : null;

        const locationCount =
          entry.locationIds.size;

        const batchCount =
          entry.batchIds.size;

        return {
          key: `${entry.productId}:${entry.variantId ?? "default"}`,
          productId: entry.productId,
          variantId: entry.variantId,
          productName:
            product?.name || "Unknown Product",
          variantName:
            variant?.name ||
            variant?.sku ||
            "Default Variant",
          sku: variant?.sku || "—",
          trackingMode:
            product?.tracking_mode || "none",
          quantity: entry.quantity,
          reserved: entry.reserved,
          available:
            entry.quantity - entry.reserved,
          value: entry.value,
          unitCost:
            entry.quantity > 0
              ? entry.unitCostTotal /
                entry.quantity
              : 0,
          locationCount,
          batchCount,
        };
      })
      .sort((a, b) =>
        a.productName.localeCompare(
          b.productName,
        ),
      );
  }, [
    batchStock,
    batchMap,
    productMap,
    variantMap,
  ]);

  const locationPositions =
    useMemo<LocationPosition[]>(() => {
      const grouped = new Map<
        string,
        {
          locationId: string | null;
          quantity: number;
          reserved: number;
          value: number;
          skus: Set<string>;
          batches: Set<string>;
        }
      >();

      for (const row of batchStock) {
        const key =
          row.location_id ?? "warehouse";

        const batch = batchMap.get(row.batch_id);

        const entry = grouped.get(key) ?? {
          locationId: row.location_id,
          quantity: 0,
          reserved: 0,
          value: 0,
          skus: new Set<string>(),
          batches: new Set<string>(),
        };

        const quantity = Number(
          row.quantity ?? 0,
        );

        const reserved = Number(
          row.reserved_quantity ?? 0,
        );

        const unitCost = Number(
          batch?.unit_cost ?? 0,
        );

        entry.quantity += quantity;
        entry.reserved += reserved;
        entry.value +=
          quantity * unitCost;
        entry.skus.add(
          `${row.product_id}:${row.variant_id ?? "default"}`,
        );
        entry.batches.add(row.batch_id);

        grouped.set(key, entry);
      }

      return Array.from(grouped.values())
        .map((entry) => {
          const location = entry.locationId
            ? locationMap.get(
                entry.locationId,
              )
            : null;

          return {
            locationId: entry.locationId,
            locationName:
              location?.name ||
              "Warehouse Level",
            locationCode:
              location?.code || "—",
            quantity: entry.quantity,
            reserved: entry.reserved,
            available:
              entry.quantity -
              entry.reserved,
            value: entry.value,
            skuCount: entry.skus.size,
            batchCount:
              entry.batches.size,
          };
        })
        .sort((a, b) =>
          a.locationName.localeCompare(
            b.locationName,
          ),
        );
    }, [
      batchStock,
      batchMap,
      locationMap,
    ]);

  const stats = useMemo(() => {
    const total = batchStock.reduce(
      (sum, row) =>
        sum + Number(row.quantity ?? 0),
      0,
    );

    const reserved = batchStock.reduce(
      (sum, row) =>
        sum +
        Number(
          row.reserved_quantity ?? 0,
        ),
      0,
    );

    const available = total - reserved;

    const inventoryValue = batchStock.reduce(
      (sum, row) => {
        const batch = batchMap.get(
          row.batch_id,
        );

        return (
          sum +
          Number(row.quantity ?? 0) *
            Number(batch?.unit_cost ?? 0)
        );
      },
      0,
    );

    const lowStock = inventory.filter((row) => {
      const totalQuantity = Number(
        row.quantity ?? 0,
      );

      const reorderLevel = Number(
        row.reorder_level ?? 0,
      );

      return (
        reorderLevel > 0 &&
        totalQuantity <= reorderLevel &&
        totalQuantity > 0
      );
    }).length;

    const outOfStock = inventory.filter(
      (row) =>
        Number(row.quantity ?? 0) <= 0,
    ).length;

    const activeSerials = serializedUnits.filter(
      (unit) =>
        unit.status !== "disposed" &&
        unit.status !== "lost",
    ).length;

    const availableSerials =
      serializedUnits.filter(
        (unit) => unit.status === "available",
      ).length;

    return {
      total,
      reserved,
      available,
      inventoryValue,
      lowStock,
      outOfStock,
      activeSerials,
      availableSerials,
    };
  }, [
    batchStock,
    batchMap,
    inventory,
    serializedUnits,
  ]);

  const filteredStockPositions = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return stockPositions.filter(
      (position) => {
        const searchable = [
          position.productName,
          position.variantName,
          position.sku,
          position.trackingMode,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !normalizedSearch ||
          searchable.includes(
            normalizedSearch,
          );

        let matchesStatus = true;

        if (statusFilter === "available") {
          matchesStatus =
            position.available > 0;
        }

        if (statusFilter === "reserved") {
          matchesStatus =
            position.reserved > 0;
        }

        if (statusFilter === "low") {
          const matchingInventory =
            inventory.find(
              (row) =>
                row.product_id ===
                  position.productId &&
                row.variant_id ===
                  position.variantId,
            );

          matchesStatus =
            Number(
              matchingInventory?.reorder_level ?? 0,
            ) > 0 &&
            position.quantity > 0 &&
            position.quantity <=
              Number(
                matchingInventory?.reorder_level ?? 0,
              );
        }

        if (statusFilter === "out") {
          matchesStatus =
            position.quantity <= 0;
        }

        return matchesSearch && matchesStatus;
      },
    );
  }, [
    stockPositions,
    inventory,
    search,
    statusFilter,
  ]);

  const serializedUnitsFiltered =
    useMemo(() => {
      const normalizedSearch = search
        .trim()
        .toLowerCase();

      return serializedUnits.filter(
        (unit) => {
          if (!normalizedSearch) {
            return true;
          }

          const product =
            productMap.get(
              unit.product_id,
            );

          const variant = unit.variant_id
            ? variantMap.get(
                unit.variant_id,
              )
            : null;

          const batch = unit.batch_id
            ? batchMap.get(
                unit.batch_id,
              )
            : null;

          const location =
            unit.location_id
              ? locationMap.get(
                  unit.location_id,
                )
              : null;

          const searchable = [
            unit.serial_number,
            unit.barcode,
            product?.name,
            variant?.name,
            variant?.sku,
            batch?.lot_number,
            location?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            normalizedSearch,
          );
        },
      );
    }, [
      serializedUnits,
      productMap,
      variantMap,
      batchMap,
      locationMap,
      search,
    ]);

  const recentMovements = useMemo(
    () => movements.slice(0, 25),
    [movements],
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  if (loading) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="loading-page">
            <div className="loading-spinner" />
            <span>
              Loading warehouse...
            </span>
          </div>
        </main>
      </AppShell>
    );
  }

  if (errorMessage || !warehouse) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="error-page">
            <div className="error-icon">
              !
            </div>

            <h1>
              Unable to load warehouse
            </h1>

            <p>
              {errorMessage ||
                "The requested warehouse could not be found."}
            </p>

            <div className="error-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadPage()}
              >
                Try Again
              </button>

              <Link
                href="/inventory"
                className="primary-button"
              >
                Back to Inventory
              </Link>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="page-content">
        <div className="page-shell">
          <div className="breadcrumb-row">
            <Link
              href="/inventory"
              className="breadcrumb-link"
            >
              Inventory
            </Link>

            <span className="breadcrumb-separator">
              /
            </span>

            <span className="breadcrumb-current">
              Warehouses
            </span>

            <span className="breadcrumb-separator">
              /
            </span>

            <span className="breadcrumb-current">
              {warehouse.name}
            </span>
          </div>

          <section className="hero-card">
            <div className="hero-main">
              <div className="hero-title-row">
                <div>
                  <div className="eyebrow">
                    WAREHOUSE INVENTORY
                  </div>

                  <h1>{warehouse.name}</h1>

                  <p className="hero-subtitle">
                    {warehouse.code
                      ? `Code: ${warehouse.code}`
                      : "Warehouse stock position and traceability"}
                  </p>
                </div>

                <div className="hero-badges">
                  <span
                    className="status-badge"
                    style={{
                      background:
                        warehouse.is_active
                          ? "#dcfce7"
                          : "#fee2e2",
                      color:
                        warehouse.is_active
                          ? "#166534"
                          : "#991b1b",
                      borderColor:
                        warehouse.is_active
                          ? "#bbf7d0"
                          : "#fecaca",
                    }}
                  >
                    {warehouse.is_active
                      ? "Active"
                      : "Inactive"}
                  </span>

                  {warehouse.is_default ? (
                    <span className="default-badge">
                      Default
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="hero-meta-grid">
                <div>
                  <span>Address</span>

                  <strong>
                    {warehouse.address ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>City / State</span>

                  <strong>
                    {[
                      warehouse.city,
                      warehouse.state,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </strong>
                </div>

                <div>
                  <span>Country</span>

                  <strong>
                    {warehouse.country ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>Locations</span>

                  <strong>
                    {locations.length}
                  </strong>
                </div>
              </div>
            </div>

            <div className="hero-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  void loadPage(true)
                }
                disabled={refreshing}
              >
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <Link
                href="/inventory"
                className="secondary-button"
              >
                Inventory
              </Link>
            </div>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">
                Total Stock
              </div>

              <div className="stat-value">
                {formatNumber(stats.total)}
              </div>

              <div className="stat-description">
                Units across all batches
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                Available
              </div>

              <div className="stat-value">
                {formatNumber(
                  stats.available,
                )}
              </div>

              <div className="stat-description">
                Unreserved stock
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                Reserved
              </div>

              <div className="stat-value">
                {formatNumber(
                  stats.reserved,
                )}
              </div>

              <div className="stat-description">
                Stock committed elsewhere
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                Inventory Value
              </div>

              <div className="stat-value">
                {formatMoney(
                  stats.inventoryValue,
                )}
              </div>

              <div className="stat-description">
                Based on batch unit cost
              </div>
            </div>
          </section>

          <section className="secondary-stats">
            <div>
              <span>Products</span>
              <strong>
                {stockPositions.length}
              </strong>
            </div>

            <div>
              <span>Locations</span>
              <strong>
                {locations.length}
              </strong>
            </div>

            <div>
              <span>Low Stock</span>
              <strong>
                {stats.lowStock}
              </strong>
            </div>

            <div>
              <span>Out of Stock</span>
              <strong>
                {stats.outOfStock}
              </strong>
            </div>

            <div>
              <span>Serialized Units</span>
              <strong>
                {stats.activeSerials}
              </strong>
            </div>

            <div>
              <span>Available Serials</span>
              <strong>
                {stats.availableSerials}
              </strong>
            </div>
          </section>

          <section className="tab-card">
            <div className="tabs">
              <button
                type="button"
                className={
                  activeTab === "overview"
                    ? "tab active"
                    : "tab"
                }
                onClick={() =>
                  setActiveTab("overview")
                }
              >
                Overview
              </button>

              <button
                type="button"
                className={
                  activeTab === "stock"
                    ? "tab active"
                    : "tab"
                }
                onClick={() =>
                  setActiveTab("stock")
                }
              >
                Stock Position
              </button>

              <button
                type="button"
                className={
                  activeTab === "locations"
                    ? "tab active"
                    : "tab"
                }
                onClick={() =>
                  setActiveTab("locations")
                }
              >
                Locations
              </button>

              <button
                type="button"
                className={
                  activeTab === "serials"
                    ? "tab active"
                    : "tab"
                }
                onClick={() =>
                  setActiveTab("serials")
                }
              >
                Serial Units
              </button>

              <button
                type="button"
                className={
                  activeTab === "movements"
                    ? "tab active"
                    : "tab"
                }
                onClick={() =>
                  setActiveTab("movements")
                }
              >
                Movements
              </button>
            </div>

            {activeTab === "overview" ? (
              <div className="tab-content">
                <div className="overview-grid">
                  <section className="inner-card">
                    <div className="inner-card-header">
                      <div>
                        <h2>
                          Warehouse Summary
                        </h2>

                        <p>
                          Current operational state of
                          this warehouse.
                        </p>
                      </div>
                    </div>

                    <div className="detail-list">
                      <div className="detail-row">
                        <span>Warehouse</span>

                        <strong>
                          {warehouse.name}
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>Code</span>

                        <strong>
                          {warehouse.code ||
                            "—"}
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>Status</span>

                        <strong>
                          {warehouse.is_active
                            ? "Active"
                            : "Inactive"}
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>Default Warehouse</span>

                        <strong>
                          {warehouse.is_default
                            ? "Yes"
                            : "No"}
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>Locations</span>

                        <strong>
                          {locations.length}
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>Tracked Products</span>

                        <strong>
                          {
                            stockPositions.length
                          }
                        </strong>
                      </div>
                    </div>
                  </section>

                  <section className="inner-card">
                    <div className="inner-card-header">
                      <div>
                        <h2>
                          Inventory Health
                        </h2>

                        <p>
                          Stock availability and exception
                          indicators.
                        </p>
                      </div>
                    </div>

                    <div className="health-grid">
                      <div className="health-item">
                        <span>
                          Available
                        </span>

                        <strong>
                          {formatNumber(
                            stats.available,
                          )}
                        </strong>
                      </div>

                      <div className="health-item">
                        <span>
                          Reserved
                        </span>

                        <strong>
                          {formatNumber(
                            stats.reserved,
                          )}
                        </strong>
                      </div>

                      <div className="health-item">
                        <span>
                          Low Stock
                        </span>

                        <strong>
                          {stats.lowStock}
                        </strong>
                      </div>

                      <div className="health-item">
                        <span>
                          Out of Stock
                        </span>

                        <strong>
                          {stats.outOfStock}
                        </strong>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="inner-card">
                  <div className="inner-card-header">
                    <div>
                      <h2>
                        Top Stock Positions
                      </h2>

                      <p>
                        Highest-value products currently held in
                        this warehouse.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setActiveTab("stock")
                      }
                    >
                      View All
                    </button>
                  </div>

                  <div className="table-wrapper">
                    {stockPositions.length === 0 ? (
                      <div className="empty-state compact">
                        <div className="empty-title">
                          No stock yet
                        </div>

                        <div className="empty-description">
                          This warehouse has no batch stock
                          recorded.
                        </div>
                      </div>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Tracking</th>
                            <th>Available</th>
                            <th>Reserved</th>
                            <th>Batches</th>
                            <th>Locations</th>
                            <th>Value</th>
                          </tr>
                        </thead>

                        <tbody>
                          {[...stockPositions]
                            .sort(
                              (a, b) =>
                                b.value -
                                a.value,
                            )
                            .slice(0, 10)
                            .map(
                              (position) => (
                                <tr
                                  key={
                                    position.key
                                  }
                                >
                                  <td>
                                    <Link
                                      href={`/inventory/${position.productId}`}
                                      className="inline-link"
                                    >
                                      <div className="cell-primary">
                                        {
                                          position.productName
                                        }
                                      </div>

                                      <div className="cell-secondary">
                                        {
                                          position.variantName
                                        }
                                      </div>
                                    </Link>
                                  </td>

                                  <td>
                                    <span className="tracking-badge">
                                      {titleCase(
                                        position.trackingMode,
                                      )}
                                    </span>
                                  </td>

                                  <td className="numeric-cell">
                                    {formatNumber(
                                      position.available,
                                    )}
                                  </td>

                                  <td className="numeric-cell">
                                    {formatNumber(
                                      position.reserved,
                                    )}
                                  </td>

                                  <td className="numeric-cell">
                                    {
                                      position.batchCount
                                    }
                                  </td>

                                  <td className="numeric-cell">
                                    {
                                      position.locationCount
                                    }
                                  </td>

                                  <td className="numeric-cell strong-number">
                                    {formatMoney(
                                      position.value,
                                    )}
                                  </td>
                                </tr>
                              ),
                            )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>

                <section className="inner-card">
                  <div className="inner-card-header">
                    <div>
                      <h2>
                        Recent Movement Activity
                      </h2>

                      <p>
                        Latest inventory events recorded in this
                        warehouse.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setActiveTab("movements")
                      }
                    >
                      View All
                    </button>
                  </div>

                  <div className="activity-list">
                    {recentMovements.length ===
                    0 ? (
                      <div className="empty-state compact">
                        <div className="empty-title">
                          No movement activity
                        </div>

                        <div className="empty-description">
                          Inventory movements will appear here as
                          stock changes.
                        </div>
                      </div>
                    ) : (
                      recentMovements
                        .slice(0, 8)
                        .map(
                          (movement) => {
                            const product =
                              productMap.get(
                                movement.product_id,
                              );

                            const movementStyles =
                              statusClasses(
                                movement.movement_type ===
                                  "return"
                                  ? "reserved"
                                  : movement.movement_type.includes(
                                      "out",
                                    ) ||
                                    movement.movement_type ===
                                      "sale"
                                    ? "out"
                                    : "available",
                              );

                            return (
                              <div
                                className="activity-row"
                                key={
                                  movement.id
                                }
                              >
                                <div
                                  className="activity-icon"
                                  style={{
                                    background:
                                      movementStyles.background,
                                    color:
                                      movementStyles.color,
                                    borderColor:
                                      movementStyles.border,
                                  }}
                                >
                                  {movement.movement_type
                                    .toLowerCase()
                                    .includes(
                                      "in",
                                    ) ||
                                  movement.movement_type ===
                                    "purchase"
                                    ? "+"
                                    : movement.movement_type ===
                                        "return"
                                      ? "↩"
                                      : "−"}
                                </div>

                                <div className="activity-main">
                                  <div className="activity-title">
                                    {
                                      product?.name
                                    }

                                    <span>
                                      {titleCase(
                                        movement.movement_type,
                                      )}
                                    </span>
                                  </div>

                                  <div className="activity-meta">
                                    {formatDateTime(
                                      movement.created_at,
                                    )}

                                    {movement.reference_type
                                      ? ` · ${titleCase(
                                          movement.reference_type,
                                        )}`
                                      : ""}
                                  </div>
                                </div>

                                <div className="activity-quantity">
                                  {formatNumber(
                                    movement.quantity,
                                  )}
                                </div>
                              </div>
                            );
                          },
                        )
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            {activeTab === "stock" ? (
              <div className="tab-content">
                <div className="toolbar">
                  <div>
                    <h2>
                      Warehouse Stock
                    </h2>

                    <p>
                      Product and variant stock position across all
                      batches in this warehouse.
                    </p>
                  </div>

                  <div className="toolbar-count">
                    {
                      filteredStockPositions.length
                    }{" "}
                    positions
                  </div>
                </div>

                <div className="filters">
                  <div className="search-wrapper">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>

                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(
                          event.target.value,
                        )
                      }
                      placeholder="Search product, variant, SKU..."
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as StatusFilter,
                      )
                    }
                  >
                    <option value="all">
                      All Stock
                    </option>

                    <option value="available">
                      Available
                    </option>

                    <option value="reserved">
                      Reserved
                    </option>

                    <option value="low">
                      Low Stock
                    </option>

                    <option value="out">
                      Out of Stock
                    </option>
                  </select>

                  {(search ||
                    statusFilter !== "all") && (
                    <button
                      type="button"
                      className="clear-button"
                      onClick={
                        clearFilters
                      }
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="table-wrapper">
                  {filteredStockPositions.length ===
                  0 ? (
                    <div className="empty-state">
                      <div className="empty-title">
                        No matching stock
                      </div>

                      <div className="empty-description">
                        Try changing your search or stock
                        filter.
                      </div>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>SKU</th>
                          <th>Tracking</th>
                          <th>Stock</th>
                          <th>Reserved</th>
                          <th>Available</th>
                          <th>Unit Cost</th>
                          <th>Value</th>
                          <th>Batches</th>
                          <th>Locations</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredStockPositions.map(
                          (position) => (
                            <tr
                              key={position.key}
                            >
                              <td>
                                <Link
                                  href={`/inventory/${position.productId}`}
                                  className="inline-link"
                                >
                                  <div className="cell-primary">
                                    {
                                      position.productName
                                    }
                                  </div>

                                  <div className="cell-secondary">
                                    {
                                      position.variantName
                                    }
                                  </div>
                                </Link>
                              </td>

                              <td>
                                {position.sku}
                              </td>

                              <td>
                                <span className="tracking-badge">
                                  {titleCase(
                                    position.trackingMode,
                                  )}
                                </span>
                              </td>

                              <td className="numeric-cell">
                                {formatNumber(
                                  position.quantity,
                                )}
                              </td>

                              <td className="numeric-cell">
                                {formatNumber(
                                  position.reserved,
                                )}
                              </td>

                              <td className="numeric-cell strong-number">
                                {formatNumber(
                                  position.available,
                                )}
                              </td>

                              <td className="numeric-cell">
                                {formatMoney(
                                  position.unitCost,
                                )}
                              </td>

                              <td className="numeric-cell strong-number">
                                {formatMoney(
                                  position.value,
                                )}
                              </td>

                              <td className="numeric-cell">
                                {
                                  position.batchCount
                                }
                              </td>

                              <td className="numeric-cell">
                                {
                                  position.locationCount
                                }
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "locations" ? (
              <div className="tab-content">
                <div className="toolbar">
                  <div>
                    <h2>
                      Location Stock
                    </h2>

                    <p>
                      Stock position broken down by warehouse
                      location.
                    </p>
                  </div>

                  <div className="toolbar-count">
                    {
                      locationPositions.length
                    }{" "}
                    locations
                  </div>
                </div>

                <div className="location-grid">
                  {locationPositions.length ===
                  0 ? (
                    <div className="empty-state full">
                      <div className="empty-title">
                        No location stock
                      </div>

                      <div className="empty-description">
                        No batch stock is currently assigned to a
                        location in this warehouse.
                      </div>
                    </div>
                  ) : (
                    locationPositions.map(
                      (location) => (
                        <div
                          className="location-card"
                          key={
                            location.locationId ??
                            "warehouse"
                          }
                        >
                          <div className="location-card-header">
                            <div>
                              <div className="location-name">
                                {
                                  location.locationName
                                }
                              </div>

                              <div className="location-code">
                                {
                                  location.locationCode
                                }
                              </div>
                            </div>

                            <span className="location-icon">
                              LOC
                            </span>
                          </div>

                          <div className="location-stats">
                            <div>
                              <span>
                                Stock
                              </span>

                              <strong>
                                {formatNumber(
                                  location.quantity,
                                )}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Available
                              </span>

                              <strong>
                                {formatNumber(
                                  location.available,
                                )}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Reserved
                              </span>

                              <strong>
                                {formatNumber(
                                  location.reserved,
                                )}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Value
                              </span>

                              <strong>
                                {formatMoney(
                                  location.value,
                                )}
                              </strong>
                            </div>
                          </div>

                          <div className="location-footer">
                            <span>
                              {location.skuCount}{" "}
                              products
                            </span>

                            <span>
                              {location.batchCount}{" "}
                              batches
                            </span>
                          </div>
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "serials" ? (
              <div className="tab-content">
                <div className="toolbar">
                  <div>
                    <h2>
                      Serialized Units
                    </h2>

                    <p>
                      Individual serialized inventory currently assigned
                      to this warehouse.
                    </p>
                  </div>

                  <div className="toolbar-count">
                    {
                      serializedUnitsFiltered.length
                    }{" "}
                    units
                  </div>
                </div>

                <div className="filters single-filter">
                  <div className="search-wrapper">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 19 15.4183 11Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>

                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(
                          event.target.value,
                        )
                      }
                      placeholder="Search serial, barcode, product, SKU, batch..."
                    />
                  </div>

                  {search ? (
                    <button
                      type="button"
                      className="clear-button"
                      onClick={
                        clearFilters
                      }
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="table-wrapper">
                  {serializedUnitsFiltered.length ===
                  0 ? (
                    <div className="empty-state">
                      <div className="empty-title">
                        No serialized units
                      </div>

                      <div className="empty-description">
                        No matching serialized units are assigned
                        to this warehouse.
                      </div>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Serial Number</th>
                          <th>Product</th>
                          <th>Batch / Lot</th>
                          <th>Location</th>
                          <th>Status</th>
                          <th>Cost</th>
                        </tr>
                      </thead>

                      <tbody>
                        {serializedUnitsFiltered.map(
                          (unit) => {
                            const product =
                              productMap.get(
                                unit.product_id,
                              );

                            const variant =
                              unit.variant_id
                                ? variantMap.get(
                                    unit.variant_id,
                                  )
                                : null;

                            const batch =
                              unit.batch_id
                                ? batchMap.get(
                                    unit.batch_id,
                                  )
                                : null;

                            const location =
                              unit.location_id
                                ? locationMap.get(
                                    unit.location_id,
                                  )
                                : null;

                            const unitStyles =
                              statusClasses(
                                unit.status,
                              );

                            return (
                              <tr
                                key={
                                  unit.id
                                }
                              >
                                <td>
                                  <Link
                                    href={`/inventory/serial-numbers/${unit.id}`}
                                    className="inline-link"
                                  >
                                    {
                                      unit.serial_number
                                    }
                                  </Link>

                                  {unit.barcode ? (
                                    <div className="cell-secondary">
                                      Barcode:{" "}
                                      {
                                        unit.barcode
                                      }
                                    </div>
                                  ) : null}
                                </td>

                                <td>
                                  <div className="cell-primary">
                                    {
                                      product?.name
                                    }
                                  </div>

                                  <div className="cell-secondary">
                                    {variant?.name ||
                                      variant?.sku ||
                                      "Default Variant"}
                                  </div>
                                </td>

                                <td>
                                  {batch ? (
                                    <Link
                                      href={`/inventory/batches/${batch.id}`}
                                      className="inline-link"
                                    >
                                      {
                                        batch.lot_number
                                      }
                                    </Link>
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                <td>
                                  {
                                    location?.name ||
                                    "Warehouse Level"
                                  }
                                </td>

                                <td>
                                  <span
                                    className="status-badge"
                                    style={{
                                      background:
                                        unitStyles.background,
                                      color:
                                        unitStyles.color,
                                      borderColor:
                                        unitStyles.border,
                                    }}
                                  >
                                    {titleCase(
                                      unit.status,
                                    )}
                                  </span>
                                </td>

                                <td className="numeric-cell">
                                  {formatMoney(
                                    unit.cost_price,
                                  )}
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "movements" ? (
              <div className="tab-content">
                <div className="toolbar">
                  <div>
                    <h2>
                      Warehouse Movements
                    </h2>

                    <p>
                      Recent inventory movement events for this
                      warehouse.
                    </p>
                  </div>

                  <Link
                    href="/inventory/movements"
                    className="secondary-button"
                  >
                    Global Ledger
                  </Link>
                </div>

                <div className="table-wrapper">
                  {movements.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-title">
                        No movements
                      </div>

                      <div className="empty-description">
                        No inventory movements have been
                        recorded for this warehouse.
                      </div>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Movement</th>
                          <th>Product</th>
                          <th>Batch / Lot</th>
                          <th>Serial</th>
                          <th>Location</th>
                          <th>Qty</th>
                          <th>Before</th>
                          <th>After</th>
                          <th>Reference</th>
                        </tr>
                      </thead>

                      <tbody>
                        {movements.map(
                          (movement) => {
                            const product =
                              productMap.get(
                                movement.product_id,
                              );

                            const batch =
                              movement.batch_id
                                ? batchMap.get(
                                    movement.batch_id,
                                  )
                                : null;

                            const unit =
                              movement.unit_id
                                ? serializedUnits.find(
                                    (
                                      candidate,
                                    ) =>
                                      candidate.id ===
                                      movement.unit_id,
                                  )
                                : null;

                            const location =
                              movement.location_id
                                ? locationMap.get(
                                    movement.location_id,
                                  )
                                : null;

                            const normalizedType =
                              movement.movement_type.toLowerCase();

                            const movementStyles =
                              statusClasses(
                                normalizedType ===
                                  "return"
                                  ? "reserved"
                                  : normalizedType.includes(
                                        "out",
                                      ) ||
                                      normalizedType ===
                                        "sale"
                                    ? "out"
                                    : "available",
                              );

                            return (
                              <tr
                                key={
                                  movement.id
                                }
                              >
                                <td>
                                  {formatDateTime(
                                    movement.created_at,
                                  )}
                                </td>

                                <td>
                                  <span
                                    className="status-badge"
                                    style={{
                                      background:
                                        movementStyles.background,
                                      color:
                                        movementStyles.color,
                                      borderColor:
                                        movementStyles.border,
                                    }}
                                  >
                                    {titleCase(
                                      movement.movement_type,
                                    )}
                                  </span>
                                </td>

                                <td>
                                  <div className="cell-primary">
                                    {
                                      product?.name
                                    }
                                  </div>
                                </td>

                                <td>
                                  {batch ? (
                                    <Link
                                      href={`/inventory/batches/${batch.id}`}
                                      className="inline-link"
                                    >
                                      {
                                        batch.lot_number
                                      }
                                    </Link>
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                <td>
                                  {unit ? (
                                    <Link
                                      href={`/inventory/serial-numbers/${unit.id}`}
                                      className="inline-link"
                                    >
                                      {
                                        unit.serial_number
                                      }
                                    </Link>
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                <td>
                                  {location?.name ||
                                    "Warehouse Level"}
                                </td>

                                <td className="numeric-cell">
                                  {formatNumber(
                                    movement.quantity,
                                  )}
                                </td>

                                <td className="numeric-cell">
                                  {formatNumber(
                                    movement.quantity_before,
                                  )}
                                </td>

                                <td className="numeric-cell">
                                  {formatNumber(
                                    movement.quantity_after,
                                  )}
                                </td>

                                <td>
                                  {movement.reference_type
                                    ? titleCase(
                                        movement.reference_type,
                                      )
                                    : "—"}

                                  {movement.reference_id ? (
                                    <div className="cell-secondary">
                                      {
                                        movement.reference_id.slice(
                                          0,
                                          8,
                                        )
                                      }
                                      ...
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          {warehouse.notes ? (
            <section className="notes-card">
              <div>
                <h2>Warehouse Notes</h2>

                <p>{warehouse.notes}</p>
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .page-shell {
          max-width: 1700px;
          margin: 0 auto;
        }

        .breadcrumb-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
          color: #6b7280;
          font-size: 13px;
        }

        .breadcrumb-link {
          color: #4b5563;
          text-decoration: none;
        }

        .breadcrumb-link:hover {
          color: #111827;
        }

        .breadcrumb-separator {
          color: #9ca3af;
        }

        .breadcrumb-current {
          color: #111827;
          font-weight: 600;
        }

        .hero-card {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          padding: 28px;
          margin-bottom: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .hero-main {
          min-width: 0;
          flex: 1;
        }

        .hero-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .eyebrow {
          margin-bottom: 6px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .hero-card h1 {
          margin: 0;
          color: #111827;
          font-size: 28px;
          line-height: 1.15;
          font-weight: 700;
        }

        .hero-subtitle {
          margin: 8px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .hero-badges {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .hero-meta-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 22px;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #f0f0f0;
        }

        .hero-meta-grid div {
          min-width: 0;
        }

        .hero-meta-grid span {
          display: block;
          margin-bottom: 5px;
          color: #6b7280;
          font-size: 12px;
        }

        .hero-meta-grid strong {
          display: block;
          overflow: hidden;
          color: #111827;
          font-size: 14px;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .hero-actions {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          flex-shrink: 0;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
        }

        .primary-button {
          background: #111827;
          border: 1px solid #111827;
          color: #ffffff;
        }

        .primary-button:hover {
          background: #1f2937;
        }

        .secondary-button {
          background: #ffffff;
          border: 1px solid #d1d5db;
          color: #111827;
        }

        .secondary-button:hover {
          background: #f9fafb;
        }

        .secondary-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .default-badge {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          color: #4b5563;
          font-size: 11px;
          font-weight: 700;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 27px;
          padding: 0 9px;
          border: 1px solid transparent;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .stat-card {
          padding: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .stat-label {
          margin-bottom: 8px;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
        }

        .stat-value {
          color: #111827;
          font-size: 24px;
          line-height: 1.15;
          font-weight: 700;
        }

        .stat-description {
          margin-top: 7px;
          color: #9ca3af;
          font-size: 12px;
        }

        .secondary-stats {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 1px;
          margin-bottom: 20px;
          overflow: hidden;
          background: #e5e7eb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .secondary-stats > div {
          padding: 14px 16px;
          background: #ffffff;
        }

        .secondary-stats span {
          display: block;
          margin-bottom: 4px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 600;
        }

        .secondary-stats strong {
          color: #111827;
          font-size: 15px;
          font-weight: 700;
        }

        .tab-card {
          margin-bottom: 20px;
          overflow: hidden;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .tabs {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0 14px;
          overflow-x: auto;
          border-bottom: 1px solid #e5e7eb;
        }

        .tab {
          min-height: 52px;
          padding: 0 14px;
          background: transparent;
          border: 0;
          border-bottom: 2px solid transparent;
          color: #6b7280;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }

        .tab:hover {
          color: #111827;
        }

        .tab.active {
          border-bottom-color: #111827;
          color: #111827;
        }

        .tab-content {
          padding: 22px;
        }

        .overview-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }

        .inner-card {
          overflow: hidden;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .inner-card + .inner-card {
          margin-top: 20px;
        }

        .inner-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px;
          border-bottom: 1px solid #f0f0f0;
        }

        .inner-card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 15px;
          font-weight: 700;
        }

        .inner-card-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .detail-list {
          padding: 4px 20px 12px;
        }

        .detail-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 13px 0;
          border-bottom: 1px solid #f0f0f0;
          font-size: 13px;
        }

        .detail-row:last-child {
          border-bottom: 0;
        }

        .detail-row > span {
          color: #6b7280;
        }

        .detail-row strong {
          color: #111827;
          font-weight: 600;
          text-align: right;
        }

        .health-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          background: #e5e7eb;
        }

        .health-item {
          padding: 22px;
          background: #ffffff;
        }

        .health-item span {
          display: block;
          margin-bottom: 6px;
          color: #6b7280;
          font-size: 12px;
        }

        .health-item strong {
          color: #111827;
          font-size: 21px;
          font-weight: 700;
        }

        .text-button {
          padding: 0;
          background: transparent;
          border: 0;
          color: #2563eb;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .toolbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }

        .toolbar h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .toolbar p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .toolbar-count {
          flex-shrink: 0;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
        }

        .filters {
          display: grid;
          grid-template-columns: minmax(300px, 1fr) 180px auto;
          gap: 10px;
          margin-bottom: 18px;
        }

        .single-filter {
          grid-template-columns: minmax(300px, 500px) auto;
        }

        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-wrapper svg {
          position: absolute;
          left: 12px;
          color: #9ca3af;
          pointer-events: none;
        }

        .search-wrapper input,
        .filters select {
          width: 100%;
          height: 38px;
          box-sizing: border-box;
          padding: 0 12px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          color: #111827;
          font-size: 13px;
          outline: none;
        }

        .search-wrapper input {
          padding-left: 36px;
        }

        .search-wrapper input:focus,
        .filters select:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 2px rgba(156, 163, 175, 0.15);
        }

        .clear-button {
          height: 38px;
          padding: 0 12px;
          background: transparent;
          border: 0;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .clear-button:hover {
          color: #111827;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
        }

        .data-table th {
          padding: 12px 16px;
          background: #fafafa;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          text-align: left;
          white-space: nowrap;
        }

        .data-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f0f0f0;
          color: #374151;
          font-size: 13px;
          vertical-align: middle;
        }

        .data-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .data-table tbody tr:hover {
          background: #fafafa;
        }

        .cell-primary {
          color: #111827;
          font-weight: 600;
        }

        .cell-secondary {
          margin-top: 4px;
          color: #9ca3af;
          font-size: 11px;
        }

        .tracking-badge {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 8px;
          background: #f3f4f6;
          border-radius: 999px;
          color: #4b5563;
          font-size: 11px;
          font-weight: 600;
        }

        .inline-link {
          color: #2563eb;
          text-decoration: none;
          font-weight: 600;
        }

        .inline-link:hover {
          text-decoration: underline;
        }

        .numeric-cell {
          text-align: right !important;
          white-space: nowrap;
        }

        .strong-number {
          color: #111827 !important;
          font-weight: 700 !important;
        }

        .location-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .location-card {
          padding: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #ffffff;
        }

        .location-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .location-name {
          color: #111827;
          font-size: 14px;
          font-weight: 700;
        }

        .location-code {
          margin-top: 4px;
          color: #9ca3af;
          font-size: 11px;
        }

        .location-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #f3f4f6;
          color: #6b7280;
          font-size: 9px;
          font-weight: 800;
        }

        .location-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .location-stats > div {
          padding: 12px;
          background: #fafafa;
          border-radius: 8px;
        }

        .location-stats span {
          display: block;
          margin-bottom: 5px;
          color: #9ca3af;
          font-size: 10px;
          font-weight: 600;
        }

        .location-stats strong {
          color: #111827;
          font-size: 14px;
          font-weight: 700;
        }

        .location-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid #f0f0f0;
          color: #6b7280;
          font-size: 11px;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
        }

        .activity-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-bottom: 1px solid #f0f0f0;
        }

        .activity-row:last-child {
          border-bottom: 0;
        }

        .activity-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border: 1px solid transparent;
          border-radius: 9px;
          font-size: 14px;
          font-weight: 800;
        }

        .activity-main {
          flex: 1;
          min-width: 0;
        }

        .activity-title {
          overflow: hidden;
          color: #111827;
          font-size: 13px;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .activity-title span {
          margin-left: 8px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 500;
        }

        .activity-meta {
          margin-top: 3px;
          color: #9ca3af;
          font-size: 11px;
        }

        .activity-quantity {
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }

        .notes-card {
          margin-bottom: 20px;
          padding: 20px 22px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .notes-card h2 {
          margin: 0;
          color: #111827;
          font-size: 15px;
          font-weight: 700;
        }

        .notes-card p {
          margin: 8px 0 0;
          color: #4b5563;
          font-size: 13px;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .empty-state {
          padding: 50px 24px;
          text-align: center;
        }

        .empty-state.full {
          grid-column: 1 / -1;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .empty-state.compact {
          padding: 32px 20px;
        }

        .empty-title {
          color: #111827;
          font-size: 14px;
          font-weight: 700;
        }

        .empty-description {
          margin-top: 6px;
          color: #6b7280;
          font-size: 12px;
        }

        .loading-page,
        .error-page {
          min-height: 70vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .loading-page {
          gap: 12px;
          color: #6b7280;
          font-size: 13px;
        }

        .loading-spinner {
          width: 26px;
          height: 26px;
          border: 3px solid #e5e7eb;
          border-top-color: #6b7280;
          border-radius: 50%;
          animation: warehouse-spin 0.8s linear infinite;
        }

        @keyframes warehouse-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          margin-bottom: 14px;
          border-radius: 12px;
          background: #fee2e2;
          color: #991b1b;
          font-size: 22px;
          font-weight: 800;
        }

        .error-page h1 {
          margin: 0;
          color: #111827;
          font-size: 22px;
        }

        .error-page p {
          max-width: 520px;
          margin: 8px 0 18px;
          color: #6b7280;
          font-size: 13px;
        }

        .error-actions {
          display: flex;
          gap: 10px;
        }

        @media (max-width: 1300px) {
          .hero-card {
            flex-direction: column;
          }

          .hero-actions {
            align-items: center;
          }

          .hero-meta-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .secondary-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .location-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1000px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .overview-grid {
            grid-template-columns: 1fr;
          }

          .filters {
            grid-template-columns: minmax(220px, 1fr) 160px auto;
          }
        }

        @media (max-width: 700px) {
          .page-content {
            padding: 18px;
          }

          .hero-card {
            padding: 20px;
          }

          .hero-title-row {
            flex-direction: column;
          }

          .hero-badges {
            align-self: flex-start;
          }

          .hero-meta-grid {
            grid-template-columns: 1fr;
          }

          .hero-actions {
            width: 100%;
            flex-direction: column;
          }

          .hero-actions > * {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .secondary-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .location-grid {
            grid-template-columns: 1fr;
          }

          .filters,
          .single-filter {
            grid-template-columns: 1fr;
          }

          .toolbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .error-actions {
            width: 100%;
            flex-direction: column;
          }

          .error-actions > * {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}