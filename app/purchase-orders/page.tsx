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
};

type Supplier = {
  id: string;
  legal_name: string;
  display_name: string;
  supplier_number: string;
};

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

type PurchaseOrderItem = {
  purchase_order_id: string;
  quantity: number;
  received_quantity: number;
};

const PURCHASE_ORDER_STATUSES = [
  "draft",
  "sent",
  "confirmed",
  "partially_received",
  "received",
  "cancelled",
];

export default function PurchaseOrdersPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const router = useRouter();

  const [purchaseOrders, setPurchaseOrders] =
    useState<PurchaseOrder[]>([]);

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [items, setItems] =
    useState<PurchaseOrderItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [supplierFilter, setSupplierFilter] =
    useState("all");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
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
          "No company membership found."
        );
      }

      const companyId =
        membership.company_id;

      const [
        companyResult,
        purchaseOrdersResult,
        suppliersResult,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select(
            "id, name, currency"
          )
          .eq("id", companyId)
          .single(),

        supabase
          .from("purchase_orders")
          .select("*")
          .eq(
            "company_id",
            companyId
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("suppliers")
          .select(
            "id, legal_name, display_name, supplier_number"
          )
          .eq(
            "company_id",
            companyId
          )
          .order("display_name", {
            ascending: true,
          }),
      ]);

      if (companyResult.error) {
        throw companyResult.error;
      }

      if (purchaseOrdersResult.error) {
        throw purchaseOrdersResult.error;
      }

      if (suppliersResult.error) {
        throw suppliersResult.error;
      }

      const loadedPurchaseOrders =
        purchaseOrdersResult.data || [];

      setCompany(
        companyResult.data
      );

      setPurchaseOrders(
        loadedPurchaseOrders
      );

      setSuppliers(
        suppliersResult.data || []
      );

      if (
        loadedPurchaseOrders.length > 0
      ) {
        const purchaseOrderIds =
          loadedPurchaseOrders.map(
            (purchaseOrder) =>
              purchaseOrder.id
          );

        const {
          data: itemData,
          error: itemError,
        } = await supabase
          .from("purchase_order_items")
          .select(
            `
              purchase_order_id,
              quantity,
              received_quantity
            `
          )
          .eq(
            "company_id",
            companyId
          )
          .in(
            "purchase_order_id",
            purchaseOrderIds
          );

        if (itemError) {
          throw itemError;
        }

        setItems(
          itemData || []
        );
      } else {
        setItems([]);
      }
    } catch (err: unknown) {
      console.error(
        "Purchase order page load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not load purchase orders."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    // This effect intentionally starts the asynchronous Supabase
    // synchronization for the purchase order list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const filteredPurchaseOrders =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return purchaseOrders.filter(
        (purchaseOrder) => {
          const supplier =
            suppliers.find(
              (item) =>
                item.id ===
                purchaseOrder.supplier_id
            );

          const supplierName =
            supplier?.display_name ||
            supplier?.legal_name ||
            "";

          const supplierNumber =
            supplier?.supplier_number ||
            "";

          const matchesSearch =
            !query ||
            purchaseOrder.po_number
              .toLowerCase()
              .includes(query) ||
            supplierName
              .toLowerCase()
              .includes(query) ||
            supplierNumber
              .toLowerCase()
              .includes(query) ||
            (
              purchaseOrder.supplier_reference ||
              ""
            )
              .toLowerCase()
              .includes(query) ||
            purchaseOrder.status
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            statusFilter === "all" ||
            purchaseOrder.status ===
              statusFilter;

          const matchesSupplier =
            supplierFilter === "all" ||
            purchaseOrder.supplier_id ===
              supplierFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesSupplier
          );
        }
      );
    }, [
      purchaseOrders,
      suppliers,
      search,
      statusFilter,
      supplierFilter,
    ]);

  const stats = useMemo(() => {
    const totalOrders =
      purchaseOrders.length;

    const openOrders =
      purchaseOrders.filter(
        (purchaseOrder) =>
          purchaseOrder.status ===
            "sent" ||
          purchaseOrder.status ===
            "confirmed" ||
          purchaseOrder.status ===
            "partially_received"
      ).length;

    const receivedOrders =
      purchaseOrders.filter(
        (purchaseOrder) =>
          purchaseOrder.status ===
          "received"
      ).length;

    const outstandingValue =
      purchaseOrders
        .filter(
          (purchaseOrder) =>
            purchaseOrder.status !==
              "received" &&
            purchaseOrder.status !==
              "cancelled"
        )
        .reduce(
          (sum, purchaseOrder) =>
            sum +
            Number(
              purchaseOrder.total_amount ||
                0
            ),
          0
        );

    return {
      totalOrders,
      openOrders,
      receivedOrders,
      outstandingValue,
    };
  }, [purchaseOrders]);

  function getSupplierName(
    supplierId: string
  ) {
    const supplier =
      suppliers.find(
        (item) =>
          item.id === supplierId
      );

    return (
      supplier?.display_name ||
      supplier?.legal_name ||
      "Unknown supplier"
    );
  }

  function getSupplierNumber(
    supplierId: string
  ) {
    return (
      suppliers.find(
        (item) =>
          item.id === supplierId
      )?.supplier_number || ""
    );
  }

  function getItemSummary(
    purchaseOrderId: string
  ) {
    const purchaseOrderItems =
      items.filter(
        (item) =>
          item.purchase_order_id ===
          purchaseOrderId
      );

    const quantity =
      purchaseOrderItems.reduce(
        (sum, item) =>
          sum +
          Number(
            item.quantity || 0
          ),
        0
      );

    const received =
      purchaseOrderItems.reduce(
        (sum, item) =>
          sum +
          Number(
            item.received_quantity ||
              0
          ),
        0
      );

    return {
      lines:
        purchaseOrderItems.length,
      quantity,
      received,
    };
  }

  function formatCurrency(
    value: number,
    currencyOverride?: string
  ) {
    const currency =
      currencyOverride ||
      company?.currency ||
      "USD";

    try {
      return new Intl.NumberFormat(
        "en-US",
        {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }
      ).format(value);
    } catch {
      return `${currency} ${value.toFixed(
        2
      )}`;
    }
  }

  function formatDate(
    date: string | null
  ) {
    if (!date) {
      return "—";
    }

    const parsed = new Date(
      `${date}T00:00:00`
    );

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return date;
    }

    return parsed.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  }

  function formatStatus(
    status: string
  ) {
    switch (status) {
      case "partially_received":
        return "Partially Received";

      case "cancelled":
        return "Cancelled";

      case "confirmed":
        return "Confirmed";

      case "received":
        return "Received";

      case "sent":
        return "Sent";

      case "draft":
        return "Draft";

      default:
        return (
          status.charAt(0).toUpperCase() +
          status.slice(1)
        );
    }
  }

  function getStatusClass(
    status: string
  ) {
    switch (status) {
      case "draft":
        return "status-draft";

      case "sent":
        return "status-sent";

      case "confirmed":
        return "status-confirmed";

      case "partially_received":
        return "status-partial";

      case "received":
        return "status-received";

      case "cancelled":
        return "status-cancelled";

      default:
        return "status-draft";
    }
  }

  function isOverdue(
    purchaseOrder: PurchaseOrder
  ) {
    if (
      !purchaseOrder.expected_date
    ) {
      return false;
    }

    if (
      purchaseOrder.status ===
        "received" ||
      purchaseOrder.status ===
        "cancelled"
    ) {
      return false;
    }

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const expected =
      new Date(
        `${purchaseOrder.expected_date}T00:00:00`
      );

    return expected < today;
  }

  function openPurchaseOrder(
    purchaseOrderId: string
  ) {
    router.push(
      `/purchase-orders/${purchaseOrderId}`
    );
  }

  function createPurchaseOrder() {
    router.push(
      "/purchase-orders/new"
    );
  }

  async function deletePurchaseOrder(
    purchaseOrder: PurchaseOrder
  ) {
    if (
      purchaseOrder.status !==
        "draft" &&
      purchaseOrder.status !==
        "cancelled"
    ) {
      setError(
        "Only Draft or Cancelled purchase orders can be deleted."
      );

      setTimeout(() => {
        setError("");
      }, 3000);

      return;
    }

    const confirmed =
      window.confirm(
        `Delete purchase order ${purchaseOrder.po_number}? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
        .eq(
          "user_id",
          user.id
        )
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership?.company_id) {
        throw new Error(
          "No company membership found."
        );
      }

      const {
        error: deleteError,
      } = await supabase
        .from("purchase_orders")
        .delete()
        .eq(
          "id",
          purchaseOrder.id
        )
        .eq(
          "company_id",
          membership.company_id
        );

      if (deleteError) {
        throw deleteError;
      }

      setPurchaseOrders(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              purchaseOrder.id
          )
      );

      setItems(
        (current) =>
          current.filter(
            (item) =>
              item.purchase_order_id !==
              purchaseOrder.id
          )
      );

      setSuccess(
        "Purchase order deleted successfully."
      );

      setTimeout(() => {
        setSuccess("");
      }, 2000);
    } catch (err: unknown) {
      console.error(
        "Purchase order delete error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not delete purchase order."
      );
    }
  }

  return (
    <AppShell
      title="Purchase Orders"
      description="Create, track and manage supplier purchase orders."
      actions={
        <button
          type="button"
          className="primary-button"
          onClick={
            createPurchaseOrder
          }
        >
          + New Purchase Order
        </button>
      }
    >
      <section className="page-content">
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Orders
            </div>

            <div className="stat-value">
              {stats.totalOrders}
            </div>

            <div className="stat-description">
              Across all purchase orders
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Open Orders
            </div>

            <div className="stat-value">
              {stats.openOrders}
            </div>

            <div className="stat-description">
              Orders awaiting receipt
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Received
            </div>

            <div className="stat-value">
              {stats.receivedOrders}
            </div>

            <div className="stat-description">
              Fully received orders
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Outstanding Value
            </div>

            <div className="stat-value">
              {formatCurrency(
                stats.outstandingValue
              )}
            </div>

            <div className="stat-description">
              Value still awaiting receipt
            </div>
          </div>
        </div>

        <section className="content-card">
          <div className="content-card-header">
            <div>
              <h2>
                All Purchase Orders
              </h2>

              <p>
                {
                  filteredPurchaseOrders.length
                }{" "}
                purchase order
                {filteredPurchaseOrders.length ===
                1
                  ? ""
                  : "s"}{" "}
                found
              </p>
            </div>

            <div className="filters">
              <div className="search-box">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search purchase orders..."
                  value={search}
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <select
                value={
                  statusFilter
                }
                onChange={(
                  event
                ) =>
                  setStatusFilter(
                    event.target
                      .value
                  )
                }
              >
                <option value="all">
                  All statuses
                </option>

                {PURCHASE_ORDER_STATUSES.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {formatStatus(
                        status
                      )}
                    </option>
                  )
                )}
              </select>

              <select
                value={
                  supplierFilter
                }
                onChange={(
                  event
                ) =>
                  setSupplierFilter(
                    event.target
                      .value
                  )
                }
              >
                <option value="all">
                  All suppliers
                </option>

                {suppliers.map(
                  (supplier) => (
                    <option
                      key={
                        supplier.id
                      }
                      value={
                        supplier.id
                      }
                    >
                      {
                        supplier.display_name
                      }
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner" />

              <p>
                Loading purchase orders...
              </p>
            </div>
          ) : filteredPurchaseOrders.length ===
            0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                ▥
              </div>

              <h3>
                {search ||
                statusFilter !==
                  "all" ||
                supplierFilter !==
                  "all"
                  ? "No purchase orders found"
                  : "No purchase orders yet"}
              </h3>

              <p>
                {search ||
                statusFilter !==
                  "all" ||
                supplierFilter !==
                  "all"
                  ? "Try changing your search or filters."
                  : "Create your first purchase order to start managing procurement."}
              </p>

              {!search &&
                statusFilter ===
                  "all" &&
                supplierFilter ===
                  "all" && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={
                      createPurchaseOrder
                    }
                  >
                    + Create Purchase Order
                  </button>
                )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      Purchase Order
                    </th>

                    <th>
                      Supplier
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Order Date
                    </th>

                    <th>
                      Expected Date
                    </th>

                    <th>
                      Items
                    </th>

                    <th>
                      Total
                    </th>

                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPurchaseOrders.map(
                    (purchaseOrder) => {
                      const itemSummary =
                        getItemSummary(
                          purchaseOrder.id
                        );

                      const overdue =
                        isOverdue(
                          purchaseOrder
                        );

                      const receivedPercentage =
                        itemSummary.quantity >
                        0
                          ? Math.min(
                              100,
                              Math.round(
                                (itemSummary.received /
                                  itemSummary.quantity) *
                                  100
                              )
                            )
                          : 0;

                      return (
                        <tr
                          key={
                            purchaseOrder.id
                          }
                        >
                          <td>
                            <button
                              type="button"
                              className="invoice-link"
                              onClick={() =>
                                openPurchaseOrder(
                                  purchaseOrder.id
                                )
                              }
                            >
                              {
                                purchaseOrder.po_number
                              }
                            </button>

                            {purchaseOrder.supplier_reference && (
                              <div className="secondary-cell">
                                Ref:{" "}
                                {
                                  purchaseOrder.supplier_reference
                                }
                              </div>
                            )}
                          </td>

                          <td>
                            <div className="primary-cell">
                              {getSupplierName(
                                purchaseOrder.supplier_id
                              )}
                            </div>

                            {getSupplierNumber(
                              purchaseOrder.supplier_id
                            ) && (
                              <div className="secondary-cell">
                                {getSupplierNumber(
                                  purchaseOrder.supplier_id
                                )}
                              </div>
                            )}
                          </td>

                          <td>
                            <span
                              className={`status-badge ${getStatusClass(
                                purchaseOrder.status
                              )}`}
                            >
                              {formatStatus(
                                purchaseOrder.status
                              )}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              purchaseOrder.order_date
                            )}
                          </td>

                          <td>
                            <div
                              className={
                                overdue
                                  ? "expected-date overdue"
                                  : "expected-date"
                              }
                            >
                              {formatDate(
                                purchaseOrder.expected_date
                              )}

                              {overdue && (
                                <div className="overdue-label">
                                  Overdue
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="items-cell">
                              <strong>
                                {
                                  itemSummary.lines
                                }{" "}
                                line
                                {itemSummary.lines ===
                                1
                                  ? ""
                                  : "s"}
                              </strong>

                              {itemSummary.quantity >
                                0 && (
                                <>
                                  <div className="progress-track">
                                    <div
                                      className="progress-bar"
                                      style={{
                                        width: `${receivedPercentage}%`,
                                      }}
                                    />
                                  </div>

                                  <div className="secondary-cell">
                                    {
                                      itemSummary.received
                                    }{" "}
                                    /{" "}
                                    {
                                      itemSummary.quantity
                                    }{" "}
                                    received
                                  </div>
                                </>
                              )}
                            </div>
                          </td>

                          <td>
                            <strong>
                              {formatCurrency(
                                Number(
                                  purchaseOrder.total_amount ||
                                    0
                                ),
                                purchaseOrder.currency
                              )}
                            </strong>
                          </td>

                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="table-action"
                                onClick={() =>
                                  openPurchaseOrder(
                                    purchaseOrder.id
                                  )
                                }
                              >
                                Open
                              </button>

                              {(purchaseOrder.status ===
                                "draft" ||
                                purchaseOrder.status ===
                                  "cancelled") && (
                                <button
                                  type="button"
                                  className="table-action danger"
                                  onClick={() =>
                                    deletePurchaseOrder(
                                      purchaseOrder
                                    )
                                  }
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .stat-label {
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .stat-value {
          color: #0f172a;
          font-size: 25px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .stat-description {
          color: #94a3b8;
          font-size: 12px;
          margin-top: 5px;
        }

        .content-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .content-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 22px;
          border-bottom: 1px solid #e5e7eb;
        }

        .content-card-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 18px;
        }

        .content-card-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 13px;
        }

        .filters {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 40px;
          padding: 0 12px;
          min-width: 240px;
          border: 1px solid #dbe1e8;
          border-radius: 9px;
          background: #ffffff;
        }

        .search-box span {
          color: #94a3b8;
          font-size: 18px;
        }

        .search-box input {
          width: 100%;
          border: 0;
          outline: 0;
          color: #0f172a;
          background: transparent;
          font-size: 13px;
        }

        .filters select {
          height: 40px;
          padding: 0 12px;
          border: 1px solid #dbe1e8;
          border-radius: 9px;
          background: #ffffff;
          color: #334155;
          font-size: 13px;
          outline: none;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1050px;
        }

        .data-table th {
          padding: 13px 18px;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .data-table td {
          padding: 17px 18px;
          border-top: 1px solid #eef2f7;
          color: #334155;
          font-size: 13px;
          vertical-align: middle;
        }

        .primary-cell {
          color: #0f172a;
          font-weight: 700;
        }

        .invoice-link {
          padding: 0;
          border: 0;
          background: transparent;
          color: #0f172a;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          text-align: left;
        }

        .invoice-link:hover {
          text-decoration: underline;
        }

        .secondary-cell {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 12px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-draft {
          background: #f1f5f9;
          color: #64748b;
        }

        .status-sent {
          background: #eff6ff;
          color: #2563eb;
        }

        .status-confirmed {
          background: #ecfdf5;
          color: #059669;
        }

        .status-partial {
          background: #fffbeb;
          color: #d97706;
        }

        .status-received {
          background: #ecfdf5;
          color: #059669;
        }

        .status-cancelled {
          background: #fef2f2;
          color: #dc2626;
        }

        .expected-date {
          color: #334155;
        }

        .expected-date.overdue {
          color: #dc2626;
          font-weight: 700;
        }

        .overdue-label {
          margin-top: 4px;
          color: #dc2626;
          font-size: 11px;
          font-weight: 700;
        }

        .items-cell {
          min-width: 120px;
        }

        .items-cell strong {
          color: #0f172a;
          font-size: 13px;
        }

        .progress-track {
          width: 90px;
          height: 5px;
          margin-top: 7px;
          overflow: hidden;
          border-radius: 999px;
          background: #e2e8f0;
        }

        .progress-bar {
          height: 100%;
          border-radius: inherit;
          background: #334155;
          transition: width 0.2s ease;
        }

        .row-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
        }

        .table-action {
          border: 0;
          background: #f8fafc;
          color: #475569;
          padding: 7px 10px;
          border-radius: 7px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .table-action:hover {
          background: #eef2f7;
        }

        .table-action.danger {
          color: #dc2626;
        }

        .table-action.danger:hover {
          background: #fef2f2;
        }

        .empty-state {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .empty-icon {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 15px;
          border-radius: 14px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 24px;
        }

        .empty-state h3 {
          margin: 0;
          color: #0f172a;
          font-size: 17px;
        }

        .empty-state p {
          margin: 7px 0 18px;
          color: #94a3b8;
          font-size: 13px;
        }

        .loading-spinner {
          width: 28px;
          height: 28px;
          margin-bottom: 12px;
          border: 3px solid #e2e8f0;
          border-top-color: #334155;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .alert {
          padding: 12px 14px;
          margin-bottom: 18px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
        }

        .alert-error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .alert-success {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          padding: 0 15px;
          border: 0;
          border-radius: 9px;
          background: #0f172a;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .primary-button:hover {
          background: #1e293b;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .content-card-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .filters {
            width: 100%;
          }

          .search-box {
            flex: 1;
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 18px;
          }

          .filters {
            flex-wrap: wrap;
          }

          .search-box {
            min-width: 0;
            flex-basis: 100%;
          }

          .filters select {
            flex: 1;
          }
        }

        @media (max-width: 600px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .filters {
            flex-direction: column;
            align-items: stretch;
          }

          .search-box {
            width: 100%;
            box-sizing: border-box;
          }

          .filters select {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}