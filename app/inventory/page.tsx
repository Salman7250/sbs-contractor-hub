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

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  tracking_mode: string | null;
  status: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
  cost_price: number | null;
  selling_price: number | null;
  is_active: boolean | null;
};

type Batch = {
  id: string;
  product_id: string;
  variant_id: string | null;
  lot_number: string;
  received_at: string | null;
  quantity_received: number;
  unit_cost: number | null;
  total_cost: number | null;
  status: string | null;
};

type BatchStock = {
  id: string;
  batch_id: string;
  product_id: string;
  variant_id: string | null;
  warehouse_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
};

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
};

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string | null;
};

type ReorderRow = {
  product_id: string;
  variant_id: string | null;
  reorder_level: number | null;
};

type InventoryRow = {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string;
  sku: string;
  brand: string;
  category: string;
  trackingMode: string;
  batchCount: number;
  lotNumber: string;
  warehouseName: string;
  locationName: string;
  quantity: number;
  reserved: number;
  available: number;
  unitCost: number;
  stockValue: number;
  reorderLevel: number;
  status: "in-stock" | "low-stock" | "out-of-stock";
};

const PAGE_SIZE = 50;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function normalizeTrackingMode(value: string | null) {
  switch (value) {
    case "serial":
      return "Serial";
    case "batch":
      return "Batch";
    case "quantity":
      return "Quantity";
    case "none":
      return "Not Tracked";
    default:
      return "Unknown";
  }
}

function getTrackingClass(value: string) {
  switch (value.toLowerCase()) {
    case "serial":
      return "tracking serial";
    case "batch":
      return "tracking batch";
    case "quantity":
      return "tracking quantity";
    default:
      return "tracking";
  }
}

function getStatusLabel(status: InventoryRow["status"]) {
  switch (status) {
    case "in-stock":
      return "In Stock";
    case "low-stock":
      return "Low Stock";
    case "out-of-stock":
      return "Out of Stock";
    default:
      return status;
  }
}

