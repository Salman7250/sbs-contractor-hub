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

type Customer = {
  id: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
};

type Company = {
  id: string;
  name: string;
  currency?: string | null;
};

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
  customers: Customer | null;
};

type OrderItem = {
  id: string;
  company_id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
  updated_at: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  due_date: string | null;
  order_id: string | null;
  created_at?: string;
};

type InvoicePayment = {
  id: string;
  company_id: string;
  invoice_id: string;
  customer_id: string | null;
  amount: number;
  currency: string;
  payment_method: string | null;
  reference: string | null;
  paid_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function formatCurrency(
  amount: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getStatusClass(status: string) {
  switch (status) {
    case "completed":
    case "paid":
    case "fulfilled":
      return "success";

    case "processing":
    case "shipped":
    case "partially_paid":
    case "partially_fulfilled":
    case "confirmed":
    case "sent":
      return "warning";

    case "cancelled":
    case "refunded":
    case "partially_refunded":
    case "void":
      return "danger";

    default:
      return "neutral";
  }
}

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const orderId = String(
    params.orderId || ""
  );

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [order, setOrder] =
    useState<Order | null>(null);

  const [items, setItems] =
    useState<OrderItem[]>([]);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [invoice, setInvoice] =
    useState<Invoice | null>(null);

  const [payments, setPayments] =
    useState<InvoicePayment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [printing, setPrinting] =
    useState(false);

  const [invoiceLoading, setInvoiceLoading] =
    useState(false);

  const [paymentsLoading, setPaymentsLoading] =
    useState(false);

  const loadFinancialConnections = useCallback(
    async (
      companyId: string,
      currentOrderId: string
    ) => {
      setInvoiceLoading(true);
      setPaymentsLoading(true);

      try {
        /*
         * An order can technically have more than one invoice
         * because order_id is not currently UNIQUE.
         *
         * We therefore load the newest linked invoice instead
         * of using maybeSingle().
         */
        const {
          data: invoiceData,
          error: invoiceError,
        } = await supabase
          .from("invoices")
          .select(
            `
              id,
              invoice_number,
              status,
              subtotal,
              tax,
              total,
              amount_paid,
              due_date,
              order_id,
              created_at
            `
          )
          .eq("order_id", currentOrderId)
          .eq("company_id", companyId)
          .order("created_at", {
            ascending: false,
          })
          .limit(1);

        if (invoiceError) {
          console.error(
            "Invoice loading error:",
            invoiceError
          );

          setInvoice(null);
          setPayments([]);
          return;
        }

        const latestInvoice =
          invoiceData?.[0] || null;

        setInvoice(
          latestInvoice as Invoice | null
        );

        if (!latestInvoice) {
          setPayments([]);
          return;
        }

        const {
          data: paymentData,
          error: paymentError,
        } = await supabase
          .from("invoice_payments")
          .select(
            `
              id,
              company_id,
              invoice_id,
              customer_id,
              amount,
              currency,
              payment_method,
              reference,
              paid_at,
              notes,
              created_at,
              updated_at
            `
          )
          .eq(
            "invoice_id",
            latestInvoice.id
          )
          .eq("company_id", companyId)
          .order("paid_at", {
            ascending: false,
          });

        if (paymentError) {
          console.error(
            "Invoice payments loading error:",
            paymentError
          );

          setPayments([]);
          return;
        }

        setPayments(
          (paymentData || []) as InvoicePayment[]
        );
      } finally {
        setInvoiceLoading(false);
        setPaymentsLoading(false);
      }
    },
    [supabase]
  );

  const loadOrder = useCallback(
    async () => {
      if (!orderId) {
        setError("Invalid order.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError(
          "Your session could not be verified."
        );
        setLoading(false);
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

      if (
        membershipError ||
        !membership?.company_id
      ) {
        setError(
          "Your company workspace could not be found."
        );
        setLoading(false);
        return;
      }

      const companyId =
        membership.company_id;

      /*
       * Load company information.
       */
      const {
        data: companyData,
        error: companyError,
      } = await supabase
        .from("companies")
        .select("id, name, currency")
        .eq("id", companyId)
        .maybeSingle();

      if (companyError) {
        console.error(
          "Company loading error:",
          companyError
        );
      }

      if (companyData) {
        setCompany(
          companyData as Company
        );
      }

      /*
       * Load the order.
       *
       * company_id is always included in the query
       * to maintain tenant isolation.
       */
      const {
        data: orderData,
        error: orderError,
      } = await supabase
        .from("orders")
        .select(
          `
            id,
            company_id,
            customer_id,
            order_number,
            status,
            payment_status,
            fulfillment_status,
            currency,
            subtotal,
            discount_amount,
            tax_amount,
            shipping_amount,
            total_amount,
            notes,
            created_at,
            updated_at,
            customers (
              id,
              name,
              email,
              phone
            )
          `
        )
        .eq("id", orderId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (orderError) {
        console.error(
          "Order loading error:",
          orderError
        );

        setError(
          "We couldn't load this order."
        );
        setLoading(false);
        return;
      }

      if (!orderData) {
        setError(
          "This order could not be found."
        );
        setLoading(false);
        return;
      }

      /*
       * Load order items.
       */
      const {
        data: itemsData,
        error: itemsError,
      } = await supabase
        .from("order_items")
        .select(
          `
            id,
            company_id,
            order_id,
            product_id,
            variant_id,
            product_name,
            variant_name,
            sku,
            quantity,
            unit_price,
            unit_cost,
            discount_amount,
            tax_amount,
            line_total,
            created_at,
            updated_at
          `
        )
        .eq("order_id", orderId)
        .eq("company_id", companyId)
        .order("created_at", {
          ascending: true,
        });

      if (itemsError) {
        console.error(
          "Order items loading error:",
          itemsError
        );

        setError(
          "The order loaded, but its items could not be loaded."
        );
        setLoading(false);
        return;
      }

      setOrder(
        orderData as unknown as Order
      );

      setItems(
        (itemsData || []) as OrderItem[]
      );

      /*
       * Load invoice + payments connected to this order.
       */
      await loadFinancialConnections(
        companyId,
        orderId
      );

      setLoading(false);
    },
    [
      orderId,
      supabase,
      loadFinancialConnections,
    ]
  );

  useEffect(() => {
    // This effect intentionally starts the asynchronous order synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrder();
  }, [loadOrder]);

  function printOrder() {
    setPrinting(true);

    window.setTimeout(() => {
      window.print();

      window.setTimeout(() => {
        setPrinting(false);
      }, 500);
    }, 100);
  }

  function createInvoice() {
    router.push(
      `/invoices/new?orderId=${encodeURIComponent(
        orderId
      )}`
    );
  }

  function viewInvoice() {
    if (!invoice?.id) {
      return;
    }

    router.push(
      `/invoices/${invoice.id}`
    );
  }

  function recordPayment() {
    if (!invoice?.id) {
      return;
    }

    router.push(
      `/payments?invoiceId=${encodeURIComponent(
        invoice.id
      )}`
    );
  }

  if (loading) {
    return (
      <AppShell
        title="Order Details"
        description="View sale and order information."
      >
        <div className="order-state">
          <div className="order-spinner" />

          <strong>
            Loading order...
          </strong>

          <span>
            Getting order details, invoice and payment information.
          </span>
        </div>

        <style jsx>{`
          .order-state {
            min-height: 420px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .order-spinner {
            width: 30px;
            height: 30px;
            margin-bottom: 14px;
            border: 2px solid #e4e8ee;
            border-top-color: #697386;
            border-radius: 50%;
            animation: spin 0.75s linear infinite;
          }

          .order-state strong {
            color: #465163;
            font-size: 14px;
          }

          .order-state span {
            margin-top: 6px;
            color: #9aa2af;
            font-size: 11px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </AppShell>
    );
  }

  if (error || !order) {
    return (
      <AppShell
        title="Order Details"
        description="View sale and order information."
      >
        <div className="order-state">
          <div className="order-error-icon">
            !
          </div>

          <strong>
            {error || "Order not found"}
          </strong>

          <span>
            The requested order could not be loaded.
          </span>

          <div className="error-actions">
            <button
              type="button"
              onClick={() =>
                router.push("/sales")
              }
            >
              Back to Sales
            </button>

            <button
              type="button"
              onClick={() =>
                void loadOrder()
              }
            >
              Try Again
            </button>
          </div>
        </div>

        <style jsx>{`
          .order-state {
            min-height: 420px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .order-error-icon {
            width: 48px;
            height: 48px;
            display: grid;
            place-items: center;
            margin-bottom: 14px;
            border: 1px solid #ead6d6;
            border-radius: 50%;
            background: #fff8f8;
            color: #915858;
            font-size: 17px;
            font-weight: 800;
          }

          .order-state strong {
            color: #465163;
            font-size: 14px;
          }

          .order-state span {
            margin-top: 6px;
            color: #9aa2af;
            font-size: 10px;
          }

          .error-actions {
            display: flex;
            gap: 8px;
            margin-top: 17px;
          }

          .error-actions button {
            height: 37px;
            padding: 0 13px;
            border: 1px solid #dfe4eb;
            border-radius: 8px;
            background: #ffffff;
            color: #596476;
            cursor: pointer;
            font-family: inherit;
            font-size: 10px;
            font-weight: 700;
          }

          .error-actions button:hover {
            background: #f6f8fa;
            color: #263043;
          }
        `}</style>
      </AppShell>
    );
  }

  const currency =
    order.currency ||
    company?.currency ||
    "USD";

  const customerName =
    order.customers?.name ||
    "Walk-in Customer";

  const companyName =
    company?.name ||
    "Company";

  const totalQuantity = items.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0),
    0
  );

  const hasDiscount =
    Number(order.discount_amount || 0) > 0;

  const hasTax =
    Number(order.tax_amount || 0) > 0;

  const hasShipping =
    Number(order.shipping_amount || 0) > 0;

  /*
   * Payment figures come from the actual invoice/payment
   * relationship rather than a manually selected payment status.
   */
  const recordedPaymentsTotal =
    payments.reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0
    );

  const paidAmount = invoice
    ? Math.max(
        Number(invoice.amount_paid || 0),
        recordedPaymentsTotal
      )
    : 0;

  const invoiceTotal =
    Number(invoice?.total || 0);

  const balanceDue = Math.max(
    invoiceTotal - paidAmount,
    0
  );

  const invoicePaymentStatus =
    invoice
      ? paidAmount >= invoiceTotal &&
        invoiceTotal > 0
        ? "paid"
        : paidAmount > 0
          ? "partially_paid"
          : invoice.status === "overdue"
            ? "overdue"
            : "unpaid"
      : "unpaid";

  return (
    <AppShell
      title={order.order_number}
      description={`Created ${formatDateTime(
        order.created_at
      )}`}
      actions={
        <div className="order-header-actions">

          <button
            type="button"
            className="order-back-button"
            onClick={() =>
              router.push("/sales")
            }
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>

            Back
          </button>

          {!invoice && (
            <button
              type="button"
              className="order-invoice-button"
              onClick={createInvoice}
              disabled={invoiceLoading}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 2h9l3 3v17H6z" />
                <path d="M14 2v4h4" />
                <path d="M9 13h6" />
                <path d="M9 17h6" />
                <path d="M9 9h2" />
              </svg>

              Create Invoice
            </button>
          )}

          {invoice && (
            <button
              type="button"
              className="order-invoice-button"
              onClick={viewInvoice}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 2h9l3 3v17H6z" />
                <path d="M14 2v4h4" />
                <path d="M9 13h6" />
                <path d="M9 17h4" />
              </svg>

              View Invoice
            </button>
          )}

          <button
            type="button"
            className="order-print-button"
            onClick={printOrder}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9V3h12v6" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <path d="M6 14h12v7H6z" />
            </svg>

            {printing
              ? "Printing..."
              : "Print / PDF"}
          </button>

        </div>
      }
    >
      <div className="order-page">

        {/* =========================================
            PROFESSIONAL SALES ORDER DOCUMENT
        ========================================== */}

        <section className="invoice-document">

          {/* DOCUMENT HEADER */}

          <header className="invoice-header">

            <div className="invoice-company-block">
              <h1>
                {companyName}
              </h1>

              <span>
                Sales & Order Management
              </span>
            </div>

            <div className="invoice-title-block">

              <div className="invoice-title">
                SALES ORDER
              </div>

              <div className="invoice-number">
                {order.order_number}
              </div>

            </div>

          </header>

          {/* DOCUMENT META */}

          <div className="invoice-meta-row">

            <div className="invoice-meta-group">
              <span>
                Order Date
              </span>

              <strong>
                {formatDate(
                  order.created_at
                )}
              </strong>
            </div>

            <div className="invoice-meta-group">
              <span>
                Payment Status
              </span>

              <strong
                className={`invoice-status ${getStatusClass(
                  invoice
                    ? invoicePaymentStatus
                    : order.payment_status
                )}`}
              >
                {formatStatus(
                  invoice
                    ? invoicePaymentStatus
                    : order.payment_status
                )}
              </strong>
            </div>

            <div className="invoice-meta-group">
              <span>
                Order Status
              </span>

              <strong
                className={`invoice-status ${getStatusClass(
                  order.status
                )}`}
              >
                {formatStatus(
                  order.status
                )}
              </strong>
            </div>

            <div className="invoice-meta-group">
              <span>
                Fulfillment
              </span>

              <strong
                className={`invoice-status ${getStatusClass(
                  order.fulfillment_status
                )}`}
              >
                {formatStatus(
                  order.fulfillment_status
                )}
              </strong>
            </div>

          </div>

          {/* BILL TO */}

          <div className="invoice-parties">

            <div className="invoice-party">

              <div className="invoice-section-label">
                BILL TO
              </div>

              <strong className="invoice-party-name">
                {customerName}
              </strong>

              {order.customers?.email && (
                <span>
                  {order.customers.email}
                </span>
              )}

              {order.customers?.phone && (
                <span>
                  {order.customers.phone}
                </span>
              )}

              {!order.customers?.email &&
                !order.customers?.phone && (
                  <span>
                    Walk-in customer
                  </span>
                )}

            </div>

            <div className="invoice-party invoice-party-right">

              <div className="invoice-section-label">
                FROM
              </div>

              <strong className="invoice-party-name">
                {companyName}
              </strong>

              <span>
                Sales Order
              </span>

              <span>
                Order #{order.order_number}
              </span>

            </div>

          </div>

          {/* ITEMS */}

          <div className="invoice-items-section">

            <div className="invoice-section-label">
              ITEMS
            </div>

            {items.length === 0 ? (
              <div className="invoice-empty">
                No items were found for this order.
              </div>
            ) : (
              <table className="invoice-items-table">

                <thead>
                  <tr>

                    <th className="item-description">
                      DESCRIPTION
                    </th>

                    <th>
                      SKU
                    </th>

                    <th className="item-qty">
                      QTY
                    </th>

                    <th className="item-price">
                      UNIT PRICE
                    </th>

                    <th className="item-total">
                      AMOUNT
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {items.map(
                    (item) => (
                      <tr key={item.id}>

                        <td className="item-description">

                          <strong>
                            {item.product_name}
                          </strong>

                          {item.variant_name && (
                            <span>
                              {item.variant_name}
                            </span>
                          )}

                        </td>

                        <td className="item-sku">
                          {item.sku || "—"}
                        </td>

                        <td className="item-qty">
                          {item.quantity}
                        </td>

                        <td className="item-price">
                          {formatCurrency(
                            Number(
                              item.unit_price || 0
                            ),
                            currency
                          )}
                        </td>

                        <td className="item-total">

                          <strong>
                            {formatCurrency(
                              Number(
                                item.line_total || 0
                              ),
                              currency
                            )}
                          </strong>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>
            )}

          </div>

          {/* TOTALS */}

          <div className="invoice-bottom">

            <div className="invoice-notes-block">

              {order.notes ? (
                <>
                  <div className="invoice-section-label">
                    NOTES
                  </div>

                  <p>
                    {order.notes}
                  </p>
                </>
              ) : (
                <div className="invoice-thank-you">
                  Thank you for your business.
                </div>
              )}

            </div>

            <div className="invoice-total-block">

              <div className="invoice-total-row">

                <span>
                  Subtotal
                </span>

                <strong>
                  {formatCurrency(
                    Number(
                      order.subtotal || 0
                    ),
                    currency
                  )}
                </strong>

              </div>

              {hasDiscount && (
                <div className="invoice-total-row">

                  <span>
                    Discount
                  </span>

                  <strong>
                    −
                    {formatCurrency(
                      Number(
                        order.discount_amount || 0
                      ),
                      currency
                    )}
                  </strong>

                </div>
              )}

              {hasTax && (
                <div className="invoice-total-row">

                  <span>
                    Tax
                  </span>

                  <strong>
                    {formatCurrency(
                      Number(
                        order.tax_amount || 0
                      ),
                      currency
                    )}
                  </strong>

                </div>
              )}

              {hasShipping && (
                <div className="invoice-total-row">

                  <span>
                    Shipping
                  </span>

                  <strong>
                    {formatCurrency(
                      Number(
                        order.shipping_amount || 0
                      ),
                      currency
                    )}
                  </strong>

                </div>
              )}

              <div className="invoice-total-divider" />

              <div className="invoice-grand-total">

                <span>
                  TOTAL
                </span>

                <strong>
                  {formatCurrency(
                    Number(
                      order.total_amount || 0
                    ),
                    currency
                  )}
                </strong>

              </div>

            </div>

          </div>

          {/* FOOTER */}

          <footer className="invoice-footer">

            <div>

              <strong>
                {companyName}
              </strong>

              <span>
                Sales Order · {order.order_number}
              </span>

            </div>

            <div className="invoice-footer-right">

              <span>
                Currency
              </span>

              <strong>
                {currency}
              </strong>

            </div>

          </footer>

        </section>

        {/* =========================================
            SCREEN INFORMATION
        ========================================== */}

        <section className="screen-information">

          {/* ORDER INFORMATION */}

          <div className="screen-card">

            <div className="screen-card-header">

              <div>
                <h2>
                  Order Information
                </h2>

                <p>
                  Internal order details
                </p>
              </div>

            </div>

            <div className="screen-info-grid">

              <div>
                <span>
                  Order Number
                </span>

                <strong>
                  {order.order_number}
                </strong>
              </div>

              <div>
                <span>
                  Created
                </span>

                <strong>
                  {formatDateTime(
                    order.created_at
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Last Updated
                </span>

                <strong>
                  {formatDateTime(
                    order.updated_at
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Total Units
                </span>

                <strong>
                  {totalQuantity}
                </strong>
              </div>

            </div>

          </div>

          {/* CUSTOMER */}

          <div className="screen-card">

            <div className="screen-card-header">

              <div>
                <h2>
                  Customer
                </h2>

                <p>
                  Customer contact information
                </p>
              </div>

            </div>

            <div className="screen-customer">

              <div className="screen-customer-avatar">
                {customerName
                  .slice(0, 1)
                  .toUpperCase()}
              </div>

              <div>

                <strong>
                  {customerName}
                </strong>

                {order.customers?.email && (
                  <a
                    href={`mailto:${order.customers.email}`}
                  >
                    {order.customers.email}
                  </a>
                )}

                {order.customers?.phone && (
                  <a
                    href={`tel:${order.customers.phone}`}
                  >
                    {order.customers.phone}
                  </a>
                )}

              </div>

            </div>

          </div>

        </section>

        {/* =========================================
            CONNECTED FINANCIAL DOCUMENTS
        ========================================== */}

        <section className="financial-section">

          <div className="financial-section-header">

            <div>
              <h2>
                Financial Documents
              </h2>

              <p>
                Invoice and payment activity connected to this sales order.
              </p>
            </div>

          </div>

          {/* INVOICE CARD */}

          <div className="financial-card">

            <div className="financial-card-header">

              <div className="financial-icon invoice-icon">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2h9l3 3v17H6z" />
                  <path d="M14 2v4h4" />
                  <path d="M9 13h6" />
                  <path d="M9 17h6" />
                  <path d="M9 9h2" />
                </svg>
              </div>

              <div className="financial-card-title">

                <div>
                  <h3>
                    Invoice
                  </h3>

                  <p>
                    {invoice
                      ? invoice.invoice_number
                      : "No invoice created"}
                  </p>
                </div>

                {invoice && (
                  <span
                    className={`financial-status ${getStatusClass(
                      invoice.status
                    )}`}
                  >
                    {formatStatus(
                      invoice.status
                    )}
                  </span>
                )}

              </div>

            </div>

            {invoiceLoading ? (
              <div className="financial-loading">
                <div className="small-spinner" />
                Loading invoice...
              </div>
            ) : invoice ? (
              <>
                <div className="financial-metrics">

                  <div>
                    <span>
                      Invoice Total
                    </span>

                    <strong>
                      {formatCurrency(
                        invoiceTotal,
                        currency
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Paid
                    </span>

                    <strong className="paid-value">
                      {formatCurrency(
                        paidAmount,
                        currency
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Balance Due
                    </span>

                    <strong
                      className={
                        balanceDue > 0
                          ? "balance-value"
                          : "paid-value"
                      }
                    >
                      {formatCurrency(
                        balanceDue,
                        currency
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Due Date
                    </span>

                    <strong>
                      {invoice.due_date
                        ? formatDate(
                            invoice.due_date
                          )
                        : "No due date"}
                    </strong>
                  </div>

                </div>

                <div className="financial-card-actions">

                  <button
                    type="button"
                    className="secondary-financial-button"
                    onClick={viewInvoice}
                  >
                    View Invoice
                  </button>

                  {balanceDue > 0 && (
                    <button
                      type="button"
                      className="primary-financial-button"
                      onClick={recordPayment}
                    >
                      Record Payment
                    </button>
                  )}

                </div>
              </>
            ) : (
              <div className="financial-empty">

                <div>
                  <strong>
                    No invoice linked to this order
                  </strong>

                  <span>
                    Create an invoice from this sales order to begin tracking customer billing and payments.
                  </span>
                </div>

                <button
                  type="button"
                  className="primary-financial-button"
                  onClick={createInvoice}
                >
                  Create Invoice
                </button>

              </div>
            )}

          </div>

          {/* PAYMENT HISTORY */}

          {invoice && (
            <div className="financial-card payment-card">

              <div className="financial-card-header">

                <div className="financial-icon payment-icon">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="2"
                      y="5"
                      width="20"
                      height="14"
                      rx="2"
                    />
                    <path d="M2 10h20" />
                    <path d="M6 15h4" />
                  </svg>
                </div>

                <div className="financial-card-title">

                  <div>
                    <h3>
                      Payments
                    </h3>

                    <p>
                      Payments recorded against {invoice.invoice_number}
                    </p>
                  </div>

                  <span className="payment-count">
                    {payments.length}{" "}
                    {payments.length === 1
                      ? "payment"
                      : "payments"}
                  </span>

                </div>

              </div>

              {paymentsLoading ? (
                <div className="financial-loading">
                  <div className="small-spinner" />
                  Loading payment history...
                </div>
              ) : payments.length === 0 ? (
                <div className="payment-empty">
                  <span>
                    No payments have been recorded for this invoice yet.
                  </span>

                  {balanceDue > 0 && (
                    <button
                      type="button"
                      className="primary-financial-button"
                      onClick={recordPayment}
                    >
                      Record Payment
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="payment-table-wrapper">

                    <table className="payment-table">

                      <thead>
                        <tr>

                          <th>
                            DATE
                          </th>

                          <th>
                            METHOD
                          </th>

                          <th>
                            REFERENCE
                          </th>

                          <th className="payment-amount-column">
                            AMOUNT
                          </th>

                        </tr>
                      </thead>

                      <tbody>

                        {payments.map(
                          (payment) => (
                            <tr key={payment.id}>

                              <td>
                                <strong>
                                  {formatDate(
                                    payment.paid_at
                                  )}
                                </strong>

                                <span>
                                  {formatDateTime(
                                    payment.paid_at
                                  )}
                                </span>
                              </td>

                              <td>
                                <span className="payment-method">
                                  {payment.payment_method
                                    ? formatStatus(
                                        payment.payment_method
                                      )
                                    : "—"}
                                </span>
                              </td>

                              <td>
                                {payment.reference ? (
                                  <span className="payment-reference">
                                    {payment.reference}
                                  </span>
                                ) : (
                                  <span className="payment-muted">
                                    —
                                  </span>
                                )}
                              </td>

                              <td className="payment-amount-column">

                                <strong>
                                  {formatCurrency(
                                    Number(
                                      payment.amount || 0
                                    ),
                                    payment.currency ||
                                      currency
                                  )}
                                </strong>

                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                      <tfoot>

                        <tr>

                          <td
                            colSpan={3}
                          >
                            Total Recorded
                          </td>

                          <td className="payment-amount-column">

                            <strong>
                              {formatCurrency(
                                recordedPaymentsTotal,
                                currency
                              )}
                            </strong>

                          </td>

                        </tr>

                      </tfoot>

                    </table>

                  </div>

                  <div className="payment-footer-actions">

                    <div>
                      <span>
                        Current Balance
                      </span>

                      <strong
                        className={
                          balanceDue > 0
                            ? "balance-value"
                            : "paid-value"
                        }
                      >
                        {formatCurrency(
                          balanceDue,
                          currency
                        )}
                      </strong>
                    </div>

                    {balanceDue > 0 && (
                      <button
                        type="button"
                        className="primary-financial-button"
                        onClick={recordPayment}
                      >
                        Record Payment
                      </button>
                    )}

                  </div>

                </>
              )}

            </div>
          )}

        </section>

        {/* =========================================
            FINANCIAL CONNECTION FLOW
        ========================================== */}

        <section className="connection-card">

          <div className="connection-header">

            <div>
              <h2>
                Document Flow
              </h2>

              <p>
                How this transaction connects across SBS.
              </p>
            </div>

          </div>

          <div className="connection-flow">

            <div className="connection-node">

              <div className="connection-node-icon">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16v16H4z" />
                  <path d="M8 9h8" />
                  <path d="M8 13h5" />
                </svg>
              </div>

              <div>
                <strong>
                  Sales Order
                </strong>

                <span>
                  {order.order_number}
                </span>
              </div>

            </div>

            <div className="connection-arrow">
              →
            </div>

            <div
              className={`connection-node ${
                invoice
                  ? "connection-active"
                  : ""
              }`}
            >

              <div className="connection-node-icon">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2h9l3 3v17H6z" />
                  <path d="M14 2v4h4" />
                  <path d="M9 13h6" />
                  <path d="M9 17h6" />
                </svg>
              </div>

              <div>
                <strong>
                  Invoice
                </strong>

                <span>
                  {invoice
                    ? invoice.invoice_number
                    : "Not created"}
                </span>
              </div>

            </div>

            <div className="connection-arrow">
              →
            </div>

            <div
              className={`connection-node ${
                payments.length > 0
                  ? "connection-active"
                  : ""
              }`}
            >

              <div className="connection-node-icon">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect
                    x="2"
                    y="5"
                    width="20"
                    height="14"
                    rx="2"
                  />
                  <path d="M2 10h20" />
                </svg>
              </div>

              <div>
                <strong>
                  Payments
                </strong>

                <span>
                  {payments.length} recorded
                </span>
              </div>

            </div>

          </div>

        </section>

        {/* =========================================
            MOBILE ACTIONS
        ========================================== */}

        <div className="mobile-order-actions">

          <button
            type="button"
            onClick={() =>
              router.push("/sales")
            }
          >
            Back to Sales
          </button>

          {!invoice && (
            <button
              type="button"
              onClick={createInvoice}
            >
              Create Invoice
            </button>
          )}

          {invoice && balanceDue > 0 && (
            <button
              type="button"
              onClick={recordPayment}
            >
              Record Payment
            </button>
          )}

          <button
            type="button"
            onClick={printOrder}
          >
            Print / PDF
          </button>

        </div>

      </div>

      <style jsx>{`

        /* =========================================
           SCREEN
        ========================================= */

        .order-page {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
        }

        .order-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .order-back-button,
        .order-invoice-button,
        .order-print-button {
          height: 41px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 13px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .order-back-button {
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #687386;
        }

        .order-back-button:hover {
          background: #f7f8fa;
          color: #263043;
        }

        .order-invoice-button {
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #596476;
        }

        .order-invoice-button:hover {
          background: #f7f8fa;
          color: #263043;
        }

        .order-invoice-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .order-print-button {
          border: 1px solid #172033;
          background: #172033;
          color: #ffffff;
        }

        .order-print-button:hover {
          background: #263043;
        }

        /* =========================================
           PROFESSIONAL DOCUMENT
        ========================================= */

        .invoice-document {
          overflow: hidden;
          border: 1px solid #dfe4eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 8px 30px rgba(23, 32, 51, 0.05);
        }

        .invoice-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 30px;
          padding: 35px 38px 28px;
          border-bottom: 1px solid #e5e8ed;
        }

        .invoice-company-block h1 {
          margin: 0;
          color: #172033;
          font-size: 24px;
          line-height: 30px;
          font-weight: 800;
          letter-spacing: -0.035em;
        }

        .invoice-company-block span {
          display: block;
          margin-top: 5px;
          color: #8b95a4;
          font-size: 10px;
          font-weight: 500;
        }

        .invoice-title-block {
          text-align: right;
        }

        .invoice-title {
          color: #6d7786;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .invoice-number {
          margin-top: 7px;
          color: #172033;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .invoice-meta-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-bottom: 1px solid #e5e8ed;
        }

        .invoice-meta-group {
          min-height: 75px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 6px;
          padding: 12px 22px;
          border-right: 1px solid #e5e8ed;
        }

        .invoice-meta-group:last-child {
          border-right: 0;
        }

        .invoice-meta-group > span {
          color: #9aa2af;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .invoice-meta-group > strong {
          color: #465163;
          font-size: 10px;
          font-weight: 700;
        }

        .invoice-status {
          width: fit-content;
          padding: 4px 7px;
          border-radius: 5px;
          font-size: 8px !important;
        }

        .invoice-status.success {
          background: #eef8f1;
          color: #3f7652;
        }

        .invoice-status.warning {
          background: #f4f4ed;
          color: #77724b;
        }

        .invoice-status.danger {
          background: #f9eeee;
          color: #915858;
        }

        .invoice-status.neutral {
          background: #f2f4f6;
          color: #687284;
        }

        /* =========================================
           PARTIES
        ========================================= */

        .invoice-parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 50px;
          padding: 29px 38px;
          border-bottom: 1px solid #e5e8ed;
        }

        .invoice-party {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .invoice-party-right {
          align-items: flex-end;
          text-align: right;
        }

        .invoice-section-label {
          margin-bottom: 10px;
          color: #9aa2af;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .invoice-party-name {
          color: #30394a;
          font-size: 12px;
          font-weight: 750;
        }

        .invoice-party > span {
          margin-top: 4px;
          color: #7e8897;
          font-size: 9px;
          line-height: 14px;
        }

        /* =========================================
           ITEMS
        ========================================= */

        .invoice-items-section {
          padding: 27px 38px 0;
        }

        .invoice-items-table {
          width: 100%;
          border-collapse: collapse;
        }

        .invoice-items-table th {
          height: 38px;
          padding: 0 10px;
          border-top: 1px solid #e5e8ed;
          border-bottom: 1px solid #e5e8ed;
          color: #8f98a6;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-align: left;
          white-space: nowrap;
        }

        .invoice-items-table th:first-child,
        .invoice-items-table td:first-child {
          padding-left: 0;
        }

        .invoice-items-table th:last-child,
        .invoice-items-table td:last-child {
          padding-right: 0;
        }

        .invoice-items-table td {
          min-height: 58px;
          padding: 13px 10px;
          border-bottom: 1px solid #edf0f3;
          color: #687386;
          font-size: 10px;
          vertical-align: middle;
        }

        .invoice-items-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .item-description {
          width: 48%;
        }

        .item-description strong,
        .item-description span {
          display: block;
        }

        .item-description strong {
          color: #394355;
          font-size: 10px;
          font-weight: 700;
        }

        .item-description span {
          margin-top: 3px;
          color: #9aa2af;
          font-size: 8px;
        }

        .item-sku {
          color: #929ba8 !important;
          white-space: nowrap;
        }

        .item-qty {
          width: 70px;
          text-align: center !important;
        }

        .item-price,
        .item-total {
          width: 125px;
          text-align: right !important;
          white-space: nowrap;
        }

        .item-total strong {
          color: #344052;
          font-weight: 750;
        }

        .invoice-empty {
          padding: 35px;
          border-top: 1px solid #e5e8ed;
          color: #9aa2af;
          font-size: 10px;
          text-align: center;
        }

        /* =========================================
           TOTALS
        ========================================= */

        .invoice-bottom {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 50px;
          padding: 30px 38px;
          border-top: 1px solid #e5e8ed;
        }

        .invoice-notes-block {
          min-height: 150px;
        }

        .invoice-notes-block p {
          max-width: 500px;
          margin: 0;
          color: #687386;
          font-size: 10px;
          line-height: 17px;
          white-space: pre-wrap;
        }

        .invoice-thank-you {
          padding-top: 20px;
          color: #9aa2af;
          font-size: 10px;
        }

        .invoice-total-block {
          width: 100%;
        }

        .invoice-total-row {
          min-height: 31px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .invoice-total-row span {
          color: #7e8897;
          font-size: 10px;
        }

        .invoice-total-row strong {
          color: #465163;
          font-size: 10px;
          font-weight: 700;
        }

        .invoice-total-divider {
          height: 1px;
          margin: 10px 0;
          background: #dfe4eb;
        }

        .invoice-grand-total {
          min-height: 55px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .invoice-grand-total span {
          color: #30394a;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        .invoice-grand-total strong {
          color: #172033;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.035em;
        }

        /* =========================================
           FOOTER
        ========================================= */

        .invoice-footer {
          min-height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 13px 38px;
          border-top: 1px solid #e5e8ed;
          background: #fafbfd;
        }

        .invoice-footer > div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .invoice-footer strong {
          color: #596476;
          font-size: 9px;
          font-weight: 750;
        }

        .invoice-footer span {
          color: #9aa2af;
          font-size: 8px;
        }

        .invoice-footer-right {
          align-items: flex-end;
          text-align: right;
        }

        /* =========================================
           SCREEN INFORMATION
        ========================================= */

        .screen-information {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 17px;
          margin-top: 17px;
        }

        .screen-card {
          overflow: hidden;
          border: 1px solid #e2e6ec;
          border-radius: 13px;
          background: #ffffff;
        }

        .screen-card-header {
          min-height: 65px;
          display: flex;
          align-items: center;
          padding: 13px 17px;
          border-bottom: 1px solid #edf0f4;
        }

        .screen-card-header h2 {
          margin: 0;
          color: #30394a;
          font-size: 13px;
          font-weight: 780;
        }

        .screen-card-header p {
          margin: 4px 0 0;
          color: #9aa2af;
          font-size: 9px;
        }

        .screen-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .screen-info-grid > div {
          min-height: 65px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          padding: 12px 17px;
          border-right: 1px solid #edf0f4;
          border-bottom: 1px solid #edf0f4;
        }

        .screen-info-grid > div:nth-child(2n) {
          border-right: 0;
        }

        .screen-info-grid > div:nth-last-child(-n + 2) {
          border-bottom: 0;
        }

        .screen-info-grid span {
          color: #9aa2af;
          font-size: 8px;
          font-weight: 650;
        }

        .screen-info-grid strong {
          color: #596476;
          font-size: 10px;
          font-weight: 700;
        }

        .screen-customer {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px;
        }

        .screen-customer-avatar {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          flex: 0 0 40px;
          border: 1px solid #e2e6ec;
          border-radius: 9px;
          background: #f7f8fa;
          color: #697386;
          font-size: 12px;
          font-weight: 800;
        }

        .screen-customer > div:last-child {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .screen-customer strong {
          color: #465163;
          font-size: 11px;
          font-weight: 750;
        }

        .screen-customer a {
          margin-top: 3px;
          color: #7e8897;
          font-size: 9px;
          text-decoration: none;
        }

        .screen-customer a:hover {
          color: #263043;
          text-decoration: underline;
        }

        /* =========================================
           FINANCIAL SECTION
        ========================================= */

        .financial-section {
          margin-top: 17px;
        }

        .financial-section-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 10px;
          padding: 0 2px;
        }

        .financial-section-header h2 {
          margin: 0;
          color: #30394a;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .financial-section-header p {
          margin: 4px 0 0;
          color: #9aa2af;
          font-size: 9px;
        }

        .financial-card {
          overflow: hidden;
          margin-bottom: 12px;
          border: 1px solid #e2e6ec;
          border-radius: 13px;
          background: #ffffff;
        }

        .financial-card:last-child {
          margin-bottom: 0;
        }

        .financial-card-header {
          min-height: 69px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 17px;
          border-bottom: 1px solid #edf0f4;
        }

        .financial-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          flex: 0 0 38px;
          border: 1px solid #e3e7ec;
          border-radius: 9px;
          background: #f7f8fa;
          color: #697386;
        }

        .financial-card-title {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .financial-card-title h3 {
          margin: 0;
          color: #394355;
          font-size: 12px;
          font-weight: 780;
        }

        .financial-card-title p {
          margin: 4px 0 0;
          color: #9aa2af;
          font-size: 9px;
        }

        .financial-status {
          flex: 0 0 auto;
          padding: 5px 8px;
          border-radius: 5px;
          font-size: 8px;
          font-weight: 750;
        }

        .financial-status.success {
          background: #eef8f1;
          color: #3f7652;
        }

        .financial-status.warning {
          background: #f4f4ed;
          color: #77724b;
        }

        .financial-status.danger {
          background: #f9eeee;
          color: #915858;
        }

        .financial-status.neutral {
          background: #f2f4f6;
          color: #687284;
        }

        .financial-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-bottom: 1px solid #edf0f4;
        }

        .financial-metrics > div {
          min-height: 78px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          padding: 12px 17px;
          border-right: 1px solid #edf0f4;
        }

        .financial-metrics > div:last-child {
          border-right: 0;
        }

        .financial-metrics span {
          color: #9aa2af;
          font-size: 8px;
          font-weight: 700;
        }

        .financial-metrics strong {
          color: #465163;
          font-size: 12px;
          font-weight: 780;
        }

        .paid-value {
          color: #3f7652 !important;
        }

        .balance-value {
          color: #915858 !important;
        }

        .financial-card-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 17px;
        }

        .primary-financial-button,
        .secondary-financial-button {
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 12px;
          border-radius: 7px;
          font-family: inherit;
          font-size: 9px;
          font-weight: 750;
          cursor: pointer;
        }

        .primary-financial-button {
          border: 1px solid #172033;
          background: #172033;
          color: #ffffff;
        }

        .primary-financial-button:hover {
          background: #263043;
        }

        .secondary-financial-button {
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #596476;
        }

        .secondary-financial-button:hover {
          background: #f7f8fa;
          color: #263043;
        }

        .financial-empty {
          min-height: 95px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 18px;
        }

        .financial-empty > div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .financial-empty strong {
          color: #465163;
          font-size: 10px;
          font-weight: 750;
        }

        .financial-empty span {
          color: #9aa2af;
          font-size: 9px;
          line-height: 15px;
        }

        .financial-loading {
          min-height: 95px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #8f98a6;
          font-size: 9px;
        }

        .small-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid #e5e8ed;
          border-top-color: #697386;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        /* =========================================
           PAYMENTS
        ========================================= */

        .payment-count {
          padding: 5px 8px;
          border: 1px solid #e3e7ec;
          border-radius: 5px;
          background: #f7f8fa;
          color: #697386;
          font-size: 8px;
          font-weight: 700;
        }

        .payment-table-wrapper {
          overflow-x: auto;
        }

        .payment-table {
          width: 100%;
          min-width: 620px;
          border-collapse: collapse;
        }

        .payment-table th {
          height: 36px;
          padding: 0 17px;
          border-bottom: 1px solid #edf0f4;
          color: #929ba8;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-align: left;
          white-space: nowrap;
        }

        .payment-table td {
          padding: 13px 17px;
          border-bottom: 1px solid #edf0f4;
          color: #697386;
          font-size: 9px;
          vertical-align: middle;
        }

        .payment-table tbody tr:last-child td {
          border-bottom: 1px solid #edf0f4;
        }

        .payment-table td > strong,
        .payment-table td > span {
          display: block;
        }

        .payment-table td strong {
          color: #465163;
          font-size: 9px;
          font-weight: 700;
        }

        .payment-table td span {
          margin-top: 3px;
          color: #9aa2af;
          font-size: 8px;
        }

        .payment-method {
          color: #596476 !important;
          font-weight: 650;
        }

        .payment-reference {
          color: #697386 !important;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .payment-muted {
          color: #b1b7c0 !important;
        }

        .payment-amount-column {
          text-align: right !important;
          white-space: nowrap;
        }

        .payment-table tfoot td {
          height: 49px;
          border-bottom: 0;
          color: #7e8897;
          font-size: 9px;
          font-weight: 700;
        }

        .payment-table tfoot td:last-child strong {
          color: #172033;
          font-size: 11px;
          font-weight: 800;
        }

        .payment-empty {
          min-height: 105px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 18px;
        }

        .payment-empty > span {
          color: #9aa2af;
          font-size: 9px;
        }

        .payment-footer-actions {
          min-height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 10px 17px;
          border-top: 1px solid #edf0f4;
          background: #fafbfd;
        }

        .payment-footer-actions > div {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .payment-footer-actions span {
          color: #8f98a6;
          font-size: 9px;
        }

        .payment-footer-actions strong {
          font-size: 11px;
          font-weight: 800;
        }

        /* =========================================
           DOCUMENT FLOW
        ========================================= */

        .connection-card {
          overflow: hidden;
          margin-top: 12px;
          border: 1px solid #e2e6ec;
          border-radius: 13px;
          background: #ffffff;
        }

        .connection-header {
          min-height: 65px;
          display: flex;
          align-items: center;
          padding: 13px 17px;
          border-bottom: 1px solid #edf0f4;
        }

        .connection-header h2 {
          margin: 0;
          color: #30394a;
          font-size: 13px;
          font-weight: 780;
        }

        .connection-header p {
          margin: 4px 0 0;
          color: #9aa2af;
          font-size: 9px;
        }

        .connection-flow {
          min-height: 105px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          padding: 18px;
        }

        .connection-node {
          min-width: 190px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 13px;
          border: 1px solid #e3e7ec;
          border-radius: 9px;
          background: #fafbfd;
        }

        .connection-node.connection-active {
          border-color: #d9e8dd;
          background: #f8fcf9;
        }

        .connection-node-icon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          flex: 0 0 32px;
          border: 1px solid #e3e7ec;
          border-radius: 7px;
          background: #ffffff;
          color: #697386;
        }

        .connection-node > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .connection-node strong {
          color: #465163;
          font-size: 9px;
          font-weight: 750;
        }

        .connection-node span {
          overflow: hidden;
          color: #9aa2af;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .connection-arrow {
          color: #b1b7c0;
          font-size: 17px;
          font-weight: 500;
        }

        .mobile-order-actions {
          display: none;
        }

        /* =========================================
           TABLET
        ========================================= */

        @media (max-width: 850px) {

          .invoice-header {
            padding: 27px 25px 23px;
          }

          .invoice-parties {
            padding: 25px;
          }

          .invoice-items-section {
            padding: 24px 25px 0;
          }

          .invoice-bottom {
            padding: 27px 25px;
          }

          .invoice-footer {
            padding: 13px 25px;
          }

          .invoice-meta-group {
            padding: 12px 15px;
          }

          .invoice-bottom {
            grid-template-columns: 1fr 300px;
            gap: 30px;
          }

          .financial-metrics {
            grid-template-columns: 1fr 1fr;
          }

          .financial-metrics > div:nth-child(2) {
            border-right: 0;
          }

          .financial-metrics > div:nth-child(-n + 2) {
            border-bottom: 1px solid #edf0f4;
          }

          .connection-flow {
            gap: 10px;
          }

          .connection-node {
            min-width: 0;
            flex: 1;
          }

        }

        /* =========================================
           MOBILE
        ========================================= */

        @media (max-width: 650px) {

          .order-header-actions {
            gap: 5px;
          }

          .order-back-button,
          .order-invoice-button,
          .order-print-button {
            height: 37px;
            padding: 0 9px;
            font-size: 9px;
          }

          .order-back-button svg {
            display: none;
          }

          .order-print-button svg {
            display: none;
          }

          .order-invoice-button svg {
            display: none;
          }

          .invoice-document {
            border-radius: 11px;
          }

          .invoice-header {
            flex-direction: column;
            gap: 17px;
            padding: 23px 18px;
          }

          .invoice-company-block h1 {
            font-size: 20px;
            line-height: 26px;
          }

          .invoice-title-block {
            text-align: left;
          }

          .invoice-meta-row {
            grid-template-columns: 1fr 1fr;
          }

          .invoice-meta-group:nth-child(2) {
            border-right: 0;
          }

          .invoice-meta-group:nth-child(-n + 2) {
            border-bottom: 1px solid #e5e8ed;
          }

          .invoice-parties {
            grid-template-columns: 1fr;
            gap: 23px;
            padding: 22px 18px;
          }

          .invoice-party-right {
            align-items: flex-start;
            text-align: left;
          }

          .invoice-items-section {
            padding: 22px 18px 0;
          }

          .invoice-items-table {
            min-width: 650px;
          }

          .invoice-items-section {
            overflow-x: auto;
          }

          .invoice-bottom {
            grid-template-columns: 1fr;
            gap: 15px;
            padding: 22px 18px;
          }

          .invoice-notes-block {
            min-height: auto;
          }

          .invoice-total-block {
            width: 100%;
          }

          .invoice-footer {
            align-items: flex-start;
            flex-direction: column;
            padding: 14px 18px;
          }

          .invoice-footer-right {
            align-items: flex-start;
            text-align: left;
          }

          .screen-information {
            grid-template-columns: 1fr;
          }

          .financial-section-header {
            align-items: flex-start;
          }

          .financial-card-title {
            align-items: flex-start;
            flex-direction: column;
            gap: 6px;
          }

          .financial-status,
          .payment-count {
            align-self: flex-start;
          }

          .financial-metrics {
            grid-template-columns: 1fr 1fr;
          }

          .financial-metrics > div {
            min-height: 68px;
            padding: 10px 13px;
          }

          .financial-card-actions {
            justify-content: stretch;
          }

          .financial-card-actions button {
            flex: 1;
          }

          .financial-empty {
            align-items: flex-start;
            flex-direction: column;
          }

          .financial-empty .primary-financial-button {
            width: 100%;
          }

          .payment-empty {
            align-items: flex-start;
            flex-direction: column;
          }

          .payment-empty .primary-financial-button {
            width: 100%;
          }

          .payment-footer-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .payment-footer-actions > div {
            width: 100%;
            justify-content: space-between;
          }

          .payment-footer-actions .primary-financial-button {
            width: 100%;
          }

          .connection-flow {
            align-items: stretch;
            flex-direction: column;
            gap: 5px;
          }

          .connection-node {
            width: 100%;
          }

          .connection-arrow {
            display: none;
          }

          .mobile-order-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 17px;
          }

          .mobile-order-actions button {
            min-height: 42px;
            padding: 0 8px;
            border: 1px solid #dfe4eb;
            border-radius: 8px;
            background: #ffffff;
            color: #596476;
            cursor: pointer;
            font-family: inherit;
            font-size: 9px;
            font-weight: 700;
          }

          .mobile-order-actions button:last-child {
            border-color: #172033;
            background: #172033;
            color: #ffffff;
          }

        }

        /* =========================================
           PRINT / PDF
        ========================================= */

        @media print {

          @page {
            size: A4;
            margin: 12mm;
          }

          :global(html),
          :global(body) {
            width: 100%;
            min-width: 0;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          :global(body *) {
            visibility: hidden;
          }

          .order-page,
          .order-page * {
            visibility: visible;
          }

          .order-page {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 0;
          }

          .invoice-document {
            width: 100%;
            max-width: none;
            overflow: visible;
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }

          .invoice-header {
            padding: 0 0 18px;
          }

          .invoice-company-block h1 {
            font-size: 22px;
          }

          .invoice-meta-row {
            grid-template-columns: repeat(4, 1fr);
          }

          .invoice-meta-group {
            min-height: 62px;
            padding: 9px 12px;
          }

          .invoice-parties {
            padding: 20px 0;
          }

          .invoice-items-section {
            padding: 20px 0 0;
          }

          .invoice-items-table th {
            height: 34px;
          }

          .invoice-items-table td {
            padding: 10px 8px;
          }

          .invoice-bottom {
            grid-template-columns: minmax(0, 1fr) 285px;
            gap: 35px;
            padding: 22px 0;
          }

          .invoice-footer {
            padding: 12px 0;
            background: #ffffff;
          }

          .screen-information,
          .financial-section,
          .connection-card,
          .mobile-order-actions,
          .order-header-actions {
            display: none !important;
          }

          .invoice-items-table {
            page-break-inside: auto;
          }

          .invoice-items-table tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          .invoice-items-table thead {
            display: table-header-group;
          }

          .invoice-bottom {
            page-break-inside: avoid;
          }

          .invoice-footer {
            page-break-inside: avoid;
          }

        }

      `}</style>
    </AppShell>
  );
}