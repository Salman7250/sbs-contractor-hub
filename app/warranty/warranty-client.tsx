"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileCheck2,
  Plus,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type Customer = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
};

type WarrantyRow = {
  id: string;
  company_id: string;
  warranty_number: string;
  customer_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  order_id: string | null;
  serial_number: string | null;
  status: "active" | "expiring" | "expired" | "claimed" | "void";
  coverage_type:
    | "standard"
    | "extended"
    | "limited"
    | "parts_only"
    | "labor_only"
    | "custom";
  purchase_date: string | null;
  start_date: string;
  end_date: string;
  terms: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ClaimRow = {
  id: string;
  warranty_id: string;
  status:
    | "open"
    | "under_review"
    | "approved"
    | "rejected"
    | "repair"
    | "replacement"
    | "resolved"
    | "cancelled";
};

type Props = {
  warranties: WarrantyRow[];
  customers: Customer[];
  products: Product[];
  claims: ClaimRow[];
};

type FilterStatus =
  | "all"
  | "active"
  | "expiring"
  | "expired"
  | "claimed"
  | "void";

type FilterCoverage =
  | "all"
  | "standard"
  | "extended"
  | "limited"
  | "parts_only"
  | "labor_only"
  | "custom";

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatCoverage(value: WarrantyRow["coverage_type"]) {
  switch (value) {
    case "parts_only":
      return "Parts only";
    case "labor_only":
      return "Labor only";
    case "standard":
      return "Standard";
    case "extended":
      return "Extended";
    case "limited":
      return "Limited";
    case "custom":
      return "Custom";
    default:
      return value;
  }
}

function formatStatus(value: WarrantyRow["status"]) {
  switch (value) {
    case "active":
      return "Active";
    case "expiring":
      return "Expiring";
    case "expired":
      return "Expired";
    case "claimed":
      return "Claimed";
    case "void":
      return "Void";
    default:
      return value;
  }
}

function statusStyles(status: WarrantyRow["status"]) {
  switch (status) {
    case "active":
      return {
        background: "#ecfdf3",
        color: "#027a48",
        border: "#abefc6",
      };

    case "expiring":
      return {
        background: "#fffaeb",
        color: "#b54708",
        border: "#fedf89",
      };

    case "expired":
      return {
        background: "#fef3f2",
        color: "#b42318",
        border: "#fecdca",
      };

    case "claimed":
      return {
        background: "#eff8ff",
        color: "#175cd3",
        border: "#b2ddff",
      };

    case "void":
      return {
        background: "#f2f4f7",
        color: "#475467",
        border: "#d0d5dd",
      };

    default:
      return {
        background: "#f2f4f7",
        color: "#475467",
        border: "#d0d5dd",
      };
  }
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="warranty-stat-card">
      <div className="warranty-stat-top">
        <div className="warranty-stat-icon">{icon}</div>
        <span>{detail}</span>
      </div>

      <div className="warranty-stat-value">{value}</div>

      <div className="warranty-stat-label">{label}</div>
    </div>
  );
}

