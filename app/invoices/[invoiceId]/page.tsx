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

type Invoice = {
  id: string;
  company_id: string;
  customer_id: string | null;
  job_id: string | null;
  order_id: string | null;
  invoice_number: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceItem = {
  id: string;
  company_id: string;
  invoice_id: string;
  product_id: string | null;
  variant_id: string | null;
  description: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
  updated_at: string;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Job = {
  id: string;
  title: string;
  customer_id: string | null;
  status: string;
};

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

type Product = {
  id: string;
  name: string;
};

type Variant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
};

type InvoicePayment = {
  id: string;
  company_id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  reference: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

const PAYMENT_METHODS = [
  {
    value: "cash",
    label: "Cash",
  },
  {
    value: "bank_transfer",
    label: "Bank Transfer",
  },
  {
    value: "card",
    label: "Card",
  },
  {
    value: "cheque",
    label: "Cheque",
  },
  {
    value: "online",
    label: "Online",
  },
  {
    value: "other",
    label: "Other",
  },
];

export default function InvoiceDetailsPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const invoiceId =
    typeof params.invoiceId === "string"
      ? params.invoiceId
      : "";

  const [invoice, setInvoice] =
    useState<Invoice | null>(null);

  const [invoiceItems, setInvoiceItems] =
    useState<InvoiceItem[]>([]);

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [job, setJob] =
    useState<Job | null>(null);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [variants, setVariants] =
    useState<Variant[]>([]);

  const [payments, setPayments] =
    useState<InvoicePayment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [paymentLoading, setPaymentLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [paymentError, setPaymentError] =
    useState("");

  const [showPaymentModal, setShowPaymentModal] =
    useState(false);

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("cash");

  const [paymentReference, setPaymentReference] =
    useState("");

  const [paymentNotes, setPaymentNotes] =
    useState("");

  const [paymentDate, setPaymentDate] =
    useState(() => {
      const now = new Date();

      return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");
    });

  const loadInvoice = useCallback(async () => {
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
        router.replace(
          `/login?redirectTo=/invoices/${invoiceId}`
        );
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

      const {
        data: invoiceData,
        error: invoiceError,
      } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("company_id", companyId)
        .single();

      if (invoiceError) {
        throw invoiceError;
      }

      const [
        companyResult,
        itemsResult,
        customerResult,
        jobResult,
        productsResult,
        variantsResult,
        paymentsResult,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, currency")
          .eq("id", companyId)
          .single(),

        supabase
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", invoiceId)
          .eq("company_id", companyId)
          .order("created_at", {
            ascending: true,
          }),

        invoiceData.customer_id
          ? supabase
              .from("customers")
              .select(
                "id, name, email, phone"
              )
              .eq(
                "id",
                invoiceData.customer_id
              )
              .eq(
                "company_id",
                companyId
              )
              .maybeSingle()
          : Promise.resolve({
              data: null,
              error: null,
            }),

        invoiceData.job_id
          ? supabase
              .from("jobs")
              .select(
                "id, title, customer_id, status"
              )
              .eq(
                "id",
                invoiceData.job_id
              )
              .eq(
                "company_id",
                companyId
              )
              .maybeSingle()
          : Promise.resolve({
              data: null,
              error: null,
            }),

        supabase
          .from("products")
          .select("id, name")
          .eq("company_id", companyId),

        supabase
          .from("product_variants")
          .select(
            "id, product_id, name, sku"
          )
          .eq(
            "company_id",
            companyId
          ),

        supabase
          .from("invoice_payments")
          .select("*")
          .eq("invoice_id", invoiceId)
          .eq("company_id", companyId)
          .order("paid_at", {
            ascending: false,
            nullsFirst: false,
          })
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (companyResult.error) {
        throw companyResult.error;
      }

      if (itemsResult.error) {
        throw itemsResult.error;
      }

      if (customerResult.error) {
        throw customerResult.error;
      }

      if (jobResult.error) {
        throw jobResult.error;
      }

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (variantsResult.error) {
        throw variantsResult.error;
      }

      if (paymentsResult.error) {
        throw paymentsResult.error;
      }

      setInvoice({
        ...invoiceData,
        subtotal: Number(
          invoiceData.subtotal || 0
        ),
        tax: Number(
          invoiceData.tax || 0
        ),
        total: Number(
          invoiceData.total || 0
        ),
        amount_paid: Number(
          invoiceData.amount_paid || 0
        ),
      });

      setInvoiceItems(
        (itemsResult.data || []).map(
          (item) => ({
            ...item,
            quantity: Number(
              item.quantity || 0
            ),
            unit_price: Number(
              item.unit_price || 0
            ),
            discount_amount: Number(
              item.discount_amount || 0
            ),
            tax_amount: Number(
              item.tax_amount || 0
            ),
            line_total: Number(
              item.line_total || 0
            ),
          })
        )
      );

      setPayments(
        (paymentsResult.data || []).map(
          (payment) => ({
            ...payment,
            amount: Number(
              payment.amount || 0
            ),
          })
        )
      );

      setCompany(
        companyResult.data
      );

      setCustomer(
        customerResult.data
      );

      setJob(
        jobResult.data
      );

      setProducts(
        productsResult.data || []
      );

      setVariants(
        variantsResult.data || []
      );
    } catch (err: unknown) {
      console.error(
        "Invoice details load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not load invoice."
      );
    } finally {
      setLoading(false);
    }
  }, [invoiceId, router, supabase]);

  useEffect(() => {
    if (!invoiceId) return;

    // This effect intentionally starts the asynchronous Supabase
    // synchronization for the invoice identified by the route.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInvoice();
  }, [invoiceId, loadInvoice]);

  const currency =
    company?.currency || "USD";

  function formatCurrency(
    value: number
  ) {
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
      return `$${value.toFixed(2)}`;
    }
  }

  function formatDate(
    date: string | null
  ) {
    if (!date) return "—";

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

  function formatDateTime(
    date: string
  ) {
    const parsed = new Date(date);

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

  function formatPaymentDate(
    date: string | null
  ) {
    if (!date) return "—";

    const parsed = new Date(
      date.includes("T")
        ? date
        : `${date}T00:00:00`
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
    const labels: Record<
      string,
      string
    > = {
      partially_paid:
        "Partially Paid",
      partially_refunded:
        "Partially Refunded",
      bank_transfer:
        "Bank Transfer",
      void: "Void",
      voided: "Voided",
      completed: "Completed",
      pending: "Pending",
      refunded: "Refunded",
    };

    if (labels[status]) {
      return labels[status];
    }

    return (
      status.charAt(0).toUpperCase() +
      status.slice(1)
    );
  }

  function getPaymentMethodLabel(
    method: string
  ) {
    return (
      PAYMENT_METHODS.find(
        (item) =>
          item.value === method
      )?.label ||
      formatStatus(method)
    );
  }

  function getPaymentStatusClass(
    status: string
  ) {
    switch (status) {
      case "completed":
        return "payment-completed";

      case "pending":
        return "payment-pending";

      case "voided":
        return "payment-voided";

      case "refunded":
        return "payment-refunded";

      case "partially_refunded":
        return "payment-partial-refunded";

      default:
        return "payment-pending";
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

      case "paid":
        return "status-paid";

      case "partially_paid":
        return "status-partial";

      case "overdue":
        return "status-overdue";

      case "void":
        return "status-void";

      default:
        return "status-draft";
    }
  }

  function getProductName(
    productId: string | null
  ) {
    if (!productId) return "";

    return (
      products.find(
        (product) =>
          product.id === productId
      )?.name || ""
    );
  }

  function getVariantName(
    variantId: string | null
  ) {
    if (!variantId) return "";

    return (
      variants.find(
        (variant) =>
          variant.id === variantId
      )?.name || ""
    );
  }

  const calculatedTotals =
    useMemo(() => {
      let subtotal = 0;
      let discount = 0;
      let tax = 0;
      let total = 0;

      for (const item of invoiceItems) {
        subtotal +=
          Number(item.quantity || 0) *
          Number(item.unit_price || 0);

        discount += Number(
          item.discount_amount || 0
        );

        tax += Number(
          item.tax_amount || 0
        );

        total += Number(
          item.line_total || 0
        );
      }

      const paid = Math.max(
        Number(
          invoice?.amount_paid || 0
        ),
        0
      );

      const invoiceTotal =
        Number(invoice?.total || 0);

      const balance = Math.max(
        invoiceTotal - paid,
        0
      );

      return {
        subtotal,
        discount,
        tax,
        total,
        paid,
        balance,
      };
    }, [
      invoice,
      invoiceItems,
    ]);

  const completedPaymentsTotal =
    useMemo(() => {
      return payments
        .filter(
          (payment) =>
            payment.status ===
            "completed"
        )
        .reduce(
          (sum, payment) =>
            sum +
            Number(
              payment.amount || 0
            ),
          0
        );
    }, [payments]);

  function openPaymentModal() {
    if (!invoice) return;

    const balance =
      Math.max(
        Number(invoice.total || 0) -
          Number(
            invoice.amount_paid || 0
          ),
        0
      );

    if (balance <= 0.000001) {
      return;
    }

    setPaymentError("");

    setPaymentAmount(
      balance.toFixed(2)
    );

    setPaymentMethod("cash");
    setPaymentReference("");
    setPaymentNotes("");

    const now = new Date();

    const year =
      now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      now.getDate()
    ).padStart(2, "0");

    setPaymentDate(
      `${year}-${month}-${day}`
    );

    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    if (paymentLoading) return;

    setShowPaymentModal(false);
    setPaymentError("");
  }

  async function handleRecordPayment(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!invoice) return;

    setPaymentError("");

    const amount =
      Number(paymentAmount);

    const currentBalance =
      Math.max(
        Number(invoice.total || 0) -
          Number(
            invoice.amount_paid || 0
          ),
        0
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setPaymentError(
        "Enter a valid payment amount."
      );
      return;
    }

    if (
      amount >
      currentBalance + 0.000001
    ) {
      setPaymentError(
        `Payment cannot exceed the remaining balance of ${formatCurrency(
          currentBalance
        )}.`
      );
      return;
    }

    if (!paymentDate) {
      setPaymentError(
        "Select the payment date."
      );
      return;
    }

    if (!paymentMethod) {
      setPaymentError(
        "Select a payment method."
      );
      return;
    }

    setPaymentLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error(
          "Your session has expired. Please sign in again."
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
        throw membershipError;
      }

      if (!membership?.company_id) {
        throw new Error(
          "No company membership found."
        );
      }

      const companyId =
        membership.company_id;

      if (
        companyId !==
        invoice.company_id
      ) {
        throw new Error(
          "You do not have access to this invoice."
        );
      }

      const paidAt = new Date(
        `${paymentDate}T12:00:00`
      ).toISOString();

      const {
        error: insertError,
      } = await supabase
        .from("invoice_payments")
        .insert({
          company_id: companyId,
          invoice_id: invoice.id,
          amount,
          currency,
          payment_method:
            paymentMethod,
          status: "completed",
          reference:
            paymentReference.trim() ||
            null,
          notes:
            paymentNotes.trim() ||
            null,
          paid_at: paidAt,
        });

      if (insertError) {
        throw insertError;
      }

      setShowPaymentModal(false);

      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
      setPaymentError("");

      /*
       * Database trigger is responsible for
       * recalculating:
       *
       * invoices.amount_paid
       * invoices.status
       * linked orders.payment_status
       *
       * We reload after insertion so the UI
       * uses the database as the source of truth.
       */

      await loadInvoice();
    } catch (err: unknown) {
      console.error(
        "Record payment error:",
        err
      );

      setPaymentError(
        err instanceof Error
          ? err.message
          : "Could not record the payment."
      );
    } finally {
      setPaymentLoading(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Invoice"
        description="View invoice details."
      >
        <div className="loading-page">
          <div className="loading-spinner" />

          <p>
            Loading invoice...
          </p>
        </div>
      </AppShell>
    );
  }

  if (error || !invoice) {
    return (
      <AppShell
        title="Invoice"
        description="View invoice details."
      >
        <div className="error-page">
          <div className="error-icon">
            !
          </div>

          <h2>
            Unable to load invoice
          </h2>

          <p>
            {error ||
              "The invoice could not be found."}
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push(
                "/invoices"
              )
            }
          >
            ← Back to Invoices
          </button>
        </div>
      </AppShell>
    );
  }

  const canRecordPayment =
    invoice.status !== "void" &&
    calculatedTotals.balance >
      0.000001;

  return (
    <AppShell
      title={`Invoice ${invoice.invoice_number}`}
      description="View, review and manage this invoice."
      actions={
        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push(
                "/invoices"
              )
            }
          >
            ← Back to Invoices
          </button>

          {canRecordPayment && (
            <button
              type="button"
              className="payment-button"
              onClick={
                openPaymentModal
              }
            >
              + Record Payment
            </button>
          )}

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              window.print()
            }
          >
            🖨 Print Invoice
          </button>
        </div>
      }
    >
      <div className="invoice-screen">
        <div className="invoice-document">
          <header className="invoice-header">
            <div className="company-block">
              <h1>
                {company?.name ||
                  "Company"}
              </h1>

              <p>
                Professional Invoice
              </p>
            </div>

            <div className="invoice-title-block">
              <div className="invoice-label">
                INVOICE
              </div>

              <div className="invoice-number">
                {invoice.invoice_number}
              </div>

              <span
                className={`status-badge ${getStatusClass(
                  invoice.status
                )}`}
              >
                {formatStatus(
                  invoice.status
                )}
              </span>
            </div>
          </header>

          <div className="header-divider" />

          <section className="invoice-meta">
            <div className="meta-column">
              <div className="meta-label">
                Invoice Date
              </div>

              <div className="meta-value">
                {formatDateTime(
                  invoice.created_at
                )}
              </div>
            </div>

            <div className="meta-column">
              <div className="meta-label">
                Due Date
              </div>

              <div className="meta-value">
                {formatDate(
                  invoice.due_date
                )}
              </div>
            </div>

            <div className="meta-column">
              <div className="meta-label">
                Payment Status
              </div>

              <div className="meta-value">
                {formatStatus(
                  invoice.status
                )}
              </div>
            </div>

            {job && (
              <div className="meta-column">
                <div className="meta-label">
                  Related Job
                </div>

                <div className="meta-value">
                  {job.title}
                </div>
              </div>
            )}
          </section>

          <section className="parties-section">
            <div className="party-card">
              <div className="party-label">
                BILL TO
              </div>

              {customer ? (
                <>
                  <div className="party-name">
                    {customer.name}
                  </div>

                  {customer.email && (
                    <div className="party-detail">
                      {customer.email}
                    </div>
                  )}

                  {customer.phone && (
                    <div className="party-detail">
                      {customer.phone}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="party-name">
                    Walk-in Customer
                  </div>

                  <div className="party-detail">
                    No customer assigned
                  </div>
                </>
              )}
            </div>

            <div className="party-card">
              <div className="party-label">
                FROM
              </div>

              <div className="party-name">
                {company?.name ||
                  "Company"}
              </div>

              <div className="party-detail">
                Invoice #
                {invoice.invoice_number}
              </div>

              {job && (
                <div className="party-detail">
                  Job: {job.title}
                </div>
              )}
            </div>
          </section>

          <section className="items-section">
            <div className="section-heading">
              <div>
                <h2>
                  Invoice Items
                </h2>

                <p>
                  Detailed breakdown of
                  products and services.
                </p>
              </div>
            </div>

            {invoiceItems.length ===
            0 ? (
              <div className="no-items">
                No invoice items were
                recorded.
              </div>
            ) : (
              <div className="invoice-table-wrapper">
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th className="description-column">
                        Description
                      </th>

                      <th>
                        SKU
                      </th>

                      <th className="number-column">
                        Qty
                      </th>

                      <th className="money-column">
                        Unit Price
                      </th>

                      <th className="money-column">
                        Discount
                      </th>

                      <th className="money-column">
                        Tax
                      </th>

                      <th className="money-column">
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {invoiceItems.map(
                      (item) => {
                        const productName =
                          getProductName(
                            item.product_id
                          );

                        const variantName =
                          getVariantName(
                            item.variant_id
                          );

                        return (
                          <tr
                            key={item.id}
                          >
                            <td>
                              <div className="item-description">
                                <strong>
                                  {
                                    item.description
                                  }
                                </strong>

                                {productName &&
                                  variantName &&
                                  variantName.toLowerCase() !==
                                    "default" && (
                                    <small>
                                      {
                                        productName
                                      }{" "}
                                      •{" "}
                                      {
                                        variantName
                                      }
                                    </small>
                                  )}
                              </div>
                            </td>

                            <td>
                              <span className="sku">
                                {item.sku ||
                                  "—"}
                              </span>
                            </td>

                            <td className="number-cell">
                              {Number(
                                item.quantity
                              ).toLocaleString(
                                "en-US",
                                {
                                  maximumFractionDigits: 3,
                                }
                              )}
                            </td>

                            <td className="money-cell">
                              {formatCurrency(
                                Number(
                                  item.unit_price
                                )
                              )}
                            </td>

                            <td className="money-cell">
                              {Number(
                                item.discount_amount ||
                                  0
                              ) > 0
                                ? `-${formatCurrency(
                                    Number(
                                      item.discount_amount
                                    )
                                  )}`
                                : "—"}
                            </td>

                            <td className="money-cell">
                              {Number(
                                item.tax_amount ||
                                  0
                              ) > 0
                                ? formatCurrency(
                                    Number(
                                      item.tax_amount
                                    )
                                  )
                                : "—"}
                            </td>

                            <td className="money-cell total-cell">
                              {formatCurrency(
                                Number(
                                  item.line_total
                                )
                              )}
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

          <section className="payments-section">
            <div className="section-heading payment-heading">
              <div>
                <h2>
                  Payment History
                </h2>

                <p>
                  All recorded customer
                  payments for this invoice.
                </p>
              </div>

              {canRecordPayment && (
                <button
                  type="button"
                  className="small-payment-button"
                  onClick={
                    openPaymentModal
                  }
                >
                  + Record Payment
                </button>
              )}
            </div>

            {payments.length === 0 ? (
              <div className="no-payments">
                <div className="no-payments-icon">
                  $
                </div>

                <div>
                  <strong>
                    No payments recorded
                  </strong>

                  <span>
                    Payments made against
                    this invoice will appear
                    here.
                  </span>
                </div>
              </div>
            ) : (
              <div className="payment-table-wrapper">
                <table className="payment-table">
                  <thead>
                    <tr>
                      <th>
                        Date
                      </th>

                      <th>
                        Method
                      </th>

                      <th>
                        Reference
                      </th>

                      <th>
                        Status
                      </th>

                      <th className="payment-amount-column">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map(
                      (payment) => (
                        <tr
                          key={payment.id}
                        >
                          <td>
                            <strong className="payment-date">
                              {formatPaymentDate(
                                payment.paid_at ||
                                  payment.created_at
                              )}
                            </strong>
                          </td>

                          <td>
                            <span className="payment-method">
                              {getPaymentMethodLabel(
                                payment.payment_method
                              )}
                            </span>
                          </td>

                          <td>
                            <span className="payment-reference">
                              {payment.reference ||
                                "—"}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`payment-status-badge ${getPaymentStatusClass(
                                payment.status
                              )}`}
                            >
                              {formatStatus(
                                payment.status
                              )}
                            </span>
                          </td>

                          <td className="payment-amount-cell">
                            {formatCurrency(
                              Number(
                                payment.amount
                              )
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {payments.length > 0 && (
              <div className="payment-history-footer">
                <span>
                  Completed payments
                </span>

                <strong>
                  {formatCurrency(
                    completedPaymentsTotal
                  )}
                </strong>
              </div>
            )}
          </section>

          <section className="bottom-section">
            <div className="notes-block">
              <div className="notes-heading">
                NOTES
              </div>

              {invoice.notes ? (
                <p className="notes-text">
                  {invoice.notes}
                </p>
              ) : (
                <p className="notes-muted">
                  No additional notes were
                  provided.
                </p>
              )}

              {invoice.due_date &&
                calculatedTotals.balance >
                  0 && (
                  <div className="payment-note">
                    <strong>
                      Payment due by{" "}
                      {formatDate(
                        invoice.due_date
                      )}
                      .
                    </strong>

                    <span>
                      Please reference invoice{" "}
                      {
                        invoice.invoice_number
                      }{" "}
                      when making payment.
                    </span>
                  </div>
                )}
            </div>

            <div className="totals-block">
              <div className="total-row">
                <span>
                  Subtotal
                </span>

                <strong>
                  {formatCurrency(
                    calculatedTotals.subtotal ||
                      Number(
                        invoice.subtotal ||
                          0
                      )
                  )}
                </strong>
              </div>

              {calculatedTotals.discount >
                0 && (
                <div className="total-row">
                  <span>
                    Discount
                  </span>

                  <strong>
                    -
                    {formatCurrency(
                      calculatedTotals.discount
                    )}
                  </strong>
                </div>
              )}

              <div className="total-row">
                <span>
                  Tax
                </span>

                <strong>
                  {formatCurrency(
                    calculatedTotals.tax ||
                      Number(
                        invoice.tax ||
                          0
                      )
                  )}
                </strong>
              </div>

              <div className="grand-total-row">
                <span>
                  Total
                </span>

                <strong>
                  {formatCurrency(
                    Number(
                      invoice.total ||
                        calculatedTotals.total
                    )
                  )}
                </strong>
              </div>

              <div className="total-row paid-row">
                <span>
                  Amount Paid
                </span>

                <strong className="paid-amount">
                  {formatCurrency(
                    calculatedTotals.paid
                  )}
                </strong>
              </div>

              <div className="balance-row">
                <span>
                  Balance Due
                </span>

                <strong
                  className={
                    calculatedTotals.balance <=
                    0.000001
                      ? "balance-paid"
                      : ""
                  }
                >
                  {calculatedTotals.balance <=
                  0.000001
                    ? "PAID"
                    : formatCurrency(
                        calculatedTotals.balance
                      )}
                </strong>
              </div>
            </div>
          </section>

          <footer className="invoice-footer">
            <div>
              <strong>
                {company?.name ||
                  "Company"}
              </strong>

              <span>
                Thank you for your
                business.
              </span>
            </div>

            <div className="footer-right">
              <span>
                Invoice #
                {
                  invoice.invoice_number
                }
              </span>

              <span>
                Generated{" "}
                {formatDateTime(
                  invoice.created_at
                )}
              </span>
            </div>
          </footer>
        </div>
      </div>

      {showPaymentModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closePaymentModal();
            }
          }}
        >
          <div
            className="payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-payment-title"
          >
            <div className="modal-header">
              <div>
                <div className="modal-eyebrow">
                  INVOICE PAYMENT
                </div>

                <h2 id="record-payment-title">
                  Record Payment
                </h2>

                <p>
                  {invoice.invoice_number}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closePaymentModal
                }
                disabled={
                  paymentLoading
                }
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="payment-summary">
              <div>
                <span>
                  Invoice Total
                </span>

                <strong>
                  {formatCurrency(
                    Number(
                      invoice.total
                    )
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Already Paid
                </span>

                <strong>
                  {formatCurrency(
                    Number(
                      invoice.amount_paid
                    )
                  )}
                </strong>
              </div>

              <div className="summary-balance">
                <span>
                  Remaining Balance
                </span>

                <strong>
                  {formatCurrency(
                    calculatedTotals.balance
                  )}
                </strong>
              </div>
            </div>

            <form
              onSubmit={
                handleRecordPayment
              }
            >
              {paymentError && (
                <div className="payment-form-error">
                  <span>!</span>

                  <div>
                    {paymentError}
                  </div>
                </div>
              )}

              <div className="form-grid">
                <div className="form-field amount-field">
                  <label htmlFor="payment-amount">
                    Amount
                  </label>

                  <div className="amount-input-wrapper">
                    <span>
                      {currency}
                    </span>

                    <input
                      id="payment-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={calculatedTotals.balance.toFixed(
                        2
                      )}
                      value={
                        paymentAmount
                      }
                      onChange={(event) =>
                        setPaymentAmount(
                          event.target.value
                        )
                      }
                      placeholder="0.00"
                      disabled={
                        paymentLoading
                      }
                      autoFocus
                    />
                  </div>

                  <small>
                    Maximum:{" "}
                    {formatCurrency(
                      calculatedTotals.balance
                    )}
                  </small>
                </div>

                <div className="form-field">
                  <label htmlFor="payment-method">
                    Payment Method
                  </label>

                  <select
                    id="payment-method"
                    value={
                      paymentMethod
                    }
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value
                      )
                    }
                    disabled={
                      paymentLoading
                    }
                  >
                    {PAYMENT_METHODS.map(
                      (method) => (
                        <option
                          key={
                            method.value
                          }
                          value={
                            method.value
                          }
                        >
                          {method.label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="payment-date">
                    Payment Date
                  </label>

                  <input
                    id="payment-date"
                    type="date"
                    value={
                      paymentDate
                    }
                    onChange={(event) =>
                      setPaymentDate(
                        event.target.value
                      )
                    }
                    disabled={
                      paymentLoading
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="payment-reference">
                    Reference
                    <span>
                      Optional
                    </span>
                  </label>

                  <input
                    id="payment-reference"
                    type="text"
                    value={
                      paymentReference
                    }
                    onChange={(event) =>
                      setPaymentReference(
                        event.target.value
                      )
                    }
                    placeholder="Transaction ID, cheque no., etc."
                    maxLength={150}
                    disabled={
                      paymentLoading
                    }
                  />
                </div>

                <div className="form-field full-field">
                  <label htmlFor="payment-notes">
                    Notes
                    <span>
                      Optional
                    </span>
                  </label>

                  <textarea
                    id="payment-notes"
                    value={
                      paymentNotes
                    }
                    onChange={(event) =>
                      setPaymentNotes(
                        event.target.value
                      )
                    }
                    placeholder="Add any internal payment notes..."
                    rows={3}
                    maxLength={1000}
                    disabled={
                      paymentLoading
                    }
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-cancel-button"
                  onClick={
                    closePaymentModal
                  }
                  disabled={
                    paymentLoading
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="modal-submit-button"
                  disabled={
                    paymentLoading
                  }
                >
                  {paymentLoading ? (
                    <>
                      <span className="button-spinner" />
                      Recording...
                    </>
                  ) : (
                    <>
                      ✓ Record Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .invoice-screen {
          min-height: calc(100vh - 150px);
          padding: 30px;
          background: #f1f5f9;
        }

        .invoice-document {
          width: 100%;
          max-width: 1050px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 55px 60px;
          box-sizing: border-box;
          box-shadow: 0 10px 35px
            rgba(15, 23, 42, 0.08);
        }

        .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 40px;
        }

        .company-block h1 {
          margin: 0;
          color: #0f172a;
          font-size: 27px;
          font-weight: 800;
          letter-spacing: -0.7px;
        }

        .company-block p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .invoice-title-block {
          text-align: right;
        }

        .invoice-label {
          color: #0f172a;
          font-size: 31px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .invoice-number {
          margin-top: 4px;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 11px;
          padding: 6px 11px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
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

        .header-divider {
          height: 1px;
          margin: 28px 0 24px;
          background: #e2e8f0;
        }

        .invoice-meta {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 25px;
          padding-bottom: 28px;
        }

        .meta-label {
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .meta-value {
          margin-top: 6px;
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .parties-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 34px;
        }

        .party-card {
          padding: 18px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
        }

        .party-label {
          margin-bottom: 9px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.7px;
        }

        .party-name {
          color: #0f172a;
          font-size: 14px;
          font-weight: 800;
        }

        .party-detail {
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
        }

        .items-section {
          margin-top: 5px;
        }

        .section-heading {
          margin-bottom: 14px;
        }

        .section-heading h2 {
          margin: 0;
          color: #0f172a;
          font-size: 16px;
          font-weight: 800;
        }

        .section-heading p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 11px;
        }

        .invoice-table-wrapper {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
        }

        .invoice-table {
          width: 100%;
          min-width: 780px;
          border-collapse: collapse;
        }

        .invoice-table th {
          padding: 11px 12px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.45px;
          white-space: nowrap;
        }

        .invoice-table td {
          padding: 14px 12px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          font-size: 11px;
          vertical-align: middle;
        }

        .invoice-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .description-column {
          width: 31%;
        }

        .number-column {
          width: 8%;
          text-align: right !important;
        }

        .money-column {
          text-align: right !important;
        }

        .number-cell,
        .money-cell {
          text-align: right;
          white-space: nowrap;
        }

        .item-description strong {
          display: block;
          color: #0f172a;
          font-size: 12px;
          font-weight: 750;
        }

        .item-description small {
          display: block;
          margin-top: 4px;
          color: #94a3b8;
          font-size: 10px;
        }

        .sku {
          color: #64748b;
          font-family: monospace;
          font-size: 10px;
        }

        .total-cell {
          color: #0f172a !important;
          font-weight: 800;
        }

        .no-items {
          padding: 30px;
          border: 1px dashed #cbd5e1;
          border-radius: 9px;
          color: #94a3b8;
          font-size: 12px;
          text-align: center;
        }

        .payments-section {
          margin-top: 32px;
          padding-top: 28px;
          border-top: 1px solid #e2e8f0;
        }

        .payment-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .small-payment-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 36px;
          padding: 0 13px;
          border: 1px solid #dbe1e8;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
          white-space: nowrap;
        }

        .small-payment-button:hover {
          background: #f8fafc;
        }

        .no-payments {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 22px;
          border: 1px dashed #cbd5e1;
          border-radius: 9px;
          background: #f8fafc;
        }

        .no-payments-icon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 38px;
          border-radius: 50%;
          background: #e2e8f0;
          color: #475569;
          font-size: 17px;
          font-weight: 800;
        }

        .no-payments strong,
        .no-payments span {
          display: block;
        }

        .no-payments strong {
          color: #334155;
          font-size: 12px;
        }

        .no-payments span {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 11px;
        }

        .payment-table-wrapper {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
        }

        .payment-table {
          width: 100%;
          min-width: 650px;
          border-collapse: collapse;
        }

        .payment-table th {
          padding: 11px 13px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.45px;
          white-space: nowrap;
        }

        .payment-table td {
          padding: 13px;
          border-bottom: 1px solid #eef2f7;
          color: #475569;
          font-size: 11px;
          vertical-align: middle;
        }

        .payment-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .payment-date {
          color: #334155;
          font-size: 11px;
        }

        .payment-method {
          color: #334155;
          font-weight: 700;
        }

        .payment-reference {
          color: #64748b;
          font-family: monospace;
          font-size: 10px;
        }

        .payment-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 800;
        }

        .payment-completed {
          background: #ecfdf5;
          color: #059669;
        }

        .payment-pending {
          background: #fffbeb;
          color: #d97706;
        }

        .payment-voided {
          background: #f1f5f9;
          color: #64748b;
        }

        .payment-refunded {
          background: #fef2f2;
          color: #dc2626;
        }

        .payment-partial-refunded {
          background: #fff7ed;
          color: #c2410c;
        }

        .payment-amount-column {
          text-align: right !important;
        }

        .payment-amount-cell {
          text-align: right;
          color: #0f172a !important;
          font-size: 12px !important;
          font-weight: 800;
          white-space: nowrap;
        }

        .payment-history-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 18px;
          margin-top: 10px;
          color: #64748b;
          font-size: 11px;
        }

        .payment-history-footer strong {
          color: #0f172a;
          font-size: 12px;
        }

        .bottom-section {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 310px;
          gap: 60px;
          margin-top: 30px;
          padding-top: 28px;
          border-top: 1px solid #e2e8f0;
        }

        .notes-heading {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.7px;
        }

        .notes-text {
          margin: 9px 0 0;
          max-width: 460px;
          color: #475569;
          font-size: 11px;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .notes-muted {
          margin: 9px 0 0;
          color: #94a3b8;
          font-size: 11px;
        }

        .payment-note {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-top: 18px;
          padding: 12px;
          border-radius: 8px;
          background: #f8fafc;
          color: #475569;
          font-size: 10px;
          line-height: 1.5;
        }

        .payment-note strong {
          color: #334155;
        }

        .totals-block {
          width: 100%;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 7px 0;
          color: #64748b;
          font-size: 11px;
        }

        .total-row strong {
          color: #334155;
        }

        .grand-total-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-top: 7px;
          padding: 13px 0;
          border-top: 1px solid #cbd5e1;
          border-bottom: 1px solid #e2e8f0;
          color: #0f172a;
          font-size: 15px;
          font-weight: 800;
        }

        .grand-total-row strong {
          color: #0f172a;
          font-size: 16px;
        }

        .paid-row {
          margin-top: 5px;
        }

        .paid-amount {
          color: #059669 !important;
        }

        .balance-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 8px;
          padding: 13px;
          border-radius: 8px;
          background: #f8fafc;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .balance-row strong {
          color: #dc2626;
          font-size: 14px;
        }

        .balance-row strong.balance-paid {
          color: #059669;
        }

        .invoice-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 30px;
          margin-top: 45px;
          padding-top: 18px;
          border-top: 1px solid #e2e8f0;
          color: #94a3b8;
          font-size: 9px;
        }

        .invoice-footer div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .invoice-footer strong {
          color: #475569;
          font-size: 10px;
        }

        .footer-right {
          align-items: flex-end;
          text-align: right;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .primary-button,
        .secondary-button,
        .payment-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          padding: 0 14px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .primary-button {
          border: 0;
          background: #0f172a;
          color: #ffffff;
        }

        .primary-button:hover {
          background: #1e293b;
        }

        .secondary-button {
          border: 1px solid #dbe1e8;
          background: #ffffff;
          color: #475569;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        .payment-button {
          border: 0;
          background: #059669;
          color: #ffffff;
        }

        .payment-button:hover {
          background: #047857;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(
            15,
            23,
            42,
            0.55
          );
          backdrop-filter: blur(3px);
        }

        .payment-modal {
          width: 100%;
          max-width: 560px;
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 25px 70px
            rgba(15, 23, 42, 0.2);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 24px 25px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-eyebrow {
          color: #059669;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }

        .modal-header h2 {
          margin: 5px 0 0;
          color: #0f172a;
          font-size: 20px;
          font-weight: 850;
        }

        .modal-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 11px;
        }

        .modal-close {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 8px;
          background: #f8fafc;
          color: #64748b;
          font-size: 23px;
          line-height: 1;
          cursor: pointer;
        }

        .modal-close:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .payment-summary {
          display: grid;
          grid-template-columns: repeat(
            3,
            1fr
          );
          gap: 1px;
          margin: 18px 25px 0;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: #e2e8f0;
        }

        .payment-summary > div {
          padding: 13px;
          background: #f8fafc;
        }

        .payment-summary span,
        .payment-summary strong {
          display: block;
        }

        .payment-summary span {
          color: #94a3b8;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .payment-summary strong {
          margin-top: 5px;
          color: #334155;
          font-size: 13px;
        }

        .payment-summary .summary-balance {
          background: #ecfdf5;
        }

        .payment-summary .summary-balance strong {
          color: #059669;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 17px;
          padding: 23px 25px;
        }

        .form-field {
          min-width: 0;
        }

        .full-field {
          grid-column: 1 / -1;
        }

        .form-field label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 7px;
          color: #334155;
          font-size: 11px;
          font-weight: 750;
        }

        .form-field label span {
          color: #94a3b8;
          font-size: 9px;
          font-weight: 500;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe1e8;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
          font-family: inherit;
          font-size: 12px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .form-field input,
        .form-field select {
          height: 40px;
          padding: 0 11px;
        }

        .form-field textarea {
          padding: 10px 11px;
          resize: vertical;
          line-height: 1.5;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px
            rgba(148, 163, 184, 0.12);
        }

        .form-field input:disabled,
        .form-field select:disabled,
        .form-field textarea:disabled {
          background: #f8fafc;
          cursor: not-allowed;
        }

        .amount-input-wrapper {
          position: relative;
        }

        .amount-input-wrapper > span {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          pointer-events: none;
        }

        .amount-input-wrapper input {
          padding-left: 48px;
          font-size: 15px;
          font-weight: 750;
        }

        .form-field small {
          display: block;
          margin-top: 5px;
          color: #94a3b8;
          font-size: 9px;
        }

        .payment-form-error {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin: 20px 25px 0;
          padding: 11px 12px;
          border: 1px solid #fecaca;
          border-radius: 8px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 11px;
          line-height: 1.45;
        }

        .payment-form-error > span {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 18px;
          border-radius: 50%;
          background: #fee2e2;
          font-size: 10px;
          font-weight: 900;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 17px 25px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .modal-cancel-button,
        .modal-submit-button {
          height: 40px;
          padding: 0 15px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .modal-cancel-button {
          border: 1px solid #dbe1e8;
          background: #ffffff;
          color: #475569;
        }

        .modal-submit-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 0;
          background: #059669;
          color: #ffffff;
        }

        .modal-submit-button:hover {
          background: #047857;
        }

        .modal-submit-button:disabled,
        .modal-cancel-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .button-spinner {
          width: 13px;
          height: 13px;
          border: 2px solid
            rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .loading-page,
        .error-page {
          min-height: 550px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }

        .loading-page {
          color: #94a3b8;
          font-size: 13px;
        }

        .loading-spinner {
          width: 30px;
          height: 30px;
          margin-bottom: 12px;
          border: 3px solid #e2e8f0;
          border-top-color: #334155;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .error-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 15px;
          border-radius: 50%;
          background: #fef2f2;
          color: #dc2626;
          font-size: 20px;
          font-weight: 800;
        }

        .error-page h2 {
          margin: 0;
          color: #0f172a;
          font-size: 18px;
        }

        .error-page p {
          max-width: 450px;
          margin: 8px 0 18px;
          color: #94a3b8;
          font-size: 13px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .invoice-screen {
            padding: 18px;
          }

          .invoice-document {
            padding: 35px 30px;
          }

          .invoice-meta {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .bottom-section {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .totals-block {
            max-width: 360px;
            margin-left: auto;
          }

          .payment-summary {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .invoice-screen {
            padding: 0;
          }

          .invoice-document {
            border: 0;
            border-radius: 0;
            box-shadow: none;
            padding: 25px 18px;
          }

          .invoice-header {
            flex-direction: column;
            gap: 20px;
          }

          .invoice-title-block {
            text-align: left;
          }

          .invoice-meta {
            grid-template-columns: 1fr 1fr;
            gap: 18px;
          }

          .parties-section {
            grid-template-columns: 1fr;
          }

          .invoice-footer {
            flex-direction: column;
            align-items: flex-start;
          }

          .footer-right {
            align-items: flex-start;
            text-align: left;
          }

          .header-actions {
            width: 100%;
            flex-wrap: wrap;
          }

          .header-actions button {
            flex: 1;
          }

          .payment-heading {
            flex-direction: column;
          }

          .small-payment-button {
            width: 100%;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .full-field {
            grid-column: auto;
          }

          .modal-overlay {
            padding: 10px;
            align-items: flex-end;
          }

          .payment-modal {
            max-height: calc(100vh - 20px);
            border-radius: 14px 14px 0 0;
          }

          .modal-footer {
            flex-direction: column-reverse;
          }

          .modal-footer button {
            width: 100%;
          }
        }

        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          :global(body) {
            background: #ffffff !important;
          }

          :global(body *) {
            visibility: hidden;
          }

          .invoice-screen,
          .invoice-screen * {
            visibility: visible;
          }

          .invoice-screen {
            position: absolute;
            inset: 0;
            width: 100%;
            min-height: 0;
            padding: 0;
            background: #ffffff;
          }

          .invoice-document {
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 0;
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }

          .header-actions,
          .small-payment-button,
          .modal-overlay {
            display: none !important;
          }

          .invoice-table-wrapper,
          .payment-table-wrapper {
            overflow: visible;
          }

          .invoice-table,
          .payment-table {
            min-width: 0;
          }

          .invoice-table th,
          .invoice-table td,
          .payment-table th,
          .payment-table td {
            padding: 8px;
          }

          .invoice-footer {
            margin-top: 30px;
          }
        }
      `}</style>
    </AppShell>
  );
}