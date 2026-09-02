"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Lead = {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  service: string | null;
  location: string | null;
  status: string;
  estimated_value: number | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type LeadForm = {
  name: string;
  email: string;
  phone: string;
  service: string;
  location: string;
  status: string;
  estimated_value: string;
  source: string;
  notes: string;
};

const emptyForm: LeadForm = {
  name: "",
  email: "",
  phone: "",
  service: "",
  location: "",
  status: "new",
  estimated_value: "",
  source: "",
  notes: "",
};

const statusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "contacted") return "status-contacted";
  if (normalized === "qualified") return "status-qualified";
  if (normalized === "proposal") return "status-proposal";
  if (normalized === "won") return "status-won";
  if (normalized === "lost") return "status-lost";

  return "status-new";
}

function statusLabel(status: string) {
  const option = statusOptions.find(
    (item) => item.value === status
  );

  return option?.label || status;
}

export default function LeadsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [leads, setLeads] = useState<Lead[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const [form, setForm] = useState<LeadForm>(emptyForm);

  useEffect(() => {
    loadLeads();
  }, []);

  async function getCompanyMembership() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      router.replace("/login");
      return null;
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

    return {
      user,
      companyId: membership.company_id,
    };
  }

  async function loadLeads() {
    setLoading(true);
    setPageError("");

    try {
      const membership = await getCompanyMembership();

      if (!membership) return;

      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("company_id", membership.companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setLeads((data ?? []) as Lead[]);
    } catch (err) {
      console.error("LOAD LEADS ERROR:", err);

      setPageError(
        err instanceof Error
          ? err.message
          : "Failed to load leads."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesStatus =
        statusFilter === "all" ||
        lead.status.toLowerCase() === statusFilter;

      if (!matchesStatus) return false;

      if (!query) return true;

      const searchableValues = [
        lead.name,
        lead.email,
        lead.phone,
        lead.service,
        lead.location,
        lead.source,
        lead.status,
      ];

      return searchableValues
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        );
    });
  }, [leads, search, statusFilter]);

  const pipelineValue = useMemo(() => {
    return filteredLeads
      .filter(
        (lead) =>
          lead.status !== "won" &&
          lead.status !== "lost"
      )
      .reduce(
        (total, lead) =>
          total + Number(lead.estimated_value || 0),
        0
      );
  }, [filteredLeads]);

  function openAddModal() {
    setEditingLead(null);
    setForm(emptyForm);
    setModalError("");
    setModalOpen(true);
  }

  function openEditModal(lead: Lead) {
    setEditingLead(lead);

    setForm({
      name: lead.name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      service: lead.service || "",
      location: lead.location || "",
      status: lead.status || "new",
      estimated_value:
        lead.estimated_value !== null
          ? String(lead.estimated_value)
          : "",
      source: lead.source || "",
      notes: lead.notes || "",
    });

    setModalError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingLead(null);
    setForm(emptyForm);
    setModalError("");
  }

  function updateField(
    field: keyof LeadForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setModalError("");
    setPageError("");

    if (!form.name.trim()) {
      setModalError("Lead name is required.");
      return;
    }

    setSaving(true);

    try {
      const membership = await getCompanyMembership();

      if (!membership) return;

      const estimatedValue =
        form.estimated_value.trim() === ""
          ? null
          : Number(form.estimated_value);

      if (
        estimatedValue !== null &&
        Number.isNaN(estimatedValue)
      ) {
        setModalError(
          "Estimated value must be a valid number."
        );
        return;
      }

      const leadData = {
        company_id: membership.companyId,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        service: form.service.trim() || null,
        location: form.location.trim() || null,
        status: form.status,
        estimated_value: estimatedValue,
        source: form.source.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingLead) {
        const { data, error } = await supabase
          .from("leads")
          .update(leadData)
          .eq("id", editingLead.id)
          .eq("company_id", membership.companyId)
          .select("*")
          .single();

        if (error) throw error;

        setLeads((current) =>
          current.map((lead) =>
            lead.id === editingLead.id
              ? (data as Lead)
              : lead
          )
        );
      } else {
        const { data, error } = await supabase
          .from("leads")
          .insert(leadData)
          .select("*")
          .single();

        if (error) throw error;

        setLeads((current) => [
          data as Lead,
          ...current,
        ]);
      }

      closeModal();
    } catch (err) {
      console.error("SAVE LEAD ERROR:", err);

      const supabaseError = err as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };

      setModalError(
        [
          supabaseError.code
            ? `Code: ${supabaseError.code}`
            : "",
          supabaseError.message
            ? `Message: ${supabaseError.message}`
            : "",
          supabaseError.details
            ? `Details: ${supabaseError.details}`
            : "",
          supabaseError.hint
            ? `Hint: ${supabaseError.hint}`
            : "",
        ]
          .filter(Boolean)
          .join(" | ") || "Failed to save lead."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead(lead: Lead) {
    const confirmed = window.confirm(
      `Delete ${lead.name}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setPageError("");

    try {
      const membership = await getCompanyMembership();

      if (!membership) return;

      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", lead.id)
        .eq("company_id", membership.companyId);

      if (error) throw error;

      setLeads((current) =>
        current.filter((item) => item.id !== lead.id)
      );
    } catch (err) {
      console.error("DELETE LEAD ERROR:", err);

      setPageError(
        err instanceof Error
          ? err.message
          : "Failed to delete lead."
      );
    }
  }

  async function convertToCustomer(lead: Lead) {
    const confirmed = window.confirm(
      `Convert ${lead.name} into a customer?`
    );

    if (!confirmed) return;

    setPageError("");

    try {
      const membership = await getCompanyMembership();

      if (!membership) return;

      const { data: existingCustomer, error: existingError } =
        await supabase
          .from("customers")
          .select("id")
          .eq("company_id", membership.companyId)
          .eq("name", lead.name)
          .limit(1)
          .maybeSingle();

      if (existingError) throw existingError;

      if (existingCustomer) {
        throw new Error(
          "A customer with this name already exists."
        );
      }

      const { error: customerError } = await supabase
        .from("customers")
        .insert({
          company_id: membership.companyId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          address_line1: lead.location,
          notes: lead.notes,
        });

      if (customerError) throw customerError;

      const { data: updatedLead, error: leadError } =
        await supabase
          .from("leads")
          .update({
            status: "won",
          })
          .eq("id", lead.id)
          .eq("company_id", membership.companyId)
          .select("*")
          .single();

      if (leadError) throw leadError;

      setLeads((current) =>
        current.map((item) =>
          item.id === lead.id
            ? (updatedLead as Lead)
            : item
        )
      );

      alert(
        `${lead.name} has been converted to a customer.`
      );
    } catch (err) {
      console.error("CONVERT LEAD ERROR:", err);

      setPageError(
        err instanceof Error
          ? err.message
          : "Failed to convert lead."
      );
    }
  }

  return (
    <AppShell
      title="Leads"
      description="Track prospects and move them through your sales pipeline."
      actions={
        <button
          className="sbs-primary-button"
          onClick={openAddModal}
        >
          <span className="sbs-button-plus">+</span>
          Add Lead
        </button>
      }
    >
      <div className="leads-page">
        {pageError && (
          <div className="sbs-error-banner">
            {pageError}
          </div>
        )}

        <div className="leads-stats-grid">
          <div className="leads-stat-card">
            <div className="leads-stat-label">
              TOTAL LEADS
            </div>

            <div className="leads-stat-value">
              {leads.length}
            </div>

            <div className="leads-stat-description">
              All leads in your pipeline
            </div>
          </div>

          <div className="leads-stat-card">
            <div className="leads-stat-label">
              NEW
            </div>

            <div className="leads-stat-value">
              {
                leads.filter(
                  (lead) => lead.status === "new"
                ).length
              }
            </div>

            <div className="leads-stat-description">
              Fresh opportunities
            </div>
          </div>

          <div className="leads-stat-card">
            <div className="leads-stat-label">
              QUALIFIED
            </div>

            <div className="leads-stat-value">
              {
                leads.filter(
                  (lead) =>
                    lead.status === "qualified"
                ).length
              }
            </div>

            <div className="leads-stat-description">
              Qualified prospects
            </div>
          </div>

          <div className="leads-stat-card">
            <div className="leads-stat-label">
              PIPELINE VALUE
            </div>

            <div className="leads-stat-value">
              {formatCurrency(pipelineValue)}
            </div>

            <div className="leads-stat-description">
              Active opportunity value
            </div>
          </div>
        </div>

        <section className="sbs-card leads-card">
          <div className="leads-toolbar">
            <div className="leads-search">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>

              <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <select
              className="sbs-select"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">
                All statuses
              </option>

              {statusOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>

            <div className="leads-result-count">
              {filteredLeads.length} lead
              {filteredLeads.length === 1
                ? ""
                : "s"}
            </div>
          </div>

          {loading ? (
            <div className="sbs-empty-state">
              <div className="sbs-spinner" />

              <h3>Loading leads...</h3>

              <p>
                Getting your lead data from the database.
              </p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="sbs-empty-state">
              <div className="sbs-empty-icon">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="7" r="4" />
                  <path d="M2 21v-2a7 7 0 0 1 14 0v2" />
                  <path d="M16 11h6" />
                </svg>
              </div>

              <h3>
                {search || statusFilter !== "all"
                  ? "No leads found"
                  : "No leads yet"}
              </h3>

              <p>
                {search || statusFilter !== "all"
                  ? "Try changing your search or status filter."
                  : "Add your first lead to start building your sales pipeline."}
              </p>

              {!search &&
                statusFilter === "all" && (
                  <button
                    className="sbs-primary-button"
                    onClick={openAddModal}
                  >
                    <span className="sbs-button-plus">+</span>
                    Add Lead
                  </button>
                )}
            </div>
          ) : (
            <div className="leads-table-scroll">
              <table className="leads-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Service</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Est. Value</th>
                    <th>Source</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <div className="lead-name">
                          {lead.name}
                        </div>

                        {(lead.email ||
                          lead.phone) && (
                          <div className="lead-contact">
                            {lead.email ||
                              lead.phone}
                          </div>
                        )}
                      </td>

                      <td>
                        {lead.service || "—"}
                      </td>

                      <td>
                        {lead.location || "—"}
                      </td>

                      <td>
                        <span
                          className={`lead-status ${statusClass(
                            lead.status
                          )}`}
                        >
                          {statusLabel(
                            lead.status
                          )}
                        </span>
                      </td>

                      <td className="lead-value">
                        {formatCurrency(
                          lead.estimated_value
                        )}
                      </td>

                      <td>
                        {lead.source || "—"}
                      </td>

                      <td>
                        {formatDate(
                          lead.created_at
                        )}
                      </td>

                      <td>
                        <div className="lead-actions">
                          <button
                            className="sbs-action-button"
                            onClick={() =>
                              openEditModal(lead)
                            }
                          >
                            Edit
                          </button>

                          {lead.status !==
                            "won" && (
                            <button
                              className="sbs-action-button"
                              onClick={() =>
                                convertToCustomer(
                                  lead
                                )
                              }
                            >
                              Convert
                            </button>
                          )}

                          <button
                            className="sbs-action-button sbs-action-danger"
                            onClick={() =>
                              deleteLead(lead)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {modalOpen && (
          <div
            className="sbs-modal-overlay"
            onMouseDown={closeModal}
          >
            <div
              className="sbs-modal leads-modal"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="sbs-modal-header">
                <div>
                  <div className="sbs-eyebrow">
                    {editingLead
                      ? "LEAD"
                      : "NEW LEAD"}
                  </div>

                  <h2>
                    {editingLead
                      ? "Edit Lead"
                      : "Add Lead"}
                  </h2>
                </div>

                <button
                  className="sbs-modal-close"
                  onClick={closeModal}
                  disabled={saving}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {modalError && (
                  <div className="sbs-error-banner sbs-modal-error">
                    {modalError}
                  </div>
                )}

                <div className="leads-form-grid">
                  <label className="sbs-form-field">
                    <span>Lead Name *</span>

                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        updateField(
                          "name",
                          event.target.value
                        )
                      }
                      placeholder="John Smith"
                      required
                    />
                  </label>

                  <label className="sbs-form-field">
                    <span>Service</span>

                    <input
                      type="text"
                      value={form.service}
                      onChange={(event) =>
                        updateField(
                          "service",
                          event.target.value
                        )
                      }
                      placeholder="Roof replacement"
                    />
                  </label>

                  <label className="sbs-form-field">
                    <span>Email</span>

                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField(
                          "email",
                          event.target.value
                        )
                      }
                      placeholder="john@example.com"
                    />
                  </label>

                  <label className="sbs-form-field">
                    <span>Phone</span>

                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        updateField(
                          "phone",
                          event.target.value
                        )
                      }
                      placeholder="(214) 555-0123"
                    />
                  </label>

                  <label className="sbs-form-field">
                    <span>Location</span>

                    <input
                      type="text"
                      value={form.location}
                      onChange={(event) =>
                        updateField(
                          "location",
                          event.target.value
                        )
                      }
                      placeholder="Dallas, TX"
                    />
                  </label>

                  <label className="sbs-form-field">
                    <span>Status</span>

                    <select
                      value={form.status}
                      onChange={(event) =>
                        updateField(
                          "status",
                          event.target.value
                        )
                      }
                    >
                      {statusOptions.map(
                        (option) => (
                          <option
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="sbs-form-field">
                    <span>
                      Estimated Value
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.estimated_value
                      }
                      onChange={(event) =>
                        updateField(
                          "estimated_value",
                          event.target.value
                        )
                      }
                      placeholder="15000"
                    />
                  </label>

                  <label className="sbs-form-field">
                    <span>Lead Source</span>

                    <input
                      type="text"
                      value={form.source}
                      onChange={(event) =>
                        updateField(
                          "source",
                          event.target.value
                        )
                      }
                      placeholder="Google, referral, website..."
                    />
                  </label>

                  <label className="sbs-form-field sbs-form-full">
                    <span>Notes</span>

                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        updateField(
                          "notes",
                          event.target.value
                        )
                      }
                      placeholder="Additional information about this lead..."
                      rows={4}
                    />
                  </label>
                </div>

                <div className="sbs-modal-actions">
                  <button
                    type="button"
                    className="sbs-secondary-button"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="sbs-primary-button"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : editingLead
                        ? "Save Changes"
                        : "Add Lead"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .leads-page {
          width: 100%;
        }

        .leads-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .leads-stat-card {
          min-width: 0;
          padding: 18px 20px;
          background: #fff;
          border: 1px solid var(--sbs-border);
          border-radius: var(--sbs-radius);
          box-shadow: var(--sbs-shadow-sm);
        }

        .leads-stat-label {
          color: var(--sbs-text-muted);
          font-size: 9px;
          line-height: 14px;
          font-weight: 750;
          letter-spacing: 0.08em;
        }

        .leads-stat-value {
          margin-top: 8px;
          color: var(--sbs-text);
          font-size: 25px;
          line-height: 31px;
          font-weight: 760;
          letter-spacing: -0.025em;
          overflow-wrap: anywhere;
        }

        .leads-stat-description {
          margin-top: 5px;
          color: var(--sbs-text-muted);
          font-size: 11px;
          line-height: 16px;
        }

        .sbs-card {
          background: #fff;
          border: 1px solid var(--sbs-border);
          border-radius: var(--sbs-radius);
          box-shadow: var(--sbs-shadow-sm);
        }

        .leads-card {
          overflow: hidden;
        }

        .leads-toolbar {
          min-height: 70px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--sbs-border);
        }

        .leads-search {
          width: min(100%, 350px);
          height: 39px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          border: 1px solid var(--sbs-border);
          border-radius: 9px;
          background: var(--sbs-surface-soft);
          color: var(--sbs-text-muted);
        }

        .leads-search:focus-within {
          border-color: var(--sbs-border-strong);
          background: #fff;
          box-shadow: 0 0 0 3px rgba(23, 32, 51, 0.045);
        }

        .leads-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--sbs-text);
          font: inherit;
          font-size: 12px;
        }

        .leads-search input::placeholder {
          color: var(--sbs-text-muted);
        }

        .sbs-select {
          height: 39px;
          min-width: 145px;
          padding: 0 32px 0 11px;
          border: 1px solid var(--sbs-border);
          border-radius: 9px;
          background: #fff;
          color: var(--sbs-text-soft);
          font: inherit;
          font-size: 11px;
          outline: 0;
        }

        .sbs-select:focus {
          border-color: var(--sbs-border-strong);
          box-shadow: 0 0 0 3px rgba(23, 32, 51, 0.045);
        }

        .leads-result-count {
          margin-left: auto;
          color: var(--sbs-text-muted);
          font-size: 11px;
          white-space: nowrap;
        }

        .sbs-primary-button,
        .sbs-secondary-button {
          height: 39px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 9px;
          padding: 0 14px;
          font: inherit;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
          transition:
            background 150ms ease,
            border-color 150ms ease,
            color 150ms ease,
            transform 100ms ease;
        }

        .sbs-primary-button {
          border: 1px solid var(--sbs-primary);
          background: var(--sbs-primary);
          color: #fff;
        }

        .sbs-primary-button:hover {
          background: var(--sbs-primary-hover);
          border-color: var(--sbs-primary-hover);
        }

        .sbs-primary-button:active {
          transform: translateY(1px);
        }

        .sbs-primary-button:disabled,
        .sbs-secondary-button:disabled,
        .sbs-action-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .sbs-secondary-button {
          border: 1px solid var(--sbs-border);
          background: #fff;
          color: var(--sbs-text-soft);
        }

        .sbs-secondary-button:hover {
          background: var(--sbs-surface-soft);
          border-color: var(--sbs-border-strong);
          color: var(--sbs-text);
        }

        .sbs-button-plus {
          font-size: 16px;
          line-height: 1;
          font-weight: 400;
          margin-top: -1px;
        }

        .sbs-error-banner {
          margin-bottom: 16px;
          padding: 11px 13px;
          border: 1px solid #f2c6c2;
          border-radius: 9px;
          background: #fff6f5;
          color: var(--sbs-danger);
          font-size: 12px;
          line-height: 18px;
        }

        .leads-table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .leads-table {
          width: 100%;
          min-width: 1000px;
          border-collapse: collapse;
        }

        .leads-table th {
          height: 45px;
          padding: 0 15px;
          border-bottom: 1px solid var(--sbs-border);
          background: var(--sbs-surface-soft);
          color: var(--sbs-text-muted);
          font-size: 9px;
          line-height: 14px;
          font-weight: 750;
          letter-spacing: 0.055em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .leads-table td {
          height: 68px;
          padding: 10px 15px;
          border-bottom: 1px solid var(--sbs-border);
          color: var(--sbs-text-soft);
          font-size: 11px;
          line-height: 17px;
          vertical-align: middle;
        }

        .leads-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .leads-table tbody tr:hover {
          background: #fbfcfd;
        }

        .lead-name {
          color: var(--sbs-text);
          font-size: 12px;
          line-height: 17px;
          font-weight: 650;
          white-space: nowrap;
        }

        .lead-contact {
          margin-top: 2px;
          color: var(--sbs-text-muted);
          font-size: 10px;
          line-height: 15px;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .lead-value {
          color: var(--sbs-text) !important;
          font-weight: 650;
          white-space: nowrap;
        }

        .lead-status {
          display: inline-flex;
          align-items: center;
          min-height: 25px;
          padding: 3px 8px;
          border: 1px solid transparent;
          border-radius: 999px;
          font-size: 9px;
          line-height: 14px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-new {
          background: #f1f5f9;
          border-color: #e2e8f0;
          color: #475569;
        }

        .status-contacted {
          background: #eff6ff;
          border-color: #dbeafe;
          color: #1d4ed8;
        }

        .status-qualified {
          background: #f5f3ff;
          border-color: #e9d5ff;
          color: #6d28d9;
        }

        .status-proposal {
          background: #fff7ed;
          border-color: #fed7aa;
          color: #c2410c;
        }

        .status-won {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #15803d;
        }

        .status-lost {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .lead-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .sbs-action-button {
          height: 29px;
          padding: 0 8px;
          border: 1px solid var(--sbs-border);
          border-radius: 7px;
          background: #fff;
          color: var(--sbs-text-soft);
          font: inherit;
          font-size: 9px;
          font-weight: 650;
          cursor: pointer;
          white-space: nowrap;
          transition:
            background 150ms ease,
            border-color 150ms ease,
            color 150ms ease;
        }

        .sbs-action-button:hover {
          background: var(--sbs-surface-soft);
          border-color: var(--sbs-border-strong);
          color: var(--sbs-text);
        }

        .sbs-action-button.sbs-action-danger:hover {
          background: #fff5f4;
          border-color: #f2c6c2;
          color: var(--sbs-danger);
        }

        .sbs-empty-state {
          min-height: 310px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .sbs-empty-state h3 {
          margin: 13px 0 0;
          color: var(--sbs-text);
          font-size: 14px;
          line-height: 20px;
          font-weight: 700;
        }

        .sbs-empty-state p {
          max-width: 390px;
          margin: 5px 0 18px;
          color: var(--sbs-text-muted);
          font-size: 11px;
          line-height: 17px;
        }

        .sbs-empty-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: var(--sbs-primary-soft);
          color: var(--sbs-primary);
        }

        .sbs-spinner {
          width: 26px;
          height: 26px;
          border: 2px solid #e3e8ee;
          border-top-color: var(--sbs-primary);
          border-radius: 50%;
          animation: sbs-spin 0.75s linear infinite;
        }

        @keyframes sbs-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .sbs-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.42);
          backdrop-filter: blur(3px);
        }

        .sbs-modal {
          width: min(100%, 720px);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: #fff;
          border: 1px solid var(--sbs-border);
          border-radius: 16px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.2);
        }

        .sbs-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 21px 22px 18px;
          border-bottom: 1px solid var(--sbs-border);
        }

        .sbs-eyebrow {
          color: var(--sbs-text-muted);
          font-size: 9px;
          line-height: 13px;
          font-weight: 750;
          letter-spacing: 0.08em;
        }

        .sbs-modal-header h2 {
          margin: 3px 0 0;
          color: var(--sbs-text);
          font-size: 19px;
          line-height: 25px;
          font-weight: 750;
        }

        .sbs-modal-close {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--sbs-text-muted);
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }

        .sbs-modal-close:hover {
          background: var(--sbs-surface-soft);
          color: var(--sbs-text);
        }

        .sbs-modal-error {
          margin: 18px 22px 0;
        }

        .leads-modal form {
          padding: 22px;
        }

        .leads-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .sbs-form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .sbs-form-field > span {
          color: var(--sbs-text);
          font-size: 11px;
          line-height: 16px;
          font-weight: 650;
        }

        .sbs-form-field input,
        .sbs-form-field select,
        .sbs-form-field textarea {
          width: 100%;
          border: 1px solid var(--sbs-border);
          border-radius: 8px;
          outline: 0;
          background: #fff;
          color: var(--sbs-text);
          font: inherit;
          font-size: 12px;
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease;
        }

        .sbs-form-field input,
        .sbs-form-field select {
          height: 40px;
          padding: 0 11px;
        }

        .sbs-form-field textarea {
          min-height: 96px;
          padding: 10px 11px;
          resize: vertical;
          line-height: 18px;
        }

        .sbs-form-field input:focus,
        .sbs-form-field select:focus,
        .sbs-form-field textarea:focus {
          border-color: var(--sbs-border-strong);
          box-shadow: 0 0 0 3px rgba(23, 32, 51, 0.045);
        }

        .sbs-form-field input::placeholder,
        .sbs-form-field textarea::placeholder {
          color: #a0a9b4;
        }

        .sbs-form-full {
          grid-column: 1 / -1;
        }

        .sbs-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid var(--sbs-border);
        }

        @media (max-width: 1100px) {
          .leads-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .leads-stats-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .leads-stat-card {
            padding: 16px;
          }

          .leads-toolbar {
            align-items: stretch;
            flex-wrap: wrap;
          }

          .leads-search {
            width: 100%;
          }

          .sbs-select {
            flex: 1;
          }

          .leads-result-count {
            margin-left: 0;
            display: flex;
            align-items: center;
          }

          .leads-form-grid {
            grid-template-columns: 1fr;
          }

          .sbs-form-full {
            grid-column: auto;
          }

          .sbs-modal-overlay {
            align-items: flex-end;
            padding: 0;
          }

          .sbs-modal {
            width: 100%;
            max-height: 94vh;
            border-radius: 16px 16px 0 0;
          }

          .sbs-modal-header {
            padding: 18px;
          }

          .leads-modal form {
            padding: 18px;
          }

          .sbs-modal-actions {
            position: sticky;
            bottom: 0;
            margin-left: -18px;
            margin-right: -18px;
            margin-bottom: -18px;
            padding: 14px 18px;
            background: #fff;
          }

          .sbs-modal-actions button {
            flex: 1;
          }
        }

        @media (max-width: 430px) {
          .leads-toolbar {
            padding: 12px;
          }

          .sbs-action-button {
            padding: 0 7px;
          }
        }
      `}</style>
    </AppShell>
  );
}