export default function WarrantyClient({
  warranties,
  customers,
  products,
  claims,
}: Props) {
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<FilterStatus>("all");
  const [coverageFilter, setCoverageFilter] =
    useState<FilterCoverage>("all");

  const customerMap = useMemo(() => {
    return new Map(
      customers.map((customer) => [customer.id, customer.name]),
    );
  }, [customers]);

  const productMap = useMemo(() => {
    return new Map(
      products.map((product) => [product.id, product.name]),
    );
  }, [products]);

  const claimsByWarranty = useMemo(() => {
    const map = new Map<string, ClaimRow[]>();

    for (const claim of claims) {
      const existing = map.get(claim.warranty_id) ?? [];

      existing.push(claim);

      map.set(claim.warranty_id, existing);
    }

    return map;
  }, [claims]);

  const stats = useMemo(() => {
    const openClaims = claims.filter(
      (claim) =>
        claim.status !== "resolved" &&
        claim.status !== "cancelled",
    ).length;

    const resolvedClaims = claims.filter(
      (claim) => claim.status === "resolved",
    ).length;

    return {
      total: warranties.length,
      active: warranties.filter(
        (warranty) => warranty.status === "active",
      ).length,
      expiring: warranties.filter(
        (warranty) => warranty.status === "expiring",
      ).length,
      expired: warranties.filter(
        (warranty) => warranty.status === "expired",
      ).length,
      openClaims,
      resolvedClaims,
    };
  }, [claims, warranties]);

  const filteredWarranties = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return warranties.filter((warranty) => {
      if (
        statusFilter !== "all" &&
        warranty.status !== statusFilter
      ) {
        return false;
      }

      if (
        coverageFilter !== "all" &&
        warranty.coverage_type !== coverageFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const customerName = warranty.customer_id
        ? customerMap.get(warranty.customer_id) ?? ""
        : "";

      const productName = warranty.product_id
        ? productMap.get(warranty.product_id) ?? ""
        : "";

      const searchableText = [
        warranty.warranty_number,
        warranty.serial_number ?? "",
        customerName,
        productName,
        formatCoverage(warranty.coverage_type),
        formatStatus(warranty.status),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [
    coverageFilter,
    customerMap,
    productMap,
    searchValue,
    statusFilter,
    warranties,
  ]);

  return (
    <>
      <main className="page-content">
        <div className="warranty-page">
          <div className="warranty-header">
            <div>
              <div className="warranty-breadcrumb">
                <span>Service</span>
                <strong>/</strong>
                <span>Warranty</span>
              </div>

              <h1>Warranty</h1>

              <p>
                Manage product warranties, coverage periods, and
                customer claims.
              </p>
            </div>

            <Link
              href="/warranty/new"
              className="warranty-primary-button"
            >
              <Plus size={17} />
              New Warranty
            </Link>
          </div>

          <div className="warranty-stats-grid">
            <StatCard
              icon={<ShieldCheck size={19} />}
              label="Total Warranties"
              value={stats.total}
              detail="All records"
            />

            <StatCard
              icon={<CheckCircle2 size={19} />}
              label="Active"
              value={stats.active}
              detail="Currently covered"
            />

            <StatCard
              icon={<Clock3 size={19} />}
              label="Expiring Soon"
              value={stats.expiring}
              detail="Next 30 days"
            />

            <StatCard
              icon={<XCircle size={19} />}
              label="Expired"
              value={stats.expired}
              detail="Coverage ended"
            />

            <StatCard
              icon={<AlertTriangle size={19} />}
              label="Open Claims"
              value={stats.openClaims}
              detail="Needs attention"
            />

            <StatCard
              icon={<FileCheck2 size={19} />}
              label="Claims Resolved"
              value={stats.resolvedClaims}
              detail="Completed claims"
            />
          </div>

          <section className="warranty-card">
            <div className="warranty-toolbar">
              <div className="warranty-search">
                <Search size={18} />

                <input
                  type="search"
                  value={searchValue}
                  onChange={(event) =>
                    setSearchValue(event.target.value)
                  }
                  placeholder="Search warranty, customer, product, serial..."
                  aria-label="Search warranties"
                />
              </div>

              <div className="warranty-filter">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as FilterStatus,
                    )
                  }
                  aria-label="Filter by warranty status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="expiring">Expiring</option>
                  <option value="expired">Expired</option>
                  <option value="claimed">Claimed</option>
                  <option value="void">Void</option>
                </select>

                <ChevronDown size={15} />
              </div>

              <div className="warranty-filter">
                <select
                  value={coverageFilter}
                  onChange={(event) =>
                    setCoverageFilter(
                      event.target.value as FilterCoverage,
                    )
                  }
                  aria-label="Filter by coverage type"
                >
                  <option value="all">All coverage</option>
                  <option value="standard">Standard</option>
                  <option value="extended">Extended</option>
                  <option value="limited">Limited</option>
                  <option value="parts_only">Parts only</option>
                  <option value="labor_only">Labor only</option>
                  <option value="custom">Custom</option>
                </select>

                <ChevronDown size={15} />
              </div>
            </div>

            <div className="warranty-table-header">
              <div>
                <strong>Warranty Records</strong>

                <span>
                  {filteredWarranties.length}{" "}
                  {filteredWarranties.length === 1
                    ? "record"
                    : "records"}
                </span>
              </div>

              {(searchValue ||
                statusFilter !== "all" ||
                coverageFilter !== "all") && (
                <button
                  type="button"
                  className="warranty-clear-button"
                  onClick={() => {
                    setSearchValue("");
                    setStatusFilter("all");
                    setCoverageFilter("all");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {filteredWarranties.length === 0 ? (
              <div className="warranty-empty">
                <div className="warranty-empty-icon">
                  <ShieldCheck size={25} />
                </div>

                <h3>
                  {warranties.length === 0
                    ? "No warranties yet"
                    : "No warranties found"}
                </h3>

                <p>
                  {warranties.length === 0
                    ? "Create your first warranty record to start tracking product coverage."
                    : "Try changing your search or filters."}
                </p>

                {warranties.length === 0 && (
                  <Link
                    href="/warranty/new"
                    className="warranty-primary-button"
                  >
                    <Plus size={17} />
                    Create Warranty
                  </Link>
                )}
              </div>
            ) : (
              <div className="warranty-table-wrap">
                <table className="warranty-table">
                  <thead>
                    <tr>
                      <th>Warranty</th>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Serial</th>
                      <th>Coverage</th>
                      <th>Start</th>
                      <th>Expires</th>
                      <th>Status</th>
                      <th>Claims</th>
                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {filteredWarranties.map((warranty) => {
                      const warrantyClaims =
                        claimsByWarranty.get(warranty.id) ?? [];

                      const status = statusStyles(warranty.status);

                      return (
                        <tr key={warranty.id}>
                          <td>
                            <Link
                              href={`/warranty/${warranty.id}`}
                              className="warranty-number"
                            >
                              {warranty.warranty_number}
                            </Link>
                          </td>

                          <td>
                            <span className="warranty-main-text">
                              {warranty.customer_id
                                ? customerMap.get(
                                    warranty.customer_id,
                                  ) ?? "Unknown customer"
                                : "No customer"}
                            </span>
                          </td>

                          <td>
                            <span className="warranty-main-text">
                              {warranty.product_id
                                ? productMap.get(
                                    warranty.product_id,
                                  ) ?? "Unknown product"
                                : "No product"}
                            </span>
                          </td>

                          <td>
                            <span className="warranty-muted">
                              {warranty.serial_number ?? "—"}
                            </span>
                          </td>

                          <td>
                            <span className="warranty-muted">
                              {formatCoverage(
                                warranty.coverage_type,
                              )}
                            </span>
                          </td>

                          <td>
                            <span className="warranty-date">
                              <CalendarDays size={14} />
                              {formatDate(warranty.start_date)}
                            </span>
                          </td>

                          <td>
                            <span className="warranty-date">
                              <CalendarDays size={14} />
                              {formatDate(warranty.end_date)}
                            </span>
                          </td>

                          <td>
                            <span
                              className="warranty-status"
                              style={{
                                background: status.background,
                                color: status.color,
                                borderColor: status.border,
                              }}
                            >
                              {formatStatus(warranty.status)}
                            </span>
                          </td>

                          <td>
                            {warrantyClaims.length > 0 ? (
                              <span className="warranty-claim-count">
                                {warrantyClaims.length}
                              </span>
                            ) : (
                              <span className="warranty-muted">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            <Link
                              href={`/warranty/${warranty.id}`}
                              className="warranty-view-button"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      <style jsx global>{`
        .page-content {
          padding: 28px;
        }

        .warranty-page {
          max-width: 1800px;
          margin: 0 auto;
        }

        .warranty-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .warranty-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
          color: #667085;
          font-size: 13px;
          font-weight: 500;
        }

        .warranty-breadcrumb strong {
          color: #98a2b3;
          font-weight: 500;
        }

        .warranty-header h1 {
          margin: 0;
          color: #101828;
          font-size: 28px;
          line-height: 36px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .warranty-header p {
          margin: 6px 0 0;
          color: #667085;
          font-size: 14px;
        }

        .warranty-primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 15px;
          border: 1px solid #111827;
          border-radius: 9px;
          background: #111827;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            transform 0.15s ease;
        }

        .warranty-primary-button:hover {
          background: #000000;
          border-color: #000000;
        }

        .warranty-primary-button:active {
          transform: translateY(1px);
        }

        .warranty-stats-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .warranty-stat-card {
          min-height: 126px;
          padding: 17px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
        }

        .warranty-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .warranty-stat-top > span {
          color: #98a2b3;
          font-size: 11px;
          font-weight: 500;
          text-align: right;
        }

        .warranty-stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border: 1px solid #eaecf0;
          border-radius: 9px;
          background: #f9fafb;
          color: #344054;
        }

        .warranty-stat-value {
          margin-top: 13px;
          color: #101828;
          font-size: 25px;
          line-height: 30px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .warranty-stat-label {
          margin-top: 3px;
          color: #667085;
          font-size: 12px;
          font-weight: 500;
        }

        .warranty-card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
        }

        .warranty-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 17px;
          border-bottom: 1px solid #eaecf0;
        }

        .warranty-search {
          position: relative;
          flex: 1;
          min-width: 240px;
        }

        .warranty-search svg {
          position: absolute;
          top: 50%;
          left: 12px;
          transform: translateY(-50%);
          color: #98a2b3;
          pointer-events: none;
        }

        .warranty-search input {
          box-sizing: border-box;
          width: 100%;
          height: 40px;
          padding: 0 13px 0 39px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          outline: none;
          background: #ffffff;
          color: #101828;
          font-family: inherit;
          font-size: 13px;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .warranty-search input::placeholder {
          color: #98a2b3;
        }

        .warranty-search input:focus {
          border-color: #98a2b3;
          box-shadow: 0 0 0 3px rgba(16, 24, 40, 0.06);
        }

        .warranty-filter {
          position: relative;
          width: 170px;
        }

        .warranty-filter select {
          width: 100%;
          height: 40px;
          padding: 0 35px 0 12px;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          outline: none;
          appearance: none;
          background: #ffffff;
          color: #344054;
          font-family: inherit;
          font-size: 13px;
          cursor: pointer;
        }

        .warranty-filter svg {
          position: absolute;
          top: 50%;
          right: 11px;
          transform: translateY(-50%);
          color: #667085;
          pointer-events: none;
        }

        .warranty-table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 62px;
          padding: 0 17px;
          border-bottom: 1px solid #eaecf0;
        }

        .warranty-table-header > div {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .warranty-table-header strong {
          color: #101828;
          font-size: 14px;
          font-weight: 650;
        }

        .warranty-table-header span {
          color: #98a2b3;
          font-size: 12px;
        }

        .warranty-clear-button {
          border: 0;
          background: transparent;
          color: #344054;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .warranty-clear-button:hover {
          color: #111827;
        }

        .warranty-table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .warranty-table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
        }

        .warranty-table th {
          padding: 11px 15px;
          border-bottom: 1px solid #eaecf0;
          background: #fcfcfd;
          color: #667085;
          font-size: 11px;
          line-height: 16px;
          font-weight: 650;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .warranty-table td {
          padding: 14px 15px;
          border-bottom: 1px solid #f0f2f5;
          color: #344054;
          font-size: 13px;
          vertical-align: middle;
        }

        .warranty-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .warranty-table tbody tr:hover {
          background: #fafafa;
        }

        .warranty-number {
          color: #101828;
          font-weight: 650;
          text-decoration: none;
        }

        .warranty-number:hover {
          text-decoration: underline;
        }

        .warranty-main-text {
          display: block;
          max-width: 190px;
          overflow: hidden;
          color: #344054;
          font-weight: 500;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .warranty-muted {
          color: #667085;
        }

        .warranty-date {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #667085;
          white-space: nowrap;
        }

        .warranty-date svg {
          color: #98a2b3;
        }

        .warranty-status {
          display: inline-flex;
          align-items: center;
          min-height: 25px;
          padding: 0 8px;
          border: 1px solid;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 650;
          white-space: nowrap;
        }

        .warranty-claim-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 25px;
          height: 25px;
          padding: 0 7px;
          border: 1px solid #d0d5dd;
          border-radius: 999px;
          background: #f9fafb;
          color: #344054;
          font-size: 11px;
          font-weight: 650;
        }

        .warranty-view-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 31px;
          padding: 0 10px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          background: #ffffff;
          color: #344054;
          font-size: 12px;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
        }

        .warranty-view-button:hover {
          border-color: #98a2b3;
          background: #f9fafb;
        }

        .warranty-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 340px;
          padding: 40px 20px;
          text-align: center;
        }

        .warranty-empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          margin-bottom: 14px;
          border: 1px solid #eaecf0;
          border-radius: 14px;
          background: #f9fafb;
          color: #475467;
        }

        .warranty-empty h3 {
          margin: 0;
          color: #101828;
          font-size: 15px;
          font-weight: 650;
        }

        .warranty-empty p {
          max-width: 430px;
          margin: 7px 0 18px;
          color: #667085;
          font-size: 13px;
          line-height: 20px;
        }

        @media (max-width: 1400px) {
          .warranty-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .page-content {
            padding: 20px;
          }

          .warranty-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .warranty-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .warranty-search {
            min-width: 0;
          }

          .warranty-filter {
            width: 100%;
          }

          .warranty-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .page-content {
            padding: 15px;
          }

          .warranty-stats-grid {
            grid-template-columns: 1fr;
          }

          .warranty-header h1 {
            font-size: 24px;
          }
        }
      `}</style>
    </>
  );
}