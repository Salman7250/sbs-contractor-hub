"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  company_id: string;
  customer_id: string | null;
  order_number: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

type InvoiceLink = {
  id: string;
  order_id: string | null;
  invoice_number: string;
  status: string;
  total: number;
  amount_paid: number;
  created_at: string;
};

const ORDER_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "completed",
  "cancelled",
  "refunded",
];

export default function SalesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [invoices, setInvoices] =
    useState<InvoiceLink[]>([]);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
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
        ordersResult,
        customersResult,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select(
            "id, name, currency"
          )
          .eq("id", companyId)
          .single(),

        supabase
          .from("orders")
          .select("*")
          .eq(
            "company_id",
            companyId
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("customers")
          .select(
            "id, name, email, phone"
          )
          .eq(
            "company_id",
            companyId
          )
          .order("name", {
            ascending: true,
          }),
      ]);

      if (companyResult.error) {
        throw companyResult.error;
      }

      if (ordersResult.error) {
        throw ordersResult.error;
      }

      if (customersResult.error) {
        throw customersResult.error;
      }

      const loadedOrders =
        ordersResult.data || [];

      setCompany(
        companyResult.data
      );

      setOrders(
        loadedOrders
      );

      setCustomers(
        customersResult.data || []
      );

      /*
       * Load invoices linked to these sales orders.
       *
       * There is intentionally no unique constraint
       * on invoices.order_id, so multiple invoices
       * can technically exist for an order.
       */
      if (loadedOrders.length > 0) {
        const orderIds =
          loadedOrders.map(
            (order) => order.id
          );

        const {
          data: invoiceData,
          error: invoiceError,
        } = await supabase
          .from("invoices")
          .select(
            `
              id,
              order_id,
              invoice_number,
              status,
              total,
              amount_paid,
              created_at
            `
          )
          .eq(
            "company_id",
            companyId
          )
          .in(
            "order_id",
            orderIds
          )
          .order("created_at", {
            ascending: false,
          });

        if (invoiceError) {
          throw invoiceError;
        }

        setInvoices(
          invoiceData || []
        );
      } else {
        setInvoices([]);
      }
    } catch (err: any) {
      console.error(
        "Sales page load error:",
        err
      );

      setError(
        err?.message ||
          "Could not load sales orders."
      );
    } finally {
      setLoading(false);
    }
  }

  function getCustomerName(
    customerId: string | null
  ) {
    if (!customerId) {
      return "Walk-in Customer";
    }

    return (
      customers.find(
        (customer) =>
          customer.id ===
          customerId
      )?.name ||
      "Unknown customer"
    );
  }

  function getInvoice(
    orderId: string
  ) {
    /*
     * Newest invoice first because loadData()
     * orders invoices by created_at descending.
     */
    return (
      invoices.find(
        (invoice) =>
          invoice.order_id ===
          orderId
      ) || null
    );
  }

  const filteredOrders =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return orders.filter(
        (order) => {
          const customerName =
            getCustomerName(
              order.customer_id
            );

          const invoice =
            getInvoice(order.id);

          const invoiceNumber =
            invoice?.invoice_number ||
            "";

          const matchesSearch =
            !query ||
            order.order_number
              .toLowerCase()
              .includes(query) ||
            customerName
              .toLowerCase()
              .includes(query) ||
            invoiceNumber
              .toLowerCase()
              .includes(query) ||
            order.status
              .toLowerCase()
              .includes(query) ||
            order.payment_status
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            statusFilter === "all" ||
            order.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      orders,
      customers,
      invoices,
      search,
      statusFilter,
    ]);

  const stats = useMemo(() => {
    const activeOrders =
      orders.filter(
        (order) =>
          order.status !==
            "cancelled" &&
          order.status !==
            "refunded"
      );

    const totalSales =
      activeOrders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.total_amount || 0
          ),
        0
      );

    const totalPaid =
      activeOrders.reduce(
        (sum, order) => {
          const invoice =
            getInvoice(order.id);

          if (!invoice) {
            return sum;
          }

          return (
            sum +
            Number(
              invoice.amount_paid ||
                0
            )
          );
        },
        0
      );

    const outstanding =
      activeOrders.reduce(
        (sum, order) => {
          const invoice =
            getInvoice(order.id);

          if (!invoice) {
            return sum;
          }

          return (
            sum +
            Math.max(
              Number(
                invoice.total || 0
              ) -
                Number(
                  invoice.amount_paid ||
                    0
                ),
              0
            )
          );
        },
        0
      );

    const pending =
      orders.filter(
        (order) =>
          order.status ===
            "pending" ||
          order.status ===
            "confirmed"
      ).length;

    return {
      totalSales,
      totalPaid,
      outstanding,
      pending,
    };
  }, [
    orders,
    invoices,
    customers,
  ]);

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
      return `$${value.toFixed(
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
      date
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
    if (
      status ===
      "partially_paid"
    ) {
      return "Partially Paid";
    }

    if (
      status ===
      "partially_fulfilled"
    ) {
      return "Partially Fulfilled";
    }

    if (status === "unpaid") {
      return "Unpaid";
    }

    if (status === "fulfilled") {
      return "Fulfilled";
    }

    return (
      status.charAt(0).toUpperCase() +
      status.slice(1).replaceAll(
        "_",
        " "
      )
    );
  }

  function getStatusClass(
    status: string
  ) {
    switch (status) {
      case "draft":
        return "status-draft";

      case "pending":
        return "status-partial";

      case "confirmed":
        return "status-sent";

      case "processing":
        return "status-sent";

      case "shipped":
        return "status-sent";

      case "completed":
        return "status-paid";

      case "cancelled":
        return "status-overdue";

      case "refunded":
        return "status-void";

      default:
        return "status-draft";
    }
  }

  function getPaymentStatusClass(
    status: string
  ) {
    switch (status) {
      case "paid":
        return "status-paid";

      case "partially_paid":
        return "status-partial";

      case "refunded":
        return "status-void";

      case "partially_refunded":
        return "status-overdue";

      case "unpaid":
      default:
        return "status-draft";
    }
  }

  function getFulfillmentStatusClass(
    status: string
  ) {
    switch (status) {
      case "fulfilled":
        return "status-paid";

      case "partially_fulfilled":
        return "status-partial";

      case "unfulfilled":
      default:
        return "status-draft";
    }
  }

  function getInvoiceStatusClass(
    status: string
  ) {
    switch (status) {
      case "paid":
        return "status-paid";

      case "partially_paid":
        return "status-partial";

      case "overdue":
        return "status-overdue";

      case "void":
        return "status-void";

      case "sent":
        return "status-sent";

      default:
        return "status-draft";
    }
  }

  function openOrder(
    orderId: string
  ) {
    router.push(
      `/sales/${orderId}`
    );
  }

  function editOrder(
    orderId: string
  ) {
    router.push(
      `/sales/${orderId}/edit`
    );
  }

  function createInvoice(
    orderId: string
  ) {
    router.push(
      `/invoices/new?orderId=${encodeURIComponent(
        orderId
      )}`
    );
  }

  function openInvoice(
    invoiceId: string
  ) {
    router.push(
      `/invoices/${invoiceId}`
    );
  }

  function createSale() {
    router.push(
      "/sales/new"
    );
  }

  async function deleteOrder(
    order: Order
  ) {
    const invoice =
      getInvoice(order.id);

    /*
     * Accounting protection:
     * an order with a linked invoice
     * must not be deleted.
     */
    if (invoice) {
      setError(
        `Order ${order.order_number} cannot be deleted because it has a linked invoice (${invoice.invoice_number}).`
      );

      setSuccess("");

      return;
    }

    const confirmed =
      window.confirm(
        `Delete sales order ${order.order_number}? This will also delete its order items. This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

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

      /*
       * Re-check invoices immediately before
       * deletion in case another action created
       * one after the page was loaded.
       */
      const {
        data: linkedInvoices,
        error: linkedInvoiceError,
      } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number"
        )
        .eq(
          "company_id",
          companyId
        )
        .eq(
          "order_id",
          order.id
        )
        .limit(1);

      if (linkedInvoiceError) {
        throw linkedInvoiceError;
      }

      if (
        linkedInvoices &&
        linkedInvoices.length >
          0
      ) {
        throw new Error(
          `Order ${order.order_number} cannot be deleted because it has a linked invoice (${linkedInvoices[0].invoice_number}).`
        );
      }

      /*
       * Delete order items first.
       */
      const {
        error: itemsError,
      } = await supabase
        .from("order_items")
        .delete()
        .eq(
          "company_id",
          companyId
        )
        .eq(
          "order_id",
          order.id
        );

      if (itemsError) {
        throw itemsError;
      }

      /*
       * Delete the order using both id and
       * company_id for tenant isolation.
       */
      const {
        error: orderError,
      } = await supabase
        .from("orders")
        .delete()
        .eq(
          "id",
          order.id
        )
        .eq(
          "company_id",
          companyId
        );

      if (orderError) {
        throw orderError;
      }

      setOrders(
        (current) =>
          current.filter(
            (item) =>
              item.id !== order.id
          )
      );

      setSuccess(
        "Sales order deleted successfully."
      );

      setTimeout(() => {
        setSuccess("");
      }, 2000);
    } catch (err: any) {
      console.error(
        "Sales order delete error:",
        err
      );

      setError(
        err?.message ||
          "Could not delete sales order."
      );
    }
  }

  return (
    <AppShell
      title="Sales & Orders"
      description="Create, track and manage customer sales orders."
      actions={
        <button
          type="button"
          className="primary-button"
          onClick={
            createSale
          }
        >
          + New Sale
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
              Total Sales
            </div>

            <div className="stat-value">
              {formatCurrency(
                stats.totalSales
              )}
            </div>

            <div className="stat-description">
              Across active orders
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Paid
            </div>

            <div className="stat-value">
              {formatCurrency(
                stats.totalPaid
              )}
            </div>

            <div className="stat-description">
              Payments received
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Outstanding
            </div>

            <div className="stat-value">
              {formatCurrency(
                stats.outstanding
              )}
            </div>

            <div className="stat-description">
              Balance still due
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Pending
            </div>

            <div className="stat-value">
              {stats.pending}
            </div>

            <div className="stat-description">
              Pending or confirmed orders
            </div>
          </div>
        </div>

        <section className="content-card">
          <div className="content-card-header">
            <div>
              <h2>
                All Sales Orders
              </h2>

              <p>
                {
                  filteredOrders.length
                }{" "}
                order
                {filteredOrders.length ===
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
                  placeholder="Search orders..."
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

                {ORDER_STATUSES.map(
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
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner" />

              <p>
                Loading sales orders...
              </p>
            </div>
          ) : filteredOrders.length ===
            0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                $
              </div>

              <h3>
                {search ||
                statusFilter !==
                  "all"
                  ? "No sales orders found"
                  : "No sales orders yet"}
              </h3>

              <p>
                {search ||
                statusFilter !==
                  "all"
                  ? "Try changing your search or filter."
                  : "Create your first sales order to start tracking sales."}
              </p>

              {!search &&
                statusFilter ===
                  "all" && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={
                      createSale
                    }
                  >
                    + Create Sale
                  </button>
                )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      Order
                    </th>

                    <th>
                      Customer
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Payment
                    </th>

                    <th>
                      Fulfillment
                    </th>

                    <th>
                      Total
                    </th>

                    <th>
                      Invoice
                    </th>

                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map(
                    (order) => {
                      const invoice =
                        getInvoice(
                          order.id
                        );

                      return (
                        <tr
                          key={
                            order.id
                          }
                        >
                          <td>
                            <button
                              type="button"
                              className="order-link"
                              onClick={() =>
                                openOrder(
                                  order.id
                                )
                              }
                            >
                              {
                                order.order_number
                              }
                            </button>

                            <div className="secondary-cell">
                              {formatDate(
                                order.created_at
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="primary-cell">
                              {getCustomerName(
                                order.customer_id
                              )}
                            </div>
                          </td>

                          <td>
                            {formatDate(
                              order.created_at
                            )}
                          </td>

                          <td>
                            <span
                              className={`status-badge ${getStatusClass(
                                order.status
                              )}`}
                            >
                              {formatStatus(
                                order.status
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`status-badge ${getPaymentStatusClass(
                                order.payment_status
                              )}`}
                            >
                              {formatStatus(
                                order.payment_status
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`status-badge ${getFulfillmentStatusClass(
                                order.fulfillment_status
                              )}`}
                            >
                              {formatStatus(
                                order.fulfillment_status
                              )}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {formatCurrency(
                                Number(
                                  order.total_amount ||
                                    0
                                ),
                                order.currency
                              )}
                            </strong>
                          </td>

                          <td>
                            {invoice ? (
                              <button
                                type="button"
                                className={`status-badge invoice-link ${getInvoiceStatusClass(
                                  invoice.status
                                )}`}
                                onClick={() =>
                                  openInvoice(
                                    invoice.id
                                  )
                                }
                              >
                                {
                                  invoice.invoice_number
                                }
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="create-invoice-button"
                                onClick={() =>
                                  createInvoice(
                                    order.id
                                  )
                                }
                              >
                                + Create
                              </button>
                            )}
                          </td>

                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="table-action"
                                onClick={() =>
                                  openOrder(
                                    order.id
                                  )
                                }
                              >
                                Open
                              </button>

                              <button
                                type="button"
                                className="table-action"
                                onClick={() =>
                                  editOrder(
                                    order.id
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="table-action danger"
                                onClick={() =>
                                  deleteOrder(
                                    order
                                  )
                                }
                              >
                                Delete
                              </button>
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
          min-width: 1100px;
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

        .order-link {
          padding: 0;
          border: 0;
          background: transparent;
          color: #0f172a;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          text-align: left;
        }

        .order-link:hover {
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

        .status-paid {
          background: #ecfdf5;
          color: #059669;
        }

        .status-partial {
          background: #fffbeb;
          color: #d97706;
        }

        .status-overdue {
          background: #fef2f2;
          color: #dc2626;
        }

        .status-void {
          background: #f5f3ff;
          color: #7c3aed;
        }

        .invoice-link {
          border: 0;
          cursor: pointer;
          font: inherit;
        }

        .invoice-link:hover {
          opacity: 0.8;
        }

        .create-invoice-button {
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

        .create-invoice-button:hover {
          background: #eef2f7;
        }

        .row-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
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
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 18px;
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
            min-width: 0;
          }

          .filters select {
            width: 150px;
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

          .row-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </AppShell>
  );
}