"use client";

import { useEffect, useMemo, useState } from "react";
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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CustomersPage() {
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");

  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);

  const [form, setForm] = useState<CustomerForm>(emptyForm);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function getCompanyMembership() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      window.location.href = "/login";
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

  async function loadCustomers() {
    setLoading(true);
    setPageError("");

    try {
      const membership = await getCompanyMembership();

      if (!membership) return;

      const { data, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", membership.companyId)
        .order("created_at", { ascending: false });

      if (customersError) throw customersError;

      setCustomers((data ?? []) as Customer[]);
    } catch (err) {
      console.error("LOAD CUSTOMERS ERROR:", err);

      setPageError(
        err instanceof Error
          ? err.message
          : "Failed to load customers."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return customers;

    return customers.filter((customer) => {
      const searchableValues = [
        customer.name,
        customer.email,
        customer.phone,
        customer.address_line1,
        customer.address_line2,
        customer.city,
        customer.state,
        customer.postal_code,
      ];

      return searchableValues
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        );
    });
  }, [customers, search]);

  function openAddModal() {
    setEditingCustomer(null);
    setForm(emptyForm);
    setModalError("");
    setModalOpen(true);
  }

  function openEditModal(customer: Customer) {
    setEditingCustomer(customer);

    setForm({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address_line1: customer.address_line1 || "",
      address_line2: customer.address_line2 || "",
      city: customer.city || "",
      state: customer.state || "",
      postal_code: customer.postal_code || "",
      notes: customer.notes || "",
    });

    setModalError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingCustomer(null);
    setForm(emptyForm);
    setModalError("");
  }

  function updateField(
    field: keyof CustomerForm,
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
      setModalError("Customer name is required.");
      return;
    }

    setSaving(true);

    try {
      const membership = await getCompanyMembership();

      if (!membership) return;

      const customerData = {
        company_id: membership.companyId,
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
        const { data, error } = await supabase
          .from("customers")
          .update(customerData)
          .eq("id", editingCustomer.id)
          .eq("company_id", membership.companyId)
          .select("*")
          .single();

        if (error) throw error;

        setCustomers((current) =>
          current.map((customer) =>
            customer.id === editingCustomer.id
              ? (data as Customer)
              : customer
          )
        );
      } else {
        const { data, error } = await supabase
          .from("customers")
          .insert(customerData)
          .select("*")
          .single();

        if (error) throw error;

        setCustomers((current) => [
          data as Customer,
          ...current,
        ]);
      }

      closeModal();
    } catch (err) {
      console.error("SAVE CUSTOMER ERROR:", err);

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
          .join(" | ") || "Failed to save customer."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(customer: Customer) {
    const confirmed = window.confirm(
      `Delete ${customer.name}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setPageError("");

    try {
      const membership = await getCompanyMembership();

      if (!membership) return;

      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customer.id)
        .eq("company_id", membership.companyId);

      if (error) throw error;

      setCustomers((current) =>
        current.filter((item) => item.id !== customer.id)
      );
    } catch (err) {
      console.error("DELETE CUSTOMER ERROR:", err);

      setPageError(
        err instanceof Error
          ? err.message
          : "Failed to delete customer."
      );
    }
  }

  return (
    <AppShell
      title="Customers"
      description="Manage your contractor customer database."
      actions={
        <button
          className="sbs-primary-button"
          onClick={openAddModal}
        >
          <span className="sbs-button-plus">+</span>
          Add Customer
        </button>
      }
    >
      <div className="customers-page">
        {pageError && (
          <div className="sbs-error-banner">
            {pageError}
          </div>
        )}

        <section className="sbs-card customers-card">
          <div className="customers-toolbar">
            <div className="customers-search">
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
                placeholder="Search customers..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="customers-result-count">
              {filteredCustomers.length} customer
              {filteredCustomers.length === 1
                ? ""
                : "s"}
            </div>
          </div>

          {loading ? (
            <div className="sbs-empty-state">
              <div className="sbs-spinner" />

              <h3>Loading customers...</h3>

              <p>
                Getting your customer data from the database.
              </p>
            </div>
          ) : filteredCustomers.length === 0 ? (
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
                {search
                  ? "No customers found"
                  : "No customers yet"}
              </h3>

              <p>
                {search
                  ? "Try a different search term."
                  : "Add your first customer to start building your customer database."}
              </p>

              {!search && (
                <button
                  className="sbs-primary-button"
                  onClick={openAddModal}
                >
                  <span className="sbs-button-plus">+</span>
                  Add Customer
                </button>
              )}
            </div>
          ) : (
            <div className="customers-table-scroll">
              <table className="customers-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Location</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div className="customer-name">
                          {customer.name}
                        </div>
                      </td>

                      <td>
                        <div className="customer-contact">
                          {customer.email ||
                            customer.phone ||
                            "—"}
                        </div>

                        {customer.email &&
                          customer.phone && (
                            <div className="customer-phone">
                              {customer.phone}
                            </div>
                          )}
                      </td>

                      <td>
                        {[
                          customer.city,
                          customer.state,
                          customer.postal_code,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>

                      <td>
                        {formatDate(customer.created_at)}
                      </td>

                      <td>
                        <div className="customer-actions">
                          <button
                            className="sbs-action-button"
                            onClick={() =>
                              openEditModal(customer)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="sbs-action-button sbs-action-danger"
                            onClick={() =>
                              deleteCustomer(customer)
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
              className="sbs-modal customers-modal"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="sbs-modal-header">
                <div>
                  <div className="sbs-eyebrow">
                    {editingCustomer
                      ? "CUSTOMER"
                      : "NEW CUSTOMER"}
                  </div>

                  <h2>
                    {editingCustomer
                      ? "Edit Customer"
                      : "Add Customer"}
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

                <div className="customers-form-grid">
                  <label className="sbs-form-field">
                    <span>Customer Name *</span>

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
                    <span>City</span>

                    <input
                      type="text"
                      value={form.city}
                      onChange={(event) =>
                        updateField(
                          "city",
                          event.target.value
                        )
                      }
                      placeholder="Dallas"
                    />
                  </label>

                  <label className="sbs-form-field">
                    <span>State</span>

                    <input
                      type="text"
                      value={form.state}
                      onChange={(event) =>
                        updateField(
                          "state",
                          event.target.value
                        )
                      }
                      placeholder="Texas"
                    />
                  </label>

                  <label className="sbs-form-field">
                    <span>ZIP / Postal Code</span>

                    <input
                      type="text"
                      value={form.postal_code}
                      onChange={(event) =>
                        updateField(
                          "postal_code",
                          event.target.value
                        )
                      }
                      placeholder="75001"
                    />
                  </label>

                  <label className="sbs-form-field sbs-form-full">
                    <span>Address Line 1</span>

                    <input
                      type="text"
                      value={form.address_line1}
                      onChange={(event) =>
                        updateField(
                          "address_line1",
                          event.target.value
                        )
                      }
                      placeholder="123 Main Street"
                    />
                  </label>

                  <label className="sbs-form-field sbs-form-full">
                    <span>Address Line 2</span>

                    <input
                      type="text"
                      value={form.address_line2}
                      onChange={(event) =>
                        updateField(
                          "address_line2",
                          event.target.value
                        )
                      }
                      placeholder="Apartment, suite, unit, etc."
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
                      placeholder="Additional customer information..."
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
                      : editingCustomer
                        ? "Save Changes"
                        : "Add Customer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .customers-page {
          width: 100%;
        }

        .sbs-card {
          background: #fff;
          border: 1px solid var(--sbs-border);
          border-radius: var(--sbs-radius);
          box-shadow: var(--sbs-shadow-sm);
        }

        .customers-card {
          overflow: hidden;
        }

        .customers-toolbar {
          min-height: 70px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--sbs-border);
        }

        .customers-search {
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

        .customers-search:focus-within {
          border-color: var(--sbs-border-strong);
          background: #fff;
          box-shadow: 0 0 0 3px rgba(23, 32, 51, 0.045);
        }

        .customers-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--sbs-text);
          font: inherit;
          font-size: 12px;
        }

        .customers-search input::placeholder {
          color: var(--sbs-text-muted);
        }

        .customers-result-count {
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

        .customers-table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .customers-table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
        }

        .customers-table th {
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

        .customers-table td {
          height: 68px;
          padding: 10px 15px;
          border-bottom: 1px solid var(--sbs-border);
          color: var(--sbs-text-soft);
          font-size: 11px;
          line-height: 17px;
          vertical-align: middle;
        }

        .customers-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .customers-table tbody tr:hover {
          background: #fbfcfd;
        }

        .customer-name {
          color: var(--sbs-text);
          font-size: 12px;
          line-height: 17px;
          font-weight: 650;
          white-space: nowrap;
        }

        .customer-contact {
          max-width: 210px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customer-phone {
          margin-top: 2px;
          color: var(--sbs-text-muted);
          font-size: 10px;
          line-height: 15px;
        }

        .customer-actions {
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
          animation: sbs-customer-spin 0.75s linear infinite;
        }

        @keyframes sbs-customer-spin {
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

        .customers-modal form {
          padding: 22px;
        }

        .customers-form-grid {
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

        @media (max-width: 700px) {
          .customers-toolbar {
            align-items: stretch;
            flex-wrap: wrap;
          }

          .customers-search {
            width: 100%;
          }

          .customers-result-count {
            margin-left: 0;
            display: flex;
            align-items: center;
          }

          .customers-form-grid {
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

          .customers-modal form {
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
          .customers-toolbar {
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