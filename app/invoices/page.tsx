"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { useRegionalSettings } from "@/app/components/regional-settings-provider";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/regional-settings";

type Invoice = {
  id: string;
  company_id: string;
  customer_id: string | null;
  invoice_number: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  due_date: string | null;
  vat_number: string | null;
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

const INVOICE_STATUSES = [
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "void",
];

export default function InvoicesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { settings } = useRegionalSettings();

  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

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
        invoicesResult,
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
          .from("invoices")
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

      if (invoicesResult.error) {
        throw invoicesResult.error;
      }

      if (customersResult.error) {
        throw customersResult.error;
      }

      setCompany(
        companyResult.data
      );

      setInvoices(
        invoicesResult.data || []
      );

      setCustomers(
        customersResult.data || []
      );
    } catch (err: unknown) {
      console.error(
        "Invoice page load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not load invoices."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    // This effect intentionally starts the asynchronous Supabase
    // synchronization for the invoice list.
     
    void loadData();
  }, [loadData]);

  const filteredInvoices =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return invoices.filter(
        (invoice) => {
          const customer =
            customers.find(
              (customer) =>
                customer.id ===
                invoice.customer_id
            );

          const customerName =
            customer?.name || "";

          const matchesSearch =
            !query ||
            invoice.invoice_number
              .toLowerCase()
              .includes(query) ||
            customerName
              .toLowerCase()
              .includes(query) ||
            invoice.status
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            statusFilter === "all" ||
            invoice.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      invoices,
      customers,
      search,
      statusFilter,
    ]);

  const stats = useMemo(() => {
    const totalInvoiced =
      invoices.reduce(
        (sum, invoice) =>
          sum +
          Number(
            invoice.total || 0
          ),
        0
      );

    const totalPaid =
      invoices.reduce(
        (sum, invoice) =>
          sum +
          Number(
            invoice.amount_paid ||
              0
          ),
        0
      );

    const outstanding =
      invoices.reduce(
        (sum, invoice) =>
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
          ),
        0
      );

    const overdue =
      invoices
        .filter(
          (invoice) =>
            invoice.status ===
            "overdue"
        )
        .reduce(
          (sum, invoice) =>
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
            ),
          0
        );

    return {
      totalInvoiced,
      totalPaid,
      outstanding,
      overdue,
    };
  }, [invoices]);

  async function deleteInvoice(
    invoice: Invoice
  ) {
    const confirmed =
      window.confirm(
        `Delete invoice ${invoice.invoice_number}? This action cannot be undone.`
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

      const {
        error: deleteError,
      } = await supabase
        .from("invoices")
        .delete()
        .eq(
          "id",
          invoice.id
        )
        .eq(
          "company_id",
          membership.company_id
        );

      if (deleteError) {
        throw deleteError;
      }

      setInvoices(
        (current) =>
          current.filter(
            (item) =>
              item.id !== invoice.id
          )
      );

      setSuccess(
        "Invoice deleted successfully."
      );

      setTimeout(() => {
        setSuccess("");
      }, 2000);
    } catch (err: unknown) {
      console.error(
        "Invoice delete error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not delete invoice."
      );
    }
  }

  function getCustomerName(
    customerId: string | null
  ) {
    if (!customerId) {
      return "No customer";
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

  function formatCurrency(
    value: number
  ) {
    return formatMoney(value, settings);
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
    if (
      status ===
      "partially_paid"
    ) {
      return "Partially Paid";
    }

    if (status === "void") {
      return "Void";
    }

    return (
      status.charAt(0).toUpperCase() +
      status.slice(1)
    );
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

  function openInvoice(
    invoiceId: string
  ) {
    router.push(
      `/invoices/${invoiceId}`
    );
  }

  function createInvoice() {
    router.push(
      "/invoices/new"
    );
  }

  return (
    <AppShell
      title="Invoices"
      description="Create, track and manage customer invoices."
      actions={
        <button
          type="button"
          className="primary-button"
          onClick={
            createInvoice
          }
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
              {formatCurrency(
                stats.totalInvoiced
              )}
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
              Overdue
            </div>

            <div className="stat-value">
              {formatCurrency(
                stats.overdue
              )}
            </div>

            <div className="stat-description">
              Past-due invoices
            </div>
          </div>
        </div>

        <section className="content-card">
          <div className="content-card-header">
            <div>
              <h2>
                All Invoices
              </h2>

              <p>
                {
                  filteredInvoices.length
                }{" "}
                invoice
                {filteredInvoices.length ===
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
                  placeholder="Search invoices..."
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

                {INVOICE_STATUSES.map(
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
                Loading invoices...
              </p>
            </div>
          ) : filteredInvoices.length ===
            0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                ▥
              </div>

              <h3>
                {search ||
                statusFilter !==
                  "all"
                  ? "No invoices found"
                  : "No invoices yet"}
              </h3>

              <p>
                {search ||
                statusFilter !==
                  "all"
                  ? "Try changing your search or filter."
                  : "Create your first invoice to start tracking payments."}
              </p>

              {!search &&
                statusFilter ===
                  "all" && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={
                      createInvoice
                    }
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
                    <th>
                      Invoice
                    </th>

                    <th>
                      Customer
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Due Date
                    </th>

                    <th>
                      Total
                    </th>

                    <th>
                      Balance
                    </th>

                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredInvoices.map(
                    (invoice) => {
                      const balance =
                        Math.max(
                          Number(
                            invoice.total ||
                              0
                          ) -
                            Number(
                              invoice.amount_paid ||
                                0
                            ),
                          0
                        );

                      return (
                        <tr
                          key={
                            invoice.id
                          }
                        >
                          <td>
                            <button
                              type="button"
                              className="invoice-link"
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

                            <div className="secondary-cell">
                              {formatDate(
                                invoice.created_at
                              )}
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
                            <span
                              className={`status-badge ${getStatusClass(
                                invoice.status
                              )}`}
                            >
                              {formatStatus(
                                invoice.status
                              )}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              invoice.due_date
                            )}
                          </td>

                          <td>
                            <strong>
                              {formatCurrency(
                                Number(
                                  invoice.total ||
                                    0
                                )
                              )}
                            </strong>
                          </td>

                          <td>
                            <strong
                              className={
                                balance >
                                0
                                  ? "balance-due"
                                  : "balance-paid"
                              }
                            >
                              {formatCurrency(
                                balance
                              )}
                            </strong>
                          </td>

                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="table-action"
                                onClick={() =>
                                  openInvoice(
                                    invoice.id
                                  )
                                }
                              >
                                Open
                              </button>

                              <button
                                type="button"
                                className="table-action danger"
                                onClick={() =>
                                  deleteInvoice(
                                    invoice
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
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 22px;
  }

  .stat-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 18px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.18s ease;
  }

  .stat-card:hover {
    border-color: #bbf7d0;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
    transform: translateY(-1px);
  }

  .stat-label {
    color: #64748b;
    font-size: 12px;
    font-weight: 650;
    margin-bottom: 7px;
  }

  .stat-value {
    color: #0f172a;
    font-size: 24px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .stat-description {
    color: #94a3b8;
    font-size: 11.5px;
    margin-top: 6px;
  }

  .content-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  }

  .content-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 18px 20px;
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
  }

  .content-card-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: 17px;
    line-height: 1.3;
    font-weight: 750;
    letter-spacing: -0.2px;
  }

  .content-card-header p {
    margin: 4px 0 0;
    color: #94a3b8;
    font-size: 12px;
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    min-width: 235px;
    padding: 0 11px;
    border: 1px solid #dbe3ea;
    border-radius: 8px;
    background: #ffffff;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .search-box:focus-within {
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  .search-box span {
    color: #94a3b8;
    font-size: 18px;
    line-height: 1;
  }

  .search-box input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    color: #0f172a;
    background: transparent;
    font-size: 12.5px;
  }

  .search-box input::placeholder {
    color: #94a3b8;
  }

  .filters select {
    height: 38px;
    padding: 0 11px;
    border: 1px solid #dbe3ea;
    border-radius: 8px;
    background: #ffffff;
    color: #334155;
    font-size: 12.5px;
    outline: none;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .filters select:focus {
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    min-width: 850px;
    border-collapse: collapse;
  }

  .data-table th {
    padding: 11px 18px;
    background: #f8fafc;
    color: #64748b;
    font-size: 10.5px;
    font-weight: 750;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.45px;
    white-space: nowrap;
  }

  .data-table td {
    padding: 15px 18px;
    border-top: 1px solid #eef2f7;
    color: #334155;
    font-size: 12.5px;
    vertical-align: middle;
    background: #ffffff;
    transition: background 0.15s ease;
  }

  .data-table tbody tr:hover td {
    background: #f8fffb;
  }

  .primary-cell {
    color: #0f172a;
    font-weight: 650;
  }

  .invoice-link {
    padding: 0;
    border: 0;
    background: transparent;
    color: #047857;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
    transition: color 0.15s ease;
  }

  .invoice-link:hover {
    color: #065f46;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .secondary-cell {
    margin-top: 4px;
    color: #94a3b8;
    font-size: 11px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 5px 9px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1;
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
    font-weight: 700;
  }

  .balance-paid {
    color: #059669;
    font-weight: 700;
  }

  .row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .table-action {
    height: 30px;
    padding: 0 10px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    background: #ffffff;
    color: #475569;
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 650;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .table-action:hover {
    background: #ecfdf5;
    border-color: #a7f3d0;
    color: #047857;
  }

  .table-action.danger {
    color: #dc2626;
  }

  .table-action.danger:hover {
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
  }

  .empty-state {
    min-height: 340px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon {
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    border-radius: 12px;
    background: #ecfdf5;
    color: #059669;
    font-size: 22px;
  }

  .empty-state h3 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
    font-weight: 750;
  }

  .empty-state p {
    margin: 7px 0 18px;
    color: #94a3b8;
    font-size: 12.5px;
  }

  .loading-spinner {
    width: 28px;
    height: 28px;
    margin-bottom: 12px;
    border: 3px solid #d1fae5;
    border-top-color: #059669;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .alert {
    display: flex;
    align-items: center;
    padding: 11px 13px;
    margin-bottom: 16px;
    border-radius: 8px;
    font-size: 12.5px;
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
    height: 38px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: #059669;
    color: #ffffff;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(5, 150, 105, 0.18);
    transition:
      background 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.15s ease;
  }

  .primary-button:hover {
    background: #047857;
    box-shadow: 0 4px 10px rgba(5, 150, 105, 0.18);
  }

  .primary-button:active {
    transform: translateY(1px);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1100px) {
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
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
    .page-content {
      padding: 14px;
    }

    .stats-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .stat-card {
      padding: 17px;
    }

    .stat-value {
      font-size: 22px;
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