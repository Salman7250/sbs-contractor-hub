"use client";

import {
  useState,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

const PAYMENT_TERMS = [
  {
    value: "cash",
    label: "Cash",
  },
  {
    value: "per_job",
    label: "Per Job",
  },
  {
    value: "weekly",
    label: "Weekly",
  },
  {
    value: "monthly",
    label: "Monthly",
  },
  {
    value: "net_7",
    label: "Net 7",
  },
  {
    value: "net_15",
    label: "Net 15",
  },
  {
    value: "net_30",
    label: "Net 30",
  },
  {
    value: "net_60",
    label: "Net 60",
  },
  {
    value: "other",
    label: "Other",
  },
];

export default function NewServiceProviderPage() {
  const supabase = createClient();
  const router = useRouter();

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [form, setForm] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    whatsapp: "",
    address: "",
    payment_terms: "",
    default_rate: "0",
    notes: "",
  });

  function updateField(
    field: keyof typeof form,
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

    setError("");

    const name =
      form.name.trim();

    const companyName =
      form.company_name.trim();

    const email =
      form.email.trim();

    const phone =
      form.phone.trim();

    const whatsapp =
      form.whatsapp.trim();

    const address =
      form.address.trim();

    const paymentTerms =
      form.payment_terms.trim();

    const notes =
      form.notes.trim();

    if (!name) {
      setError(
        "Provider name is required."
      );
      return;
    }

    const defaultRate =
      Number(
        form.default_rate
      );

    if (
      !Number.isFinite(
        defaultRate
      ) ||
      defaultRate < 0
    ) {
      setError(
        "Default service rate must be a valid amount."
      );
      return;
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      setError(
        "Please enter a valid email address."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: {
          user,
        },
        error: authError,
      } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        router.replace(
          "/login"
        );
        return;
      }

      const {
        data: membership,
        error:
          membershipError,
      } =
        await supabase
          .from(
            "company_members"
          )
          .select(
            "company_id"
          )
          .eq(
            "user_id",
            user.id
          )
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (
        !membership?.company_id
      ) {
        throw new Error(
          "No company membership found."
        );
      }

      const companyId =
        membership.company_id;

      /*
       * Generate the next provider number.
       *
       * The unique database constraint remains
       * the final protection against duplicates.
       */
      const {
        data: latestProvider,
        error:
          latestProviderError,
      } =
        await supabase
          .from(
            "service_providers"
          )
          .select(
            "provider_number"
          )
          .eq(
            "company_id",
            companyId
          )
          .like(
            "provider_number",
            "SP-%"
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle();

      if (
        latestProviderError
      ) {
        throw latestProviderError;
      }

      let nextNumber = 1;

      if (
        latestProvider?.provider_number
      ) {
        const match =
          latestProvider.provider_number.match(
            /^SP-(\d+)$/
          );

        if (match) {
          nextNumber =
            Number(match[1]) +
            1;
        }
      }

      const providerNumber =
        `SP-${String(
          nextNumber
        ).padStart(5, "0")}`;

      const {
        data: provider,
        error:
          providerError,
      } =
        await supabase
          .from(
            "service_providers"
          )
          .insert({
            company_id:
              companyId,
            provider_number:
              providerNumber,
            name,
            company_name:
              companyName ||
              null,
            service_types:
              [],
            email:
              email || null,
            phone:
              phone || null,
            whatsapp:
              whatsapp || null,
            address:
              address || null,
            payment_terms:
              paymentTerms ||
              null,
            default_rate:
              defaultRate,
            status:
              "active",
            notes:
              notes || null,
            created_by:
              user.id,
          })
          .select(
            "id"
          )
          .single();

      if (providerError) {
        throw providerError;
      }

      if (!provider?.id) {
        throw new Error(
          "Service provider was created but its ID could not be retrieved."
        );
      }

      router.push(
        `/service-providers/${provider.id}`
      );
    } catch (
      err: unknown
    ) {
      console.error(
        "Create service provider error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not create service provider."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="New Service Provider"
      description="Add an external provider that handles company-owned inventory or service work."
      actions={
        <button
          type="button"
          className="sp-secondary-button"
          onClick={() =>
            router.push(
              "/service-providers"
            )
          }
          disabled={saving}
        >
          Cancel
        </button>
      }
    >
      <section className="sp-page-content">
        {error && (
          <div className="sp-alert sp-alert-error">
            <strong>
              Could not create provider
            </strong>

            <span>
              {error}
            </span>
          </div>
        )}

        <form
          onSubmit={
            handleSubmit
          }
          className="sp-form"
        >
          {/* Provider Information */}

          <section className="sp-card">
            <div className="sp-card-header">
              <div>
                <h2>
                  Provider Information
                </h2>

                <p>
                  Basic information for this external service provider.
                </p>
              </div>
            </div>

            <div className="sp-card-body">
              <div className="sp-grid">
                <div className="sp-field">
                  <label htmlFor="name">
                    Provider Name
                    <span className="sp-required">
                      *
                    </span>
                  </label>

                  <input
                    id="name"
                    type="text"
                    value={
                      form.name
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "name",
                        event.target
                          .value
                      )
                    }
                    placeholder="e.g. Ahmed Repair Center"
                    autoComplete="organization"
                    required
                  />
                </div>

                <div className="sp-field">
                  <label htmlFor="company_name">
                    Company Name
                  </label>

                  <input
                    id="company_name"
                    type="text"
                    value={
                      form.company_name
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "company_name",
                        event.target
                          .value
                      )
                    }
                    placeholder="Legal or registered company name"
                    autoComplete="organization"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Contact Information */}

          <section className="sp-card">
            <div className="sp-card-header">
              <div>
                <h2>
                  Contact Information
                </h2>

                <p>
                  Contact details for dispatches, returns, and service coordination.
                </p>
              </div>
            </div>

            <div className="sp-card-body">
              <div className="sp-grid">
                <div className="sp-field">
                  <label htmlFor="email">
                    Email
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={
                      form.email
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "email",
                        event.target
                          .value
                      )
                    }
                    placeholder="provider@example.com"
                    autoComplete="email"
                  />
                </div>

                <div className="sp-field">
                  <label htmlFor="phone">
                    Phone
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    value={
                      form.phone
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "phone",
                        event.target
                          .value
                      )
                    }
                    placeholder="+971 50 000 0000"
                    autoComplete="tel"
                  />
                </div>

                <div className="sp-field">
                  <label htmlFor="whatsapp">
                    WhatsApp
                  </label>

                  <input
                    id="whatsapp"
                    type="tel"
                    value={
                      form.whatsapp
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "whatsapp",
                        event.target
                          .value
                      )
                    }
                    placeholder="+971 50 000 0000"
                    autoComplete="tel"
                  />
                </div>

                <div className="sp-field sp-field-full">
                  <label htmlFor="address">
                    Address
                  </label>

                  <textarea
                    id="address"
                    rows={4}
                    value={
                      form.address
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "address",
                        event.target
                          .value
                      )
                    }
                    placeholder="Provider address"
                    autoComplete="street-address"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Commercial Information */}

          <section className="sp-card">
            <div className="sp-card-header">
              <div>
                <h2>
                  Commercial Information
                </h2>

                <p>
                  Default payment and service cost information.
                </p>
              </div>
            </div>

            <div className="sp-card-body">
              <div className="sp-grid">
                <div className="sp-field">
                  <label htmlFor="payment_terms">
                    Payment Terms
                  </label>

                  <select
                    id="payment_terms"
                    value={
                      form.payment_terms
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "payment_terms",
                        event.target
                          .value
                      )
                    }
                  >
                    <option value="">
                      Select payment terms
                    </option>

                    {PAYMENT_TERMS.map(
                      (
                        term
                      ) => (
                        <option
                          key={
                            term.value
                          }
                          value={
                            term.value
                          }
                        >
                          {
                            term.label
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="sp-field">
                  <label htmlFor="default_rate">
                    Default Service Rate
                  </label>

                  <div className="sp-input-prefix">
                    <span>
                      Rate
                    </span>

                    <input
                      id="default_rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.default_rate
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "default_rate",
                          event.target
                            .value
                        )
                      }
                      placeholder="0.00"
                      inputMode="decimal"
                    />
                  </div>

                  <small>
                    Reference rate only. Actual service costs are recorded on individual jobs and returns.
                  </small>
                </div>
              </div>
            </div>
          </section>

          {/* Notes */}

          <section className="sp-card">
            <div className="sp-card-header">
              <div>
                <h2>
                  Notes
                </h2>

                <p>
                  Internal information about this provider.
                </p>
              </div>
            </div>

            <div className="sp-card-body">
              <div className="sp-field">
                <label htmlFor="notes">
                  Internal Notes
                </label>

                <textarea
                  id="notes"
                  rows={6}
                  value={
                    form.notes
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "notes",
                      event.target
                        .value
                    )
                  }
                  placeholder="Add pricing agreements, quality expectations, pickup instructions, or other internal notes."
                />
              </div>
            </div>
          </section>

          {/* Actions */}

          <div className="sp-actions">
            <button
              type="button"
              className="sp-secondary-button"
              onClick={() =>
                router.push(
                  "/service-providers"
                )
              }
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="sp-primary-button"
              disabled={saving}
            >
              {saving
                ? "Creating..."
                : "Create Service Provider"}
            </button>
          </div>
        </form>
      </section>

      <style jsx>{`
        .sp-page-content {
          padding: 28px;
          width: 100%;
          box-sizing: border-box;
        }

        .sp-form {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .sp-card {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          overflow: hidden;
          box-sizing: border-box;
        }

        .sp-card-header {
          padding: 20px 22px;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .sp-card-header h2 {
          margin: 0;
          font-size: 16px;
          line-height: 24px;
          font-weight: 650;
          color: #111827;
        }

        .sp-card-header p {
          margin: 5px 0 0;
          font-size: 13px;
          line-height: 20px;
          color: #6b7280;
        }

        .sp-card-body {
          padding: 22px;
          box-sizing: border-box;
        }

        .sp-grid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 20px;
        }

        .sp-field {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .sp-field-full {
          grid-column: 1 / -1;
        }

        .sp-field label {
          display: block;
          margin: 0;
          font-size: 13px;
          line-height: 18px;
          font-weight: 600;
          color: #374151;
        }

        .sp-required {
          margin-left: 3px;
          color: #dc2626;
        }

        .sp-field input,
        .sp-field select,
        .sp-field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #ffffff;
          color: #111827;
          font-family: inherit;
          font-size: 14px;
          line-height: 20px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .sp-field input,
        .sp-field select {
          min-height: 42px;
          padding: 10px 12px;
        }

        .sp-field textarea {
          min-height: 96px;
          padding: 11px 12px;
          resize: vertical;
        }

        .sp-field input::placeholder,
        .sp-field textarea::placeholder {
          color: #9ca3af;
        }

        .sp-field input:hover,
        .sp-field select:hover,
        .sp-field textarea:hover {
          border-color: #9ca3af;
        }

        .sp-field input:focus,
        .sp-field select:focus,
        .sp-field textarea:focus {
          border-color: #111827;
          box-shadow:
            0 0 0 3px
            rgba(17, 24, 39, 0.08);
        }

        .sp-field small {
          margin-top: 1px;
          font-size: 12px;
          line-height: 18px;
          color: #6b7280;
        }

        .sp-input-prefix {
          display: flex;
          align-items: stretch;
          width: 100%;
        }

        .sp-input-prefix span {
          display: flex;
          align-items: center;
          padding: 0 12px;
          border: 1px solid #d1d5db;
          border-right: 0;
          border-radius: 9px 0 0 9px;
          background: #f9fafb;
          color: #6b7280;
          font-size: 13px;
          white-space: nowrap;
        }

        .sp-input-prefix input {
          border-radius: 0 9px 9px 0;
        }

        .sp-alert {
          width: 100%;
          max-width: 1400px;
          box-sizing: border-box;
          margin: 0 auto 20px;
          padding: 13px 15px;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-size: 13px;
          line-height: 19px;
        }

        .sp-alert strong {
          font-weight: 650;
        }

        .sp-alert-error {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .sp-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 0 0 8px;
        }

        .sp-primary-button,
        .sp-secondary-button {
          min-height: 40px;
          padding: 9px 16px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          line-height: 20px;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            opacity 0.15s ease;
        }

        .sp-primary-button {
          border: 1px solid #111827;
          background: #111827;
          color: #ffffff;
        }

        .sp-primary-button:hover:not(:disabled) {
          background: #1f2937;
          border-color: #1f2937;
        }

        .sp-primary-button:disabled,
        .sp-secondary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .sp-secondary-button {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .sp-secondary-button:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        @media (max-width: 900px) {
          .sp-grid {
            grid-template-columns: 1fr;
          }

          .sp-field-full {
            grid-column: auto;
          }
        }

        @media (max-width: 640px) {
          .sp-page-content {
            padding: 18px;
          }

          .sp-form {
            gap: 16px;
          }

          .sp-card-header {
            padding: 17px 18px;
          }

          .sp-card-body {
            padding: 18px;
          }

          .sp-actions {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .sp-primary-button,
          .sp-secondary-button {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}