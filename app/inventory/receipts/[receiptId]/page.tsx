"use client";

import {
  ArrowLeft,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Hash,
  MapPin,
  Package,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Receipt = {
  id: string;
  company_id: string;
  receipt_number: string;
  supplier_name: string | null;
  reference_number: string | null;
  notes: string | null;
  status: string;
  received_by: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
  purchase_order_id: string | null;
};

type ReceiptItem = {
  id: string;
  receipt_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_cost: number;
  warehouse_id: string | null;
  location_id: string | null;
  purchase_order_item_id: string | null;
  batch_id: string | null;
  created_at: string;
};

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

type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string | null;
  status: string | null;
  currency: string | null;
  order_date: string | null;
  expected_date: string | null;
  supplier_reference: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  shipping_amount: number | null;
  total_amount: number | null;
  notes: string | null;
};

type SerializedUnit = {
  id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
  barcode: string | null;
  status: string;
  warehouse_id: string | null;
  location_id: string | null;
  cost_price: number | null;
  warranty_start: string | null;
  warranty_end: string | null;
  received_at: string | null;
  batch_id: string | null;
};

const COMPANY_STORAGE_KEYS = [
  "sbs_current_company_id",
  "current_company_id",
  "currentCompanyId",
  "selected_company_id",
  "selectedCompanyId",
];

