"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type DatabaseRow = Record<string, unknown>;

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Estimate = {
  id: string;
  company_id: string;
  customer_id: string | null;
  lead_id: string | null;
  estimate_number: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type EstimateForm = {
  customer_id: string;
  lead_id: string;
  estimate_number: string;
  status: string;
  subtotal: string;
  tax: string;
  valid_until: string;
  notes: string;
};

const ESTIMATE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
];

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown): number {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatus(status: string): string {
  if (!status) return "Unknown";

  return status
    .split("-")
    .map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

function getStatusClass(status: string): string {
  switch (status) {
    case "draft":
      return "estimate-status draft";

    case "sent":
      return "estimate-status sent";

    case "accepted":
      return "estimate-status accepted";

    case "declined":
      return "estimate-status declined";

    case "expired":
      return "estimate-status expired";

    default:
      return "estimate-status";
  }
}

function getInitials(name: string): string {
  if (!name) return "U";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getTodayString(): string {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultValidUntil(): string {
  const date = new Date();

  date.setDate(date.getDate() + 30);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function EstimatesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingEstimate, setEditingEstimate] =
    useState<Estimate | null>(null);

  const [form, setForm] = useState<EstimateForm>({
    customer_id: "",
    lead_id: "",
    estimate_number: "",
    status: "draft",
    subtotal: "",
    tax: "",
    valid_until: getDefaultValidUntil(),
    notes: "",
  });

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("Auth error:", authError);
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: membershipData, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id, role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        console.error(
          "Membership error:",
          membershipError
        );
        return;
      }

      const membership =
        membershipData as DatabaseRow | null;

      const currentCompanyId = getString(
        membership?.company_id
      );

      if (!currentCompanyId) {
        console.error("No company membership found.");
        return;
      }

      setCompanyId(currentCompanyId);

      const [
        { data: estimateData, error: estimateError },
        { data: customerData, error: customerError },
        { data: leadData, error: leadError },
      ] = await Promise.all([
        supabase
          .from("estimates")
          .select(
            "id, company_id, customer_id, lead_id, estimate_number, status, subtotal, tax, total, valid_until, notes, created_at, updated_at"
          )
          .eq("company_id", currentCompanyId)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("customers")
          .select("id, name, email, phone")
          .eq("company_id", currentCompanyId)
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("leads")
          .select("id, name, email, phone")
          .eq("company_id", currentCompanyId)
          .order("name", {
            ascending: true,
          }),
      ]);

      if (estimateError) {
        console.error(
          "Estimates error:",
          estimateError
        );
      }

      if (customerError) {
        console.error(
          "Customers error:",
          customerError
        );
      }

      if (leadError) {
        console.error("Leads error:", leadError);
      }

      const mappedEstimates: Estimate[] = (
        (estimateData ?? []) as DatabaseRow[]
      ).map((row) => ({
        id: getString(row.id),
        company_id: getString(row.company_id),
        customer_id:
          getString(row.customer_id) || null,
        lead_id:
          getString(row.lead_id) || null,
        estimate_number:
          getString(row.estimate_number),
        status: getString(row.status),
        subtotal: getNumber(row.subtotal),
        tax: getNumber(row.tax),
        total: getNumber(row.total),
        valid_until:
          getString(row.valid_until) || null,
        notes:
          getString(row.notes) || null,
        created_at: getString(row.created_at),
        updated_at: getString(row.updated_at),
      }));

      const mappedCustomers: Customer[] = (
        (customerData ?? []) as DatabaseRow[]
      ).map((row) => ({
        id: getString(row.id),
        name: getString(row.name),
        email: getString(row.email) || null,
        phone: getString(row.phone) || null,
      }));

      const mappedLeads: Lead[] = (
        (leadData ?? []) as DatabaseRow[]
      ).map((row) => ({
        id: getString(row.id),
        name: getString(row.name),
        email: getString(row.email) || null,
        phone: getString(row.phone) || null,
      }));

      setEstimates(mappedEstimates);
      setCustomers(mappedCustomers);
      setLeads(mappedLeads);
    } catch (error) {
      console.error(
        "Unexpected Estimates page error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  function generateEstimateNumber(): string {
    const year = new Date().getFullYear();

    const nextNumber = estimates.length + 1;

    return `EST-${year}-${String(nextNumber).padStart(
      4,
      "0"
    )}`;
  }

  function openAddModal() {
    setEditingEstimate(null);

    setForm({
      customer_id: "",
      lead_id: "",
      estimate_number: generateEstimateNumber(),
      status: "draft",
      subtotal: "",
      tax: "",
      valid_until: getDefaultValidUntil(),
      notes: "",
    });

    setShowModal(true);
  }

  function openEditModal(estimate: Estimate) {
    setEditingEstimate(estimate);

    setForm({
      customer_id: estimate.customer_id ?? "",
      lead_id: estimate.lead_id ?? "",
      estimate_number: estimate.estimate_number,
      status: estimate.status,
      subtotal: String(estimate.subtotal),
      tax: String(estimate.tax),
      valid_until: estimate.valid_until ?? "",
      notes: estimate.notes ?? "",
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingEstimate(null);
  }

  async function handleSaveEstimate(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!companyId) {
      alert("Company information is not available.");
      return;
    }

    if (!form.estimate_number.trim()) {
      alert("Please enter an estimate number.");
      return;
    }

    setSaving(true);

    try {
      const subtotal = Number(form.subtotal) || 0;
      const tax = Number(form.tax) || 0;
      const total = subtotal + tax;

      const payload = {
        company_id: companyId,
        customer_id: form.customer_id || null,
        lead_id: form.lead_id || null,
        estimate_number:
          form.estimate_number.trim(),
        status: form.status,
        subtotal,
        tax,
        total,
        valid_until:
          form.valid_until || null,
        notes:
          form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingEstimate) {
        const { data, error } = await supabase
          .from("estimates")
          .update(payload)
          .eq("id", editingEstimate.id)
          .eq("company_id", companyId)
          .select(
            "id, company_id, customer_id, lead_id, estimate_number, status, subtotal, tax, total, valid_until, notes, created_at, updated_at"
          )
          .single();

        if (error) {
          console.error(
            "Update estimate error:",
            error
          );

          alert(
            `Could not update estimate: ${error.message}`
          );

          return;
        }

        const updated = data as DatabaseRow;

        const updatedEstimate: Estimate = {
          id: getString(updated.id),
          company_id: getString(
            updated.company_id
          ),
          customer_id:
            getString(updated.customer_id) || null,
          lead_id:
            getString(updated.lead_id) || null,
          estimate_number:
            getString(updated.estimate_number),
          status: getString(updated.status),
          subtotal: getNumber(updated.subtotal),
          tax: getNumber(updated.tax),
          total: getNumber(updated.total),
          valid_until:
            getString(updated.valid_until) || null,
          notes:
            getString(updated.notes) || null,
          created_at: getString(
            updated.created_at
          ),
          updated_at: getString(
            updated.updated_at
          ),
        };

        setEstimates((current) =>
          current.map((estimate) =>
            estimate.id === updatedEstimate.id
              ? updatedEstimate
              : estimate
          )
        );
      } else {
        const { data, error } = await supabase
          .from("estimates")
          .insert(payload)
          .select(
            "id, company_id, customer_id, lead_id, estimate_number, status, subtotal, tax, total, valid_until, notes, created_at, updated_at"
          )
          .single();

        if (error) {
          console.error(
            "Insert estimate error:",
            error
          );

          alert(
            `Could not create estimate: ${error.message}`
          );

          return;
        }

        const inserted = data as DatabaseRow;

        const newEstimate: Estimate = {
          id: getString(inserted.id),
          company_id: getString(
            inserted.company_id
          ),
          customer_id:
            getString(inserted.customer_id) || null,
          lead_id:
            getString(inserted.lead_id) || null,
          estimate_number:
            getString(inserted.estimate_number),
          status: getString(inserted.status),
          subtotal: getNumber(inserted.subtotal),
          tax: getNumber(inserted.tax),
          total: getNumber(inserted.total),
          valid_until:
            getString(inserted.valid_until) || null,
          notes:
            getString(inserted.notes) || null,
          created_at: getString(
            inserted.created_at
          ),
          updated_at: getString(
            inserted.updated_at
          ),
        };

        setEstimates((current) => [
          newEstimate,
          ...current,
        ]);
      }

      closeModal();
    } catch (error) {
      console.error(
        "Save estimate error:",
        error
      );

      alert(
        "Something went wrong while saving the estimate."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEstimate(
    estimate: Estimate
  ) {
    const confirmed = window.confirm(
      `Delete ${estimate.estimate_number}? This action cannot be undone.`
    );

    if (!confirmed || !companyId) return;

    const { error } = await supabase
      .from("estimates")
      .delete()
      .eq("id", estimate.id)
      .eq("company_id", companyId);

    if (error) {
      console.error(
        "Delete estimate error:",
        error
      );

      alert(
        `Could not delete estimate: ${error.message}`
      );

      return;
    }

    setEstimates((current) =>
      current.filter(
        (item) => item.id !== estimate.id
      )
    );
  }

  const filteredEstimates = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return estimates.filter((estimate) => {
      const customer = customers.find(
        (item) =>
          item.id === estimate.customer_id
      );

      const lead = leads.find(
        (item) => item.id === estimate.lead_id
      );

      const customerName =
        customer?.name ?? "";

      const leadName = lead?.name ?? "";

      const matchesSearch =
        !normalizedSearch ||
        estimate.estimate_number
          .toLowerCase()
          .includes(normalizedSearch) ||
        customerName
          .toLowerCase()
          .includes(normalizedSearch) ||
        leadName
          .toLowerCase()
          .includes(normalizedSearch) ||
        (estimate.notes ?? "")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        estimate.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    estimates,
    customers,
    leads,
    search,
    statusFilter,
  ]);

  const stats = useMemo(() => {
    const total = estimates.length;

    const draft = estimates.filter(
      (estimate) =>
        estimate.status === "draft"
    ).length;

    const sent = estimates.filter(
      (estimate) =>
        estimate.status === "sent"
    ).length;

    const accepted = estimates.filter(
      (estimate) =>
        estimate.status === "accepted"
    ).length;

    const pipelineValue = estimates
      .filter(
        (estimate) =>
          estimate.status !== "declined" &&
          estimate.status !== "expired"
      )
      .reduce(
        (sum, estimate) =>
          sum + estimate.total,
        0
      );

    return {
      total,
      draft,
      sent,
      accepted,
      pipelineValue,
    };
  }, [estimates]);

  const selectedCustomer = customers.find(
    (customer) =>
      customer.id === form.customer_id
  );

  const selectedLead = leads.find(
    (lead) => lead.id === form.lead_id
  );

  const previewSubtotal =
    Number(form.subtotal) || 0;

  const previewTax =
    Number(form.tax) || 0;

  const previewTotal =
    previewSubtotal + previewTax;

  return (
    <AppShell
      title="Estimates"
      description="Create, track, and manage estimates for your customers."
      actions={
        <button
          type="button"
          className="primary-button"
          onClick={openAddModal}
        >
          <span>＋</span>
          New Estimate
        </button>
      }
    >
      <section className="estimates-page">
        <div className="page-heading-row">
          <div>
            <p className="page-eyebrow">
              SALES PIPELINE
            </p>

            <h2>Estimate Management</h2>

            <p className="page-description">
              Create, track, and manage estimates
              for your customers.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openAddModal}
          >
            <span>＋</span>
            New Estimate
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">
                TOTAL ESTIMATES
              </span>

              <span className="stat-icon">
                ▤
              </span>
            </div>

            <strong className="stat-value">
              {stats.total}
            </strong>

            <span className="stat-helper">
              All estimates
            </span>
          </div>

          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">
                DRAFTS
              </span>

              <span className="stat-icon">
                ✎
              </span>
            </div>

            <strong className="stat-value">
              {stats.draft}
            </strong>

            <span className="stat-helper">
              Not sent yet
            </span>
          </div>

          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">
                SENT
              </span>

              <span className="stat-icon">
                ➤
              </span>
            </div>

            <strong className="stat-value">
              {stats.sent}
            </strong>

            <span className="stat-helper">
              Awaiting response
            </span>
          </div>

          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">
                PIPELINE VALUE
              </span>

              <span className="stat-icon">
                $
              </span>
            </div>

            <strong className="stat-value">
              {formatCurrency(
                stats.pipelineValue
              )}
            </strong>

            <span className="stat-helper">
              Active estimates
            </span>
          </div>
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <div>
              <h3>All Estimates</h3>

              <p>
                {filteredEstimates.length}{" "}
                estimate
                {filteredEstimates.length === 1
                  ? ""
                  : "s"}{" "}
                found
              </p>
            </div>

            <div className="table-controls">
              <div className="search-box">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search estimates..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                />
              </div>

              <select
                className="filter-select"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All statuses
                </option>

                {ESTIMATE_STATUSES.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {formatStatus(status)}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner" />

              <strong>
                Loading estimates...
              </strong>

              <p>
                Please wait.
              </p>
            </div>
          ) : filteredEstimates.length ===
            0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                ▤
              </div>

              <strong>
                {search ||
                statusFilter !== "all"
                  ? "No estimates found"
                  : "No estimates yet"}
              </strong>

              <p>
                {search ||
                statusFilter !== "all"
                  ? "Try changing your search or filters."
                  : "Create your first estimate to get started."}
              </p>

              {!search &&
                statusFilter === "all" && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      openAddModal
                    }
                  >
                    Create Estimate
                  </button>
                )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ESTIMATE</th>
                    <th>
                      CUSTOMER / LEAD
                    </th>
                    <th>STATUS</th>
                    <th>VALID UNTIL</th>
                    <th>AMOUNT</th>
                    <th>CREATED</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {filteredEstimates.map(
                    (estimate) => {
                      const customer =
                        customers.find(
                          (item) =>
                            item.id ===
                            estimate.customer_id
                        );

                      const lead =
                        leads.find(
                          (item) =>
                            item.id ===
                            estimate.lead_id
                        );

                      const contactName =
                        customer?.name ||
                        lead?.name ||
                        "No contact";

                      const contactType =
                        customer
                          ? "Customer"
                          : lead
                          ? "Lead"
                          : "No contact";

                      return (
                        <tr
                          key={
                            estimate.id
                          }
                        >
                          <td>
                            <div className="estimate-number">
                              {
                                estimate.estimate_number
                              }
                            </div>
                          </td>

                          <td>
                            <div className="contact-cell">
                              <div className="contact-avatar">
                                {getInitials(
                                  contactName
                                )}
                              </div>

                              <div>
                                <strong>
                                  {
                                    contactName
                                  }
                                </strong>

                                <span>
                                  {
                                    contactType
                                  }
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span
                              className={getStatusClass(
                                estimate.status
                              )}
                            >
                              {formatStatus(
                                estimate.status
                              )}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              estimate.valid_until
                            )}
                          </td>

                          <td>
                            <strong className="amount-cell">
                              {formatCurrency(
                                estimate.total
                              )}
                            </strong>
                          </td>

                          <td>
                            {formatDate(
                              estimate.created_at
                            )}
                          </td>

                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="table-action"
                                onClick={() =>
                                  openEditModal(
                                    estimate
                                  )
                                }
                                title="Edit"
                              >
                                ✎
                              </button>

                              <button
                                type="button"
                                className="table-action danger"
                                onClick={() =>
                                  handleDeleteEstimate(
                                    estimate
                                  )
                                }
                                title="Delete"
                              >
                                ×
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
        </div>
      </section>

      {showModal && (
        <div
          className="modal-backdrop"
          onMouseDown={closeModal}
        >
          <div
            className="modal-card estimate-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">
                  {editingEstimate
                    ? "UPDATE ESTIMATE"
                    : "NEW ESTIMATE"}
                </span>

                <h2>
                  {editingEstimate
                    ? "Edit Estimate"
                    : "Create Estimate"}
                </h2>

                <p>
                  Add the estimate details
                  below.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleSaveEstimate
              }
            >
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="estimate-number">
                      Estimate Number
                    </label>

                    <input
                      id="estimate-number"
                      type="text"
                      value={
                        form.estimate_number
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            estimate_number:
                              event.target
                                .value,
                          })
                        )
                      }
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="estimate-status">
                      Status
                    </label>

                    <select
                      id="estimate-status"
                      value={
                        form.status
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            status:
                              event.target
                                .value,
                          })
                        )
                      }
                    >
                      {ESTIMATE_STATUSES.map(
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

                  <div className="form-field">
                    <label htmlFor="estimate-customer">
                      Customer
                    </label>

                    <select
                      id="estimate-customer"
                      value={
                        form.customer_id
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            customer_id:
                              event.target
                                .value,
                          })
                        )
                      }
                    >
                      <option value="">
                        No customer selected
                      </option>

                      {customers.map(
                        (customer) => (
                          <option
                            key={
                              customer.id
                            }
                            value={
                              customer.id
                            }
                          >
                            {
                              customer.name
                            }
                          </option>
                        )
                      )}
                    </select>

                    {selectedCustomer && (
                      <span className="field-helper">
                        {selectedCustomer.email ||
                          selectedCustomer.phone ||
                          "Customer selected"}
                      </span>
                    )}
                  </div>

                  <div className="form-field">
                    <label htmlFor="estimate-lead">
                      Lead
                    </label>

                    <select
                      id="estimate-lead"
                      value={
                        form.lead_id
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            lead_id:
                              event.target
                                .value,
                          })
                        )
                      }
                    >
                      <option value="">
                        No lead selected
                      </option>

                      {leads.map(
                        (lead) => (
                          <option
                            key={lead.id}
                            value={lead.id}
                          >
                            {lead.name}
                          </option>
                        )
                      )}
                    </select>

                    {selectedLead && (
                      <span className="field-helper">
                        {selectedLead.email ||
                          selectedLead.phone ||
                          "Lead selected"}
                      </span>
                    )}
                  </div>

                  <div className="form-field">
                    <label htmlFor="estimate-subtotal">
                      Subtotal
                    </label>

                    <div className="input-prefix">
                      <span>$</span>

                      <input
                        id="estimate-subtotal"
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          form.subtotal
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              subtotal:
                                event.target
                                  .value,
                            })
                          )
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="estimate-tax">
                      Tax
                    </label>

                    <div className="input-prefix">
                      <span>$</span>

                      <input
                        id="estimate-tax"
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          form.tax
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              tax: event
                                .target
                                .value,
                            })
                          )
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="estimate-valid-until">
                      Valid Until
                    </label>

                    <input
                      id="estimate-valid-until"
                      type="date"
                      min={
                        getTodayString()
                      }
                      value={
                        form.valid_until
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            valid_until:
                              event.target
                                .value,
                          })
                        )
                      }
                    />
                  </div>
                </div>

                <div className="estimate-total-preview">
                  <div>
                    <span>
                      Subtotal
                    </span>

                    <strong>
                      {formatCurrency(
                        previewSubtotal
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Tax</span>

                    <strong>
                      {formatCurrency(
                        previewTax
                      )}
                    </strong>
                  </div>

                  <div className="estimate-total-row">
                    <span>Total</span>

                    <strong>
                      {formatCurrency(
                        previewTotal
                      )}
                    </strong>
                  </div>
                </div>

                <div className="form-field full-width">
                  <label htmlFor="estimate-notes">
                    Notes
                  </label>

                  <textarea
                    id="estimate-notes"
                    rows={4}
                    value={form.notes}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          notes:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="Add notes or additional details..."
                  />
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
                    : editingEstimate
                    ? "Save Changes"
                    : "Create Estimate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .estimates-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .page-heading-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
        }

        .page-eyebrow,
        .modal-eyebrow {
          margin: 0 0 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #64748b;
        }

        .page-heading-row h2 {
          margin: 0;
          font-size: 26px;
          line-height: 1.2;
          color: #0f172a;
        }

        .page-description {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .primary-button,
        .secondary-button {
          border: 0;
          border-radius: 10px;
          padding: 11px 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s ease;
          white-space: nowrap;
        }

        .primary-button {
          background: #0f172a;
          color: #ffffff;
        }

        .primary-button:hover {
          transform: translateY(-1px);
          opacity: 0.92;
        }

        .primary-button:disabled,
        .secondary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .secondary-button {
          background: #ffffff;
          color: #0f172a;
          border: 1px solid #e2e8f0;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 16px;
        }

        .stat-card {
          padding: 18px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 4px 16px
            rgba(15, 23, 42, 0.04);
        }

        .stat-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .stat-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #64748b;
        }

        .stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: #f1f5f9;
          color: #334155;
          font-size: 14px;
          font-weight: 800;
        }

        .stat-value {
          display: block;
          margin-top: 13px;
          font-size: 25px;
          line-height: 1.1;
          color: #0f172a;
        }

        .stat-helper {
          display: block;
          margin-top: 7px;
          font-size: 12px;
          color: #94a3b8;
        }

        .content-card {
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 4px 16px
            rgba(15, 23, 42, 0.04);
        }

        .content-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .content-card-header h3 {
          margin: 0;
          font-size: 16px;
          color: #0f172a;
        }

        .content-card-header p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 12px;
        }

        .table-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 230px;
          height: 38px;
          padding: 0 11px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: #ffffff;
        }

        .search-box span {
          color: #94a3b8;
          font-size: 17px;
        }

        .search-box input {
          width: 100%;
          border: 0;
          outline: 0;
          font-size: 13px;
          color: #0f172a;
          background: transparent;
        }

        .filter-select {
          height: 38px;
          padding: 0 10px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: #ffffff;
          color: #334155;
          font-size: 13px;
          outline: none;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 920px;
        }

        .data-table th {
          padding: 12px 20px;
          text-align: left;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }

        .data-table td {
          padding: 15px 20px;
          border-bottom: 1px solid #f1f5f9;
          color: #475569;
          font-size: 13px;
          vertical-align: middle;
        }

        .data-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .data-table tbody tr:hover {
          background: #fafcff;
        }

        .estimate-number {
          font-weight: 800;
          color: #0f172a;
        }

        .contact-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .contact-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          border-radius: 50%;
          background: #f1f5f9;
          color: #334155;
          font-size: 11px;
          font-weight: 800;
        }

        .contact-cell strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
        }

        .contact-cell span {
          display: block;
          margin-top: 2px;
          color: #94a3b8;
          font-size: 11px;
        }

        .estimate-status {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }

        .estimate-status.draft {
          background: #f1f5f9;
          color: #475569;
        }

        .estimate-status.sent {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .estimate-status.accepted {
          background: #ecfdf5;
          color: #047857;
        }

        .estimate-status.declined {
          background: #fef2f2;
          color: #b91c1c;
        }

        .estimate-status.expired {
          background: #fff7ed;
          color: #c2410c;
        }

        .amount-cell {
          color: #0f172a;
          font-size: 13px;
        }

        .row-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
        }

        .table-action {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 31px;
          height: 31px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          color: #475569;
          cursor: pointer;
          font-size: 14px;
        }

        .table-action:hover {
          background: #f8fafc;
        }

        .table-action.danger:hover {
          color: #dc2626;
          border-color: #fecaca;
          background: #fef2f2;
        }

        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          min-height: 300px;
          padding: 40px 20px;
          text-align: center;
        }

        .empty-state-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          margin-bottom: 14px;
          border-radius: 16px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 23px;
        }

        .empty-state strong {
          color: #0f172a;
          font-size: 15px;
        }

        .empty-state p {
          margin: 6px 0 17px;
          color: #94a3b8;
          font-size: 13px;
        }

        .loading-spinner {
          width: 30px;
          height: 30px;
          margin-bottom: 14px;
          border: 3px solid #e2e8f0;
          border-top-color: #334155;
          border-radius: 50%;
          animation: estimate-spin 0.8s
            linear infinite;
        }

        @keyframes estimate-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .modal-backdrop {
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
            0.48
          );
        }

        .modal-card {
          width: min(720px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 25px 70px
            rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 24px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 20px;
        }

        .modal-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
        }

        .modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 8px;
          background: #f8fafc;
          color: #64748b;
          cursor: pointer;
          font-size: 20px;
        }

        .modal-body {
          padding: 24px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 17px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-field label {
          color: #334155;
          font-size: 12px;
          font-weight: 700;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe3ec;
          border-radius: 9px;
          outline: none;
          background: #ffffff;
          color: #0f172a;
          font-family: inherit;
          font-size: 13px;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .form-field input,
        .form-field select {
          height: 42px;
          padding: 0 12px;
        }

        .form-field textarea {
          padding: 11px 12px;
          resize: vertical;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px
            rgba(
              148,
              163,
              184,
              0.12
            );
        }

        .field-helper {
          margin-top: -2px;
          color: #94a3b8;
          font-size: 11px;
        }

        .full-width {
          margin-top: 18px;
        }

        .input-prefix {
          position: relative;
        }

        .input-prefix span {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          font-size: 13px;
          pointer-events: none;
        }

        .input-prefix input {
          padding-left: 28px;
        }

        .estimate-total-preview {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 22px;
          padding: 17px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
        }

        .estimate-total-preview > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          color: #64748b;
          font-size: 13px;
        }

        .estimate-total-preview strong {
          color: #334155;
        }

        .estimate-total-row {
          margin-top: 3px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          color: #0f172a !important;
          font-size: 15px !important;
          font-weight: 800;
        }

        .estimate-total-row strong {
          color: #0f172a;
          font-size: 17px;
        }

        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 18px 24px;
          border-top: 1px solid #e2e8f0;
          background: #fafafa;
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 800px) {
          .page-heading-row,
          .content-card-header {
            align-items: stretch;
            flex-direction: column;
          }

          .table-controls {
            width: 100%;
          }

          .search-box {
            flex: 1;
            min-width: 0;
          }
        }

        @media (max-width: 650px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .modal-backdrop {
            padding: 10px;
          }

          .modal-card {
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

          .table-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-select {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}