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

type Batch = {
  id: string;
  company_id: string;
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
  notes: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  unit_cost: number | null;
  landed_cost_total: number | null;
  refurbishment_cost_total: number | null;
  other_cost_total: number | null;
  total_cost: number | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  tracking_mode: string | null;
};

type Variant = {
  id: string;
  name: string | null;
  sku: string | null;
  barcode: string | null;
  cost_price: number | null;
  selling_price: number | null;
};

type Supplier = {
  id: string;
  supplier_number: string | null;
  legal_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
};

type PurchaseOrder = {
  id: string;
  po_number: string | null;
  status: string | null;
  order_date: string | null;
  expected_date: string | null;
  warehouse_id: string | null;
  total_amount: number | null;
};

type StockReceipt = {
  id: string;
  receipt_number: string | null;
  supplier_name: string | null;
  reference_number: string | null;
  status: string | null;
  received_at: string | null;
  purchase_order_id: string | null;
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
  location_type: string | null;
};

type BatchStock = {
  id: string;
  warehouse_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
};

type SerializedUnit = {
  id: string;
  serial_number: string;
  barcode: string | null;
  status: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  invoice_id: string | null;
  cost_price: number | null;
  warranty_start: string | null;
  warranty_end: string | null;
  received_at: string | null;
  sold_at: string | null;
  returned_at: string | null;
  disposed_at: string | null;
  notes: string | null;
};

type Movement = {
  id: string;
  movement_type: string;
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  batch_id: string | null;
  batch_stock_id: string | null;
  unit_id: string | null;
  transaction_id: string | null;
  created_at: string;
};

type Order = {
  id: string;
  order_number: string | null;
  customer_id: string | null;
};

type Customer = {
  id: string;
  name: string | null;
  company_name: string | null;
};

type Tab =
  | "overview"
  | "stock"
  | "serials"
  | "movements";

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

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(status: string | null) {
  switch (status) {
    case "active":
    case "available":
      return "status success";

    case "reserved":
      return "status blue";

    case "returned":
      return "status green";

    case "repair":
    case "rma":
      return "status orange";

    case "quarantined":
      return "status yellow";

    case "damaged":
    case "cancelled":
      return "status red";

    case "depleted":
    case "closed":
    case "sold":
    case "disposed":
      return "status muted";

    default:
      return "status";
  }
}

