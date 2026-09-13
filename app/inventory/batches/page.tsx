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
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
  cost_price: number | null;
};

type Batch = {
  id: string;
  product_id: string;
  variant_id: string | null;
  lot_number: string;
  received_at: string | null;
  quantity_received: number;
  unit_cost: number | null;
  landed_cost_total: number | null;
  refurbishment_cost_total: number | null;
  other_cost_total: number | null;
  total_cost: number | null;
  status: string | null;
  purchase_order_id: string | null;
  supplier_id: string | null;
  notes: string | null;
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusClass(status: string | null) {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return "status status-active";

    case "depleted":
      return "status status-depleted";

    case "quarantined":
      return "status status-quarantined";

    case "closed":
      return "status status-closed";

    case "cancelled":
      return "status status-cancelled";

    default:
      return "status";
  }
}

function getTrackingLabel(mode: string | null) {
  switch ((mode ?? "").toLowerCase()) {
    case "serial":
      return "Serialized";

    case "batch":
      return "Batch";

    case "quantity":
      return "Quantity";

    case "none":
      return "Not tracked";

    default:
      return "—";
  }
}

export default function BatchesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchStock, setBatchStock] = useState<BatchStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [trackingFilter, setTrackingFilter] = useState("all");

  const [page, setPage] = useState(1);

  const pageSize = 12;

  const loadData = useCallback(
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

        if (userError || !user) {
          throw new Error("Unable to identify the current user.");
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (membershipError || !membership?.company_id) {
          throw new Error(
            "No company is associated with this account.",
          );
        }

        const companyId = membership.company_id;

        const [
          productsResult,
          variantsResult,
          batchesResult,
          batchStockResult,
          warehousesResult,
          locationsResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id,name,brand,category,tracking_mode",
            )
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,sku,cost_price",
            )
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("inventory_batches")
            .select(
              "id,product_id,variant_id,lot_number,received_at,quantity_received,unit_cost,landed_cost_total,refurbishment_cost_total,other_cost_total,total_cost,status,purchase_order_id,supplier_id,notes",
            )
            .eq("company_id", companyId)
            .neq("status", "cancelled")
            .order("received_at", {
              ascending: false,
            }),

          supabase
            .from("inventory_batch_stock")
            .select(
              "id,batch_id,product_id,variant_id,warehouse_id,location_id,quantity,reserved_quantity",
            )
            .eq("company_id", companyId),

          supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("warehouse_locations")
            .select(
              "id,warehouse_id,name,code",
            )
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name"),
        ]);

        if (productsResult.error) {
          throw productsResult.error;
        }

        if (variantsResult.error) {
          throw variantsResult.error;
        }

        if (batchesResult.error) {
          throw batchesResult.error;
        }

        if (batchStockResult.error) {
          throw batchStockResult.error;
        }

        if (warehousesResult.error) {
          throw warehousesResult.error;
        }

        if (locationsResult.error) {
          throw locationsResult.error;
        }

        setProducts(productsResult.data ?? []);
        setVariants(variantsResult.data ?? []);
        setBatches(batchesResult.data ?? []);
        setBatchStock(batchStockResult.data ?? []);
        setWarehouses(warehousesResult.data ?? []);
        setLocations(locationsResult.data ?? []);
      } catch (error) {
        console.error(
          "Unable to load batches:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load batches.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    warehouseFilter,
    trackingFilter,
  ]);

  const productMap = useMemo(() => {
    return new Map(
      products.map((product) => [
        product.id,
        product,
      ]),
    );
  }, [products]);

  const variantMap = useMemo(() => {
    return new Map(
      variants.map((variant) => [
        variant.id,
        variant,
      ]),
    );
  }, [variants]);

  const warehouseMap = useMemo(() => {
    return new Map(
      warehouses.map((warehouse) => [
        warehouse.id,
        warehouse,
      ]),
    );
  }, [warehouses]);

  const locationMap = useMemo(() => {
    return new Map(
      locations.map((location) => [
        location.id,
        location,
      ]),
    );
  }, [locations]);

  const batchStockMap = useMemo(() => {
    const map = new Map<string, BatchStock[]>();

    for (const row of batchStock) {
      const existing =
        map.get(row.batch_id) ?? [];

      existing.push(row);

      map.set(row.batch_id, existing);
    }

    return map;
  }, [batchStock]);

  const enrichedBatches = useMemo(() => {
    return batches.map((batch) => {
      const product = productMap.get(
        batch.product_id,
      );

      const variant = batch.variant_id
        ? variantMap.get(batch.variant_id)
        : null;

      const stockRows =
        batchStockMap.get(batch.id) ?? [];

      const quantityRemaining =
        stockRows.reduce(
          (sum, row) =>
            sum + Number(row.quantity ?? 0),
          0,
        );

      const reservedQuantity =
        stockRows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.reserved_quantity ?? 0,
            ),
          0,
        );

      const unitCost =
        batch.unit_cost !== null
          ? Number(batch.unit_cost)
          : Number(
              variant?.cost_price ?? 0,
            );

      const totalCost =
        batch.total_cost !== null
          ? Number(batch.total_cost)
          : Number(
              batch.quantity_received ?? 0,
            ) * unitCost;

      const warehouseIds = Array.from(
        new Set(
          stockRows.map(
            (row) => row.warehouse_id,
          ),
        ),
      );

      const warehousesForBatch =
        warehouseIds
          .map((id) =>
            warehouseMap.get(id),
          )
          .filter(
            Boolean,
          ) as Warehouse[];

      return {
        batch,
        product,
        variant,
        stockRows,
        quantityRemaining,
        reservedQuantity,
        unitCost,
        totalCost,
        warehousesForBatch,
      };
    });
  }, [
    batches,
    productMap,
    variantMap,
    batchStockMap,
    warehouseMap,
  ]);

  const filteredBatches = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return enrichedBatches.filter(
      (row) => {
        const productName =
          row.product?.name?.toLowerCase() ??
          "";

        const brand =
          row.product?.brand?.toLowerCase() ??
          "";

        const variantName =
          row.variant?.name?.toLowerCase() ??
          "";

        const sku =
          row.variant?.sku?.toLowerCase() ??
          "";

        const lotNumber =
          row.batch.lot_number.toLowerCase();

        const warehouseNames =
          row.warehousesForBatch
            .map(
              (warehouse) =>
                `${warehouse.name} ${
                  warehouse.code ?? ""
                }`,
            )
            .join(" ")
            .toLowerCase();

        const matchesSearch =
          !query ||
          productName.includes(query) ||
          brand.includes(query) ||
          variantName.includes(query) ||
          sku.includes(query) ||
          lotNumber.includes(query) ||
          warehouseNames.includes(query);

        const matchesStatus =
          statusFilter === "all" ||
          (
            row.batch.status ?? ""
          ).toLowerCase() ===
            statusFilter;

        const matchesWarehouse =
          warehouseFilter === "all" ||
          row.stockRows.some(
            (stock) =>
              stock.warehouse_id ===
              warehouseFilter,
          );

        const matchesTracking =
          trackingFilter === "all" ||
          (
            row.product?.tracking_mode ?? ""
          ).toLowerCase() ===
            trackingFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesWarehouse &&
          matchesTracking
        );
      },
    );
  }, [
    enrichedBatches,
    search,
    statusFilter,
    warehouseFilter,
    trackingFilter,
  ]);

  const stats = useMemo(() => {
    const totalBatches =
      batches.length;

    const activeBatches =
      batches.filter(
        (batch) =>
          (
            batch.status ?? ""
          ).toLowerCase() === "active",
      ).length;

    const quarantinedBatches =
      batches.filter(
        (batch) =>
          (
            batch.status ?? ""
          ).toLowerCase() ===
          "quarantined",
      ).length;

    const unitsReceived =
      batches.reduce(
        (sum, batch) =>
          sum +
          Number(
            batch.quantity_received ?? 0,
          ),
        0,
      );

    const unitsRemaining =
      enrichedBatches.reduce(
        (sum, row) =>
          sum +
          row.quantityRemaining,
        0,
      );

    const totalBatchCost =
      enrichedBatches.reduce(
        (sum, row) =>
          sum + row.totalCost,
        0,
      );

    return {
      totalBatches,
      activeBatches,
      quarantinedBatches,
      unitsReceived,
      unitsRemaining,
      totalBatchCost,
    };
  }, [
    batches,
    enrichedBatches,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredBatches.length /
        pageSize,
    ),
  );

  const paginatedBatches =
    useMemo(() => {
      const start =
        (page - 1) * pageSize;

      return filteredBatches.slice(
        start,
        start + pageSize,
      );
    }, [
      filteredBatches,
      page,
    ]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setWarehouseFilter("all");
    setTrackingFilter("all");
  };

  const hasFilters =
    Boolean(search) ||
    statusFilter !== "all" ||
    warehouseFilter !== "all" ||
    trackingFilter !== "all";

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <style jsx>{`
          .inventory-page {
            padding-bottom: 40px;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 24px;
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
            border-radius: 999px;
            background: #16a34a;
          }

          .page-title {
            margin: 0;
            color: #0f172a;
            font-size: 30px;
            line-height: 1.2;
            font-weight: 750;
            letter-spacing: -0.03em;
          }

          .page-subtitle {
            margin: 7px 0 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.6;
            max-width: 760px;
          }

          .header-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }

          .button {
            border: 1px solid #d1d5db;
            border-radius: 9px;
            background: #ffffff;
            color: #334155;
            min-height: 40px;
            padding: 0 14px;
            font-size: 13px;
            font-weight: 650;
            cursor: pointer;
            transition:
              background 0.15s ease,
              border-color 0.15s ease,
              box-shadow 0.15s ease;
          }

          .button:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
          }

          .button:disabled {
            cursor: not-allowed;
            opacity: 0.6;
          }

          .button-primary {
            background: #166534;
            border-color: #166534;
            color: #ffffff;
          }

          .button-primary:hover {
            background: #14532d;
            border-color: #14532d;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(
              6,
              minmax(0, 1fr)
            );
            gap: 14px;
            margin-bottom: 18px;
          }

          .stat-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 15px 16px;
            box-shadow:
              0 1px 2px
                rgba(15, 23, 42, 0.03);
            min-width: 0;
          }

          .stat-label {
            color: #64748b;
            font-size: 12px;
            font-weight: 650;
            margin-bottom: 7px;
          }

          .stat-value {
            color: #0f172a;
            font-size: 21px;
            line-height: 1.2;
            font-weight: 750;
            letter-spacing: -0.025em;
            white-space: nowrap;
          }

          .stat-helper {
            margin-top: 5px;
            color: #94a3b8;
            font-size: 10px;
            line-height: 1.35;
          }

          .toolbar {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 12px;
            margin-bottom: 18px;
            box-shadow:
              0 1px 2px
                rgba(15, 23, 42, 0.03);
          }

          .toolbar-grid {
            display: grid;
            grid-template-columns:
              minmax(300px, 1.8fr)
              repeat(3, minmax(145px, 1fr))
              auto;
            gap: 9px;
            align-items: center;
          }

          .search-wrap {
            position: relative;
          }

          .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            pointer-events: none;
          }

          .search-input,
          .filter-select {
            width: 100%;
            height: 38px;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            background: #ffffff;
            color: #0f172a;
            font-size: 13px;
            outline: none;
          }

          .search-input {
            padding: 0 12px 0 36px;
          }

          .filter-select {
            padding: 0 10px;
          }

          .search-input:focus,
          .filter-select:focus {
            border-color: #86a48f;
            box-shadow:
              0 0 0 3px
                rgba(22, 101, 52, 0.08);
          }

          .clear-button {
            white-space: nowrap;
            height: 38px;
            border: 0;
            background: transparent;
            color: #166534;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            padding: 0 5px;
          }

          .content-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            overflow: hidden;
            box-shadow:
              0 1px 2px
                rgba(15, 23, 42, 0.03);
          }

          .content-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            padding: 14px 18px;
            border-bottom: 1px solid #e5e7eb;
          }

          .content-title {
            margin: 0;
            color: #0f172a;
            font-size: 15px;
            font-weight: 750;
          }

          .content-description {
            margin: 4px 0 0;
            color: #94a3b8;
            font-size: 12px;
          }

          .result-count {
            color: #64748b;
            font-size: 12px;
            white-space: nowrap;
          }

          .table-wrap {
            width: 100%;
            overflow-x: auto;
          }

          table {
            width: 100%;
            min-width: 1380px;
            border-collapse: collapse;
            table-layout: auto;
          }

          th {
            background: #f8fafc;
            color: #64748b;
            border-bottom: 1px solid #e5e7eb;
            padding: 9px 14px;
            text-align: left;
            font-size: 11px;
            font-weight: 750;
            letter-spacing: 0.035em;
            text-transform: uppercase;
            white-space: nowrap;
          }

          td {
            color: #334155;
            border-bottom: 1px solid #eef2f7;
            padding: 9px 14px;
            font-size: 13px;
            vertical-align: middle;
            white-space: nowrap;
          }

          tbody tr {
            height: 72px;
          }

          tbody tr:hover {
            background: #fafafa;
          }

          tbody tr:last-child td {
            border-bottom: 0;
          }

          .batch-cell {
            min-width: 150px;
          }

          .batch-number {
            color: #166534;
            font-weight: 750;
            cursor: pointer;
            white-space: nowrap;
            max-width: 190px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .batch-number:hover {
            text-decoration: underline;
          }

          .batch-meta {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
            white-space: nowrap;
          }

          .product-cell {
            min-width: 210px;
          }

          .product-name {
            color: #0f172a;
            font-weight: 700;
            white-space: nowrap;
          }

          .variant-name {
            margin-top: 3px;
            color: #64748b;
            font-size: 11px;
            white-space: nowrap;
          }

          .sku {
            margin-top: 2px;
            color: #94a3b8;
            font-size: 10px;
            font-family:
              ui-monospace,
              SFMono-Regular,
              Menlo,
              Monaco,
              Consolas,
              "Liberation Mono",
              "Courier New",
              monospace;
            white-space: nowrap;
          }

          .tracking-pill {
            display: inline-flex;
            align-items: center;
            border: 1px solid #dbe3dc;
            background: #f5faf6;
            color: #166534;
            border-radius: 999px;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
          }

          .date-cell {
            min-width: 105px;
          }

          .date-primary {
            color: #334155;
            font-weight: 650;
            white-space: nowrap;
          }

          .source-cell {
            min-width: 185px;
            max-width: 230px;
          }

          .source-primary {
            color: #334155;
            font-weight: 650;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 220px;
          }

          .source-secondary {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
            white-space: nowrap;
          }

          .qty-cell {
            min-width: 85px;
          }

          .qty-primary {
            color: #0f172a;
            font-weight: 750;
            white-space: nowrap;
          }

          .qty-secondary {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
            white-space: nowrap;
          }

          .warehouse-list {
            display: flex;
            flex-direction: column;
            gap: 3px;
            min-width: 190px;
          }

          .warehouse-row {
            display: flex;
            align-items: center;
            gap: 7px;
          }

          .warehouse-name {
            color: #334155;
            font-weight: 650;
            white-space: nowrap;
            max-width: 145px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .warehouse-qty {
            color: #64748b;
            font-size: 10px;
            white-space: nowrap;
          }

          .warehouse-location {
            color: #94a3b8;
            font-size: 10px;
            white-space: nowrap;
          }

          .cost-primary {
            color: #0f172a;
            font-weight: 700;
            white-space: nowrap;
          }

          .cost-secondary {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
            white-space: nowrap;
          }

          .status {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 5px 9px;
            background: #f1f5f9;
            color: #64748b;
            font-size: 11px;
            font-weight: 750;
            text-transform: capitalize;
            white-space: nowrap;
          }

          .status-active {
            background: #ecfdf3;
            color: #166534;
          }

          .status-depleted {
            background: #f8fafc;
            color: #64748b;
          }

          .status-quarantined {
            background: #fff7ed;
            color: #c2410c;
          }

          .status-closed {
            background: #f1f5f9;
            color: #475569;
          }

          .status-cancelled {
            background: #fef2f2;
            color: #b91c1c;
          }

          .empty-state {
            padding: 60px 20px;
            text-align: center;
          }

          .empty-icon {
            width: 44px;
            height: 44px;
            margin: 0 auto 12px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f1f5f9;
            color: #64748b;
          }

          .empty-title {
            margin: 0;
            color: #0f172a;
            font-size: 15px;
            font-weight: 750;
          }

          .empty-description {
            max-width: 460px;
            margin: 7px auto 0;
            color: #94a3b8;
            font-size: 13px;
            line-height: 1.6;
          }

          .error-box {
            background: #fff7f7;
            border: 1px solid #fecaca;
            color: #b91c1c;
            border-radius: 12px;
            padding: 14px 16px;
            margin-bottom: 18px;
            font-size: 13px;
          }

          .loading-state {
            padding: 60px 20px;
            text-align: center;
            color: #64748b;
            font-size: 13px;
          }

          .pagination {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
            padding: 12px 18px;
            border-top: 1px solid #e5e7eb;
          }

          .pagination-info {
            color: #64748b;
            font-size: 12px;
          }

          .pagination-actions {
            display: flex;
            gap: 7px;
          }

          .pagination-button {
            min-width: 34px;
            height: 32px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: #ffffff;
            color: #334155;
            cursor: pointer;
            font-size: 12px;
            font-weight: 650;
          }

          .pagination-button:hover:not(:disabled) {
            background: #f8fafc;
          }

          .pagination-button:disabled {
            opacity: 0.45;
            cursor: not-allowed;
          }

          @media (max-width: 1450px) {
            .stats-grid {
              grid-template-columns: repeat(
                3,
                minmax(0, 1fr)
              );
            }

            .toolbar-grid {
              grid-template-columns:
                minmax(250px, 1.5fr)
                repeat(
                  3,
                  minmax(135px, 1fr)
                )
                auto;
            }
          }

          @media (max-width: 950px) {
            .page-header {
              flex-direction: column;
            }

            .toolbar-grid {
              grid-template-columns:
                repeat(
                  2,
                  minmax(0, 1fr)
                );
            }

            .search-wrap {
              grid-column: span 2;
            }
          }

          @media (max-width: 600px) {
            .stats-grid {
              grid-template-columns: repeat(
                2,
                minmax(0, 1fr)
              );
            }

            .toolbar-grid {
              grid-template-columns: 1fr;
            }

            .search-wrap {
              grid-column: auto;
            }

            .header-actions {
              width: 100%;
            }

            .header-actions .button {
              flex: 1;
            }

            .pagination {
              flex-direction: column;
              align-items: flex-start;
            }
          }

          @media (max-width: 420px) {
            .stats-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Inventory / Batches & Lots
            </div>

            <h1 className="page-title">
              Batches & Lots
            </h1>

            <p className="page-subtitle">
              Track where inventory came from, when
              it was received, what it cost, how much
              remains, and where the batch is currently
              stored.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                router.push("/purchase-orders")
              }
            >
              View Purchase Orders
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="error-box">
            {errorMessage}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Batches
            </div>

            <div className="stat-value">
              {formatNumber(
                stats.totalBatches,
              )}
            </div>

            <div className="stat-helper">
              Non-cancelled lots
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Active Batches
            </div>

            <div className="stat-value">
              {formatNumber(
                stats.activeBatches,
              )}
            </div>

            <div className="stat-helper">
              Currently active lots
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Units Received
            </div>

            <div className="stat-value">
              {formatNumber(
                stats.unitsReceived,
              )}
            </div>

            <div className="stat-helper">
              Original received quantity
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Units Remaining
            </div>

            <div className="stat-value">
              {formatNumber(
                stats.unitsRemaining,
              )}
            </div>

            <div className="stat-helper">
              Current batch stock
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Total Batch Cost
            </div>

            <div className="stat-value">
              {formatCurrency(
                stats.totalBatchCost,
              )}
            </div>

            <div className="stat-helper">
              Acquisition cost
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Quarantined
            </div>

            <div className="stat-value">
              {formatNumber(
                stats.quarantinedBatches,
              )}
            </div>

            <div className="stat-helper">
              Lots requiring attention
            </div>
          </div>
        </div>

        <div className="toolbar">
          <div className="toolbar-grid">
            <div className="search-wrap">
              <span className="search-icon">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                  />

                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>

              <input
                className="search-input"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search batch, lot, product, SKU..."
              />
            </div>

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
                All Statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="depleted">
                Depleted
              </option>

              <option value="quarantined">
                Quarantined
              </option>

              <option value="closed">
                Closed
              </option>
            </select>

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

              {warehouses.map(
                (warehouse) => (
                  <option
                    key={warehouse.id}
                    value={warehouse.id}
                  >
                    {warehouse.name}
                    {warehouse.code
                      ? ` (${warehouse.code})`
                      : ""}
                  </option>
                ),
              )}
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

              <option value="serial">
                Serialized
              </option>

              <option value="batch">
                Batch
              </option>

              <option value="quantity">
                Quantity
              </option>

              <option value="none">
                Not Tracked
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
              <span />
            )}
          </div>
        </div>

        <div className="content-card">
          <div className="content-header">
            <div>
              <h2 className="content-title">
                Batch Provenance
              </h2>

              <p className="content-description">
                Inventory source, cost, quantity,
                and current batch location.
              </p>
            </div>

            <div className="result-count">
              {formatNumber(
                filteredBatches.length,
              )}{" "}
              batches
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              Loading batch records...
            </div>
          ) : paginatedBatches.length ===
            0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M21 8.5 12 4 3 8.5v7L12 20l9-4.5z" />

                  <path d="m3 8.5 9 4.5 9-4.5M12 13v7" />
                </svg>
              </div>

              <h3 className="empty-title">
                No batches found
              </h3>

              <p className="empty-description">
                {hasFilters
                  ? "No batches match the current filters. Try changing or clearing your filters."
                  : "Batches will appear here when inventory is received into the system."}
              </p>

              {hasFilters && (
                <button
                  type="button"
                  className="button"
                  style={{
                    marginTop: 16,
                  }}
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Batch / Lot
                      </th>

                      <th>
                        Product
                      </th>

                      <th>
                        Tracking
                      </th>

                      <th>
                        Received
                      </th>

                      <th>
                        Source
                      </th>

                      <th>
                        Original Qty
                      </th>

                      <th>
                        Remaining
                      </th>

                      <th>
                        Warehouse / Location
                      </th>

                      <th>
                        Unit Cost
                      </th>

                      <th>
                        Total Batch Cost
                      </th>

                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedBatches.map(
                      (row) => {
                        const locationRows =
                          row.stockRows.slice(
                            0,
                            2,
                          );

                        return (
                          <tr
                            key={
                              row.batch.id
                            }
                          >
                            <td>
                              <div className="batch-cell">
                                <div
                                  className="batch-number"
                                  title={
                                    row.batch
                                      .lot_number
                                  }
                                  onClick={() =>
                                    router.push(
                                      `/inventory/batches/${row.batch.id}`,
                                    )
                                  }
                                >
                                  {
                                    row.batch
                                      .lot_number
                                  }
                                </div>

                                <div className="batch-meta">
                                  ID:{" "}
                                  {row.batch.id.slice(
                                    0,
                                    8,
                                  )}
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="product-cell">
                                <div className="product-name">
                                  {row.product
                                    ?.name ||
                                    "Unknown Product"}
                                </div>

                                {row.variant
                                  ?.name && (
                                  <div className="variant-name">
                                    {
                                      row.variant
                                        .name
                                    }
                                  </div>
                                )}

                                {row.variant
                                  ?.sku && (
                                  <div className="sku">
                                    SKU:{" "}
                                    {
                                      row.variant
                                        .sku
                                    }
                                  </div>
                                )}
                              </div>
                            </td>

                            <td>
                              <span className="tracking-pill">
                                {getTrackingLabel(
                                  row
                                    .product
                                    ?.tracking_mode ??
                                    null,
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="date-cell">
                                <div className="date-primary">
                                  {formatDate(
                                    row.batch
                                      .received_at,
                                  )}
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="source-cell">
                                {row.batch
                                  .purchase_order_id ? (
                                  <>
                                    <div className="source-primary">
                                      Purchase
                                      Order
                                    </div>

                                    <div className="source-secondary">
                                      PO:{" "}
                                      {row.batch.purchase_order_id.slice(
                                        0,
                                        8,
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="source-primary">
                                      Direct
                                      Receipt
                                    </div>

                                    <div className="source-secondary">
                                      No PO linked
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>

                            <td>
                              <div className="qty-cell">
                                <div className="qty-primary">
                                  {formatNumber(
                                    Number(
                                      row
                                        .batch
                                        .quantity_received ??
                                        0,
                                    ),
                                  )}
                                </div>

                                <div className="qty-secondary">
                                  Received
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="qty-cell">
                                <div className="qty-primary">
                                  {formatNumber(
                                    row.quantityRemaining,
                                  )}
                                </div>

                                {row.reservedQuantity >
                                  0 && (
                                  <div className="qty-secondary">
                                    {formatNumber(
                                      row.reservedQuantity,
                                    )}{" "}
                                    reserved
                                  </div>
                                )}
                              </div>
                            </td>

                            <td>
                              {locationRows.length >
                              0 ? (
                                <div className="warehouse-list">
                                  {locationRows.map(
                                    (
                                      stock,
                                    ) => {
                                      const warehouse =
                                        warehouseMap.get(
                                          stock.warehouse_id,
                                        );

                                      const location =
                                        locationMap.get(
                                          stock.location_id,
                                        );

                                      return (
                                        <div
                                          key={
                                            stock.id
                                          }
                                        >
                                          <div className="warehouse-row">
                                            <div className="warehouse-name">
                                              {warehouse?.name ||
                                                "Unknown Warehouse"}
                                            </div>

                                            <div className="warehouse-qty">
                                              {formatNumber(
                                                Number(
                                                  stock.quantity ??
                                                    0,
                                                ),
                                              )}
                                            </div>
                                          </div>

                                          <div className="warehouse-location">
                                            {location?.name ||
                                              "Unknown Location"}
                                          </div>
                                        </div>
                                      );
                                    },
                                  )}

                                  {row.stockRows
                                    .length >
                                    2 && (
                                    <div className="warehouse-location">
                                      +
                                      {row
                                        .stockRows
                                        .length -
                                        2}{" "}
                                      more locations
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="warehouse-location">
                                  No current
                                  stock location
                                </div>
                              )}
                            </td>

                            <td>
                              <div className="cost-primary">
                                {formatCurrency(
                                  row.unitCost,
                                )}
                              </div>

                              <div className="cost-secondary">
                                Per unit
                              </div>
                            </td>

                            <td>
                              <div className="cost-primary">
                                {formatCurrency(
                                  row.totalCost,
                                )}
                              </div>

                              <div className="cost-secondary">
                                {Number(
                                  row.batch
                                    .landed_cost_total ??
                                    0,
                                ) > 0
                                  ? `Landed: ${formatCurrency(
                                      Number(
                                        row
                                          .batch
                                          .landed_cost_total,
                                      ),
                                    )}`
                                  : Number(
                                        row
                                          .batch
                                          .refurbishment_cost_total ??
                                          0,
                                      ) > 0
                                    ? `Refurb: ${formatCurrency(
                                        Number(
                                          row
                                            .batch
                                            .refurbishment_cost_total,
                                        ),
                                      )}`
                                    : "Total acquisition cost"}
                              </div>
                            </td>

                            <td>
                              <span
                                className={getStatusClass(
                                  row.batch
                                    .status,
                                )}
                              >
                                {row.batch
                                  .status ||
                                  "Unknown"}
                              </span>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Showing{" "}
                  {filteredBatches.length ===
                  0
                    ? 0
                    : (page - 1) *
                        pageSize +
                      1}{" "}
                  –{" "}
                  {Math.min(
                    page * pageSize,
                    filteredBatches.length,
                  )}{" "}
                  of{" "}
                  {formatNumber(
                    filteredBatches.length,
                  )}
                </div>

                <div className="pagination-actions">
                  <button
                    type="button"
                    className="pagination-button"
                    disabled={
                      page <= 1
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1,
                          ),
                      )
                    }
                  >
                    ←
                  </button>

                  <button
                    type="button"
                    className="pagination-button"
                    disabled={
                      page >=
                      totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            totalPages,
                            current + 1,
                          ),
                      )
                    }
                  >
                    →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}