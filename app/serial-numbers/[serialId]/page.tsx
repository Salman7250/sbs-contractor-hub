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
  status: string | null;
  notes: string | null;
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
  company_id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
  barcode: string | null;
  status: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  order_item_id: string | null;
  invoice_id: string | null;
  purchase_order_id: string | null;
  purchase_order_item_id: string | null;
  cost_price: number | null;
  warranty_start: string | null;
  warranty_end: string | null;
  received_at: string | null;
  sold_at: string | null;
  batch_id: string | null;
  allocated_at: string | null;
  returned_at: string | null;
  disposed_at: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SerialHistory = {
  id: string;
  company_id: string;
  serialized_unit_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  from_warehouse_id: string | null;
  to_warehouse_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "—";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  }).format(value);
}

function titleCase(value: string | null) {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function statusClass(status: string | null) {
  switch (normalize(status)) {
    case "available":
      return "status status-available";

    case "reserved":
      return "status status-reserved";

    case "sold":
      return "status status-sold";

    case "returned":
      return "status status-returned";

    case "repair":
    case "rma":
      return "status status-warning";

    case "damaged":
    case "lost":
    case "disposed":
      return "status status-danger";

    default:
      return "status status-neutral";
  }
}

function getWarrantyState(
  start: string | null,
  end: string | null,
) {
  if (!start && !end) return "none";

  const now = new Date();

  if (end) {
    const warrantyEnd = new Date(end);

    if (!Number.isNaN(warrantyEnd.getTime())) {
      return warrantyEnd >= now
        ? "active"
        : "expired";
    }
  }

  return "none";
}

export default function SerialDetailPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();

  const serialIdParam = params?.serialId;

  const serialId = Array.isArray(serialIdParam)
    ? serialIdParam[0]
    : serialIdParam;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [unit, setUnit] =
    useState<SerializedUnit | null>(null);

  const [product, setProduct] =
    useState<Product | null>(null);

  const [variant, setVariant] =
    useState<Variant | null>(null);

  const [batch, setBatch] =
    useState<Batch | null>(null);

  const [warehouse, setWarehouse] =
    useState<Warehouse | null>(null);

  const [location, setLocation] =
    useState<Location | null>(null);

  const [history, setHistory] =
    useState<SerialHistory[]>([]);

  const [historyWarehouses, setHistoryWarehouses] =
    useState<Warehouse[]>([]);

  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        if (!serialId) {
          throw new Error(
            "Serial asset ID is missing.",
          );
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          throw new Error("You must be signed in.");
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (membershipError) {
          throw new Error(
            membershipError.message,
          );
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership found.",
          );
        }

        const companyId = membership.company_id;

        const { data: serializedData, error: serializedError } =
          await supabase
            .from("serialized_units")
            .select(
              [
                "id",
                "company_id",
                "product_id",
                "variant_id",
                "serial_number",
                "barcode",
                "status",
                "warehouse_id",
                "location_id",
                "customer_id",
                "order_id",
                "order_item_id",
                "invoice_id",
                "purchase_order_id",
                "purchase_order_item_id",
                "cost_price",
                "warranty_start",
                "warranty_end",
                "received_at",
                "sold_at",
                "batch_id",
                "allocated_at",
                "returned_at",
                "disposed_at",
                "notes",
                "created_at",
                "updated_at",
              ].join(","),
            )
            .eq("company_id", companyId)
            .eq("id", serialId)
            .maybeSingle();

        if (serializedError) {
          throw new Error(
            serializedError.message,
          );
        }

        if (!serializedData) {
          throw new Error(
            "Serial asset not found.",
          );
        }

        const serializedUnit =
          serializedData as unknown as SerializedUnit;

        setUnit(serializedUnit);

        const [
          productResult,
          variantResult,
          batchResult,
          warehouseResult,
          locationResult,
          historyResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id,name,brand,category,tracking_mode",
            )
            .eq("company_id", companyId)
            .eq("id", serializedUnit.product_id)
            .maybeSingle(),

          serializedUnit.variant_id
            ? supabase
                .from("product_variants")
                .select(
                  "id,product_id,name,sku,cost_price,selling_price",
                )
                .eq("company_id", companyId)
                .eq(
                  "id",
                  serializedUnit.variant_id,
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          serializedUnit.batch_id
            ? supabase
                .from("inventory_batches")
                .select(
                  [
                    "id",
                    "product_id",
                    "variant_id",
                    "lot_number",
                    "supplier_id",
                    "purchase_order_id",
                    "purchase_order_item_id",
                    "stock_receipt_id",
                    "stock_receipt_item_id",
                    "received_at",
                    "quantity_received",
                    "unit_cost",
                    "landed_cost_total",
                    "refurbishment_cost_total",
                    "other_cost_total",
                    "total_cost",
                    "status",
                    "notes",
                  ].join(","),
                )
                .eq("company_id", companyId)
                .eq(
                  "id",
                  serializedUnit.batch_id,
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          serializedUnit.warehouse_id
            ? supabase
                .from("warehouses")
                .select("id,name,code")
                .eq("company_id", companyId)
                .eq(
                  "id",
                  serializedUnit.warehouse_id,
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          serializedUnit.location_id
            ? supabase
                .from("warehouse_locations")
                .select(
                  "id,warehouse_id,name,code",
                )
                .eq("company_id", companyId)
                .eq(
                  "id",
                  serializedUnit.location_id,
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          supabase
            .from("serial_number_history")
            .select(
              [
                "id",
                "company_id",
                "serialized_unit_id",
                "event_type",
                "from_status",
                "to_status",
                "from_warehouse_id",
                "to_warehouse_id",
                "reference_type",
                "reference_id",
                "notes",
                "created_by",
                "created_at",
              ].join(","),
            )
            .eq("company_id", companyId)
            .eq(
              "serialized_unit_id",
              serialId,
            )
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (productResult.error) {
          throw new Error(
            productResult.error.message,
          );
        }

        if (variantResult.error) {
          throw new Error(
            variantResult.error.message,
          );
        }

        if (batchResult.error) {
          throw new Error(
            batchResult.error.message,
          );
        }

        if (warehouseResult.error) {
          throw new Error(
            warehouseResult.error.message,
          );
        }

        if (locationResult.error) {
          throw new Error(
            locationResult.error.message,
          );
        }

        if (historyResult.error) {
          throw new Error(
            historyResult.error.message,
          );
        }

        setProduct(
          productResult.data as Product | null,
        );

        setVariant(
          variantResult.data as Variant | null,
        );

        setBatch(
          batchResult.data as Batch | null,
        );

        setWarehouse(
          warehouseResult.data as Warehouse | null,
        );

        setLocation(
          locationResult.data as Location | null,
        );

        const historyRows =
          (historyResult.data ??
            []) as unknown as SerialHistory[];

        setHistory(historyRows);

        const historyWarehouseIds = Array.from(
          new Set(
            historyRows.flatMap((row) =>
              [
                row.from_warehouse_id,
                row.to_warehouse_id,
              ].filter(Boolean),
            ),
          ),
        );

        if (historyWarehouseIds.length > 0) {
          const {
            data: historicalWarehouses,
            error: historicalWarehouseError,
          } = await supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", companyId)
            .in(
              "id",
              historyWarehouseIds,
            );

          if (historicalWarehouseError) {
            throw new Error(
              historicalWarehouseError.message,
            );
          }

          setHistoryWarehouses(
            (historicalWarehouses ??
              []) as Warehouse[],
          );
        } else {
          setHistoryWarehouses([]);
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load serial asset.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [serialId, supabase],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const historyWarehouseMap = useMemo(
    () =>
      new Map(
        historyWarehouses.map(
          (item) => [item.id, item],
        ),
      ),
    [historyWarehouses],
  );

  const warrantyState = unit
    ? getWarrantyState(
        unit.warranty_start,
        unit.warranty_end,
      )
    : "none";

  const totalCost = useMemo(() => {
    if (!unit) return null;

    if (unit.cost_price !== null) {
      return unit.cost_price;
    }

    return batch?.unit_cost ?? null;
  }, [unit, batch]);

  return (
    <AppShell>
      <div className="page-content serial-detail-page">
        <div className="top-bar">
          <button
            type="button"
            className="back-button"
            onClick={() =>
              router.push("/serial-numbers")
            }
          >
            ← Back to Serial Numbers
          </button>

          <button
            type="button"
            className="refresh-button"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="loading-card">
            <div className="spinner" />

            <span>
              Loading serial asset...
            </span>
          </div>
        ) : errorMessage ? (
          <div className="error-card">
            <div>
              <strong>
                Unable to load serial asset
              </strong>

              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={() => loadData()}
            >
              Retry
            </button>
          </div>
        ) : !unit ? (
          <div className="empty-card">
            <h2>
              Serial asset not found
            </h2>

            <p>
              The requested serialized asset could
              not be found.
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                router.push("/serial-numbers")
              }
            >
              Back to Serial Numbers
            </button>
          </div>
        ) : (
          <>
            <div className="hero-card">
              <div className="hero-left">
                <div className="hero-eyebrow">
                  Serialized Asset
                </div>

                <h1>
                  {unit.serial_number}
                </h1>

                <p>
                  {product?.name ??
                    "Unknown Product"}

                  {variant?.name
                    ? ` · ${variant.name}`
                    : ""}

                  {variant?.sku
                    ? ` · SKU ${variant.sku}`
                    : ""}
                </p>

                <div className="hero-meta">
                  {unit.barcode && (
                    <span>
                      Barcode: {unit.barcode}
                    </span>
                  )}

                  {batch && (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/inventory/batches/${batch.id}`,
                        )
                      }
                    >
                      Batch: {batch.lot_number}
                    </button>
                  )}
                </div>
              </div>

              <div className="hero-right">
                <span
                  className={statusClass(
                    unit.status,
                  )}
                >
                  <span className="status-dot" />

                  {titleCase(unit.status)}
                </span>

                <div className="hero-location">
                  <strong>
                    {warehouse?.name ??
                      "No warehouse"}
                  </strong>

                  <span>
                    {location?.name ??
                      "No location"}
                  </span>
                </div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">
                  Current Status
                </div>

                <div className="stat-value small">
                  {titleCase(unit.status)}
                </div>

                <div className="stat-meta">
                  Asset lifecycle state
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">
                  Asset Cost
                </div>

                <div className="stat-value">
                  {formatCurrency(
                    totalCost,
                  )}
                </div>

                <div className="stat-meta">
                  Serialized unit cost
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">
                  Batch / Lot
                </div>

                <div className="stat-value small">
                  {batch?.lot_number ?? "—"}
                </div>

                <div className="stat-meta">
                  Parent inventory record
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">
                  Warranty
                </div>

                <div
                  className={`stat-value small ${
                    warrantyState === "active"
                      ? "green"
                      : warrantyState ===
                          "expired"
                        ? "red"
                        : ""
                  }`}
                >
                  {warrantyState === "active"
                    ? "Active"
                    : warrantyState ===
                        "expired"
                      ? "Expired"
                      : "None"}
                </div>

                <div className="stat-meta">
                  {unit.warranty_end
                    ? `Until ${formatDate(
                        unit.warranty_end,
                      )}`
                    : "No warranty end date"}
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">
                  Received
                </div>

                <div className="stat-value small">
                  {formatDate(
                    unit.received_at,
                  )}
                </div>

                <div className="stat-meta">
                  Inventory entry date
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">
                  Sold
                </div>

                <div className="stat-value small">
                  {formatDate(unit.sold_at)}
                </div>

                <div className="stat-meta">
                  Sale completion date
                </div>
              </div>
            </div>

            <div className="two-column">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      Asset Information
                    </h2>

                    <p>
                      Identity and product
                      information.
                    </p>
                  </div>
                </div>

                <div className="detail-grid">
                  <div className="detail-item">
                    <span>
                      Serial Number
                    </span>

                    <strong>
                      {unit.serial_number}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>
                      Barcode
                    </span>

                    <strong>
                      {unit.barcode ?? "—"}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>
                      Product
                    </span>

                    <strong>
                      {product?.name ??
                        "Unknown"}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>
                      Brand
                    </span>

                    <strong>
                      {product?.brand ?? "—"}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>
                      Variant
                    </span>

                    <strong>
                      {variant?.name ?? "—"}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>
                      SKU
                    </span>

                    <strong>
                      {variant?.sku ?? "—"}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>
                      Tracking
                    </span>

                    <strong>
                      {titleCase(
                        product?.tracking_mode ??
                          null,
                      )}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>
                      Category
                    </span>

                    <strong>
                      {product?.category ?? "—"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      Current Location
                    </h2>

                    <p>
                      Where the asset is currently
                      assigned.
                    </p>
                  </div>
                </div>

                <div className="location-highlight">
                  <div className="location-icon">
                    ◉
                  </div>

                  <div>
                    <strong>
                      {warehouse?.name ??
                        "No warehouse"}
                    </strong>

                    <span>
                      {warehouse?.code
                        ? `Warehouse code: ${warehouse.code}`
                        : ""}
                    </span>

                    <span>
                      Location:{" "}
                      {location?.name ??
                        "Not assigned"}
                    </span>

                    {location?.code && (
                      <span>
                        Location code:{" "}
                        {location.code}
                      </span>
                    )}
                  </div>
                </div>

                <div className="detail-grid compact">
                  <div className="detail-item">
                    <span>
                      Allocated
                    </span>

                    <strong>
                      {formatDateTime(
                        unit.allocated_at,
                      )}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>
                      Returned
                    </span>

                    <strong>
                      {formatDateTime(
                        unit.returned_at,
                      )}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>
                      Disposed
                    </span>

                    <strong>
                      {formatDateTime(
                        unit.disposed_at,
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="two-column">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      Batch / Lot
                    </h2>

                    <p>
                      Parent inventory provenance
                      for this serialized asset.
                    </p>
                  </div>

                  {batch && (
                    <button
                      type="button"
                      className="panel-link"
                      onClick={() =>
                        router.push(
                          `/inventory/batches/${batch.id}`,
                        )
                      }
                    >
                      Open Batch
                    </button>
                  )}
                </div>

                {batch ? (
                  <div className="batch-box">
                    <div className="batch-title">
                      <strong>
                        {batch.lot_number}
                      </strong>

                      <span
                        className={statusClass(
                          batch.status,
                        )}
                      >
                        {titleCase(
                          batch.status,
                        )}
                      </span>
                    </div>

                    <div className="detail-grid">
                      <div className="detail-item">
                        <span>
                          Received
                        </span>

                        <strong>
                          {formatDate(
                            batch.received_at,
                          )}
                        </strong>
                      </div>

                      <div className="detail-item">
                        <span>
                          Quantity Received
                        </span>

                        <strong>
                          {batch.quantity_received.toLocaleString()}
                        </strong>
                      </div>

                      <div className="detail-item">
                        <span>
                          Batch Unit Cost
                        </span>

                        <strong>
                          {formatCurrency(
                            batch.unit_cost,
                          )}
                        </strong>
                      </div>

                      <div className="detail-item">
                        <span>
                          Total Batch Cost
                        </span>

                        <strong>
                          {formatCurrency(
                            batch.total_cost,
                          )}
                        </strong>
                      </div>

                      <div className="detail-item">
                        <span>
                          Purchase Order
                        </span>

                        <strong>
                          {batch.purchase_order_id ??
                            "—"}
                        </strong>
                      </div>

                      <div className="detail-item">
                        <span>
                          Stock Receipt
                        </span>

                        <strong>
                          {batch.stock_receipt_id ??
                            "—"}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-inline">
                    This serialized asset is not
                    currently linked to a batch.
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      Warranty
                    </h2>

                    <p>
                      Warranty coverage recorded
                      against this asset.
                    </p>
                  </div>
                </div>

                <div className="warranty-box">
                  <div
                    className={`warranty-status ${
                      warrantyState === "active"
                        ? "active"
                        : warrantyState ===
                            "expired"
                          ? "expired"
                          : "none"
                    }`}
                  >
                    <span className="warranty-dot" />

                    <strong>
                      {warrantyState === "active"
                        ? "Warranty Active"
                        : warrantyState ===
                            "expired"
                          ? "Warranty Expired"
                          : "No Active Warranty"}
                    </strong>
                  </div>

                  <div className="detail-grid compact">
                    <div className="detail-item">
                      <span>
                        Warranty Start
                      </span>

                      <strong>
                        {formatDate(
                          unit.warranty_start,
                        )}
                      </strong>
                    </div>

                    <div className="detail-item">
                      <span>
                        Warranty End
                      </span>

                      <strong>
                        {formatDate(
                          unit.warranty_end,
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>
                    Commercial References
                  </h2>

                  <p>
                    Business records associated
                    with this serialized asset.
                  </p>
                </div>
              </div>

              <div className="reference-grid">
                <div className="reference-item">
                  <span>
                    Customer ID
                  </span>

                  <strong>
                    {unit.customer_id ?? "—"}
                  </strong>
                </div>

                <div className="reference-item">
                  <span>
                    Order ID
                  </span>

                  <strong>
                    {unit.order_id ?? "—"}
                  </strong>
                </div>

                <div className="reference-item">
                  <span>
                    Order Item ID
                  </span>

                  <strong>
                    {unit.order_item_id ?? "—"}
                  </strong>
                </div>

                <div className="reference-item">
                  <span>
                    Invoice ID
                  </span>

                  <strong>
                    {unit.invoice_id ?? "—"}
                  </strong>
                </div>

                <div className="reference-item">
                  <span>
                    Purchase Order ID
                  </span>

                  <strong>
                    {unit.purchase_order_id ??
                      "—"}
                  </strong>
                </div>

                <div className="reference-item">
                  <span>
                    Purchase Order Item
                  </span>

                  <strong>
                    {unit.purchase_order_item_id ??
                      "—"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>
                    Serial History
                  </h2>

                  <p>
                    Complete lifecycle and movement
                    trace for this serialized unit.
                  </p>
                </div>

                <div className="history-count">
                  {history.length} events
                </div>
              </div>

              {history.length === 0 ? (
                <div className="empty-inline">
                  No serial history events have been
                  recorded yet.
                </div>
              ) : (
                <div className="timeline">
                  {history.map((event, index) => {
                    const fromWarehouse =
                      event.from_warehouse_id
                        ? historyWarehouseMap.get(
                            event.from_warehouse_id,
                          )
                        : null;

                    const toWarehouse =
                      event.to_warehouse_id
                        ? historyWarehouseMap.get(
                            event.to_warehouse_id,
                          )
                        : null;

                    return (
                      <div
                        className="timeline-row"
                        key={event.id}
                      >
                        <div className="timeline-line">
                          <div className="timeline-dot" />

                          {index <
                            history.length - 1 && (
                            <div className="timeline-connector" />
                          )}
                        </div>

                        <div className="timeline-content">
                          <div className="timeline-top">
                            <div>
                              <strong>
                                {titleCase(
                                  event.event_type,
                                )}
                              </strong>

                              <span>
                                {formatDateTime(
                                  event.created_at,
                                )}
                              </span>
                            </div>

                            {event.reference_type && (
                              <span className="reference-badge">
                                {titleCase(
                                  event.reference_type,
                                )}
                              </span>
                            )}
                          </div>

                          <div className="timeline-details">
                            {event.from_status ||
                            event.to_status ? (
                              <div>
                                <span>
                                  Status
                                </span>

                                <strong>
                                  {event.from_status
                                    ? titleCase(
                                        event.from_status,
                                      )
                                    : "—"}{" "}
                                  →{" "}
                                  {event.to_status
                                    ? titleCase(
                                        event.to_status,
                                      )
                                    : "—"}
                                </strong>
                              </div>
                            ) : null}

                            {fromWarehouse ||
                            toWarehouse ? (
                              <div>
                                <span>
                                  Warehouse
                                </span>

                                <strong>
                                  {fromWarehouse?.name ??
                                    "—"}{" "}
                                  →{" "}
                                  {toWarehouse?.name ??
                                    "—"}
                                </strong>
                              </div>
                            ) : null}

                            {event.reference_id && (
                              <div>
                                <span>
                                  Reference
                                </span>

                                <strong>
                                  {
                                    event.reference_id
                                  }
                                </strong>
                              </div>
                            )}
                          </div>

                          {event.notes && (
                            <p className="timeline-notes">
                              {event.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {unit.notes && (
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      Notes
                    </h2>

                    <p>
                      Internal notes attached to
                      this serialized asset.
                    </p>
                  </div>
                </div>

                <div className="notes-content">
                  {unit.notes}
                </div>
              </div>
            )}

            <div className="footer-meta">
              <span>
                Serial ID: {unit.id}
              </span>

              <span>
                Created:{" "}
                {formatDateTime(
                  unit.created_at,
                )}
              </span>

              <span>
                Updated:{" "}
                {formatDateTime(
                  unit.updated_at,
                )}
              </span>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .serial-detail-page {
          padding-bottom: 40px;
        }

        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .back-button,
        .refresh-button {
          height: 38px;
          padding: 0 13px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .back-button {
          border: 1px solid #dbe1e8;
          background: white;
          color: #475569;
        }

        .back-button:hover,
        .refresh-button:hover:not(
            :disabled
          ) {
          background: #f8fafc;
        }

        .refresh-button {
          border: 1px solid #d1d5db;
          background: white;
          color: #334155;
        }

        .refresh-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .hero-card {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 18px;
          padding: 23px 24px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.035);
        }

        .hero-left {
          min-width: 0;
        }

        .hero-eyebrow {
          margin-bottom: 7px;
          color: #64748b;
          font-size: 11px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .hero-card h1 {
          margin: 0;
          color: #0f172a;
          font-size: 28px;
          line-height: 1.15;
          font-weight: 750;
          letter-spacing: -0.025em;
        }

        .hero-card p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .hero-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .hero-meta span,
        .hero-meta button {
          padding: 6px 9px;
          border: 1px solid #e2e8f0;
          border-radius: 7px;
          background: #f8fafc;
          color: #64748b;
          font-size: 10.5px;
          font-weight: 600;
        }

        .hero-meta button {
          color: #166534;
          cursor: pointer;
        }

        .hero-meta button:hover {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .hero-right {
          display: flex;
          align-items: flex-end;
          flex-direction: column;
          gap: 13px;
          flex-shrink: 0;
        }

        .hero-location {
          display: flex;
          align-items: flex-end;
          flex-direction: column;
        }

        .hero-location strong {
          color: #334155;
          font-size: 13px;
        }

        .hero-location span {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 11px;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 27px;
          padding: 0 9px;
          border: 1px solid transparent;
          border-radius: 7px;
          font-size: 10.5px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: currentColor;
        }

        .status-available {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #15803d;
        }

        .status-reserved {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-sold {
          border-color: #e2e8f0;
          background: #f8fafc;
          color: #64748b;
        }

        .status-returned {
          border-color: #ddd6fe;
          background: #f5f3ff;
          color: #6d28d9;
        }

        .status-warning {
          border-color: #fde68a;
          background: #fffbeb;
          color: #b45309;
        }

        .status-danger {
          border-color: #fecaca;
          background: #fef2f2;
          color: #dc2626;
        }

        .status-neutral {
          border-color: #e2e8f0;
          background: #f8fafc;
          color: #64748b;
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
          min-width: 0;
          padding: 17px 18px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.035);
        }

        .stat-label {
          color: #64748b;
          font-size: 11px;
          font-weight: 650;
        }

        .stat-value {
          margin-top: 8px;
          overflow: hidden;
          color: #0f172a;
          font-size: 21px;
          line-height: 1;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .stat-value.small {
          font-size: 17px;
        }

        .stat-value.green {
          color: #15803d;
        }

        .stat-value.red {
          color: #dc2626;
        }

        .stat-meta {
          margin-top: 8px;
          overflow: hidden;
          color: #94a3b8;
          font-size: 10.5px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .two-column {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 18px;
          margin-bottom: 18px;
        }

        .panel {
          margin-bottom: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.035);
        }

        .two-column .panel {
          margin-bottom: 0;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 17px 18px;
          border-bottom: 1px solid #e5e7eb;
        }

        .panel-header h2 {
          margin: 0;
          color: #1e293b;
          font-size: 15px;
          font-weight: 700;
        }

        .panel-header p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 11.5px;
        }

        .panel-link {
          border: 0;
          background: transparent;
          color: #166534;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
        }

        .panel-link:hover {
          text-decoration: underline;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 0;
          padding: 4px 18px;
        }

        .detail-grid.compact {
          padding-top: 0;
        }

        .detail-item {
          min-width: 0;
          padding: 12px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .detail-item:nth-last-child(-n + 2) {
          border-bottom: 0;
        }

        .detail-item span {
          display: block;
          color: #94a3b8;
          font-size: 10.5px;
        }

        .detail-item strong {
          display: block;
          margin-top: 4px;
          overflow: hidden;
          color: #334155;
          font-size: 12px;
          font-weight: 650;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .location-highlight {
          display: flex;
          align-items: center;
          gap: 13px;
          margin: 16px 18px 5px;
          padding: 13px;
          border: 1px solid #dcfce7;
          border-radius: 10px;
          background: #f7fdf8;
        }

        .location-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 34px;
          border-radius: 9px;
          background: #dcfce7;
          color: #15803d;
          font-size: 15px;
        }

        .location-highlight > div:last-child {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .location-highlight strong {
          color: #334155;
          font-size: 13px;
        }

        .location-highlight span {
          margin-top: 3px;
          color: #64748b;
          font-size: 10.5px;
        }

        .batch-box {
          padding-bottom: 4px;
        }

        .batch-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 16px 18px 0;
        }

        .batch-title > strong {
          color: #166534;
          font-size: 15px;
        }

        .warranty-box {
          padding: 16px 18px 4px;
        }

        .warranty-status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .warranty-status strong {
          font-size: 13px;
        }

        .warranty-status.active strong {
          color: #15803d;
        }

        .warranty-status.expired strong {
          color: #dc2626;
        }

        .warranty-status.none strong {
          color: #64748b;
        }

        .warranty-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: currentColor;
        }

        .warranty-status.active {
          color: #15803d;
        }

        .warranty-status.expired {
          color: #dc2626;
        }

        .warranty-status.none {
          color: #94a3b8;
        }

        .reference-grid {
          display: grid;
          grid-template-columns: repeat(
            3,
            minmax(0, 1fr)
          );
        }

        .reference-item {
          min-width: 0;
          padding: 15px 18px;
          border-right: 1px solid #f1f5f9;
          border-bottom: 1px solid #f1f5f9;
        }

        .reference-item:nth-child(3n) {
          border-right: 0;
        }

        .reference-item:nth-last-child(-n + 3) {
          border-bottom: 0;
        }

        .reference-item span {
          display: block;
          color: #94a3b8;
          font-size: 10.5px;
        }

        .reference-item strong {
          display: block;
          margin-top: 5px;
          overflow: hidden;
          color: #475569;
          font-size: 11.5px;
          font-weight: 650;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .history-count {
          min-width: 34px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 9px;
          border-radius: 7px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 10.5px;
          font-weight: 700;
        }

        .timeline {
          padding: 19px 20px 20px;
        }

        .timeline-row {
          display: flex;
          gap: 13px;
        }

        .timeline-line {
          position: relative;
          width: 16px;
          flex: 0 0 16px;
          display: flex;
          justify-content: center;
        }

        .timeline-dot {
          position: relative;
          z-index: 2;
          width: 9px;
          height: 9px;
          margin-top: 5px;
          border: 2px solid white;
          border-radius: 999px;
          background: #166534;
          box-shadow: 0 0 0 1px #86efac;
        }

        .timeline-connector {
          position: absolute;
          top: 14px;
          bottom: -2px;
          width: 1px;
          background: #dbe1e8;
        }

        .timeline-content {
          min-width: 0;
          flex: 1;
          padding-bottom: 21px;
        }

        .timeline-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .timeline-top > div {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 8px;
        }

        .timeline-top strong {
          color: #334155;
          font-size: 12.5px;
        }

        .timeline-top span {
          color: #94a3b8;
          font-size: 10.5px;
        }

        .reference-badge {
          padding: 4px 7px;
          border-radius: 6px;
          background: #f1f5f9;
          color: #64748b !important;
          font-size: 9.5px !important;
          font-weight: 650;
        }

        .timeline-details {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 9px;
        }

        .timeline-details > div {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 8px;
          border-radius: 7px;
          background: #f8fafc;
        }

        .timeline-details span {
          color: #94a3b8;
          font-size: 9.5px;
        }

        .timeline-details strong {
          color: #475569;
          font-size: 10.5px;
        }

        .timeline-notes {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.5;
        }

        .notes-content {
          padding: 17px 18px;
          color: #475569;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .empty-inline {
          padding: 28px 18px;
          color: #94a3b8;
          font-size: 12px;
          text-align: center;
        }

        .footer-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px 20px;
          color: #94a3b8;
          font-size: 10px;
        }

        .loading-card {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          color: #94a3b8;
          font-size: 13px;
        }

        .spinner {
          width: 25px;
          height: 25px;
          border: 2px solid #e2e8f0;
          border-top-color: #166534;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .error-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 15px 17px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fef2f2;
          color: #991b1b;
        }

        .error-card strong {
          display: block;
          font-size: 13px;
        }

        .error-card p {
          margin: 4px 0 0;
          color: #b91c1c;
          font-size: 12px;
        }

        .error-card button {
          border: 1px solid #fecaca;
          border-radius: 8px;
          background: white;
          color: #991b1b;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .empty-card {
          min-height: 300px;
          display: flex;
          align-items: center;
          flex-direction: column;
          justify-content: center;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          text-align: center;
        }

        .empty-card h2 {
          margin: 0;
          color: #334155;
          font-size: 17px;
        }

        .empty-card p {
          margin: 7px 0 17px;
          color: #94a3b8;
          font-size: 12px;
        }

        .secondary-button {
          height: 38px;
          padding: 0 13px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: white;
          color: #334155;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1450px) {
          .stats-grid {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 1000px) {
          .two-column {
            grid-template-columns: 1fr;
          }

          .reference-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .reference-item:nth-child(3n) {
            border-right: 1px solid #f1f5f9;
          }

          .reference-item:nth-child(2n) {
            border-right: 0;
          }

          .reference-item:nth-last-child(-n + 3) {
            border-bottom: 1px solid #f1f5f9;
          }

          .reference-item:nth-last-child(-n + 2) {
            border-bottom: 0;
          }
        }

        @media (max-width: 700px) {
          .hero-card {
            flex-direction: column;
          }

          .hero-right {
            align-items: flex-start;
          }

          .hero-location {
            align-items: flex-start;
          }

          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .reference-grid {
            grid-template-columns: 1fr;
          }

          .reference-item,
          .reference-item:nth-child(2n),
          .reference-item:nth-child(3n) {
            border-right: 0;
            border-bottom: 1px solid #f1f5f9;
          }

          .reference-item:last-child {
            border-bottom: 0;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .detail-item:nth-last-child(-n + 2) {
            border-bottom: 1px solid #f1f5f9;
          }

          .detail-item:last-child {
            border-bottom: 0;
          }

          .top-bar {
            align-items: stretch;
            flex-direction: column;
          }
        }
      `}</style>
    </AppShell>
  );
}