function titleCase(value: string | null) {
  if (!value) return "Unknown";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

export default function InventoryBatchDetailPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();

  const batchId = String(params?.batchId || "");

  const [batch, setBatch] =
    useState<Batch | null>(null);

  const [product, setProduct] =
    useState<Product | null>(null);

  const [variant, setVariant] =
    useState<Variant | null>(null);

  const [supplier, setSupplier] =
    useState<Supplier | null>(null);

  const [purchaseOrder, setPurchaseOrder] =
    useState<PurchaseOrder | null>(null);

  const [stockReceipt, setStockReceipt] =
    useState<StockReceipt | null>(null);

  const [batchStock, setBatchStock] =
    useState<BatchStock[]>([]);

  const [warehouses, setWarehouses] = useState<
    Warehouse[]
  >([]);

  const [locations, setLocations] = useState<
    Location[]
  >([]);

  const [serializedUnits, setSerializedUnits] =
    useState<SerializedUnit[]>([]);

  const [movements, setMovements] =
    useState<Movement[]>([]);

  const [orders, setOrders] = useState<Order[]>(
    [],
  );

  const [customers, setCustomers] = useState<
    Customer[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [activeTab, setActiveTab] =
    useState<Tab>("overview");

  const [serialSearch, setSerialSearch] =
    useState("");

  const [movementSearch, setMovementSearch] =
    useState("");

  const loadData = useCallback(
    async (refresh = false) => {
      try {
        if (!batchId) {
          throw new Error(
            "No inventory batch was specified.",
          );
        }

        if (refresh) {
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
          throw new Error(
            "You are not authenticated.",
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
          throw new Error(
            membershipError.message,
          );
        }

        if (!membership?.company_id) {
          throw new Error(
            "No active company was found.",
          );
        }

        const companyId =
          membership.company_id;

        const batchResult = await supabase
          .from("inventory_batches")
          .select(
            `
              id,
              company_id,
              product_id,
              variant_id,
              lot_number,
              supplier_id,
              purchase_order_id,
              purchase_order_item_id,
              stock_receipt_id,
              stock_receipt_item_id,
              received_at,
              quantity_received,
              notes,
              status,
              created_by,
              created_at,
              updated_at,
              unit_cost,
              landed_cost_total,
              refurbishment_cost_total,
              other_cost_total,
              total_cost
            `,
          )
          .eq("company_id", companyId)
          .eq("id", batchId)
          .maybeSingle();

        if (batchResult.error) {
          throw new Error(
            batchResult.error.message,
          );
        }

        if (!batchResult.data) {
          throw new Error(
            "The requested batch could not be found.",
          );
        }

        const currentBatch =
          batchResult.data as Batch;

        setBatch(currentBatch);

        const [
          productResult,
          variantResult,
          supplierResult,
          purchaseOrderResult,
          stockReceiptResult,
          stockResult,
          warehouseResult,
          locationResult,
          serialResult,
          movementResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id,name,brand,category,tracking_mode",
            )
            .eq("company_id", companyId)
            .eq(
              "id",
              currentBatch.product_id,
            )
            .maybeSingle(),

          currentBatch.variant_id
            ? supabase
                .from("product_variants")
                .select(
                  "id,name,sku,barcode,cost_price,selling_price",
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .eq(
                  "id",
                  currentBatch.variant_id,
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          currentBatch.supplier_id
            ? supabase
                .from("suppliers")
                .select(
                  "id,supplier_number,legal_name,display_name,email,phone",
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .eq(
                  "id",
                  currentBatch.supplier_id,
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          currentBatch.purchase_order_id
            ? supabase
                .from("purchase_orders")
                .select(
                  "id,po_number,status,order_date,expected_date,warehouse_id,total_amount",
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .eq(
                  "id",
                  currentBatch.purchase_order_id,
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          currentBatch.stock_receipt_id
            ? supabase
                .from("stock_receipts")
                .select(
                  "id,receipt_number,supplier_name,reference_number,status,received_at,purchase_order_id",
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .eq(
                  "id",
                  currentBatch.stock_receipt_id,
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          supabase
            .from("inventory_batch_stock")
            .select(
              "id,warehouse_id,location_id,quantity,reserved_quantity",
            )
            .eq("company_id", companyId)
            .eq("batch_id", batchId)
            .order("created_at"),

          supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("warehouse_locations")
            .select(
              "id,warehouse_id,name,code,location_type",
            )
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("serialized_units")
            .select(
              `
                id,
                serial_number,
                barcode,
                status,
                warehouse_id,
                location_id,
                customer_id,
                order_id,
                invoice_id,
                cost_price,
                warranty_start,
                warranty_end,
                received_at,
                sold_at,
                returned_at,
                disposed_at,
                notes
              `,
            )
            .eq("company_id", companyId)
            .eq("batch_id", batchId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("inventory_movements")
            .select(
              `
                id,
                movement_type,
                quantity,
                quantity_before,
                quantity_after,
                reason,
                reference_type,
                reference_id,
                notes,
                warehouse_id,
                location_id,
                batch_id,
                batch_stock_id,
                unit_id,
                transaction_id,
                created_at
              `,
            )
            .eq("company_id", companyId)
            .eq("batch_id", batchId)
            .order("created_at", {
              ascending: false,
            })
            .limit(500),
        ]);

        const errors = [
          productResult.error,
          variantResult.error,
          supplierResult.error,
          purchaseOrderResult.error,
          stockReceiptResult.error,
          stockResult.error,
          warehouseResult.error,
          locationResult.error,
          serialResult.error,
          movementResult.error,
        ].filter(Boolean);

        if (errors.length > 0) {
          throw new Error(
            errors[0]?.message ||
              "Failed to load batch details.",
          );
        }

        setProduct(
          (productResult.data as Product) ||
            null,
        );

        setVariant(
          (variantResult.data as Variant) ||
            null,
        );

        setSupplier(
          (supplierResult.data as Supplier) ||
            null,
        );

        setPurchaseOrder(
          (purchaseOrderResult.data as PurchaseOrder) ||
            null,
        );

        setStockReceipt(
          (stockReceiptResult.data as StockReceipt) ||
            null,
        );

        setBatchStock(
          (stockResult.data as BatchStock[]) ||
            [],
        );

        setWarehouses(
          (warehouseResult.data as Warehouse[]) ||
            [],
        );

        setLocations(
          (locationResult.data as Location[]) ||
            [],
        );

        setSerializedUnits(
          (serialResult.data as SerializedUnit[]) ||
            [],
        );

        setMovements(
          (movementResult.data as Movement[]) ||
            [],
        );

        const orderIds = Array.from(
          new Set(
            (serialResult.data ?? [])
              .map(
                (unit: SerializedUnit) =>
                  unit.order_id,
              )
              .filter(
                (id): id is string =>
                  Boolean(id),
              ),
          ),
        );

        const customerIds = Array.from(
          new Set(
            (serialResult.data ?? [])
              .map(
                (unit: SerializedUnit) =>
                  unit.customer_id,
              )
              .filter(
                (id): id is string =>
                  Boolean(id),
              ),
          ),
        );

        const [ordersResult, customersResult] =
          await Promise.all([
            orderIds.length
              ? supabase
                  .from("orders")
                  .select(
                    "id,order_number,customer_id",
                  )
                  .eq(
                    "company_id",
                    companyId,
                  )
                  .in("id", orderIds)
              : Promise.resolve({
                  data: [],
                  error: null,
                }),

            customerIds.length
              ? supabase
                  .from("customers")
                  .select(
                    "id,name,company_name",
                  )
                  .eq(
                    "company_id",
                    companyId,
                  )
                  .in(
                    "id",
                    customerIds,
                  )
              : Promise.resolve({
                  data: [],
                  error: null,
                }),
          ]);

        if (ordersResult.error) {
          throw new Error(
            ordersResult.error.message,
          );
        }

        if (customersResult.error) {
          throw new Error(
            customersResult.error.message,
          );
        }

        setOrders(
          (ordersResult.data as Order[]) ||
            [],
        );

        setCustomers(
          (customersResult.data as Customer[]) ||
            [],
        );
      } catch (error) {
        console.error(
          "BATCH DETAIL ERROR:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load batch details.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [batchId, supabase],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData]);

  const warehouseMap = useMemo(() => {
    const map = new Map<string, Warehouse>();

    warehouses.forEach((warehouse) =>
      map.set(warehouse.id, warehouse),
    );

    return map;
  }, [warehouses]);

  const locationMap = useMemo(() => {
    const map = new Map<string, Location>();

    locations.forEach((location) =>
      map.set(location.id, location),
    );

    return map;
  }, [locations]);

  const orderMap = useMemo(() => {
    const map = new Map<string, Order>();

    orders.forEach((order) =>
      map.set(order.id, order),
    );

    return map;
  }, [orders]);

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();

    customers.forEach((customer) =>
      map.set(customer.id, customer),
    );

    return map;
  }, [customers]);

  const totals = useMemo(() => {
    const quantity = batchStock.reduce(
      (sum, row) =>
        sum + Number(row.quantity || 0),
      0,
    );

    const reserved = batchStock.reduce(
      (sum, row) =>
        sum +
        Number(row.reserved_quantity || 0),
      0,
    );

    const available = Math.max(
      0,
      quantity - reserved,
    );

    const unitCost = Number(
      batch?.unit_cost || 0,
    );

    const currentValue =
      quantity * unitCost;

    const receivedValue =
      Number(batch?.total_cost || 0);

    const soldUnits =
      serializedUnits.filter(
        (unit) => unit.status === "sold",
      ).length;

    const availableUnits =
      serializedUnits.filter(
        (unit) => unit.status === "available",
      ).length;

    return {
      quantity,
      reserved,
      available,
      unitCost,
      currentValue,
      receivedValue,
      soldUnits,
      availableUnits,
    };
  }, [batch, batchStock, serializedUnits]);

  const filteredSerials = useMemo(() => {
    const query = serialSearch
      .trim()
      .toLowerCase();

    if (!query) {
      return serializedUnits;
    }

    return serializedUnits.filter((unit) =>
      [
        unit.serial_number,
        unit.barcode,
        unit.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [serialSearch, serializedUnits]);

  const filteredMovements = useMemo(() => {
    const query = movementSearch
      .trim()
      .toLowerCase();

    if (!query) {
      return movements;
    }

    return movements.filter((movement) =>
      [
        movement.movement_type,
        movement.reason,
        movement.reference_type,
        movement.reference_id,
        movement.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [movementSearch, movements]);

  if (loading) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="loading-state">
            <div className="spinner" />
            <p>
              Loading batch workspace...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (errorMessage || !batch) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="error-card">
            <div className="error-icon">
              !
            </div>

            <div className="error-copy">
              <h2>
                Unable to open batch
              </h2>

              <p>
                {errorMessage ||
                  "The requested batch could not be found."}
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                void loadData()
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
      <div className="page-content batch-detail-page">
        <style jsx>{`
          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 20px;
          }

          .header-left {
            min-width: 0;
          }

          .back-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 13px;
            padding: 0;
            border: 0;
            background: transparent;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }

          .back-link:hover {
            color: #166534;
          }

          .eyebrow {
            margin-bottom: 7px;
            color: #64748b;
            font-size: 11px;
            font-weight: 750;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .title-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
          }

          .page-title {
            margin: 0;
            color: #0f172a;
            font-size: 28px;
            line-height: 1.15;
            font-weight: 750;
            letter-spacing: -0.025em;
          }

          .lot-pill {
            display: inline-flex;
            align-items: center;
            min-height: 28px;
            padding: 0 9px;
            border: 1px solid #dcfce7;
            border-radius: 999px;
            background: #f0fdf4;
            color: #166534;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            font-weight: 750;
          }

          .subtitle {
            margin: 7px 0 0;
            color: #64748b;
            font-size: 13px;
          }

          .header-actions {
            display: flex;
            gap: 8px;
            flex-shrink: 0;
          }

          .secondary-button,
          .primary-button {
            min-height: 40px;
            padding: 0 14px;
            border-radius: 9px;
            font-size: 12px;
            font-weight: 750;
            cursor: pointer;
          }

          .secondary-button {
            border: 1px solid #dbe1e8;
            background: #fff;
            color: #334155;
          }

          .secondary-button:hover {
            background: #f8fafc;
          }

          .primary-button {
            border: 1px solid #166534;
            background: #166534;
            color: #fff;
          }

          .primary-button:hover {
            background: #14532d;
          }

          .hero-card {
            display: grid;
            grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
            gap: 0;
            margin-bottom: 18px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #fff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
            overflow: hidden;
          }

          .hero-main {
            padding: 20px;
            border-right: 1px solid #eef0f3;
          }

          .product-name {
            margin: 0;
            color: #0f172a;
            font-size: 17px;
            font-weight: 750;
          }

          .product-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
            margin-top: 7px;
          }

          .meta-pill {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            padding: 0 8px;
            border-radius: 7px;
            background: #f1f5f9;
            color: #64748b;
            font-size: 10px;
            font-weight: 700;
          }

          .hero-source {
            padding: 20px;
            background: #fafafa;
          }

          .source-label {
            color: #94a3b8;
            font-size: 10px;
            font-weight: 750;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .source-value {
            margin-top: 5px;
            color: #0f172a;
            font-size: 14px;
            font-weight: 750;
          }

          .source-detail {
            margin-top: 3px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 18px;
          }

          .stat-card {
            padding: 15px 16px;
            border: 1px solid #e5e7eb;
            border-radius: 13px;
            background: #fff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          }

          .stat-label {
            color: #64748b;
            font-size: 10px;
            font-weight: 700;
          }

          .stat-value {
            margin-top: 7px;
            color: #0f172a;
            font-size: 22px;
            font-weight: 750;
          }

          .stat-detail {
            margin-top: 4px;
            color: #94a3b8;
            font-size: 10px;
          }

          .tabs-card {
            margin-bottom: 18px;
            border: 1px solid #e5e7eb;
            border-radius: 13px;
            background: #fff;
            overflow: hidden;
          }

          .tabs {
            display: flex;
            gap: 2px;
            padding: 6px;
            overflow-x: auto;
          }

          .tab {
            min-height: 38px;
            padding: 0 13px;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: #64748b;
            font-size: 12px;
            font-weight: 750;
            white-space: nowrap;
            cursor: pointer;
          }

          .tab:hover {
            background: #f8fafc;
          }

          .tab.active {
            background: #f0fdf4;
            color: #166534;
          }

          .content-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
            gap: 16px;
          }

          .card {
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #fff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
            overflow: hidden;
          }

          .card + .card {
            margin-top: 16px;
          }

          .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 16px 18px;
            border-bottom: 1px solid #eef0f3;
          }

          .card-header h2 {
            margin: 0;
            color: #0f172a;
            font-size: 15px;
            font-weight: 750;
          }

          .card-header p {
            margin: 4px 0 0;
            color: #94a3b8;
            font-size: 11px;
          }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .info-item {
            padding: 14px 17px;
            border-bottom: 1px solid #f1f5f9;
          }

          .info-item:nth-child(odd) {
            border-right: 1px solid #f1f5f9;
          }

          .info-label {
            color: #94a3b8;
            font-size: 10px;
            font-weight: 750;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }

          .info-value {
            margin-top: 5px;
            color: #334155;
            font-size: 12px;
            font-weight: 650;
            line-height: 1.5;
          }

          .cost-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            padding: 11px 17px;
            border-bottom: 1px solid #f1f5f9;
            color: #64748b;
            font-size: 12px;
          }

          .cost-row strong {
            color: #334155;
            font-weight: 750;
          }

          .cost-row.total {
            background: #f8fafc;
            color: #0f172a;
          }

          .trace-card {
            padding: 18px;
          }

          .trace-line {
            position: relative;
            padding-left: 28px;
          }

          .trace-line::before {
            content: "";
            position: absolute;
            left: 7px;
            top: 9px;
            bottom: 9px;
            width: 1px;
            background: #dbe1e8;
          }

          .trace-item {
            position: relative;
            padding-bottom: 21px;
          }

          .trace-item:last-child {
            padding-bottom: 0;
          }

          .trace-dot {
            position: absolute;
            left: -27px;
            top: 3px;
            width: 15px;
            height: 15px;
            border: 3px solid #fff;
            border-radius: 50%;
            background: #16a34a;
            box-shadow: 0 0 0 1px #bbf7d0;
          }

          .trace-title {
            color: #0f172a;
            font-size: 12px;
            font-weight: 750;
          }

          .trace-detail {
            margin-top: 3px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.55;
          }

          .search-input {
            width: 260px;
            height: 38px;
            padding: 0 11px;
            border: 1px solid #dbe1e8;
            border-radius: 8px;
            outline: none;
            color: #334155;
            font-size: 12px;
          }

          .search-input:focus {
            border-color: #86efac;
            box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
          }

          .table-wrap {
            width: 100%;
            overflow-x: auto;
          }

          table {
            width: 100%;
            min-width: 980px;
            border-collapse: collapse;
          }

          th {
            padding: 10px 15px;
            background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
            color: #64748b;
            font-size: 10px;
            font-weight: 750;
            text-align: left;
            white-space: nowrap;
          }

          td {
            padding: 12px 15px;
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
            font-size: 12px;
            vertical-align: middle;
          }

          tbody tr:hover {
            background: #fafafa;
          }

          tbody tr:last-child td {
            border-bottom: 0;
          }

          .primary-text {
            color: #0f172a;
            font-weight: 700;
          }

          .secondary-text {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
          }

          .mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
          }

          .status {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            padding: 0 8px;
            border-radius: 999px;
            background: #f1f5f9;
            color: #64748b;
            font-size: 10px;
            font-weight: 750;
            text-transform: capitalize;
          }

          .status.success {
            background: #ecfdf5;
            color: #15803d;
          }

          .status.green {
            background: #f0fdf4;
            color: #166534;
          }

          .status.blue {
            background: #eff6ff;
            color: #2563eb;
          }

          .status.orange {
            background: #fff7ed;
            color: #c2410c;
          }

          .status.yellow {
            background: #fffbeb;
            color: #b45309;
          }

          .status.red {
            background: #fef2f2;
            color: #dc2626;
          }

          .status.muted {
            background: #f8fafc;
            color: #64748b;
          }

          .allocation-card {
            padding: 18px;
          }

          .allocation-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 15px;
            padding: 13px 0;
            border-bottom: 1px solid #f1f5f9;
          }

          .allocation-row:last-child {
            border-bottom: 0;
          }

          .allocation-main {
            min-width: 0;
          }

          .allocation-title {
            color: #0f172a;
            font-size: 12px;
            font-weight: 750;
          }

          .allocation-subtitle {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
          }

          .allocation-values {
            flex-shrink: 0;
            text-align: right;
          }

          .allocation-available {
            color: #15803d;
            font-size: 13px;
            font-weight: 750;
          }

          .allocation-reserved {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
          }

          .empty-state {
            padding: 50px 20px;
            text-align: center;
          }

          .empty-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 47px;
            height: 47px;
            margin: 0 auto 12px;
            border-radius: 12px;
            background: #f1f5f9;
            color: #64748b;
            font-size: 20px;
          }

          .empty-state h3 {
            margin: 0;
            color: #0f172a;
            font-size: 15px;
          }

          .empty-state p {
            max-width: 470px;
            margin: 6px auto 0;
            color: #94a3b8;
            font-size: 12px;
            line-height: 1.6;
          }

          .loading-state {
            min-height: 450px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            color: #64748b;
          }

          .spinner {
            width: 28px;
            height: 28px;
            border: 3px solid #e2e8f0;
            border-top-color: #166534;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
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

          .error-copy {
            flex: 1;
          }

          .error-copy h2 {
            margin: 0;
            color: #0f172a;
            font-size: 15px;
          }

          .error-copy p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 12px;
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

          @media (max-width: 1000px) {
            .hero-card,
            .content-grid {
              grid-template-columns: 1fr;
            }

            .hero-main {
              border-right: 0;
              border-bottom: 1px solid #eef0f3;
            }

            .page-header {
              flex-direction: column;
            }

            .header-actions {
              width: 100%;
            }

            .header-actions button {
              flex: 1;
            }
          }

          @media (max-width: 650px) {
            .stats-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .info-grid {
              grid-template-columns: 1fr;
            }

            .info-item:nth-child(odd) {
              border-right: 0;
            }

            .search-input {
              width: 100%;
            }
          }
        `}</style>

        <div className="page-header">
          <div className="header-left">
            <button
              type="button"
              className="back-link"
              onClick={() => {
                if (batch.product_id) {
                  router.push(
                    `/inventory/${batch.product_id}`,
                  );
                } else {
                  router.push("/inventory");
                }
              }}
            >
              ← Back to Product Inventory
            </button>

            <div className="eyebrow">
              Inventory Batch / Lot
            </div>

            <div className="title-row">
              <h1 className="page-title">
                {batch.lot_number}
              </h1>

              <span className="lot-pill">
                {batch.lot_number}
              </span>
            </div>

            <p className="subtitle">
              Complete batch provenance, stock
              position, cost basis, units, and
              movement history.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void loadData(true)
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
                  "/inventory/movements",
                )
              }
            >
              View Inventory Movements
            </button>
          </div>
        </div>

        <section className="hero-card">
          <div className="hero-main">
            <h2 className="product-name">
              {product?.name ||
                "Inventory Product"}
            </h2>

            <div className="product-meta">
              {variant?.name && (
                <span className="meta-pill">
                  {variant.name}
                </span>
              )}

              {variant?.sku && (
                <span className="meta-pill">
                  SKU {variant.sku}
                </span>
              )}

              {product?.tracking_mode && (
                <span className="meta-pill">
                  {titleCase(
                    product.tracking_mode,
                  )}{" "}
                  Tracking
                </span>
              )}

              <span
                className={statusClass(
                  batch.status,
                )}
              >
                {titleCase(batch.status)}
              </span>
            </div>
          </div>

          <div className="hero-source">
            <div className="source-label">
              Received
            </div>

            <div className="source-value">
              {formatDate(
                batch.received_at,
              )}
            </div>

            <div className="source-detail">
              {stockReceipt?.receipt_number
                ? `Goods Receipt ${stockReceipt.receipt_number}`
                : "No goods receipt linked"}
              {" · "}
              {purchaseOrder?.po_number
                ? `PO ${purchaseOrder.po_number}`
                : "No purchase order linked"}
            </div>
          </div>
        </section>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Quantity Received
            </div>

            <div className="stat-value">
              {formatNumber(
                Number(
                  batch.quantity_received || 0,
                ),
              )}
            </div>

            <div className="stat-detail">
              Original batch quantity
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Current Stock
            </div>

            <div className="stat-value">
              {formatNumber(
                totals.quantity,
              )}
            </div>

            <div className="stat-detail">
              Across all locations
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Available
            </div>

            <div className="stat-value">
              {formatNumber(
                totals.available,
              )}
            </div>

            <div className="stat-detail">
              Not reserved
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Reserved
            </div>

            <div className="stat-value">
              {formatNumber(
                totals.reserved,
              )}
            </div>

            <div className="stat-detail">
              Held inventory
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Unit Cost
            </div>

            <div className="stat-value">
              {formatMoney(
                totals.unitCost,
              )}
            </div>

            <div className="stat-detail">
              Batch cost basis
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Current Value
            </div>

            <div className="stat-value">
              {formatMoney(
                totals.currentValue,
              )}
            </div>

            <div className="stat-detail">
              Based on current stock
            </div>
          </div>
        </div>

        <section className="tabs-card">
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
              Warehouse Stock
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
              Individual Units
              {serializedUnits.length > 0 && (
                <> ({serializedUnits.length})</>
              )}
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
              Movement History
              {movements.length > 0 && (
                <> ({movements.length})</>
              )}
            </button>
          </div>
        </section>

        {activeTab === "overview" && (
          <div className="content-grid">
            <div>
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Batch Information
                    </h2>

                    <p>
                      The immutable receiving and
                      cost identity for this lot.
                    </p>
                  </div>
                </div>

                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">
                      Lot Number
                    </div>

                    <div className="info-value mono">
                      {batch.lot_number}
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Status
                    </div>

                    <div className="info-value">
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
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Product
                    </div>

                    <div className="info-value">
                      {product?.name ||
                        "—"}
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Variant
                    </div>

                    <div className="info-value">
                      {variant?.name ||
                        "Default / None"}
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      SKU
                    </div>

                    <div className="info-value mono">
                      {variant?.sku || "—"}
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Received
                    </div>

                    <div className="info-value">
                      {formatDate(
                        batch.received_at,
                      )}
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Quantity Received
                    </div>

                    <div className="info-value">
                      {formatNumber(
                        Number(
                          batch.quantity_received ||
                            0,
                        ),
                      )}
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Created
                    </div>

                    <div className="info-value">
                      {formatDateTime(
                        batch.created_at,
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Source Documents
                    </h2>

                    <p>
                      Procurement and receiving
                      lineage for this batch.
                    </p>
                  </div>
                </div>

                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">
                      Supplier
                    </div>

                    <div className="info-value">
                      {supplier?.display_name ||
                        supplier?.legal_name ||
                        "Not linked"}
                    </div>

                    {supplier?.supplier_number && (
                      <div className="secondary-text">
                        {
                          supplier.supplier_number
                        }
                      </div>
                    )}
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Purchase Order
                    </div>

                    <div className="info-value">
                      {purchaseOrder?.po_number ||
                        "Not linked"}
                    </div>

                    {purchaseOrder?.status && (
                      <div className="secondary-text">
                        Status:{" "}
                        {titleCase(
                          purchaseOrder.status,
                        )}
                      </div>
                    )}
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Goods Receipt
                    </div>

                    <div className="info-value">
                      {stockReceipt?.receipt_number ||
                        "Not linked"}
                    </div>

                    {stockReceipt?.received_at && (
                      <div className="secondary-text">
                        Received{" "}
                        {formatDate(
                          stockReceipt.received_at,
                        )}
                      </div>
                    )}
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Supplier Reference
                    </div>

                    <div className="info-value">
                      {stockReceipt?.reference_number ||
                        "—"}
                    </div>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Traceability Chain
                    </h2>

                    <p>
                      Follow this inventory lot from
                      procurement to customer.
                    </p>
                  </div>
                </div>

                <div className="trace-card">
                  <div className="trace-line">
                    <div className="trace-item">
                      <span className="trace-dot" />
                      <div className="trace-title">
                        Supplier
                      </div>

                      <div className="trace-detail">
                        {supplier?.display_name ||
                          supplier?.legal_name ||
                          "Supplier not linked"}
                      </div>
                    </div>

                    <div className="trace-item">
                      <span className="trace-dot" />

                      <div className="trace-title">
                        Purchase Order
                      </div>

                      <div className="trace-detail">
                        {purchaseOrder?.po_number ||
                          "Purchase order not linked"}
                      </div>
                    </div>

                    <div className="trace-item">
                      <span className="trace-dot" />

                      <div className="trace-title">
                        Goods Receipt
                      </div>

                      <div className="trace-detail">
                        {stockReceipt?.receipt_number ||
                          "Goods receipt not linked"}
                      </div>
                    </div>

                    <div className="trace-item">
                      <span className="trace-dot" />

                      <div className="trace-title">
                        Batch / Lot
                      </div>

                      <div className="trace-detail">
                        {batch.lot_number}
                      </div>
                    </div>

                    <div className="trace-item">
                      <span className="trace-dot" />

                      <div className="trace-title">
                        Warehouse Stock
                      </div>

                      <div className="trace-detail">
                        {batchStock.length} stock
                        position
                        {batchStock.length ===
                        1
                          ? ""
                          : "s"} across{" "}
                        {
                          new Set(
                            batchStock.map(
                              (row) =>
                                row.warehouse_id,
                            ),
                          ).size
                        }{" "}
                        warehouse
                        {new Set(
                          batchStock.map(
                            (row) => row.warehouse_id,
                          ),
                        ).size === 1
                          ? ""
                          : "s"}.
                      </div>
                    </div>

                    <div className="trace-item">
                      <span className="trace-dot" />

                      <div className="trace-title">
                        Individual Units
                      </div>

                      <div className="trace-detail">
                        {serializedUnits.length >
                        0
                          ? `${serializedUnits.length} manufacturer serial unit${
                              serializedUnits.length ===
                              1
                                ? ""
                                : "s"
                            } tracked`
                          : "No serialized units are attached to this batch."}
                      </div>
                    </div>

                    <div className="trace-item">
                      <span className="trace-dot" />

                      <div className="trace-title">
                        Movement Ledger
                      </div>

                      <div className="trace-detail">
                        {movements.length} movement
                        {movements.length ===
                        1
                          ? ""
                          : "s"}{" "}
                        recorded for this lot.
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div>
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Cost Breakdown
                    </h2>

                    <p>
                      Actual batch cost components.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="cost-row">
                    <span>
                      Base Unit Cost
                    </span>

                    <strong>
                      {formatMoney(
                        Number(
                          batch.unit_cost ||
                            0,
                        ),
                      )}
                    </strong>
                  </div>

                  <div className="cost-row">
                    <span>
                      Landed Costs
                    </span>

                    <strong>
                      {formatMoney(
                        Number(
                          batch.landed_cost_total ||
                            0,
                        ),
                      )}
                    </strong>
                  </div>

                  <div className="cost-row">
                    <span>
                      Refurbishment
                    </span>

                    <strong>
                      {formatMoney(
                        Number(
                          batch.refurbishment_cost_total ||
                            0,
                        ),
                      )}
                    </strong>
                  </div>

                  <div className="cost-row">
                    <span>
                      Other Costs
                    </span>

                    <strong>
                      {formatMoney(
                        Number(
                          batch.other_cost_total ||
                            0,
                        ),
                      )}
                    </strong>
                  </div>

                  <div className="cost-row total">
                    <span>
                      Total Batch Cost
                    </span>

                    <strong>
                      {formatMoney(
                        Number(
                          batch.total_cost ||
                            0,
                        ),
                      )}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Unit Position
                    </h2>

                    <p>
                      Current lifecycle position of
                      this lot.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="cost-row">
                    <span>
                      Current Stock
                    </span>

                    <strong>
                      {formatNumber(
                        totals.quantity,
                      )}
                    </strong>
                  </div>

                  <div className="cost-row">
                    <span>
                      Available
                    </span>

                    <strong>
                      {formatNumber(
                        totals.available,
                      )}
                    </strong>
                  </div>

                  <div className="cost-row">
                    <span>
                      Reserved
                    </span>

                    <strong>
                      {formatNumber(
                        totals.reserved,
                      )}
                    </strong>
                  </div>

                  <div className="cost-row">
                    <span>
                      Available Serial Units
                    </span>

                    <strong>
                      {formatNumber(
                        totals.availableUnits,
                      )}
                    </strong>
                  </div>

                  <div className="cost-row">
                    <span>
                      Sold Serial Units
                    </span>

                    <strong>
                      {formatNumber(
                        totals.soldUnits,
                      )}
                    </strong>
                  </div>
                </div>
              </section>

              {batch.notes && (
                <section className="card">
                  <div className="card-header">
                    <div>
                      <h2>Batch Notes</h2>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "17px 18px",
                      color: "#64748b",
                      fontSize: 12,
                      lineHeight: 1.7,
                    }}
                  >
                    {batch.notes}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {activeTab === "stock" && (
          <section className="card">
            <div className="card-header">
              <div>
                <h2>
                  Warehouse & Location Stock
                </h2>

                <p>
                  Exact physical stock positions
                  for this batch.
                </p>
              </div>
            </div>

            {batchStock.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  □
                </div>

                <h3>
                  No stock positions
                </h3>

                <p>
                  This batch currently has no
                  warehouse/location stock rows.
                </p>
              </div>
            ) : (
              <div className="allocation-card">
                {batchStock.map((row) => {
                  const warehouse =
                    warehouseMap.get(
                      row.warehouse_id,
                    );

                  const location =
                    locationMap.get(
                      row.location_id,
                    );

                  const available =
                    Math.max(
                      0,
                      Number(row.quantity || 0) -
                        Number(
                          row.reserved_quantity ||
                            0,
                        ),
                    );

                  return (
                    <div
                      key={row.id}
                      className="allocation-row"
                    >
                      <div className="allocation-main">
                        <div className="allocation-title">
                          {warehouse?.name ||
                            "Unknown Warehouse"}
                        </div>

                        <div className="allocation-subtitle">
                          {warehouse?.code
                            ? `${warehouse.code} · `
                            : ""}
                          {location?.name ||
                            "Unknown Location"}
                          {location?.code
                            ? ` (${location.code})`
                            : ""}
                        </div>
                      </div>

                      <div className="allocation-values">
                        <div className="allocation-available">
                          {formatNumber(
                            available,
                          )}{" "}
                          available
                        </div>

                        <div className="allocation-reserved">
                          {formatNumber(
                            Number(
                              row.reserved_quantity ||
                                0,
                            ),
                          )}{" "}
                          reserved ·{" "}
                          {formatNumber(
                            Number(
                              row.quantity || 0,
                            ),
                          )}{" "}
                          total
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "serials" && (
          <section className="card">
            <div className="card-header">
              <div>
                <h2>
                  Individual Units
                </h2>

                <p>
                  Actual manufacturer serial
                  numbers belonging to this batch.
                </p>
              </div>

              <input
                className="search-input"
                type="search"
                value={serialSearch}
                onChange={(event) =>
                  setSerialSearch(
                    event.target.value,
                  )
                }
                placeholder="Search serial..."
              />
            </div>

            {serializedUnits.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  #
                </div>

                <h3>
                  No serialized units
                </h3>

                <p>
                  This batch does not currently
                  contain individual manufacturer
                  serial units.
                </p>
              </div>
            ) : filteredSerials.length ===
              0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  #
                </div>

                <h3>
                  No matching serials
                </h3>

                <p>
                  No serialized units matched
                  your search.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Manufacturer Serial
                      </th>
                      <th>Status</th>
                      <th>Location</th>
                      <th>Cost</th>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Warranty</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSerials.map(
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

                        const order =
                          unit.order_id
                            ? orderMap.get(
                                unit.order_id,
                              )
                            : null;

                        const customer =
                          unit.customer_id
                            ? customerMap.get(
                                unit.customer_id,
                              )
                            : null;

                        return (
                          <tr key={unit.id}>
                            <td>
                              <div className="primary-text mono">
                                {
                                  unit.serial_number
                                }
                              </div>

                              {unit.barcode && (
                                <div className="secondary-text">
                                  {
                                    unit.barcode
                                  }
                                </div>
                              )}
                            </td>

                            <td>
                              <span
                                className={statusClass(
                                  unit.status,
                                )}
                              >
                                {titleCase(
                                  unit.status,
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="primary-text">
                                {warehouse?.name ||
                                  "—"}
                              </div>

                              <div className="secondary-text">
                                {location?.name ||
                                  "—"}
                              </div>
                            </td>

                            <td>
                              {formatMoney(
                                Number(
                                  unit.cost_price ||
                                    0,
                                ),
                              )}
                            </td>

                            <td>
                              {order?.order_number ||
                                "—"}
                            </td>

                            <td>
                              {customer?.company_name ||
                                customer?.name ||
                                "—"}
                            </td>

                            <td>
                              {unit.warranty_end
                                ? formatDate(
                                    unit.warranty_end,
                                  )
                                : "—"}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "movements" && (
          <section className="card">
            <div className="card-header">
              <div>
                <h2>
                  Batch Movement History
                </h2>

                <p>
                  Every stock movement involving
                  this batch.
                </p>
              </div>

              <input
                className="search-input"
                type="search"
                value={movementSearch}
                onChange={(event) =>
                  setMovementSearch(
                    event.target.value,
                  )
                }
                placeholder="Search movements..."
              />
            </div>

            {filteredMovements.length ===
            0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ⇄
                </div>

                <h3>
                  No movements recorded
                </h3>

                <p>
                  Batch movements will appear here
                  as receiving, sales, transfers,
                  adjustments, and returns occur.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Movement</th>
                      <th>Quantity</th>
                      <th>Balance</th>
                      <th>Location</th>
                      <th>Reference</th>
                      <th>Notes</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMovements.map(
                      (movement) => {
                        const warehouse =
                          movement.warehouse_id
                            ? warehouseMap.get(
                                movement.warehouse_id,
                              )
                            : null;

                        const location =
                          movement.location_id
                            ? locationMap.get(
                                movement.location_id,
                              )
                            : null;

                        return (
                          <tr
                            key={movement.id}
                          >
                            <td>
                              {formatDateTime(
                                movement.created_at,
                              )}
                            </td>

                            <td>
                              <div className="primary-text">
                                {titleCase(
                                  movement.movement_type,
                                )}
                              </div>

                              {movement.reason && (
                                <div className="secondary-text">
                                  {
                                    movement.reason
                                  }
                                </div>
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                Number(
                                  movement.quantity ||
                                    0,
                                ),
                              )}
                            </td>

                            <td>
                              <div className="secondary-text">
                                Before:{" "}
                                {movement.quantity_before !==
                                null
                                  ? formatNumber(
                                      movement.quantity_before,
                                    )
                                  : "—"}
                              </div>

                              <div className="primary-text">
                                After:{" "}
                                {movement.quantity_after !==
                                null
                                  ? formatNumber(
                                      movement.quantity_after,
                                    )
                                  : "—"}
                              </div>
                            </td>

                            <td>
                              <div className="primary-text">
                                {warehouse?.name ||
                                  "—"}
                              </div>

                              <div className="secondary-text">
                                {location?.name ||
                                  "—"}
                              </div>
                            </td>

                            <td>
                              {movement.reference_type && (
                                <div className="primary-text">
                                  {titleCase(
                                    movement.reference_type,
                                  )}
                                </div>
                              )}

                              {movement.reference_id && (
                                <div className="secondary-text mono">
                                  {
                                    movement.reference_id
                                  }
                                </div>
                              )}

                              {!movement.reference_type &&
                                !movement.reference_id &&
                                "—"}
                            </td>

                            <td>
                              {movement.notes ||
                                "—"}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}