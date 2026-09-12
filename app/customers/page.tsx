"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  notes: string;
};

type SupabaseError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

const emptyForm: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  notes: "",
};

function formatDate(value: string) {
  if (!value) return "—";

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getCustomerLocation(customer: Customer) {
  return [
    customer.city,
    customer.state,
    customer.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function CustomersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);

  const [form, setForm] = useState<CustomerForm>(emptyForm);

  const getCompanyMembership = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return null;
    }

    const { data, error } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data?.company_id) {
      throw new Error("No company workspace is assigned to this account.");
    }

    return data.company_id as string;
  }, [router, supabase]);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setPageError("");

      const companyId = await getCompanyMembership();

      if (!companyId) {
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .select(
          `
            id,
            company_id,
            name,
            email,
            phone,
            address_line1,
            address_line2,
            city,
            state,
            postal_code,
            notes,
            created_at,
            updated_at
          `,
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setCustomers((data ?? []) as Customer[]);
    } catch (error) {
      const supabaseError = error as SupabaseError;

      setPageError(
        supabaseError.message ||
          "Unable to load customers. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [getCompanyMembership, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomers();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadCustomers]);

  useEffect(() => {
    if (!successMessage) return;

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [successMessage]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return customers;
    }

    return customers.filter((customer) => {
      const haystack = [
        customer.name,
        customer.email,
        customer.phone,
        customer.address_line1,
        customer.address_line2,
        customer.city,
        customer.state,
        customer.postal_code,
        customer.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [customers, search]);

  const totalCustomers = customers.length;

  const customersWithEmail = useMemo(
    () => customers.filter((customer) => customer.email).length,
    [customers],
  );

  const customersWithPhone = useMemo(
    () => customers.filter((customer) => customer.phone).length,
    [customers],
  );

  const openAddModal = () => {
    setEditingCustomer(null);
    setForm(emptyForm);
    setPageError("");
    setModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);

    setForm({
      name: customer.name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address_line1: customer.address_line1 ?? "",
      address_line2: customer.address_line2 ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      postal_code: customer.postal_code ?? "",
      notes: customer.notes ?? "",
    });

    setPageError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingCustomer(null);
    setForm(emptyForm);
  };

  const openCustomer360 = (customerId: string) => {
    router.push(`/customers/${customerId}`);
  };

  const handleFieldChange = (
    field: keyof CustomerForm,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setPageError("Customer name is required.");
      return;
    }

    try {
      setSaving(true);
      setPageError("");
      setSuccessMessage("");

      const companyId = await getCompanyMembership();

      if (!companyId) {
        return;
      }

      const payload = {
        company_id: companyId,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postal_code: form.postal_code.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", editingCustomer.id)
          .eq("company_id", companyId);

        if (error) {
          throw error;
        }

        setSuccessMessage("Customer updated successfully.");
      } else {
        const { error } = await supabase
          .from("customers")
          .insert(payload);

        if (error) {
          throw error;
        }

        setSuccessMessage("Customer added successfully.");
      }

      setModalOpen(false);
      setEditingCustomer(null);
      setForm(emptyForm);

      await loadCustomers();
    } catch (error) {
      const supabaseError = error as SupabaseError;

      setPageError(
        supabaseError.message ||
          "Unable to save the customer. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = window.confirm(
      `Delete ${customer.name}? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(customer.id);
      setPageError("");
      setSuccessMessage("");

      const companyId = await getCompanyMembership();

      if (!companyId) {
        return;
      }

      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customer.id)
        .eq("company_id", companyId);

      if (error) {
        throw error;
      }

      setCustomers((current) =>
        current.filter((item) => item.id !== customer.id),
      );

      setSuccessMessage("Customer deleted successfully.");
    } catch (error) {
      const supabaseError = error as SupabaseError;

      setPageError(
        supabaseError.message ||
          "Unable to delete the customer. Please try again.",
      );
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AppShell>
      <div className="customers-page">
        <header className="customers-header">
          <div>
            <div className="customers-eyebrow">
              CUSTOMER MANAGEMENT
            </div>

            <h1>Customers</h1>

            <p>
              Manage your customer accounts, contacts, and business
              relationships.
            </p>
          </div>

          <button
            type="button"
            className="customers-primary-button"
            onClick={openAddModal}
          >
            <span className="customers-plus">+</span>
            Add Customer
          </button>
        </header>

        {pageError && (
          <div className="customers-alert customers-alert-error">
            <div className="customers-alert-icon">!</div>

            <div>
              <strong>Something went wrong</strong>
              <span>{pageError}</span>
            </div>

            <button
              type="button"
              onClick={() => setPageError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="customers-alert customers-alert-success">
            <div className="customers-success-icon">✓</div>

            <div>
              <strong>Success</strong>
              <span>{successMessage}</span>
            </div>

            <button
              type="button"
              onClick={() => setSuccessMessage("")}
              aria-label="Dismiss success message"
            >
              ×
            </button>
          </div>
        )}

        <section className="customers-stats">
          <div className="customer-stat-card">
            <div className="customer-stat-top">
              <span>Total Customers</span>
              <div className="customer-stat-icon">C</div>
            </div>

            <strong>{totalCustomers}</strong>

            <small>Customer accounts in your workspace</small>
          </div>

          <div className="customer-stat-card">
            <div className="customer-stat-top">
              <span>Email Contacts</span>
              <div className="customer-stat-icon">@</div>
            </div>

            <strong>{customersWithEmail}</strong>

            <small>Customers with an email address</small>
          </div>

          <div className="customer-stat-card">
            <div className="customer-stat-top">
              <span>Phone Contacts</span>
              <div className="customer-stat-icon">☎</div>
            </div>

            <strong>{customersWithPhone}</strong>

            <small>Customers with a phone number</small>
          </div>
        </section>

        <section className="customers-panel">
          <div className="customers-toolbar">
            <div>
              <h2>Customer Accounts</h2>

              <p>
                {search
                  ? `${filteredCustomers.length} matching customer${
                      filteredCustomers.length === 1 ? "" : "s"
                    }`
                  : `${customers.length} customer${
                      customers.length === 1 ? "" : "s"
                    }`}
              </p>
            </div>

            <div className="customers-search">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="customers-search-icon"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="6.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="m16 16 4.2 4.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customers..."
                aria-label="Search customers"
              />

              {search && (
                <button
                  type="button"
                  className="customers-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="customers-loading">
              <div className="customers-spinner" />

              <strong>Loading customers</strong>

              <span>
                Getting the latest customer accounts from your workspace.
              </span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="customers-empty">
              <div className="customers-empty-icon">C</div>

              <h3>
                {search
                  ? "No customers found"
                  : "No customers yet"}
              </h3>

              <p>
                {search
                  ? "Try a different search term or clear the search."
                  : "Add your first customer to start building your customer database."}
              </p>

              {search ? (
                <button
                  type="button"
                  className="customers-secondary-button"
                  onClick={() => setSearch("")}
                >
                  Clear Search
                </button>
              ) : (
                <button
                  type="button"
                  className="customers-primary-button"
                  onClick={openAddModal}
                >
                  <span className="customers-plus">+</span>
                  Add Customer
                </button>
              )}
            </div>
          ) : (
            <div className="customers-table-wrap">
              <table className="customers-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Location</th>
                    <th>Added</th>
                    <th className="customers-actions-heading">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="customer-row-clickable"
                      onClick={() => openCustomer360(customer.id)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" ||
                          event.key === " "
                        ) {
                          event.preventDefault();
                          openCustomer360(customer.id);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open Customer 360 for ${customer.name}`}
                    >
                      <td>
                        <div className="customer-identity">
                          <div className="customer-avatar">
                            {getInitials(customer.name)}
                          </div>

                          <div className="customer-name-block">
                            <strong>{customer.name}</strong>

                            <span className="customer-open-hint">
                              View Customer 360 →
                            </span>

                            {customer.notes ? (
                              <span className="customer-note-preview">
                                {customer.notes}
                              </span>
                            ) : (
                              <span className="customer-id">
                                Customer account
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="customer-contact">
                          {customer.email ? (
                            <span>{customer.email}</span>
                          ) : (
                            <span className="customer-muted">
                              No email
                            </span>
                          )}

                          {customer.phone ? (
                            <span>{customer.phone}</span>
                          ) : (
                            <span className="customer-muted">
                              No phone
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="customer-location">
                          {getCustomerLocation(customer) ||
                            "No location"}
                        </span>
                      </td>

                      <td>
                        <span className="customer-date">
                          {formatDate(customer.created_at)}
                        </span>
                      </td>

                      <td>
                        <div
                          className="customer-row-actions"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <button
                            type="button"
                            className="customer-view-button"
                            onClick={() =>
                              openCustomer360(customer.id)
                            }
                          >
                            View
                          </button>

                          <button
                            type="button"
                            className="customer-action-button"
                            onClick={() =>
                              openEditModal(customer)
                            }
                            aria-label={`Edit ${customer.name}`}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="customer-action-button customer-delete-button"
                            onClick={() =>
                              void handleDelete(customer)
                            }
                            disabled={deleting === customer.id}
                            aria-label={`Delete ${customer.name}`}
                          >
                            {deleting === customer.id
                              ? "Deleting..."
                              : "Delete"}
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
      </div>

      {modalOpen && (
        <div
          className="customer-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="customer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-modal-title"
          >
            <div className="customer-modal-header">
              <div>
                <div className="customer-modal-eyebrow">
                  {editingCustomer
                    ? "CUSTOMER ACCOUNT"
                    : "NEW CUSTOMER"}
                </div>

                <h2 id="customer-modal-title">
                  {editingCustomer
                    ? "Edit Customer"
                    : "Add Customer"}
                </h2>

                <p>
                  {editingCustomer
                    ? "Update this customer's account information."
                    : "Create a new customer account for your workspace."}
                </p>
              </div>

              <button
                type="button"
                className="customer-modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close customer form"
              >
                ×
              </button>
            </div>

            <form
              className="customer-form"
              onSubmit={handleSubmit}
            >
              <div className="customer-form-section">
                <div className="customer-form-section-title">
                  Basic Information
                </div>

                <div className="customer-form-grid">
                  <label className="customer-field customer-field-full">
                    <span>
                      Customer Name <b>*</b>
                    </span>

                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        handleFieldChange(
                          "name",
                          event.target.value,
                        )
                      }
                      placeholder="e.g. ABC Computers LLC"
                      autoFocus
                      required
                    />
                  </label>

                  <label className="customer-field">
                    <span>Email Address</span>

                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        handleFieldChange(
                          "email",
                          event.target.value,
                        )
                      }
                      placeholder="customer@example.com"
                    />
                  </label>

                  <label className="customer-field">
                    <span>Phone Number</span>

                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        handleFieldChange(
                          "phone",
                          event.target.value,
                        )
                      }
                      placeholder="+1 555 000 0000"
                    />
                  </label>
                </div>
              </div>

              <div className="customer-form-section">
                <div className="customer-form-section-title">
                  Address
                </div>

                <div className="customer-form-grid">
                  <label className="customer-field customer-field-full">
                    <span>Address Line 1</span>

                    <input
                      type="text"
                      value={form.address_line1}
                      onChange={(event) =>
                        handleFieldChange(
                          "address_line1",
                          event.target.value,
                        )
                      }
                      placeholder="Street address"
                    />
                  </label>

                  <label className="customer-field customer-field-full">
                    <span>Address Line 2</span>

                    <input
                      type="text"
                      value={form.address_line2}
                      onChange={(event) =>
                        handleFieldChange(
                          "address_line2",
                          event.target.value,
                        )
                      }
                      placeholder="Suite, unit, building, etc."
                    />
                  </label>

                  <label className="customer-field">
                    <span>City</span>

                    <input
                      type="text"
                      value={form.city}
                      onChange={(event) =>
                        handleFieldChange(
                          "city",
                          event.target.value,
                        )
                      }
                      placeholder="City"
                    />
                  </label>

                  <label className="customer-field">
                    <span>State / Region</span>

                    <input
                      type="text"
                      value={form.state}
                      onChange={(event) =>
                        handleFieldChange(
                          "state",
                          event.target.value,
                        )
                      }
                      placeholder="State"
                    />
                  </label>

                  <label className="customer-field">
                    <span>Postal Code</span>

                    <input
                      type="text"
                      value={form.postal_code}
                      onChange={(event) =>
                        handleFieldChange(
                          "postal_code",
                          event.target.value,
                        )
                      }
                      placeholder="Postal code"
                    />
                  </label>
                </div>
              </div>

              <div className="customer-form-section">
                <div className="customer-form-section-title">
                  Internal Notes
                </div>

                <label className="customer-field">
                  <span>Notes</span>

                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      handleFieldChange(
                        "notes",
                        event.target.value,
                      )
                    }
                    placeholder="Add any internal notes about this customer..."
                    rows={4}
                  />
                </label>
              </div>

              <div className="customer-modal-footer">
                <button
                  type="button"
                  className="customer-secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="customers-primary-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="customer-button-spinner" />
                      Saving...
                    </>
                  ) : editingCustomer ? (
                    "Save Changes"
                  ) : (
                    "Add Customer"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .customers-page {
          width: 100%;
          max-width: 1480px;
          margin: 0 auto;
          padding: 28px 30px 40px;
          color: var(--sbs-text, #111827);
        }

        .customers-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .customers-eyebrow,
        .customer-modal-eyebrow {
          margin-bottom: 7px;
          color: var(--sbs-text-muted, #6b7280);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }

        .customers-header h1 {
          margin: 0;
          font-size: 28px;
          line-height: 34px;
          font-weight: 760;
          letter-spacing: -0.035em;
          color: var(--sbs-text, #111827);
        }

        .customers-header p {
          max-width: 620px;
          margin: 7px 0 0;
          color: var(--sbs-text-muted, #6b7280);
          font-size: 13px;
          line-height: 20px;
        }

        .customers-primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 16px;
          border: 1px solid #111827;
          border-radius: 8px;
          background: #111827;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition:
            background 0.16s ease,
            border-color 0.16s ease,
            transform 0.16s ease;
        }

        .customers-primary-button:hover {
          background: #1f2937;
          border-color: #1f2937;
          transform: translateY(-1px);
        }

        .customers-primary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .customers-plus {
          font-size: 19px;
          line-height: 1;
          font-weight: 400;
        }

        .customers-alert {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
          padding: 12px 14px;
          border: 1px solid;
          border-radius: 9px;
        }

        .customers-alert > div:nth-child(2) {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
          gap: 2px;
        }

        .customers-alert strong {
          font-size: 12px;
          font-weight: 750;
        }

        .customers-alert span {
          font-size: 11px;
          line-height: 17px;
        }

        .customers-alert > button {
          width: 28px;
          height: 28px;
          border: 0;
          background: transparent;
          color: inherit;
          font-size: 19px;
          cursor: pointer;
          opacity: 0.65;
        }

        .customers-alert-error {
          border-color: #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .customers-alert-success {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .customers-alert-icon,
        .customers-success-icon {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 30px;
          height: 30px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 800;
        }

        .customers-alert-icon {
          background: #fee2e2;
        }

        .customers-success-icon {
          background: #dcfce7;
        }

        .customers-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .customer-stat-card {
          min-width: 0;
          padding: 18px;
          border: 1px solid var(--sbs-border, #e5e7eb);
          border-radius: 10px;
          background: var(--sbs-surface, #ffffff);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .customer-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
        }

        .customer-stat-top span {
          color: var(--sbs-text-muted, #6b7280);
          font-size: 11px;
          font-weight: 650;
        }

        .customer-stat-icon {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border: 1px solid var(--sbs-border, #e5e7eb);
          border-radius: 7px;
          color: var(--sbs-text, #111827);
          background: var(--sbs-surface-soft, #f8fafc);
          font-size: 11px;
          font-weight: 800;
        }

        .customer-stat-card > strong {
          display: block;
          color: var(--sbs-text, #111827);
          font-size: 25px;
          line-height: 30px;
          font-weight: 760;
          letter-spacing: -0.025em;
        }

        .customer-stat-card > small {
          display: block;
          margin-top: 5px;
          overflow: hidden;
          color: var(--sbs-text-muted, #6b7280);
          font-size: 10px;
          line-height: 16px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customers-panel {
          overflow: hidden;
          border: 1px solid var(--sbs-border, #e5e7eb);
          border-radius: 10px;
          background: var(--sbs-surface, #ffffff);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .customers-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 17px 18px;
          border-bottom: 1px solid var(--sbs-border, #e5e7eb);
        }

        .customers-toolbar h2 {
          margin: 0;
          color: var(--sbs-text, #111827);
          font-size: 14px;
          line-height: 20px;
          font-weight: 750;
          letter-spacing: -0.015em;
        }

        .customers-toolbar p {
          margin: 3px 0 0;
          color: var(--sbs-text-muted, #6b7280);
          font-size: 10px;
          line-height: 15px;
        }

        .customers-search {
          position: relative;
          width: 300px;
          flex: 0 0 300px;
        }

        .customers-search-icon {
          position: absolute;
          top: 50%;
          left: 11px;
          width: 17px;
          height: 17px;
          color: #9ca3af;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .customers-search input {
          width: 100%;
          height: 38px;
          padding: 0 34px 0 35px;
          border: 1px solid var(--sbs-border, #e5e7eb);
          border-radius: 7px;
          outline: none;
          background: var(--sbs-surface, #ffffff);
          color: var(--sbs-text, #111827);
          font-family: inherit;
          font-size: 11px;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .customers-search input::placeholder {
          color: #9ca3af;
        }

        .customers-search input:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.06);
        }

        .customers-search-clear {
          position: absolute;
          top: 50%;
          right: 8px;
          display: grid;
          place-items: center;
          width: 23px;
          height: 23px;
          padding: 0;
          border: 0;
          border-radius: 5px;
          background: transparent;
          color: #6b7280;
          font-size: 17px;
          cursor: pointer;
          transform: translateY(-50%);
        }

        .customers-search-clear:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .customers-table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .customers-table {
          width: 100%;
          min-width: 900px;
          border-collapse: collapse;
        }

        .customers-table th {
          padding: 11px 18px;
          border-bottom: 1px solid var(--sbs-border, #e5e7eb);
          background: var(--sbs-surface-soft, #fafafa);
          color: var(--sbs-text-muted, #6b7280);
          font-size: 9px;
          line-height: 14px;
          font-weight: 750;
          letter-spacing: 0.07em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .customers-table td {
          padding: 14px 18px;
          border-bottom: 1px solid var(--sbs-border, #f0f1f3);
          vertical-align: middle;
        }

        .customers-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .customer-row-clickable {
          cursor: pointer;
          transition:
            background 0.12s ease,
            box-shadow 0.12s ease;
        }

        .customer-row-clickable:hover {
          background: #fafafa;
        }

        .customer-row-clickable:focus {
          outline: none;
          background: #f8fafc;
          box-shadow: inset 3px 0 0 #111827;
        }

        .customer-identity {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 220px;
        }

        .customer-avatar {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 36px;
          height: 36px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f3f4f6;
          color: #374151;
          font-size: 10px;
          font-weight: 800;
        }

        .customer-name-block {
          display: flex;
          flex-direction: column;
          min-width: 0;
          gap: 3px;
        }

        .customer-name-block strong {
          overflow: hidden;
          color: var(--sbs-text, #111827);
          font-size: 11px;
          line-height: 16px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customer-open-hint {
          display: block;
          color: #6b7280;
          font-size: 9px;
          font-weight: 700;
          line-height: 14px;
          opacity: 0;
          transform: translateY(-2px);
          transition:
            opacity 0.12s ease,
            transform 0.12s ease;
        }

        .customer-row-clickable:hover .customer-open-hint,
        .customer-row-clickable:focus .customer-open-hint {
          opacity: 1;
          transform: translateY(0);
        }

        .customer-note-preview,
        .customer-id {
          display: block;
          max-width: 220px;
          overflow: hidden;
          color: var(--sbs-text-muted, #6b7280);
          font-size: 9px;
          line-height: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customer-contact {
          display: flex;
          flex-direction: column;
          gap: 3px;
          max-width: 220px;
        }

        .customer-contact span {
          overflow: hidden;
          color: #374151;
          font-size: 10px;
          line-height: 15px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customer-muted {
          color: #9ca3af !important;
        }

        .customer-location {
          display: block;
          max-width: 180px;
          overflow: hidden;
          color: #4b5563;
          font-size: 10px;
          line-height: 15px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customer-date {
          color: #6b7280;
          font-size: 10px;
          white-space: nowrap;
        }

        .customers-actions-heading {
          text-align: right !important;
        }

        .customer-row-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
        }

        .customer-view-button,
        .customer-action-button {
          min-height: 29px;
          padding: 0 9px;
          border-radius: 6px;
          font-family: inherit;
          font-size: 9px;
          font-weight: 650;
          cursor: pointer;
          transition:
            background 0.12s ease,
            border-color 0.12s ease,
            color 0.12s ease;
        }

        .customer-view-button {
          border: 1px solid #111827;
          background: #111827;
          color: #ffffff;
        }

        .customer-view-button:hover {
          background: #1f2937;
          border-color: #1f2937;
        }

        .customer-action-button {
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #374151;
        }

        .customer-action-button:hover {
          border-color: #d1d5db;
          background: #f9fafb;
          color: #111827;
        }

        .customer-delete-button {
          color: #991b1b;
        }

        .customer-delete-button:hover {
          border-color: #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }

        .customer-view-button:disabled,
        .customer-action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .customers-loading,
        .customers-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          min-height: 330px;
          padding: 50px 24px;
          text-align: center;
        }

        .customers-spinner {
          width: 27px;
          height: 27px;
          margin-bottom: 15px;
          border: 2px solid #e5e7eb;
          border-top-color: #111827;
          border-radius: 50%;
          animation: customer-spin 0.8s linear infinite;
        }

        .customers-loading strong {
          color: #111827;
          font-size: 12px;
          font-weight: 700;
        }

        .customers-loading span {
          margin-top: 5px;
          color: #9ca3af;
          font-size: 10px;
        }

        .customers-empty-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          margin-bottom: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f8fafc;
          color: #374151;
          font-size: 14px;
          font-weight: 800;
        }

        .customers-empty h3 {
          margin: 0;
          color: #111827;
          font-size: 14px;
          font-weight: 750;
        }

        .customers-empty p {
          max-width: 430px;
          margin: 6px 0 18px;
          color: #6b7280;
          font-size: 11px;
          line-height: 17px;
        }

        .customers-secondary-button,
        .customer-secondary-button {
          min-height: 39px;
          padding: 0 14px;
          border: 1px solid #e5e7eb;
          border-radius: 7px;
          background: #ffffff;
          color: #374151;
          font-family: inherit;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
        }

        .customers-secondary-button:hover,
        .customer-secondary-button:hover {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .customer-modal-backdrop {
          position: fixed;
          z-index: 100;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(15, 23, 42, 0.46);
          backdrop-filter: blur(3px);
        }

        .customer-modal {
          display: flex;
          flex-direction: column;
          width: min(680px, 100%);
          max-height: calc(100vh - 48px);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 12px;
          background: #ffffff;
          box-shadow:
            0 24px 70px rgba(15, 23, 42, 0.2),
            0 4px 16px rgba(15, 23, 42, 0.08);
        }

        .customer-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding: 22px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .customer-modal-header h2 {
          margin: 0;
          color: #111827;
          font-size: 19px;
          line-height: 25px;
          font-weight: 760;
          letter-spacing: -0.025em;
        }

        .customer-modal-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 10px;
          line-height: 16px;
        }

        .customer-modal-close {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 32px;
          height: 32px;
          padding: 0;
          border: 1px solid #e5e7eb;
          border-radius: 7px;
          background: #ffffff;
          color: #6b7280;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
        }

        .customer-modal-close:hover {
          background: #f9fafb;
          color: #111827;
        }

        .customer-form {
          overflow-y: auto;
        }

        .customer-form-section {
          padding: 19px 24px;
          border-bottom: 1px solid #f0f1f3;
        }

        .customer-form-section-title {
          margin-bottom: 13px;
          color: #374151;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .customer-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .customer-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .customer-field-full {
          grid-column: 1 / -1;
        }

        .customer-field > span {
          color: #4b5563;
          font-size: 10px;
          font-weight: 650;
        }

        .customer-field > span b {
          color: #dc2626;
          font-weight: 700;
        }

        .customer-field input,
        .customer-field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dfe3e8;
          border-radius: 7px;
          outline: none;
          background: #ffffff;
          color: #111827;
          font-family: inherit;
          font-size: 11px;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .customer-field input {
          height: 39px;
          padding: 0 11px;
        }

        .customer-field textarea {
          min-height: 90px;
          padding: 10px 11px;
          resize: vertical;
          line-height: 17px;
        }

        .customer-field input::placeholder,
        .customer-field textarea::placeholder {
          color: #a1a1aa;
        }

        .customer-field input:focus,
        .customer-field textarea:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.055);
        }

        .customer-modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
          padding: 15px 24px;
          background: #fafafa;
        }

        .customer-modal-footer .customer-secondary-button {
          min-height: 39px;
        }

        .customer-button-spinner {
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: customer-spin 0.7s linear infinite;
        }

        @keyframes customer-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1000px) {
          .customers-page {
            padding: 24px 22px 34px;
          }

          .customers-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .customers-search {
            width: 250px;
            flex-basis: 250px;
          }
        }

        @media (max-width: 760px) {
          .customers-page {
            padding: 20px 16px 30px;
          }

          .customers-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 15px;
          }

          .customers-header h1 {
            font-size: 24px;
            line-height: 30px;
          }

          .customers-header .customers-primary-button {
            width: 100%;
          }

          .customers-stats {
            grid-template-columns: 1fr;
          }

          .customers-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .customers-search {
            width: 100%;
            flex-basis: auto;
          }

          .customer-modal-backdrop {
            align-items: flex-end;
            padding: 0;
          }

          .customer-modal {
            width: 100%;
            max-height: 94vh;
            border-radius: 12px 12px 0 0;
          }
        }

        @media (max-width: 520px) {
          .customer-form-grid {
            grid-template-columns: 1fr;
          }

          .customer-field-full {
            grid-column: auto;
          }

          .customer-modal-header,
          .customer-form-section,
          .customer-modal-footer {
            padding-left: 17px;
            padding-right: 17px;
          }

          .customer-modal-footer {
            flex-direction: column-reverse;
          }

          .customer-modal-footer button {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}