"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  MapPin,
  Save,
  Star,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Warehouse = {
  id: string;
  company_id: string;
  name: string;
  code: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  is_default: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type WarehouseForm = {
  name: string;
  code: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  is_active: boolean;
  is_default: boolean;
  notes: string;
};

const EMPTY_FORM: WarehouseForm = {
  name: "",
  code: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  phone: "",
  email: "",
  is_active: true,
  is_default: false,
  notes: "",
};

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export default function EditWarehousePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();

  const warehouseId =
    typeof params?.warehouseId === "string"
      ? params.warehouseId
      : "";

  const [companyId, setCompanyId] = useState<string | null>(
    null
  );

  const [warehouse, setWarehouse] =
    useState<Warehouse | null>(null);

  const [form, setForm] =
    useState<WarehouseForm>(EMPTY_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const getCompanyId = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    const { data: membership, error: membershipError } =
      await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    if (!membership?.company_id) {
      throw new Error(
        "No company workspace is available for your account."
      );
    }

    return membership.company_id;
  }, [supabase]);

  const loadWarehouse = useCallback(async () => {
    if (!warehouseId) {
      setErrorMessage("Invalid warehouse.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const currentCompanyId = await getCompanyId();

      setCompanyId(currentCompanyId);

      const { data, error } = await supabase
        .from("warehouses")
        .select(
          `
            id,
            company_id,
            name,
            code,
            address_line1,
            address_line2,
            city,
            state,
            postal_code,
            country,
            phone,
            email,
            is_active,
            is_default,
            notes,
            created_at,
            updated_at
          `
        )
        .eq("id", warehouseId)
        .eq("company_id", currentCompanyId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error(
          "Warehouse not found or you do not have access to it."
        );
      }

      const warehouseData = data as Warehouse;

      setWarehouse(warehouseData);

      setForm({
        name: warehouseData.name ?? "",
        code: warehouseData.code ?? "",
        address_line1:
          warehouseData.address_line1 ?? "",
        address_line2:
          warehouseData.address_line2 ?? "",
        city: warehouseData.city ?? "",
        state: warehouseData.state ?? "",
        postal_code:
          warehouseData.postal_code ?? "",
        country: warehouseData.country ?? "",
        phone: warehouseData.phone ?? "",
        email: warehouseData.email ?? "",
        is_active: warehouseData.is_active,
        is_default: warehouseData.is_default,
        notes: warehouseData.notes ?? "",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load warehouse."
      );
    } finally {
      setLoading(false);
    }
  }, [getCompanyId, supabase, warehouseId]);

  useEffect(() => {
    void loadWarehouse();
  }, [loadWarehouse]);

  function updateField<K extends keyof WarehouseForm>(
    field: K,
    value: WarehouseForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveWarehouse() {
    if (!companyId || !warehouse) {
      setErrorMessage(
        "Unable to determine the warehouse workspace."
      );
      return;
    }

    const name = form.name.trim();
    const code = normalizeCode(form.code);

    if (!name) {
      setErrorMessage("Warehouse name is required.");
      return;
    }

    if (!code) {
      setErrorMessage("Warehouse code is required.");
      return;
    }

    if (form.email.trim()) {
      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(form.email.trim())) {
        setErrorMessage(
          "Please enter a valid warehouse email address."
        );
        return;
      }
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      /*
       * Check for a duplicate warehouse code within the
       * current company, excluding this warehouse.
       */
      const { data: duplicateWarehouse, error: duplicateError } =
        await supabase
          .from("warehouses")
          .select("id, name, code")
          .eq("company_id", companyId)
          .ilike("code", code)
          .neq("id", warehouse.id)
          .limit(1)
          .maybeSingle();

      if (duplicateError) {
        throw new Error(duplicateError.message);
      }

      if (duplicateWarehouse) {
        throw new Error(
          `Warehouse code "${code}" is already in use.`
        );
      }

      /*
       * If this warehouse is being made default, clear the
       * existing default first.
       */
      if (form.is_default && form.is_active) {
        const { error: clearDefaultError } =
          await supabase
            .from("warehouses")
            .update({
              is_default: false,
              updated_at: new Date().toISOString(),
            })
            .eq("company_id", companyId)
            .eq("is_default", true)
            .neq("id", warehouse.id);

        if (clearDefaultError) {
          throw new Error(
            clearDefaultError.message
          );
        }
      }

      /*
       * An inactive warehouse cannot remain the default.
       */
      const shouldBeDefault =
        form.is_active && form.is_default;

      const { data: updatedWarehouse, error: updateError } =
        await supabase
          .from("warehouses")
          .update({
            name,
            code,
            address_line1:
              form.address_line1.trim() || null,
            address_line2:
              form.address_line2.trim() || null,
            city: form.city.trim() || null,
            state: form.state.trim() || null,
            postal_code:
              form.postal_code.trim() || null,
            country: form.country.trim() || null,
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            is_active: form.is_active,
            is_default: shouldBeDefault,
            notes: form.notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", warehouse.id)
          .eq("company_id", companyId)
          .select(
            `
              id,
              company_id,
              name,
              code,
              address_line1,
              address_line2,
              city,
              state,
              postal_code,
              country,
              phone,
              email,
              is_active,
              is_default,
              notes,
              created_at,
              updated_at
            `
          )
          .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setWarehouse(updatedWarehouse as Warehouse);

      setForm((current) => ({
        ...current,
        code,
        name,
        is_default: shouldBeDefault,
      }));

      setSuccessMessage(
        "Warehouse updated successfully."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update warehouse."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="page-content edit-warehouse-page">
          <div className="loading-state">
            <div className="spinner" />
            <span>Loading warehouse...</span>
          </div>

          <style jsx>{`
            .loading-state {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              gap: 10px;
              color: #64748b;
              font-size: 13px;
            }

            .spinner {
              width: 18px;
              height: 18px;
              border: 2px solid #dcfce7;
              border-top-color: #166534;
              border-radius: 999px;
              animation: spin 0.75s linear infinite;
            }

            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </AppShell>
    );
  }

  if (!warehouse) {
    return (
      <AppShell>
        <div className="page-content edit-warehouse-page">
          <div className="error-page">
            <div className="error-icon">
              <WarehouseIcon size={25} />
            </div>

            <h2>Warehouse unavailable</h2>

            <p>
              {errorMessage ||
                "The warehouse could not be found."}
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                router.push("/warehouses")
              }
            >
              <ArrowLeft size={16} />
              Back to Warehouses
            </button>
          </div>

          <style jsx>{`
            .error-page {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 450px;
              text-align: center;
            }

            .error-icon {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 56px;
              height: 56px;
              margin-bottom: 14px;
              border-radius: 14px;
              background: #f0fdf4;
              color: #166534;
            }

            .error-page h2 {
              margin: 0 0 6px;
              color: #0f172a;
              font-size: 17px;
            }

            .error-page p {
              max-width: 450px;
              margin: 0 0 18px;
              color: #64748b;
              font-size: 13px;
              line-height: 1.6;
            }

            .primary-button {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              min-height: 40px;
              padding: 0 15px;
              border: 1px solid #166534;
              border-radius: 9px;
              background: #166534;
              color: white;
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
            }
          `}</style>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content edit-warehouse-page">
        <div className="page-header">
          <div>
            <button
              type="button"
              className="back-button"
              onClick={() =>
                router.push("/warehouses")
              }
            >
              <ArrowLeft size={16} />
              Back to Warehouses
            </button>

            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Warehouse Management
            </div>

            <h1 className="page-title">
              Edit Warehouse
            </h1>

            <p className="page-subtitle">
              Update the configuration and contact
              information for this warehouse.
            </p>
          </div>

          <div className="header-status">
            {warehouse.is_default && (
              <span className="default-badge">
                <Star size={13} />
                Default Warehouse
              </span>
            )}

            <span
              className={`status-badge ${
                warehouse.is_active
                  ? "status-active"
                  : "status-inactive"
              }`}
            >
              {warehouse.is_active
                ? "Active"
                : "Inactive"}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="alert error-alert">
            <X size={17} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert success-alert">
            <Check size={17} />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="form-layout">
          <div className="main-form">
            <section className="form-card">
              <div className="card-header">
                <div className="card-header-icon">
                  <WarehouseIcon size={19} />
                </div>

                <div>
                  <h2>Warehouse Information</h2>
                  <p>
                    Basic identification for this warehouse.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field full-width">
                  <label>Warehouse Name *</label>

                  <input
                    value={form.name}
                    onChange={(event) =>
                      updateField(
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="e.g. Main Warehouse"
                  />
                </div>

                <div className="field">
                  <label>Warehouse Code *</label>

                  <input
                    value={form.code}
                    onChange={(event) =>
                      updateField(
                        "code",
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="e.g. MAIN"
                    maxLength={50}
                  />

                  <span className="field-help">
                    This code is used as the warehouse
                    identifier throughout the system.
                  </span>
                </div>

                <div className="field">
                  <label>Country</label>

                  <input
                    value={form.country}
                    onChange={(event) =>
                      updateField(
                        "country",
                        event.target.value
                      )
                    }
                    placeholder="e.g. United Arab Emirates"
                  />
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div className="card-header-icon">
                  <MapPin size={19} />
                </div>

                <div>
                  <h2>Warehouse Address</h2>
                  <p>
                    Physical address and geographic
                    information.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field full-width">
                  <label>Address Line 1</label>

                  <input
                    value={form.address_line1}
                    onChange={(event) =>
                      updateField(
                        "address_line1",
                        event.target.value
                      )
                    }
                    placeholder="Street address"
                  />
                </div>

                <div className="field full-width">
                  <label>Address Line 2</label>

                  <input
                    value={form.address_line2}
                    onChange={(event) =>
                      updateField(
                        "address_line2",
                        event.target.value
                      )
                    }
                    placeholder="Building, unit, suite, etc."
                  />
                </div>

                <div className="field">
                  <label>City</label>

                  <input
                    value={form.city}
                    onChange={(event) =>
                      updateField(
                        "city",
                        event.target.value
                      )
                    }
                    placeholder="City"
                  />
                </div>

                <div className="field">
                  <label>State / Province</label>

                  <input
                    value={form.state}
                    onChange={(event) =>
                      updateField(
                        "state",
                        event.target.value
                      )
                    }
                    placeholder="State / Province"
                  />
                </div>

                <div className="field">
                  <label>Postal Code</label>

                  <input
                    value={form.postal_code}
                    onChange={(event) =>
                      updateField(
                        "postal_code",
                        event.target.value
                      )
                    }
                    placeholder="Postal code"
                  />
                </div>

                <div className="field">
                  <label>Country</label>

                  <input
                    value={form.country}
                    onChange={(event) =>
                      updateField(
                        "country",
                        event.target.value
                      )
                    }
                    placeholder="Country"
                  />
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div className="card-header-icon">
                  <MapPin size={19} />
                </div>

                <div>
                  <h2>Contact Information</h2>
                  <p>
                    Optional contact details for this
                    warehouse.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Phone</label>

                  <input
                    value={form.phone}
                    onChange={(event) =>
                      updateField(
                        "phone",
                        event.target.value
                      )
                    }
                    placeholder="Warehouse phone"
                  />
                </div>

                <div className="field">
                  <label>Email</label>

                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField(
                        "email",
                        event.target.value
                      )
                    }
                    placeholder="warehouse@example.com"
                  />
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div className="card-header-icon">
                  <Check size={19} />
                </div>

                <div>
                  <h2>Settings & Notes</h2>
                  <p>
                    Manage warehouse status and default
                    behavior.
                  </p>
                </div>
              </div>

              <div className="settings-list">
                <label className="setting-row">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) =>
                      updateField(
                        "is_active",
                        event.target.checked
                      )
                    }
                  />

                  <span className="setting-content">
                    <strong>Active warehouse</strong>

                    <small>
                      Allow this warehouse to be selected
                      for inventory operations.
                    </small>
                  </span>
                </label>

                <label
                  className={`setting-row ${
                    !form.is_active
                      ? "setting-disabled"
                      : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={
                      form.is_default && form.is_active
                    }
                    disabled={!form.is_active}
                    onChange={(event) =>
                      updateField(
                        "is_default",
                        event.target.checked
                      )
                    }
                  />

                  <span className="setting-content">
                    <strong>
                      <Star
                        size={14}
                        className="inline-star"
                      />
                      Make default warehouse
                    </strong>

                    <small>
                      New inventory workflows can use
                      this warehouse as the default.
                    </small>
                  </span>
                </label>
              </div>

              <div className="notes-section">
                <label>Notes</label>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    updateField(
                      "notes",
                      event.target.value
                    )
                  }
                  rows={5}
                  placeholder="Optional internal notes about this warehouse..."
                />
              </div>
            </section>
          </div>

          <aside className="side-panel">
            <div className="summary-card">
              <div className="summary-header">
                <WarehouseIcon size={18} />
                <span>Warehouse</span>
              </div>

              <div className="preview-icon">
                <WarehouseIcon size={27} />
              </div>

              <h3>
                {form.name.trim() ||
                  "Warehouse"}
              </h3>

              <div className="preview-code">
                {normalizeCode(form.code) ||
                  "CODE"}
              </div>

              <div className="preview-divider" />

              <div className="preview-row">
                <span>Status</span>

                <strong>
                  {form.is_active ? (
                    <span className="preview-status active">
                      Active
                    </span>
                  ) : (
                    <span className="preview-status inactive">
                      Inactive
                    </span>
                  )}
                </strong>
              </div>

              <div className="preview-row">
                <span>Default</span>

                <strong>
                  {form.is_default &&
                  form.is_active
                    ? "Yes"
                    : "No"}
                </strong>
              </div>

              <div className="preview-row">
                <span>Warehouse ID</span>

                <strong className="id-value">
                  {warehouse.id.slice(0, 8)}...
                </strong>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon">
                <MapPin size={17} />
              </div>

              <div>
                <h3>Locations</h3>

                <p>
                  Internal warehouse locations are
                  managed separately from the warehouse
                  record. Use the Warehouses page to
                  manage zones, racks, shelves, bins,
                  receiving, shipping, returns, and
                  quarantine locations.
                </p>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon">
                <Check size={17} />
              </div>

              <div>
                <h3>Inventory V2</h3>

                <p>
                  Changes made here affect the warehouse
                  available to Inventory V2 operations.
                </p>
              </div>
            </div>
          </aside>
        </div>

        <div className="bottom-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push("/warehouses")
            }
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => void saveWarehouse()}
            disabled={saving || !companyId}
          >
            {saving ? (
              <>
                <span className="button-spinner" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>

        <style jsx>{`
          .edit-warehouse-page {
            width: 100%;
            padding-bottom: 30px;
          }

          .page-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 22px;
          }

          .back-button {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            margin-bottom: 18px;
            padding: 0;
            border: 0;
            background: transparent;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }

          .back-button:hover {
            color: #166534;
          }

          .eyebrow {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 7px;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .eyebrow-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #166534;
          }

          .page-title {
            margin: 0;
            color: #0f172a;
            font-size: 30px;
            line-height: 1.15;
            font-weight: 750;
            letter-spacing: -0.03em;
          }

          .page-subtitle {
            max-width: 700px;
            margin: 7px 0 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.6;
          }

          .header-status {
            display: flex;
            align-items: center;
            gap: 7px;
            padding-bottom: 2px;
          }

          .status-badge,
          .default-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            min-height: 27px;
            padding: 0 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
          }

          .status-active {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #166534;
          }

          .status-inactive {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            color: #64748b;
          }

          .default-badge {
            border: 1px solid #fde68a;
            background: #fffbeb;
            color: #92400e;
          }

          .alert {
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 11px 14px;
            margin-bottom: 16px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
          }

          .error-alert {
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #b91c1c;
          }

          .success-alert {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #166534;
          }

          .form-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 320px;
            align-items: start;
            gap: 16px;
          }

          .main-form {
            display: flex;
            flex-direction: column;
            gap: 16px;
            min-width: 0;
          }

          .form-card,
          .summary-card,
          .info-card {
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: white;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035);
          }

          .card-header {
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 18px;
            border-bottom: 1px solid #eef2f7;
          }

          .card-header-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            flex: 0 0 38px;
            border-radius: 10px;
            background: #f0fdf4;
            color: #166534;
          }

          .card-header h2 {
            margin: 0;
            color: #0f172a;
            font-size: 14px;
          }

          .card-header p {
            margin: 3px 0 0;
            color: #94a3b8;
            font-size: 11px;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 15px;
            padding: 18px;
          }

          .field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .field.full-width {
            grid-column: 1 / -1;
          }

          .field label,
          .notes-section label {
            color: #334155;
            font-size: 11px;
            font-weight: 750;
          }

          .field input,
          .notes-section textarea {
            width: 100%;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            outline: none;
            background: white;
            color: #0f172a;
            font-size: 13px;
          }

          .field input {
            height: 42px;
            padding: 0 11px;
          }

          .field input:focus,
          .notes-section textarea:focus {
            border-color: #86a68f;
            box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
          }

          .field-help {
            color: #94a3b8;
            font-size: 10px;
            line-height: 1.4;
          }

          .settings-list {
            padding: 8px 18px;
          }

          .setting-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px 0;
            cursor: pointer;
          }

          .setting-row + .setting-row {
            border-top: 1px solid #eef2f7;
          }

          .setting-row input {
            width: 16px;
            height: 16px;
            margin: 2px 0 0;
            accent-color: #166534;
          }

          .setting-content {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .setting-content strong {
            display: flex;
            align-items: center;
            gap: 5px;
            color: #334155;
            font-size: 12px;
          }

          .setting-content small {
            color: #94a3b8;
            font-size: 10px;
            line-height: 1.5;
          }

          .setting-disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }

          .inline-star {
            color: #a16207;
          }

          .notes-section {
            display: flex;
            flex-direction: column;
            gap: 7px;
            padding: 0 18px 18px;
          }

          .notes-section textarea {
            padding: 11px;
            resize: vertical;
          }

          .side-panel {
            position: sticky;
            top: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .summary-card {
            padding: 18px;
          }

          .summary-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 22px;
            color: #64748b;
            font-size: 11px;
            font-weight: 750;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .preview-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 58px;
            height: 58px;
            margin-bottom: 13px;
            border-radius: 14px;
            background: #f0fdf4;
            color: #166534;
          }

          .summary-card h3 {
            margin: 0;
            color: #0f172a;
            font-size: 18px;
            line-height: 1.3;
          }

          .preview-code {
            display: inline-flex;
            margin-top: 7px;
            padding: 5px 8px;
            border: 1px solid #e2e8f0;
            border-radius: 7px;
            background: #f8fafc;
            color: #475569;
            font-family: ui-monospace, SFMono-Regular, Menlo,
              Monaco, Consolas, monospace;
            font-size: 10px;
            font-weight: 750;
          }

          .preview-divider {
            height: 1px;
            margin: 18px 0 12px;
            background: #eef2f7;
          }

          .preview-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 8px 0;
            color: #64748b;
            font-size: 11px;
          }

          .preview-row strong {
            max-width: 160px;
            color: #334155;
            font-size: 11px;
            text-align: right;
          }

          .preview-status {
            display: inline-flex;
            align-items: center;
            min-height: 23px;
            padding: 0 7px;
            border-radius: 999px;
            font-size: 10px;
          }

          .preview-status.active {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #166534;
          }

          .preview-status.inactive {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            color: #64748b;
          }

          .id-value {
            font-family: ui-monospace, SFMono-Regular, Menlo,
              Monaco, Consolas, monospace;
            font-size: 10px !important;
          }

          .info-card {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 15px;
          }

          .info-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 31px;
            height: 31px;
            flex: 0 0 31px;
            border-radius: 8px;
            background: #f0fdf4;
            color: #166534;
          }

          .info-card h3 {
            margin: 1px 0 5px;
            color: #334155;
            font-size: 12px;
          }

          .info-card p {
            margin: 0;
            color: #64748b;
            font-size: 11px;
            line-height: 1.55;
          }

          .bottom-actions {
            display: flex;
            justify-content: flex-end;
            gap: 9px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
          }

          .primary-button,
          .secondary-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-height: 40px;
            padding: 0 15px;
            border-radius: 9px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition:
              background 0.15s ease,
              border-color 0.15s ease,
              opacity 0.15s ease;
          }

          .primary-button {
            border: 1px solid #166534;
            background: #166534;
            color: white;
          }

          .primary-button:hover {
            border-color: #14532d;
            background: #14532d;
          }

          .secondary-button {
            border: 1px solid #d1d5db;
            background: white;
            color: #334155;
          }

          .secondary-button:hover {
            border-color: #94a3b8;
            background: #f8fafc;
          }

          .primary-button:disabled,
          .secondary-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .button-spinner {
            width: 14px;
            height: 14px;
            border: 2px solid #dcfce7;
            border-top-color: white;
            border-radius: 999px;
            animation: spin 0.75s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 1000px) {
            .form-layout {
              grid-template-columns: 1fr;
            }

            .side-panel {
              position: static;
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .summary-card {
              grid-row: span 2;
            }
          }

          @media (max-width: 700px) {
            .page-header {
              align-items: flex-start;
              flex-direction: column;
            }

            .header-status {
              padding-bottom: 0;
            }

            .form-grid {
              grid-template-columns: 1fr;
            }

            .field.full-width {
              grid-column: auto;
            }

            .side-panel {
              display: flex;
            }

            .page-title {
              font-size: 26px;
            }

            .bottom-actions {
              flex-direction: column-reverse;
            }

            .bottom-actions button {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </AppShell>
  );
}