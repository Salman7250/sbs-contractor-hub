"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
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
  selling_price: number | null;
};

type Batch = {
  id: string;
  product_id: string;
  variant_id: string | null;
  lot_number: string;
  supplier_id: string | null;
  purchase_order_id: string | null;
  purchase_order_item_id: string | null;
  stock_receipt_id: string | null;
  stock_receipt_item_id: string | null;
  received_at: string | null;
  quantity_received: number;
  unit_cost: number | null;
  landed_cost_total: number | null;
  refurbishment_cost_total: number | null;
  other_cost_total: number | null;
  total_cost: number | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  created_at: string | null;
  updated_at: string | null;
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

type SerializedUnit = {
  id: string;
  serial_number: string;
  barcode: string | null;
  product_id: string;
  variant_id: string | null;
  batch_id: string | null;
  status: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  cost_price: number | null;
  warranty_start: string | null;
  warranty_end: string | null;
  received_at: string | null;
  sold_at: string | null;
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function getSerialStatusClass(status: string | null) {
  switch ((status ?? "").toLowerCase()) {
    case "available":
      return "status status-active";

    case "reserved":
      return "status status-reserved";

    case "sold":
      return "status status-sold";

    case "returned":
      return "status status-returned";

    case "repair":
      return "status status-repair";

    case "rma":
      return "status status-rma";

    case "damaged":
      return "status status-damaged";

    case "lost":
      return "status status-lost";

    case "disposed":
      return "status status-disposed";

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

export default function BatchDetailPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();

  const batchId = Array.isArray(params?.batchId)
    ? params.batchId[0]
    : params?.batchId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [batch, setBatch] = useState<Batch | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [stockRows, setStockRows] = useState<BatchStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [serialUnits, setSerialUnits] = useState<SerializedUnit[]>([]);

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (!batchId) {
        setErrorMessage("Batch ID is missing.");
        setLoading(false);
        return;
      }

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
          throw new Error(
            "Unable to identify the current user.",
          );
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

        const { data: batchData, error: batchError } =
          await supabase
            .from("inventory_batches")
            .select(
              "id,product_id,variant_id,lot_number,supplier_id,purchase_order_id,purchase_order_item_id,stock_receipt_id,stock_receipt_item_id,received_at,quantity_received,unit_cost,landed_cost_total,refurbishment_cost_total,other_cost_total,total_cost,notes,status,created_at,updated_at",
            )
            .eq("company_id", companyId)
            .eq("id", batchId)
            .maybeSingle();

        if (batchError) {
          throw batchError;
        }

        if (!batchData) {
          throw new Error("Batch could not be found.");
        }

        setBatch(batchData);

        const [
          productResult,
          variantResult,
          stockResult,
          warehousesResult,
          locationsResult,
          serialResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id,name,brand,category,tracking_mode",
            )
            .eq("company_id", companyId)
            .eq("id", batchData.product_id)
            .maybeSingle(),

          batchData.variant_id
            ? supabase
                .from("product_variants")
                .select(
                  "id,product_id,name,sku,cost_price,selling_price",
                )
                .eq("company_id", companyId)
                .eq("id", batchData.variant_id)
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          supabase
            .from("inventory_batch_stock")
            .select(
              "id,batch_id,product_id,variant_id,warehouse_id,location_id,quantity,reserved_quantity,created_at,updated_at",
            )
            .eq("company_id", companyId)
            .eq("batch_id", batchId),

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

          supabase
            .from("serialized_units")
            .select(
              "id,serial_number,barcode,product_id,variant_id,batch_id,status,warehouse_id,location_id,cost_price,warranty_start,warranty_end,received_at,sold_at",
            )
            .eq("company_id", companyId)
            .eq("batch_id", batchId)
            .order("serial_number"),
        ]);

        if (productResult.error) {
          throw productResult.error;
        }

        if (variantResult.error) {
          throw variantResult.error;
        }

        if (stockResult.error) {
          throw stockResult.error;
        }

        if (warehousesResult.error) {
          throw warehousesResult.error;
        }

        if (locationsResult.error) {
          throw locationsResult.error;
        }

        if (serialResult.error) {
          throw serialResult.error;
        }

        setProduct(productResult.data ?? null);
        setVariant(variantResult.data ?? null);
        setStockRows(stockResult.data ?? []);
        setWarehouses(warehousesResult.data ?? []);
        setLocations(locationsResult.data ?? []);
        setSerialUnits(serialResult.data ?? []);
      } catch (error) {
        console.error(
          "Unable to load batch detail:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load batch detail.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase, batchId],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const stockSummary = useMemo(() => {
    const quantity = stockRows.reduce(
      (sum, row) =>
        sum + Number(row.quantity ?? 0),
      0,
    );

    const reserved = stockRows.reduce(
      (sum, row) =>
        sum +
        Number(
          row.reserved_quantity ?? 0,
        ),
      0,
    );

    const available = Math.max(
      quantity - reserved,
      0,
    );

    return {
      quantity,
      reserved,
      available,
    };
  }, [stockRows]);

  const consumedQuantity = useMemo(() => {
    if (!batch) return 0;

    return Math.max(
      Number(batch.quantity_received ?? 0) -
        stockSummary.quantity,
      0,
    );
  }, [batch, stockSummary.quantity]);

  const unitCost = useMemo(() => {
    if (!batch) return 0;

    if (batch.unit_cost !== null) {
      return Number(batch.unit_cost);
    }

    return Number(
      variant?.cost_price ?? 0,
    );
  }, [batch, variant]);

  const baseCost = useMemo(() => {
    if (!batch) return 0;

    return (
      Number(
        batch.quantity_received ?? 0,
      ) * unitCost
    );
  }, [batch, unitCost]);

  const landedCost = Number(
    batch?.landed_cost_total ?? 0,
  );

  const refurbishmentCost = Number(
    batch?.refurbishment_cost_total ?? 0,
  );

  const otherCost = Number(
    batch?.other_cost_total ?? 0,
  );

  const calculatedTotalCost = useMemo(() => {
    if (!batch) return 0;

    if (batch.total_cost !== null) {
      return Number(batch.total_cost);
    }

    return (
      baseCost +
      landedCost +
      refurbishmentCost +
      otherCost
    );
  }, [
    batch,
    baseCost,
    landedCost,
    refurbishmentCost,
    otherCost,
  ]);

  const serializedStats = useMemo(() => {
    const total = serialUnits.length;

    const available = serialUnits.filter(
      (unit) =>
        unit.status === "available",
    ).length;

    const sold = serialUnits.filter(
      (unit) => unit.status === "sold",
    ).length;

    const repair = serialUnits.filter(
      (unit) =>
        unit.status === "repair" ||
        unit.status === "rma",
    ).length;

    const problem = serialUnits.filter(
      (unit) =>
        unit.status === "damaged" ||
        unit.status === "lost" ||
        unit.status === "disposed",
    ).length;

    return {
      total,
      available,
      sold,
      repair,
      problem,
    };
  }, [serialUnits]);

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <style jsx>{`
            .loading-page {
              min-height: 500px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #64748b;
              font-size: 13px;
            }
          `}</style>

          <div className="loading-page">
            Loading batch details...
          </div>
        </div>
      </AppShell>
    );
  }

  if (errorMessage || !batch) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <style jsx>{`
            .error-page {
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              padding: 45px 25px;
              text-align: center;
            }

            .error-title {
              margin: 0;
              color: #0f172a;
              font-size: 18px;
              font-weight: 750;
            }

            .error-description {
              margin: 8px auto 20px;
              max-width: 500px;
              color: #64748b;
              font-size: 13px;
              line-height: 1.6;
            }

            .button {
              border: 1px solid #d1d5db;
              border-radius: 9px;
              background: #ffffff;
              color: #334155;
              min-height: 40px;
              padding: 0 15px;
              font-size: 13px;
              font-weight: 650;
              cursor: pointer;
            }

            .button-primary {
              background: #166534;
              border-color: #166534;
              color: #ffffff;
            }
          `}</style>

          <div className="error-page">
            <h1 className="error-title">
              Batch not available
            </h1>

            <p className="error-description">
              {errorMessage ||
                "The requested batch could not be found."}
            </p>

            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                router.push(
                  "/inventory/batches",
                )
              }
            >
              Back to Batches
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
            padding-bottom: 40px;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 22px;
          }

          .breadcrumb {
            display: flex;
            align-items: center;
            gap: 7px;
            margin-bottom: 10px;
            color: #64748b;
            font-size: 12px;
          }

          .breadcrumb-button {
            border: 0;
            background: transparent;
            color: #166534;
            padding: 0;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }

          .breadcrumb-separator {
            color: #cbd5e1;
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
          }

          .header-actions {
            display: flex;
            gap: 9px;
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
              border-color 0.15s ease;
          }

          .button:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
          }

          .button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
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

          .error-box {
            background: #fff7f7;
            border: 1px solid #fecaca;
            color: #b91c1c;
            border-radius: 12px;
            padding: 13px 15px;
            margin-bottom: 18px;
            font-size: 13px;
          }

          .hero-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 18px;
            margin-bottom: 18px;
            box-shadow:
              0 1px 2px
                rgba(15, 23, 42, 0.03);
          }

          .hero-grid {
            display: grid;
            grid-template-columns:
              minmax(260px, 1.6fr)
              repeat(4, minmax(130px, 1fr));
            gap: 18px;
            align-items: center;
          }

          .product-label {
            color: #94a3b8;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .product-name {
            margin-top: 5px;
            color: #0f172a;
            font-size: 18px;
            font-weight: 750;
          }

          .product-variant {
            margin-top: 4px;
            color: #64748b;
            font-size: 12px;
          }

          .product-sku {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 11px;
            font-family:
              ui-monospace,
              SFMono-Regular,
              Menlo,
              Monaco,
              Consolas,
              "Liberation Mono",
              "Courier New",
              monospace;
          }

          .hero-stat {
            border-left: 1px solid #eef2f7;
            padding-left: 18px;
          }

          .hero-stat-label {
            color: #64748b;
            font-size: 11px;
            font-weight: 650;
          }

          .hero-stat-value {
            margin-top: 5px;
            color: #0f172a;
            font-size: 18px;
            font-weight: 750;
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

          .status-reserved {
            background: #eff6ff;
            color: #1d4ed8;
          }

          .status-sold {
            background: #f1f5f9;
            color: #475569;
          }

          .status-returned {
            background: #fff7ed;
            color: #c2410c;
          }

          .status-repair,
          .status-rma {
            background: #fefce8;
            color: #a16207;
          }

          .status-damaged,
          .status-lost,
          .status-disposed {
            background: #fef2f2;
            color: #b91c1c;
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
          }

          .stat-label {
            color: #64748b;
            font-size: 11px;
            font-weight: 650;
          }

          .stat-value {
            margin-top: 6px;
            color: #0f172a;
            font-size: 21px;
            font-weight: 750;
            white-space: nowrap;
          }

          .stat-helper {
            margin-top: 4px;
            color: #94a3b8;
            font-size: 10px;
          }

          .two-column {
            display: grid;
            grid-template-columns:
              minmax(0, 1.35fr)
              minmax(340px, 0.85fr);
            gap: 18px;
            margin-bottom: 18px;
          }

          .card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            overflow: hidden;
            box-shadow:
              0 1px 2px
                rgba(15, 23, 42, 0.03);
          }

          .card-header {
            padding: 14px 17px;
            border-bottom: 1px solid #e5e7eb;
          }

          .card-title {
            margin: 0;
            color: #0f172a;
            font-size: 14px;
            font-weight: 750;
          }

          .card-description {
            margin: 4px 0 0;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.5;
          }

          .details-grid {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .detail-item {
            padding: 13px 17px;
            border-bottom: 1px solid #eef2f7;
          }

          .detail-item:nth-child(odd) {
            border-right: 1px solid #eef2f7;
          }

          .detail-label {
            color: #94a3b8;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .detail-value {
            margin-top: 4px;
            color: #334155;
            font-size: 13px;
            font-weight: 650;
          }

          .cost-list {
            padding: 4px 17px;
          }

          .cost-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
            padding: 11px 0;
            border-bottom: 1px solid #eef2f7;
          }

          .cost-row:last-child {
            border-bottom: 0;
          }

          .cost-label {
            color: #64748b;
            font-size: 12px;
          }

          .cost-value {
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
          }

          .cost-total {
            margin: 0 -17px;
            padding: 14px 17px;
            border-top: 1px solid #e5e7eb;
            background: #f8fafc;
            display: flex;
            justify-content: space-between;
            gap: 15px;
          }

          .cost-total .cost-label {
            color: #334155;
            font-weight: 750;
          }

          .cost-total .cost-value {
            color: #166534;
            font-size: 14px;
            font-weight: 800;
          }

          .stock-table-wrap {
            overflow-x: auto;
          }

          .stock-table {
            width: 100%;
            min-width: 650px;
            border-collapse: collapse;
          }

          .stock-table th {
            background: #f8fafc;
            color: #64748b;
            border-bottom: 1px solid #e5e7eb;
            padding: 9px 14px;
            text-align: left;
            font-size: 10px;
            font-weight: 750;
            letter-spacing: 0.035em;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .stock-table td {
            color: #334155;
            border-bottom: 1px solid #eef2f7;
            padding: 10px 14px;
            font-size: 12px;
            white-space: nowrap;
          }

          .stock-table tr:last-child td {
            border-bottom: 0;
          }

          .warehouse-name {
            color: #0f172a;
            font-weight: 700;
          }

          .location-name {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
          }

          .number-strong {
            color: #0f172a;
            font-weight: 750;
          }

          .serial-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
          }

          .serial-summary {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }

          .serial-summary-item {
            color: #64748b;
            font-size: 11px;
          }

          .serial-summary-item strong {
            color: #0f172a;
          }

          .serial-table-wrap {
            overflow-x: auto;
          }

          .serial-table {
            width: 100%;
            min-width: 950px;
            border-collapse: collapse;
          }

          .serial-table th {
            background: #f8fafc;
            color: #64748b;
            border-bottom: 1px solid #e5e7eb;
            padding: 9px 14px;
            text-align: left;
            font-size: 10px;
            font-weight: 750;
            letter-spacing: 0.035em;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .serial-table td {
            color: #334155;
            border-bottom: 1px solid #eef2f7;
            padding: 10px 14px;
            font-size: 12px;
            vertical-align: middle;
            white-space: nowrap;
          }

          .serial-table tr:last-child td {
            border-bottom: 0;
          }

          .serial-number {
            color: #166534;
            font-weight: 750;
            cursor: pointer;
          }

          .serial-number:hover {
            text-decoration: underline;
          }

          .serial-barcode {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
          }

          .serial-location {
            color: #334155;
            font-weight: 650;
          }

          .serial-subtext {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
          }

          .notes-box {
            padding: 15px 17px;
            color: #475569;
            font-size: 12px;
            line-height: 1.65;
            white-space: pre-wrap;
          }

          .empty {
            padding: 35px 20px;
            text-align: center;
            color: #94a3b8;
            font-size: 12px;
          }

          .footer-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 14px 17px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
            color: #94a3b8;
            font-size: 10px;
          }

          @media (max-width: 1400px) {
            .hero-grid {
              grid-template-columns:
                minmax(240px, 1.5fr)
                repeat(4, minmax(110px, 1fr));
            }

            .stats-grid {
              grid-template-columns: repeat(
                3,
                minmax(0, 1fr)
              );
            }
          }

          @media (max-width: 1050px) {
            .page-header {
              flex-direction: column;
            }

            .hero-grid {
              grid-template-columns:
                repeat(3, minmax(0, 1fr));
            }

            .hero-product {
              grid-column: span 3;
            }

            .hero-stat {
              border-left: 0;
              padding-left: 0;
            }

            .two-column {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 700px) {
            .hero-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .hero-product {
              grid-column: span 2;
            }

            .stats-grid {
              grid-template-columns: repeat(
                2,
                minmax(0, 1fr)
              );
            }

            .details-grid {
              grid-template-columns: 1fr;
            }

            .detail-item:nth-child(odd) {
              border-right: 0;
            }

            .serial-header {
              align-items: flex-start;
              flex-direction: column;
            }
          }

          @media (max-width: 500px) {
            .stats-grid {
              grid-template-columns: 1fr;
            }

            .hero-grid {
              grid-template-columns: 1fr;
            }

            .hero-product {
              grid-column: auto;
            }

            .header-actions {
              width: 100%;
            }

            .header-actions .button {
              flex: 1;
            }

            .footer-card {
              align-items: flex-start;
              flex-direction: column;
            }
          }
        `}</style>

        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <button
                type="button"
                className="breadcrumb-button"
                onClick={() =>
                  router.push(
                    "/inventory/batches",
                  )
                }
              >
                Batches & Lots
              </button>

              <span className="breadcrumb-separator">
                /
              </span>

              <span>
                {batch.lot_number}
              </span>
            </div>

            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Batch Detail
            </div>

            <h1 className="page-title">
              {batch.lot_number}
            </h1>

            <p className="page-subtitle">
              Complete provenance, costing, stock,
              and serialized asset information for
              this inventory batch.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="button"
              onClick={() =>
                router.push(
                  "/inventory/batches",
                )
              }
            >
              Back to Batches
            </button>

            <button
              type="button"
              className="button"
              onClick={() =>
                loadData(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="error-box">
            {errorMessage}
          </div>
        )}

        <div className="hero-card">
          <div className="hero-grid">
            <div className="hero-product">
              <div className="product-label">
                Product
              </div>

              <div className="product-name">
                {product?.name ||
                  "Unknown Product"}
              </div>

              {variant?.name && (
                <div className="product-variant">
                  {variant.name}
                </div>
              )}

              {variant?.sku && (
                <div className="product-sku">
                  SKU: {variant.sku}
                </div>
              )}
            </div>

            <div className="hero-stat">
              <div className="hero-stat-label">
                Tracking
              </div>

              <div className="hero-stat-value">
                {getTrackingLabel(
                  product?.tracking_mode ??
                    null,
                )}
              </div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-label">
                Received
              </div>

              <div className="hero-stat-value">
                {formatDate(
                  batch.received_at,
                )}
              </div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-label">
                Unit Cost
              </div>

              <div className="hero-stat-value">
                {formatCurrency(
                  unitCost,
                )}
              </div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-label">
                Status
              </div>

              <div
                style={{
                  marginTop: 7,
                }}
              >
                <span
                  className={getStatusClass(
                    batch.status,
                  )}
                >
                  {batch.status ||
                    "Unknown"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Original Quantity
            </div>

            <div className="stat-value">
              {formatNumber(
                Number(
                  batch.quantity_received ??
                    0,
                ),
              )}
            </div>

            <div className="stat-helper">
              Units received
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Current Stock
            </div>

            <div className="stat-value">
              {formatNumber(
                stockSummary.quantity,
              )}
            </div>

            <div className="stat-helper">
              Across all locations
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Available
            </div>

            <div className="stat-value">
              {formatNumber(
                stockSummary.available,
              )}
            </div>

            <div className="stat-helper">
              After reservations
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Reserved
            </div>

            <div className="stat-value">
              {formatNumber(
                stockSummary.reserved,
              )}
            </div>

            <div className="stat-helper">
              Currently allocated
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Consumed
            </div>

            <div className="stat-value">
              {formatNumber(
                consumedQuantity,
              )}
            </div>

            <div className="stat-helper">
              From original batch
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Batch Cost
            </div>

            <div className="stat-value">
              {formatCurrency(
                calculatedTotalCost,
              )}
            </div>

            <div className="stat-helper">
              Total acquisition cost
            </div>
          </div>
        </div>

        <div className="two-column">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                Batch Information
              </h2>

              <p className="card-description">
                Provenance and receiving references
                associated with this batch.
              </p>
            </div>

            <div className="details-grid">
              <div className="detail-item">
                <div className="detail-label">
                  Lot Number
                </div>

                <div className="detail-value">
                  {batch.lot_number}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Tracking Mode
                </div>

                <div className="detail-value">
                  {getTrackingLabel(
                    product?.tracking_mode ??
                      null,
                  )}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Purchase Order
                </div>

                <div className="detail-value">
                  {batch.purchase_order_id
                    ? batch.purchase_order_id
                    : "Not linked"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  PO Item
                </div>

                <div className="detail-value">
                  {batch.purchase_order_item_id
                    ? batch.purchase_order_item_id
                    : "Not linked"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Stock Receipt
                </div>

                <div className="detail-value">
                  {batch.stock_receipt_id
                    ? batch.stock_receipt_id
                    : "Not linked"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Receipt Item
                </div>

                <div className="detail-value">
                  {batch.stock_receipt_item_id
                    ? batch.stock_receipt_item_id
                    : "Not linked"}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Received At
                </div>

                <div className="detail-value">
                  {formatDateTime(
                    batch.received_at,
                  )}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">
                  Batch Status
                </div>

                <div className="detail-value">
                  <span
                    className={getStatusClass(
                      batch.status,
                    )}
                  >
                    {batch.status ||
                      "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                Cost Breakdown
              </h2>

              <p className="card-description">
                Full acquisition cost composition
                for this batch.
              </p>
            </div>

            <div className="cost-list">
              <div className="cost-row">
                <div className="cost-label">
                  Base inventory cost
                </div>

                <div className="cost-value">
                  {formatCurrency(
                    baseCost,
                  )}
                </div>
              </div>

              <div className="cost-row">
                <div className="cost-label">
                  Landed cost
                </div>

                <div className="cost-value">
                  {formatCurrency(
                    landedCost,
                  )}
                </div>
              </div>

              <div className="cost-row">
                <div className="cost-label">
                  Refurbishment cost
                </div>

                <div className="cost-value">
                  {formatCurrency(
                    refurbishmentCost,
                  )}
                </div>
              </div>

              <div className="cost-row">
                <div className="cost-label">
                  Other cost
                </div>

                <div className="cost-value">
                  {formatCurrency(
                    otherCost,
                  )}
                </div>
              </div>

              <div className="cost-total">
                <div className="cost-label">
                  Total Batch Cost
                </div>

                <div className="cost-value">
                  {formatCurrency(
                    calculatedTotalCost,
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <h2 className="card-title">
              Current Stock by Location
            </h2>

            <p className="card-description">
              Physical quantity belonging specifically
              to this batch.
            </p>
          </div>

          {stockRows.length === 0 ? (
            <div className="empty">
              This batch currently has no physical
              stock records.
            </div>
          ) : (
            <div className="stock-table-wrap">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>
                      Warehouse
                    </th>

                    <th>
                      Location
                    </th>

                    <th>
                      Quantity
                    </th>

                    <th>
                      Reserved
                    </th>

                    <th>
                      Available
                    </th>

                    <th>
                      Last Updated
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {stockRows.map(
                    (stock) => {
                      const warehouse =
                        warehouseMap.get(
                          stock.warehouse_id,
                        );

                      const location =
                        locationMap.get(
                          stock.location_id,
                        );

                      const quantity =
                        Number(
                          stock.quantity ??
                            0,
                        );

                      const reserved =
                        Number(
                          stock.reserved_quantity ??
                            0,
                        );

                      return (
                        <tr
                          key={
                            stock.id
                          }
                        >
                          <td>
                            <div className="warehouse-name">
                              {warehouse
                                ?.name ||
                                "Unknown Warehouse"}
                            </div>

                            {warehouse
                              ?.code && (
                              <div className="location-name">
                                {
                                  warehouse.code
                                }
                              </div>
                            )}
                          </td>

                          <td>
                            <div className="warehouse-name">
                              {location
                                ?.name ||
                                "Unknown Location"}
                            </div>

                            {location
                              ?.code && (
                              <div className="location-name">
                                {
                                  location.code
                                }
                              </div>
                            )}
                          </td>

                          <td>
                            <span className="number-strong">
                              {formatNumber(
                                quantity,
                              )}
                            </span>
                          </td>

                          <td>
                            {formatNumber(
                              reserved,
                            )}
                          </td>

                          <td>
                            <span className="number-strong">
                              {formatNumber(
                                Math.max(
                                  quantity -
                                    reserved,
                                  0,
                                ),
                              )}
                            </span>
                          </td>

                          <td>
                            {formatDateTime(
                              stock.updated_at,
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {product?.tracking_mode ===
          "serial" && (
          <div
            className="card"
            style={{
              marginBottom: 18,
            }}
          >
            <div className="card-header">
              <div className="serial-header">
                <div>
                  <h2 className="card-title">
                    Serial Assets in This Batch
                  </h2>

                  <p className="card-description">
                    Individual serialized units that
                    belong to this batch.
                  </p>
                </div>

                <div className="serial-summary">
                  <span className="serial-summary-item">
                    Total:{" "}
                    <strong>
                      {serializedStats.total}
                    </strong>
                  </span>

                  <span className="serial-summary-item">
                    Available:{" "}
                    <strong>
                      {
                        serializedStats.available
                      }
                    </strong>
                  </span>

                  <span className="serial-summary-item">
                    Sold:{" "}
                    <strong>
                      {serializedStats.sold}
                    </strong>
                  </span>

                  <span className="serial-summary-item">
                    Repair:{" "}
                    <strong>
                      {serializedStats.repair}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {serialUnits.length === 0 ? (
              <div className="empty">
                No serialized assets are currently
                linked to this batch.
              </div>
            ) : (
              <div className="serial-table-wrap">
                <table className="serial-table">
                  <thead>
                    <tr>
                      <th>
                        Serial Number
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Warehouse
                      </th>

                      <th>
                        Location
                      </th>

                      <th>
                        Cost
                      </th>

                      <th>
                        Warranty
                      </th>

                      <th>
                        Received
                      </th>

                      <th>
                        Sold
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {serialUnits.map(
                      (unit) => {
                        const warehouse =
                          unit.warehouse_id
                            ? warehouseMap.get(
                                unit.warehouse_id,
                              )
                            : null;

                        const location =
                          unit.location_id
                            ? locationMap.get(
                                unit.location_id,
                              )
                            : null;

                        const warrantyText =
                          unit.warranty_end
                            ? formatDate(
                                unit.warranty_end,
                              )
                            : "No warranty";

                        return (
                          <tr
                            key={
                              unit.id
                            }
                          >
                            <td>
                              <div
                                className="serial-number"
                                onClick={() =>
                                  router.push(
                                    `/inventory/serial-numbers/${unit.id}`,
                                  )
                                }
                              >
                                {
                                  unit.serial_number
                                }
                              </div>

                              {unit.barcode && (
                                <div className="serial-barcode">
                                  Barcode:{" "}
                                  {
                                    unit.barcode
                                  }
                                </div>
                              )}
                            </td>

                            <td>
                              <span
                                className={getSerialStatusClass(
                                  unit.status,
                                )}
                              >
                                {unit.status ||
                                  "Unknown"}
                              </span>
                            </td>

                            <td>
                              <div className="serial-location">
                                {warehouse
                                  ?.name ||
                                  "—"}
                              </div>

                              {warehouse
                                ?.code && (
                                <div className="serial-subtext">
                                  {
                                    warehouse.code
                                  }
                                </div>
                              )}
                            </td>

                            <td>
                              <div className="serial-location">
                                {location
                                  ?.name ||
                                  "—"}
                              </div>

                              {location
                                ?.code && (
                                <div className="serial-subtext">
                                  {
                                    location.code
                                  }
                                </div>
                              )}
                            </td>

                            <td>
                              {formatCurrency(
                                Number(
                                  unit.cost_price ??
                                    unitCost,
                                ),
                              )}
                            </td>

                            <td>
                              {warrantyText}
                            </td>

                            <td>
                              {formatDate(
                                unit.received_at,
                              )}
                            </td>

                            <td>
                              {formatDate(
                                unit.sold_at,
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <h2 className="card-title">
              Notes
            </h2>

            <p className="card-description">
              Internal notes recorded against this
              batch.
            </p>
          </div>

          <div className="notes-box">
            {batch.notes?.trim()
              ? batch.notes
              : "No notes have been recorded for this batch."}
          </div>
        </div>

        <div className="footer-card">
          <span>
            Batch created:{" "}
            {formatDateTime(
              batch.created_at,
            )}
          </span>

          <span>
            Last updated:{" "}
            {formatDateTime(
              batch.updated_at,
            )}
          </span>

          <span>
            Batch ID: {batch.id}
          </span>
        </div>
      </div>
    </AppShell>
  );
}