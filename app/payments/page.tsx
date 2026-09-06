"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  total: number;
  amount_paid: number;
  status: string;
  due_date: string | null;
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

type PaymentRow = InvoicePayment & {
  invoice: Invoice | null;
  customer: Customer | null;
};

const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Credit Card",
  "Debit Card",
  "Cheque",
  "Stripe",
  "Other",
];

export default function PaymentsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [company, setCompany] = useState<Company | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const [showPaymentModal, setShowPaymentModal] =
    useState(false);

  const [selectedInvoiceId, setSelectedInvoiceId] =
    useState("");

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadPayments();
  }, []);

  async function getCompanyId(): Promise<string> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw authError;
    }

    if (!user) {
      router.replace("/login");
      throw new Error("Not authenticated.");
    }

    const { data: membership, error } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!membership?.company_id) {
      throw new Error("No company membership found.");
    }

    return membership.company_id;
  }

  async function loadPayments() {
    setLoading(true);
    setError("");

    try {
      const companyId = await getCompanyId();

      const [
        companyResult,
        paymentsResult,
        invoicesResult,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, currency")
          .eq("id", companyId)
          .single(),

        supabase
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
          .eq("company_id", companyId)
          .order("paid_at", {
            ascending: false,
          }),

        supabase
          .from("invoices")
          .select(
            `
              id,
              invoice_number,
              customer_id,
              total,
              amount_paid,
              status,
              due_date
            `
          )
          .eq("company_id", companyId)
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (companyResult.error) {
        throw companyResult.error;
      }

      if (paymentsResult.error) {
        throw paymentsResult.error;
      }

      if (invoicesResult.error) {
        throw invoicesResult.error;
      }

      const invoiceList =
        (invoicesResult.data || []) as Invoice[];

      const paymentList =
        (paymentsResult.data || []) as InvoicePayment[];

      const customerIds = Array.from(
        new Set(
          paymentList
            .map((payment) => payment.customer_id)
            .filter(Boolean)
        )
      ) as string[];

      let customerList: Customer[] = [];

      if (customerIds.length > 0) {
        const { data, error } = await supabase
          .from("customers")
          .select("id, name, email, phone")
          .eq("company_id", companyId)
          .in("id", customerIds);

        if (error) {
          throw error;
        }

        customerList = (data || []) as Customer[];
      }

      const invoiceMap = new Map(
        invoiceList.map((invoice) => [
          invoice.id,
          invoice,
        ])
      );

      const customerMap = new Map(
        customerList.map((customer) => [
          customer.id,
          customer,
        ])
      );

      const rows: PaymentRow[] = paymentList.map(
        (payment) => ({
          ...payment,
          invoice:
            invoiceMap.get(payment.invoice_id) ||
            null,
          customer: payment.customer_id
            ? customerMap.get(payment.customer_id) ||
              null
            : null,
        })
      );

      setCompany(companyResult.data as Company);
      setPayments(rows);
      setInvoices(invoiceList);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to load payments."
      );
    } finally {
      setLoading(false);
    }
  }

  const currency = company?.currency || "USD";

  function formatCurrency(value: number) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${currency} ${value.toFixed(2)}`;
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  }

  const totalCollected = useMemo(() => {
    return payments.reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0
    );
  }, [payments]);

  const totalToday = useMemo(() => {
    const today = new Date();

    return payments.reduce(
      (sum, payment) => {
        const date = new Date(payment.paid_at);

        if (
          date.getFullYear() ===
            today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate()
        ) {
          return sum + Number(payment.amount || 0);
        }

        return sum;
      },
      0
    );
  }, [payments]);

  const totalMonth = useMemo(() => {
    const today = new Date();

    return payments.reduce(
      (sum, payment) => {
        const date = new Date(payment.paid_at);

        if (
          date.getFullYear() ===
            today.getFullYear() &&
          date.getMonth() === today.getMonth()
        ) {
          return sum + Number(payment.amount || 0);
        }

        return sum;
      },
      0
    );
  }, [payments]);

  const outstanding = useMemo(() => {
    return invoices.reduce((sum, invoice) => {
      if (
        invoice.status === "draft" ||
        invoice.status === "void"
      ) {
        return sum;
      }

      return (
        sum +
        Math.max(
          Number(invoice.total || 0) -
            Number(invoice.amount_paid || 0),
          0
        )
      );
    }, 0);
  }, [invoices]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();

    return payments.filter((payment) => {
      const method =
        payment.payment_method || "Other";

      if (
        methodFilter !== "all" &&
        method !== methodFilter
      ) {
        return false;
      }

      if (dateFilter !== "all") {
        const date = new Date(payment.paid_at);

        if (dateFilter === "today") {
          const sameDay =
            date.getFullYear() ===
              now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate();

          if (!sameDay) {
            return false;
          }
        }

        if (dateFilter === "month") {
          const sameMonth =
            date.getFullYear() ===
              now.getFullYear() &&
            date.getMonth() === now.getMonth();

          if (!sameMonth) {
            return false;
          }
        }
      }

      if (!query) {
        return true;
      }

      const customerName =
        payment.customer?.name || "";

      const invoiceNumber =
        payment.invoice?.invoice_number || "";

      const paymentReference =
        payment.reference || "";

      return (
        customerName
          .toLowerCase()
          .includes(query) ||
        invoiceNumber
          .toLowerCase()
          .includes(query) ||
        paymentReference
          .toLowerCase()
          .includes(query) ||
        method.toLowerCase().includes(query)
      );
    });
  }, [
    payments,
    search,
    methodFilter,
    dateFilter,
  ]);

  const selectedInvoice =
    invoices.find(
      (invoice) =>
        invoice.id === selectedInvoiceId
    ) || null;

  const selectedBalance = selectedInvoice
    ? Math.max(
        Number(selectedInvoice.total || 0) -
          Number(selectedInvoice.amount_paid || 0),
        0
      )
    : 0;

  function resetForm() {
    setSelectedInvoiceId("");
    setAmount("");
    setPaymentMethod("Bank Transfer");
    setReference("");
    setPaymentDate(
      new Date().toISOString().slice(0, 10)
    );
    setNotes("");
  }

  function openPaymentModal() {
    setError("");
    setSuccess("");
    resetForm();
    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    if (saving) {
      return;
    }

    setShowPaymentModal(false);
    resetForm();
  }

  function handleInvoiceChange(
    invoiceId: string
  ) {
    setSelectedInvoiceId(invoiceId);

    const invoice = invoices.find(
      (item) => item.id === invoiceId
    );

    if (!invoice) {
      setAmount("");
      return;
    }

    const balance = Math.max(
      Number(invoice.total || 0) -
        Number(invoice.amount_paid || 0),
      0
    );

    setAmount(
      balance > 0
        ? balance.toFixed(2)
        : ""
    );
  }

  async function savePayment() {
    setError("");
    setSuccess("");

    if (!selectedInvoice) {
      setError("Please select an invoice.");
      return;
    }

    const paymentAmount = Number(amount);

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      setError(
        "Payment amount must be greater than zero."
      );
      return;
    }

    if (paymentAmount > selectedBalance) {
      setError(
        `Payment cannot exceed the remaining balance of ${formatCurrency(
          selectedBalance
        )}.`
      );
      return;
    }

    setSaving(true);

    try {
      const companyId = await getCompanyId();

      const { data: insertedPayment, error } =
        await supabase
          .from("invoice_payments")
          .insert({
            company_id: companyId,
            invoice_id: selectedInvoice.id,
            customer_id:
              selectedInvoice.customer_id ||
              null,
            amount: paymentAmount,
            currency,
            payment_method: paymentMethod,
            reference:
              reference.trim() || null,
            notes:
              notes.trim() || null,
            paid_at: new Date(
              `${paymentDate}T12:00:00`
            ).toISOString(),
          })
          .select("id")
          .single();

      if (error) {
        throw error;
      }

      setSuccess(
        `Payment recorded successfully for ${selectedInvoice.invoice_number}.`
      );

      setShowPaymentModal(false);
      resetForm();

      await loadPayments();

      if (insertedPayment?.id) {
        setTimeout(() => {
          router.push(
            `/payments/${insertedPayment.id}`
          );
        }, 500);
      }
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to record payment."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Payments"
        description="Customer payment ledger"
      >
        <div className="loading">
          <div className="spinner" />
          <p>Loading payments...</p>
        </div>

        <style jsx>{`
          .loading {
            min-height: 500px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #64748b;
          }

          .spinner {
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

  return (
    <AppShell
      title="Payments"
      description="Customer payment ledger and receivables"
      actions={
        <button
          type="button"
          className="primary-button"
          onClick={openPaymentModal}
        >
          + Record Payment
        </button>
      }
    >
      <main className="page">
        {error && (
          <div className="alert error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert success">
            {success}
          </div>
        )}

        <section className="stats">
          <div className="stat">
            <span>TOTAL COLLECTED</span>
            <strong>
              {formatCurrency(totalCollected)}
            </strong>
            <small>
              {payments.length} recorded payments
            </small>
          </div>

          <div className="stat">
            <span>THIS MONTH</span>
            <strong>
              {formatCurrency(totalMonth)}
            </strong>
            <small>
              Payments received this month
            </small>
          </div>

          <div className="stat">
            <span>TODAY</span>
            <strong>
              {formatCurrency(totalToday)}
            </strong>
            <small>
              Payments received today
            </small>
          </div>

          <div className="stat">
            <span>OUTSTANDING</span>
            <strong>
              {formatCurrency(outstanding)}
            </strong>
            <small>
              Open invoice balances
            </small>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>All Payments</h2>
              <p>
                Every customer payment recorded in
                your company.
              </p>
            </div>

            <span className="count">
              {filteredPayments.length} payments
            </span>
          </div>

          <div className="filters">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search customer, invoice, reference..."
            />

            <select
              value={methodFilter}
              onChange={(event) =>
                setMethodFilter(event.target.value)
              }
            >
              <option value="all">
                All methods
              </option>

              {PAYMENT_METHODS.map((method) => (
                <option
                  key={method}
                  value={method}
                >
                  {method}
                </option>
              ))}
            </select>

            <select
              value={dateFilter}
              onChange={(event) =>
                setDateFilter(event.target.value)
              }
            >
              <option value="all">
                All dates
              </option>

              <option value="today">
                Today
              </option>

              <option value="month">
                This month
              </option>
            </select>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>CUSTOMER</th>
                  <th>INVOICE</th>
                  <th>METHOD</th>
                  <th>REFERENCE</th>
                  <th className="right">
                    AMOUNT
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="empty"
                    >
                      <div className="empty-box">
                        <div className="empty-icon">
                          $
                        </div>

                        <strong>
                          No payments found
                        </strong>

                        <span>
                          Record a customer payment
                          to see it here.
                        </span>

                        <button
                          type="button"
                          onClick={
                            openPaymentModal
                          }
                        >
                          Record Payment
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map(
                    (payment) => (
                      <tr
                        key={payment.id}
                        className="payment-row"
                        onClick={() =>
                          router.push(
                            `/payments/${payment.id}`
                          )
                        }
                      >
                        <td>
                          <strong>
                            {formatDate(
                              payment.paid_at
                            )}
                          </strong>
                        </td>

                        <td>
                          <div className="customer">
                            <strong>
                              {payment.customer
                                ?.name ||
                                "Walk-in / Unknown"}
                            </strong>

                            {payment.customer
                              ?.email && (
                              <small>
                                {
                                  payment
                                    .customer
                                    .email
                                }
                              </small>
                            )}
                          </div>
                        </td>

                        <td>
                          {payment.invoice ? (
                            <button
                              type="button"
                              className="link"
                              onClick={(
                                event
                              ) => {
                                event.stopPropagation();

                                router.push(
                                  `/invoices/${payment.invoice!.id}`
                                );
                              }}
                            >
                              {
                                payment.invoice
                                  .invoice_number
                              }
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>
                          <span className="method">
                            {payment.payment_method ||
                              "Other"}
                          </span>
                        </td>

                        <td>
                          <span className="reference">
                            {payment.reference ||
                              "—"}
                          </span>
                        </td>

                        <td className="right">
                          <strong className="amount-value">
                            +
                            {formatCurrency(
                              Number(
                                payment.amount
                              )
                            )}
                          </strong>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showPaymentModal && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closePaymentModal();
              }
            }}
          >
            <div className="modal">
              <div className="modal-header">
                <div>
                  <h2>Record Payment</h2>
                  <p>
                    Apply a customer payment to an
                    invoice.
                  </p>
                </div>

                <button
                  type="button"
                  className="close"
                  onClick={closePaymentModal}
                  disabled={saving}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <label>
                  Invoice
                  <span>*</span>
                </label>

                <select
                  value={selectedInvoiceId}
                  onChange={(event) =>
                    handleInvoiceChange(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select invoice
                  </option>

                  {invoices
                    .filter(
                      (invoice) =>
                        invoice.status !==
                          "void" &&
                        invoice.status !==
                          "draft" &&
                        Number(
                          invoice.total
                        ) >
                          Number(
                            invoice.amount_paid
                          )
                    )
                    .map((invoice) => (
                      <option
                        key={invoice.id}
                        value={invoice.id}
                      >
                        {invoice.invoice_number} —{" "}
                        {formatCurrency(
                          Math.max(
                            Number(
                              invoice.total
                            ) -
                              Number(
                                invoice.amount_paid
                              ),
                            0
                          )
                        )}{" "}
                        remaining
                      </option>
                    ))}
                </select>

                {selectedInvoice && (
                  <div className="invoice-preview">
                    <div>
                      <span>Invoice</span>
                      <strong>
                        {
                          selectedInvoice.invoice_number
                        }
                      </strong>
                    </div>

                    <div>
                      <span>Total</span>
                      <strong>
                        {formatCurrency(
                          Number(
                            selectedInvoice.total
                          )
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Paid</span>
                      <strong className="green">
                        {formatCurrency(
                          Number(
                            selectedInvoice.amount_paid
                          )
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Balance</span>
                      <strong>
                        {formatCurrency(
                          selectedBalance
                        )}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="form-grid">
                  <div>
                    <label>
                      Amount
                      <span>*</span>
                    </label>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(event) =>
                        setAmount(
                          event.target.value
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label>
                      Payment Method
                    </label>

                    <select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(
                          event.target.value
                        )
                      }
                    >
                      {PAYMENT_METHODS.map(
                        (method) => (
                          <option
                            key={method}
                            value={method}
                          >
                            {method}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label>
                      Payment Date
                    </label>

                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(event) =>
                        setPaymentDate(
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div>
                    <label>
                      Reference
                    </label>

                    <input
                      type="text"
                      value={reference}
                      onChange={(event) =>
                        setReference(
                          event.target.value
                        )
                      }
                      placeholder="Transaction ID / cheque number"
                    />
                  </div>
                </div>

                <label>
                  Notes
                </label>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  placeholder="Optional notes..."
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="cancel"
                  onClick={closePaymentModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={savePayment}
                  disabled={
                    saving ||
                    !selectedInvoiceId
                  }
                >
                  {saving
                    ? "Recording..."
                    : "Record Payment"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .page {
          min-height: calc(100vh - 120px);
          padding: 28px;
          background: #f8fafc;
        }

        .alert {
          max-width: 1400px;
          margin: 0 auto 18px;
          padding: 12px 15px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 600;
        }

        .alert.error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .alert.success {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .stats {
          max-width: 1400px;
          margin: 0 auto 20px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .stat {
          padding: 19px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .stat span {
          display: block;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.7px;
        }

        .stat strong {
          display: block;
          margin-top: 8px;
          color: #0f172a;
          font-size: 23px;
        }

        .stat small {
          display: block;
          margin-top: 5px;
          color: #94a3b8;
          font-size: 10px;
        }

        .card {
          max-width: 1400px;
          margin: 0 auto;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          overflow: hidden;
        }

        .card-header {
          min-height: 70px;
          padding: 17px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #eef2f7;
        }

        .card-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 15px;
        }

        .card-header p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 11px;
        }

        .count {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
        }

        .filters {
          padding: 14px 20px;
          display: grid;
          grid-template-columns: 1fr 180px 150px;
          gap: 9px;
          border-bottom: 1px solid #eef2f7;
        }

        .filters input,
        .filters select,
        .modal input,
        .modal select,
        .modal textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe1e8;
          border-radius: 8px;
          background: #fff;
          color: #0f172a;
          font: inherit;
          font-size: 12px;
          outline: none;
        }

        .filters input,
        .filters select,
        .modal input,
        .modal select {
          height: 40px;
          padding: 0 11px;
        }

        .filters input:focus,
        .filters select:focus,
        .modal input:focus,
        .modal select:focus,
        .modal textarea:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.12);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        th {
          padding: 11px 15px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 800;
          text-align: left;
          letter-spacing: 0.5px;
        }

        td {
          padding: 14px 15px;
          border-bottom: 1px solid #eef2f7;
          color: #475569;
          font-size: 12px;
        }

        .payment-row {
          cursor: pointer;
        }

        .payment-row:hover {
          background: #f8fafc;
        }

        td strong {
          color: #334155;
        }

        .customer {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .customer small {
          color: #94a3b8;
          font-size: 10px;
        }

        .link {
          padding: 0;
          border: 0;
          background: transparent;
          color: #2563eb;
          cursor: pointer;
          font-size: 12px;
          font-weight: 800;
        }

        .link:hover {
          text-decoration: underline;
        }

        .method {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 6px;
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
        }

        .reference {
          color: #64748b;
          font-size: 11px;
        }

        .right {
          text-align: right;
        }

        .amount-value {
          color: #059669 !important;
          white-space: nowrap;
        }

        .empty {
          height: 320px;
        }

        .empty-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }

        .empty-icon {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 5px;
          border-radius: 11px;
          background: #f1f5f9;
          color: #475569;
          font-size: 18px;
          font-weight: 800;
        }

        .empty-box strong {
          color: #334155;
          font-size: 13px;
        }

        .empty-box span {
          color: #94a3b8;
          font-size: 11px;
        }

        .empty-box button {
          margin-top: 8px;
          height: 34px;
          padding: 0 12px;
          border: 1px solid #dbe1e8;
          border-radius: 8px;
          background: #fff;
          color: #475569;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        }

        .primary-button {
          height: 40px;
          padding: 0 15px;
          border: 0;
          border-radius: 9px;
          background: #0f172a;
          color: #fff;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }

        .primary-button:hover {
          background: #1e293b;
        }

        .primary-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.5);
        }

        .modal {
          width: min(650px, 100%);
          max-height: calc(100vh - 40px);
          display: flex;
          flex-direction: column;
          background: #fff;
          border-radius: 15px;
          overflow: hidden;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          padding: 19px 21px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 17px;
        }

        .modal-header p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 11px;
        }

        .close {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 7px;
          background: #f1f5f9;
          color: #64748b;
          cursor: pointer;
          font-size: 20px;
        }

        .modal-body {
          padding: 21px;
          overflow-y: auto;
        }

        .modal-body > label,
        .form-grid label {
          display: block;
          margin-bottom: 7px;
          color: #475569;
          font-size: 11px;
          font-weight: 700;
        }

        label span {
          color: #dc2626;
          margin-left: 3px;
        }

        .invoice-preview {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          margin: 14px 0 18px;
          background: #e5e7eb;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          overflow: hidden;
        }

        .invoice-preview div {
          padding: 11px;
          background: #f8fafc;
        }

        .invoice-preview span {
          display: block;
          color: #94a3b8;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .invoice-preview strong {
          display: block;
          margin-top: 4px;
          color: #334155;
          font-size: 11px;
        }

        .green {
          color: #059669 !important;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 14px;
          margin-top: 17px;
        }

        .form-grid > div {
          margin-bottom: 17px;
        }

        .modal textarea {
          min-height: 90px;
          padding: 10px 11px;
          resize: vertical;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 14px 21px;
          border-top: 1px solid #e5e7eb;
          background: #f8fafc;
        }

        .cancel {
          height: 40px;
          padding: 0 14px;
          border: 1px solid #dbe1e8;
          border-radius: 8px;
          background: #fff;
          color: #475569;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }

        @media (max-width: 900px) {
          .stats {
            grid-template-columns: 1fr 1fr;
          }

          .filters {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .page {
            padding: 15px;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .invoice-preview {
            grid-template-columns: 1fr 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .modal-backdrop {
            padding: 10px;
          }
        }
      `}</style>
    </AppShell>
  );
}