"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Invoice = {
  id: string;
  company_id: string;
  customer_id: string | null;
  job_id: string | null;
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

const INVOICE_STATUSES = [
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "void",
];

const emptyForm = {
  customer_id: "",
  job_id: "",
  invoice_number: "",
  status: "draft",
  subtotal: "",
  tax: "",
  amount_paid: "",
  due_date: "",
  notes: "",
};

export default function InvoicesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [company, setCompany] = useState<Company | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const [form, setForm] = useState(emptyForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

      if (authError) throw authError;

      if (!user) {
        router.replace("/login");
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
        throw new Error("No company membership found.");
      }

      const companyId = membership.company_id;

      const [
        companyResult,
        invoicesResult,
        customersResult,
        jobsResult,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, currency")
          .eq("id", companyId)
          .single(),

        supabase
          .from("invoices")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("customers")
          .select("id, name, email, phone")
          .eq("company_id", companyId)
          .order("name", { ascending: true }),

        supabase
          .from("jobs")
          .select("id, title, customer_id, status")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
      ]);

      if (companyResult.error) throw companyResult.error;
      if (invoicesResult.error) throw invoicesResult.error;
      if (customersResult.error) throw customersResult.error;
      if (jobsResult.error) throw jobsResult.error;

      setCompany(companyResult.data);
      setInvoices(invoicesResult.data || []);
      setCustomers(customersResult.data || []);
      setJobs(jobsResult.data || []);
    } catch (err: any) {
      console.error("Invoice page load error:", err);
      setError(err?.message || "Could not load invoices.");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    const nextNumber = generateInvoiceNumber();

    setEditingInvoice(null);
    setForm({
      ...emptyForm,
      invoice_number: nextNumber,
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditModal(invoice: Invoice) {
    setEditingInvoice(invoice);

    setForm({
      customer_id: invoice.customer_id || "",
      job_id: invoice.job_id || "",
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      subtotal: String(invoice.subtotal ?? ""),
      tax: String(invoice.tax ?? ""),
      amount_paid: String(invoice.amount_paid ?? ""),
      due_date: invoice.due_date || "",
      notes: invoice.notes || "",
    });

    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingInvoice(null);
    setForm(emptyForm);
    setError("");
  }

  function generateInvoiceNumber() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const random = Math.floor(1000 + Math.random() * 9000);

    return `INV-${year}${month}-${random}`;
  }

  function updateForm(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const subtotal = Number(form.subtotal) || 0;
  const tax = Number(form.tax) || 0;
  const total = subtotal + tax;

  const amountPaid = Number(form.amount_paid) || 0;
  const balanceDue = Math.max(total - amountPaid, 0);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const customer = customers.find(
        (customer) => customer.id === invoice.customer_id
      );

      const customerName = customer?.name || "";

      const matchesSearch =
        !query ||
        invoice.invoice_number.toLowerCase().includes(query) ||
        customerName.toLowerCase().includes(query) ||
        invoice.status.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || invoice.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, customers, search, statusFilter]);

  const stats = useMemo(() => {
    const totalInvoiced = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0
    );

    const totalPaid = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount_paid || 0),
      0
    );

    const outstanding = invoices.reduce((sum, invoice) => {
      return (
        sum +
        Math.max(
          Number(invoice.total || 0) -
            Number(invoice.amount_paid || 0),
          0
        )
      );
    }, 0);

    const overdue = invoices
      .filter((invoice) => invoice.status === "overdue")
      .reduce((sum, invoice) => {
        return (
          sum +
          Math.max(
            Number(invoice.total || 0) -
              Number(invoice.amount_paid || 0),
            0
          )
        );
      }, 0);

    return {
      totalInvoiced,
      totalPaid,
      outstanding,
      overdue,
    };
  }, [invoices]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace("/login");
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
        throw new Error("No company membership found.");
      }

      if (!form.invoice_number.trim()) {
        throw new Error("Invoice number is required.");
      }

      if (!INVOICE_STATUSES.includes(form.status)) {
        throw new Error("Invalid invoice status.");
      }

      const subtotalValue = Number(form.subtotal) || 0;
      const taxValue = Number(form.tax) || 0;
      const totalValue = subtotalValue + taxValue;
      const amountPaidValue = Number(form.amount_paid) || 0;

      if (subtotalValue < 0) {
        throw new Error("Subtotal cannot be negative.");
      }

      if (taxValue < 0) {
        throw new Error("Tax cannot be negative.");
      }

      if (amountPaidValue < 0) {
        throw new Error("Amount paid cannot be negative.");
      }

      if (amountPaidValue > totalValue && totalValue >= 0) {
        throw new Error(
          "Amount paid cannot be greater than the invoice total."
        );
      }

      const payload = {
        company_id: membership.company_id,
        customer_id: form.customer_id || null,
        job_id: form.job_id || null,
        invoice_number: form.invoice_number.trim(),
        status: form.status,
        subtotal: subtotalValue,
        tax: taxValue,
        total: totalValue,
        amount_paid: amountPaidValue,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingInvoice) {
        const { data, error: updateError } = await supabase
          .from("invoices")
          .update(payload)
          .eq("id", editingInvoice.id)
          .eq("company_id", membership.company_id)
          .select("*")
          .single();

        if (updateError) {
          console.error("Invoice update error:", updateError);
          throw updateError;
        }

        setInvoices((current) =>
          current.map((invoice) =>
            invoice.id === editingInvoice.id ? data : invoice
          )
        );

        setSuccess("Invoice updated successfully.");
      } else {
        const { data, error: insertError } = await supabase
          .from("invoices")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select("*")
          .single();

        if (insertError) {
          console.error("Invoice insert error:", insertError);
          throw insertError;
        }

        setInvoices((current) => [data, ...current]);

        setSuccess("Invoice created successfully.");
      }

      setTimeout(() => {
        setModalOpen(false);
        setEditingInvoice(null);
        setForm(emptyForm);
        setSuccess("");
      }, 700);
    } catch (err: any) {
      console.error("Invoice save error:", err);
      setError(err?.message || "Could not save invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvoice(invoice: Invoice) {
    const confirmed = window.confirm(
      `Delete invoice ${invoice.invoice_number}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
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
        throw new Error("No company membership found.");
      }

      const { error: deleteError } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoice.id)
        .eq("company_id", membership.company_id);

      if (deleteError) {
        console.error("Invoice delete error:", deleteError);
        throw deleteError;
      }

      setInvoices((current) =>
        current.filter((item) => item.id !== invoice.id)
      );

      setSuccess("Invoice deleted successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 2000);
    } catch (err: any) {
      console.error("Invoice delete error:", err);
      setError(err?.message || "Could not delete invoice.");
    }
  }

  function getCustomerName(customerId: string | null) {
    if (!customerId) return "No customer";

    return (
      customers.find((customer) => customer.id === customerId)?.name ||
      "Unknown customer"
    );
  }

  function getJobTitle(jobId: string | null) {
    if (!jobId) return "—";

    return jobs.find((job) => job.id === jobId)?.title || "Unknown job";
  }

  function formatCurrency(value: number) {
    const currency = company?.currency || "USD";

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `$${value.toFixed(2)}`;
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "—";

    const parsed = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) return date;

    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatStatus(status: string) {
    if (status === "partially_paid") return "Partially Paid";

    if (status === "void") return "Void";

    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function getStatusClass(status: string) {
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

  return (
    <AppShell
      title="Invoices"
      description="Create, track and manage customer invoices."
      actions={
        <button
          type="button"
          className="primary-button"
          onClick={openCreateModal}
        >
          + New Invoice
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
              Total Invoiced
            </div>

            <div className="stat-value">
              {formatCurrency(stats.totalInvoiced)}
            </div>

            <div className="stat-description">
              Across all invoices
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Paid
            </div>

            <div className="stat-value">
              {formatCurrency(stats.totalPaid)}
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
              {formatCurrency(stats.outstanding)}
            </div>

            <div className="stat-description">
              Balance still due
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Overdue
            </div>

            <div className="stat-value">
              {formatCurrency(stats.overdue)}
            </div>

            <div className="stat-description">
              Past-due invoices
            </div>
          </div>
        </div>

        <section className="content-card">
          <div className="content-card-header">
            <div>
              <h2>All Invoices</h2>

              <p>
                {filteredInvoices.length} invoice
                {filteredInvoices.length === 1 ? "" : "s"} found
              </p>
            </div>

            <div className="filters">
              <div className="search-box">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">
                  All statuses
                </option>

                {INVOICE_STATUSES.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner" />
              <p>Loading invoices...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">▥</div>

              <h3>
                {search || statusFilter !== "all"
                  ? "No invoices found"
                  : "No invoices yet"}
              </h3>

              <p>
                {search || statusFilter !== "all"
                  ? "Try changing your search or filter."
                  : "Create your first invoice to start tracking payments."}
              </p>

              {!search && statusFilter === "all" && (
                <button
                  className="primary-button"
                  onClick={openCreateModal}
                >
                  + Create Invoice
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Job</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredInvoices.map((invoice) => {
                    const balance = Math.max(
                      Number(invoice.total || 0) -
                        Number(invoice.amount_paid || 0),
                      0
                    );

                    return (
                      <tr key={invoice.id}>
                        <td>
                          <div className="primary-cell">
                            {invoice.invoice_number}
                          </div>

                          <div className="secondary-cell">
                            {formatDate(invoice.created_at)}
                          </div>
                        </td>

                        <td>
                          <div className="primary-cell">
                            {getCustomerName(
                              invoice.customer_id
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="secondary-cell job-cell">
                            {getJobTitle(invoice.job_id)}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`status-badge ${getStatusClass(
                              invoice.status
                            )}`}
                          >
                            {formatStatus(invoice.status)}
                          </span>
                        </td>

                        <td>
                          {formatDate(invoice.due_date)}
                        </td>

                        <td>
                          <strong>
                            {formatCurrency(
                              Number(invoice.total || 0)
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong
                            className={
                              balance > 0
                                ? "balance-due"
                                : "balance-paid"
                            }
                          >
                            {formatCurrency(balance)}
                          </strong>
                        </td>

                        <td>
                          <div className="row-actions">
                            <button
                              className="table-action"
                              onClick={() =>
                                openEditModal(invoice)
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="table-action danger"
                              onClick={() =>
                                deleteInvoice(invoice)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {modalOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingInvoice
                    ? "Edit Invoice"
                    : "Create Invoice"}
                </h2>

                <p>
                  {editingInvoice
                    ? "Update invoice details and payment status."
                    : "Create a new invoice for a customer."}
                </p>
              </div>

              <button
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-error">
                    {error}
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-group">
                    <label>
                      Invoice Number
                    </label>

                    <input
                      type="text"
                      value={form.invoice_number}
                      onChange={(event) =>
                        updateForm(
                          "invoice_number",
                          event.target.value
                        )
                      }
                      placeholder="INV-202609-1001"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Status
                    </label>

                    <select
                      value={form.status}
                      onChange={(event) =>
                        updateForm(
                          "status",
                          event.target.value
                        )
                      }
                      required
                    >
                      {INVOICE_STATUSES.map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>
                      Customer
                    </label>

                    <select
                      value={form.customer_id}
                      onChange={(event) =>
                        updateForm(
                          "customer_id",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select customer
                      </option>

                      {customers.map((customer) => (
                        <option
                          key={customer.id}
                          value={customer.id}
                        >
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>
                      Job
                    </label>

                    <select
                      value={form.job_id}
                      onChange={(event) =>
                        updateForm(
                          "job_id",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select job
                      </option>

                      {jobs
                        .filter((job) => {
                          if (!form.customer_id) {
                            return true;
                          }

                          return (
                            job.customer_id ===
                            form.customer_id
                          );
                        })
                        .map((job) => (
                          <option
                            key={job.id}
                            value={job.id}
                          >
                            {job.title}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>
                      Subtotal
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.subtotal}
                      onChange={(event) =>
                        updateForm(
                          "subtotal",
                          event.target.value
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Tax
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.tax}
                      onChange={(event) =>
                        updateForm(
                          "tax",
                          event.target.value
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Amount Paid
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount_paid}
                      onChange={(event) =>
                        updateForm(
                          "amount_paid",
                          event.target.value
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Due Date
                    </label>

                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(event) =>
                        updateForm(
                          "due_date",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>
                      Notes
                    </label>

                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        updateForm(
                          "notes",
                          event.target.value
                        )
                      }
                      placeholder="Payment terms, project notes, customer instructions..."
                      rows={4}
                    />
                  </div>
                </div>

                <div className="invoice-summary">
                  <div>
                    <span>Subtotal</span>
                    <strong>
                      {formatCurrency(subtotal)}
                    </strong>
                  </div>

                  <div>
                    <span>Tax</span>
                    <strong>
                      {formatCurrency(tax)}
                    </strong>
                  </div>

                  <div className="summary-total">
                    <span>Total</span>
                    <strong>
                      {formatCurrency(total)}
                    </strong>
                  </div>

                  <div>
                    <span>Amount Paid</span>
                    <strong>
                      {formatCurrency(amountPaid)}
                    </strong>
                  </div>

                  <div className="summary-balance">
                    <span>Balance Due</span>
                    <strong>
                      {formatCurrency(balanceDue)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingInvoice
                    ? "Update Invoice"
                    : "Create Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

        .secondary-cell {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 12px;
        }

        .job-cell {
          max-width: 180px;
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

        .balance-due {
          color: #dc2626;
        }

        .balance-paid {
          color: #059669;
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

        .primary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .secondary-button {
          height: 40px;
          padding: 0 15px;
          border: 1px solid #dbe1e8;
          border-radius: 9px;
          background: #ffffff;
          color: #475569;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.55);
        }

        .modal {
          width: min(760px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 19px;
        }

        .modal-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 13px;
        }

        .modal-close {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 8px;
          background: #f8fafc;
          color: #64748b;
          font-size: 22px;
          cursor: pointer;
        }

        .modal-body {
          padding: 24px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-group label {
          color: #334155;
          font-size: 12px;
          font-weight: 700;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe1e8;
          border-radius: 9px;
          background: #ffffff;
          color: #0f172a;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .form-group input,
        .form-group select {
          height: 42px;
          padding: 0 12px;
        }

        .form-group textarea {
          padding: 11px 12px;
          resize: vertical;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: #64748b;
          box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.1);
        }

        .invoice-summary {
          margin-top: 24px;
          padding: 17px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #f8fafc;
        }

        .invoice-summary > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 7px 0;
          color: #64748b;
          font-size: 13px;
        }

        .invoice-summary strong {
          color: #334155;
        }

        .invoice-summary .summary-total {
          margin-top: 4px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          color: #0f172a;
          font-size: 15px;
        }

        .invoice-summary .summary-total strong {
          color: #0f172a;
          font-size: 16px;
        }

        .invoice-summary .summary-balance {
          margin-top: 5px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }

        .invoice-summary .summary-balance strong {
          color: #dc2626;
          font-size: 15px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 18px 24px;
          border-top: 1px solid #e5e7eb;
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

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-group.full-width {
            grid-column: auto;
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

          .modal-overlay {
            padding: 10px;
          }

          .modal {
            max-height: calc(100vh - 20px);
          }

          .modal-header,
          .modal-body,
          .modal-footer {
            padding-left: 17px;
            padding-right: 17px;
          }

          .modal-footer {
            flex-direction: column-reverse;
          }

          .modal-footer button {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}