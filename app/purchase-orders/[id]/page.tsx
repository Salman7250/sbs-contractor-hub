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

type PurchaseOrder = {
  id: string;
  company_id: string;
  supplier_id: string | null;
  po_number: string;
  status: string;
  currency: string | null;
  order_date: string | null;
  expected_date: string | null;
  warehouse_id: string | null;
  supplier_reference: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  shipping_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  terms: string | null;
  created_by: string | null;
  approved_by: string | null;
  sent_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type PurchaseOrderItem = {
  id: string;
  company_id: string;
  purchase_order_id: string;
  product_id: string | null;
  variant_id: string | null;
  supplier_product_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  supplier_sku: string | null;
  description: string | null;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
  updated_at: string;
};

type Supplier = {
  id: string;
  supplier_number: string | null;
  legal_name: string | null;
  display_name: string | null;
  status: string | null;
  supplier_type: string | null;
  tax_id: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  currency: string | null;
  payment_terms_days: number | null;
  credit_limit: number | null;
  default_lead_time_days: number | null;
  minimum_order_amount: number | null;
  rating: number | null;
  notes: string | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  tracking_mode: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
};

type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
};

type StockReceipt = {
  id: string;
  company_id: string;
  purchase_order_id: string | null;
  receipt_number: string;
  supplier_name: string | null;
  reference_number: string | null;
  notes: string | null;
  status: string;
  received_by: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
};

