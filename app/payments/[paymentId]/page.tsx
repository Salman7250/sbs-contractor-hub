"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  order_id: string | null;
  total: number;
  amount_paid: number;
  status: string;
  due_date: string | null;
  notes: string | null;
};

type Order = {
  id: string;
  order_number: string;
  customer_id: string | null;
  status: string;
  payment_status: string;
  total_amount: number;
  currency: string;
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

export default function PaymentDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const paymentId =
    typeof params.paymentId === "string"
      ? params.paymentId
      : "";

  const supabase = createClient();

  const [company, setCompany] =
    useState<Company | null>(null);

  const [payment, setPayment] =
    useState<InvoicePayment | null>(null);

  const [invoice, setInvoice] =
    useState<Invoice | null>(null);

  const [order, setOrder] =
    useState<Order | null>(null);

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!paymentId) {
      setError("Payment ID is missing.");
      setLoading(false);
      return;
    }

    loadPayment();
  }, [paymentId]);

  async function loadPayment() {
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

      const {
        data: companyData,
        error: companyError,
      } = await supabase
        .from("companies")
        .select(
          "id, name, currency"
        )
        .eq("id", companyId)
        .single();

      if (companyError) {
        throw companyError;
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
        .eq("id", paymentId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (paymentError) {
        throw paymentError;
      }

      if (!paymentData) {
        throw new Error(
          "Payment not found."
        );
      }

      setCompany(companyData);
      setPayment(paymentData);

      const [
        invoiceResult,
        customerResult,
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select(
            `
              id,
              invoice_number,
              customer_id,
              order_id,
              total,
              amount_paid,
              status,
              due_date,
              notes
            `
          )
          .eq(
            "id",
            paymentData.invoice_id
          )
          .eq(
            "company_id",
            companyId
          )
          .maybeSingle(),

        paymentData.customer_id
          ? supabase
              .from("customers")
              .select(
                `
                  id,
                  name,
                  email,
                  phone
                `
              )
              .eq(
                "id",
                paymentData.customer_id
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
      ]);

      if (invoiceResult.error) {
        throw invoiceResult.error;
      }

      if (customerResult.error) {
        throw customerResult.error;
      }

      setInvoice(
        invoiceResult.data
      );

      setCustomer(
        customerResult.data
      );

      if (
        invoiceResult.data?.order_id
      ) {
        const {
          data: orderData,
          error: orderError,
        } = await supabase
          .from("orders")
          .select(
            `
              id,
              order_number,
              customer_id,
              status,
              payment_status,
              total_amount,
              currency
            `
          )
          .eq(
            "id",
            invoiceResult.data
              .order_id
          )
          .eq(
            "company_id",
            companyId
          )
          .maybeSingle();

        if (orderError) {
          throw orderError;
        }

        setOrder(orderData);
      }
    } catch (err: any) {
      console.error(
        "Payment details error:",
        err
      );

      setError(
        err?.message ||
          "Could not load payment."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(
    value: number,
    currencyOverride?: string
  ) {
    const currency =
      currencyOverride ||
      company?.currency ||
      payment?.currency ||
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
    value: string | null
  ) {
    if (!value) {
      return "—";
    }

    return new Date(
      value
    ).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  }

  function formatDateTime(
    value: string | null
  ) {
    if (!value) {
      return "—";
    }

    return new Date(
      value
    ).toLocaleString(
      "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  function getStatusClass(
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

      case "confirmed":
      case "completed":
        return "status-paid";

      case "cancelled":
        return "status-overdue";

      default:
        return "status-default";
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Payment"
        description="Payment details"
      >
        <div className="loading-page">
          <div className="loading-spinner" />

          <p>
            Loading payment...
          </p>
        </div>

        <style jsx>{`
          .loading-page {
            min-height: 500px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #64748b;
            font-size: 13px;
          }

          .loading-spinner {
            width: 30px;
            height: 30px;
            margin-bottom: 12px;
            border: 3px solid #e2e8f0;
            border-top-color: #0f172a;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
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

  if (error || !payment) {
    return (
      <AppShell
        title="Payment"
        description="Payment details"
      >
        <main className="error-page">
          <div className="error-icon">
            !
          </div>

          <h2>
            Payment not found
          </h2>

          <p>
            {error ||
              "This payment could not be found."}
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              router.push(
                "/payments"
              )
            }
          >
            Back to Payments
          </button>
        </main>

        <style jsx>{`
          .error-page {
            min-height: 500px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
            background: #f8fafc;
            text-align: center;
          }

          .error-icon {
            width: 46px;
            height: 46px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            background: #fef2f2;
            color: #dc2626;
            font-size: 20px;
            font-weight: 800;
          }

          .error-page h2 {
            margin: 14px 0 5px;
            color: #0f172a;
            font-size: 17px;
          }

          .error-page p {
            max-width: 420px;
            margin: 0 0 18px;
            color: #94a3b8;
            font-size: 12px;
          }

          .primary-button {
            height: 40px;
            padding: 0 15px;
            border: 0;
            border-radius: 9px;
            background: #0f172a;
            color: #ffffff;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }
        `}</style>
      </AppShell>
    );
  }

  const invoiceBalance = invoice
    ? Math.max(
        Number(invoice.total) -
          Number(invoice.amount_paid),
        0
      )
    : 0;

  return (
    <AppShell
      title={`Payment #${payment.id.slice(
        0,
        8
      )}`}
      description="Customer payment details and related financial records."
      actions={
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            router.push(
              "/payments"
            )
          }
        >
          ← Back to Payments
        </button>
      }
    >
      <main className="payment-page">
        <div className="top-bar">
          <div>
            <button
              type="button"
              className="back-link"
              onClick={() =>
                router.push(
                  "/payments"
                )
              }
            >
              ← Payments
            </button>

            <h1>
              Payment Details
            </h1>

            <p>
              Recorded on{" "}
              {formatDateTime(
                payment.paid_at
              )}
            </p>
          </div>

          <div className="top-amount">
            <span>
              PAYMENT RECEIVED
            </span>

            <strong>
              +
              {formatCurrency(
                Number(
                  payment.amount
                ),
                payment.currency
              )}
            </strong>
          </div>
        </div>

        <section className="main-grid">
          <div className="left-column">
            <div className="card payment-summary-card">
              <div className="card-header">
                <div>
                  <h2>
                    Payment Information
                  </h2>

                  <p>
                    Details of this customer payment.
                  </p>
                </div>

                <span className="payment-record-badge">
                  RECORDED
                </span>
              </div>

              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">
                    PAYMENT ID
                  </span>

                  <strong className="mono">
                    {payment.id}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="info-label">
                    AMOUNT
                  </span>

                  <strong className="amount">
                    {formatCurrency(
                      Number(
                        payment.amount
                      ),
                      payment.currency
                    )}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="info-label">
                    PAYMENT METHOD
                  </span>

                  <strong>
                    {payment.payment_method ||
                      "Other"}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="info-label">
                    PAYMENT DATE
                  </span>

                  <strong>
                    {formatDate(
                      payment.paid_at
                    )}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="info-label">
                    REFERENCE
                  </span>

                  <strong>
                    {payment.reference ||
                      "—"}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="info-label">
                    CURRENCY
                  </span>

                  <strong>
                    {payment.currency}
                  </strong>
                </div>
              </div>

              {payment.notes && (
                <div className="notes-section">
                  <span className="info-label">
                    NOTES
                  </span>

                  <p>
                    {payment.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Invoice
                  </h2>

                  <p>
                    Invoice this payment was applied to.
                  </p>
                </div>
              </div>

              {invoice ? (
                <div className="invoice-card">
                  <div className="invoice-main">
                    <div className="invoice-icon">
                      #
                    </div>

                    <div>
                      <button
                        type="button"
                        className="invoice-number"
                        onClick={() =>
                          router.push(
                            `/invoices/${invoice.id}`
                          )
                        }
                      >
                        {
                          invoice.invoice_number
                        }
                      </button>

                      <span>
                        Invoice
                      </span>
                    </div>
                  </div>

                  <div className="invoice-stats">
                    <div>
                      <span>
                        TOTAL
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
                        PAID
                      </span>

                      <strong className="paid-value">
                        {formatCurrency(
                          Number(
                            invoice.amount_paid
                          )
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        BALANCE
                      </span>

                      <strong>
                        {formatCurrency(
                          invoiceBalance
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        STATUS
                      </span>

                      <span
                        className={`status-badge ${getStatusClass(
                          invoice.status
                        )}`}
                      >
                        {invoice.status.replace(
                          "_",
                          " "
                        )}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="view-button"
                    onClick={() =>
                      router.push(
                        `/invoices/${invoice.id}`
                      )
                    }
                  >
                    View Invoice →
                  </button>
                </div>
              ) : (
                <div className="not-found">
                  The linked invoice could not be found.
                </div>
              )}
            </div>

            {order && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Sales Order
                    </h2>

                    <p>
                      Sales order connected to this invoice.
                    </p>
                  </div>
                </div>

                <div className="order-card">
                  <div className="order-main">
                    <div className="order-icon">
                      SO
                    </div>

                    <div>
                      <button
                        type="button"
                        className="order-number"
                        onClick={() =>
                          router.push(
                            `/sales/${order.id}`
                          )
                        }
                      >
                        {
                          order.order_number
                        }
                      </button>

                      <span>
                        Sales Order
                      </span>
                    </div>
                  </div>

                  <div className="order-right">
                    <div>
                      <span>
                        TOTAL
                      </span>

                      <strong>
                        {formatCurrency(
                          Number(
                            order.total_amount
                          ),
                          order.currency
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        PAYMENT
                      </span>

                      <span
                        className={`status-badge ${getStatusClass(
                          order.payment_status
                        )}`}
                      >
                        {order.payment_status.replace(
                          "_",
                          " "
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="view-button"
                      onClick={() =>
                        router.push(
                          `/sales/${order.id}`
                        )
                      }
                    >
                      View Order →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="right-column">
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Customer
                  </h2>
                </div>
              </div>

              {customer ? (
                <div className="customer-panel">
                  <div className="customer-avatar">
                    {(
                      customer.name ||
                      "C"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="customer-name">
                    {customer.name ||
                      "Unnamed Customer"}
                  </div>

                  {customer.email && (
                    <div className="customer-detail">
                      <span>
                        Email
                      </span>

                      <strong>
                        {customer.email}
                      </strong>
                    </div>
                  )}

                  {customer.phone && (
                    <div className="customer-detail">
                      <span>
                        Phone
                      </span>

                      <strong>
                        {customer.phone}
                      </strong>
                    </div>
                  )}

                  <button
                    type="button"
                    className="customer-button"
                    onClick={() =>
                      router.push(
                        `/customers/${customer.id}`
                      )
                    }
                  >
                    View Customer →
                  </button>
                </div>
              ) : (
                <div className="not-found">
                  No customer linked to this payment.
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Payment Timeline
                  </h2>
                </div>
              </div>

              <div className="timeline">
                <div className="timeline-item">
                  <div className="timeline-dot">
                    ✓
                  </div>

                  <div>
                    <strong>
                      Payment recorded
                    </strong>

                    <span>
                      {formatDateTime(
                        payment.created_at
                      )}
                    </span>
                  </div>
                </div>

                <div className="timeline-line" />

                <div className="timeline-item">
                  <div className="timeline-dot">
                    $
                  </div>

                  <div>
                    <strong>
                      Payment date
                    </strong>

                    <span>
                      {formatDateTime(
                        payment.paid_at
                      )}
                    </span>
                  </div>
                </div>

                {invoice && (
                  <>
                    <div className="timeline-line" />

                    <div className="timeline-item">
                      <div className="timeline-dot">
                        #
                      </div>

                      <div>
                        <strong>
                          Applied to invoice
                        </strong>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/invoices/${invoice.id}`
                            )
                          }
                        >
                          {
                            invoice.invoice_number
                          }
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {order && (
                  <>
                    <div className="timeline-line" />

                    <div className="timeline-item">
                      <div className="timeline-dot">
                        SO
                      </div>

                      <div>
                        <strong>
                          Connected to order
                        </strong>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/sales/${order.id}`
                            )
                          }
                        >
                          {
                            order.order_number
                          }
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>
        </section>
      </main>

      <style jsx>{`
        .payment-page {
          min-height: calc(100vh - 120px);
          padding: 28px;
          background: #f8fafc;
        }

        .top-bar {
          max-width: 1250px;
          margin: 0 auto 22px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 25px;
        }

        .back-link {
          padding: 0;
          border: 0;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        }

        .back-link:hover {
          color: #0f172a;
        }

        .top-bar h1 {
          margin: 7px 0 3px;
          color: #0f172a;
          font-size: 23px;
          font-weight: 800;
          letter-spacing: -0.4px;
        }

        .top-bar p {
          margin: 0;
          color: #94a3b8;
          font-size: 11px;
        }

        .top-amount {
          padding: 14px 18px;
          border: 1px solid #d1fae5;
          border-radius: 11px;
          background: #ecfdf5;
          text-align: right;
        }

        .top-amount span {
          display: block;
          color: #059669;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.6px;
        }

        .top-amount strong {
          display: block;
          margin-top: 3px;
          color: #047857;
          font-size: 20px;
        }

        .main-grid {
          max-width: 1250px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 330px;
          gap: 20px;
          align-items: start;
        }

        .left-column,
        .right-column {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .right-column {
          position: sticky;
          top: 20px;
        }

        .card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          overflow: hidden;
        }

        .card-header {
          min-height: 65px;
          padding: 17px 19px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          border-bottom: 1px solid #eef2f7;
        }

        .card-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 14px;
          font-weight: 800;
        }

        .card-header p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 10px;
        }

        .payment-record-badge {
          padding: 5px 8px;
          border-radius: 6px;
          background: #ecfdf5;
          color: #047857;
          font-size: 9px;
          font-weight: 800;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
        }

        .info-item {
          min-height: 75px;
          padding: 15px 18px;
          border-right: 1px solid #eef2f7;
          border-bottom: 1px solid #eef2f7;
        }

        .info-item:nth-child(3n) {
          border-right: 0;
        }

        .info-item:nth-last-child(-n + 3) {
          border-bottom: 0;
        }

        .info-label {
          display: block;
          margin-bottom: 6px;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.55px;
        }

        .info-item strong {
          color: #334155;
          font-size: 12px;
        }

        .info-item .amount {
          color: #059669;
          font-size: 15px;
        }

        .mono {
          font-family: monospace;
          font-size: 10px !important;
          word-break: break-all;
        }

        .notes-section {
          padding: 16px 18px;
          border-top: 1px solid #eef2f7;
        }

        .notes-section p {
          margin: 0;
          color: #475569;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .invoice-card,
        .order-card {
          padding: 18px;
        }

        .invoice-card {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 18px;
        }

        .invoice-main,
        .order-main {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

        .invoice-icon,
        .order-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #f1f5f9;
          color: #475569;
          font-size: 14px;
          font-weight: 800;
        }

        .order-icon {
          font-size: 9px;
        }

        .invoice-main > div:last-child,
        .order-main > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .invoice-number,
        .order-number {
          width: fit-content;
          padding: 0;
          border: 0;
          background: transparent;
          color: #2563eb;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
        }

        .invoice-number:hover,
        .order-number:hover {
          text-decoration: underline;
        }

        .invoice-main span,
        .order-main span {
          color: #94a3b8;
          font-size: 10px;
        }

        .invoice-stats {
          display: flex;
          align-items: center;
          gap: 25px;
        }

        .invoice-stats > div,
        .order-right > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .invoice-stats span,
        .order-right span {
          color: #94a3b8;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .invoice-stats strong,
        .order-right strong {
          color: #334155;
          font-size: 11px;
        }

        .paid-value {
          color: #059669 !important;
        }

        .status-badge {
          display: inline-flex;
          width: fit-content;
          padding: 4px 7px;
          border-radius: 5px;
          font-size: 9px !important;
          font-weight: 800 !important;
          text-transform: capitalize !important;
        }

        .status-paid {
          background: #ecfdf5;
          color: #047857 !important;
        }

        .status-partial {
          background: #fffbeb;
          color: #b45309 !important;
        }

        .status-overdue {
          background: #fef2f2;
          color: #b91c1c !important;
        }

        .status-void {
          background: #f1f5f9;
          color: #64748b !important;
        }

        .status-default {
          background: #f1f5f9;
          color: #475569 !important;
        }

        .view-button,
        .customer-button {
          height: 34px;
          padding: 0 11px;
          border: 1px solid #dbe1e8;
          border-radius: 7px;
          background: #ffffff;
          color: #475569;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .view-button:hover,
        .customer-button:hover {
          background: #f8fafc;
          color: #0f172a;
        }

        .order-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .order-right {
          display: flex;
          align-items: center;
          gap: 22px;
        }

        .customer-panel {
          padding: 20px;
        }

        .customer-avatar {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          border-radius: 12px;
          background: #f1f5f9;
          color: #475569;
          font-size: 18px;
          font-weight: 800;
        }

        .customer-name {
          margin-bottom: 17px;
          color: #0f172a;
          font-size: 15px;
          font-weight: 800;
        }

        .customer-detail {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 9px 0;
          border-top: 1px solid #eef2f7;
        }

        .customer-detail span {
          color: #94a3b8;
          font-size: 9px;
          font-weight: 700;
        }

        .customer-detail strong {
          color: #475569;
          font-size: 11px;
          word-break: break-word;
        }

        .customer-button {
          width: 100%;
          margin-top: 10px;
        }

        .timeline {
          padding: 20px;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 11px;
        }

        .timeline-dot {
          width: 26px;
          height: 26px;
          flex: 0 0 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f1f5f9;
          color: #475569;
          font-size: 9px;
          font-weight: 800;
        }

        .timeline-item > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding-top: 2px;
        }

        .timeline-item strong {
          color: #334155;
          font-size: 10px;
        }

        .timeline-item span,
        .timeline-item button {
          color: #94a3b8;
          font-size: 9px;
        }

        .timeline-item button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #2563eb;
          text-align: left;
          cursor: pointer;
        }

        .timeline-item button:hover {
          text-decoration: underline;
        }

        .timeline-line {
          width: 1px;
          height: 20px;
          margin-left: 12px;
          background: #e2e8f0;
        }

        .not-found {
          padding: 25px 19px;
          color: #94a3b8;
          font-size: 11px;
        }

        .secondary-button {
          height: 38px;
          padding: 0 13px;
          border: 1px solid #dbe1e8;
          border-radius: 8px;
          background: #ffffff;
          color: #475569;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        @media (max-width: 1050px) {
          .main-grid {
            grid-template-columns: 1fr;
          }

          .right-column {
            position: static;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 800px) {
          .payment-page {
            padding: 18px;
          }

          .top-bar {
            align-items: flex-start;
            flex-direction: column;
          }

          .top-amount {
            width: 100%;
            box-sizing: border-box;
            text-align: left;
          }

          .info-grid {
            grid-template-columns: 1fr 1fr;
          }

          .info-item:nth-child(3n) {
            border-right: 1px solid #eef2f7;
          }

          .info-item:nth-child(2n) {
            border-right: 0;
          }

          .info-item:nth-last-child(-n + 3) {
            border-bottom: 1px solid #eef2f7;
          }

          .info-item:last-child,
          .info-item:nth-last-child(2) {
            border-bottom: 0;
          }

          .invoice-card,
          .order-card {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .invoice-stats,
          .order-right {
            width: 100%;
            flex-wrap: wrap;
            gap: 15px 25px;
          }

          .right-column {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .payment-page {
            padding: 12px;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .info-item,
          .info-item:nth-child(2n),
          .info-item:nth-child(3n) {
            border-right: 0;
            border-bottom: 1px solid #eef2f7;
          }

          .info-item:last-child {
            border-bottom: 0;
          }

          .invoice-stats,
          .order-right {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </AppShell>
  );
}