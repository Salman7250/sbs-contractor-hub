"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

const SUPPLIER_TYPES = [
  {
    value: "manufacturer",
    label: "Manufacturer",
  },
  {
    value: "distributor",
    label: "Distributor",
  },
  {
    value: "wholesaler",
    label: "Wholesaler",
  },
  {
    value: "vendor",
    label: "Vendor",
  },
  {
    value: "service_provider",
    label: "Service Provider",
  },
  {
    value: "other",
    label: "Other",
  },
];

const SUPPLIER_STATUSES = [
  {
    value: "active",
    label: "Active",
  },
  {
    value: "inactive",
    label: "Inactive",
  },
  {
    value: "blocked",
    label: "Blocked",
  },
];

type Supplier = {
  id: string;
  company_id: string;
  supplier_number: string;
  legal_name: string;
  display_name: string;
  status: string;
  supplier_type: string;
  tax_id: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  currency: string;
  payment_terms_days: number;
  credit_limit: number;
  default_lead_time_days: number;
  minimum_order_amount: number;
  rating: number | null;
  notes: string | null;
};

export default function EditSupplierPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const supplierId = useMemo(() => {
    const value = params?.id;

    if (Array.isArray(value)) {
      return value[0] || "";
    }

    return typeof value === "string"
      ? value
      : "";
  }, [params]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [form, setForm] = useState({
    legal_name: "",
    display_name: "",
    supplier_type: "vendor",
    status: "active",
    tax_id: "",
    website: "",
    email: "",
    phone: "",
    currency: "USD",
    payment_terms_days: "0",
    credit_limit: "0",
    default_lead_time_days: "0",
    minimum_order_amount: "0",
    rating: "",
    notes: "",
  });

  const [supplierNumber, setSupplierNumber] =
    useState("");

  const updateField = useCallback(
    (
      field: keyof typeof form,
      value: string
    ) => {
      setForm((current) => ({
        ...current,
        [field]: value,
      }));
    },
    []
  );

  const loadSupplier = useCallback(async () => {
    if (!supplierId) {
      setError(
        "Supplier ID is missing."
      );
      setLoading(false);
      return;
    }

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

      const {
        data: supplier,
        error: supplierError,
      } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", supplierId)
        .eq(
          "company_id",
          membership.company_id
        )
        .maybeSingle();

      if (supplierError) {
        throw supplierError;
      }

      if (!supplier) {
        throw new Error(
          "Supplier not found or you do not have access to it."
        );
      }

      const typedSupplier =
        supplier as Supplier;

      setSupplierNumber(
        typedSupplier.supplier_number
      );

      setForm({
        legal_name:
          typedSupplier.legal_name || "",
        display_name:
          typedSupplier.display_name || "",
        supplier_type:
          typedSupplier.supplier_type ||
          "vendor",
        status:
          typedSupplier.status ||
          "active",
        tax_id:
          typedSupplier.tax_id || "",
        website:
          typedSupplier.website || "",
        email:
          typedSupplier.email || "",
        phone:
          typedSupplier.phone || "",
        currency:
          typedSupplier.currency || "USD",
        payment_terms_days:
          String(
            typedSupplier.payment_terms_days ??
              0
          ),
        credit_limit:
          String(
            typedSupplier.credit_limit ??
              0
          ),
        default_lead_time_days:
          String(
            typedSupplier.default_lead_time_days ??
              0
          ),
        minimum_order_amount:
          String(
            typedSupplier.minimum_order_amount ??
              0
          ),
        rating:
          typedSupplier.rating !== null &&
          typedSupplier.rating !== undefined
            ? String(
                typedSupplier.rating
              )
            : "",
        notes:
          typedSupplier.notes || "",
      });
    } catch (err: unknown) {
      console.error(
        "Edit supplier load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not load supplier."
      );
    } finally {
      setLoading(false);
    }
  }, [
    router,
    supplierId,
    supabase,
  ]);

  useEffect(() => {
    // Load supplier data asynchronously.
     
    void loadSupplier();
  }, [loadSupplier]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    const legalName =
      form.legal_name.trim();

    const displayName =
      form.display_name.trim();

    if (!legalName) {
      setError(
        "Legal name is required."
      );
      return;
    }

    if (!displayName) {
      setError(
        "Display name is required."
      );
      return;
    }

    const paymentTermsDays =
      Number(form.payment_terms_days);

    const creditLimit =
      Number(form.credit_limit);

    const leadTimeDays =
      Number(
        form.default_lead_time_days
      );

    const minimumOrderAmount =
      Number(
        form.minimum_order_amount
      );

    const rating =
      form.rating.trim()
        ? Number(form.rating)
        : null;

    if (
      !Number.isFinite(
        paymentTermsDays
      ) ||
      paymentTermsDays < 0
    ) {
      setError(
        "Payment terms must be a valid number of days."
      );
      return;
    }

    if (
      !Number.isFinite(
        creditLimit
      ) ||
      creditLimit < 0
    ) {
      setError(
        "Credit limit must be a valid amount."
      );
      return;
    }

    if (
      !Number.isFinite(
        leadTimeDays
      ) ||
      leadTimeDays < 0
    ) {
      setError(
        "Lead time must be a valid number of days."
      );
      return;
    }

    if (
      !Number.isFinite(
        minimumOrderAmount
      ) ||
      minimumOrderAmount < 0
    ) {
      setError(
        "Minimum order amount must be a valid amount."
      );
      return;
    }

    if (
      rating !== null &&
      (!Number.isFinite(rating) ||
        rating < 0 ||
        rating > 5)
    ) {
      setError(
        "Rating must be between 0 and 5."
      );
      return;
    }

    if (
      !/^[A-Za-z]{3}$/.test(
        form.currency.trim()
      )
    ) {
      setError(
        "Currency must be a 3-letter code such as USD."
      );
      return;
    }

    if (
      !SUPPLIER_TYPES.some(
        (type) =>
          type.value ===
          form.supplier_type
      )
    ) {
      setError(
        "Please select a valid supplier type."
      );
      return;
    }

    if (
      !SUPPLIER_STATUSES.some(
        (status) =>
          status.value ===
          form.status
      )
    ) {
      setError(
        "Please select a valid supplier status."
      );
      return;
    }

    if (!supplierId) {
      setError(
        "Supplier ID is missing."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } =
        await supabase.auth.getUser();

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
      } =
        await supabase
          .from("company_members")
          .select("company_id")
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

      const {
        data: updatedSupplier,
        error: updateError,
      } =
        await supabase
          .from("suppliers")
          .update({
            legal_name:
              legalName,
            display_name:
              displayName,
            supplier_type:
              form.supplier_type,
            status:
              form.status,
            tax_id:
              form.tax_id.trim() ||
              null,
            website:
              form.website.trim() ||
              null,
            email:
              form.email.trim() ||
              null,
            phone:
              form.phone.trim() ||
              null,
            currency:
              form.currency
                .trim()
                .toUpperCase(),
            payment_terms_days:
              paymentTermsDays,
            credit_limit:
              creditLimit,
            default_lead_time_days:
              leadTimeDays,
            minimum_order_amount:
              minimumOrderAmount,
            rating,
            notes:
              form.notes.trim() ||
              null,
          })
          .eq(
            "id",
            supplierId
          )
          .eq(
            "company_id",
            companyId
          )
          .select("id")
          .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      if (!updatedSupplier?.id) {
        throw new Error(
          "Supplier could not be updated. It may not exist or you may not have access to it."
        );
      }

      router.push(
        `/suppliers/${supplierId}`
      );
    } catch (err: unknown) {
      console.error(
        "Update supplier error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not update supplier."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Edit Supplier"
        description="Update supplier information and procurement terms."
      >
        <section className="page-content">
          <div className="loading-state">
            <div className="loading-spinner" />

            <p>
              Loading supplier...
            </p>
          </div>
        </section>

        <style jsx>{`
          .page-content {
            padding: 28px;
          }

          .loading-state {
            min-height: 500px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            font-size: 13px;
          }

          .loading-spinner {
            width: 30px;
            height: 30px;
            margin-bottom: 12px;
            border: 3px solid #e2e8f0;
            border-top-color: #334155;
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

  if (error && !form.legal_name) {
    return (
      <AppShell
        title="Edit Supplier"
        description="Update supplier information and procurement terms."
        actions={
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push(
                supplierId
                  ? `/suppliers/${supplierId}`
                  : "/suppliers"
              )
            }
          >
            Cancel
          </button>
        }
      >
        <section className="page-content">
          <div className="error-state">
            <div className="error-icon">
              !
            </div>

            <h2>
              Supplier unavailable
            </h2>

            <p>
              {error}
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                router.push(
                  "/suppliers"
                )
              }
            >
              Back to Suppliers
            </button>
          </div>
        </section>

        <style jsx>{`
          .page-content {
            padding: 28px;
          }

          .error-state {
            min-height: 500px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .error-icon {
            width: 52px;
            height: 52px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16px;
            border-radius: 14px;
            background: #fef2f2;
            color: #dc2626;
            font-size: 24px;
            font-weight: 800;
          }

          .error-state h2 {
            margin: 0;
            color: #0f172a;
            font-size: 20px;
          }

          .error-state p {
            max-width: 560px;
            margin: 8px 0 20px;
            color: #94a3b8;
            font-size: 13px;
          }

          .primary-button,
          .secondary-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 40px;
            padding: 0 15px;
            border-radius: 9px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
          }

          .primary-button {
            border: 0;
            background: #0f172a;
            color: #ffffff;
          }

          .secondary-button {
            border: 1px solid #dbe1e8;
            background: #ffffff;
            color: #475569;
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Edit Supplier"
      description={
        supplierNumber
          ? `Update ${supplierNumber} supplier information and procurement terms.`
          : "Update supplier information and procurement terms."
      }
      actions={
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            router.push(
              `/suppliers/${supplierId}`
            )
          }
          disabled={saving}
        >
          Cancel
        </button>
      }
    >
      <section className="page-content">
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="supplier-form"
        >
          <section className="content-card">
            <div className="content-card-header">
              <div>
                <h2>
                  Supplier Information
                </h2>

                <p>
                  Update the supplier's identity and classification.
                </p>
              </div>

              {supplierNumber && (
                <div className="supplier-number">
                  {supplierNumber}
                </div>
              )}
            </div>

            <div className="form-content">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="legal_name">
                    Legal Name
                    <span>*</span>
                  </label>

                  <input
                    id="legal_name"
                    type="text"
                    value={
                      form.legal_name
                    }
                    onChange={(event) =>
                      updateField(
                        "legal_name",
                        event.target.value
                      )
                    }
                    placeholder="Supplier legal name"
                    required
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="display_name">
                    Display Name
                    <span>*</span>
                  </label>

                  <input
                    id="display_name"
                    type="text"
                    value={
                      form.display_name
                    }
                    onChange={(event) =>
                      updateField(
                        "display_name",
                        event.target.value
                      )
                    }
                    placeholder="Name shown throughout SBS"
                    required
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="supplier_type">
                    Supplier Type
                  </label>

                  <select
                    id="supplier_type"
                    value={
                      form.supplier_type
                    }
                    onChange={(event) =>
                      updateField(
                        "supplier_type",
                        event.target.value
                      )
                    }
                    disabled={saving}
                  >
                    {SUPPLIER_TYPES.map(
                      (type) => (
                        <option
                          key={type.value}
                          value={type.value}
                        >
                          {type.label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="status">
                    Status
                  </label>

                  <select
                    id="status"
                    value={form.status}
                    onChange={(event) =>
                      updateField(
                        "status",
                        event.target.value
                      )
                    }
                    disabled={saving}
                  >
                    {SUPPLIER_STATUSES.map(
                      (status) => (
                        <option
                          key={status.value}
                          value={status.value}
                        >
                          {status.label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-field full-width">
                  <label htmlFor="tax_id">
                    Tax ID
                  </label>

                  <input
                    id="tax_id"
                    type="text"
                    value={form.tax_id}
                    onChange={(event) =>
                      updateField(
                        "tax_id",
                        event.target.value
                      )
                    }
                    placeholder="Tax or VAT number"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="content-card">
            <div className="content-card-header">
              <div>
                <h2>
                  Contact Information
                </h2>

                <p>
                  Primary supplier contact details.
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
                    value={form.email}
                    onChange={(event) =>
                      updateField(
                        "email",
                        event.target.value
                      )
                    }
                    placeholder="supplier@example.com"
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
                    value={form.phone}
                    onChange={(event) =>
                      updateField(
                        "phone",
                        event.target.value
                      )
                    }
                    placeholder="+1 555 000 0000"
                    disabled={saving}
                  />
                </div>

                <div className="form-field full-width">
                  <label htmlFor="website">
                    Website
                  </label>

                  <input
                    id="website"
                    type="url"
                    value={form.website}
                    onChange={(event) =>
                      updateField(
                        "website",
                        event.target.value
                      )
                    }
                    placeholder="https://example.com"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="content-card">
            <div className="content-card-header">
              <div>
                <h2>
                  Procurement Terms
                </h2>

                <p>
                  Default purchasing and commercial terms for this supplier.
                </p>
              </div>
            </div>

            <div className="form-content">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="currency">
                    Currency
                  </label>

                  <input
                    id="currency"
                    type="text"
                    maxLength={3}
                    value={
                      form.currency
                    }
                    onChange={(event) =>
                      updateField(
                        "currency",
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="USD"
                    disabled={saving}
                  />

                  <small>
                    Use a 3-letter currency code.
                  </small>
                </div>

                <div className="form-field">
                  <label htmlFor="payment_terms_days">
                    Payment Terms
                  </label>

                  <div className="input-with-suffix">
                    <input
                      id="payment_terms_days"
                      type="number"
                      min="0"
                      step="1"
                      value={
                        form.payment_terms_days
                      }
                      onChange={(event) =>
                        updateField(
                          "payment_terms_days",
                          event.target.value
                        )
                      }
                      disabled={saving}
                    />

                    <span>
                      days
                    </span>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="credit_limit">
                    Credit Limit
                  </label>

                  <input
                    id="credit_limit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.credit_limit
                    }
                    onChange={(event) =>
                      updateField(
                        "credit_limit",
                        event.target.value
                      )
                    }
                    placeholder="0.00"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="minimum_order_amount">
                    Minimum Order Amount
                  </label>

                  <input
                    id="minimum_order_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.minimum_order_amount
                    }
                    onChange={(event) =>
                      updateField(
                        "minimum_order_amount",
                        event.target.value
                      )
                    }
                    placeholder="0.00"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="default_lead_time_days">
                    Default Lead Time
                  </label>

                  <div className="input-with-suffix">
                    <input
                      id="default_lead_time_days"
                      type="number"
                      min="0"
                      step="1"
                      value={
                        form.default_lead_time_days
                      }
                      onChange={(event) =>
                        updateField(
                          "default_lead_time_days",
                          event.target.value
                        )
                      }
                      disabled={saving}
                    />

                    <span>
                      days
                    </span>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="rating">
                    Rating
                  </label>

                  <input
                    id="rating"
                    type="number"
                    min="0"
                    max="5"
                    step="0.01"
                    value={form.rating}
                    onChange={(event) =>
                      updateField(
                        "rating",
                        event.target.value
                      )
                    }
                    placeholder="0 - 5"
                    disabled={saving}
                  />

                  <small>
                    Supplier rating from 0 to 5.
                  </small>
                </div>
              </div>
            </div>
          </section>

          <section className="content-card">
            <div className="content-card-header">
              <div>
                <h2>
                  Notes
                </h2>

                <p>
                  Internal information about this supplier.
                </p>
              </div>
            </div>

            <div className="form-content">
              <div className="form-field">
                <label htmlFor="notes">
                  Internal Notes
                </label>

                <textarea
                  id="notes"
                  rows={6}
                  value={form.notes}
                  onChange={(event) =>
                    updateField(
                      "notes",
                      event.target.value
                    )
                  }
                  placeholder="Add notes about this supplier..."
                  disabled={saving}
                />
              </div>
            </div>
          </section>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                router.push(
                  `/suppliers/${supplierId}`
                )
              }
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
                : "Save Changes"}
            </button>
          </div>
        </form>
      </section>

      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1200px;
        }

        .supplier-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
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

        .supplier-number {
          padding: 7px 10px;
          border-radius: 8px;
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .form-content {
          padding: 22px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-field.full-width {
          grid-column: 1 / -1;
        }

        .form-field label {
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .form-field label span {
          color: #dc2626;
          margin-left: 3px;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
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

        .form-field input,
        .form-field select {
          height: 42px;
          padding: 0 12px;
        }

        .form-field textarea {
          min-height: 140px;
          padding: 12px;
          resize: vertical;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.12);
        }

        .form-field input:disabled,
        .form-field select:disabled,
        .form-field textarea:disabled {
          background: #f8fafc;
          color: #64748b;
          cursor: not-allowed;
        }

        .form-field input::placeholder,
        .form-field textarea::placeholder {
          color: #94a3b8;
        }

        .form-field small {
          color: #94a3b8;
          font-size: 11px;
        }

        .input-with-suffix {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-with-suffix input {
          padding-right: 55px;
        }

        .input-with-suffix span {
          position: absolute;
          right: 12px;
          color: #94a3b8;
          font-size: 12px;
          pointer-events: none;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          padding-bottom: 10px;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .primary-button {
          border: 0;
          background: #0f172a;
          color: #ffffff;
        }

        .primary-button:hover:not(:disabled) {
          background: #1e293b;
        }

        .primary-button:disabled,
        .secondary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .secondary-button {
          border: 1px solid #dbe1e8;
          background: #ffffff;
          color: #475569;
        }

        .secondary-button:hover:not(:disabled) {
          background: #f8fafc;
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

        .loading-state {
          min-height: 500px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 13px;
        }

        .loading-spinner {
          width: 30px;
          height: 30px;
          margin-bottom: 12px;
          border: 3px solid #e2e8f0;
          border-top-color: #334155;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .error-state {
          min-height: 500px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .error-icon {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          border-radius: 14px;
          background: #fef2f2;
          color: #dc2626;
          font-size: 24px;
          font-weight: 800;
        }

        .error-state h2 {
          margin: 0;
          color: #0f172a;
          font-size: 20px;
        }

        .error-state p {
          max-width: 560px;
          margin: 8px 0 20px;
          color: #94a3b8;
          font-size: 13px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 18px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-field.full-width {
            grid-column: auto;
          }

          .content-card-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .form-actions {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .form-actions button {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}