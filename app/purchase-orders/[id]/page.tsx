"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  legal_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  currency: string;
  payment_terms_days: number;
};

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  is_default: boolean;
};

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string | null;
  location_type: string;
  is_active: boolean;
};

type PurchaseOrder = {
  id: string;
  company_id: string;
  supplier_id: string;
  po_number: string;
  status:
    | "draft"
    | "sent"
    | "confirmed"
    | "partially_received"
    | "received"
    | "cancelled";
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
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  approved_at: string | null;
};

type PurchaseOrderItem = {
  id: string;
  product_id: string;
  variant_id: string;
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
  product?: {
    tracking_mode: string | null;
  } | null;
};

type Receipt = {
  id: string;
  receipt_number: string;
  supplier_name: string | null;
  reference_number: string | null;
  notes: string | null;
  status: string;
  received_at: string;
};

type ReceiveLine = {
  purchase_order_item_id: string;
  quantity: number;
  serial_numbers: string[];
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  switch (status) {
    case "partially_received":
      return "Partially Received";
    case "confirmed":
      return "Confirmed";
    case "received":
      return "Received";
    case "cancelled":
      return "Cancelled";
    case "sent":
      return "Sent";
    default:
      return "Draft";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "received":
      return "status received";

    case "partially_received":
      return "status partial";

    case "confirmed":
      return "status confirmed";

    case "sent":
      return "status sent";

    case "cancelled":
      return "status cancelled";

    default:
      return "status draft";
  }
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const purchaseOrderId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [purchaseOrder, setPurchaseOrder] =
    useState<PurchaseOrder | null>(null);

  const [supplier, setSupplier] = useState<Supplier | null>(
    null
  );

  const [items, setItems] = useState<PurchaseOrderItem[]>(
    []
  );

  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const [warehouses, setWarehouses] = useState<Warehouse[]>(
    []
  );

  const [locations, setLocations] = useState<Location[]>(
    []
  );

  const [errorMessage, setErrorMessage] = useState("");

  const [showReceiveModal, setShowReceiveModal] =
    useState(false);

  const [receiveWarehouseId, setReceiveWarehouseId] =
    useState("");

  const [receiveLocationId, setReceiveLocationId] =
    useState("");

  const [receiveNotes, setReceiveNotes] = useState("");

  const [receiveLines, setReceiveLines] = useState<
    ReceiveLine[]
  >([]);

  useEffect(() => {
    loadPurchaseOrder();
  }, [purchaseOrderId]);

  async function loadPurchaseOrder() {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

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

      if (membershipError) throw membershipError;

      if (!membership?.company_id) {
        throw new Error(
          "No company is associated with your account."
        );
      }

      const currentCompanyId = membership.company_id;

      setCompanyId(currentCompanyId);

      const { data: poData, error: poError } =
        await supabase
          .from("purchase_orders")
          .select("*")
          .eq("id", purchaseOrderId)
          .eq("company_id", currentCompanyId)
          .single();

      if (poError) throw poError;

      const po = poData as PurchaseOrder;

      setPurchaseOrder(po);

      const [
        supplierResult,
        itemsResult,
        receiptsResult,
        warehousesResult,
      ] = await Promise.all([
        supabase
          .from("suppliers")
          .select(
            `
              id,
              legal_name,
              display_name,
              email,
              phone,
              currency,
              payment_terms_days
            `
          )
          .eq("id", po.supplier_id)
          .eq("company_id", currentCompanyId)
          .single(),

        supabase
          .from("purchase_order_items")
          .select(
            `
              id,
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
              product:products(
                tracking_mode
              )
            `
          )
          .eq("purchase_order_id", purchaseOrderId)
          .eq("company_id", currentCompanyId)
          .order("created_at"),

        supabase
          .from("stock_receipts")
          .select(
            `
              id,
              receipt_number,
              supplier_name,
              reference_number,
              notes,
              status,
              received_at
            `
          )
          .eq("purchase_order_id", purchaseOrderId)
          .eq("company_id", currentCompanyId)
          .order("received_at", {
            ascending: false,
          }),

        supabase
          .from("warehouses")
          .select(
            `
              id,
              name,
              code,
              is_active,
              is_default
            `
          )
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (supplierResult.error) {
        throw supplierResult.error;
      }

      if (itemsResult.error) {
        throw itemsResult.error;
      }

      if (receiptsResult.error) {
        throw receiptsResult.error;
      }

      if (warehousesResult.error) {
        throw warehousesResult.error;
      }

      setSupplier(
        (supplierResult.data ?? null) as Supplier | null
      );

      const normalizedItems: PurchaseOrderItem[] = (
        itemsResult.data ?? []
      ).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        supplier_product_id:
          item.supplier_product_id ?? null,
        product_name: item.product_name,
        variant_name: item.variant_name ?? null,
        sku: item.sku ?? null,
        supplier_sku: item.supplier_sku ?? null,
        description: item.description ?? null,
        quantity: Number(item.quantity ?? 0),
        received_quantity: Number(
          item.received_quantity ?? 0
        ),
        unit_cost: Number(item.unit_cost ?? 0),
        discount_amount: Number(
          item.discount_amount ?? 0
        ),
        tax_amount: Number(item.tax_amount ?? 0),
        line_total: Number(item.line_total ?? 0),
        product: Array.isArray(item.product)
          ? item.product[0] ?? null
          : item.product ?? null,
      }));

      setItems(normalizedItems);

      setReceipts(
        (receiptsResult.data ?? []) as Receipt[]
      );

      const warehouseList =
        (warehousesResult.data ??
          []) as Warehouse[];

      setWarehouses(warehouseList);

      const defaultWarehouse =
        warehouseList.find(
          (warehouse) =>
            warehouse.id === po.warehouse_id
        ) ||
        warehouseList.find(
          (warehouse) => warehouse.is_default
        ) ||
        warehouseList[0];

      if (defaultWarehouse) {
        setReceiveWarehouseId(
          defaultWarehouse.id
        );

        await loadLocations(
          currentCompanyId,
          defaultWarehouse.id
        );
      }
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "Failed to load purchase order."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadLocations(
    currentCompanyId: string,
    warehouseId: string
  ) {
    const { data, error } = await supabase
      .from("warehouse_locations")
      .select(
        `
          id,
          warehouse_id,
          name,
          code,
          location_type,
          is_active
        `
      )
      .eq("company_id", currentCompanyId)
      .eq("warehouse_id", warehouseId)
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    setLocations((data ?? []) as Location[]);

    if (data && data.length > 0) {
      setReceiveLocationId(data[0].id);
    } else {
      setReceiveLocationId("");
    }
  }

  async function handleWarehouseChange(
    warehouseId: string
  ) {
    setReceiveWarehouseId(warehouseId);
    setReceiveLocationId("");
    setLocations([]);

    if (!companyId || !warehouseId) return;

    try {
      await loadLocations(
        companyId,
        warehouseId
      );
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          "Failed to load warehouse locations."
      );
    }
  }

  function getRemaining(item: PurchaseOrderItem) {
    return Math.max(
      0,
      item.quantity - item.received_quantity
    );
  }

  const totalOrdered = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalReceived = items.reduce(
    (sum, item) =>
      sum + item.received_quantity,
    0
  );

  const totalRemaining = Math.max(
    0,
    totalOrdered - totalReceived
  );

  const receivedPercentage =
    totalOrdered > 0
      ? Math.min(
          100,
          Math.round(
            (totalReceived / totalOrdered) *
              100
          )
        )
      : 0;

  const canReceive =
    purchaseOrder &&
    !["received", "cancelled"].includes(
      purchaseOrder.status
    ) &&
    totalRemaining > 0;

  function openReceiveModal() {
    setErrorMessage("");

    const initialLines: ReceiveLine[] =
      items
        .filter((item) => getRemaining(item) > 0)
        .map((item) => ({
          purchase_order_item_id: item.id,
          quantity: 0,
          serial_numbers: [],
        }));

    setReceiveLines(initialLines);

    setShowReceiveModal(true);
  }

  function updateReceiveQuantity(
    itemId: string,
    quantity: number
  ) {
    const item = items.find(
      (current) => current.id === itemId
    );

    if (!item) return;

    const remaining = getRemaining(item);

    setReceiveLines((current) =>
      current.map((line) =>
        line.purchase_order_item_id === itemId
          ? {
              ...line,
              quantity: Math.min(
                remaining,
                Math.max(
                  0,
                  Math.floor(quantity || 0)
                )
              ),
              serial_numbers:
                line.serial_numbers.slice(
                  0,
                  Math.min(
                    remaining,
                    Math.max(
                      0,
                      Math.floor(quantity || 0)
                    )
                  )
                ),
            }
          : line
      )
    );
  }

  function updateSerialNumbers(
    itemId: string,
    value: string
  ) {
    const serials = value
      .split(/\r?\n/)
      .map((serial) => serial.trim())
      .filter(Boolean);

    setReceiveLines((current) =>
      current.map((line) =>
        line.purchase_order_item_id === itemId
          ? {
              ...line,
              serial_numbers: serials,
              quantity:
                line.quantity === 0
                  ? serials.length
                  : line.quantity,
            }
          : line
      )
    );
  }

  async function handleReceive() {
    if (!companyId || !purchaseOrder) return;

    setErrorMessage("");

    if (!receiveWarehouseId) {
      setErrorMessage(
        "Please select a receiving warehouse."
      );
      return;
    }

    if (!receiveLocationId) {
      setErrorMessage(
        "Please select a receiving location."
      );
      return;
    }

    const activeLines = receiveLines.filter(
      (line) => line.quantity > 0
    );

    if (activeLines.length === 0) {
      setErrorMessage(
        "Enter a quantity for at least one item."
      );
      return;
    }

    for (const line of activeLines) {
      const item = items.find(
        (current) =>
          current.id ===
          line.purchase_order_item_id
      );

      if (!item) continue;

      const remaining = getRemaining(item);

      if (line.quantity > remaining) {
        setErrorMessage(
          `Cannot receive more than the remaining quantity for ${item.product_name}.`
        );
        return;
      }

      const trackingMode =
        item.product?.tracking_mode;

      if (trackingMode === "serial") {
        if (
          line.serial_numbers.length !==
          line.quantity
        ) {
          setErrorMessage(
            `${item.product_name} requires ${line.quantity} serial number(s).`
          );
          return;
        }

        const normalizedSerials =
          line.serial_numbers.map((serial) =>
            serial.toLowerCase()
          );

        if (
          new Set(normalizedSerials).size !==
          normalizedSerials.length
        ) {
          setErrorMessage(
            `Duplicate serial numbers found for ${item.product_name}.`
          );
          return;
        }
      }
    }

    try {
      setActionLoading(true);

      const payload = activeLines.map(
        (line) => ({
          purchase_order_item_id:
            line.purchase_order_item_id,
          quantity: line.quantity,
          serial_numbers:
            line.serial_numbers,
        })
      );

      const { data, error } =
        await supabase.rpc(
          "receive_purchase_order",
          {
            p_company_id: companyId,
            p_purchase_order_id:
              purchaseOrder.id,
            p_warehouse_id:
              receiveWarehouseId,
            p_location_id:
              receiveLocationId,
            p_items: payload,
            p_notes:
              receiveNotes.trim() || null,
          }
        );

      if (error) throw error;

      setShowReceiveModal(false);
      setReceiveNotes("");
      setReceiveLines([]);

      await loadPurchaseOrder();

      if (data) {
        console.log(
          "Goods receipt created:",
          data
        );
      }
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "Failed to receive purchase order."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function updateStatus(
    newStatus: "sent" | "confirmed" | "cancelled"
  ) {
    if (!companyId || !purchaseOrder) return;

    let confirmation =
      "Are you sure you want to continue?";

    if (newStatus === "sent") {
      confirmation =
        "Send this purchase order?";
    }

    if (newStatus === "confirmed") {
      confirmation =
        "Confirm this purchase order?";
    }

    if (newStatus === "cancelled") {
      confirmation =
        "Cancel this purchase order? This cannot be undone.";
    }

    if (!window.confirm(confirmation)) {
      return;
    }

    try {
      setActionLoading(true);
      setErrorMessage("");

      const { error } =
        await supabase.rpc(
          "update_purchase_order_status",
          {
            p_company_id: companyId,
            p_purchase_order_id:
              purchaseOrder.id,
            p_status: newStatus,
          }
        );

      if (error) throw error;

      await loadPurchaseOrder();
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "Failed to update purchase order status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function printPurchaseOrder() {
    window.print();
  }

  if (loading) {
    return (
      <AppShell
        title="Purchase Order"
        description="View and manage purchase order details."
      >
        <div className="page-content">
          <div className="loading-card">
            Loading purchase order...
          </div>
        </div>

        <style jsx>{`
          .page-content {
            padding: 28px;
          }

          .loading-card {
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 40px;
            text-align: center;
            color: #64748b;
          }
        `}</style>
      </AppShell>
    );
  }

  if (!purchaseOrder) {
    return (
      <AppShell
        title="Purchase Order"
        description="Purchase order not found."
      >
        <div className="page-content">
          <div className="error-card">
            <h2>Purchase order not found</h2>
            <p>
              {errorMessage ||
                "The purchase order may have been deleted or you may not have access to it."}
            </p>

            <Link
              href="/purchase-orders"
              className="primary-button"
            >
              Back to Purchase Orders
            </Link>
          </div>
        </div>

        <style jsx>{`
          .page-content {
            padding: 28px;
          }

          .error-card {
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 40px;
            text-align: center;
          }

          .error-card h2 {
            margin: 0 0 8px;
            color: #0f172a;
          }

          .error-card p {
            margin: 0 0 20px;
            color: #64748b;
          }

          .primary-button {
            display: inline-flex;
            height: 40px;
            padding: 0 16px;
            align-items: center;
            justify-content: center;
            border-radius: 9px;
            background: #0f172a;
            color: #fff;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
          }
        `}</style>
      </AppShell>
    );
  }

  const warehouse = warehouses.find(
    (item) =>
      item.id === purchaseOrder.warehouse_id
  );

  return (
    <AppShell
      title={purchaseOrder.po_number}
      description="View and manage purchase order details."
      actions={
        <div className="header-actions">
          <Link
            href="/purchase-orders"
            className="secondary-button"
          >
            Back
          </Link>

          <button
            type="button"
            className="secondary-button"
            onClick={printPurchaseOrder}
          >
            Print
          </button>

          {purchaseOrder.status ===
            "draft" && (
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                updateStatus("sent")
              }
              disabled={actionLoading}
            >
              Send PO
            </button>
          )}

          {purchaseOrder.status ===
            "sent" && (
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                updateStatus("confirmed")
              }
              disabled={actionLoading}
            >
              Confirm PO
            </button>
          )}

          {canReceive && (
            <button
              type="button"
              className="primary-button receive-button"
              onClick={openReceiveModal}
              disabled={actionLoading}
            >
              Receive
            </button>
          )}

          {!["received", "cancelled"].includes(
            purchaseOrder.status
          ) && (
            <button
              type="button"
              className="danger-button"
              onClick={() =>
                updateStatus("cancelled")
              }
              disabled={actionLoading}
            >
              Cancel
            </button>
          )}
        </div>
      }
    >
      <div className="page-content">
        {errorMessage && (
          <div className="error-banner">
            <strong>Unable to continue</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/purchase-orders">
                Purchase Orders
              </Link>
              <span>/</span>
              <span>
                {purchaseOrder.po_number}
              </span>
            </div>

            <div className="title-row">
              <h1>
                {purchaseOrder.po_number}
              </h1>

              <span
                className={statusClass(
                  purchaseOrder.status
                )}
              >
                {statusLabel(
                  purchaseOrder.status
                )}
              </span>
            </div>

            <p>
              Created{" "}
              {formatDateTime(
                purchaseOrder.created_at
              )}
            </p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span>Ordered Qty</span>
            <strong>{totalOrdered}</strong>
          </div>

          <div className="stat-card">
            <span>Received Qty</span>
            <strong>{totalReceived}</strong>
          </div>

          <div className="stat-card">
            <span>Remaining Qty</span>
            <strong>{totalRemaining}</strong>
          </div>

          <div className="stat-card">
            <span>Order Value</span>
            <strong>
              {money(
                purchaseOrder.total_amount,
                purchaseOrder.currency
              )}
            </strong>
          </div>
        </div>

        <div className="progress-card">
          <div className="progress-header">
            <div>
              <strong>
                Receiving Progress
              </strong>
              <span>
                {totalReceived} of{" "}
                {totalOrdered} units received
              </span>
            </div>

            <strong>
              {receivedPercentage}%
            </strong>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${receivedPercentage}%`,
              }}
            />
          </div>
        </div>

        <div className="content-grid">
          <div className="main-column">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2>Purchase Order Items</h2>
                  <p>
                    Products and quantities included
                    in this order.
                  </p>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Ordered</th>
                      <th>Received</th>
                      <th>Remaining</th>
                      <th>Unit Cost</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="empty-table"
                        >
                          No items found.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => {
                        const remaining =
                          getRemaining(item);

                        const trackingMode =
                          item.product
                            ?.tracking_mode;

                        return (
                          <tr key={item.id}>
                            <td>
                              <div className="product-name">
                                {
                                  item.product_name
                                }
                              </div>

                              {item.variant_name && (
                                <div className="variant-name">
                                  {
                                    item.variant_name
                                  }

                                  {trackingMode ===
                                    "serial" && (
                                    <span className="tracking-badge">
                                      Serialized
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td>
                              {item.sku ||
                                "—"}
                            </td>

                            <td>
                              {item.quantity}
                            </td>

                            <td>
                              <span className="received-number">
                                {
                                  item.received_quantity
                                }
                              </span>
                            </td>

                            <td>
                              <span
                                className={
                                  remaining > 0
                                    ? "remaining-number"
                                    : "complete-number"
                                }
                              >
                                {remaining}
                              </span>
                            </td>

                            <td>
                              {money(
                                item.unit_cost,
                                purchaseOrder.currency
                              )}
                            </td>

                            <td className="line-total">
                              {money(
                                item.line_total,
                                purchaseOrder.currency
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h2>Receiving History</h2>
                  <p>
                    Goods receipts recorded against
                    this purchase order.
                  </p>
                </div>
              </div>

              {receipts.length === 0 ? (
                <div className="empty-state">
                  <strong>
                    No receipts yet
                  </strong>

                  <span>
                    Received inventory will appear
                    here after you receive this PO.
                  </span>
                </div>
              ) : (
                <div className="receipt-list">
                  {receipts.map((receipt) => (
                    <div
                      className="receipt-row"
                      key={receipt.id}
                    >
                      <div className="receipt-icon">
                        GRN
                      </div>

                      <div className="receipt-main">
                        <strong>
                          {
                            receipt.receipt_number
                          }
                        </strong>

                        <span>
                          Received{" "}
                          {formatDateTime(
                            receipt.received_at
                          )}
                        </span>
                      </div>

                      <div className="receipt-reference">
                        <span>
                          Reference
                        </span>

                        <strong>
                          {
                            receipt.reference_number ||
                            purchaseOrder.po_number
                          }
                        </strong>
                      </div>

                      <span className="receipt-status">
                        {receipt.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {(purchaseOrder.notes ||
              purchaseOrder.terms) && (
              <section className="card">
                <div className="notes-grid">
                  {purchaseOrder.notes && (
                    <div>
                      <h3>Notes</h3>
                      <p className="long-text">
                        {purchaseOrder.notes}
                      </p>
                    </div>
                  )}

                  {purchaseOrder.terms && (
                    <div>
                      <h3>Terms & Conditions</h3>
                      <p className="long-text">
                        {purchaseOrder.terms}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <aside className="side-column">
            <section className="card info-card">
              <div className="card-header">
                <div>
                  <h2>Supplier</h2>
                </div>
              </div>

              {supplier ? (
                <div className="supplier-info">
                  <div className="supplier-name">
                    {supplier.display_name}
                  </div>

                  {supplier.legal_name !==
                    supplier.display_name && (
                    <div className="supplier-legal">
                      {supplier.legal_name}
                    </div>
                  )}

                  {supplier.email && (
                    <div className="info-line">
                      <span>Email</span>
                      <strong>
                        {supplier.email}
                      </strong>
                    </div>
                  )}

                  {supplier.phone && (
                    <div className="info-line">
                      <span>Phone</span>
                      <strong>
                        {supplier.phone}
                      </strong>
                    </div>
                  )}

                  <div className="info-line">
                    <span>Currency</span>
                    <strong>
                      {supplier.currency}
                    </strong>
                  </div>

                  <div className="info-line">
                    <span>Payment Terms</span>
                    <strong>
                      {supplier.payment_terms_days ||
                        0}{" "}
                      days
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="muted">
                  Supplier information
                  unavailable.
                </div>
              )}
            </section>

            <section className="card info-card">
              <div className="card-header">
                <div>
                  <h2>Order Details</h2>
                </div>
              </div>

              <div className="details-list">
                <div>
                  <span>PO Number</span>
                  <strong>
                    {purchaseOrder.po_number}
                  </strong>
                </div>

                <div>
                  <span>Order Date</span>
                  <strong>
                    {formatDate(
                      purchaseOrder.order_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Expected Delivery</span>
                  <strong>
                    {formatDate(
                      purchaseOrder.expected_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Warehouse</span>
                  <strong>
                    {warehouse
                      ? `${warehouse.name}${
                          warehouse.code
                            ? ` (${warehouse.code})`
                            : ""
                        }`
                      : "Not assigned"}
                  </strong>
                </div>

                <div>
                  <span>Supplier Reference</span>
                  <strong>
                    {purchaseOrder.supplier_reference ||
                      "—"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="card totals-card">
              <div className="card-header">
                <div>
                  <h2>Totals</h2>
                </div>
              </div>

              <div className="total-line">
                <span>Subtotal</span>
                <strong>
                  {money(
                    purchaseOrder.subtotal,
                    purchaseOrder.currency
                  )}
                </strong>
              </div>

              <div className="total-line">
                <span>Discount</span>
                <strong>
                  -
                  {money(
                    purchaseOrder.discount_amount,
                    purchaseOrder.currency
                  )}
                </strong>
              </div>

              <div className="total-line">
                <span>Tax</span>
                <strong>
                  {money(
                    purchaseOrder.tax_amount,
                    purchaseOrder.currency
                  )}
                </strong>
              </div>

              <div className="total-line">
                <span>Shipping</span>
                <strong>
                  {money(
                    purchaseOrder.shipping_amount,
                    purchaseOrder.currency
                  )}
                </strong>
              </div>

              <div className="total-divider" />

              <div className="grand-total">
                <span>Total</span>
                <strong>
                  {money(
                    purchaseOrder.total_amount,
                    purchaseOrder.currency
                  )}
                </strong>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {showReceiveModal && (
        <div className="modal-backdrop">
          <div className="receive-modal">
            <div className="modal-header">
              <div>
                <h2>Receive Purchase Order</h2>
                <p>
                  Record the inventory received
                  against {purchaseOrder.po_number}.
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() =>
                  setShowReceiveModal(false)
                }
                disabled={actionLoading}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="receive-info">
                <div>
                  <span>Remaining</span>
                  <strong>
                    {totalRemaining} units
                  </strong>
                </div>

                <div>
                  <span>Supplier</span>
                  <strong>
                    {supplier?.display_name ||
                      "—"}
                  </strong>
                </div>
              </div>

              <div className="receive-location-grid">
                <div className="field">
                  <label>
                    Warehouse <span>*</span>
                  </label>

                  <select
                    value={receiveWarehouseId}
                    onChange={(event) =>
                      handleWarehouseChange(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select warehouse
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
                      )
                    )}
                  </select>
                </div>

                <div className="field">
                  <label>
                    Location <span>*</span>
                  </label>

                  <select
                    value={receiveLocationId}
                    onChange={(event) =>
                      setReceiveLocationId(
                        event.target.value
                      )
                    }
                    disabled={
                      !receiveWarehouseId
                    }
                  >
                    <option value="">
                      Select location
                    </option>

                    {locations.map(
                      (location) => (
                        <option
                          key={location.id}
                          value={location.id}
                        >
                          {location.name}
                          {location.code
                            ? ` (${location.code})`
                            : ""}
                        </option>
                      )
                    )}
                  </select>

                  {receiveWarehouseId &&
                    locations.length === 0 && (
                      <small className="field-warning">
                        No active locations exist
                        in this warehouse.
                      </small>
                    )}
                </div>
              </div>

              <div className="receive-items">
                <div className="receive-items-header">
                  <span>Product</span>
                  <span>Remaining</span>
                  <span>Receive</span>
                </div>

                {items
                  .filter(
                    (item) =>
                      getRemaining(item) > 0
                  )
                  .map((item) => {
                    const line =
                      receiveLines.find(
                        (current) =>
                          current.purchase_order_item_id ===
                          item.id
                      );

                    const trackingMode =
                      item.product
                        ?.tracking_mode;

                    return (
                      <div
                        className="receive-item"
                        key={item.id}
                      >
                        <div className="receive-product">
                          <strong>
                            {
                              item.product_name
                            }
                          </strong>

                          <span>
                            {item.variant_name ||
                              "Default"}
                          </span>

                          {trackingMode ===
                            "serial" && (
                            <span className="serial-label">
                              Serial tracked
                            </span>
                          )}
                        </div>

                        <div className="remaining-cell">
                          {getRemaining(item)}
                        </div>

                        <div>
                          <input
                            className="receive-quantity"
                            type="number"
                            min="0"
                            max={getRemaining(
                              item
                            )}
                            step="1"
                            value={
                              line?.quantity || 0
                            }
                            onChange={(event) =>
                              updateReceiveQuantity(
                                item.id,
                                Number(
                                  event.target.value
                                )
                              )
                            }
                          />
                        </div>

                        {trackingMode ===
                          "serial" &&
                          (line?.quantity || 0) >
                            0 && (
                            <div className="serial-section">
                              <label>
                                Serial Numbers
                                <span>
                                  {" "}
                                  ({line?.quantity}{" "}
                                  required)
                                </span>
                              </label>

                              <textarea
                                rows={Math.min(
                                  8,
                                  Math.max(
                                    3,
                                    line?.quantity ||
                                      3
                                  )
                                )}
                                placeholder="Enter one serial number per line"
                                value={(
                                  line?.serial_numbers ||
                                  []
                                ).join("\n")}
                                onChange={(event) =>
                                  updateSerialNumbers(
                                    item.id,
                                    event.target
                                      .value
                                  )
                                }
                              />

                              <small>
                                Enter exactly{" "}
                                {line?.quantity}{" "}
                                unique serial
                                number(s).
                              </small>
                            </div>
                          )}
                      </div>
                    );
                  })}
              </div>

              <div className="field">
                <label>Receiving Notes</label>

                <textarea
                  rows={3}
                  value={receiveNotes}
                  onChange={(event) =>
                    setReceiveNotes(
                      event.target.value
                    )
                  }
                  placeholder="Optional notes about this delivery..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowReceiveModal(false)
                }
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={handleReceive}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Receiving..."
                  : "Complete Receiving"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-content {
          padding: 28px;
          background: #f8fafc;
          min-height: calc(100vh - 80px);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .page-header {
          max-width: 1500px;
          margin: 0 auto 20px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #94a3b8;
          font-size: 12px;
          margin-bottom: 9px;
        }

        .breadcrumb a {
          color: #64748b;
          text-decoration: none;
        }

        .breadcrumb a:hover {
          color: #0f172a;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .title-row h1 {
          margin: 0;
          color: #0f172a;
          font-size: 25px;
          line-height: 1.2;
          font-weight: 800;
        }

        .page-header p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .status {
          display: inline-flex;
          align-items: center;
          height: 27px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }

        .status.draft {
          background: #f1f5f9;
          color: #475569;
        }

        .status.sent {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status.confirmed {
          background: #fef3c7;
          color: #92400e;
        }

        .status.partial {
          background: #fff7ed;
          color: #c2410c;
        }

        .status.received {
          background: #ecfdf5;
          color: #047857;
        }

        .status.cancelled {
          background: #fef2f2;
          color: #b91c1c;
        }

        .stats-grid {
          max-width: 1500px;
          margin: 0 auto 18px;
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 14px;
        }

        .stat-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.04);
        }

        .stat-card span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-bottom: 7px;
        }

        .stat-card strong {
          display: block;
          color: #0f172a;
          font-size: 22px;
          font-weight: 800;
        }

        .progress-card {
          max-width: 1500px;
          margin: 0 auto 20px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.04);
        }

        .progress-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 11px;
        }

        .progress-header div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .progress-header strong {
          color: #0f172a;
          font-size: 13px;
        }

        .progress-header span {
          color: #64748b;
          font-size: 12px;
        }

        .progress-track {
          height: 8px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #0f172a;
          border-radius: inherit;
          transition: width 0.25s ease;
        }

        .content-grid {
          max-width: 1500px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 20px;
          align-items: start;
        }

        .main-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .side-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.04);
          overflow: hidden;
        }

        .card-header {
          padding: 20px 22px;
          border-bottom: 1px solid #f1f5f9;
        }

        .card-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 16px;
          font-weight: 700;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 12px 14px;
          text-align: left;
          white-space: nowrap;
          border-bottom: 1px solid #e5e7eb;
        }

        td {
          padding: 14px;
          color: #334155;
          font-size: 13px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        .product-name {
          color: #0f172a;
          font-weight: 600;
        }

        .variant-name {
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
        }

        .tracking-badge {
          display: inline-flex;
          margin-left: 7px;
          padding: 2px 6px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #475569;
          font-size: 9px;
          font-weight: 700;
        }

        .received-number {
          color: #047857;
          font-weight: 700;
        }

        .remaining-number {
          color: #c2410c;
          font-weight: 700;
        }

        .complete-number {
          color: #047857;
          font-weight: 700;
        }

        .line-total {
          color: #0f172a;
          font-weight: 700;
          white-space: nowrap;
        }

        .empty-table {
          padding: 35px;
          text-align: center;
          color: #64748b;
        }

        .info-card {
          padding-bottom: 20px;
        }

        .supplier-info {
          padding: 18px 22px 0;
        }

        .supplier-name {
          color: #0f172a;
          font-size: 16px;
          font-weight: 700;
        }

        .supplier-legal {
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
          margin-bottom: 14px;
        }

        .info-line {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 10px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .info-line:last-child {
          border-bottom: 0;
        }

        .info-line span,
        .details-list span {
          color: #94a3b8;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 700;
        }

        .info-line strong {
          color: #334155;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .muted {
          padding: 18px 22px 0;
          color: #64748b;
          font-size: 13px;
        }

        .details-list {
          padding: 5px 22px 0;
        }

        .details-list > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 11px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .details-list > div:last-child {
          border-bottom: 0;
        }

        .details-list strong {
          color: #334155;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .totals-card {
          padding-bottom: 18px;
        }

        .total-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 8px 22px;
          color: #64748b;
          font-size: 13px;
        }

        .total-line strong {
          color: #334155;
          font-weight: 600;
        }

        .total-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 10px 22px;
        }

        .grand-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 7px 22px;
        }

        .grand-total span {
          color: #0f172a;
          font-size: 14px;
          font-weight: 700;
        }

        .grand-total strong {
          color: #0f172a;
          font-size: 21px;
          font-weight: 800;
        }

        .empty-state {
          padding: 35px 22px;
          display: flex;
          align-items: center;
          flex-direction: column;
          gap: 5px;
          text-align: center;
        }

        .empty-state strong {
          color: #334155;
          font-size: 13px;
        }

        .empty-state span {
          color: #64748b;
          font-size: 12px;
        }

        .receipt-list {
          display: flex;
          flex-direction: column;
        }

        .receipt-row {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) 160px auto;
          align-items: center;
          gap: 14px;
          padding: 15px 22px;
          border-bottom: 1px solid #f1f5f9;
        }

        .receipt-row:last-child {
          border-bottom: 0;
        }

        .receipt-icon {
          width: 40px;
          height: 40px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          color: #475569;
          font-size: 9px;
          font-weight: 800;
        }

        .receipt-main {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .receipt-main strong {
          color: #0f172a;
          font-size: 13px;
        }

        .receipt-main span,
        .receipt-reference span {
          color: #64748b;
          font-size: 11px;
        }

        .receipt-reference {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .receipt-reference strong {
          color: #334155;
          font-size: 12px;
        }

        .receipt-status {
          padding: 5px 8px;
          border-radius: 999px;
          background: #ecfdf5;
          color: #047857;
          font-size: 10px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .notes-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 25px;
          padding: 22px;
        }

        .notes-grid h3 {
          margin: 0 0 8px;
          color: #0f172a;
          font-size: 13px;
        }

        .long-text {
          margin: 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .primary-button,
        .secondary-button,
        .danger-button {
          height: 40px;
          padding: 0 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          box-sizing: border-box;
        }

        .primary-button {
          background: #0f172a;
          color: #fff;
          border: 1px solid #0f172a;
        }

        .primary-button:hover:not(:disabled) {
          background: #1e293b;
        }

        .secondary-button {
          background: #fff;
          color: #334155;
          border: 1px solid #d1d5db;
        }

        .secondary-button:hover:not(:disabled) {
          background: #f8fafc;
        }

        .danger-button {
          background: #fff;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .danger-button:hover:not(:disabled) {
          background: #fef2f2;
        }

        .primary-button:disabled,
        .secondary-button:disabled,
        .danger-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .receive-button {
          background: #047857;
          border-color: #047857;
        }

        .receive-button:hover:not(:disabled) {
          background: #065f46;
        }

        .error-banner {
          max-width: 1500px;
          margin: 0 auto 18px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
          border-radius: 10px;
          padding: 13px 15px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-size: 13px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15, 23, 42, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow-y: auto;
        }

        .receive-modal {
          width: min(900px, 100%);
          max-height: calc(100vh - 40px);
          display: flex;
          flex-direction: column;
          background: #fff;
          border-radius: 15px;
          box-shadow: 0 20px 60px
            rgba(15, 23, 42, 0.2);
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 21px 23px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 18px;
        }

        .modal-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .close-button {
          width: 32px;
          height: 32px;
          border: 0;
          background: #f8fafc;
          border-radius: 8px;
          color: #64748b;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
        }

        .modal-body {
          padding: 22px;
          overflow-y: auto;
        }

        .receive-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 18px;
        }

        .receive-info > div {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 13px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .receive-info span {
          color: #94a3b8;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 700;
        }

        .receive-info strong {
          color: #0f172a;
          font-size: 14px;
        }

        .receive-location-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 20px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field label {
          color: #334155;
          font-size: 12px;
          font-weight: 600;
        }

        .field label span {
          color: #dc2626;
        }

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #fff;
          color: #0f172a;
          outline: none;
          font-size: 13px;
        }

        .field input,
        .field select {
          height: 40px;
          padding: 0 11px;
        }

        .field textarea {
          padding: 10px 11px;
          resize: vertical;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px
            rgba(148, 163, 184, 0.15);
        }

        .field-warning {
          color: #b45309;
          font-size: 11px;
        }

        .receive-items {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .receive-items-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 100px 100px;
          gap: 15px;
          padding: 11px 13px;
          background: #f8fafc;
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid #e5e7eb;
        }

        .receive-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 100px 100px;
          gap: 15px;
          align-items: center;
          padding: 13px;
          border-bottom: 1px solid #f1f5f9;
        }

        .receive-item:last-child {
          border-bottom: 0;
        }

        .receive-product {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .receive-product strong {
          color: #0f172a;
          font-size: 13px;
        }

        .receive-product > span:not(.serial-label) {
          color: #64748b;
          font-size: 11px;
        }

        .serial-label {
          align-self: flex-start;
          margin-top: 3px;
          padding: 2px 6px;
          border-radius: 999px;
          background: #fef3c7;
          color: #92400e;
          font-size: 9px;
          font-weight: 700;
        }

        .remaining-cell {
          color: #c2410c;
          font-size: 13px;
          font-weight: 700;
        }

        .receive-quantity {
          width: 90px;
          height: 38px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 0 9px;
          font-size: 13px;
          outline: none;
        }

        .receive-quantity:focus {
          border-color: #94a3b8;
        }

        .serial-section {
          grid-column: 1 / -1;
          padding: 12px;
          border-radius: 9px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .serial-section label {
          color: #334155;
          font-size: 11px;
          font-weight: 700;
        }

        .serial-section label span {
          color: #64748b;
          font-weight: 500;
        }

        .serial-section textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 9px;
          font-size: 12px;
          resize: vertical;
          outline: none;
        }

        .serial-section textarea:focus {
          border-color: #94a3b8;
        }

        .serial-section small {
          color: #64748b;
          font-size: 10px;
        }

        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
          padding: 16px 22px;
          border-top: 1px solid #e5e7eb;
          background: #fff;
        }

        @media (max-width: 1100px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            align-items: start;
          }

          .totals-card {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 18px;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .side-column,
          .notes-grid,
          .receive-location-grid {
            grid-template-columns: 1fr;
          }

          .totals-card {
            grid-column: auto;
          }

          .receipt-row {
            grid-template-columns: 40px minmax(0, 1fr);
          }

          .receipt-reference,
          .receipt-status {
            grid-column: 2;
          }

          .receive-items-header,
          .receive-item {
            grid-template-columns: minmax(0, 1fr) 80px 90px;
          }

          .header-actions {
            width: 100%;
          }
        }

        @media (max-width: 600px) {
          .page-content {
            padding: 14px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .header-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .header-actions .primary-button,
          .header-actions .secondary-button,
          .header-actions .danger-button {
            width: 100%;
          }

          .title-row h1 {
            font-size: 21px;
          }

          .card-header {
            padding: 17px;
          }

          .receive-info {
            grid-template-columns: 1fr;
          }

          .receive-items {
            border-radius: 9px;
          }

          .receive-items-header {
            display: none;
          }

          .receive-item {
            grid-template-columns: 1fr 80px 90px;
            padding: 14px;
          }

          .serial-section {
            grid-column: 1 / -1;
          }

          .modal-backdrop {
            padding: 8px;
          }

          .receive-modal {
            max-height: calc(100vh - 16px);
          }

          .modal-body {
            padding: 15px;
          }

          .modal-footer {
            padding: 13px 15px;
          }
        }

        @media print {
          :global(body) {
            background: #fff !important;
          }

          .page-content {
            padding: 0 !important;
            background: #fff !important;
          }

          .header-actions,
          .error-banner,
          .progress-card,
          .modal-backdrop {
            display: none !important;
          }

          .stats-grid {
            grid-template-columns: repeat(4, 1fr);
          }

          .content-grid {
            grid-template-columns: 1fr 300px;
          }

          .card,
          .stat-card {
            box-shadow: none !important;
            break-inside: avoid;
          }

          .side-column {
            display: flex;
          }
        }
      `}</style>
    </AppShell>
  );
}