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
  product_type: string | null;
  tracking_mode: string | null;
  status: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
  barcode: string | null;
  cost_price: number | null;
  selling_price: number | null;
  is_active: boolean | null;
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
  notes: string | null;
  status: string | null;
  unit_cost: number | null;
  landed_cost_total: number | null;
  refurbishment_cost_total: number | null;
  other_cost_total: number | null;
  total_cost: number | null;
  created_at: string | null;
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

type SerializedUnit = {
  id: string;
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
  returned_at: string | null;
  disposed_at: string | null;
  allocated_at: string | null;
  notes: string | null;
  batch_id: string | null;
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

type Movement = {
  id: string;
  product_id: string;
  variant_id: string | null;
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

type Supplier = {
  id: string;
  name: string;
};

type PurchaseOrder = {
  id: string;
  po_number: string | null;
};

type StockReceipt = {
  id: string;
  receipt_number: string | null;
};

type Order = {
  id: string;
  order_number: string | null;
};

type Customer = {
  id: string;
  name: string | null;
  company_name: string | null;
};

type Tab =
  | "overview"
  | "batches"
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

function trackingLabel(value: string | null) {
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

function movementLabel(value: string | null) {
  if (!value) return "Inventory Event";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function serialStatusClass(status: string | null) {
  switch (status) {
    case "available":
      return "status available";
    case "reserved":
      return "status reserved";
    case "sold":
      return "status sold";
    case "returned":
      return "status returned";
    case "repair":
      return "status repair";
    case "rma":
      return "status rma";
    case "damaged":
      return "status damaged";
    case "lost":
      return "status lost";
    case "disposed":
      return "status disposed";
    default:
      return "status";
  }
}

function batchStatusClass(status: string | null) {
  switch (status) {
    case "active":
      return "status active";
    case "depleted":
      return "status depleted";
    case "quarantined":
      return "status quarantined";
    case "closed":
      return "status closed";
    case "cancelled":
      return "status cancelled";
    default:
      return "status";
  }
}

export default function InventoryProductDetailPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();

  const productId = String(
    params?.productId || "",
  );

  const [companyId, setCompanyId] = useState<
    string | null
  >(null);

  const [product, setProduct] =
    useState<Product | null>(null);
  const [variants, setVariants] = useState<
    Variant[]
  >([]);
  const [batches, setBatches] = useState<Batch[]>(
    [],
  );
  const [batchStock, setBatchStock] = useState<
    BatchStock[]
  >([]);
  const [serializedUnits, setSerializedUnits] =
    useState<SerializedUnit[]>([]);
  const [warehouses, setWarehouses] = useState<
    Warehouse[]
  >([]);
  const [locations, setLocations] = useState<
    Location[]
  >([]);
  const [movements, setMovements] = useState<
    Movement[]
  >([]);

  const [suppliers, setSuppliers] = useState<
    Supplier[]
  >([]);
  const [purchaseOrders, setPurchaseOrders] =
    useState<PurchaseOrder[]>([]);
  const [stockReceipts, setStockReceipts] =
    useState<StockReceipt[]>([]);
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

  const [batchSearch, setBatchSearch] =
    useState("");
  const [serialSearch, setSerialSearch] =
    useState("");
  const [movementSearch, setMovementSearch] =
    useState("");

  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (!productId) {
          throw new Error(
            "No product was specified.",
          );
        }

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

        const currentCompanyId =
          membership.company_id;

        setCompanyId(currentCompanyId);

        const [
          productResult,
          variantsResult,
          batchesResult,
          stockResult,
          serialResult,
          warehousesResult,
          locationsResult,
          movementsResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id,name,brand,category,product_type,tracking_mode,status",
            )
            .eq("company_id", currentCompanyId)
            .eq("id", productId)
            .maybeSingle(),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,sku,barcode,cost_price,selling_price,is_active",
            )
            .eq("company_id", currentCompanyId)
            .eq("product_id", productId)
            .order("is_default", {
              ascending: false,
            }),

          supabase
            .from("inventory_batches")
            .select(
              "id,product_id,variant_id,lot_number,supplier_id,purchase_order_id,purchase_order_item_id,stock_receipt_id,stock_receipt_item_id,received_at,quantity_received,notes,status,unit_cost,landed_cost_total,refurbishment_cost_total,other_cost_total,total_cost,created_at",
            )
            .eq("company_id", currentCompanyId)
            .eq("product_id", productId)
            .order("received_at", {
              ascending: false,
              nullsFirst: false,
            }),

          supabase
            .from("inventory_batch_stock")
            .select(
              "id,batch_id,product_id,variant_id,warehouse_id,location_id,quantity,reserved_quantity",
            )
            .eq("company_id", currentCompanyId)
            .eq("product_id", productId),

          supabase
            .from("serialized_units")
            .select(
              "id,product_id,variant_id,serial_number,barcode,status,warehouse_id,location_id,customer_id,order_id,order_item_id,invoice_id,purchase_order_id,purchase_order_item_id,cost_price,warranty_start,warranty_end,received_at,sold_at,returned_at,disposed_at,allocated_at,notes,batch_id",
            )
            .eq("company_id", currentCompanyId)
            .eq("product_id", productId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", currentCompanyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("warehouse_locations")
            .select(
              "id,warehouse_id,name,code",
            )
            .eq("company_id", currentCompanyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("inventory_movements")
            .select(
              "id,product_id,variant_id,movement_type,quantity,quantity_before,quantity_after,reason,reference_type,reference_id,notes,warehouse_id,location_id,batch_id,batch_stock_id,unit_id,transaction_id,created_at",
            )
            .eq("company_id", currentCompanyId)
            .eq("product_id", productId)
            .order("created_at", {
              ascending: false,
            })
            .limit(500),
        ]);

        const errors = [
          productResult.error,
          variantsResult.error,
          batchesResult.error,
          stockResult.error,
          serialResult.error,
          warehousesResult.error,
          locationsResult.error,
          movementsResult.error,
        ].filter(Boolean);

        if (errors.length > 0) {
          throw new Error(
            errors[0]?.message ||
              "Failed to load inventory.",
          );
        }

        if (!productResult.data) {
          throw new Error(
            "The requested product could not be found.",
          );
        }

        setProduct(productResult.data);
        setVariants(variantsResult.data ?? []);
        setBatches(batchesResult.data ?? []);
        setBatchStock(stockResult.data ?? []);
        setSerializedUnits(
          serialResult.data ?? [],
        );
        setWarehouses(
          warehousesResult.data ?? [],
        );
        setLocations(
          locationsResult.data ?? [],
        );
        setMovements(
          movementsResult.data ?? [],
        );

        const supplierIds = Array.from(
          new Set(
            (batchesResult.data ?? [])
              .map((batch) => batch.supplier_id)
              .filter(
                (id): id is string => Boolean(id),
              ),
          ),
        );

        const purchaseOrderIds =
          Array.from(
            new Set(
              (batchesResult.data ?? [])
                .map(
                  (batch) =>
                    batch.purchase_order_id,
                )
                .filter(
                  (id): id is string =>
                    Boolean(id),
                ),
            ),
          );

        const receiptIds = Array.from(
          new Set(
            (batchesResult.data ?? [])
              .map(
                (batch) =>
                  batch.stock_receipt_id,
              )
              .filter(
                (id): id is string => Boolean(id),
              ),
          ),
        );

        const orderIds = Array.from(
          new Set(
            (serialResult.data ?? [])
              .map((unit) => unit.order_id)
              .filter(
                (id): id is string => Boolean(id),
              ),
          ),
        );

        const customerIds = Array.from(
          new Set(
            (serialResult.data ?? [])
              .map((unit) => unit.customer_id)
              .filter(
                (id): id is string => Boolean(id),
              ),
          ),
        );

        const [
          suppliersResult,
          purchaseOrdersResult,
          receiptsResult,
          ordersResult,
          customersResult,
        ] = await Promise.all([
          supplierIds.length
            ? supabase
                .from("suppliers")
                .select("id,name")
                .eq(
                  "company_id",
                  currentCompanyId,
                )
                .in("id", supplierIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          purchaseOrderIds.length
            ? supabase
                .from("purchase_orders")
                .select("id,po_number")
                .eq(
                  "company_id",
                  currentCompanyId,
                )
                .in(
                  "id",
                  purchaseOrderIds,
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),

          receiptIds.length
            ? supabase
                .from("stock_receipts")
                .select(
                  "id,receipt_number",
                )
                .eq(
                  "company_id",
                  currentCompanyId,
                )
                .in("id", receiptIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          orderIds.length
            ? supabase
                .from("orders")
                .select(
                  "id,order_number",
                )
                .eq(
                  "company_id",
                  currentCompanyId,
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
                  currentCompanyId,
                )
                .in("id", customerIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
        ]);

        setSuppliers(
          suppliersResult.data ?? [],
        );
        setPurchaseOrders(
          purchaseOrdersResult.data ?? [],
        );
        setStockReceipts(
          receiptsResult.data ?? [],
        );
        setOrders(ordersResult.data ?? []);
        setCustomers(
          customersResult.data ?? [],
        );
      } catch (error) {
        console.error(
          "INVENTORY PRODUCT DETAIL ERROR:",
          error,
        );

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
    [productId, supabase],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData]);

  const variantMap = useMemo(() => {
    const map = new Map<string, Variant>();

    variants.forEach((variant) =>
      map.set(variant.id, variant),
    );

    return map;
  }, [variants]);

  const batchMap = useMemo(() => {
    const map = new Map<string, Batch>();

    batches.forEach((batch) =>
      map.set(batch.id, batch),
    );

    return map;
  }, [batches]);

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

  const supplierMap = useMemo(() => {
    const map = new Map<string, Supplier>();

    suppliers.forEach((supplier) =>
      map.set(supplier.id, supplier),
    );

    return map;
  }, [suppliers]);

  const purchaseOrderMap = useMemo(() => {
    const map = new Map<
      string,
      PurchaseOrder
    >();

    purchaseOrders.forEach((po) =>
      map.set(po.id, po),
    );

    return map;
  }, [purchaseOrders]);

  const receiptMap = useMemo(() => {
    const map = new Map<
      string,
      StockReceipt
    >();

    stockReceipts.forEach((receipt) =>
      map.set(receipt.id, receipt),
    );

    return map;
  }, [stockReceipts]);

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

  const batchStockMap = useMemo(() => {
    const map = new Map<
      string,
      BatchStock[]
    >();

    batchStock.forEach((stock) => {
      const current =
        map.get(stock.batch_id) ?? [];

      current.push(stock);
      map.set(stock.batch_id, current);
    });

    return map;
  }, [batchStock]);

  const totals = useMemo(() => {
    const total = batchStock.reduce(
      (sum, row) => sum + Number(row.quantity || 0),
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
      total - reserved,
    );

    const value = batches.reduce(
      (sum, batch) => {
        const stockRows =
          batchStockMap.get(batch.id) ?? [];

        const quantity = stockRows.reduce(
          (stockSum, row) =>
            stockSum + Number(row.quantity || 0),
          0,
        );

        return (
          sum +
          quantity *
            Number(batch.unit_cost || 0)
        );
      },
      0,
    );

    const activeBatches = batches.filter(
      (batch) => batch.status === "active",
    ).length;

    const serializedCount =
      serializedUnits.length;

    const availableSerials =
      serializedUnits.filter(
        (unit) => unit.status === "available",
      ).length;

    const soldSerials = serializedUnits.filter(
      (unit) => unit.status === "sold",
    ).length;

    return {
      total,
      reserved,
      available,
      value,
      activeBatches,
      serializedCount,
      availableSerials,
      soldSerials,
    };
  }, [
    batchStock,
    batches,
    batchStockMap,
    serializedUnits,
  ]);

  const filteredBatches = useMemo(() => {
    const query = batchSearch
      .trim()
      .toLowerCase();

    return batches.filter((batch) => {
      if (!query) return true;

      const variant = batch.variant_id
        ? variantMap.get(batch.variant_id)
        : null;

      const supplier = batch.supplier_id
        ? supplierMap.get(batch.supplier_id)
        : null;

      const po = batch.purchase_order_id
        ? purchaseOrderMap.get(
            batch.purchase_order_id,
          )
        : null;

      const receipt = batch.stock_receipt_id
        ? receiptMap.get(
            batch.stock_receipt_id,
          )
        : null;

      const haystack = [
        batch.lot_number,
        batch.status,
        variant?.name,
        variant?.sku,
        supplier?.name,
        po?.po_number,
        receipt?.receipt_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [
    batches,
    batchSearch,
    variantMap,
    supplierMap,
    purchaseOrderMap,
    receiptMap,
  ]);

  const filteredSerials = useMemo(() => {
    const query = serialSearch
      .trim()
      .toLowerCase();

    return serializedUnits.filter((unit) => {
      if (!query) return true;

      const batch = unit.batch_id
        ? batchMap.get(unit.batch_id)
        : null;

      const warehouse = unit.warehouse_id
        ? warehouseMap.get(unit.warehouse_id)
        : null;

      const location = unit.location_id
        ? locationMap.get(unit.location_id)
        : null;

      const order = unit.order_id
        ? orderMap.get(unit.order_id)
        : null;

      const customer = unit.customer_id
        ? customerMap.get(unit.customer_id)
        : null;

      const haystack = [
        unit.serial_number,
        unit.barcode,
        unit.status,
        batch?.lot_number,
        warehouse?.name,
        location?.name,
        order?.order_number,
        customer?.name,
        customer?.company_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [
    serializedUnits,
    serialSearch,
    batchMap,
    warehouseMap,
    locationMap,
    orderMap,
    customerMap,
  ]);

  const filteredMovements = useMemo(() => {
    const query = movementSearch
      .trim()
      .toLowerCase();

    return movements.filter((movement) => {
      if (!query) return true;

      const batch = movement.batch_id
        ? batchMap.get(movement.batch_id)
        : null;

      const unit = movement.unit_id
        ? serializedUnits.find(
            (item) =>
              item.id === movement.unit_id,
          )
        : null;

      const haystack = [
        movement.movement_type,
        movement.reason,
        movement.reference_type,
        movement.notes,
        batch?.lot_number,
        unit?.serial_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [
    movements,
    movementSearch,
    batchMap,
    serializedUnits,
  ]);

  if (loading) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>
              Loading inventory workspace...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (errorMessage || !product) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="error-card">
            <div className="error-icon">!</div>

            <div className="error-copy">
              <h2>
                Unable to open inventory
              </h2>
              <p>
                {errorMessage ||
                  "The requested product could not be found."}
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
      <div className="page-content inventory-detail-page">
        <style jsx>{`
          .inventory-detail-page {
            min-width: 0;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 22px;
          }

          .header-left {
            min-width: 0;
          }

          .back-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 13px;
            border: 0;
            padding: 0;
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
            box-shadow: 0 0 0 4px #dcfce7;
          }

          .page-title {
            margin: 0;
            color: #0f172a;
            font-size: 29px;
            line-height: 1.15;
            font-weight: 750;
            letter-spacing: -0.025em;
          }

          .page-subtitle {
            margin: 7px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 9px;
            flex-shrink: 0;
          }

          .secondary-button,
          .primary-button {
            min-height: 40px;
            padding: 0 14px;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            background: #fff;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }

          .secondary-button:hover {
            background: #f8fafc;
          }

          .primary-button {
            border-color: #166534;
            background: #166534;
            color: #fff;
          }

          .primary-button:hover {
            background: #14532d;
          }

          .product-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 18px;
            padding: 17px 19px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #fff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          }

          .product-info {
            display: flex;
            align-items: center;
            gap: 14px;
            min-width: 0;
          }

          .product-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: #f0fdf4;
            color: #166534;
            font-size: 22px;
          }

          .product-copy {
            min-width: 0;
          }

          .product-copy h2 {
            margin: 0;
            color: #0f172a;
            font-size: 17px;
            font-weight: 750;
          }

          .product-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
            margin-top: 5px;
            color: #64748b;
            font-size: 11px;
          }

          .meta-pill {
            padding: 3px 7px;
            border-radius: 6px;
            background: #f1f5f9;
            color: #64748b;
            font-weight: 650;
          }

          .tracking-pill {
            display: inline-flex;
            align-items: center;
            min-height: 25px;
            padding: 0 9px;
            border: 1px solid #dcfce7;
            border-radius: 999px;
            background: #f0fdf4;
            color: #15803d;
            font-size: 11px;
            font-weight: 750;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 13px;
            margin-bottom: 20px;
          }

          .stat-card {
            min-width: 0;
            padding: 16px 17px;
            border: 1px solid #e5e7eb;
            border-radius: 13px;
            background: #fff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          }

          .stat-label {
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
          }

          .stat-value {
            margin-top: 7px;
            color: #0f172a;
            font-size: 23px;
            line-height: 1.1;
            font-weight: 750;
          }

          .stat-detail {
            margin-top: 5px;
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
            align-items: center;
            gap: 2px;
            padding: 6px;
            overflow-x: auto;
          }

          .tab {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            min-height: 38px;
            padding: 0 13px;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
            cursor: pointer;
          }

          .tab:hover {
            background: #f8fafc;
            color: #334155;
          }

          .tab.active {
            background: #f0fdf4;
            color: #166534;
          }

          .tab-count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 20px;
            height: 19px;
            padding: 0 5px;
            border-radius: 999px;
            background: #e2e8f0;
            color: #64748b;
            font-size: 10px;
          }

          .tab.active .tab-count {
            background: #dcfce7;
            color: #166534;
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
            padding: 17px 19px;
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

          .overview-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr);
            gap: 16px;
          }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .info-item {
            padding: 15px 18px;
            border-bottom: 1px solid #f1f5f9;
          }

          .info-item:nth-child(odd) {
            border-right: 1px solid #f1f5f9;
          }

          .info-label {
            color: #94a3b8;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .info-value {
            margin-top: 5px;
            color: #334155;
            font-size: 13px;
            font-weight: 650;
          }

          .variant-list {
            padding: 0;
          }

          .variant-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 13px 18px;
            border-bottom: 1px solid #f1f5f9;
          }

          .variant-row:last-child {
            border-bottom: 0;
          }

          .variant-main {
            min-width: 0;
          }

          .variant-name {
            color: #0f172a;
            font-size: 12px;
            font-weight: 700;
          }

          .variant-sku {
            margin-top: 3px;
            color: #94a3b8;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
          }

          .variant-price {
            color: #334155;
            font-size: 12px;
            font-weight: 750;
            white-space: nowrap;
          }

          .cost-breakdown {
            padding: 0;
          }

          .cost-row {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            padding: 11px 18px;
            border-bottom: 1px solid #f1f5f9;
            color: #64748b;
            font-size: 12px;
          }

          .cost-row strong {
            color: #334155;
            font-weight: 700;
          }

          .cost-row.total {
            background: #f8fafc;
            color: #0f172a;
            font-weight: 750;
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
            border-color: #94a3b8;
            box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.07);
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
            padding: 13px 15px;
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

          .status.active,
          .status.available {
            background: #ecfdf5;
            color: #15803d;
          }

          .status.reserved {
            background: #eff6ff;
            color: #2563eb;
          }

          .status.sold {
            background: #f1f5f9;
            color: #475569;
          }

          .status.returned {
            background: #f0fdf4;
            color: #166534;
          }

          .status.repair,
          .status.rma {
            background: #fff7ed;
            color: #c2410c;
          }

          .status.damaged,
          .status.cancelled {
            background: #fef2f2;
            color: #dc2626;
          }

          .status.quarantined {
            background: #fffbeb;
            color: #b45309;
          }

          .status.depleted,
          .status.closed {
            background: #f8fafc;
            color: #64748b;
          }

          .stock-good {
            color: #15803d;
            font-weight: 750;
          }

          .stock-muted {
            color: #64748b;
          }

          .movement-type {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            padding: 0 8px;
            border-radius: 7px;
            background: #f1f5f9;
            color: #475569;
            font-size: 10px;
            font-weight: 750;
          }

          .reference-button {
            border: 0;
            padding: 0;
            background: transparent;
            color: #166534;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
          }

          .reference-button:hover {
            text-decoration: underline;
          }

          .empty-state {
            padding: 55px 20px;
            text-align: center;
          }

          .empty-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            margin: 0 auto 12px;
            border-radius: 12px;
            background: #f1f5f9;
            font-size: 20px;
          }

          .empty-state h3 {
            margin: 0;
            color: #0f172a;
            font-size: 15px;
          }

          .empty-state p {
            max-width: 450px;
            margin: 6px auto 0;
            color: #94a3b8;
            font-size: 12px;
            line-height: 1.6;
          }

          .trace-card {
            padding: 20px;
          }

          .trace-line {
            position: relative;
            padding-left: 29px;
          }

          .trace-line::before {
            content: "";
            position: absolute;
            left: 7px;
            top: 8px;
            bottom: 8px;
            width: 1px;
            background: #dbe1e8;
          }

          .trace-item {
            position: relative;
            padding-bottom: 22px;
          }

          .trace-item:last-child {
            padding-bottom: 0;
          }

          .trace-dot {
            position: absolute;
            left: -26px;
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
            line-height: 1.5;
          }

          .trace-date {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
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

          .loading-spinner {
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
            .overview-grid {
              grid-template-columns: 1fr;
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

            .product-banner {
              align-items: flex-start;
              flex-direction: column;
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
              onClick={() =>
                router.push("/inventory")
              }
            >
              ← Back to Inventory
            </button>

            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Inventory Workspace
            </div>

            <h1 className="page-title">
              {product.name}
            </h1>

            <p className="page-subtitle">
              Batch, stock, unit, cost, and
              traceability workspace.
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
                  "/inventory/receiving",
                )
              }
            >
              Receive Stock
            </button>
          </div>
        </div>

        <section className="product-banner">
          <div className="product-info">
            <div className="product-icon">
              📦
            </div>

            <div className="product-copy">
              <h2>{product.name}</h2>

              <div className="product-meta">
                {product.brand && (
                  <span className="meta-pill">
                    {product.brand}
                  </span>
                )}

                {product.category && (
                  <span className="meta-pill">
                    {product.category}
                  </span>
                )}

                {product.status && (
                  <span className="meta-pill">
                    {product.status}
                  </span>
                )}

                <span className="tracking-pill">
                  {trackingLabel(
                    product.tracking_mode,
                  )}{" "}
                  Tracking
                </span>
              </div>
            </div>
          </div>

          <div className="product-meta">
            <span className="meta-pill">
              {variants.length}{" "}
              {variants.length === 1
                ? "variant"
                : "variants"}
            </span>

            <span className="meta-pill">
              {batches.length}{" "}
              {batches.length === 1
                ? "batch"
                : "batches"}
            </span>

            {product.tracking_mode ===
              "serial" && (
              <span className="meta-pill">
                {serializedUnits.length} serial
                units
              </span>
            )}
          </div>
        </section>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Stock
            </div>
            <div className="stat-value">
              {formatNumber(totals.total)}
            </div>
            <div className="stat-detail">
              Across all warehouses
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Available
            </div>
            <div className="stat-value">
              {formatNumber(totals.available)}
            </div>
            <div className="stat-detail">
              Ready for allocation
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Reserved
            </div>
            <div className="stat-value">
              {formatNumber(totals.reserved)}
            </div>
            <div className="stat-detail">
              Held for orders
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Inventory Value
            </div>
            <div className="stat-value">
              {formatMoney(totals.value)}
            </div>
            <div className="stat-detail">
              Current batch cost basis
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Active Batches
            </div>
            <div className="stat-value">
              {formatNumber(
                totals.activeBatches,
              )}
            </div>
            <div className="stat-detail">
              Active inventory lots
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Serialized Units
            </div>
            <div className="stat-value">
              {formatNumber(
                totals.serializedCount,
              )}
            </div>
            <div className="stat-detail">
              {formatNumber(
                totals.availableSerials,
              )}{" "}
              available ·{" "}
              {formatNumber(totals.soldSerials)}{" "}
              sold
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
                activeTab === "batches"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab("batches")
              }
            >
              Batches
              <span className="tab-count">
                {batches.length}
              </span>
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
              <span className="tab-count">
                {serializedUnits.length}
              </span>
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
              <span className="tab-count">
                {movements.length}
              </span>
            </button>
          </div>
        </section>

        {activeTab === "overview" && (
          <div className="overview-grid">
            <div>
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Product Information
                    </h2>
                    <p>
                      Catalog and inventory
                      configuration.
                    </p>
                  </div>
                </div>

                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">
                      Product
                    </div>
                    <div className="info-value">
                      {product.name}
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Brand
                    </div>
                    <div className="info-value">
                      {product.brand || "—"}
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Category
                    </div>
                    <div className="info-value">
                      {product.category || "—"}
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Product Type
                    </div>
                    <div className="info-value">
                      {product.product_type ||
                        "—"}
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Tracking
                    </div>
                    <div className="info-value">
                      {trackingLabel(
                        product.tracking_mode,
                      )}
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-label">
                      Status
                    </div>
                    <div className="info-value">
                      {product.status || "—"}
                    </div>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Variants</h2>
                    <p>
                      Product variants currently
                      attached to inventory.
                    </p>
                  </div>
                </div>

                {variants.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      ◇
                    </div>
                    <h3>
                      No active variants
                    </h3>
                    <p>
                      This product does not
                      currently have variants.
                    </p>
                  </div>
                ) : (
                  <div className="variant-list">
                    {variants.map((variant) => (
                      <div
                        key={variant.id}
                        className="variant-row"
                      >
                        <div className="variant-main">
                          <div className="variant-name">
                            {variant.name ||
                              "Default Variant"}
                          </div>

                          <div className="variant-sku">
                            {variant.sku ||
                              "No SKU"}
                            {variant.barcode
                              ? ` · ${variant.barcode}`
                              : ""}
                          </div>
                        </div>

                        <div className="variant-price">
                          {formatMoney(
                            Number(
                              variant.cost_price ||
                                0,
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div>
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Cost Position
                    </h2>
                    <p>
                      Current inventory cost basis
                      by batch.
                    </p>
                  </div>
                </div>

                <div className="cost-breakdown">
                  <div className="cost-row">
                    <span>
                      Inventory Quantity
                    </span>
                    <strong>
                      {formatNumber(
                        totals.total,
                      )}
                    </strong>
                  </div>

                  <div className="cost-row">
                    <span>
                      Inventory Value
                    </span>
                    <strong>
                      {formatMoney(
                        totals.value,
                      )}
                    </strong>
                  </div>

                  <div className="cost-row">
                    <span>
                      Average Unit Cost
                    </span>
                    <strong>
                      {totals.total > 0
                        ? formatMoney(
                            totals.value /
                              totals.total,
                          )
                        : "0.00"}
                    </strong>
                  </div>

                  <div className="cost-row">
                    <span>
                      Active Batches
                    </span>
                    <strong>
                      {formatNumber(
                        totals.activeBatches,
                      )}
                    </strong>
                  </div>

                  <div className="cost-row total">
                    <span>
                      Cost Basis
                    </span>
                    <strong>
                      {formatMoney(
                        totals.value,
                      )}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Traceability
                    </h2>
                    <p>
                      Inventory lifecycle
                      checkpoints.
                    </p>
                  </div>
                </div>

                <div className="trace-card">
                  <div className="trace-line">
                    <div className="trace-item">
                      <span className="trace-dot" />
                      <div className="trace-title">
                        Product
                      </div>
                      <div className="trace-detail">
                        {product.name}
                      </div>
                    </div>

                    <div className="trace-item">
                      <span className="trace-dot" />
                      <div className="trace-title">
                        Batches / Lots
                      </div>
                      <div className="trace-detail">
                        {batches.length} batch
                        {batches.length === 1
                          ? ""
                          : "es"}{" "}
                        currently recorded.
                      </div>
                    </div>

                    <div className="trace-item">
                      <span className="trace-dot" />
                      <div className="trace-title">
                        Warehouse Stock
                      </div>
                      <div className="trace-detail">
                        {formatNumber(
                          totals.total,
                        )}{" "}
                        total units across{" "}
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
                            (row) =>
                              row.warehouse_id,
                          ),
                        ).size === 1
                          ? ""
                          : "s"}
                        .
                      </div>
                    </div>

                    <div className="trace-item">
                      <span className="trace-dot" />
                      <div className="trace-title">
                        Individual Units
                      </div>
                      <div className="trace-detail">
                        {product.tracking_mode ===
                        "serial"
                          ? `${serializedUnits.length} manufacturer serial units tracked.`
                          : "This product is not serial tracked."}
                      </div>
                    </div>

                    <div className="trace-item">
                      <span className="trace-dot" />
                      <div className="trace-title">
                        Movement Ledger
                      </div>
                      <div className="trace-detail">
                        {movements.length} inventory
                        movement
                        {movements.length === 1
                          ? ""
                          : "s"}{" "}
                        recorded.
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "batches" && (
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Batches & Lots</h2>
                <p>
                  The primary cost and provenance
                  boundary for this inventory.
                </p>
              </div>

              <input
                type="search"
                className="search-input"
                value={batchSearch}
                onChange={(event) =>
                  setBatchSearch(
                    event.target.value,
                  )
                }
                placeholder="Search batch, supplier, PO..."
              />
            </div>

            {filteredBatches.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ▦
                </div>
                <h3>
                  No matching batches
                </h3>
                <p>
                  No inventory batches match your
                  search.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Batch / Lot</th>
                      <th>Received</th>
                      <th>Source</th>
                      <th>Stock</th>
                      <th>Unit Cost</th>
                      <th>Batch Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredBatches.map(
                      (batch) => {
                        const stockRows =
                          batchStockMap.get(
                            batch.id,
                          ) ?? [];

                        const quantity =
                          stockRows.reduce(
                            (sum, row) =>
                              sum +
                              Number(
                                row.quantity ||
                                  0,
                              ),
                            0,
                          );

                        const reserved =
                          stockRows.reduce(
                            (sum, row) =>
                              sum +
                              Number(
                                row.reserved_quantity ||
                                  0,
                              ),
                            0,
                          );

                        const available =
                          Math.max(
                            0,
                            quantity -
                              reserved,
                          );

                        const value =
                          quantity *
                          Number(
                            batch.unit_cost ||
                              0,
                          );

                        const supplier =
                          batch.supplier_id
                            ? supplierMap.get(
                                batch.supplier_id,
                              )
                            : null;

                        const po =
                          batch.purchase_order_id
                            ? purchaseOrderMap.get(
                                batch.purchase_order_id,
                              )
                            : null;

                        const receipt =
                          batch.stock_receipt_id
                            ? receiptMap.get(
                                batch.stock_receipt_id,
                              )
                            : null;

                        return (
                          <tr
                            key={batch.id}
                          >
                            <td>
                              <div className="primary-text mono">
                                {batch.lot_number}
                              </div>

                              <div className="secondary-text">
                                {batch.variant_id
                                  ? variantMap.get(
                                      batch.variant_id,
                                    )?.sku ||
                                    "Variant"
                                  : "Default"}
                              </div>
                            </td>

                            <td>
                              {formatDate(
                                batch.received_at,
                              )}
                            </td>

                            <td>
                              <div>
                                <div className="primary-text">
                                  {supplier?.name ||
                                    "Supplier not linked"}
                                </div>

                                <div className="secondary-text">
                                  {po?.po_number
                                    ? `PO ${po.po_number}`
                                    : "No PO"}
                                  {" · "}
                                  {receipt?.receipt_number
                                    ? `GRN ${receipt.receipt_number}`
                                    : "No GRN"}
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="stock-good">
                                {formatNumber(
                                  available,
                                )}{" "}
                                available
                              </div>

                              <div className="secondary-text">
                                {formatNumber(
                                  reserved,
                                )}{" "}
                                reserved ·{" "}
                                {formatNumber(
                                  quantity,
                                )}{" "}
                                total
                              </div>
                            </td>

                            <td>
                              {formatMoney(
                                Number(
                                  batch.unit_cost ||
                                    0,
                                ),
                              )}
                            </td>

                            <td>
                              <span className="primary-text">
                                {formatMoney(
                                  value,
                                )}
                              </span>
                            </td>

                            <td>
                              <span
                                className={batchStatusClass(
                                  batch.status,
                                )}
                              >
                                {batch.status ||
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
            )}
          </section>
        )}

        {activeTab === "serials" && (
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Individual Units</h2>
                <p>
                  Manufacturer serial numbers
                  linked to their inventory batches.
                </p>
              </div>

              <input
                type="search"
                className="search-input"
                value={serialSearch}
                onChange={(event) =>
                  setSerialSearch(
                    event.target.value,
                  )
                }
                placeholder="Search serial, batch, order..."
              />
            </div>

            {product.tracking_mode !==
            "serial" ? (
              <div className="empty-state">
                <div className="empty-icon">
                  #
                </div>
                <h3>
                  Serial tracking is not enabled
                </h3>
                <p>
                  This product uses{" "}
                  {trackingLabel(
                    product.tracking_mode,
                  ).toLowerCase()}{" "}
                  tracking. Individual manufacturer
                  serial units are only displayed
                  for serial-tracked products.
                </p>
              </div>
            ) : filteredSerials.length ===
              0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  #
                </div>
                <h3>
                  No serial units found
                </h3>
                <p>
                  No serialized units match your
                  search.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Manufacturer Serial</th>
                      <th>Batch / Lot</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Cost</th>
                      <th>Order / Customer</th>
                      <th>Warranty</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSerials.map(
                      (unit) => {
                        const batch =
                          unit.batch_id
                            ? batchMap.get(
                                unit.batch_id,
                              )
                            : null;

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

                        const customerName =
                          customer?.company_name ||
                          customer?.name ||
                          null;

                        return (
                          <tr
                            key={unit.id}
                          >
                            <td>
                              <div className="primary-text mono">
                                {
                                  unit.serial_number
                                }
                              </div>

                              {unit.barcode && (
                                <div className="secondary-text">
                                  Barcode:{" "}
                                  {unit.barcode}
                                </div>
                              )}
                            </td>

                            <td>
                              <span className="mono">
                                {batch?.lot_number ||
                                  "—"}
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
                              <span
                                className={serialStatusClass(
                                  unit.status,
                                )}
                              >
                                {unit.status ||
                                  "Unknown"}
                              </span>
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
                              {order ? (
                                <div>
                                  <div className="primary-text">
                                    {
                                      order.order_number
                                    }
                                  </div>

                                  <div className="secondary-text">
                                    {customerName ||
                                      "Customer not linked"}
                                  </div>
                                </div>
                              ) : (
                                <span className="secondary-text">
                                  Not sold
                                </span>
                              )}
                            </td>

                            <td>
                              <div className="primary-text">
                                {unit.warranty_end
                                  ? `Until ${formatDate(
                                      unit.warranty_end,
                                    )}`
                                  : "—"}
                              </div>

                              {unit.warranty_start && (
                                <div className="secondary-text">
                                  From{" "}
                                  {formatDate(
                                    unit.warranty_start,
                                  )}
                                </div>
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
          </section>
        )}

        {activeTab === "movements" && (
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Inventory Movement Ledger</h2>
                <p>
                  Every stock movement recorded
                  against this product.
                </p>
              </div>

              <input
                type="search"
                className="search-input"
                value={movementSearch}
                onChange={(event) =>
                  setMovementSearch(
                    event.target.value,
                  )
                }
                placeholder="Search movement, batch, serial..."
              />
            </div>

            {filteredMovements.length ===
            0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ⇄
                </div>
                <h3>
                  No movements found
                </h3>
                <p>
                  Inventory movements will appear
                  here as stock is received, sold,
                  transferred, adjusted, or
                  returned.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Movement</th>
                      <th>Batch / Serial</th>
                      <th>Location</th>
                      <th>Quantity</th>
                      <th>Balance</th>
                      <th>Reference</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMovements.map(
                      (movement) => {
                        const batch =
                          movement.batch_id
                            ? batchMap.get(
                                movement.batch_id,
                              )
                            : null;

                        const unit =
                          movement.unit_id
                            ? serializedUnits.find(
                                (item) =>
                                  item.id ===
                                  movement.unit_id,
                              )
                            : null;

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
                              <div className="primary-text">
                                {formatDateTime(
                                  movement.created_at,
                                )}
                              </div>
                            </td>

                            <td>
                              <span className="movement-type">
                                {movementLabel(
                                  movement.movement_type,
                                )}
                              </span>

                              {movement.reason && (
                                <div className="secondary-text">
                                  {
                                    movement.reason
                                  }
                                </div>
                              )}
                            </td>

                            <td>
                              {batch && (
                                <div className="primary-text mono">
                                  {
                                    batch.lot_number
                                  }
                                </div>
                              )}

                              {unit && (
                                <div className="secondary-text mono">
                                  {
                                    unit.serial_number
                                  }
                                </div>
                              )}

                              {!batch &&
                                !unit && (
                                  <span>
                                    —
                                  </span>
                                )}
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
                              <span className="primary-text">
                                {formatNumber(
                                  movement.quantity,
                                )}
                              </span>
                            </td>

                            <td>
                              <div>
                                {movement.quantity_before !==
                                  null && (
                                  <span className="secondary-text">
                                    Before:{" "}
                                    {formatNumber(
                                      movement.quantity_before,
                                    )}
                                  </span>
                                )}
                              </div>

                              <div className="primary-text">
                                {movement.quantity_after !==
                                null
                                  ? formatNumber(
                                      movement.quantity_after,
                                    )
                                  : "—"}
                              </div>
                            </td>

                            <td>
                              {movement.reference_type ||
                              movement.reference_id ? (
                                <div>
                                  <div className="primary-text">
                                    {movement.reference_type ||
                                      "Reference"}
                                  </div>

                                  {movement.reference_id && (
                                    <div className="secondary-text mono">
                                      {
                                        movement.reference_id
                                      }
                                    </div>
                                  )}
                                </div>
                              ) : (
                                "—"
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
          </section>
        )}
      </div>
    </AppShell>
  );
}