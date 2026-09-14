"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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
  supplier_id: string;
};

const SUPPLIER_STATUSES = [
  "active",
  "inactive",
  "blocked",
];

const SUPPLIER_TYPES = [
  "manufacturer",
  "distributor",
  "wholesaler",
  "vendor",
  "service_provider",
  "other",
];

export default function SuppliersPage() {
  const supabase = createClient();
  const router = useRouter();

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [supplierProducts, setSupplierProducts] =
    useState<SupplierProduct[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [typeFilter, setTypeFilter] =
    useState("all");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const loadData = useCallback(async () => {
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
        suppliersResult,
        supplierProductsResult,
      ] = await Promise.all([
        supabase
          .from("suppliers")
          .select("*")
          .eq(
            "company_id",
            companyId
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("supplier_products")
          .select("supplier_id")
          .eq(
            "company_id",
            companyId
          ),
      ]);

      if (suppliersResult.error) {
        throw suppliersResult.error;
      }

      if (
        supplierProductsResult.error
      ) {
        throw supplierProductsResult.error;
      }

      setSuppliers(
        suppliersResult.data || []
      );

      setSupplierProducts(
        supplierProductsResult.data || []
      );
    } catch (err: unknown) {
      console.error(
        "Supplier page load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not load suppliers."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    // Start the asynchronous supplier synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const filteredSuppliers =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return suppliers.filter(
        (supplier) => {
          const matchesSearch =
            !query ||
            supplier.supplier_number
              .toLowerCase()
              .includes(query) ||
            supplier.display_name
              .toLowerCase()
              .includes(query) ||
            supplier.legal_name
              .toLowerCase()
              .includes(query) ||
            supplier.email
              ?.toLowerCase()
              .includes(query) ||
            supplier.phone
              ?.toLowerCase()
              .includes(query) ||
            supplier.supplier_type
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            statusFilter === "all" ||
            supplier.status ===
              statusFilter;

          const matchesType =
            typeFilter === "all" ||
            supplier.supplier_type ===
              typeFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesType
          );
        }
      );
    }, [
      suppliers,
      search,
      statusFilter,
      typeFilter,
    ]);

  const stats = useMemo(() => {
    const active =
      suppliers.filter(
        (supplier) =>
          supplier.status === "active"
      ).length;

    const inactive =
      suppliers.filter(
        (supplier) =>
          supplier.status === "inactive"
      ).length;

    const blocked =
      suppliers.filter(
        (supplier) =>
          supplier.status === "blocked"
      ).length;

    const linkedProducts =
      supplierProducts.length;

    return {
      active,
      inactive,
      blocked,
      linkedProducts,
    };
  }, [
    suppliers,
    supplierProducts,
  ]);

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

  function getSupplierProductCount(
    supplierId: string
  ) {
    return supplierProducts.filter(
      (product) =>
        product.supplier_id ===
        supplierId
    ).length;
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

  function openSupplier(
    supplierId: string
  ) {
    router.push(
      `/suppliers/${supplierId}`
    );
  }

  function createSupplier() {
    router.push(
      "/suppliers/new"
    );
  }

  async function deleteSupplier(
    supplier: Supplier
  ) {
    const confirmed =
      window.confirm(
        `Delete supplier ${supplier.display_name}? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
        error: deleteError,
      } = await supabase
        .from("suppliers")
        .delete()
        .eq(
          "id",
          supplier.id
        )
        .eq(
          "company_id",
          membership.company_id
        );

      if (deleteError) {
        throw deleteError;
      }

      setSuppliers(
        (current) =>
          current.filter(
            (item) =>
              item.id !== supplier.id
          )
      );

      setSupplierProducts(
        (current) =>
          current.filter(
            (item) =>
              item.supplier_id !==
              supplier.id
          )
      );

      setSuccess(
        "Supplier deleted successfully."
      );

      setTimeout(() => {
        setSuccess("");
      }, 2000);
    } catch (err: unknown) {
      console.error(
        "Supplier delete error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not delete supplier."
      );
    }
  }

  return (
    <AppShell
      title="Suppliers"
      description="Manage supplier relationships, sourcing, pricing and procurement."
      actions={
        <button
          type="button"
          className="primary-button"
          onClick={
            createSupplier
          }
        >
          + Add Supplier
        </button>
      }
    >
      <section className="page-content">
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Suppliers
            </div>

            <div className="stat-value">
              {suppliers.length}
            </div>

            <div className="stat-description">
              All supplier records
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Active
            </div>

            <div className="stat-value">
              {stats.active}
            </div>

            <div className="stat-description">
              Available for procurement
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Linked Products
            </div>

            <div className="stat-value">
              {stats.linkedProducts}
            </div>

            <div className="stat-description">
              Supplier product relationships
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Blocked
            </div>

            <div className="stat-value">
              {stats.blocked}
            </div>

            <div className="stat-description">
              Suppliers unavailable for use
            </div>
          </div>
        </div>

        <section className="content-card">
          <div className="content-card-header">
            <div>
              <h2>
                All Suppliers
              </h2>

              <p>
                {
                  filteredSuppliers.length
                }{" "}
                supplier
                {filteredSuppliers.length ===
                1
                  ? ""
                  : "s"}{" "}
                found
              </p>
            </div>

            <div className="filters">
              <div className="search-box">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search suppliers..."
                  value={search}
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <select
                value={
                  statusFilter
                }
                onChange={(
                  event
                ) =>
                  setStatusFilter(
                    event.target
                      .value
                  )
                }
              >
                <option value="all">
                  All statuses
                </option>

                {SUPPLIER_STATUSES.map(
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

              <select
                value={
                  typeFilter
                }
                onChange={(
                  event
                ) =>
                  setTypeFilter(
                    event.target
                      .value
                  )
                }
              >
                <option value="all">
                  All types
                </option>

                {SUPPLIER_TYPES.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {formatSupplierType(
                        type
                      )}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner" />

              <p>
                Loading suppliers...
              </p>
            </div>
          ) : filteredSuppliers.length ===
            0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                ▣
              </div>

              <h3>
                {search ||
                statusFilter !==
                  "all" ||
                typeFilter !==
                  "all"
                  ? "No suppliers found"
                  : "No suppliers yet"}
              </h3>

              <p>
                {search ||
                statusFilter !==
                  "all" ||
                typeFilter !==
                  "all"
                  ? "Try changing your search or filters."
                  : "Add your first supplier to start building your procurement database."}
              </p>

              {!search &&
                statusFilter ===
                  "all" &&
                typeFilter ===
                  "all" && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={
                      createSupplier
                    }
                  >
                    + Add Supplier
                  </button>
                )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      Supplier
                    </th>

                    <th>
                      Type
                    </th>

                    <th>
                      Contact
                    </th>

                    <th>
                      Products
                    </th>

                    <th>
                      Terms
                    </th>

                    <th>
                      Lead Time
                    </th>

                    <th>
                      Status
                    </th>

                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSuppliers.map(
                    (supplier) => (
                      <tr
                        key={
                          supplier.id
                        }
                      >
                        <td>
                          <button
                            type="button"
                            className="supplier-link"
                            onClick={() =>
                              openSupplier(
                                supplier.id
                              )
                            }
                          >
                            {
                              supplier.display_name
                            }
                          </button>

                          <div className="secondary-cell">
                            {
                              supplier.supplier_number
                            }

                            {supplier.legal_name &&
                              supplier.legal_name !==
                                supplier.display_name && (
                                <>
                                  {" "}
                                  ·{" "}
                                  {
                                    supplier.legal_name
                                  }
                                </>
                              )}
                          </div>
                        </td>

                        <td>
                          <div className="primary-cell">
                            {formatSupplierType(
                              supplier.supplier_type
                            )}
                          </div>
                        </td>

                        <td>
                          {supplier.email ? (
                            <div className="primary-cell">
                              {
                                supplier.email
                              }
                            </div>
                          ) : (
                            <div className="secondary-cell">
                              No email
                            </div>
                          )}

                          {supplier.phone && (
                            <div className="secondary-cell">
                              {
                                supplier.phone
                              }
                            </div>
                          )}
                        </td>

                        <td>
                          <strong>
                            {getSupplierProductCount(
                              supplier.id
                            )}
                          </strong>
                        </td>

                        <td>
                          {supplier.payment_terms_days >
                          0
                            ? `${supplier.payment_terms_days} days`
                            : "Prepaid"}
                        </td>

                        <td>
                          {supplier.default_lead_time_days >
                          0
                            ? `${supplier.default_lead_time_days} days`
                            : "—"}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${getStatusClass(
                              supplier.status
                            )}`}
                          >
                            {formatStatus(
                              supplier.status
                            )}
                          </span>
                        </td>

                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="table-action"
                              onClick={() =>
                                openSupplier(
                                  supplier.id
                                )
                              }
                            >
                              Open
                            </button>

                            <button
                              type="button"
                              className="table-action danger"
                              onClick={() =>
                                deleteSupplier(
                                  supplier
                                )
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      <style jsx>{`
  .page-content {
    padding: 28px;
    background: #f8fafc;
    min-height: 100%;
  }

  /* =========================
     ALERTS
     ========================= */

  .alert {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 10px 14px;
    margin-bottom: 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
  }

  .alert-error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }

  .alert-success {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }

  /* =========================
     KPI / STAT CARDS
     ========================= */

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 22px;
  }

  .stat-card {
    position: relative;
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 18px 20px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.18s ease;
  }


  .stat-card:hover {
    border-color: #cbd5e1;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
    transform: translateY(-1px);
  }

  .stat-label {
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.45px;
    margin-bottom: 8px;
  }

  .stat-value {
    color: #0f172a;
    font-size: 25px;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.6px;
  }

  .stat-description {
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.4;
    margin-top: 6px;
  }

  /* =========================
     MAIN CONTENT CARD
     ========================= */

  .content-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  }

  .content-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 18px 20px;
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
  }

  .content-card-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: 17px;
    line-height: 1.3;
    font-weight: 750;
    letter-spacing: -0.2px;
  }

  .content-card-header p {
    margin: 5px 0 0;
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.4;
  }

  /* =========================
     FILTERS
     ========================= */

  .filters {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 250px;
    height: 38px;
    padding: 0 11px;
    border: 1px solid #dbe3ea;
    border-radius: 8px;
    background: #ffffff;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .search-box:focus-within {
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  .search-box span {
    flex: 0 0 auto;
    color: #94a3b8;
    font-size: 18px;
    line-height: 1;
  }

  .search-box input {
    width: 100%;
    min-width: 0;
    padding: 0;
    border: 0;
    outline: 0;
    color: #0f172a;
    background: transparent;
    font-size: 12px;
    font-weight: 500;
  }

  .search-box input::placeholder {
    color: #94a3b8;
  }

  .filters select {
    height: 38px;
    min-width: 135px;
    padding: 0 30px 0 11px;
    border: 1px solid #dbe3ea;
    border-radius: 8px;
    outline: none;
    background: #ffffff;
    color: #334155;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .filters select:focus {
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  .filters select:hover {
    border-color: #cbd5e1;
  }

  /* =========================
     TABLE
     ========================= */

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .data-table {
    width: 100%;
    min-width: 1080px;
    border-collapse: separate;
    border-spacing: 0;
  }

  .data-table th {
    padding: 11px 18px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    color: #64748b;
    font-size: 10px;
    font-weight: 750;
    line-height: 1.2;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.55px;
    white-space: nowrap;
  }

  .data-table td {
    padding: 15px 18px;
    border-bottom: 1px solid #eef2f7;
    color: #334155;
    font-size: 12px;
    line-height: 1.45;
    vertical-align: middle;
    background: #ffffff;
  }

  .data-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .data-table tbody tr {
    transition: background 0.14s ease;
  }

  .data-table tbody tr:hover td {
    background: #f8fffc;
  }

  .primary-cell {
    color: #0f172a;
    font-weight: 650;
  }

  .secondary-cell {
    margin-top: 3px;
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.4;
  }

  /* =========================
     SUPPLIER LINK
     ========================= */

  .supplier-link {
    display: inline;
    max-width: 300px;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: #0f172a;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.35;
    text-align: left;
    cursor: pointer;
  }

  .supplier-link:hover {
    color: #059669;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .supplier-link:focus-visible {
    border-radius: 4px;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  /* =========================
     STATUS BADGES
     ========================= */

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 10px;
    line-height: 1;
    font-weight: 750;
    white-space: nowrap;
  }

  .status-active {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #d1fae5;
  }

  .status-inactive {
    background: #f1f5f9;
    color: #64748b;
    border: 1px solid #e2e8f0;
  }

  .status-blocked {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fee2e2;
  }

  /* =========================
     ROW ACTIONS
     ========================= */

  .row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    white-space: nowrap;
  }

  .table-action {
    height: 30px;
    padding: 0 10px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    background: #ffffff;
    color: #475569;
    font-size: 11px;
    font-weight: 650;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .table-action:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #0f172a;
  }

  .table-action:focus-visible {
    outline: none;
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  .table-action.danger {
    border-color: #fee2e2;
    background: #ffffff;
    color: #dc2626;
  }

  .table-action.danger:hover {
    border-color: #fecaca;
    background: #fef2f2;
    color: #b91c1c;
  }

  /* =========================
     EMPTY / LOADING STATE
     ========================= */

  .empty-state {
    min-height: 340px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon {
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    border: 1px solid #d1fae5;
    border-radius: 12px;
    background: #ecfdf5;
    color: #059669;
    font-size: 22px;
  }

  .empty-state h3 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
    line-height: 1.35;
    font-weight: 750;
  }

  .empty-state p {
    max-width: 430px;
    margin: 7px 0 18px;
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.5;
  }

  .loading-spinner {
    width: 28px;
    height: 28px;
    margin-bottom: 12px;
    border: 3px solid #d1fae5;
    border-top-color: #059669;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* =========================
     PRIMARY BUTTON
     ========================= */

  .primary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 38px;
    padding: 0 14px;
    border: 1px solid #059669;
    border-radius: 8px;
    background: #059669;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(5, 150, 105, 0.12);
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.15s ease;
  }

  .primary-button:hover {
    background: #047857;
    border-color: #047857;
    box-shadow: 0 3px 8px rgba(5, 150, 105, 0.18);
  }

  .primary-button:active {
    transform: translateY(1px);
  }

  .primary-button:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 3px #d1fae5,
      0 2px 6px rgba(5, 150, 105, 0.15);
  }

  /* =========================
     RESPONSIVE
     ========================= */

  @media (max-width: 1200px) {
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .content-card-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .filters {
      width: 100%;
      justify-content: flex-start;
    }
  }

  @media (max-width: 900px) {
    .page-content {
      padding: 20px;
    }

    .filters {
      flex-wrap: wrap;
    }

    .search-box {
      flex: 1 1 240px;
    }

    .filters select {
      flex: 0 1 auto;
    }
  }

  @media (max-width: 640px) {
    .page-content {
      padding: 16px;
    }

    .stats-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .stat-card {
      padding: 16px 18px;
    }

    .content-card-header {
      padding: 16px;
      gap: 14px;
    }

    .filters {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .search-box {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .filters select {
      width: 100%;
      box-sizing: border-box;
    }

    .data-table {
      min-width: 1050px;
    }
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