export default function InventoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchStock, setBatchStock] = useState<BatchStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reorderRows, setReorderRows] = useState<ReorderRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [trackingFilter, setTrackingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [page, setPage] = useState(1);

  const loadInventory = useCallback(
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
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw new Error(authError.message);
        }

        if (!user) {
          throw new Error("You are not authenticated.");
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (membershipError) {
          throw new Error(membershipError.message);
        }

        if (!membership?.company_id) {
          throw new Error(
            "No active company was found for your account.",
          );
        }

        const currentCompanyId = membership.company_id;
        setCompanyId(currentCompanyId);

        const [
          productsResult,
          variantsResult,
          batchesResult,
          batchStockResult,
          warehousesResult,
          locationsResult,
          reorderResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id,name,brand,category,tracking_mode,status",
            )
            .eq("company_id", currentCompanyId),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,sku,cost_price,selling_price,is_active",
            )
            .eq("company_id", currentCompanyId)
            .eq("is_active", true),

          supabase
            .from("inventory_batches")
            .select(
              "id,product_id,variant_id,lot_number,received_at,quantity_received,unit_cost,total_cost,status",
            )
            .eq("company_id", currentCompanyId)
            .neq("status", "cancelled"),

          supabase
            .from("inventory_batch_stock")
            .select(
              "id,batch_id,product_id,variant_id,warehouse_id,location_id,quantity,reserved_quantity",
            )
            .eq("company_id", currentCompanyId),

          supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", currentCompanyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("warehouse_locations")
            .select("id,warehouse_id,name,code")
            .eq("company_id", currentCompanyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("inventory")
            .select(
              "product_id,variant_id,reorder_level",
            )
            .eq("company_id", currentCompanyId),
        ]);

        const errors = [
          productsResult.error,
          variantsResult.error,
          batchesResult.error,
          batchStockResult.error,
          warehousesResult.error,
          locationsResult.error,
          reorderResult.error,
        ].filter(Boolean);

        if (errors.length > 0) {
          throw new Error(
            errors[0]?.message ||
              "Failed to load inventory.",
          );
        }

        setProducts(productsResult.data ?? []);
        setVariants(variantsResult.data ?? []);
        setBatches(batchesResult.data ?? []);
        setBatchStock(batchStockResult.data ?? []);
        setWarehouses(warehousesResult.data ?? []);
        setLocations(locationsResult.data ?? []);
        setReorderRows(reorderResult.data ?? []);
      } catch (error) {
        console.error("INVENTORY LOAD ERROR:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load inventory.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadInventory();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadInventory]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();

    for (const product of products) {
      map.set(product.id, product);
    }

    return map;
  }, [products]);

  const variantMap = useMemo(() => {
    const map = new Map<string, Variant>();

    for (const variant of variants) {
      map.set(variant.id, variant);
    }

    return map;
  }, [variants]);

  const batchMap = useMemo(() => {
    const map = new Map<string, Batch>();

    for (const batch of batches) {
      map.set(batch.id, batch);
    }

    return map;
  }, [batches]);

  const warehouseMap = useMemo(() => {
    const map = new Map<string, Warehouse>();

    for (const warehouse of warehouses) {
      map.set(warehouse.id, warehouse);
    }

    return map;
  }, [warehouses]);

  const locationMap = useMemo(() => {
    const map = new Map<string, Location>();

    for (const location of locations) {
      map.set(location.id, location);
    }

    return map;
  }, [locations]);

  const reorderMap = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of reorderRows) {
      const key = `${row.product_id}:${row.variant_id ?? "null"}`;

      const current = map.get(key);

      if (
        current === undefined ||
        (row.reorder_level ?? 0) > current
      ) {
        map.set(
          key,
          Math.max(0, row.reorder_level ?? 0),
        );
      }
    }

    return map;
  }, [reorderRows]);

  const inventoryRows = useMemo<InventoryRow[]>(() => {
    return batchStock
      .map((stock) => {
        const product = productMap.get(stock.product_id);
        const variant = stock.variant_id
          ? variantMap.get(stock.variant_id)
          : undefined;
        const batch = batchMap.get(stock.batch_id);
        const warehouse = warehouseMap.get(
          stock.warehouse_id,
        );
        const location = locationMap.get(
          stock.location_id,
        );

        if (!product || !batch) {
          return null;
        }

        const quantity = Math.max(0, stock.quantity ?? 0);
        const reserved = Math.max(
          0,
          stock.reserved_quantity ?? 0,
        );
        const available = Math.max(
          0,
          quantity - reserved,
        );

        const unitCost = Number(
          batch.unit_cost ??
            variant?.cost_price ??
            0,
        );

        const reorderLevel =
          reorderMap.get(
            `${stock.product_id}:${
              stock.variant_id ?? "null"
            }`,
          ) ?? 0;

        let status: InventoryRow["status"] =
          "in-stock";

        if (available <= 0) {
          status = "out-of-stock";
        } else if (
          reorderLevel > 0 &&
          available <= reorderLevel
        ) {
          status = "low-stock";
        }

        return {
          id: stock.id,
          productId: stock.product_id,
          variantId: stock.variant_id,
          productName: product.name,
          variantName:
            variant?.name ||
            (stock.variant_id
              ? "Variant"
              : "Default"),
          sku: variant?.sku || "—",
          brand: product.brand || "—",
          category: product.category || "—",
          trackingMode: normalizeTrackingMode(
            product.tracking_mode,
          ),
          batchCount: 1,
          lotNumber: batch.lot_number,
          warehouseName:
            warehouse?.name || "Unknown Warehouse",
          locationName:
            location?.name || "Unknown Location",
          quantity,
          reserved,
          available,
          unitCost,
          stockValue: quantity * unitCost,
          reorderLevel,
          status,
        };
      })
      .filter(
        (row): row is InventoryRow => row !== null,
      );
  }, [
    batchStock,
    productMap,
    variantMap,
    batchMap,
    warehouseMap,
    locationMap,
    reorderMap,
  ]);

  const stats = useMemo(() => {
    const totalUnits = inventoryRows.reduce(
      (sum, row) => sum + row.quantity,
      0,
    );

    const availableUnits = inventoryRows.reduce(
      (sum, row) => sum + row.available,
      0,
    );

    const reservedUnits = inventoryRows.reduce(
      (sum, row) => sum + row.reserved,
      0,
    );

    const inventoryValue = inventoryRows.reduce(
      (sum, row) => sum + row.stockValue,
      0,
    );

    const lowStockProducts = new Set(
      inventoryRows
        .filter((row) => row.status === "low-stock")
        .map(
          (row) =>
            `${row.productId}:${row.variantId ?? "null"}`,
        ),
    ).size;

    const outOfStockProducts = new Set(
      inventoryRows
        .filter(
          (row) => row.status === "out-of-stock",
        )
        .map(
          (row) =>
            `${row.productId}:${row.variantId ?? "null"}`,
        ),
    ).size;

    return {
      totalUnits,
      availableUnits,
      reservedUnits,
      inventoryValue,
      lowStockProducts,
      outOfStockProducts,
    };
  }, [inventoryRows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return inventoryRows.filter((row) => {
      if (query) {
        const haystack = [
          row.productName,
          row.variantName,
          row.sku,
          row.brand,
          row.category,
          row.lotNumber,
          row.warehouseName,
          row.locationName,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (
        warehouseFilter !== "all" &&
        row.warehouseName !== warehouseFilter
      ) {
        return false;
      }

      if (
        trackingFilter !== "all" &&
        row.trackingMode !== trackingFilter
      ) {
        return false;
      }

      if (
        statusFilter !== "all" &&
        row.status !== statusFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    inventoryRows,
    search,
    warehouseFilter,
    trackingFilter,
    statusFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / PAGE_SIZE),
  );

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredRows.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [filteredRows, page]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    warehouseFilter,
    trackingFilter,
    statusFilter,
  ]);

  const clearFilters = () => {
    setSearch("");
    setWarehouseFilter("all");
    setTrackingFilter("all");
    setStatusFilter("all");
  };

  const hasFilters =
    search ||
    warehouseFilter !== "all" ||
    trackingFilter !== "all" ||
    statusFilter !== "all";

  if (loading) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading Inventory...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (errorMessage) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="error-card">
            <div className="error-icon">!</div>

            <div>
              <h2>
                Unable to load inventory
              </h2>
              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                void loadInventory()
              }
            >
              Try Again
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <style jsx>{`
          .inventory-page {
            min-width: 0;
          }

          .page-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
          }

          .header-copy {
            min-width: 0;
          }

          .eyebrow {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 7px;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .eyebrow-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #16a34a;
            box-shadow:
              0 0 0 4px #dcfce7;
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
            margin: 8px 0 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.6;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
          }

          .secondary-button,
          .primary-button {
            min-height: 40px;
            padding: 0 15px;
            border-radius: 9px;
            border: 1px solid #d1d5db;
            background: #fff;
            color: #334155;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition:
              border-color 0.15s ease,
              background 0.15s ease,
              transform 0.15s ease;
          }

          .secondary-button:hover {
            border-color: #94a3b8;
            background: #f8fafc;
          }

          .secondary-button:active,
          .primary-button:active {
            transform: translateY(1px);
          }

          .primary-button {
            border-color: #166534;
            background: #166534;
            color: #fff;
          }

          .primary-button:hover {
            background: #14532d;
          }

          .stats-grid {
            display: grid;
            grid-template-columns:
              repeat(6, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 22px;
          }

          .stat-card {
            min-width: 0;
            padding: 17px 18px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #fff;
            box-shadow:
              0 1px 2px rgba(15, 23, 42, 0.03);
          }

          .stat-label {
            color: #64748b;
            font-size: 12px;
            font-weight: 650;
            white-space: nowrap;
          }

          .stat-value {
            margin-top: 8px;
            color: #0f172a;
            font-size: 24px;
            line-height: 1.1;
            font-weight: 750;
            letter-spacing: -0.02em;
          }

          .stat-detail {
            margin-top: 6px;
            color: #94a3b8;
            font-size: 11px;
          }

          .stat-card.warning .stat-value {
            color: #b45309;
          }

          .stat-card.danger .stat-value {
            color: #dc2626;
          }

          .toolbar-card {
            padding: 16px;
            margin-bottom: 18px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #fff;
            box-shadow:
              0 1px 2px rgba(15, 23, 42, 0.03);
          }

          .toolbar {
            display: grid;
            grid-template-columns:
              minmax(260px, 1.7fr)
              repeat(3, minmax(150px, 0.7fr))
              auto;
            gap: 10px;
            align-items: center;
          }

          .search-wrap {
            position: relative;
            min-width: 0;
          }

          .search-icon {
            position: absolute;
            left: 13px;
            top: 50%;
            width: 15px;
            height: 15px;
            transform: translateY(-50%);
            color: #94a3b8;
            pointer-events: none;
          }

          .search-input,
          .filter-select {
            width: 100%;
            height: 42px;
            border: 1px solid #dbe1e8;
            border-radius: 9px;
            background: #fff;
            color: #1e293b;
            outline: none;
            font-size: 13px;
          }

          .search-input {
            padding: 0 13px 0 39px;
          }

          .filter-select {
            padding: 0 34px 0 12px;
          }

          .search-input:focus,
          .filter-select:focus {
            border-color: #94a3b8;
            box-shadow:
              0 0 0 3px
                rgba(22, 101, 52, 0.08);
          }

          .clear-button {
            height: 40px;
            padding: 0 12px;
            border: 0;
            border-radius: 8px;
            background: #f1f5f9;
            color: #475569;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            white-space: nowrap;
          }

          .clear-button:hover {
            background: #e2e8f0;
          }

          .content-card {
            overflow: hidden;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #fff;
            box-shadow:
              0 1px 2px rgba(15, 23, 42, 0.03);
          }

          .content-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 18px 20px;
            border-bottom: 1px solid #eef0f3;
          }

          .content-header-copy h2 {
            margin: 0;
            color: #0f172a;
            font-size: 16px;
            font-weight: 750;
          }

          .content-header-copy p {
            margin: 4px 0 0;
            color: #94a3b8;
            font-size: 12px;
          }

          .result-count {
            color: #64748b;
            font-size: 12px;
            font-weight: 650;
          }

          .table-wrap {
            width: 100%;
            overflow-x: auto;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            min-width: 1180px;
          }

          th {
            padding: 11px 16px;
            background: #f8fafc;
            color: #64748b;
            border-bottom: 1px solid #e5e7eb;
            font-size: 11px;
            font-weight: 750;
            text-align: left;
            white-space: nowrap;
          }

          td {
            padding: 14px 16px;
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
            font-size: 13px;
            vertical-align: middle;
          }

          tbody tr {
            transition: background 0.12s ease;
          }

          tbody tr:hover {
            background: #fafafa;
          }

          tbody tr:last-child td {
            border-bottom: 0;
          }

          .product-cell {
            min-width: 220px;
          }

          .product-name {
            color: #0f172a;
            font-weight: 700;
          }

          .product-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 4px;
            color: #94a3b8;
            font-size: 11px;
          }

          .variant-name {
            color: #475569;
            font-size: 12px;
            margin-top: 3px;
          }

          .sku {
            color: #64748b;
            font-family:
              ui-monospace,
              SFMono-Regular,
              Menlo,
              Monaco,
              Consolas,
              monospace;
            font-size: 11px;
          }

          .tracking {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            padding: 0 8px;
            border: 1px solid #e2e8f0;
            border-radius: 999px;
            background: #f8fafc;
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
          }

          .tracking.serial {
            border-color: #dbeafe;
            background: #eff6ff;
            color: #2563eb;
          }

          .tracking.batch {
            border-color: #ede9fe;
            background: #f5f3ff;
            color: #7c3aed;
          }

          .tracking.quantity {
            border-color: #dcfce7;
            background: #f0fdf4;
            color: #15803d;
          }

          .lot-button {
            padding: 0;
            border: 0;
            background: transparent;
            color: #166534;
            font-family:
              ui-monospace,
              SFMono-Regular,
              Menlo,
              Monaco,
              Consolas,
              monospace;
            font-size: 11px;
            font-weight: 750;
            cursor: pointer;
          }

          .lot-button:hover {
            text-decoration: underline;
          }

          .location-cell {
            min-width: 180px;
          }

          .warehouse-name {
            color: #334155;
            font-weight: 650;
          }

          .location-name {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 11px;
          }

          .number-cell {
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
          }

          .available-number {
            color: #0f172a;
            font-weight: 750;
          }

          .reserved-number {
            color: #64748b;
            font-size: 12px;
          }

          .cost-cell,
          .value-cell {
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
          }

          .value-cell {
            color: #0f172a;
            font-weight: 700;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-height: 25px;
            padding: 0 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 750;
            white-space: nowrap;
          }

          .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
          }

          .status-in-stock {
            background: #ecfdf5;
            color: #15803d;
          }

          .status-low-stock {
            background: #fffbeb;
            color: #b45309;
          }

          .status-out-of-stock {
            background: #fef2f2;
            color: #dc2626;
          }

          .empty-state {
            padding: 64px 24px;
            text-align: center;
          }

          .empty-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 52px;
            height: 52px;
            margin: 0 auto 14px;
            border-radius: 14px;
            background: #f1f5f9;
            color: #64748b;
            font-size: 22px;
            font-weight: 750;
          }

          .empty-state h3 {
            margin: 0;
            color: #0f172a;
            font-size: 16px;
            font-weight: 750;
          }

          .empty-state p {
            max-width: 440px;
            margin: 7px auto 0;
            color: #94a3b8;
            font-size: 13px;
            line-height: 1.6;
          }

          .pagination {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 16px;
            border-top: 1px solid #eef0f3;
          }

          .pagination-info {
            color: #64748b;
            font-size: 12px;
          }

          .pagination-actions {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .page-button {
            min-width: 34px;
            height: 34px;
            padding: 0 9px;
            border: 1px solid #dbe1e8;
            border-radius: 8px;
            background: #fff;
            color: #475569;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }

          .page-button:hover:not(:disabled) {
            background: #f8fafc;
          }

          .page-button:disabled {
            cursor: not-allowed;
            opacity: 0.45;
          }

          .page-number {
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 34px;
            height: 34px;
            color: #475569;
            font-size: 12px;
            font-weight: 700;
          }

          .loading-state {
            min-height: 420px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            color: #64748b;
          }

          .loading-spinner {
            width: 28px;
            height: 28px;
            border: 3px solid #e2e8f0;
            border-top-color: #166534;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          .loading-state p {
            margin: 0;
            font-size: 13px;
          }

          .error-card {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 20px;
            border: 1px solid #fecaca;
            border-radius: 14px;
            background: #fff;
          }

          .error-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: #fef2f2;
            color: #dc2626;
            font-weight: 800;
          }

          .error-card h2 {
            margin: 0;
            color: #0f172a;
            font-size: 15px;
          }

          .error-card p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 12px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 1450px) {
            .stats-grid {
              grid-template-columns:
                repeat(3, minmax(0, 1fr));
            }

            .toolbar {
              grid-template-columns:
                minmax(220px, 1.5fr)
                repeat(3, minmax(140px, 1fr))
                auto;
            }
          }

          @media (max-width: 1050px) {
            .page-header {
              flex-direction: column;
            }

            .header-actions {
              width: 100%;
            }

            .header-actions button {
              flex: 1;
            }

            .toolbar {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .search-wrap {
              grid-column: 1 / -1;
            }
          }

          @media (max-width: 700px) {
            .stats-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .toolbar {
              grid-template-columns: 1fr;
            }

            .search-wrap {
              grid-column: auto;
            }

            .pagination {
              flex-direction: column;
              align-items: flex-start;
            }

            .page-title {
              font-size: 25px;
            }
          }
        `}</style>

        <div className="page-header">
          <div className="header-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Products & Inventory
            </div>

            <h1 className="page-title">
              Inventory
            </h1>

            <p className="page-subtitle">
              Monitor stock, batches, locations,
              reservations, and inventory value from
              one workspace.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void loadInventory(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                router.push(
                  "/inventory/receiving",
                )
              }
            >
              Receive Stock
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Stock
            </div>
            <div className="stat-value">
              {formatNumber(stats.totalUnits)}
            </div>
            <div className="stat-detail">
              Physical units across all batches
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Available
            </div>
            <div className="stat-value">
              {formatNumber(stats.availableUnits)}
            </div>
            <div className="stat-detail">
              Ready for allocation or sale
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Reserved
            </div>
            <div className="stat-value">
              {formatNumber(stats.reservedUnits)}
            </div>
            <div className="stat-detail">
              Currently held for orders
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Inventory Value
            </div>
            <div className="stat-value">
              {formatMoney(stats.inventoryValue)}
            </div>
            <div className="stat-detail">
              Quantity × batch unit cost
            </div>
          </div>

          <div className="stat-card warning">
            <div className="stat-label">
              Low Stock
            </div>
            <div className="stat-value">
              {formatNumber(
                stats.lowStockProducts,
              )}
            </div>
            <div className="stat-detail">
              Products at or below reorder level
            </div>
          </div>

          <div className="stat-card danger">
            <div className="stat-label">
              Out of Stock
            </div>
            <div className="stat-value">
              {formatNumber(
                stats.outOfStockProducts,
              )}
            </div>
            <div className="stat-detail">
              Products with no available stock
            </div>
          </div>
        </div>

        <div className="toolbar-card">
          <div className="toolbar">
            <div className="search-wrap">
              <svg
                className="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                />
                <path d="m20 20-4-4" />
              </svg>

              <input
                type="search"
                className="search-input"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search product, SKU, batch, warehouse..."
              />
            </div>

            <select
              className="filter-select"
              value={warehouseFilter}
              onChange={(event) =>
                setWarehouseFilter(
                  event.target.value,
                )
              }
            >
              <option value="all">
                All Warehouses
              </option>

              {warehouses.map((warehouse) => (
                <option
                  key={warehouse.id}
                  value={warehouse.name}
                >
                  {warehouse.name}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={trackingFilter}
              onChange={(event) =>
                setTrackingFilter(
                  event.target.value,
                )
              }
            >
              <option value="all">
                All Tracking
              </option>
              <option value="Serial">
                Serial
              </option>
              <option value="Batch">
                Batch
              </option>
              <option value="Quantity">
                Quantity
              </option>
            </select>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
            >
              <option value="all">
                All Status
              </option>
              <option value="in-stock">
                In Stock
              </option>
              <option value="low-stock">
                Low Stock
              </option>
              <option value="out-of-stock">
                Out of Stock
              </option>
            </select>

            {hasFilters ? (
              <button
                type="button"
                className="clear-button"
                onClick={clearFilters}
              >
                Clear
              </button>
            ) : (
              <div />
            )}
          </div>
        </div>

        <section className="content-card">
          <div className="content-header">
            <div className="content-header-copy">
              <h2>Current Stock</h2>
              <p>
                Batch-level inventory across all
                warehouses and locations.
              </p>
            </div>

            <div className="result-count">
              {formatNumber(
                filteredRows.length,
              )}{" "}
              records
            </div>
          </div>

          {paginatedRows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                📦
              </div>

              <h3>
                {inventoryRows.length === 0
                  ? "No inventory yet"
                  : "No matching inventory"}
              </h3>

              <p>
                {inventoryRows.length === 0
                  ? "Inventory will appear here after stock is received into a batch."
                  : "Try changing your search or clearing the filters."}
              </p>

              {inventoryRows.length === 0 ? (
                <button
                  type="button"
                  className="primary-button"
                  style={{
                    marginTop: 18,
                  }}
                  onClick={() =>
                    router.push(
                      "/inventory/receiving",
                    )
                  }
                >
                  Receive Stock
                </button>
              ) : (
                hasFilters && (
                  <button
                    type="button"
                    className="secondary-button"
                    style={{
                      marginTop: 18,
                    }}
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </button>
                )
              )}
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Tracking</th>
                      <th>Batch / Lot</th>
                      <th>Warehouse / Location</th>
                      <th>Stock</th>
                      <th>Unit Cost</th>
                      <th>Stock Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="product-cell">
                            <div className="product-name">
                              {row.productName}
                            </div>

                            <div className="variant-name">
                              {row.variantName}
                            </div>

                            <div className="product-meta">
                              <span className="sku">
                                {row.sku}
                              </span>

                              {row.brand !== "—" && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {row.brand}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={getTrackingClass(
                              row.trackingMode,
                            )}
                          >
                            {row.trackingMode}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="lot-button"
                            onClick={() =>
                              router.push(
                                `/inventory/${row.productId}`,
                              )
                            }
                            title="Open product inventory"
                          >
                            {row.lotNumber}
                          </button>
                        </td>

                        <td>
                          <div className="location-cell">
                            <div className="warehouse-name">
                              {row.warehouseName}
                            </div>

                            <div className="location-name">
                              {row.locationName}
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="number-cell">
                            <div className="available-number">
                              {formatNumber(
                                row.available,
                              )}{" "}
                              available
                            </div>

                            <div className="reserved-number">
                              {formatNumber(
                                row.reserved,
                              )}{" "}
                              reserved ·{" "}
                              {formatNumber(
                                row.quantity,
                              )}{" "}
                              total
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="cost-cell">
                            {formatMoney(
                              row.unitCost,
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="value-cell">
                            {formatMoney(
                              row.stockValue,
                            )}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`status-badge status-${row.status}`}
                          >
                            <span className="status-dot" />
                            {getStatusLabel(
                              row.status,
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Showing{" "}
                  {formatNumber(
                    (page - 1) * PAGE_SIZE + 1,
                  )}{" "}
                  –{" "}
                  {formatNumber(
                    Math.min(
                      page * PAGE_SIZE,
                      filteredRows.length,
                    ),
                  )}{" "}
                  of{" "}
                  {formatNumber(
                    filteredRows.length,
                  )}
                </div>

                <div className="pagination-actions">
                  <button
                    type="button"
                    className="page-button"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) =>
                        Math.max(1, current - 1),
                      )
                    }
                  >
                    Previous
                  </button>

                  <span className="page-number">
                    {page} / {totalPages}
                  </span>

                  <button
                    type="button"
                    className="page-button"
                    disabled={
                      page >= totalPages
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          totalPages,
                          current + 1,
                        ),
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}