function isUuid(
  value: string | null | undefined,
): value is string {  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getStoredCompanyId() {
  if (typeof window === "undefined") return null;

  for (const key of COMPANY_STORAGE_KEYS) {
    const value = window.localStorage.getItem(key);

    if (isUuid(value)) {
      return value;
    }
  }

  return null;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeStatus(status: string | null | undefined) {
  return (status || "draft").toLowerCase();
}

function statusLabel(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "draft":
      return "Draft";
    default:
      return normalized.replace(/_/g, " ");
  }
}

function trackingLabel(mode: string | null | undefined) {
  switch ((mode || "").toLowerCase()) {
    case "serial":
      return "Serial";
    case "batch":
      return "Batch";
    case "quantity":
      return "Quantity";
    case "none":
      return "Not Tracked";
    default:
      return "—";
  }
}

function getStatusClass(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  if (normalized === "completed") {
    return "status-completed";
  }

  if (normalized === "cancelled") {
    return "status-cancelled";
  }

  return "status-draft";
}

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const receiptId = Array.isArray(params.receiptId)
    ? params.receiptId[0]
    : params.receiptId;

  const [receipt, setReceipt] = useState<Receipt | null>(
    null,
  );
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(
    [],
  );
  const [locations, setLocations] = useState<Location[]>([]);
  const [purchaseOrder, setPurchaseOrder] =
    useState<PurchaseOrder | null>(null);
  const [serializedUnits, setSerializedUnits] = useState<
    SerializedUnit[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!isUuid(receiptId)) {
        setErrorMessage("Invalid stock receipt ID.");
        setLoading(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage(null);

        let companyId = getStoredCompanyId();

        if (!companyId) {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError) throw userError;

          if (!user) {
            throw new Error(
              "You must be signed in to view this receipt.",
            );
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

          companyId = membership?.company_id ?? null;
        }

        if (!companyId) {
          throw new Error(
            "No active company could be resolved.",
          );
        }

        const { data: receiptData, error: receiptError } =
          await supabase
            .from("stock_receipts")
            .select(
              "id,company_id,receipt_number,supplier_name,reference_number,notes,status,received_by,received_at,created_at,updated_at,purchase_order_id",
            )
            .eq("company_id", companyId)
            .eq("id", receiptId)
            .maybeSingle();

        if (receiptError) throw receiptError;

        if (!receiptData) {
          throw new Error("Stock receipt was not found.");
        }

        const resolvedReceipt = receiptData as Receipt;

        setReceipt(resolvedReceipt);

        const [
          itemsResult,
          productsResult,
          variantsResult,
          batchesResult,
          warehousesResult,
          locationsResult,
          purchaseOrderResult,
        ] = await Promise.all([
          supabase
            .from("stock_receipt_items")
            .select(
              "id,receipt_id,product_id,variant_id,quantity,unit_cost,warehouse_id,location_id,purchase_order_item_id,batch_id,created_at",
            )
            .eq("company_id", companyId)
            .eq("receipt_id", receiptId)
            .order("created_at", { ascending: true }),

          supabase
            .from("products")
            .select(
              "id,name,brand,category,tracking_mode,status",
            )
            .eq("company_id", companyId),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,sku,cost_price,selling_price,is_active",
            )
            .eq("company_id", companyId),

          supabase
            .from("inventory_batches")
            .select(
              "id,product_id,variant_id,lot_number,received_at,quantity_received,unit_cost,total_cost,status",
            )
            .eq("company_id", companyId)
            .neq("status", "cancelled"),

          supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", companyId),

          supabase
            .from("warehouse_locations")
            .select(
              "id,warehouse_id,name,code",
            )
            .eq("company_id", companyId),

          resolvedReceipt.purchase_order_id
            ? supabase
                .from("purchase_orders")
                .select(
                  "id,po_number,supplier_id,status,currency,order_date,expected_date,supplier_reference,subtotal,discount_amount,tax_amount,shipping_amount,total_amount,notes",
                )
                .eq("company_id", companyId)
                .eq(
                  "id",
                  resolvedReceipt.purchase_order_id,
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),
        ]);

        if (itemsResult.error) throw itemsResult.error;
        if (productsResult.error) throw productsResult.error;
        if (variantsResult.error) throw variantsResult.error;
        if (batchesResult.error) throw batchesResult.error;
        if (warehousesResult.error) {
          throw warehousesResult.error;
        }
        if (locationsResult.error) {
          throw locationsResult.error;
        }
        if (purchaseOrderResult.error) {
          throw purchaseOrderResult.error;
        }

        const resolvedItems =
          (itemsResult.data ?? []) as ReceiptItem[];

        setItems(resolvedItems);
        setProducts(
          (productsResult.data ?? []) as Product[],
        );
        setVariants(
          (variantsResult.data ?? []) as Variant[],
        );
        setBatches(
          (batchesResult.data ?? []) as Batch[],
        );
        setWarehouses(
          (warehousesResult.data ?? []) as Warehouse[],
        );
        setLocations(
          (locationsResult.data ?? []) as Location[],
        );
        setPurchaseOrder(
          (purchaseOrderResult.data ??
            null) as PurchaseOrder | null,
        );

        const batchIds = Array.from(
          new Set(
            resolvedItems
              .map((item) => item.batch_id)
              .filter(isUuid),
          ),
        );

        if (batchIds.length > 0) {
          const { data: serialData, error: serialError } =
            await supabase
              .from("serialized_units")
              .select(
                "id,product_id,variant_id,serial_number,barcode,status,warehouse_id,location_id,cost_price,warranty_start,warranty_end,received_at,batch_id",
              )
              .eq("company_id", companyId)
              .in("batch_id", batchIds)
              .order("serial_number");

          if (serialError) throw serialError;

          setSerializedUnits(
            (serialData ?? []) as SerializedUnit[],
          );
        } else {
          setSerializedUnits([]);
        }
      } catch (error) {
        console.error(
          "Stock receipt detail load error:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load stock receipt.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [receiptId, supabase],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const productMap = useMemo(() => {
    return new Map(
      products.map((product) => [product.id, product]),
    );
  }, [products]);

  const variantMap = useMemo(() => {
    return new Map(
      variants.map((variant) => [variant.id, variant]),
    );
  }, [variants]);

  const batchMap = useMemo(() => {
    return new Map(
      batches.map((batch) => [batch.id, batch]),
    );
  }, [batches]);

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
      locations.map((location) => [location.id, location]),
    );
  }, [locations]);

  const serialsByBatch = useMemo(() => {
    const map = new Map<string, SerializedUnit[]>();

    for (const serial of serializedUnits) {
      if (!serial.batch_id) continue;

      const existing = map.get(serial.batch_id) ?? [];
      existing.push(serial);
      map.set(serial.batch_id, existing);
    }

    return map;
  }, [serializedUnits]);

  const totals = useMemo(() => {
    const units = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );

    const value = items.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity || 0) *
          Number(item.unit_cost || 0),
      0,
    );

    const batchIds = new Set(
      items
        .map((item) => item.batch_id)
        .filter(Boolean),
    );

    const warehouseIds = new Set(
      items
        .map((item) => item.warehouse_id)
        .filter(Boolean),
    );

    const serialTrackingLines = items.filter(
      (item) =>
        productMap
          .get(item.product_id)
          ?.tracking_mode === "serial",
    ).length;

    return {
      itemCount: items.length,
      units,
      value,
      batchCount: batchIds.size,
      warehouseCount: warehouseIds.size,
      serialCount: serializedUnits.length,
      serialTrackingLines,
    };
  }, [items, productMap, serializedUnits]);

  const uniqueWarehouses = useMemo(() => {
    const map = new Map<
      string,
      {
        warehouse: Warehouse;
        locations: Set<string>;
        units: number;
      }
    >();

    for (const item of items) {
      if (!item.warehouse_id) continue;

      const warehouse = warehouseMap.get(
        item.warehouse_id,
      );

      if (!warehouse) continue;

      let row = map.get(warehouse.id);

      if (!row) {
        row = {
          warehouse,
          locations: new Set<string>(),
          units: 0,
        };

        map.set(warehouse.id, row);
      }

      if (item.location_id) {
        const location = locationMap.get(
          item.location_id,
        );

        if (location) {
          row.locations.add(location.name);
        }
      }

      row.units += Number(item.quantity || 0);
    }

    return Array.from(map.values());
  }, [items, warehouseMap, locationMap]);

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="state-box">
            <div className="spinner" />
            <div>Loading stock receipt...</div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (errorMessage || !receipt) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="page-header">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                INVENTORY · RECEIVING
              </div>

              <h1 className="page-title">
                Stock Receipt
              </h1>
            </div>

            <Link
              href="/inventory/receipts"
              className="secondary-button"
            >
              <ArrowLeft size={16} />
              Back to Receipts
            </Link>
          </div>

          <div className="content-card">
            <div className="state-box error-state">
              <div className="error-icon">
                <XCircle size={25} />
              </div>

              <div className="error-title">
                Unable to load receipt
              </div>

              <div className="error-message">
                {errorMessage ||
                  "The requested stock receipt could not be found."}
              </div>

              <Link
                href="/inventory/receipts"
                className="primary-button"
              >
                Back to Receipts
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const status = normalizeStatus(receipt.status);

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="back-row">
          <button
            type="button"
            className="back-button"
            onClick={() =>
              router.push("/inventory/receipts")
            }
          >
            <ArrowLeft size={16} />
            Back to Receipts
          </button>
        </div>

        <div className="hero-card">
          <div className="hero-main">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              INVENTORY · STOCK RECEIPT
            </div>

            <div className="hero-title-row">
              <h1 className="page-title">
                {receipt.receipt_number}
              </h1>

              <span
                className={`status-badge ${getStatusClass(
                  receipt.status,
                )}`}
              >
                <span className="status-dot" />
                {statusLabel(receipt.status)}
              </span>
            </div>

            <p className="page-subtitle">
              {receipt.supplier_name ||
                "Direct inventory receipt"}
              {purchaseOrder
                ? ` · ${purchaseOrder.po_number}`
                : ""}
            </p>
          </div>

          <div className="hero-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={
                  refreshing ? "spin" : undefined
                }
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <ClipboardList size={19} />
            </div>

            <div>
              <div className="stat-label">
                Receipt Items
              </div>
              <div className="stat-value">
                {formatNumber(totals.itemCount)}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Boxes size={19} />
            </div>

            <div>
              <div className="stat-label">
                Units Received
              </div>
              <div className="stat-value">
                {formatNumber(totals.units)}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Package size={19} />
            </div>

            <div>
              <div className="stat-label">
                Batches Created
              </div>
              <div className="stat-value">
                {formatNumber(totals.batchCount)}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <ShieldCheck size={19} />
            </div>

            <div>
              <div className="stat-label">
                Serial Assets
              </div>
              <div className="stat-value">
                {formatNumber(totals.serialCount)}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <MapPin size={19} />
            </div>

            <div>
              <div className="stat-label">
                Warehouses
              </div>
              <div className="stat-value">
                {formatNumber(totals.warehouseCount)}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <PackageCheck size={19} />
            </div>

            <div>
              <div className="stat-label">
                Receipt Value
              </div>
              <div className="stat-value">
                {purchaseOrder?.currency
                  ? `${purchaseOrder.currency} `
                  : ""}
                {formatMoney(totals.value)}
              </div>
            </div>
          </div>
        </div>

        <div className="two-column-grid">
          <section className="content-card">
            <div className="section-header">
              <div>
                <div className="section-title">
                  Receipt Information
                </div>

                <div className="section-subtitle">
                  Core receiving document details
                </div>
              </div>

              <FileText size={18} />
            </div>

            <div className="info-grid">
              <div className="info-item">
                <div className="info-label">
                  Receipt Number
                </div>

                <div className="info-value">
                  <Hash size={14} />
                  {receipt.receipt_number}
                </div>
              </div>

              <div className="info-item">
                <div className="info-label">
                  Status
                </div>

                <div className="info-value">
                  <span
                    className={`status-badge ${getStatusClass(
                      receipt.status,
                    )}`}
                  >
                    <span className="status-dot" />
                    {statusLabel(receipt.status)}
                  </span>
                </div>
              </div>

              <div className="info-item">
                <div className="info-label">
                  Supplier
                </div>

                <div className="info-value">
                  <Truck size={14} />
                  {receipt.supplier_name ||
                    "Direct Receipt"}
                </div>
              </div>

              <div className="info-item">
                <div className="info-label">
                  Reference Number
                </div>

                <div className="info-value">
                  {receipt.reference_number || "—"}
                </div>
              </div>

              <div className="info-item">
                <div className="info-label">
                  Received Date
                </div>

                <div className="info-value">
                  <CalendarDays size={14} />
                  {formatDate(receipt.received_at)}
                </div>
              </div>

              <div className="info-item">
                <div className="info-label">
                  Received At
                </div>

                <div className="info-value">
                  <Clock3 size={14} />
                  {formatDateTime(
                    receipt.received_at,
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="content-card">
            <div className="section-header">
              <div>
                <div className="section-title">
                  Purchase Order
                </div>

                <div className="section-subtitle">
                  Source purchasing document
                </div>
              </div>

              <ClipboardList size={18} />
            </div>

            {purchaseOrder ? (
              <div className="po-panel">
                <div className="po-number">
                  {purchaseOrder.po_number}
                </div>

                <div className="po-grid">
                  <div>
                    <span>Order Date</span>
                    <strong>
                      {formatDate(
                        purchaseOrder.order_date,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Expected</span>
                    <strong>
                      {formatDate(
                        purchaseOrder.expected_date,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Currency</span>
                    <strong>
                      {purchaseOrder.currency ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>PO Status</span>
                    <strong>
                      {purchaseOrder.status
                        ? purchaseOrder.status.replace(
                            /_/g,
                            " ",
                          )
                        : "—"}
                    </strong>
                  </div>
                </div>

                {purchaseOrder.supplier_reference && (
                  <div className="po-reference">
                    Supplier Ref:{" "}
                    <strong>
                      {purchaseOrder.supplier_reference}
                    </strong>
                  </div>
                )}

                <Link
                  href="/purchase-orders"
                  className="view-link"
                >
                  View Purchase Orders
                </Link>
              </div>
            ) : (
              <div className="direct-receipt">
                <div className="direct-icon">
                  <PackageCheck size={20} />
                </div>

                <div>
                  <div className="direct-title">
                    Direct Receipt
                  </div>

                  <div className="direct-text">
                    This receipt is not linked to a
                    purchase order.
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="content-card">
          <div className="section-header">
            <div>
              <div className="section-title">
                Received Items
              </div>

              <div className="section-subtitle">
                Inventory quantities, costing, batches,
                and warehouse placement
              </div>
            </div>

            <div className="section-count">
              {formatNumber(items.length)} lines
            </div>
          </div>

          {items.length === 0 ? (
            <div className="small-empty">
              No receipt items were found.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Tracking</th>
                    <th>Quantity</th>
                    <th>Unit Cost</th>
                    <th>Total</th>
                    <th>Batch / Lot</th>
                    <th>Warehouse / Location</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => {
                    const product = productMap.get(
                      item.product_id,
                    );

                    const variant = variantMap.get(
                      item.variant_id,
                    );

                    const batch = item.batch_id
                      ? batchMap.get(item.batch_id)
                      : null;

                    const warehouse =
                      item.warehouse_id
                        ? warehouseMap.get(
                            item.warehouse_id,
                          )
                        : null;

                    const location = item.location_id
                      ? locationMap.get(
                          item.location_id,
                        )
                      : null;

                    const lineTotal =
                      Number(item.quantity || 0) *
                      Number(item.unit_cost || 0);

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="primary-cell">
                            {product?.name || "Unknown Product"}
                          </div>

                          {variant?.name && (
                            <div className="secondary-cell">
                              {variant.name}
                            </div>
                          )}
                        </td>

                        <td>
                          <span className="sku-cell">
                            {variant?.sku || "—"}
                          </span>
                        </td>

                        <td>
                          <span className="tracking-badge">
                            {trackingLabel(
                              product?.tracking_mode,
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="quantity-cell">
                            {formatNumber(
                              Number(item.quantity || 0),
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="cost-cell">
                            {purchaseOrder?.currency
                              ? `${purchaseOrder.currency} `
                              : ""}
                            {formatMoney(
                              Number(
                                item.unit_cost || 0,
                              ),
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="cost-cell strong">
                            {purchaseOrder?.currency
                              ? `${purchaseOrder.currency} `
                              : ""}
                            {formatMoney(lineTotal)}
                          </span>
                        </td>

                        <td>
                          {batch ? (
                            <Link
                              href={`/inventory/batches/${batch.id}`}
                              className="batch-link"
                            >
                              <span className="lot-label">
                                {batch.lot_number}
                              </span>

                              <span className="batch-status">
                                {batch.status || "active"}
                              </span>
                            </Link>
                          ) : (
                            <span className="muted">
                              —
                            </span>
                          )}
                        </td>

                        <td>
                          {warehouse ? (
                            <div className="location-detail">
                              <div>
                                {warehouse.name}
                              </div>

                              {location && (
                                <span>
                                  {location.name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="muted">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="content-card">
          <div className="section-header">
            <div>
              <div className="section-title">
                Batch & Inventory Placement
              </div>

              <div className="section-subtitle">
                Where the received inventory was placed
              </div>
            </div>

            <Boxes size={18} />
          </div>

          <div className="placement-grid">
            {uniqueWarehouses.length === 0 ? (
              <div className="small-empty">
                No warehouse placement recorded.
              </div>
            ) : (
              uniqueWarehouses.map((row) => (
                <div
                  key={row.warehouse.id}
                  className="placement-card"
                >
                  <div className="placement-icon">
                    <MapPin size={18} />
                  </div>

                  <div className="placement-main">
                    <div className="placement-name">
                      {row.warehouse.name}
                    </div>

                    {row.warehouse.code && (
                      <div className="placement-code">
                        {row.warehouse.code}
                      </div>
                    )}

                    <div className="placement-locations">
                      {row.locations.size > 0
                        ? Array.from(
                            row.locations,
                          ).join(", ")
                        : "Warehouse level"}
                    </div>
                  </div>

                  <div className="placement-units">
                    <strong>
                      {formatNumber(row.units)}
                    </strong>
                    <span>units</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {serializedUnits.length > 0 && (
          <section className="content-card">
            <div className="section-header">
              <div>
                <div className="section-title">
                  Serialized Assets Received
                </div>

                <div className="section-subtitle">
                  Real serial numbers registered during
                  this receiving operation
                </div>
              </div>

              <div className="section-count">
                {formatNumber(
                  serializedUnits.length,
                )}{" "}
                assets
              </div>
            </div>

            <div className="serial-grid">
              {serializedUnits.map((serial) => {
                const product = productMap.get(
                  serial.product_id,
                );

                const variant = serial.variant_id
                  ? variantMap.get(
                      serial.variant_id,
                    )
                  : null;

                const batch = serial.batch_id
                  ? batchMap.get(serial.batch_id)
                  : null;

                return (
                  <Link
                    key={serial.id}
                    href={`/serial-numbers/${serial.id}`}
                    className="serial-card"
                  >
                    <div className="serial-icon">
                      <ShieldCheck size={17} />
                    </div>

                    <div className="serial-main">
                      <div className="serial-number">
                        {serial.serial_number}
                      </div>

                      <div className="serial-product">
                        {product?.name ||
                          "Unknown Product"}
                        {variant?.name
                          ? ` · ${variant.name}`
                          : ""}
                      </div>

                      {batch && (
                        <div className="serial-batch">
                          Lot: {batch.lot_number}
                        </div>
                      )}
                    </div>

                    <div
                      className={`serial-status serial-${normalizeStatus(
                        serial.status,
                      )}`}
                    >
                      {serial.status}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {receipt.notes && (
          <section className="content-card">
            <div className="section-header">
              <div>
                <div className="section-title">
                  Receiving Notes
                </div>

                <div className="section-subtitle">
                  Notes recorded against this receipt
                </div>
              </div>

              <FileText size={18} />
            </div>

            <div className="notes-box">
              {receipt.notes}
            </div>
          </section>
        )}

        <section className="content-card">
          <div className="section-header">
            <div>
              <div className="section-title">
                Receipt Metadata
              </div>

              <div className="section-subtitle">
                System audit information
              </div>
            </div>

            <UserRound size={18} />
          </div>

          <div className="metadata-grid">
            <div>
              <span>Receipt ID</span>
              <strong className="mono">
                {receipt.id}
              </strong>
            </div>

            <div>
              <span>Received By</span>
              <strong className="mono">
                {receipt.received_by || "—"}
              </strong>
            </div>

            <div>
              <span>Created</span>
              <strong>
                {formatDateTime(receipt.created_at)}
              </strong>
            </div>

            <div>
              <span>Last Updated</span>
              <strong>
                {formatDateTime(receipt.updated_at)}
              </strong>
            </div>
          </div>
        </section>

        <div className="bottom-note">
          <div className="bottom-note-icon">
            <CheckCircle2 size={17} />
          </div>

          <div>
            <strong>Inventory V2 receiving record</strong>
            <span>
              This receipt reflects the receiving transaction
              that created batch inventory and, where supplied,
              registered real serialized assets. Inventory
              movements remain the audit ledger for physical
              stock changes.
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .inventory-page {
          width: 100%;
          padding-bottom: 40px;
        }

        .back-row {
          margin-bottom: 14px;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .back-button:hover {
          color: #166534;
        }

        .hero-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 22px;
          margin-bottom: 16px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .hero-main {
          min-width: 0;
        }

        .hero-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
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
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .page-subtitle {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.6;
        }

        .hero-actions {
          flex: 0 0 auto;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .stat-card {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .stat-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #f0fdf4;
          color: #166534;
        }

        .stat-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 3px;
          white-space: nowrap;
        }

        .stat-value {
          color: #0f172a;
          font-size: 19px;
          line-height: 1.2;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .two-column-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.8fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .content-card {
          overflow: hidden;
          margin-bottom: 16px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .two-column-grid .content-card {
          margin-bottom: 0;
        }

        .section-header {
          min-height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 17px;
          color: #64748b;
          border-bottom: 1px solid #e5e7eb;
        }

        .section-title {
          color: #0f172a;
          font-size: 14px;
          font-weight: 700;
        }

        .section-subtitle {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 11px;
        }

        .section-count {
          padding: 5px 9px;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .secondary-button,
        .primary-button {
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 13px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            opacity 0.15s ease;
        }

        .secondary-button {
          color: #334155;
          background: #ffffff;
          border: 1px solid #d1d5db;
        }

        .secondary-button:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .primary-button {
          color: #ffffff;
          background: #166534;
          border: 1px solid #166534;
        }

        .primary-button:hover {
          background: #14532d;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
        }

        .info-item {
          min-height: 78px;
          padding: 15px 17px;
          border-bottom: 1px solid #eef2f7;
        }

        .info-item:nth-last-child(-n + 2) {
          border-bottom: 0;
        }

        .info-item:nth-child(odd) {
          border-right: 1px solid #eef2f7;
        }

        .info-label {
          margin-bottom: 6px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .info-value {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.4;
        }

        .po-panel {
          padding: 18px;
        }

        .po-number {
          color: #0f172a;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 15px;
        }

        .po-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .po-grid div {
          padding: 11px;
          background: #f8fafc;
          border: 1px solid #eef2f7;
          border-radius: 9px;
        }

        .po-grid span {
          display: block;
          margin-bottom: 4px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .po-grid strong {
          color: #334155;
          font-size: 12px;
          font-weight: 650;
          text-transform: capitalize;
        }

        .po-reference {
          margin-top: 13px;
          color: #64748b;
          font-size: 12px;
        }

        .po-reference strong {
          color: #334155;
        }

        .view-link {
          display: inline-flex;
          margin-top: 15px;
          color: #166534;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
        }

        .view-link:hover {
          text-decoration: underline;
        }

        .direct-receipt {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px;
        }

        .direct-icon {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          color: #166534;
          background: #f0fdf4;
        }

        .direct-title {
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .direct-text {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
        }

        .table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
        }

        .data-table th {
          padding: 12px 15px;
          color: #64748b;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.045em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .data-table td {
          padding: 13px 15px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          font-size: 13px;
          vertical-align: middle;
        }

        .data-table tbody tr:hover {
          background: #fafafa;
        }

        .data-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .primary-cell {
          color: #0f172a;
          font-weight: 650;
          line-height: 1.35;
        }

        .secondary-cell {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 11px;
        }

        .sku-cell {
          color: #475569;
          font-size: 12px;
          font-family: ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, monospace;
        }

        .tracking-badge {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 8px;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
        }

        .quantity-cell {
          color: #0f172a;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .cost-cell {
          color: #475569;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        .cost-cell.strong {
          color: #0f172a;
          font-weight: 700;
        }

        .batch-link {
          display: inline-flex;
          flex-direction: column;
          gap: 3px;
          color: #166534;
          text-decoration: none;
        }

        .batch-link:hover .lot-label {
          text-decoration: underline;
        }

        .lot-label {
          font-weight: 700;
        }

        .batch-status {
          color: #94a3b8;
          font-size: 10px;
          text-transform: capitalize;
        }

        .location-detail {
          color: #334155;
          font-weight: 600;
          line-height: 1.35;
        }

        .location-detail span {
          display: block;
          margin-top: 3px;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 500;
        }

        .muted {
          color: #94a3b8;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 25px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          display: inline-block;
        }

        .status-completed {
          color: #166534;
          background: #f0fdf4;
        }

        .status-completed .status-dot {
          background: #16a34a;
        }

        .status-draft {
          color: #92400e;
          background: #fffbeb;
        }

        .status-draft .status-dot {
          background: #f59e0b;
        }

        .status-cancelled {
          color: #991b1b;
          background: #fef2f2;
        }

        .status-cancelled .status-dot {
          background: #ef4444;
        }

        .placement-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(280px, 1fr)
          );
          gap: 12px;
          padding: 16px;
        }

        .placement-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px;
          border: 1px solid #e5e7eb;
          border-radius: 11px;
          background: #ffffff;
        }

        .placement-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          color: #166534;
          background: #f0fdf4;
        }

        .placement-main {
          min-width: 0;
          flex: 1;
        }

        .placement-name {
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .placement-code {
          margin-top: 2px;
          color: #94a3b8;
          font-size: 10px;
          font-family: ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, monospace;
        }

        .placement-locations {
          margin-top: 5px;
          color: #64748b;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .placement-units {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .placement-units strong {
          color: #0f172a;
          font-size: 15px;
        }

        .placement-units span {
          color: #94a3b8;
          font-size: 10px;
        }

        .serial-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(310px, 1fr)
          );
          gap: 10px;
          padding: 16px;
        }

        .serial-card {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
          padding: 12px;
          color: inherit;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          text-decoration: none;
          transition:
            border-color 0.15s ease,
            background 0.15s ease;
        }

        .serial-card:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .serial-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: #166534;
          background: #f0fdf4;
        }

        .serial-main {
          min-width: 0;
          flex: 1;
        }

        .serial-number {
          color: #0f172a;
          font-size: 12px;
          font-weight: 700;
          font-family: ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .serial-product {
          margin-top: 3px;
          color: #475569;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .serial-batch {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 10px;
        }

        .serial-status {
          padding: 4px 7px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 700;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .serial-available {
          color: #166534;
          background: #f0fdf4;
        }

        .serial-reserved {
          color: #92400e;
          background: #fffbeb;
        }

        .serial-sold {
          color: #475569;
          background: #f1f5f9;
        }

        .serial-repair,
        .serial-rma,
        .serial-damaged,
        .serial-lost,
        .serial-disposed {
          color: #991b1b;
          background: #fef2f2;
        }

        .notes-box {
          margin: 16px;
          padding: 14px;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .metadata-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 0;
        }

        .metadata-grid > div {
          min-width: 0;
          padding: 15px 17px;
          border-right: 1px solid #eef2f7;
        }

        .metadata-grid > div:last-child {
          border-right: 0;
        }

        .metadata-grid span {
          display: block;
          margin-bottom: 6px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .metadata-grid strong {
          display: block;
          color: #475569;
          font-size: 11px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .metadata-grid .mono {
          color: #64748b;
          font-family: ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, monospace;
        }

        .small-empty {
          padding: 35px;
          color: #94a3b8;
          font-size: 13px;
          text-align: center;
        }

        .bottom-note {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 2px;
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .bottom-note-icon {
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: #166534;
          background: #f0fdf4;
        }

        .bottom-note strong {
          display: block;
          margin-bottom: 3px;
          color: #334155;
          font-size: 12px;
        }

        .bottom-note span {
          display: block;
          color: #64748b;
          font-size: 11px;
          line-height: 1.55;
        }

        .state-box {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 40px;
          color: #64748b;
          font-size: 13px;
          text-align: center;
        }

        .spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #e2e8f0;
          border-top-color: #166534;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .spin {
          animation: spin 0.8s linear infinite;
        }

        .error-icon {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          color: #991b1b;
          background: #fef2f2;
        }

        .error-title {
          color: #991b1b;
          font-size: 15px;
          font-weight: 700;
        }

        .error-message {
          max-width: 600px;
          color: #64748b;
          line-height: 1.55;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1350px) {
          .stats-grid {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }

          .metadata-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .metadata-grid > div:nth-child(2) {
            border-right: 0;
          }

          .metadata-grid > div:nth-child(-n + 2) {
            border-bottom: 1px solid #eef2f7;
          }
        }

        @media (max-width: 1000px) {
          .two-column-grid {
            grid-template-columns: 1fr;
          }

          .two-column-grid .content-card {
            margin-bottom: 16px;
          }
        }

        @media (max-width: 700px) {
          .hero-card {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero-actions {
            width: 100%;
          }

          .hero-actions .secondary-button {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .info-item {
            border-right: 0 !important;
            border-bottom: 1px solid #eef2f7 !important;
          }

          .info-item:last-child {
            border-bottom: 0 !important;
          }

          .metadata-grid {
            grid-template-columns: 1fr;
          }

          .metadata-grid > div {
            border-right: 0;
            border-bottom: 1px solid #eef2f7;
          }

          .metadata-grid > div:last-child {
            border-bottom: 0;
          }
        }

        @media (max-width: 520px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .page-title {
            font-size: 25px;
          }

          .po-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AppShell>
  );
}