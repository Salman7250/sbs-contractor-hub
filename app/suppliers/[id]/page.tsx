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
  created_at: string;
  updated_at: string;
};

type SupplierProduct = {
  id: string;
  supplier_id: string;
  product_id: string;
};

const SUPPLIER_TYPES = [
  "manufacturer",
  "distributor",
  "wholesaler",
  "vendor",
  "service_provider",
  "other",
];

export default function SupplierDetailsPage() {
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

  const [supplier, setSupplier] =
    useState<Supplier | null>(null);

  const [supplierProducts, setSupplierProducts] =
    useState<SupplierProduct[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadSupplier = useCallback(async () => {
    if (!supplierId) {
      setError("Supplier ID is missing.");
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

      const companyId =
        membership.company_id;

      const [
        supplierResult,
        supplierProductsResult,
      ] = await Promise.all([
        supabase
          .from("suppliers")
          .select("*")
          .eq("id", supplierId)
          .eq("company_id", companyId)
          .maybeSingle(),

        supabase
          .from("supplier_products")
          .select(
            "id, supplier_id, product_id"
          )
          .eq("supplier_id", supplierId)
          .eq("company_id", companyId),
      ]);

      if (supplierResult.error) {
        throw supplierResult.error;
      }

      if (
        supplierProductsResult.error
      ) {
        throw supplierProductsResult.error;
      }

      if (!supplierResult.data) {
        setError(
          "Supplier not found or you do not have access to it."
        );
        setSupplier(null);
        setSupplierProducts([]);
        return;
      }

      setSupplier(
        supplierResult.data
      );

      setSupplierProducts(
        supplierProductsResult.data || []
      );
    } catch (err: unknown) {
      console.error(
        "Supplier details load error:",
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
    // Load the supplier asynchronously.
     
    void loadSupplier();
  }, [loadSupplier]);

  function formatSupplierType(
    type: string
  ) {
    if (
      type ===
      "service_provider"
    ) {
      return "Service Provider";
    }

    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function formatStatus(
    status: string
  ) {
    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function formatDate(
    date: string | null
  ) {
    if (!date) {
      return "—";
    }

    const parsed = new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return "—";
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

  function formatDateTime(
    date: string | null
  ) {
    if (!date) {
      return "—";
    }

    const parsed = new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return "—";
    }

    return parsed.toLocaleString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  function formatAmount(
    amount: number | null | undefined
  ) {
    const value =
      Number(amount || 0);

    return value.toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function getStatusClass(
    status: string
  ) {
    switch (status) {
      case "active":
        return "status-active";

      case "inactive":
        return "status-inactive";

      case "blocked":
        return "status-blocked";

      default:
        return "status-inactive";
    }
  }

  function openWebsite(
    website: string
  ) {
    let url = website.trim();

    if (!url) {
      return;
    }

    if (
      !/^https?:\/\//i.test(url)
    ) {
      url = `https://${url}`;
    }

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  if (loading) {
    return (
      <AppShell
        title="Supplier"
        description="Supplier details and procurement information."
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

  if (error || !supplier) {
    return (
      <AppShell
        title="Supplier"
        description="Supplier details and procurement information."
        actions={
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push(
                "/suppliers"
              )
            }
          >
            ← Back to Suppliers
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
              {error ||
                "The supplier could not be found."}
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
            max-width: 520px;
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

          .primary-button:hover {
            background: #1e293b;
          }

          .secondary-button {
            border: 1px solid #dbe1e8;
            background: #ffffff;
            color: #475569;
          }

          .secondary-button:hover {
            background: #f8fafc;
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={supplier.display_name}
      description={`${supplier.supplier_number} · ${formatSupplierType(
        supplier.supplier_type
      )}`}
      actions={
        <>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push(
                "/suppliers"
              )
            }
          >
            ← Suppliers
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              router.push(
                `/suppliers/${supplier.id}/edit`
              )
            }
          >
            Edit Supplier
          </button>
        </>
      }
    >
      <section className="page-content">
        <section className="supplier-header-card">
          <div className="supplier-header-main">
            <div className="supplier-avatar">
              {supplier.display_name
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <div className="supplier-title-row">
                <h1>
                  {supplier.display_name}
                </h1>

                <span
                  className={`status-badge ${getStatusClass(
                    supplier.status
                  )}`}
                >
                  {formatStatus(
                    supplier.status
                  )}
                </span>
              </div>

              <div className="supplier-meta">
                <span>
                  {
                    supplier.supplier_number
                  }
                </span>

                <span>•</span>

                <span>
                  {formatSupplierType(
                    supplier.supplier_type
                  )}
                </span>

                {supplier.legal_name !==
                  supplier.display_name && (
                  <>
                    <span>
                      •
                    </span>

                    <span>
                      {
                        supplier.legal_name
                      }
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="header-actions">
            {supplier.email && (
              <a
                className="quick-action"
                href={`mailto:${supplier.email}`}
              >
                Email
              </a>
            )}

            {supplier.phone && (
              <a
                className="quick-action"
                href={`tel:${supplier.phone}`}
              >
                Call
              </a>
            )}

            {supplier.website && (
              <button
                type="button"
                className="quick-action"
                onClick={() =>
                  openWebsite(
                    supplier.website!
                  )
                }
              >
                Website
              </button>
            )}
          </div>
        </section>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Linked Products
            </div>

            <div className="stat-value">
              {
                supplierProducts.length
              }
            </div>

            <div className="stat-description">
              Products supplied by this supplier
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Payment Terms
            </div>

            <div className="stat-value">
              {supplier.payment_terms_days >
              0
                ? `${supplier.payment_terms_days}d`
                : "Prepaid"}
            </div>

            <div className="stat-description">
              Default supplier terms
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Lead Time
            </div>

            <div className="stat-value">
              {supplier.default_lead_time_days >
              0
                ? `${supplier.default_lead_time_days}d`
                : "—"}
            </div>

            <div className="stat-description">
              Default procurement lead time
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Rating
            </div>

            <div className="stat-value">
              {supplier.rating !==
              null
                ? `${supplier.rating.toFixed(
                    1
                  )}/5`
                : "—"}
            </div>

            <div className="stat-description">
              Supplier performance rating
            </div>
          </div>
        </div>

        <div className="details-grid">
          <section className="content-card">
            <div className="content-card-header">
              <div>
                <h2>
                  Supplier Information
                </h2>

                <p>
                  Core supplier identity and classification.
                </p>
              </div>
            </div>

            <div className="details-content">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">
                    Legal Name
                  </span>

                  <span className="detail-value">
                    {
                      supplier.legal_name
                    }
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Display Name
                  </span>

                  <span className="detail-value">
                    {
                      supplier.display_name
                    }
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Supplier Number
                  </span>

                  <span className="detail-value">
                    {
                      supplier.supplier_number
                    }
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Supplier Type
                  </span>

                  <span className="detail-value">
                    {formatSupplierType(
                      supplier.supplier_type
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Tax ID
                  </span>

                  <span className="detail-value">
                    {supplier.tax_id ||
                      "—"}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Status
                  </span>

                  <span className="detail-value">
                    <span
                      className={`status-badge ${getStatusClass(
                        supplier.status
                      )}`}
                    >
                      {formatStatus(
                        supplier.status
                      )}
                    </span>
                  </span>
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
                  Supplier communication details.
                </p>
              </div>
            </div>

            <div className="details-content">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">
                    Email
                  </span>

                  {supplier.email ? (
                    <a
                      className="detail-link"
                      href={`mailto:${supplier.email}`}
                    >
                      {
                        supplier.email
                      }
                    </a>
                  ) : (
                    <span className="detail-value">
                      —
                    </span>
                  )}
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Phone
                  </span>

                  {supplier.phone ? (
                    <a
                      className="detail-link"
                      href={`tel:${supplier.phone}`}
                    >
                      {
                        supplier.phone
                      }
                    </a>
                  ) : (
                    <span className="detail-value">
                      —
                    </span>
                  )}
                </div>

                <div className="detail-item full-width">
                  <span className="detail-label">
                    Website
                  </span>

                  {supplier.website ? (
                    <button
                      type="button"
                      className="website-link"
                      onClick={() =>
                        openWebsite(
                          supplier.website!
                        )
                      }
                    >
                      {
                        supplier.website
                      }
                    </button>
                  ) : (
                    <span className="detail-value">
                      —
                    </span>
                  )}
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
                  Commercial defaults used when purchasing from this supplier.
                </p>
              </div>
            </div>

            <div className="details-content">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">
                    Currency
                  </span>

                  <span className="detail-value">
                    {
                      supplier.currency
                    }
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Payment Terms
                  </span>

                  <span className="detail-value">
                    {supplier.payment_terms_days >
                    0
                      ? `${supplier.payment_terms_days} days`
                      : "Prepaid"}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Credit Limit
                  </span>

                  <span className="detail-value">
                    {
                      supplier.currency
                    }{" "}
                    {formatAmount(
                      supplier.credit_limit
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Minimum Order
                  </span>

                  <span className="detail-value">
                    {
                      supplier.currency
                    }{" "}
                    {formatAmount(
                      supplier.minimum_order_amount
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Default Lead Time
                  </span>

                  <span className="detail-value">
                    {supplier.default_lead_time_days >
                    0
                      ? `${supplier.default_lead_time_days} days`
                      : "—"}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Rating
                  </span>

                  <span className="detail-value">
                    {supplier.rating !==
                    null
                      ? `${supplier.rating.toFixed(
                          2
                        )} / 5`
                      : "Not rated"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="content-card">
            <div className="content-card-header">
              <div>
                <h2>
                  Record Information
                </h2>

                <p>
                  Supplier record history.
                </p>
              </div>
            </div>

            <div className="details-content">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">
                    Created
                  </span>

                  <span className="detail-value">
                    {formatDateTime(
                      supplier.created_at
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">
                    Last Updated
                  </span>

                  <span className="detail-value">
                    {formatDateTime(
                      supplier.updated_at
                    )}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

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

          <div className="notes-content">
            {supplier.notes ? (
              <div className="notes-text">
                {supplier.notes}
              </div>
            ) : (
              <div className="notes-empty">
                No internal notes have been added.
              </div>
            )}
          </div>
        </section>

        <section className="content-card">
          <div className="content-card-header">
            <div>
              <h2>
                Supplier Products
              </h2>

              <p>
                Products currently linked to this supplier.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                router.push(
                  `/suppliers/${supplier.id}/products`
                )
              }
            >
              View Products
            </button>
          </div>

          <div className="product-summary">
            <div className="product-summary-icon">
              ▣
            </div>

            <div>
              <strong>
                {
                  supplierProducts.length
                }{" "}
                linked product
                {supplierProducts.length ===
                1
                  ? ""
                  : "s"}
              </strong>

              <p>
                Manage supplier pricing, SKUs and product relationships from the supplier products page.
              </p>
            </div>
          </div>
        </section>
      </section>

      <style jsx>{`
        .page-content {
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .supplier-header-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 24px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .supplier-header-main {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .supplier-avatar {
          width: 58px;
          height: 58px;
          flex: 0 0 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: #f1f5f9;
          color: #334155;
          font-size: 22px;
          font-weight: 800;
        }

        .supplier-title-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .supplier-title-row h1 {
          margin: 0;
          color: #0f172a;
          font-size: 23px;
          letter-spacing: -0.4px;
        }

        .supplier-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          margin-top: 7px;
          color: #94a3b8;
          font-size: 12px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .quick-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 36px;
          padding: 0 12px;
          border: 1px solid #dbe1e8;
          border-radius: 8px;
          background: #ffffff;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }

        .quick-action:hover {
          background: #f8fafc;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }

        .stat-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .stat-label {
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .stat-value {
          color: #0f172a;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.4px;
        }

        .stat-description {
          margin-top: 5px;
          color: #94a3b8;
          font-size: 12px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
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
          padding: 20px 22px;
          border-bottom: 1px solid #e5e7eb;
        }

        .content-card-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 17px;
        }

        .content-card-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
        }

        .details-content {
          padding: 22px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .detail-item.full-width {
          grid-column: 1 / -1;
        }

        .detail-label {
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .detail-value {
          color: #0f172a;
          font-size: 13px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .detail-link,
        .website-link {
          width: fit-content;
          max-width: 100%;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .detail-link {
          text-decoration: none;
        }

        .detail-link:hover {
          text-decoration: underline;
        }

        .website-link {
          padding: 0;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .website-link:hover {
          text-decoration: underline;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-active {
          background: #ecfdf5;
          color: #059669;
        }

        .status-inactive {
          background: #f1f5f9;
          color: #64748b;
        }

        .status-blocked {
          background: #fef2f2;
          color: #dc2626;
        }

        .notes-content {
          padding: 22px;
        }

        .notes-text {
          white-space: pre-wrap;
          color: #334155;
          font-size: 13px;
          line-height: 1.7;
        }

        .notes-empty {
          color: #94a3b8;
          font-size: 13px;
        }

        .product-summary {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 22px;
        }

        .product-summary-icon {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 19px;
        }

        .product-summary strong {
          color: #0f172a;
          font-size: 13px;
        }

        .product-summary p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
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

        .primary-button:hover {
          background: #1e293b;
        }

        .secondary-button {
          border: 1px solid #dbe1e8;
          background: #ffffff;
          color: #475569;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .supplier-header-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 18px;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .detail-item.full-width {
            grid-column: auto;
          }
        }

        @media (max-width: 600px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .supplier-header-main {
            align-items: flex-start;
          }

          .supplier-title-row h1 {
            font-size: 20px;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions .quick-action {
            flex: 1;
          }
        }
      `}</style>
    </AppShell>
  );
}