"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Package,
  Pencil,
  Printer,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";

type PurchaseOrder = {
  id: string;
  company_id: string;
  supplier_id: string;
  po_number: string;
  status: string;
  currency: string;
  order_date: string;
  expected_date: string | null;
  warehouse_id: string | null;
  supplier_reference: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
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
  product_id: string;
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
  legal_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  status: string;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  state: string | null;
  country: string | null;
  is_active: boolean;
  is_default: boolean;
};

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon: ReactNode;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  confirmed: "Confirmed",
  partially_received: "Partially Received",
  received: "Received",
  cancelled: "Cancelled",
};

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${currency || "USD"} ${Number(value || 0).toFixed(2)}`;
  }
}

function number(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getStatusClass(status: string) {
  switch (status) {
    case "draft":
      return "status status-draft";
    case "sent":
      return "status status-sent";
    case "confirmed":
      return "status status-confirmed";
    case "partially_received":
      return "status status-partial";
    case "received":
      return "status status-received";
    case "cancelled":
      return "status status-cancelled";
    default:
      return "status";
  }
}

function isOverdue(po: PurchaseOrder) {
  if (!po.expected_date) return false;

  if (
    po.status === "received" ||
    po.status === "cancelled"
  ) {
    return false;
  }

  const expected = new Date(`${po.expected_date}T23:59:59`);
  return expected.getTime() < Date.now();
}

function StatCard({
  label,
  value,
  helper,
  icon,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div className="stat-copy">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>

        {helper ? (
          <div className="stat-helper">{helper}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();

  const purchaseOrderId = String(
    params?.purchaseOrderId || ""
  );

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [purchaseOrder, setPurchaseOrder] =
    useState<PurchaseOrder | null>(null);

  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);

  const loadPurchaseOrder = useCallback(async () => {
    if (!purchaseOrderId) {
      setErrorMessage("Purchase order ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
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

      if (!membership?.company_id) {
        throw new Error(
          "No company workspace is available for this account."
        );
      }

      const companyId = membership.company_id;

      const {
        data: po,
        error: poError,
      } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", purchaseOrderId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (poError) {
        throw poError;
      }

      if (!po) {
        throw new Error(
          "Purchase order not found or you do not have access to it."
        );
      }

      const {
        data: poItems,
        error: itemsError,
      } = await supabase
        .from("purchase_order_items")
        .select("*")
        .eq("purchase_order_id", po.id)
        .eq("company_id", companyId)
        .order("created_at", {
          ascending: true,
        });

      if (itemsError) {
        throw itemsError;
      }

      let supplierData: Supplier | null = null;

      if (po.supplier_id) {
        const {
          data,
          error,
        } = await supabase
          .from("suppliers")
          .select(
            "id,legal_name,display_name,email,phone,status"
          )
          .eq("id", po.supplier_id)
          .eq("company_id", companyId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        supplierData = data as Supplier | null;
      }

      let warehouseData: Warehouse | null = null;

      if (po.warehouse_id) {
        const {
          data,
          error,
        } = await supabase
          .from("warehouses")
          .select(
            "id,name,code,city,state,country,is_active,is_default"
          )
          .eq("id", po.warehouse_id)
          .eq("company_id", companyId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        warehouseData = data as Warehouse | null;
      }

      setPurchaseOrder(po as PurchaseOrder);
      setItems(
        (poItems || []) as PurchaseOrderItem[]
      );
      setSupplier(supplierData);
      setWarehouse(warehouseData);
    } catch (error) {
      console.error(error);

      setPurchaseOrder(null);
      setItems([]);
      setSupplier(null);
      setWarehouse(null);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load purchase order."
      );
    } finally {
      setLoading(false);
    }
  }, [purchaseOrderId, router, supabase]);

  useEffect(() => {
    loadPurchaseOrder();
  }, [loadPurchaseOrder]);

  const totals = useMemo(() => {
    const ordered = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    const received = items.reduce(
      (sum, item) =>
        sum + Number(item.received_quantity || 0),
      0
    );

    const remaining = Math.max(
      ordered - received,
      0
    );

    const receivedValue = items.reduce(
      (sum, item) =>
        sum +
        Number(item.received_quantity || 0) *
          Number(item.unit_cost || 0),
      0
    );

    const remainingValue = items.reduce(
      (sum, item) =>
        sum +
        Math.max(
          Number(item.quantity || 0) -
            Number(item.received_quantity || 0),
          0
        ) *
          Number(item.unit_cost || 0),
      0
    );

    const progress =
      ordered > 0
        ? Math.min(
            Math.round((received / ordered) * 100),
            100
          )
        : 0;

    return {
      ordered,
      received,
      remaining,
      receivedValue,
      remainingValue,
      progress,
    };
  }, [items]);

  const canReceive =
    purchaseOrder &&
    purchaseOrder.status !== "cancelled" &&
    purchaseOrder.status !== "received" &&
    totals.remaining > 0;

  const canEdit =
    purchaseOrder &&
    purchaseOrder.status === "draft";

  const canSend =
    purchaseOrder &&
    purchaseOrder.status === "draft";

  const canConfirm =
    purchaseOrder &&
    purchaseOrder.status === "sent";

  const canCancel =
    purchaseOrder &&
    ["draft", "sent", "confirmed", "partially_received"].includes(
      purchaseOrder.status
    );

  async function updateStatus(
    nextStatus: "sent" | "confirmed" | "cancelled"
  ) {
    if (!purchaseOrder) return;

    const labels: Record<string, string> = {
      sent: "send this purchase order",
      confirmed: "confirm this purchase order",
      cancelled: "cancel this purchase order",
    };

    const confirmed = window.confirm(
      `Are you sure you want to ${labels[nextStatus]}?`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
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

      if (!membership?.company_id) {
        throw new Error(
          "No company workspace is available."
        );
      }

      const { error } = await supabase.rpc(
        "update_purchase_order_status",
        {
          p_company_id: membership.company_id,
          p_purchase_order_id: purchaseOrder.id,
          p_status: nextStatus,
        }
      );

      if (error) {
        throw error;
      }

      const successText =
        nextStatus === "sent"
          ? "Purchase order sent successfully."
          : nextStatus === "confirmed"
            ? "Purchase order confirmed successfully."
            : "Purchase order cancelled successfully.";

      setSuccessMessage(successText);

      await loadPurchaseOrder();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update purchase order status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="loading-card">
            <div className="spinner" />
            <span>Loading purchase order...</span>
          </div>

          <style jsx>{styles}</style>
        </div>
      </AppShell>
    );
  }

  if (!purchaseOrder) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="empty-card">
            <div className="empty-icon">
              <FileText size={24} />
            </div>

            <h2>Purchase order unavailable</h2>

            <p>
              {errorMessage ||
                "The purchase order could not be loaded."}
            </p>

            <div className="empty-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  router.push("/purchase-orders")
                }
              >
                <ArrowLeft size={16} />
                Back to Purchase Orders
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={loadPurchaseOrder}
              >
                <RotateCcw size={16} />
                Try Again
              </button>
            </div>
          </div>

          <style jsx>{styles}</style>
        </div>
      </AppShell>
    );
  }

  const currency = purchaseOrder.currency || "USD";

  const supplierName =
    supplier?.display_name ||
    supplier?.legal_name ||
    "Supplier unavailable";

  const overdue = isOverdue(purchaseOrder);

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="page-header">
          <div className="header-left">
            <button
              type="button"
              className="back-button"
              onClick={() =>
                router.push("/purchase-orders")
              }
            >
              <ArrowLeft size={16} />
              Purchase Orders
            </button>

            <div className="eyebrow">
              <span className="eyebrow-dot" />
              PROCUREMENT
            </div>

            <div className="title-row">
              <h1 className="page-title">
                {purchaseOrder.po_number}
              </h1>

              <span
                className={getStatusClass(
                  purchaseOrder.status
                )}
              >
                {STATUS_LABELS[
                  purchaseOrder.status
                ] || purchaseOrder.status}
              </span>

              {overdue ? (
                <span className="overdue-badge">
                  <CircleAlert size={14} />
                  Overdue
                </span>
              ) : null}
            </div>

            <p className="page-subtitle">
              Purchase order details, receiving progress,
              supplier information and procurement workflow.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrint}
            >
              <Printer size={16} />
              Print
            </button>

            {canEdit ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  router.push(
                    `/purchase-orders/new?edit=${purchaseOrder.id}`
                  )
                }
              >
                <Pencil size={16} />
                Edit
              </button>
            ) : null}

            {canSend ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={actionLoading}
                onClick={() => updateStatus("sent")}
              >
                <Truck size={16} />
                Mark Sent
              </button>
            ) : null}

            {canConfirm ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={actionLoading}
                onClick={() =>
                  updateStatus("confirmed")
                }
              >
                <CheckCircle2 size={16} />
                Confirm
              </button>
            ) : null}

            {canReceive ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  router.push(
                    `/purchase-orders/${purchaseOrder.id}/receive`
                  )
                }
              >
                <Package size={16} />
                Receive Stock
              </button>
            ) : null}

            {canCancel ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={actionLoading}
                onClick={() =>
                  updateStatus("cancelled")
                }
              >
                <XCircle size={16} />
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        {errorMessage ? (
          <div className="alert alert-error">
            <CircleAlert size={18} />
            <div>
              <strong>Something went wrong</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        ) : null}

        {successMessage ? (
          <div className="alert alert-success">
            <CheckCircle2 size={18} />
            <div>
              <strong>Success</strong>
              <span>{successMessage}</span>
            </div>
          </div>
        ) : null}

        <div className="stats-grid">
          <StatCard
            label="Order Total"
            value={money(
              purchaseOrder.total_amount,
              currency
            )}
            helper={currency}
            icon={<FileText size={19} />}
          />

          <StatCard
            label="Units Ordered"
            value={number(totals.ordered)}
            helper={`${items.length} line ${
              items.length === 1 ? "item" : "items"
            }`}
            icon={<Package size={19} />}
          />

          <StatCard
            label="Units Received"
            value={number(totals.received)}
            helper={`${totals.progress}% received`}
            icon={<CheckCircle2 size={19} />}
          />

          <StatCard
            label="Remaining Units"
            value={number(totals.remaining)}
            helper={
              totals.remaining > 0
                ? "Still to receive"
                : "Fully received"
            }
            icon={<Truck size={19} />}
          />

          <StatCard
            label="Receiving Progress"
            value={`${totals.progress}%`}
            helper={`${number(
              totals.received
            )} of ${number(totals.ordered)}`}
            icon={<Clock3 size={19} />}
          />

          <StatCard
            label="Remaining Value"
            value={money(
              totals.remainingValue,
              currency
            )}
            helper={
              totals.remaining > 0
                ? "Open procurement value"
                : "No remaining value"
            }
            icon={<RotateCcw size={19} />}
          />
        </div>

        <div className="main-grid">
          <section className="content-card items-card">
            <div className="card-header">
              <div>
                <div className="card-eyebrow">
                  PURCHASE ORDER
                </div>

                <h2>Order Items</h2>

                <p>
                  Products and current receiving progress.
                </p>
              </div>

              {canReceive ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    router.push(
                      `/purchase-orders/${purchaseOrder.id}/receive`
                    )
                  }
                >
                  <Package size={16} />
                  Receive Remaining
                </button>
              ) : null}
            </div>

            <div className="table-wrap">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
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
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="table-empty"
                      >
                        No line items found for this
                        purchase order.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const ordered =
                        Number(item.quantity || 0);

                      const received =
                        Number(
                          item.received_quantity || 0
                        );

                      const remaining = Math.max(
                        ordered - received,
                        0
                      );

                      const itemProgress =
                        ordered > 0
                          ? Math.min(
                              Math.round(
                                (received / ordered) *
                                  100
                              ),
                              100
                            )
                          : 0;

                      const itemComplete =
                        remaining <= 0;

                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="product-cell">
                              <div className="product-icon">
                                <Package size={16} />
                              </div>

                              <div>
                                <div className="product-name">
                                  {item.product_name}
                                </div>

                                {item.variant_name ? (
                                  <div className="product-variant">
                                    {item.variant_name}
                                  </div>
                                ) : null}

                                {item.description ? (
                                  <div className="product-description">
                                    {item.description}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="sku-stack">
                              <span>
                                {item.sku || "—"}
                              </span>

                              {item.supplier_sku ? (
                                <small>
                                  Supplier:{" "}
                                  {item.supplier_sku}
                                </small>
                              ) : null}
                            </div>
                          </td>

                          <td className="numeric strong">
                            {number(ordered)}
                          </td>

                          <td className="numeric">
                            {number(received)}
                          </td>

                          <td className="numeric">
                            <span
                              className={
                                remaining > 0
                                  ? "remaining-value"
                                  : "complete-value"
                              }
                            >
                              {number(remaining)}
                            </span>
                          </td>

                          <td className="numeric">
                            {money(
                              Number(
                                item.unit_cost || 0
                              ),
                              currency
                            )}
                          </td>

                          <td className="numeric strong">
                            {money(
                              Number(
                                item.line_total || 0
                              ),
                              currency
                            )}
                          </td>

                          <td>
                            <div className="item-status">
                              <div className="progress-track">
                                <div
                                  className="progress-fill"
                                  style={{
                                    width: `${itemProgress}%`,
                                  }}
                                />
                              </div>

                              <span
                                className={
                                  itemComplete
                                    ? "item-complete"
                                    : "item-open"
                                }
                              >
                                {itemComplete
                                  ? "Received"
                                  : `${itemProgress}% received`}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="side-column">
            <section className="content-card">
              <div className="card-header compact">
                <div>
                  <div className="card-eyebrow">
                    SUPPLIER
                  </div>

                  <h2>{supplierName}</h2>
                </div>
              </div>

              <div className="detail-list">
                <div className="detail-row">
                  <span>Status</span>

                  <strong>
                    {supplier?.status
                      ? supplier.status
                          .charAt(0)
                          .toUpperCase() +
                        supplier.status.slice(1)
                      : "—"}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Email</span>

                  <strong className="breakable">
                    {supplier?.email || "—"}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Phone</span>

                  <strong>
                    {supplier?.phone || "—"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="content-card">
              <div className="card-header compact">
                <div>
                  <div className="card-eyebrow">
                    RECEIVING
                  </div>

                  <h2>Warehouse</h2>
                </div>

                <div className="warehouse-icon">
                  <Package size={18} />
                </div>
              </div>

              {warehouse ? (
                <div className="warehouse-panel">
                  <div className="warehouse-name">
                    {warehouse.name}
                  </div>

                  <div className="warehouse-code">
                    {warehouse.code}
                  </div>

                  <div className="warehouse-location">
                    {[
                      warehouse.city,
                      warehouse.state,
                      warehouse.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Address unavailable"}
                  </div>

                  <div className="warehouse-meta">
                    {warehouse.is_default ? (
                      <span className="default-badge">
                        Default Warehouse
                      </span>
                    ) : null}

                    {!warehouse.is_active ? (
                      <span className="inactive-badge">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="no-data">
                  <span>
                    No receiving warehouse was assigned
                    to this purchase order.
                  </span>
                </div>
              )}
            </section>

            <section className="content-card">
              <div className="card-header compact">
                <div>
                  <div className="card-eyebrow">
                    FINANCIALS
                  </div>

                  <h2>Order Summary</h2>
                </div>
              </div>

              <div className="financial-list">
                <div>
                  <span>Subtotal</span>
                  <strong>
                    {money(
                      purchaseOrder.subtotal,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>Discount</span>
                  <strong className="discount">
                    -
                    {money(
                      purchaseOrder.discount_amount,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>Tax</span>
                  <strong>
                    {money(
                      purchaseOrder.tax_amount,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>Shipping</span>
                  <strong>
                    {money(
                      purchaseOrder.shipping_amount,
                      currency
                    )}
                  </strong>
                </div>

                <div className="financial-total">
                  <span>Total</span>
                  <strong>
                    {money(
                      purchaseOrder.total_amount,
                      currency
                    )}
                  </strong>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div className="bottom-grid">
          <section className="content-card">
            <div className="card-header compact">
              <div>
                <div className="card-eyebrow">
                  ORDER INFORMATION
                </div>

                <h2>Purchase Details</h2>
              </div>
            </div>

            <div className="info-grid">
              <div className="info-item">
                <span>PO Number</span>
                <strong>
                  {purchaseOrder.po_number}
                </strong>
              </div>

              <div className="info-item">
                <span>Order Date</span>
                <strong>
                  {formatDate(
                    purchaseOrder.order_date
                  )}
                </strong>
              </div>

              <div className="info-item">
                <span>Expected Date</span>
                <strong
                  className={
                    overdue ? "overdue-text" : ""
                  }
                >
                  {formatDate(
                    purchaseOrder.expected_date
                  )}
                </strong>
              </div>

              <div className="info-item">
                <span>Currency</span>
                <strong>{currency}</strong>
              </div>

              <div className="info-item">
                <span>Supplier Reference</span>
                <strong>
                  {purchaseOrder.supplier_reference ||
                    "—"}
                </strong>
              </div>

              <div className="info-item">
                <span>Created</span>
                <strong>
                  {formatDateTime(
                    purchaseOrder.created_at
                  )}
                </strong>
              </div>

              <div className="info-item">
                <span>Last Updated</span>
                <strong>
                  {formatDateTime(
                    purchaseOrder.updated_at
                  )}
                </strong>
              </div>

              <div className="info-item">
                <span>Approved</span>
                <strong>
                  {formatDateTime(
                    purchaseOrder.approved_at
                  )}
                </strong>
              </div>
            </div>
          </section>

          <section className="content-card workflow-card">
            <div className="card-header compact">
              <div>
                <div className="card-eyebrow">
                  WORKFLOW
                </div>

                <h2>Procurement Progress</h2>
              </div>
            </div>

            <div className="workflow">
              <WorkflowStep
                title="Draft"
                active={true}
                complete={
                  purchaseOrder.status !== "draft"
                }
                helper={
                  purchaseOrder.status === "draft"
                    ? "Order is being prepared"
                    : "Purchase order created"
                }
              />

              <WorkflowConnector
                active={
                  [
                    "sent",
                    "confirmed",
                    "partially_received",
                    "received",
                  ].includes(
                    purchaseOrder.status
                  )
                }
              />

              <WorkflowStep
                title="Sent"
                active={[
                  "sent",
                  "confirmed",
                  "partially_received",
                  "received",
                ].includes(
                  purchaseOrder.status
                )}
                complete={[
                  "confirmed",
                  "partially_received",
                  "received",
                ].includes(
                  purchaseOrder.status
                )}
                helper={
                  purchaseOrder.sent_at
                    ? formatDateTime(
                        purchaseOrder.sent_at
                      )
                    : "Awaiting supplier dispatch"
                }
              />

              <WorkflowConnector
                active={[
                  "confirmed",
                  "partially_received",
                  "received",
                ].includes(
                  purchaseOrder.status
                )}
              />

              <WorkflowStep
                title="Confirmed"
                active={[
                  "confirmed",
                  "partially_received",
                  "received",
                ].includes(
                  purchaseOrder.status
                )}
                complete={[
                  "partially_received",
                  "received",
                ].includes(
                  purchaseOrder.status
                )}
                helper={
                  purchaseOrder.approved_at
                    ? formatDateTime(
                        purchaseOrder.approved_at
                      )
                    : "Awaiting confirmation"
                }
              />

              <WorkflowConnector
                active={[
                  "partially_received",
                  "received",
                ].includes(
                  purchaseOrder.status
                )}
              />

              <WorkflowStep
                title="Receiving"
                active={[
                  "partially_received",
                  "received",
                ].includes(
                  purchaseOrder.status
                )}
                complete={
                  purchaseOrder.status ===
                  "received"
                }
                helper={
                  purchaseOrder.status ===
                  "received"
                    ? "All ordered stock received"
                    : purchaseOrder.status ===
                        "partially_received"
                      ? `${number(
                          totals.received
                        )} of ${number(
                          totals.ordered
                        )} units received`
                      : "Waiting for stock receipt"
                }
              />
            </div>
          </section>
        </div>

        {purchaseOrder.notes ||
        purchaseOrder.terms ? (
          <div className="notes-grid">
            {purchaseOrder.notes ? (
              <section className="content-card">
                <div className="card-header compact">
                  <div>
                    <div className="card-eyebrow">
                      NOTES
                    </div>

                    <h2>Internal Notes</h2>
                  </div>
                </div>

                <div className="text-panel">
                  {purchaseOrder.notes}
                </div>
              </section>
            ) : null}

            {purchaseOrder.terms ? (
              <section className="content-card">
                <div className="card-header compact">
                  <div>
                    <div className="card-eyebrow">
                      TERMS
                    </div>

                    <h2>Purchase Terms</h2>
                  </div>
                </div>

                <div className="text-panel">
                  {purchaseOrder.terms}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {canReceive ? (
          <section className="receive-banner">
            <div className="receive-banner-icon">
              <Package size={22} />
            </div>

            <div className="receive-banner-copy">
              <strong>
                {number(totals.remaining)} units are
                still waiting to be received
              </strong>

              <span>
                Continue to receiving to select the
                warehouse/location, create the batch,
                and optionally record serial numbers.
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                router.push(
                  `/purchase-orders/${purchaseOrder.id}/receive`
                )
              }
            >
              Receive Stock
              <ChevronRight size={16} />
            </button>
          </section>
        ) : null}

        <style jsx global>{`
          @media print {
            body {
              background: white !important;
            }

            nav,
            aside,
            header,
            .header-actions,
            .back-button,
            .receive-banner,
            .alert,
            button {
              display: none !important;
            }

            .page-content {
              padding: 0 !important;
              max-width: none !important;
            }

            .content-card,
            .stat-card {
              box-shadow: none !important;
              break-inside: avoid;
            }
          }
        `}</style>

        <style jsx>{styles}</style>
      </div>
    </AppShell>
  );
}

function WorkflowStep({
  title,
  active,
  complete,
  helper,
}: {
  title: string;
  active: boolean;
  complete: boolean;
  helper: string;
}) {
  return (
    <div
      className={`workflow-step ${
        active ? "workflow-active" : ""
      }`}
    >
      <div
        className={`workflow-dot ${
          complete
            ? "workflow-complete"
            : active
              ? "workflow-current"
              : ""
        }`}
      >
        {complete ? (
          <CheckCircle2 size={16} />
        ) : (
          <span />
        )}
      </div>

      <div>
        <strong>{title}</strong>
        <span>{helper}</span>
      </div>
    </div>
  );
}

function WorkflowConnector({
  active,
}: {
  active: boolean;
}) {
  return (
    <div
      className={`workflow-connector ${
        active ? "connector-active" : ""
      }`}
    />
  );
}

const styles = `
  .inventory-page {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    padding: 28px 30px 50px;
    color: #0f172a;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
    margin-bottom: 24px;
  }

  .header-left {
    min-width: 0;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 0;
    background: transparent;
    padding: 0;
    margin-bottom: 16px;
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .back-button:hover {
    color: #166534;
  }

  .eyebrow,
  .card-eyebrow {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #64748b;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .eyebrow {
    margin-bottom: 7px;
  }

  .eyebrow-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #16a34a;
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
    font-size: 30px;
    line-height: 1.15;
    font-weight: 800;
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
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 9px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid transparent;
    font-size: 13px;
    font-weight: 750;
    text-decoration: none;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      transform 0.15s ease;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #166534;
    border-color: #166534;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #14532d;
    border-color: #14532d;
  }

  .btn-secondary {
    background: white;
    border-color: #cbd5e1;
    color: #334155;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #94a3b8;
  }

  .btn-danger {
    background: white;
    border-color: #fecaca;
    color: #b91c1c;
  }

  .btn-danger:hover:not(:disabled) {
    background: #fef2f2;
    border-color: #fca5a5;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .stat-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-height: 108px;
    padding: 17px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    box-shadow: 0 2px 7px rgba(15, 23, 42, 0.04);
  }

  .stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    border-radius: 10px;
    background: #f0fdf4;
    color: #166534;
  }

  .stat-copy {
    min-width: 0;
  }

  .stat-label {
    color: #64748b;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-value {
    margin-top: 5px;
    color: #0f172a;
    font-size: 20px;
    font-weight: 800;
    line-height: 1.15;
    word-break: break-word;
  }

  .stat-helper {
    margin-top: 5px;
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.35;
  }

  .main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 350px;
    gap: 18px;
    align-items: start;
  }

  .bottom-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    gap: 18px;
    margin-top: 18px;
  }

  .notes-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
    margin-top: 18px;
  }

  .side-column {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .content-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    box-shadow: 0 2px 7px rgba(15, 23, 42, 0.04);
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 19px 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .card-header.compact {
    padding-bottom: 15px;
  }

  .card-header h2 {
    margin: 5px 0 0;
    color: #0f172a;
    font-size: 16px;
    font-weight: 800;
  }

  .card-header p {
    margin: 4px 0 0;
    color: #64748b;
    font-size: 12px;
  }

  .table-wrap {
    width: 100%;
    overflow-x: auto;
  }

  .items-table {
    width: 100%;
    min-width: 1060px;
    border-collapse: collapse;
  }

  .items-table th {
    padding: 12px 14px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
    color: #64748b;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .items-table td {
    padding: 14px;
    border-bottom: 1px solid #eef2f7;
    color: #334155;
    font-size: 12px;
    vertical-align: middle;
  }

  .items-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .items-table tbody tr:hover {
    background: #fafafa;
  }

  .numeric {
    text-align: right !important;
  }

  .strong {
    color: #0f172a !important;
    font-weight: 750;
  }

  .product-cell {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 240px;
  }

  .product-icon,
  .warehouse-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    border-radius: 9px;
    background: #f8fafc;
    color: #475569;
  }

  .product-name {
    color: #0f172a;
    font-weight: 750;
    line-height: 1.35;
  }

  .product-variant {
    margin-top: 3px;
    color: #64748b;
    font-size: 11px;
  }

  .product-description {
    max-width: 310px;
    margin-top: 4px;
    color: #94a3b8;
    font-size: 10px;
    line-height: 1.4;
  }

  .sku-stack {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .sku-stack span {
    color: #334155;
    font-weight: 650;
  }

  .sku-stack small {
    color: #94a3b8;
    font-size: 10px;
  }

  .remaining-value {
    color: #b45309;
    font-weight: 800;
  }

  .complete-value {
    color: #15803d;
    font-weight: 800;
  }

  .item-status {
    min-width: 115px;
  }

  .progress-track {
    width: 100%;
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
  }

  .progress-fill {
    height: 100%;
    border-radius: inherit;
    background: #16a34a;
  }

  .item-complete,
  .item-open {
    display: block;
    margin-top: 5px;
    font-size: 10px;
    font-weight: 750;
  }

  .item-complete {
    color: #15803d;
  }

  .item-open {
    color: #b45309;
  }

  .table-empty {
    padding: 50px !important;
    color: #94a3b8 !important;
    text-align: center !important;
  }

  .detail-list {
    padding: 4px 20px 18px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    padding: 11px 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .detail-row:last-child {
    border-bottom: 0;
  }

  .detail-row span {
    color: #64748b;
    font-size: 12px;
  }

  .detail-row strong {
    color: #334155;
    font-size: 12px;
    text-align: right;
  }

  .breakable {
    max-width: 180px;
    overflow-wrap: anywhere;
  }

  .warehouse-panel {
    padding: 18px 20px 20px;
  }

  .warehouse-name {
    color: #0f172a;
    font-size: 15px;
    font-weight: 800;
  }

  .warehouse-code {
    margin-top: 3px;
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
  }

  .warehouse-location {
    margin-top: 12px;
    color: #475569;
    font-size: 12px;
    line-height: 1.5;
  }

  .warehouse-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }

  .default-badge,
  .inactive-badge {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
  }

  .default-badge {
    background: #f0fdf4;
    color: #166534;
  }

  .inactive-badge {
    background: #fef2f2;
    color: #b91c1c;
  }

  .no-data {
    padding: 18px 20px 20px;
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.5;
  }

  .financial-list {
    padding: 7px 20px 18px;
  }

  .financial-list > div {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    padding: 9px 0;
    color: #64748b;
    font-size: 12px;
  }

  .financial-list strong {
    color: #334155;
  }

  .financial-list .discount {
    color: #b91c1c;
  }

  .financial-total {
    margin-top: 7px;
    padding-top: 15px !important;
    border-top: 1px solid #e5e7eb;
    color: #0f172a !important;
    font-size: 14px !important;
    font-weight: 800;
  }

  .financial-total strong {
    color: #0f172a;
    font-size: 16px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    background: #e5e7eb;
  }

  .info-item {
    min-height: 76px;
    padding: 14px 16px;
    background: white;
  }

  .info-item span {
    display: block;
    color: #94a3b8;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .info-item strong {
    display: block;
    margin-top: 6px;
    color: #334155;
    font-size: 12px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .overdue-text {
    color: #b91c1c !important;
  }

  .workflow {
    display: flex;
    align-items: flex-start;
    padding: 20px;
    overflow-x: auto;
  }

  .workflow-step {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    min-width: 110px;
  }

  .workflow-step > div:last-child {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .workflow-step strong {
    color: #94a3b8;
    font-size: 11px;
    font-weight: 800;
  }

  .workflow-step span {
    color: #cbd5e1;
    font-size: 9px;
    line-height: 1.4;
  }

  .workflow-active strong {
    color: #334155;
  }

  .workflow-active span {
    color: #64748b;
  }

  .workflow-dot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    border: 2px solid #e2e8f0;
    border-radius: 50%;
    background: white;
  }

  .workflow-dot span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #cbd5e1;
  }

  .workflow-current {
    border-color: #16a34a;
  }

  .workflow-current span {
    background: #16a34a;
  }

  .workflow-complete {
    border-color: #16a34a;
    background: #f0fdf4;
    color: #16a34a;
  }

  .workflow-connector {
    width: 32px;
    height: 2px;
    flex: 0 0 32px;
    margin: 12px 6px 0;
    background: #e2e8f0;
  }

  .connector-active {
    background: #86efac;
  }

  .text-panel {
    padding: 18px 20px 20px;
    color: #475569;
    font-size: 12px;
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .receive-banner {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-top: 18px;
    padding: 16px 18px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 14px;
  }

  .receive-banner-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    border-radius: 11px;
    background: white;
    color: #166534;
    border: 1px solid #dcfce7;
  }

  .receive-banner-copy {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
  }

  .receive-banner-copy strong {
    color: #14532d;
    font-size: 13px;
  }

  .receive-banner-copy span {
    color: #4d7c5b;
    font-size: 11px;
    line-height: 1.45;
  }

  .status {
    display: inline-flex;
    align-items: center;
    min-height: 25px;
    padding: 0 9px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
  }

  .status-draft {
    background: #f1f5f9;
    color: #475569;
  }

  .status-sent {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .status-confirmed {
    background: #f0fdf4;
    color: #166534;
  }

  .status-partial {
    background: #fffbeb;
    color: #a16207;
  }

  .status-received {
    background: #dcfce7;
    color: #15803d;
  }

  .status-cancelled {
    background: #fef2f2;
    color: #b91c1c;
  }

  .overdue-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 25px;
    padding: 0 9px;
    border-radius: 999px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 10px;
    font-weight: 800;
  }

  .alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 18px;
    padding: 13px 15px;
    border-radius: 11px;
    border: 1px solid;
  }

  .alert > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .alert strong {
    font-size: 12px;
  }

  .alert span {
    font-size: 11px;
    line-height: 1.45;
  }

  .alert-error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
  }

  .alert-success {
    background: #f0fdf4;
    border-color: #bbf7d0;
    color: #166534;
  }

  .loading-card,
  .empty-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 420px;
    padding: 40px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    text-align: center;
  }

  .loading-card {
    flex-direction: row;
    gap: 12px;
    color: #64748b;
    font-size: 13px;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #d1d5db;
    border-top-color: #166534;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    margin-bottom: 15px;
    border-radius: 14px;
    background: #f8fafc;
    color: #64748b;
  }

  .empty-card h2 {
    margin: 0;
    color: #0f172a;
    font-size: 18px;
  }

  .empty-card p {
    max-width: 520px;
    margin: 8px 0 20px;
    color: #64748b;
    font-size: 13px;
    line-height: 1.6;
  }

  .empty-actions {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
    justify-content: center;
  }

  @media (max-width: 1350px) {
    .stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 1100px) {
    .main-grid {
      grid-template-columns: 1fr;
    }

    .side-column {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .bottom-grid {
      grid-template-columns: 1fr;
    }

    .info-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 800px) {
    .inventory-page {
      padding: 20px 16px 40px;
    }

    .page-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
      justify-content: flex-start;
    }

    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .side-column {
      grid-template-columns: 1fr;
    }

    .notes-grid {
      grid-template-columns: 1fr;
    }

    .receive-banner {
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .receive-banner .btn {
      margin-left: 57px;
    }
  }

  @media (max-width: 520px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .page-title {
      font-size: 25px;
    }

    .header-actions .btn {
      flex: 1;
    }
  }
`;