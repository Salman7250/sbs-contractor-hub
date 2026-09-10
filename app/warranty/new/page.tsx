"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";

type Customer = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
};

type FormData = {
  warranty_number: string;
  customer_id: string;
  product_id: string;
  serial_number: string;
  coverage_type: string;
  purchase_date: string;
  start_date: string;
  end_date: string;
  terms: string;
  notes: string;
};

const initialForm: FormData = {
  warranty_number: "",
  customer_id: "",
  product_id: "",
  serial_number: "",
  coverage_type: "standard",
  purchase_date: "",
  start_date: "",
  end_date: "",
  terms: "",
  notes: "",
};

export default function NewWarrantyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormData>(initialForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setErrorMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("You must be signed in.");
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
          throw new Error("No company membership was found.");
        }

        const companyId = membership.company_id;

        const [customersResult, productsResult] = await Promise.all([
          supabase
            .from("customers")
            .select("id, name")
            .eq("company_id", companyId)
            .order("name", { ascending: true }),

          supabase
            .from("products")
            .select("id, name")
            .eq("company_id", companyId)
            .order("name", { ascending: true }),
        ]);

        if (customersResult.error) {
          throw new Error(customersResult.error.message);
        }

        if (productsResult.error) {
          throw new Error(productsResult.error.message);
        }

        if (cancelled) {
          return;
        }

        setCustomers(customersResult.data ?? []);
        setProducts(productsResult.data ?? []);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load warranty data.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function updateField<K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleStartDateChange(value: string) {
    setForm((current) => ({
      ...current,
      start_date: value,
      end_date:
        !current.end_date || current.end_date < value
          ? value
          : current.end_date,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    if (!form.start_date) {
      setErrorMessage("Start date is required.");
      return;
    }

    if (!form.end_date) {
      setErrorMessage("End date is required.");
      return;
    }

    if (form.end_date < form.start_date) {
      setErrorMessage("End date cannot be before the start date.");
      return;
    }

    if (!form.coverage_type) {
      setErrorMessage("Coverage type is required.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Your session has expired. Please sign in again.",
        );
      }

      const { data: membership, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError || !membership?.company_id) {
        throw new Error("No company membership was found.");
      }

      const companyId = membership.company_id;

      const {
        data: hasManagePermission,
        error: permissionError,
      } = await supabase.rpc("employee_has_permission", {
        p_company_id: companyId,
        p_module: "warranty",
        p_action: "manage",
      });

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("is_company_admin", {
          p_company_id: companyId,
        });

      if (permissionError) {
        throw new Error(permissionError.message);
      }

      if (adminError) {
        throw new Error(adminError.message);
      }

      if (!hasManagePermission && !isAdmin) {
        throw new Error(
          "You do not have permission to create warranty records.",
        );
      }

      if (form.customer_id) {
        const { data: customer, error: customerError } =
          await supabase
            .from("customers")
            .select("id")
            .eq("id", form.customer_id)
            .eq("company_id", companyId)
            .maybeSingle();

        if (customerError) {
          throw new Error(customerError.message);
        }

        if (!customer) {
          throw new Error("Selected customer was not found.");
        }
      }

      if (form.product_id) {
        const { data: product, error: productError } =
          await supabase
            .from("products")
            .select("id")
            .eq("id", form.product_id)
            .eq("company_id", companyId)
            .maybeSingle();

        if (productError) {
          throw new Error(productError.message);
        }

        if (!product) {
          throw new Error("Selected product was not found.");
        }
      }

      let warrantyNumber = form.warranty_number.trim();

      if (!warrantyNumber) {
        const { data: latestWarranty, error: latestError } =
          await supabase
            .from("warranties")
            .select("warranty_number")
            .eq("company_id", companyId)
            .like("warranty_number", "WAR-%")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestError) {
          throw new Error(latestError.message);
        }

        let nextNumber = 1;

        if (latestWarranty?.warranty_number) {
          const match =
            latestWarranty.warranty_number.match(/^WAR-(\d+)$/);

          if (match) {
            nextNumber = Number(match[1]) + 1;
          }
        }

        warrantyNumber = `WAR-${String(nextNumber).padStart(5, "0")}`;
      }

      const { data: existingWarranty, error: existingError } =
        await supabase
          .from("warranties")
          .select("id")
          .eq("company_id", companyId)
          .eq("warranty_number", warrantyNumber)
          .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      if (existingWarranty) {
        throw new Error(
          `Warranty number ${warrantyNumber} already exists.`,
        );
      }

      const { data: warranty, error: insertError } =
        await supabase
          .from("warranties")
          .insert({
            company_id: companyId,
            warranty_number: warrantyNumber,
            customer_id: form.customer_id || null,
            product_id: form.product_id || null,
            serial_number: form.serial_number.trim() || null,
            coverage_type: form.coverage_type,
            purchase_date: form.purchase_date || null,
            start_date: form.start_date,
            end_date: form.end_date,
            terms: form.terms.trim() || null,
            notes: form.notes.trim() || null,
            created_by: user.id,
          })
          .select("id")
          .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      if (!warranty?.id) {
        throw new Error(
          "Warranty was created but no ID was returned.",
        );
      }

      router.push(`/warranty/${warranty.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create warranty.",
      );
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="loading-card">
            <Loader2 size={22} className="spinner" />
            <span>Loading warranty form...</span>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .loading-card {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              min-height: 260px;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              background: #ffffff;
              color: #6b7280;
              font-size: 14px;
              box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
            }

            .spinner {
              animation: spin 0.9s linear infinite;
            }

            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="page-content">
        <div className="page-header">
          <button
            type="button"
            className="back-button"
            onClick={() => router.push("/warranty")}
          >
            <ArrowLeft size={16} />
            Back to Warranty
          </button>

          <div className="title-row">
            <div className="title-icon">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1>New Warranty</h1>
              <p>
                Create a warranty record for a customer or product.
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="error-banner" role="alert">
            <strong>Unable to save warranty</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <section className="form-card">
            <div className="section-header">
              <div>
                <h2>Warranty Information</h2>
                <p>
                  Identify the warranty and define its coverage.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="warranty_number">
                  Warranty Number
                </label>

                <input
                  id="warranty_number"
                  type="text"
                  value={form.warranty_number}
                  onChange={(event) =>
                    updateField(
                      "warranty_number",
                      event.target.value,
                    )
                  }
                  placeholder="Auto-generated if left blank"
                />

                <span className="field-help">
                  Leave blank to generate the next SBS warranty number.
                </span>
              </div>

              <div className="field">
                <label htmlFor="coverage_type">
                  Coverage Type <span className="required">*</span>
                </label>

                <select
                  id="coverage_type"
                  value={form.coverage_type}
                  onChange={(event) =>
                    updateField(
                      "coverage_type",
                      event.target.value,
                    )
                  }
                  required
                >
                  <option value="standard">Standard</option>
                  <option value="extended">Extended</option>
                  <option value="limited">Limited</option>
                  <option value="parts_only">Parts Only</option>
                  <option value="labor_only">Labor Only</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="customer_id">Customer</label>

                <select
                  id="customer_id"
                  value={form.customer_id}
                  onChange={(event) =>
                    updateField(
                      "customer_id",
                      event.target.value,
                    )
                  }
                >
                  <option value="">No customer selected</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="product_id">Product</label>

                <select
                  id="product_id"
                  value={form.product_id}
                  onChange={(event) =>
                    updateField(
                      "product_id",
                      event.target.value,
                    )
                  }
                >
                  <option value="">No product selected</option>

                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field full-width">
                <label htmlFor="serial_number">Serial Number</label>

                <input
                  id="serial_number"
                  type="text"
                  value={form.serial_number}
                  onChange={(event) =>
                    updateField(
                      "serial_number",
                      event.target.value,
                    )
                  }
                  placeholder="Enter product serial number"
                />

                <span className="field-help">
                  Use the serial number to identify the exact covered
                  unit.
                </span>
              </div>
            </div>
          </section>

          <section className="form-card">
            <div className="section-header">
              <div>
                <h2>Coverage Period</h2>
                <p>
                  Set the purchase date and warranty coverage dates.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="purchase_date">Purchase Date</label>

                <div className="input-with-icon">
                  <CalendarDays size={17} />

                  <input
                    id="purchase_date"
                    type="date"
                    value={form.purchase_date}
                    onChange={(event) =>
                      updateField(
                        "purchase_date",
                        event.target.value,
                      )
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="start_date">
                  Start Date <span className="required">*</span>
                </label>

                <div className="input-with-icon">
                  <CalendarDays size={17} />

                  <input
                    id="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={(event) =>
                      handleStartDateChange(event.target.value)
                    }
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="end_date">
                  End Date <span className="required">*</span>
                </label>

                <div className="input-with-icon">
                  <CalendarDays size={17} />

                  <input
                    id="end_date"
                    type="date"
                    value={form.end_date}
                    min={form.start_date || undefined}
                    onChange={(event) =>
                      updateField(
                        "end_date",
                        event.target.value,
                      )
                    }
                    required
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="form-card">
            <div className="section-header">
              <div>
                <h2>Terms & Notes</h2>
                <p>
                  Add additional information about this warranty.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field full-width">
                <label htmlFor="terms">Warranty Terms</label>

                <textarea
                  id="terms"
                  value={form.terms}
                  onChange={(event) =>
                    updateField("terms", event.target.value)
                  }
                  placeholder="Describe what is covered, exclusions, conditions, etc."
                  rows={5}
                />
              </div>

              <div className="field full-width">
                <label htmlFor="notes">Internal Notes</label>

                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(event) =>
                    updateField("notes", event.target.value)
                  }
                  placeholder="Add internal notes for your team..."
                  rows={4}
                />
              </div>
            </div>
          </section>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => router.push("/warranty")}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="save-button"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 size={17} className="spinner" />
                  Creating...
                </>
              ) : (
                <>
                  <Save size={17} />
                  Create Warranty
                </>
              )}
            </button>
          </div>
        </form>

        <style jsx>{`
          .page-content {
            padding: 28px;
            max-width: 1200px;
            margin: 0 auto;
          }

          .page-header {
            margin-bottom: 22px;
          }

          .back-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            min-height: 38px;
            margin-bottom: 18px;
            padding: 0 13px;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            background: #ffffff;
            color: #374151;
            font-family: inherit;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition:
              background 0.15s ease,
              border-color 0.15s ease,
              color 0.15s ease;
          }

          .back-button:hover {
            background: #f9fafb;
            border-color: #9ca3af;
            color: #111827;
          }

          .back-button:active {
            background: #f3f4f6;
          }

          .title-row {
            display: flex;
            align-items: center;
            gap: 13px;
          }

          .title-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: #f3f4f6;
            color: #374151;
          }

          h1 {
            margin: 0;
            color: #111827;
            font-size: 28px;
            line-height: 1.2;
            font-weight: 700;
            letter-spacing: -0.02em;
          }

          .title-row p {
            margin: 5px 0 0;
            color: #6b7280;
            font-size: 14px;
          }

          .error-banner {
            display: flex;
            flex-direction: column;
            gap: 3px;
            margin-bottom: 18px;
            padding: 13px 15px;
            border: 1px solid #fecaca;
            border-radius: 10px;
            background: #fef2f2;
            color: #991b1b;
            font-size: 13px;
          }

          .error-banner strong {
            font-weight: 700;
          }

          .form-card {
            margin-bottom: 18px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          }

          .section-header {
            padding: 20px 22px;
            border-bottom: 1px solid #e5e7eb;
          }

          .section-header h2 {
            margin: 0;
            color: #111827;
            font-size: 16px;
            font-weight: 700;
          }

          .section-header p {
            margin: 5px 0 0;
            color: #6b7280;
            font-size: 13px;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
            padding: 22px;
          }

          .field {
            min-width: 0;
          }

          .full-width {
            grid-column: 1 / -1;
          }

          .field label {
            display: block;
            margin-bottom: 7px;
            color: #374151;
            font-size: 13px;
            font-weight: 600;
          }

          .required {
            color: #dc2626;
          }

          .field input,
          .field select,
          .field textarea {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            outline: none;
            background: #ffffff;
            color: #111827;
            font-family: inherit;
            font-size: 14px;
            transition:
              border-color 0.15s ease,
              box-shadow 0.15s ease;
          }

          .field input,
          .field select {
            height: 42px;
            padding: 0 12px;
          }

          .field textarea {
            min-height: 100px;
            padding: 11px 12px;
            resize: vertical;
            line-height: 1.5;
          }

          .field input::placeholder,
          .field textarea::placeholder {
            color: #9ca3af;
          }

          .field input:focus,
          .field select:focus,
          .field textarea:focus {
            border-color: #9ca3af;
            box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.06);
          }

          .input-with-icon {
            position: relative;
          }

          .input-with-icon svg {
            position: absolute;
            top: 50%;
            left: 12px;
            color: #9ca3af;
            pointer-events: none;
            transform: translateY(-50%);
          }

          .input-with-icon input {
            padding-left: 38px;
          }

          .field-help {
            display: block;
            margin-top: 6px;
            color: #9ca3af;
            font-size: 11px;
            line-height: 1.4;
          }

          .form-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            padding: 4px 0 10px;
          }

          .cancel-button,
          .save-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-height: 42px;
            padding: 0 17px;
            border-radius: 9px;
            font-family: inherit;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }

          .cancel-button {
            border: 1px solid #d1d5db;
            background: #ffffff;
            color: #374151;
          }

          .cancel-button:hover:not(:disabled) {
            background: #f9fafb;
            border-color: #9ca3af;
          }

          .save-button {
            border: 1px solid #111827;
            background: #111827;
            color: #ffffff;
          }

          .save-button:hover:not(:disabled) {
            background: #1f2937;
          }

          .cancel-button:disabled,
          .save-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .spinner {
            animation: spin 0.9s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 768px) {
            .page-content {
              padding: 20px;
            }

            .form-grid {
              grid-template-columns: 1fr;
            }

            .full-width {
              grid-column: auto;
            }
          }

          @media (max-width: 560px) {
            .page-content {
              padding: 16px;
            }

            h1 {
              font-size: 24px;
            }

            .form-actions {
              flex-direction: column-reverse;
              align-items: stretch;
            }

            .cancel-button,
            .save-button {
              width: 100%;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}