type StockReceiptItem = {
  id: string;
  company_id: string;
  receipt_id: string;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_cost: number;
  purchase_order_item_id: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  batch_id: string | null;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "AED",
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(
  value: string | null | undefined,
): string {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function getTrackingLabel(
  trackingMode: string | null | undefined,
): string {
  switch (trackingMode) {
    case "serial":
      return "Serial";

    case "batch":
      return "Batch / Lot";

    case "quantity":
      return "Quantity";

    case "none":
      return "Non-stock";

    default:
      return "Unknown";
  }
}

function getStatusClass(
  status: string | null | undefined,
): string {
  switch (status) {
    case "draft":
      return "status-draft";

    case "confirmed":
      return "status-confirmed";

    case "partially_received":
    case "partial":
      return "status-partial";

    case "received":
      return "status-received";

    case "cancelled":
      return "status-cancelled";

    default:
      return "status-neutral";
  }
}

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();

  const purchaseOrderId = String(
    params.id || "",
  );

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [purchaseOrder, setPurchaseOrder] =
    useState<PurchaseOrder | null>(null);

  const [items, setItems] = useState<
    PurchaseOrderItem[]
  >([]);

  const [supplier, setSupplier] =
    useState<Supplier | null>(null);

  const [products, setProducts] = useState<
    Record<string, Product>
  >({});

  const [variants, setVariants] = useState<
    Record<string, Variant>
  >({});

  const [warehouse, setWarehouse] =
    useState<Warehouse | null>(null);

  const [locations, setLocations] = useState<
    Record<string, WarehouseLocation>
  >({});

  const [receipts, setReceipts] = useState<
    StockReceipt[]
  >([]);

  const [receiptItems, setReceiptItems] = useState<
    StockReceiptItem[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadPage = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        if (!purchaseOrderId) {
          throw new Error(
            "Purchase order ID is missing.",
          );
        }

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.replace("/login");
          return;
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
            "No company membership was found.",
          );
        }

        const companyId =
          membership.company_id;

        const {
          data: loadedPurchaseOrder,
          error: purchaseOrderError,
        } = await supabase
          .from("purchase_orders")
          .select(
            `
              id,
              company_id,
              supplier_id,
              po_number,
              status,
              currency,
              order_date,
              expected_date,
              warehouse_id,
              supplier_reference,
              subtotal,
              discount_amount,
              tax_amount,
              shipping_amount,
              total_amount,
              notes,
              terms,
              created_by,
              approved_by,
              sent_at,
              approved_at,
              created_at,
              updated_at
            `,
          )
          .eq("id", purchaseOrderId)
          .eq("company_id", companyId)
          .single();

        if (purchaseOrderError) {
          throw purchaseOrderError;
        }

        const po =
          loadedPurchaseOrder as PurchaseOrder;

        const [
          itemsResult,
          supplierResult,
          warehouseResult,
          receiptsResult,
          productsResult,
          variantsResult,
          locationsResult,
        ] = await Promise.all([
          supabase
            .from("purchase_order_items")
            .select(
              `
                id,
                company_id,
                purchase_order_id,
                product_id,
                variant_id,
                supplier_product_id,
                product_name,
                variant_name,
                sku,
                supplier_sku,
                description,
                quantity,
                received_quantity,
                unit_cost,
                discount_amount,
                tax_amount,
                line_total,
                created_at,
                updated_at
              `,
            )
            .eq("company_id", companyId)
            .eq(
              "purchase_order_id",
              purchaseOrderId,
            )
            .order("created_at", {
              ascending: true,
            }),

          po.supplier_id
            ? supabase
                .from("suppliers")
                .select(
                  `
                    id,
                    supplier_number,
                    legal_name,
                    display_name,
                    status,
                    supplier_type,
                    tax_id,
                    website,
                    email,
                    phone,
                    currency,
                    payment_terms_days,
                    credit_limit,
                    default_lead_time_days,
                    minimum_order_amount,
                    rating,
                    notes
                  `,
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .eq(
                  "id",
                  po.supplier_id,
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          po.warehouse_id
            ? supabase
                .from("warehouses")
                .select(
                  "id, name, code",
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .eq(
                  "id",
                  po.warehouse_id,
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          supabase
            .from("stock_receipts")
            .select(
              `
                id,
                company_id,
                purchase_order_id,
                receipt_number,
                supplier_name,
                reference_number,
                notes,
                status,
                received_by,
                received_at,
                created_at,
                updated_at
              `,
            )
            .eq("company_id", companyId)
            .eq(
              "purchase_order_id",
              purchaseOrderId,
            )
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("products")
            .select(
              `
                id,
                name,
                brand,
                tracking_mode
              `,
            )
            .eq("company_id", companyId),

          supabase
            .from("product_variants")
            .select(
              `
                id,
                product_id,
                name,
                sku
              `,
            )
            .eq("company_id", companyId),

          supabase
            .from("warehouse_locations")
            .select(
              `
                id,
                warehouse_id,
                name,
                code
              `,
            )
            .eq("company_id", companyId)
            .eq("is_active", true),
        ]);

        if (itemsResult.error) {
          throw itemsResult.error;
        }

        if (supplierResult.error) {
          throw supplierResult.error;
        }

        if (warehouseResult.error) {
          throw warehouseResult.error;
        }

        if (receiptsResult.error) {
          throw receiptsResult.error;
        }

        if (productsResult.error) {
          throw productsResult.error;
        }

        if (variantsResult.error) {
          throw variantsResult.error;
        }

        if (locationsResult.error) {
          throw locationsResult.error;
        }

        const loadedItems =
          (itemsResult.data ||
            []) as PurchaseOrderItem[];

        const loadedReceipts =
          (receiptsResult.data ||
            []) as StockReceipt[];

        const productMap: Record<
          string,
          Product
        > = {};

        for (const product of (productsResult.data ||
          []) as Product[]) {
          productMap[product.id] =
            product;
        }

        const variantMap: Record<
          string,
          Variant
        > = {};

        for (const variant of (variantsResult.data ||
          []) as Variant[]) {
          variantMap[variant.id] =
            variant;
        }

        const locationMap: Record<
          string,
          WarehouseLocation
        > = {};

        for (const location of (locationsResult.data ||
          []) as WarehouseLocation[]) {
          locationMap[location.id] =
            location;
        }

        let loadedReceiptItems: StockReceiptItem[] =
          [];

        if (
          loadedReceipts.length >
          0
        ) {
          const receiptIds =
            loadedReceipts.map(
              (receipt) =>
                receipt.id,
            );

          const {
            data,
            error,
          } = await supabase
            .from("stock_receipt_items")
            .select(
              `
                id,
                company_id,
                receipt_id,
                product_id,
                variant_id,
                quantity,
                unit_cost,
                purchase_order_item_id,
                warehouse_id,
                location_id,
                batch_id
              `,
            )
            .eq(
              "company_id",
              companyId,
            )
            .in(
              "receipt_id",
              receiptIds,
            );

          if (error) {
            throw error;
          }

          loadedReceiptItems =
            (data ||
              []) as StockReceiptItem[];
        }

        setPurchaseOrder(po);
        setItems(loadedItems);

        setSupplier(
          (supplierResult.data ||
            null) as Supplier | null,
        );

        setWarehouse(
          (warehouseResult.data ||
            null) as Warehouse | null,
        );

        setProducts(productMap);
        setVariants(variantMap);
        setLocations(locationMap);
        setReceipts(loadedReceipts);
        setReceiptItems(
          loadedReceiptItems,
        );
      } catch (error) {
        console.error(
          "Purchase order detail load error:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load this purchase order.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      purchaseOrderId,
      router,
      supabase,
    ],
  );

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        void loadPage();
      }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadPage]);

  const totals = useMemo(() => {
    const ordered =
      items.reduce(
        (sum, item) =>
          sum +
          toNumber(item.quantity),
        0,
      );

    const received =
      items.reduce(
        (sum, item) =>
          sum +
          toNumber(
            item.received_quantity,
          ),
        0,
      );

    const remaining =
      items.reduce(
        (sum, item) =>
          sum +
          Math.max(
            toNumber(item.quantity) -
              toNumber(
                item.received_quantity,
              ),
            0,
          ),
        0,
      );

    const value =
      items.reduce(
        (sum, item) =>
          sum +
          toNumber(item.line_total),
        0,
      );

    return {
      ordered,
      received,
      remaining,
      value,
    };
  }, [items]);

  const receiptQuantity = useMemo(
    () =>
      receiptItems.reduce(
        (sum, item) =>
          sum +
          toNumber(item.quantity),
        0,
      ),
    [receiptItems],
  );

  const receivingProgress = useMemo(() => {
    if (totals.ordered <= 0) {
      return 0;
    }

    return Math.min(
      100,
      (totals.received /
        totals.ordered) *
        100,
    );
  }, [
    totals.ordered,
    totals.received,
  ]);

  const isFullyReceived =
    totals.ordered > 0 &&
    totals.remaining <= 0;

  const canReceive =
    !isFullyReceived &&
    purchaseOrder?.status !==
      "cancelled";

  function getSupplierName(): string {
    return (
      supplier?.display_name ||
      supplier?.legal_name ||
      "No supplier"
    );
  }

  function getTrackingMode(
    item: PurchaseOrderItem,
  ): string {
    if (!item.product_id) {
      return "none";
    }

    return (
      products[item.product_id]
        ?.tracking_mode || "none"
    );
  }

  function getRemainingQuantity(
    item: PurchaseOrderItem,
  ): number {
    return Math.max(
      toNumber(item.quantity) -
        toNumber(
          item.received_quantity,
        ),
      0,
    );
  }

  function goBack() {
    router.push(
      "/purchase-orders",
    );
  }

  function goToReceiving() {
    if (!purchaseOrder) {
      return;
    }

    router.push(
      `/inventory/receiving?purchaseOrderId=${encodeURIComponent(
        purchaseOrder.id,
      )}`,
    );
  }

  function goToEdit() {
    if (!purchaseOrder) {
      return;
    }

    router.push(
      `/purchase-orders/${purchaseOrder.id}/edit`,
    );
  }

  function printPurchaseOrder() {
    window.print();
  }

  if (loading) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="loading-state">
            <strong>
              Loading Purchase Order
            </strong>

            <span>
              Preparing purchase order information...
            </span>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .loading-state {
              min-height: 360px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 7px;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              background: #ffffff;
              box-shadow:
                0 2px 8px
                  rgba(
                    15,
                    23,
                    42,
                    0.04
                  );
              text-align: center;
            }

            .loading-state strong {
              color: #111827;
              font-size: 15px;
            }

            .loading-state span {
              color: #6b7280;
              font-size: 13px;
            }
          `}</style>
        </main>
      </AppShell>
    );
  }

  if (!purchaseOrder) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="error-card">
            <div className="error-icon">
              !
            </div>

            <div>
              <h2>
                Purchase Order Not Found
              </h2>

              <p>
                {errorMessage ||
                  "The requested purchase order could not be loaded."}
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={goBack}
            >
              Back to Purchase Orders
            </button>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .error-card {
              min-height: 320px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 14px;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              background: #ffffff;
              text-align: center;
            }

            .error-icon {
              width: 48px;
              height: 48px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 12px;
              background: #fef2f2;
              color: #b91c1c;
              font-size: 20px;
              font-weight: 800;
            }

            .error-card h2 {
              margin: 0;
              color: #111827;
              font-size: 18px;
            }

            .error-card p {
              max-width: 500px;
              margin: 6px 0 0;
              color: #64748b;
              font-size: 13px;
              line-height: 1.5;
            }

            .secondary-button {
              min-height: 40px;
              padding: 0 15px;
              border: 1px solid #dbe2ea;
              border-radius: 10px;
              background: #ffffff;
              color: #334155;
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
            }
          `}</style>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="page-content purchase-order-page">
        <div className="top-bar">
          <button
            type="button"
            className="back-button"
            onClick={goBack}
          >
            ← Back to Purchase Orders
          </button>

          <div className="top-actions">
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

            <button
              type="button"
              className="secondary-button"
              onClick={printPurchaseOrder}
            >
              Print
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={goToEdit}
              disabled={
                purchaseOrder.status ===
                "received"
              }
            >
              Edit PO
            </button>

            {canReceive && (
              <button
                type="button"
                className="primary-button"
                onClick={goToReceiving}
              >
                Receive Stock
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="alert error">
            <strong>
              Unable to load purchase order
            </strong>

            <span>
              {errorMessage}
            </span>
          </div>
        )}

        <section className="hero-card">
          <div className="hero-main">
            <div className="hero-icon">
              PO
            </div>

            <div className="hero-copy">
              <div className="eyebrow">
                Procurement
              </div>

              <div className="title-row">
                <h1>
                  {purchaseOrder.po_number}
                </h1>

                <span
                  className={`status-badge ${getStatusClass(
                    purchaseOrder.status,
                  )}`}
                >
                  {formatStatus(
                    purchaseOrder.status,
                  )}
                </span>
              </div>

              <p>
                {getSupplierName()}
                {purchaseOrder.supplier_reference
                  ? ` • Ref ${purchaseOrder.supplier_reference}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="hero-meta">
            <div>
              <span>
                Order Date
              </span>

              <strong>
                {formatDate(
                  purchaseOrder.order_date,
                )}
              </strong>
            </div>

            <div>
              <span>
                Expected
              </span>

              <strong>
                {formatDate(
                  purchaseOrder.expected_date,
                )}
              </strong>
            </div>

            <div>
              <span>
                Warehouse
              </span>

              <strong>
                {warehouse?.name ||
                  "Not assigned"}
              </strong>
            </div>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Ordered
            </div>

            <div className="stat-value">
              {formatNumber(
                totals.ordered,
              )}
            </div>

            <div className="stat-meta">
              Total units ordered
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Received
            </div>

            <div className="stat-value green">
              {formatNumber(
                totals.received,
              )}
            </div>

            <div className="stat-meta">
              Stock already received
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Remaining
            </div>

            <div className="stat-value amber">
              {formatNumber(
                totals.remaining,
              )}
            </div>

            <div className="stat-meta">
              Units still outstanding
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              PO Total
            </div>

            <div className="stat-value money">
              {formatCurrency(
                purchaseOrder.total_amount,
                purchaseOrder.currency,
              )}
            </div>

            <div className="stat-meta">
              Purchase order value
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Receipts
            </div>

            <div className="stat-value">
              {receipts.length}
            </div>

            <div className="stat-meta">
              Stock receipt records
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Receipt Units
            </div>

            <div className="stat-value">
              {formatNumber(
                receiptQuantity,
              )}
            </div>

            <div className="stat-meta">
              Units across receipts
            </div>
          </div>
        </section>

        <section className="progress-card">
          <div className="progress-header">
            <div>
              <strong>
                Receiving Progress
              </strong>

              <span>
                {formatNumber(
                  totals.received,
                )}{" "}
                of{" "}
                {formatNumber(
                  totals.ordered,
                )}{" "}
                units received
              </span>
            </div>

            <strong>
              {Math.round(
                receivingProgress,
              )}
              %
            </strong>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${receivingProgress}%`,
              }}
            />
          </div>

          <div className="progress-footer">
            {isFullyReceived ? (
              <span className="complete-message">
                ✓ Purchase order fully received
              </span>
            ) : (
              <span>
                {formatNumber(
                  totals.remaining,
                )}{" "}
                units remaining to receive
              </span>
            )}

            {canReceive && (
              <button
                type="button"
                className="progress-link"
                onClick={goToReceiving}
              >
                Continue Receiving →
              </button>
            )}
          </div>
        </section>

        <div className="content-grid">
          <section className="content-card main-card">
            <div className="card-header">
              <div>
                <h2>
                  Purchase Order Items
                </h2>

                <p>
                  Products, quantities, tracking
                  and receiving status.
                </p>
              </div>

              <span className="section-count">
                {items.length}{" "}
                {items.length === 1
                  ? "line"
                  : "lines"}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="empty-state">
                <strong>
                  No purchase order items
                </strong>

                <span>
                  This purchase order does not
                  contain any line items.
                </span>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        Product
                      </th>

                      <th>
                        Tracking
                      </th>

                      <th>
                        SKU
                      </th>

                      <th className="numeric">
                        Ordered
                      </th>

                      <th className="numeric">
                        Received
                      </th>

                      <th className="numeric">
                        Remaining
                      </th>

                      <th className="numeric">
                        Unit Cost
                      </th>

                      <th className="numeric">
                        Line Total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => {
                      const product =
                        item.product_id
                          ? products[
                              item.product_id
                            ]
                          : null;

                      const variant =
                        item.variant_id
                          ? variants[
                              item.variant_id
                            ]
                          : null;

                      const remaining =
                        getRemainingQuantity(
                          item,
                        );

                      const trackingMode =
                        getTrackingMode(
                          item,
                        );

                      return (
                        <tr
                          key={item.id}
                        >
                          <td>
                            <div className="product-cell">
                              <strong>
                                {
                                  item.product_name
                                }
                              </strong>

                              {(item.variant_name ||
                                variant?.name) && (
                                <span>
                                  {
                                    item.variant_name ||
                                    variant?.name
                                  }
                                </span>
                              )}

                              {product?.brand && (
                                <small>
                                  {
                                    product.brand
                                  }
                                </small>
                              )}

                              {item.description && (
                                <small>
                                  {
                                    item.description
                                  }
                                </small>
                              )}
                            </div>
                          </td>

                          <td>
                            <span className="tracking-badge">
                              {getTrackingLabel(
                                trackingMode,
                              )}
                            </span>
                          </td>

                          <td>
                            <span className="sku-text">
                              {item.sku ||
                                variant?.sku ||
                                "—"}
                            </span>
                          </td>

                          <td className="numeric">
                            {formatNumber(
                              toNumber(
                                item.quantity,
                              ),
                            )}
                          </td>

                          <td className="numeric">
                            <strong className="received-value">
                              {formatNumber(
                                toNumber(
                                  item.received_quantity,
                                ),
                              )}
                            </strong>
                          </td>

                          <td className="numeric">
                            <strong
                              className={
                                remaining >
                                0
                                  ? "remaining-value"
                                  : "complete-value"
                              }
                            >
                              {formatNumber(
                                remaining,
                              )}
                            </strong>
                          </td>

                          <td className="numeric">
                            {formatCurrency(
                              item.unit_cost,
                              purchaseOrder.currency,
                            )}
                          </td>

                          <td className="numeric">
                            <strong>
                              {formatCurrency(
                                item.line_total,
                                purchaseOrder.currency,
                              )}
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td
                        colSpan={3}
                        className="total-label"
                      >
                        Totals
                      </td>

                      <td className="numeric">
                        <strong>
                          {formatNumber(
                            totals.ordered,
                          )}
                        </strong>
                      </td>

                      <td className="numeric">
                        <strong>
                          {formatNumber(
                            totals.received,
                          )}
                        </strong>
                      </td>

                      <td className="numeric">
                        <strong>
                          {formatNumber(
                            totals.remaining,
                          )}
                        </strong>
                      </td>

                      <td />

                      <td className="numeric">
                        <strong>
                          {formatCurrency(
                            totals.value,
                            purchaseOrder.currency,
                          )}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <aside className="side-column">
            <section className="content-card">
              <div className="card-header">
                <div>
                  <h2>
                    Supplier
                  </h2>

                  <p>
                    Supplier information for this
                    purchase order.
                  </p>
                </div>
              </div>

              <div className="info-list">
                <div>
                  <span>
                    Supplier
                  </span>

                  <strong>
                    {getSupplierName()}
                  </strong>
                </div>

                <div>
                  <span>
                    Supplier Number
                  </span>

                  <strong>
                    {supplier?.supplier_number ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Email
                  </span>

                  <strong>
                    {supplier?.email ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Phone
                  </span>

                  <strong>
                    {supplier?.phone ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Payment Terms
                  </span>

                  <strong>
                    {toNumber(
                      supplier?.payment_terms_days,
                    ) > 0
                      ? `${formatNumber(
                          toNumber(
                            supplier?.payment_terms_days,
                          ),
                        )} days`
                      : "Prepaid"}
                  </strong>
                </div>

                <div>
                  <span>
                    Currency
                  </span>

                  <strong>
                    {supplier?.currency ||
                      purchaseOrder.currency ||
                      "AED"}
                  </strong>
                </div>
              </div>

              {supplier?.website && (
                <div className="supplier-link">
                  <a
                    href={
                      supplier.website
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open supplier website →
                  </a>
                </div>
              )}
            </section>

            <section className="content-card">
              <div className="card-header">
                <div>
                  <h2>
                    Order Information
                  </h2>

                  <p>
                    Operational details and
                    references.
                  </p>
                </div>
              </div>

              <div className="info-list">
                <div>
                  <span>
                    PO Number
                  </span>

                  <strong>
                    {
                      purchaseOrder.po_number
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Supplier Reference
                  </span>

                  <strong>
                    {
                      purchaseOrder.supplier_reference ||
                      "—"
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Warehouse
                  </span>

                  <strong>
                    {warehouse
                      ? `${warehouse.name} (${warehouse.code})`
                      : "Not assigned"}
                  </strong>
                </div>

                <div>
                  <span>
                    Order Date
                  </span>

                  <strong>
                    {formatDate(
                      purchaseOrder.order_date,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Expected Date
                  </span>

                  <strong>
                    {formatDate(
                      purchaseOrder.expected_date,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Created
                  </span>

                  <strong>
                    {formatDateTime(
                      purchaseOrder.created_at,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Approved
                  </span>

                  <strong>
                    {formatDateTime(
                      purchaseOrder.approved_at,
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="content-card">
              <div className="card-header">
                <div>
                  <h2>
                    Cost Summary
                  </h2>

                  <p>
                    Purchase order financial
                    breakdown.
                  </p>
                </div>
              </div>

              <div className="cost-list">
                <div>
                  <span>
                    Subtotal
                  </span>

                  <strong>
                    {formatCurrency(
                      purchaseOrder.subtotal,
                      purchaseOrder.currency,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Discount
                  </span>

                  <strong>
                    {formatCurrency(
                      purchaseOrder.discount_amount,
                      purchaseOrder.currency,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Tax
                  </span>

                  <strong>
                    {formatCurrency(
                      purchaseOrder.tax_amount,
                      purchaseOrder.currency,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Shipping
                  </span>

                  <strong>
                    {formatCurrency(
                      purchaseOrder.shipping_amount,
                      purchaseOrder.currency,
                    )}
                  </strong>
                </div>

                <div className="cost-total">
                  <span>
                    Total
                  </span>

                  <strong>
                    {formatCurrency(
                      purchaseOrder.total_amount,
                      purchaseOrder.currency,
                    )}
                  </strong>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section className="content-card">
          <div className="card-header">
            <div>
              <h2>
                Receiving History
              </h2>

              <p>
                Stock receipts created against
                this purchase order.
              </p>
            </div>

            <span className="section-count">
              {receipts.length}{" "}
              {receipts.length === 1
                ? "receipt"
                : "receipts"}
            </span>
          </div>

          {receipts.length === 0 ? (
            <div className="empty-state history-empty">
              <strong>
                No receipts yet
              </strong>

              <span>
                Receiving activity for this
                purchase order will appear here.
              </span>

              {canReceive && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={goToReceiving}
                >
                  Receive Stock
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      Receipt
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Reference
                    </th>

                    <th>
                      Status
                    </th>

                    <th className="numeric">
                      Units
                    </th>

                    <th>
                      Notes
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {receipts.map(
                    (receipt) => {
                      const quantity =
                        receiptItems
                          .filter(
                            (item) =>
                              item.receipt_id ===
                              receipt.id,
                          )
                          .reduce(
                            (
                              sum,
                              item,
                            ) =>
                              sum +
                              toNumber(
                                item.quantity,
                              ),
                            0,
                          );

                      return (
                        <tr
                          key={
                            receipt.id
                          }
                        >
                          <td>
                            <strong>
                              {
                                receipt.receipt_number
                              }
                            </strong>
                          </td>

                          <td>
                            {formatDateTime(
                              receipt.received_at ||
                                receipt.created_at,
                            )}
                          </td>

                          <td>
                            {receipt.reference_number ||
                              "—"}
                          </td>

                          <td>
                            <span
                              className={`status-badge ${getStatusClass(
                                receipt.status,
                              )}`}
                            >
                              {formatStatus(
                                receipt.status,
                              )}
                            </span>
                          </td>

                          <td className="numeric">
                            <strong>
                              {formatNumber(
                                quantity,
                              )}
                            </strong>
                          </td>

                          <td>
                            <span className="notes-preview">
                              {receipt.notes ||
                                "—"}
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

        {(purchaseOrder.notes ||
          purchaseOrder.terms) && (
          <div className="notes-grid">
            {purchaseOrder.notes && (
              <section className="content-card">
                <div className="card-header">
                  <div>
                    <h2>
                      Purchase Order Notes
                    </h2>
                  </div>
                </div>

                <div className="text-content">
                  {
                    purchaseOrder.notes
                  }
                </div>
              </section>
            )}

            {purchaseOrder.terms && (
              <section className="content-card">
                <div className="card-header">
                  <div>
                    <h2>
                      Terms & Conditions
                    </h2>
                  </div>
                </div>

                <div className="text-content">
                  {
                    purchaseOrder.terms
                  }
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <style jsx>{`
        .page-content {
          min-width: 0;
          padding: 28px;
        }

        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .top-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .back-button,
        .secondary-button,
        .primary-button {
          min-height: 40px;
          padding: 0 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .back-button {
          padding-left: 0;
          border: 0;
          background: transparent;
          color: #475569;
        }

        .back-button:hover {
          color: #111827;
        }

        .secondary-button {
          border: 1px solid #dbe2ea;
          background: #ffffff;
          color: #334155;
        }

        .secondary-button:hover:not(
            :disabled
          ) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .primary-button {
          border: 1px solid #166534;
          background: #166534;
          color: #ffffff;
        }

        .primary-button:hover:not(
            :disabled
          ) {
          background: #14532d;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .alert {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 18px;
          padding: 13px 15px;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.5;
        }

        .alert.error {
          border: 1px solid #fecaca;
          background: #fff7f7;
          color: #991b1b;
        }

        .hero-card {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 18px;
          padding: 22px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 2px 8px
              rgba(
                15,
                23,
                42,
                0.035
              );
        }

        .hero-main {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          min-width: 0;
        }

        .hero-icon {
          width: 48px;
          height: 48px;
          flex: 0 0 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #f0fdf4;
          color: #166534;
          font-size: 12px;
          font-weight: 800;
        }

        .hero-copy {
          min-width: 0;
        }

        .eyebrow {
          margin-bottom: 6px;
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

        .title-row h1 {
          margin: 0;
          color: #0f172a;
          font-size: 28px;
          line-height: 1.15;
          font-weight: 750;
          letter-spacing: -0.03em;
        }

        .hero-copy p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .hero-meta {
          min-width: 390px;
          display: grid;
          grid-template-columns: repeat(
            3,
            minmax(0, 1fr)
          );
          gap: 18px;
        }

        .hero-meta > div {
          padding-left: 18px;
          border-left: 1px solid #eef2f7;
        }

        .hero-meta span,
        .hero-meta strong {
          display: block;
        }

        .hero-meta span {
          margin-bottom: 5px;
          color: #94a3b8;
          font-size: 11px;
        }

        .hero-meta strong {
          color: #334155;
          font-size: 12px;
        }

        .status-badge {
          min-height: 25px;
          padding: 0 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }

        .status-draft {
          background: #f1f5f9;
          color: #64748b;
        }

        .status-confirmed {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-partial {
          background: #fff7ed;
          color: #c2410c;
        }

        .status-received {
          background: #ecfdf5;
          color: #166534;
        }

        .status-cancelled {
          background: #fef2f2;
          color: #b91c1c;
        }

        .status-neutral {
          background: #f8fafc;
          color: #475569;
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
          padding: 17px 18px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 2px 8px
              rgba(
                15,
                23,
                42,
                0.035
              );
        }

        .stat-label {
          margin-bottom: 8px;
          color: #64748b;
          font-size: 12px;
          font-weight: 650;
        }

        .stat-value {
          color: #0f172a;
          font-size: 21px;
          line-height: 1.1;
          font-weight: 750;
        }

        .stat-value.green {
          color: #166534;
        }

        .stat-value.amber {
          color: #b45309;
        }

        .stat-value.money {
          font-size: 19px;
        }

        .stat-meta {
          margin-top: 6px;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.4;
        }

        .progress-card {
          margin-bottom: 18px;
          padding: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 2px 8px
              rgba(
                15,
                23,
                42,
                0.035
              );
        }

        .progress-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .progress-header div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .progress-header strong {
          color: #111827;
          font-size: 13px;
        }

        .progress-header span {
          color: #94a3b8;
          font-size: 11px;
        }

        .progress-header > strong {
          color: #166534;
          font-size: 18px;
        }

        .progress-track {
          height: 8px;
          margin-top: 13px;
          overflow: hidden;
          border-radius: 999px;
          background: #e2e8f0;
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: #166534;
          transition: width 0.2s ease;
        }

        .progress-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-top: 9px;
          color: #94a3b8;
          font-size: 11px;
        }

        .complete-message {
          color: #166534;
          font-weight: 700;
        }

        .progress-link {
          border: 0;
          padding: 0;
          background: transparent;
          color: #166534;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }

        .content-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(320px, 360px);
          gap: 18px;
          margin-bottom: 18px;
          align-items: start;
        }

        .main-card,
        .side-column {
          min-width: 0;
        }

        .side-column {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .content-card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 2px 8px
              rgba(
                15,
                23,
                42,
                0.035
              );
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 18px;
          border-bottom: 1px solid #eef2f7;
        }

        .card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 15px;
          font-weight: 750;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
        }

        .section-count {
          min-height: 26px;
          padding: 0 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          min-width: 1080px;
          border-collapse: collapse;
        }

        .data-table th {
          padding: 11px 13px;
          border-bottom: 1px solid #e5e7eb;
          background: #f8fafc;
          color: #64748b;
          font-size: 10px;
          font-weight: 750;
          text-align: left;
          white-space: nowrap;
        }

        .data-table td {
          padding: 13px;
          border-bottom: 1px solid #eef2f7;
          color: #475569;
          font-size: 12px;
          vertical-align: middle;
        }

        .data-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .data-table tfoot td {
          padding: 13px;
          border-top: 1px solid #e5e7eb;
          background: #f8fafc;
          color: #334155;
          font-size: 12px;
        }

        .data-table th.numeric,
        .data-table td.numeric {
          text-align: right;
        }

        .total-label {
          color: #111827 !important;
          font-weight: 750;
        }

        .product-cell {
          min-width: 240px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .product-cell strong {
          color: #111827;
          font-size: 12px;
        }

        .product-cell span {
          color: #64748b;
          font-size: 11px;
        }

        .product-cell small {
          color: #94a3b8;
          font-size: 10px;
        }

        .tracking-badge {
          min-height: 24px;
          padding: 0 8px;
          display: inline-flex;
          align-items: center;
          border-radius: 7px;
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .sku-text {
          color: #64748b;
          font-size: 11px;
        }

        .received-value {
          color: #166534;
        }

        .remaining-value {
          color: #b45309;
        }

        .complete-value {
          color: #166534;
        }

        .info-list {
          padding: 6px 18px 12px;
        }

        .info-list > div {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 11px 0;
          border-bottom: 1px solid #eef2f7;
        }

        .info-list > div:last-child {
          border-bottom: 0;
        }

        .info-list span {
          color: #94a3b8;
          font-size: 11px;
        }

        .info-list strong {
          max-width: 62%;
          color: #334155;
          font-size: 11px;
          font-weight: 700;
          text-align: right;
          overflow-wrap: anywhere;
        }

        .supplier-link {
          padding: 0 18px 16px;
        }

        .supplier-link a {
          color: #166534;
          font-size: 11px;
          font-weight: 700;
          text-decoration: none;
        }

        .cost-list {
          padding: 8px 18px 15px;
        }

        .cost-list > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 10px 0;
          border-bottom: 1px solid #eef2f7;
        }

        .cost-list > div:last-child {
          border-bottom: 0;
        }

        .cost-list span {
          color: #64748b;
          font-size: 11px;
        }

        .cost-list strong {
          color: #334155;
          font-size: 11px;
        }

        .cost-list .cost-total {
          margin-top: 3px;
          padding-top: 13px;
          border-top: 1px solid #dbe2ea;
        }

        .cost-list .cost-total span,
        .cost-list .cost-total strong {
          color: #111827;
          font-size: 13px;
          font-weight: 750;
        }

        .empty-state {
          min-height: 230px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 25px;
          text-align: center;
        }

        .empty-state strong {
          color: #111827;
          font-size: 14px;
        }

        .empty-state span {
          max-width: 420px;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
        }

        .history-empty {
          min-height: 270px;
        }

        .history-empty .primary-button {
          margin-top: 7px;
        }

        .notes-preview {
          display: block;
          max-width: 300px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .notes-grid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 18px;
          margin-bottom: 18px;
        }

        .text-content {
          padding: 18px;
          color: #475569;
          font-size: 12px;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        @media (max-width: 1300px) {
          .stats-grid {
            grid-template-columns:
              repeat(
                3,
                minmax(0, 1fr)
              );
          }

          .hero-meta {
            min-width: 330px;
          }
        }

        @media (max-width: 1050px) {
          .hero-card {
            flex-direction: column;
          }

          .hero-meta {
            width: 100%;
            min-width: 0;
          }

          .content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 20px;
          }

          .top-bar {
            align-items: stretch;
            flex-direction: column;
          }

          .top-actions {
            width: 100%;
          }

          .top-actions
            .secondary-button,
          .top-actions
            .primary-button {
            flex: 1;
          }

          .stats-grid {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }

          .hero-meta {
            grid-template-columns: 1fr;
          }

          .hero-meta > div {
            padding-left: 0;
            padding-top: 12px;
            border-left: 0;
            border-top: 1px solid
              #eef2f7;
          }

          .notes-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .top-actions {
            flex-direction: column;
          }

          .top-actions
            .secondary-button,
          .top-actions
            .primary-button {
            width: 100%;
            flex: none;
          }

          .progress-footer {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media print {
          .top-bar,
          .progress-link {
            display: none !important;
          }

          .page-content {
            padding: 0;
          }

          .hero-card,
          .stat-card,
          .progress-card,
          .content-card {
            box-shadow: none;
          }

          .content-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AppShell>
  );
}