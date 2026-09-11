"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Provider = {
  id: string;
  company_id: string;
  provider_number: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  payment_terms: string | null;
  default_rate: number | null;
  status: "active" | "inactive" | "blocked";
  notes: string | null;
};

export default function EditServiceProviderPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const providerId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [provider, setProvider] = useState<Provider | null>(
    null
  );

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState<
    "active" | "inactive" | "blocked"
  >("active");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [defaultRate, setDefaultRate] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadProvider = useCallback(async () => {
    if (!providerId) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership, error: membershipError } =
        await supabase
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
          "No company membership was found for your account."
        );
      }

      const { data, error } = await supabase
        .from("service_providers")
        .select(
          `
            id,
            company_id,
            provider_number,
            name,
            company_name,
            email,
            phone,
            whatsapp,
            address,
            payment_terms,
            default_rate,
            status,
            notes
          `
        )
        .eq("id", providerId)
        .eq("company_id", membership.company_id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("Service provider not found.");
      }

      const loadedProvider = data as Provider;

      setProvider(loadedProvider);

      setName(loadedProvider.name || "");
      setCompanyName(loadedProvider.company_name || "");
      setStatus(loadedProvider.status || "active");
      setEmail(loadedProvider.email || "");
      setPhone(loadedProvider.phone || "");
      setWhatsapp(loadedProvider.whatsapp || "");
      setAddress(loadedProvider.address || "");
      setPaymentTerms(loadedProvider.payment_terms || "");
      setDefaultRate(
        loadedProvider.default_rate !== null &&
        loadedProvider.default_rate !== undefined
          ? String(loadedProvider.default_rate)
          : ""
      );
      setNotes(loadedProvider.notes || "");
    } catch (error) {
      console.error(
        "SERVICE PROVIDER EDIT LOAD ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load service provider."
      );
    } finally {
      setLoading(false);
    }
  }, [providerId, router, supabase]);

  useEffect(() => {
    loadProvider();
  }, [loadProvider]);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMessage("Provider name is required.");
      return;
    }

    let parsedRate: number | null = null;

    if (defaultRate.trim()) {
      parsedRate = Number(defaultRate);

      if (
        Number.isNaN(parsedRate) ||
        parsedRate < 0
      ) {
        setErrorMessage(
          "Default service rate must be a valid positive number."
        );
        return;
      }
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership, error: membershipError } =
        await supabase
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
          "No company membership was found for your account."
        );
      }

      const { error } = await supabase
        .from("service_providers")
        .update({
          name: trimmedName,
          company_name:
            companyName.trim() || null,
          status,
          email: email.trim() || null,
          phone: phone.trim() || null,
          whatsapp: whatsapp.trim() || null,
          address: address.trim() || null,
          payment_terms:
            paymentTerms || null,
          default_rate: parsedRate,
          notes: notes.trim() || null,
        })
        .eq("id", providerId)
        .eq("company_id", membership.company_id);

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "Service provider updated successfully."
      );

      setTimeout(() => {
        router.push(
          `/service-providers/${providerId}`
        );
        router.refresh();
      }, 500);
    } catch (error) {
      console.error(
        "SERVICE PROVIDER UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update service provider."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading service provider...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!provider) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="page-header">
            <div>
              <Link
                href="/service-providers"
                className="back-link"
              >
                ← Service Providers
              </Link>

              <h1>Edit Service Provider</h1>
            </div>
          </div>

          <div className="alert alert-error">
            {errorMessage ||
              "Service provider not found."}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content">
        <div className="page-header">
          <div>
            <Link
              href={`/service-providers/${provider.id}`}
              className="back-link"
            >
              ← {provider.name}
            </Link>

            <h1>Edit Service Provider</h1>

            <p className="page-description">
              Update the provider's contact and commercial
              information.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            {successMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="provider-form"
        >
          {/* Provider Identity */}
          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Provider Details</h2>
                <p>
                  Basic identification and account status
                </p>
              </div>

              <div className="provider-number-badge">
                {provider.provider_number}
              </div>
            </div>

            <div className="form-content">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="name">
                    Provider Name
                    <span className="required">*</span>
                  </label>

                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    placeholder="Enter provider name"
                    required
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="companyName">
                    Company Name
                  </label>

                  <input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(event) =>
                      setCompanyName(
                        event.target.value
                      )
                    }
                    placeholder="Optional company name"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="status">
                    Status
                  </label>

                  <select
                    id="status"
                    value={status}
                    onChange={(event) =>
                      setStatus(
                        event.target.value as
                          | "active"
                          | "inactive"
                          | "blocked"
                      )
                    }
                    disabled={saving}
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>

                    <option value="blocked">
                      Blocked
                    </option>
                  </select>
                </div>

                <div className="form-field">
                  <label>
                    Provider Number
                  </label>

                  <input
                    type="text"
                    value={provider.provider_number}
                    disabled
                  />

                  <span className="field-help">
                    Provider numbers are system-generated
                    and cannot be changed.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Contact Information</h2>
                <p>
                  How your team can contact this provider
                </p>
              </div>
            </div>

            <div className="form-content">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="email">
                    Email
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="provider@example.com"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="phone">
                    Phone
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    placeholder="+971 50 000 0000"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="whatsapp">
                    WhatsApp
                  </label>

                  <input
                    id="whatsapp"
                    type="tel"
                    value={whatsapp}
                    onChange={(event) =>
                      setWhatsapp(
                        event.target.value
                      )
                    }
                    placeholder="+971 50 000 0000"
                    disabled={saving}
                  />
                </div>

                <div className="form-field full-width">
                  <label htmlFor="address">
                    Address
                  </label>

                  <textarea
                    id="address"
                    value={address}
                    onChange={(event) =>
                      setAddress(event.target.value)
                    }
                    placeholder="Provider address"
                    rows={3}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Commercial */}
          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Commercial Information</h2>
                <p>
                  Payment and service cost defaults
                </p>
              </div>
            </div>

            <div className="form-content">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="paymentTerms">
                    Payment Terms
                  </label>

                  <select
                    id="paymentTerms"
                    value={paymentTerms}
                    onChange={(event) =>
                      setPaymentTerms(
                        event.target.value
                      )
                    }
                    disabled={saving}
                  >
                    <option value="">
                      Select payment terms
                    </option>

                    <option value="Due on receipt">
                      Due on receipt
                    </option>

                    <option value="Net 7">
                      Net 7
                    </option>

                    <option value="Net 15">
                      Net 15
                    </option>

                    <option value="Net 30">
                      Net 30
                    </option>

                    <option value="Net 45">
                      Net 45
                    </option>

                    <option value="Net 60">
                      Net 60
                    </option>

                    <option value="Custom">
                      Custom
                    </option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="defaultRate">
                    Default Service Rate
                  </label>

                  <div className="input-with-suffix">
                    <input
                      id="defaultRate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={defaultRate}
                      onChange={(event) =>
                        setDefaultRate(
                          event.target.value
                        )
                      }
                      placeholder="0.00"
                      disabled={saving}
                    />

                    <span>AED</span>
                  </div>

                  <span className="field-help">
                    Used as a default when creating service
                    jobs. Individual jobs can use their own
                    cost.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Internal Notes</h2>
                <p>
                  Notes visible to your company users
                </p>
              </div>
            </div>

            <div className="form-content">
              <div className="form-field full-width">
                <label htmlFor="notes">
                  Notes
                </label>

                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  placeholder="Add internal notes about this provider..."
                  rows={5}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <Link
              href={`/service-providers/${provider.id}`}
              className="secondary-button"
            >
              Cancel
            </Link>

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving
                ? "Saving Changes..."
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 24px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          color: #6b7280;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .back-link:hover {
          color: #111827;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 27px;
          line-height: 1.2;
          font-weight: 700;
        }

        .page-description {
          margin: 6px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .provider-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .content-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          overflow: hidden;
        }

        .content-card-header {
          min-height: 70px;
          padding: 18px 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .content-card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .content-card-header p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .provider-number-badge {
          padding: 6px 10px;
          border-radius: 7px;
          background: #f3f4f6;
          color: #4b5563;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .form-content {
          padding: 22px 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 20px;
        }

        .form-field {
          min-width: 0;
        }

        .full-width {
          grid-column: 1 / -1;
        }

        .form-field label {
          display: block;
          margin-bottom: 7px;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
        }

        .required {
          margin-left: 3px;
          color: #dc2626;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          color: #111827;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .form-field input,
        .form-field select {
          height: 42px;
          padding: 0 12px;
        }

        .form-field textarea {
          min-height: 100px;
          padding: 11px 12px;
          resize: vertical;
          line-height: 1.5;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.05);
        }

        .form-field input:disabled,
        .form-field select:disabled,
        .form-field textarea:disabled {
          background: #f9fafb;
          color: #6b7280;
          cursor: not-allowed;
        }

        .field-help {
          display: block;
          margin-top: 6px;
          color: #9ca3af;
          font-size: 11px;
          line-height: 1.4;
        }

        .input-with-suffix {
          position: relative;
        }

        .input-with-suffix input {
          padding-right: 58px;
        }

        .input-with-suffix span {
          position: absolute;
          top: 50%;
          right: 12px;
          transform: translateY(-50%);
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          pointer-events: none;
        }

        .form-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding-bottom: 20px;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 15px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            opacity 0.15s ease;
        }

        .primary-button {
          border: 1px solid #111827;
          background: #111827;
          color: white;
        }

        .primary-button:hover {
          background: #1f2937;
        }

        .primary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
        }

        .secondary-button:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .alert {
          border-radius: 9px;
          padding: 12px 14px;
          margin-bottom: 18px;
          font-size: 13px;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .alert-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .loading-state {
          min-height: 420px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 12px;
          color: #6b7280;
          font-size: 13px;
        }

        .loading-spinner {
          width: 26px;
          height: 26px;
          border: 3px solid #e5e7eb;
          border-top-color: #111827;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 700px) {
          .page-content {
            padding: 18px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: auto;
          }

          .content-card-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .form-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .form-actions a,
          .form-actions button {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .form-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AppShell>
  );
}