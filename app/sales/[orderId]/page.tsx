"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { useRegionalSettings } from "@/app/components/regional-settings-provider";
import { createClient } from "@/lib/supabase/client";
import { formatMoney as formatRegionalMoney } from "@/lib/regional-settings";

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
  const { settings } = useRegionalSettings();
  const formatMoneyForDisplay = (
    amount: number,
    _currency?: string,
  ) =>
    formatRegionalMoney(amount, settings);

  const rawOrderId = params.orderId;
  const orderId = Array.isArray(rawOrderId)
    ? String(rawOrderId[0] || "")
    : String(rawOrderId || "");

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

  const [isCancelling, setIsCancelling] =
    useState(false);

  const [cancellationError, setCancellationError] =
    useState<string | null>(null);

  const [cancellationSuccess, setCancellationSuccess] =
    useState<string | null>(null);

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
      } =
        await supabase.auth.getUser();

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
        .eq(
          "user_id",
          user.id
        )
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

      const {
        data: companyData,
        error: companyError,
      } = await supabase
        .from("companies")
        .select(
          "id, name, currency"
        )
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
        .eq(
          "company_id",
          companyId
        )
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
        .eq(
          "order_id",
          orderId
        )
        .eq(
          "company_id",
          companyId
        )
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

      const loadedItems =
        (itemsData ||
          []) as OrderItem[];

      setOrder(
        orderData as unknown as Order
      );

      setItems(loadedItems);

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
    const timer = window.setTimeout(() => {
      void loadOrder();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
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

  async function cancelOrder() {
    if (!order) {
      return;
    }

    if (isCancelling) {
      return;
    }

    const confirmed = window.confirm(
      `Cancel order ${order.order_number}?\n\n` +
        `If this order has already been fulfilled, its inventory ` +
        `will be reversed automatically.\n\n` +
        `This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setIsCancelling(true);
    setCancellationError(null);
    setCancellationSuccess(null);


    try {
      const response =
        await fetch(
          `/api/sales/${encodeURIComponent(
            order.id
          )}/cancel`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              reason:
                "Sales order cancellation",
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to cancel this order."
        );
      }

      setCancellationSuccess(
        "Order cancelled successfully. Any fulfilled inventory was reversed."
      );

      await loadOrder();
      router.refresh();
    } catch (error) {
      console.error(
        "Cancel order error:",
        error
      );

      setCancellationError(
        error instanceof Error
          ? error.message
          : "Unable to cancel this order."
      );
    } finally {
      setIsCancelling(false);
    }
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
            {error ||
              "Order not found"}
          </strong>

          <span>
            The requested order could not be loaded.
          </span>

          <div className="error-actions">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/sales"
                )
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

  const totalQuantity =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.quantity || 0
        ),
      0
    );

  const hasDiscount =
    Number(
      order.discount_amount || 0
    ) > 0;

  const hasTax =
    Number(
      order.tax_amount || 0
    ) > 0;

  const hasShipping =
    Number(
      order.shipping_amount || 0
    ) > 0;

  const recordedPaymentsTotal =
    payments.reduce(
      (sum, payment) =>
        sum +
        Number(
          payment.amount || 0
        ),
      0
    );

  const paidAmount = invoice
    ? Math.max(
        Number(
          invoice.amount_paid ||
            0
        ),
        recordedPaymentsTotal
      )
    : 0;

  const invoiceTotal =
    Number(
      invoice?.total || 0
    );

  const balanceDue =
    Math.max(
      invoiceTotal -
        paidAmount,
      0
    );

  const invoicePaymentStatus =
    invoice
      ? paidAmount >=
          invoiceTotal &&
        invoiceTotal > 0
        ? "paid"
        : paidAmount > 0
          ? "partially_paid"
          : invoice.status ===
              "overdue"
            ? "overdue"
            : "unpaid"
      : "unpaid";


  return (
    <AppShell
      title={
        order.order_number
      }
      description={`Created ${formatDateTime(
        order.created_at
      )}`}
      actions={
        <div className="order-header-actions">

          <button
            type="button"
            className="order-back-button"
            onClick={() =>
              router.push(
                "/sales"
              )
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
              onClick={
                createInvoice
              }
              disabled={
                invoiceLoading
              }
            >
              {invoiceLoading
                ? "Loading..."
                : "Create Invoice"}
            </button>
          )}

          {invoice && (
            <button
              type="button"
              className="order-invoice-button"
              onClick={
                viewInvoice
              }
            >
              View Invoice
            </button>
          )}

          {order.status !== "cancelled" &&
            order.status !== "refunded" &&
            order.fulfillment_status !== "fulfilled" && (
              <button
                type="button"
                className="order-fulfill-button"
                onClick={() =>
                  router.push(
                    `/sales/${encodeURIComponent(order.id)}/fulfill`
                  )
                }
              >
                Fulfill Order
              </button>
            )}

          <button
            type="button"
            className="order-print-button"
            onClick={
              printOrder
            }
          >
            {printing
              ? "Printing..."
              : "Print / PDF"}
          </button>

          {order.status !== "cancelled" &&
            order.status !== "refunded" && (
              <button
                type="button"
                className="order-cancel-button"
                onClick={() =>
                  void cancelOrder()
                }
                disabled={
                  isCancelling
                }
              >
                {isCancelling
                  ? "Cancelling..."
                  : "Cancel Order"}
              </button>
          )}

        </div>
      }
    >
      <div className="order-page">

        {cancellationError && (
          <div className="order-alert danger">
            {cancellationError}
          </div>
        )}

        {cancellationSuccess && (
          <div className="order-alert success">
            {cancellationSuccess}
          </div>
        )}


        <section className="invoice-document">

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
                {
                  order.order_number
                }
              </div>
            </div>

          </header>

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

          <div className="invoice-parties">

            <div className="invoice-party">

              <div className="invoice-section-label">
                BILL TO
              </div>

              <strong className="invoice-party-name">
                {
                  customerName
                }
              </strong>

              {order.customers
                ?.email && (
                <span>
                  {
                    order
                      .customers
                      .email
                  }
                </span>
              )}

              {order.customers
                ?.phone && (
                <span>
                  {
                    order
                      .customers
                      .phone
                  }
                </span>
              )}

              {!order
                .customers
                ?.email &&
                !order
                  .customers
                  ?.phone && (
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
                {
                  companyName
                }
              </strong>

              <span>
                Sales Order
              </span>

              <span>
                Order #
                {
                  order.order_number
                }
              </span>

            </div>

          </div>

          <div className="invoice-items-section">

            <div className="invoice-section-label">
              ITEMS
            </div>

            {items.length ===
            0 ? (
              <div className="invoice-empty">
                No items were added to this order.
              </div>
            ) : (
              <div className="invoice-items-table-wrap">
                <table className="invoice-items-table">
                  <thead>
                    <tr>
                      <th>
                        Item
                      </th>

                      <th>
                        SKU
                      </th>

                      <th className="numeric">
                        Qty
                      </th>

                      <th className="numeric">
                        Unit Price
                      </th>

                      <th className="numeric">
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map(
                      (item) => (
                        <tr
                          key={
                            item.id
                          }
                        >
                          <td>
                            <div className="item-name">
                              {
                                item.product_name
                              }
                            </div>

                            {item.variant_name && (
                              <div className="item-variant">
                                {
                                  item.variant_name
                                }
                              </div>
                            )}
                          </td>

                          <td>
                            {
                              item.sku ||
                              "—"
                            }
                          </td>

                          <td className="numeric">
                            {
                              item.quantity
                            }
                          </td>

                          <td className="numeric">
                            {formatMoneyForDisplay(
                              Number(
                                item.unit_price ||
                                  0
                              ),
                              currency
                            )}
                          </td>

                          <td className="numeric">
                            {formatMoneyForDisplay(
                              Number(
                                item.line_total ||
                                  0
                              ),
                              currency
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          <div className="invoice-summary-row">

            <div className="invoice-notes">

              {order.notes && (
                <>
                  <div className="invoice-section-label">
                    NOTES
                  </div>

                  <p>
                    {order.notes}
                  </p>
                </>
              )}

            </div>

            <div className="invoice-totals">

              <div className="invoice-total-row">
                <span>
                  Subtotal
                </span>

                <strong>
                  {formatMoneyForDisplay(
                    Number(
                      order.subtotal ||
                        0
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
                    -
                    {formatMoneyForDisplay(
                      Number(
                        order.discount_amount ||
                          0
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
                    {formatMoneyForDisplay(
                      Number(
                        order.tax_amount ||
                          0
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
                    {formatMoneyForDisplay(
                      Number(
                        order.shipping_amount ||
                          0
                      ),
                      currency
                    )}
                  </strong>
                </div>
              )}

              <div className="invoice-total-row grand-total">
                <span>
                  Total
                </span>

                <strong>
                  {formatMoneyForDisplay(
                    Number(
                      order.total_amount ||
                        0
                    ),
                    currency
                  )}
                </strong>
              </div>

            </div>

          </div>

          {invoice && (
            <section className="attached-invoice-section">

              <div className="attached-invoice-header">

                <div>
                  <div className="invoice-section-label">
                    ATTACHED INVOICE
                  </div>

                  <div className="attached-invoice-title">
                    {
                      invoice.invoice_number
                    }
                  </div>
                </div>

                <div className="attached-invoice-actions">

                  <button
                    type="button"
                    className="order-invoice-button"
                    onClick={
                      viewInvoice
                    }
                  >
                    View Invoice
                  </button>

                  <button
                    type="button"
                    className="order-payment-button"
                    onClick={
                      recordPayment
                    }
                  >
                    Record Payment
                  </button>

                </div>

              </div>

              <div className="attached-invoice-grid">

                <div>
                  <span>
                    Invoice Status
                  </span>

                  <strong>
                    {formatStatus(
                      invoice.status
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Invoice Total
                  </span>

                  <strong>
                    {formatMoneyForDisplay(
                      invoiceTotal,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Paid
                  </span>

                  <strong>
                    {formatMoneyForDisplay(
                      paidAmount,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Balance Due
                  </span>

                  <strong>
                    {formatMoneyForDisplay(
                      balanceDue,
                      currency
                    )}
                  </strong>
                </div>

              </div>

              {payments.length > 0 && (
                <div className="invoice-payments">

                  <div className="invoice-section-label">
                    RECORDED PAYMENTS
                  </div>

                  <div className="invoice-payments-list">
                    {payments.map(
                      (payment) => (
                        <div
                          key={
                            payment.id
                          }
                          className="invoice-payment-row"
                        >
                          <div>
                            <strong>
                              {formatMoneyForDisplay(
                                Number(
                                  payment.amount ||
                                    0
                                ),
                                payment.currency ||
                                  currency
                              )}
                            </strong>

                            <span>
                              {payment.payment_method ||
                                "Payment"}
                              {payment.reference
                                ? ` • ${payment.reference}`
                                : ""}
                            </span>
                          </div>

                          <time>
                            {formatDateTime(
                              payment.paid_at
                            )}
                          </time>
                        </div>
                      )
                    )}
                  </div>

                </div>
              )}

            </section>
          )}

        </section>

      </div>

      <style jsx>{`
        .order-page {
          padding-bottom: 40px;
        }

        .order-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .order-fulfill-button {
          height: 38px;
          padding: 0 14px;
          border: 1px solid #111827;
          border-radius: 9px;
          background: #111827;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .order-fulfill-button:hover {
          background: #1f2937;
        }

        .order-header-actions button {
          height: 38px;
          padding: 0 14px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            box-shadow 0.15s ease,
            transform 0.15s ease;
        }

        .order-back-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #596476;
        }

        .order-back-button:hover {
          background: #f6f8fa;
          color: #263043;
        }

        .order-invoice-button {
          border: 1px solid #059669;
          background: #059669;
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(5, 150, 105, 0.15);
        }

        .order-invoice-button:hover:not(:disabled) {
          background: #047857;
          border-color: #047857;
          box-shadow: 0 4px 10px rgba(5, 150, 105, 0.18);
          transform: translateY(-1px);
        }

        .order-invoice-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .order-print-button {
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #596476;
        }

        .order-print-button:hover {
          background: #f6f8fa;
          color: #263043;
        }

        .order-cancel-button {
          border: 1px solid #f0caca;
          background: #fff8f8;
          color: #a64c4c;
        }

        .order-cancel-button:hover:not(:disabled) {
          border-color: #e7a9a9;
          background: #fff1f1;
        }

        .order-cancel-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .order-alert {
          margin-bottom: 14px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
        }

        .order-alert.success {
          border: 1px solid #b7e4cf;
          background: #effaf4;
          color: #18794e;
        }

        .order-alert.danger {
          border: 1px solid #ead0d0;
          background: #fff7f7;
          color: #9b4b4b;
        }

        .invoice-document {
          overflow: hidden;
          border: 1px solid #e1e5eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(24, 39, 75, 0.04);
        }

        .invoice-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 30px;
          border-bottom: 1px solid #e7ebf0;
        }

        .invoice-company-block h1 {
          margin: 0;
          color: #172033;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .invoice-company-block span {
          display: block;
          margin-top: 5px;
          color: #8b95a5;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .invoice-title-block {
          text-align: right;
        }

        .invoice-title {
          color: #8b95a5;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .invoice-number {
          margin-top: 5px;
          color: #172033;
          font-size: 18px;
          font-weight: 800;
        }

        .invoice-meta-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-bottom: 1px solid #e7ebf0;
        }

        .invoice-meta-group {
          min-width: 0;
          padding: 16px 20px;
          border-right: 1px solid #e7ebf0;
        }

        .invoice-meta-group:last-child {
          border-right: 0;
        }

        .invoice-meta-group span {
          display: block;
          color: #99a1ae;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .invoice-meta-group strong {
          display: block;
          margin-top: 6px;
          color: #3d4655;
          font-size: 12px;
          font-weight: 700;
        }

        .invoice-status.success {
          color: #198754 !important;
        }

        .invoice-status.warning {
          color: #b7791f !important;
        }

        .invoice-status.danger {
          color: #b34d4d !important;
        }

        .invoice-status.neutral {
          color: #667085 !important;
        }

        .invoice-parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          padding: 24px 30px;
          border-bottom: 1px solid #e7ebf0;
        }

        .invoice-party {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .invoice-party-right {
          align-items: flex-end;
          text-align: right;
        }

        .invoice-section-label {
          margin-bottom: 7px;
          color: #98a1ae;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .invoice-party-name {
          color: #283142;
          font-size: 13px;
          font-weight: 800;
        }

        .invoice-party span {
          color: #7c8696;
          font-size: 11px;
        }

        .invoice-items-section {
          padding: 24px 30px 0;
        }

        .invoice-items-table-wrap {
          overflow-x: auto;
          border: 1px solid #e7ebf0;
          border-radius: 10px;
        }

        .invoice-items-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 650px;
        }

        .invoice-items-table th {
          padding: 11px 13px;
          border-bottom: 1px solid #e7ebf0;
          background: #f8fafc;
          color: #8992a1;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-align: left;
          text-transform: uppercase;
        }

        .invoice-items-table th.numeric,
        .invoice-items-table td.numeric {
          text-align: right;
        }

        .invoice-items-table td {
          padding: 13px;
          border-bottom: 1px solid #edf0f4;
          color: #596476;
          font-size: 11px;
        }

        .invoice-items-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .item-name {
          color: #283142;
          font-weight: 700;
        }

        .item-variant {
          margin-top: 3px;
          color: #9aa2af;
          font-size: 10px;
        }

        .invoice-empty {
          padding: 28px;
          border: 1px dashed #dfe4eb;
          border-radius: 10px;
          color: #98a1ae;
          font-size: 11px;
          text-align: center;
        }

        .invoice-summary-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
          gap: 40px;
          padding: 24px 30px 30px;
        }

        .invoice-notes p {
          max-width: 520px;
          margin: 0;
          color: #667085;
          font-size: 11px;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .invoice-totals {
          border-top: 1px solid #e7ebf0;
        }

        .invoice-total-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 10px 0;
          color: #667085;
          font-size: 11px;
        }

        .invoice-total-row strong {
          color: #344054;
          font-weight: 700;
        }

        .invoice-total-row.grand-total {
          margin-top: 5px;
          padding-top: 14px;
          border-top: 1px solid #dfe4eb;
          color: #263043;
          font-size: 13px;
          font-weight: 800;
        }

        .invoice-total-row.grand-total strong {
          color: #172033;
          font-size: 15px;
          font-weight: 800;
        }

        .attached-invoice-section {
          margin: 0 30px 30px;
          border: 1px solid #cdebdc;
          border-radius: 12px;
          background: #f6fcf8;
        }

        .attached-invoice-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 17px 18px;
          border-bottom: 1px solid #dcefe4;
        }

        .attached-invoice-title {
          color: #1f5139;
          font-size: 13px;
          font-weight: 800;
        }

        .attached-invoice-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .order-payment-button {
          height: 36px;
          padding: 0 13px;
          border: 1px solid #d8dee7;
          border-radius: 8px;
          background: #ffffff;
          color: #596476;
          font-family: inherit;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .order-payment-button:hover {
          background: #f5f7f9;
          color: #263043;
        }

        .attached-invoice-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0;
        }

        .attached-invoice-grid > div {
          padding: 15px 18px;
          border-right: 1px solid #dcefe4;
        }

        .attached-invoice-grid > div:last-child {
          border-right: 0;
        }

        .attached-invoice-grid span {
          display: block;
          color: #789184;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .attached-invoice-grid strong {
          display: block;
          margin-top: 5px;
          color: #294d3a;
          font-size: 12px;
          font-weight: 800;
        }

        .invoice-payments {
          padding: 16px 18px;
          border-top: 1px solid #dcefe4;
        }

        .invoice-payments-list {
          overflow: hidden;
          border: 1px solid #dcefe4;
          border-radius: 9px;
          background: #ffffff;
        }

        .invoice-payment-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 11px 13px;
          border-bottom: 1px solid #edf3ef;
        }

        .invoice-payment-row:last-child {
          border-bottom: 0;
        }

        .invoice-payment-row > div {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .invoice-payment-row strong {
          color: #28513b;
          font-size: 11px;
          font-weight: 800;
        }

        .invoice-payment-row span,
        .invoice-payment-row time {
          color: #7b8a82;
          font-size: 10px;
        }







        @media (max-width: 980px) {

        }

        @media (max-width: 760px) {
          .invoice-header,
          .invoice-summary-row,

          .invoice-meta-row,
          .attached-invoice-grid,
          .invoice-parties {
            grid-template-columns: 1fr;
          }

          .invoice-meta-group {
            border-right: 0;
            border-bottom: 1px solid #e7ebf0;
          }

          .invoice-meta-group:last-child {
            border-bottom: 0;
          }

          .invoice-party-right {
            align-items: flex-start;
            text-align: left;
          }

          .invoice-items-section,
          .invoice-parties,
          .invoice-header,
          .invoice-summary-row {
            padding-left: 18px;
            padding-right: 18px;
          }

          .attached-invoice-section {
            margin-left: 18px;
            margin-right: 18px;
          }

          .attached-invoice-header {
            align-items: flex-start;
            flex-direction: column;
          }





        }

        @media print {
          .order-header-actions,
          .order-alert {
            display: none !important;
          }

          .order-page {
            padding: 0;
          }

          .invoice-document {
            border: 0;
            box-shadow: none;
          }
        }
      `}</style>
    </AppShell>
  );
}