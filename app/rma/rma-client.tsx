"use client";

import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  Clock3,
  FileText,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

type RmaStatus =
  | "requested"
  | "under_review"
  | "approved"
  | "rejected"
  | "awaiting_return"
  | "received"
  | "inspecting"
  | "resolution_pending"
  | "repair"
  | "replacement"
  | "refund"
  | "store_credit"
  | "completed"
  | "cancelled";

type RmaPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

type Rma = {
  id: string;
  company_id: string;
  rma_number: string;
  customer_id: string | null;
  order_id: string | null;
  invoice_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  serial_number: string | null;
  warranty_id: string | null;
  warranty_claim_id: string | null;
  repair_id: string | null;
  assigned_employee_id: string | null;
  status: RmaStatus;
  priority: RmaPriority;
  reason: string;
  customer_description: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  return_tracking_number: string | null;
  return_carrier: string | null;
  received_date: string | null;
  inspection_date: string | null;
  completed_date: string | null;
  condition_received: string | null;
  inspection_result: string | null;
  resolution_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Customer = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type InitialFilters = {
  search: string;
  status: string;
  priority: string;
  customer: string;
};

type Props = {
  rmas: Rma[];
  customers: Customer[];
  employees: Employee[];
  initialFilters: InitialFilters;
};

const statusLabels: Record<RmaStatus, string> = {
  requested: "Requested",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  awaiting_return: "Awaiting Return",
  received: "Received",
  inspecting: "Inspecting",
  resolution_pending: "Resolution Pending",
  repair: "Repair",
  replacement: "Replacement",
  refund: "Refund",
  store_credit: "Store Credit",
  completed: "Completed",
  cancelled: "Cancelled",
};

const priorityLabels: Record<RmaPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const statusStyles: Record<
  RmaStatus,
  { background: string; color: string; border: string }
> = {
  requested: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "#bfdbfe",
  },
  under_review: {
    background: "#fefce8",
    color: "#a16207",
    border: "#fde68a",
  },
  approved: {
    background: "#ecfdf5",
    color: "#047857",
    border: "#a7f3d0",
  },
  rejected: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "#fecaca",
  },
  awaiting_return: {
    background: "#fff7ed",
    color: "#c2410c",
    border: "#fed7aa",
  },
  received: {
    background: "#f5f3ff",
    color: "#6d28d9",
    border: "#ddd6fe",
  },
  inspecting: {
    background: "#f0fdfa",
    color: "#0f766e",
    border: "#99f6e4",
  },
  resolution_pending: {
    background: "#fefce8",
    color: "#854d0e",
    border: "#fde68a",
  },
  repair: {
    background: "#eef2ff",
    color: "#4338ca",
    border: "#c7d2fe",
  },
  replacement: {
    background: "#ecfeff",
    color: "#0e7490",
    border: "#a5f3fc",
  },
  refund: {
    background: "#fdf2f8",
    color: "#be185d",
    border: "#fbcfe8",
  },
  store_credit: {
    background: "#f0fdf4",
    color: "#15803d",
    border: "#bbf7d0",
  },
  completed: {
    background: "#ecfdf5",
    color: "#047857",
    border: "#a7f3d0",
  },
  cancelled: {
    background: "#f3f4f6",
    color: "#4b5563",
    border: "#d1d5db",
  },
};

const priorityStyles: Record<
  RmaPriority,
  { background: string; color: string; border: string }
> = {
  low: {
    background: "#f3f4f6",
    color: "#4b5563",
    border: "#d1d5db",
  },
  normal: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "#bfdbfe",
  },
  high: {
    background: "#fff7ed",
    color: "#c2410c",
    border: "#fed7aa",
  },
  urgent: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "#fecaca",
  },
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatus(status: RmaStatus) {
  return statusLabels[status] ?? status;
}

function formatPriority(priority: RmaPriority) {
  return priorityLabels[priority] ?? priority;
}

function getEmployeeName(employee: Employee | undefined) {
  if (!employee) {
    return "Unassigned";
  }

  if (employee.display_name) {
    return employee.display_name;
  }

  const name = [
    employee.first_name,
    employee.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return name || "Unassigned";
}

export default function RmaClient({
  rmas,
  customers,
  employees,
  initialFilters,
}: Props) {
  const router = useRouter();

  const customerMap = useMemo(() => {
    return new Map(
      customers.map((customer) => [
        customer.id,
        customer.name,
      ]),
    );
  }, [customers]);

  const employeeMap = useMemo(() => {
    return new Map(
      employees.map((employee) => [
        employee.id,
        getEmployeeName(employee),
      ]),
    );
  }, [employees]);

  const filteredRmas = useMemo(() => {
    const search = initialFilters.search
      .trim()
      .toLowerCase();

    return rmas.filter((rma) => {
      if (
        initialFilters.status &&
        rma.status !== initialFilters.status
      ) {
        return false;
      }

      if (
        initialFilters.priority &&
        rma.priority !== initialFilters.priority
      ) {
        return false;
      }

      if (
        initialFilters.customer &&
        rma.customer_id !== initialFilters.customer
      ) {
        return false;
      }

      if (!search) {
        return true;
      }

      const customerName = rma.customer_id
        ? customerMap.get(rma.customer_id) ?? ""
        : "";

      const searchableText = [
        rma.rma_number,
        customerName,
        rma.serial_number ?? "",
        rma.reason,
        rma.return_tracking_number ?? "",
        rma.return_carrier ?? "",
        rma.status,
        rma.priority,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [
    rmas,
    customerMap,
    initialFilters,
  ]);

  const stats = useMemo(() => {
    const total = rmas.length;

    const requested = rmas.filter(
      (rma) => rma.status === "requested",
    ).length;

    const underReview = rmas.filter(
      (rma) => rma.status === "under_review",
    ).length;

    const received = rmas.filter(
      (rma) =>
        rma.status === "received" ||
        rma.status === "inspecting",
    ).length;

    const activeResolution = rmas.filter((rma) =>
      [
        "resolution_pending",
        "repair",
        "replacement",
        "refund",
        "store_credit",
      ].includes(rma.status),
    ).length;

    const completed = rmas.filter(
      (rma) => rma.status === "completed",
    ).length;

    return {
      total,
      requested,
      underReview,
      received,
      activeResolution,
      completed,
    };
  }, [rmas]);

  function buildQueryString(
    overrides: Partial<InitialFilters> = {},
  ) {
    const values = {
      ...initialFilters,
      ...overrides,
    };

    const params = new URLSearchParams();

    if (values.search) {
      params.set("search", values.search);
    }

    if (values.status) {
      params.set("status", values.status);
    }

    if (values.priority) {
      params.set("priority", values.priority);
    }

    if (values.customer) {
      params.set("customer", values.customer);
    }

    const query = params.toString();

    return query ? `?${query}` : "";
  }

  function handleFilterChange(
    field: keyof InitialFilters,
    value: string,
  ) {
    router.push(
      `/rma${buildQueryString({
        [field]: value,
      })}`,
    );
  }

  function clearFilters() {
    router.push("/rma");
  }

  const hasFilters =
    Boolean(initialFilters.search) ||
    Boolean(initialFilters.status) ||
    Boolean(initialFilters.priority) ||
    Boolean(initialFilters.customer);

  return (
    <>
      <main className="page-content">
        <div className="page-header">
          <div>
            <div className="eyebrow">SERVICE</div>
            <h1>RMA</h1>
            <p>
              Manage product return authorizations, inspections,
              and resolutions.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => router.refresh()}
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() => router.push("/rma/new")}
            >
              <Plus size={16} />
              New RMA
            </button>
          </div>
        </div>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <FileText size={20} />
            </div>
            <div className="stat-content">
              <span>Total RMAs</span>
              <strong>{stats.total}</strong>
              <small>All return authorizations</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Clock3 size={20} />
            </div>
            <div className="stat-content">
              <span>Requested</span>
              <strong>{stats.requested}</strong>
              <small>Awaiting review</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Search size={20} />
            </div>
            <div className="stat-content">
              <span>Under Review</span>
              <strong>{stats.underReview}</strong>
              <small>Being evaluated</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <PackageCheck size={20} />
            </div>
            <div className="stat-content">
              <span>Received</span>
              <strong>{stats.received}</strong>
              <small>Received or inspecting</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <ArrowUpDown size={20} />
            </div>
            <div className="stat-content">
              <span>Resolution</span>
              <strong>{stats.activeResolution}</strong>
              <small>Repair or resolution</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <CheckCircle2 size={20} />
            </div>
            <div className="stat-content">
              <span>Completed</span>
              <strong>{stats.completed}</strong>
              <small>Closed RMAs</small>
            </div>
          </div>
        </section>

        <section className="content-card">
          <div className="filters-header">
            <div>
              <h2>RMA Register</h2>
              <p>
                Track returns from request through final
                resolution.
              </p>
            </div>

            {hasFilters && (
              <button
                type="button"
                className="clear-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="filters">
            <div className="search-wrapper">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search RMA, customer, serial, reason..."
                defaultValue={initialFilters.search}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }

                  const value = event.currentTarget.value;

                  handleFilterChange("search", value);
                }}
              />
            </div>

            <select
              value={initialFilters.status}
              onChange={(event) =>
                handleFilterChange(
                  "status",
                  event.target.value,
                )
              }
            >
              <option value="">All Statuses</option>
              <option value="requested">Requested</option>
              <option value="under_review">
                Under Review
              </option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="awaiting_return">
                Awaiting Return
              </option>
              <option value="received">Received</option>
              <option value="inspecting">Inspecting</option>
              <option value="resolution_pending">
                Resolution Pending
              </option>
              <option value="repair">Repair</option>
              <option value="replacement">
                Replacement
              </option>
              <option value="refund">Refund</option>
              <option value="store_credit">
                Store Credit
              </option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={initialFilters.priority}
              onChange={(event) =>
                handleFilterChange(
                  "priority",
                  event.target.value,
                )
              }
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            <select
              value={initialFilters.customer}
              onChange={(event) =>
                handleFilterChange(
                  "customer",
                  event.target.value,
                )
              }
            >
              <option value="">All Customers</option>

              {customers.map((customer) => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          {filteredRmas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                {hasFilters ? (
                  <Search size={24} />
                ) : (
                  <FileText size={24} />
                )}
              </div>

              <h3>
                {hasFilters
                  ? "No RMAs match your filters"
                  : "No RMAs yet"}
              </h3>

              <p>
                {hasFilters
                  ? "Try changing your search or filters."
                  : "Create your first RMA to start tracking product returns."}
              </p>

              {hasFilters ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => router.push("/rma/new")}
                >
                  <Plus size={16} />
                  Create RMA
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="rma-table">
                <thead>
                  <tr>
                    <th>RMA</th>
                    <th>Customer</th>
                    <th>Product / Serial</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Received</th>
                    <th>Created</th>
                    <th>View</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRmas.map((rma) => {
                    const customerName = rma.customer_id
                      ? customerMap.get(
                          rma.customer_id,
                        ) ?? "Unknown Customer"
                      : "No Customer";

                    const employeeName =
                      rma.assigned_employee_id
                        ? employeeMap.get(
                            rma.assigned_employee_id,
                          ) ?? "Unknown"
                        : "Unassigned";

                    const statusStyle =
                      statusStyles[rma.status];

                    const priorityStyle =
                      priorityStyles[rma.priority];

                    return (
                      <tr key={rma.id}>
                        <td>
                          <div className="rma-number-cell">
                            <strong>
                              {rma.rma_number}
                            </strong>
                            <span>
                              {rma.reason || "Return request"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="customer-cell">
                            <UserRound size={16} />
                            <span>{customerName}</span>
                          </div>
                        </td>

                        <td>
                          <div className="product-cell">
                            <strong>
                              {rma.product_id
                                ? "Product linked"
                                : "Product not linked"}
                            </strong>

                            <span>
                              {rma.serial_number
                                ? `Serial: ${rma.serial_number}`
                                : "No serial number"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className="status-badge"
                            style={{
                              background:
                                priorityStyle.background,
                              color: priorityStyle.color,
                              borderColor:
                                priorityStyle.border,
                            }}
                          >
                            {formatPriority(rma.priority)}
                          </span>
                        </td>

                        <td>
                          <span
                            className="status-badge"
                            style={{
                              background:
                                statusStyle.background,
                              color: statusStyle.color,
                              borderColor:
                                statusStyle.border,
                            }}
                          >
                            {formatStatus(rma.status)}
                          </span>
                        </td>

                        <td>
                          <span className="assigned-cell">
                            {employeeName}
                          </span>
                        </td>

                        <td>
                          <span className="date-cell">
                            {formatDate(rma.received_date)}
                          </span>
                        </td>

                        <td>
                          <span className="date-cell">
                            {formatDateTime(rma.created_at)}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="view-button"
                            onClick={() =>
                              router.push(
                                `/rma/${rma.id}`,
                              )
                            }
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <style jsx>{`
  .page-content {
    padding: 28px;
    background: #f8fafc;
    min-height: calc(100vh - 80px);
  }

  /* =========================
     PAGE HEADER
  ========================= */

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
  }

  .eyebrow {
    margin-bottom: 5px;
    color: #059669;
    font-size: 10px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    color: #0f172a;
    font-size: 25px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: -0.45px;
  }

  .page-header p {
    margin: 6px 0 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.5;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  button {
    font-family: inherit;
  }

  .primary-button,
  .secondary-button,
  .clear-button,
  .view-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 37px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 1;
    font-weight: 750;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.15s ease;
  }

  .primary-button {
    padding: 0 13px;
    border: 1px solid #059669;
    background: #059669;
    color: #ffffff;
    box-shadow: 0 1px 2px rgba(5, 150, 105, 0.12);
  }

  .primary-button:hover {
    border-color: #047857;
    background: #047857;
  }

  .primary-button:active {
    transform: translateY(1px);
  }

  .secondary-button {
    padding: 0 12px;
    border: 1px solid #dbe3ea;
    background: #ffffff;
    color: #475569;
  }

  .secondary-button:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
    color: #334155;
  }

  .clear-button {
    min-height: 33px;
    padding: 0 11px;
    border: 1px solid #dbe3ea;
    background: #ffffff;
    color: #64748b;
  }

  .clear-button:hover {
    border-color: #a7f3d0;
    background: #f0fdf4;
    color: #047857;
  }

  .view-button {
    min-height: 31px;
    padding: 0 10px;
    border: 1px solid #dbe3ea;
    background: #ffffff;
    color: #475569;
  }

  .view-button:hover {
    border-color: #6ee7b7;
    background: #ecfdf5;
    color: #047857;
  }

  /* =========================
     KPI CARDS
  ========================= */

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .stat-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 11px;
    min-height: 104px;
    padding: 14px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 11px;
    background: #ffffff;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.03),
      0 4px 12px rgba(15, 23, 42, 0.025);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.15s ease;
  }

  .stat-card:hover {
    border-color: #d1d5db;
    box-shadow:
      0 2px 4px rgba(15, 23, 42, 0.04),
      0 8px 18px rgba(15, 23, 42, 0.035);
    transform: translateY(-1px);
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 36px;
    border: 1px solid #d1fae5;
    border-radius: 9px;
    background: #ecfdf5;
    color: #059669;
  }

  .stat-content {
    min-width: 0;
  }

  .stat-content span {
    display: block;
    color: #64748b;
    font-size: 10px;
    line-height: 1.25;
    font-weight: 700;
    white-space: nowrap;
  }

  .stat-content strong {
    display: block;
    margin-top: 4px;
    color: #0f172a;
    font-size: 21px;
    line-height: 1.15;
    font-weight: 800;
    letter-spacing: -0.35px;
  }

  .stat-content small {
    display: block;
    margin-top: 4px;
    color: #94a3b8;
    font-size: 9px;
    line-height: 1.35;
  }

  /* =========================
     MAIN CARD
  ========================= */

  .content-card {
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 11px;
    background: #ffffff;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.03),
      0 5px 18px rgba(15, 23, 42, 0.025);
  }

  .filters-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 18px 18px 15px;
    border-bottom: 1px solid #eef2f7;
  }

  .filters-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: 14px;
    line-height: 1.3;
    font-weight: 800;
    letter-spacing: -0.1px;
  }

  .filters-header p {
    margin: 4px 0 0;
    color: #94a3b8;
    font-size: 10px;
    line-height: 1.45;
  }

  /* =========================
     FILTER BAR
  ========================= */

  .filters {
    display: grid;
    grid-template-columns:
      minmax(250px, 1.5fr)
      repeat(3, minmax(145px, 0.7fr));
    gap: 9px;
    padding: 13px 18px;
    border-bottom: 1px solid #eef2f7;
    background: #fafbfc;
  }

  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .search-wrapper svg {
    position: absolute;
    left: 11px;
    color: #94a3b8;
    pointer-events: none;
  }

  .search-wrapper input,
  .filters select {
    width: 100%;
    height: 38px;
    box-sizing: border-box;
    border: 1px solid #dbe3ea;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    font-family: inherit;
    font-size: 11px;
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      background 0.15s ease;
  }

  .search-wrapper input {
    padding: 0 11px 0 35px;
  }

  .filters select {
    padding: 0 10px;
  }

  .search-wrapper input::placeholder {
    color: #a1a9b5;
  }

  .search-wrapper input:focus,
  .filters select:focus {
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.09);
  }

  /* =========================
     TABLE
  ========================= */

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .rma-table {
    width: 100%;
    min-width: 1080px;
    border-collapse: collapse;
  }

  .rma-table th {
    padding: 10px 14px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    font-size: 9px;
    line-height: 1.2;
    font-weight: 800;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.45px;
    white-space: nowrap;
  }

  .rma-table td {
    padding: 12px 14px;
    border-bottom: 1px solid #f1f5f9;
    color: #475569;
    font-size: 10px;
    line-height: 1.4;
    vertical-align: middle;
  }

  .rma-table tbody tr {
    transition: background 0.15s ease;
  }

  .rma-table tbody tr:hover {
    background: #f8fafc;
  }

  .rma-table tbody tr:last-child td {
    border-bottom: 0;
  }

  /* =========================
     RMA CELL
  ========================= */

  .rma-number-cell,
  .product-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .rma-number-cell strong {
    color: #0f172a;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 800;
  }

  .rma-number-cell span {
    max-width: 190px;
    overflow: hidden;
    color: #94a3b8;
    font-size: 9px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .product-cell strong {
    color: #334155;
    font-size: 10px;
    line-height: 1.35;
    font-weight: 700;
  }

  .product-cell span {
    max-width: 180px;
    overflow: hidden;
    color: #94a3b8;
    font-size: 9px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* =========================
     CUSTOMER
  ========================= */

  .customer-cell {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 145px;
    color: #334155;
    font-size: 10px;
    font-weight: 650;
    white-space: nowrap;
  }

  .customer-cell svg {
    flex-shrink: 0;
    color: #94a3b8;
  }

  /* =========================
     BADGES
  ========================= */

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 25px;
    padding: 0 8px;
    border: 1px solid;
    border-radius: 999px;
    font-size: 9px;
    line-height: 1;
    font-weight: 800;
    white-space: nowrap;
  }

  /* =========================
     ASSIGNED / DATES
  ========================= */

  .assigned-cell {
    display: inline-block;
    max-width: 125px;
    overflow: hidden;
    color: #475569;
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .date-cell {
    color: #64748b;
    font-size: 9px;
    white-space: nowrap;
  }

  /* =========================
     EMPTY STATE
  ========================= */

  .empty-state {
    display: flex;
    min-height: 300px;
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
    margin-bottom: 13px;
    border: 1px solid #d1fae5;
    border-radius: 12px;
    background: #ecfdf5;
    color: #059669;
  }

  .empty-state h3 {
    margin: 0;
    color: #0f172a;
    font-size: 14px;
    line-height: 1.3;
    font-weight: 800;
  }

  .empty-state p {
    max-width: 410px;
    margin: 6px 0 17px;
    color: #94a3b8;
    font-size: 10px;
    line-height: 1.55;
  }

  /* =========================
     RESPONSIVE
  ========================= */

  @media (max-width: 1280px) {
    .stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .filters {
      grid-template-columns:
        minmax(220px, 1.4fr)
        repeat(3, minmax(130px, 0.8fr));
    }
  }

  @media (max-width: 1050px) {
    .filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .search-wrapper {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 760px) {
    .page-content {
      padding: 18px;
    }

    .page-header {
      flex-direction: column;
      gap: 15px;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions button {
      flex: 1;
    }

    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .filters-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .clear-button {
      width: 100%;
    }
  }

  @media (max-width: 520px) {
    .page-content {
      padding: 14px;
    }

    h1 {
      font-size: 22px;
    }

    .page-header p {
      font-size: 11px;
    }

    .header-actions {
      flex-direction: column;
    }

    .header-actions button {
      width: 100%;
      flex: none;
    }

    .stats-grid {
      grid-template-columns: 1fr;
      gap: 9px;
    }

    .stat-card {
      min-height: 82px;
      padding: 13px;
    }

    .filters {
      grid-template-columns: 1fr;
      padding: 12px;
    }

    .search-wrapper {
      grid-column: auto;
    }

    .filters-header {
      padding: 16px 14px 13px;
    }

    .rma-table th,
    .rma-table td {
      padding-left: 11px;
      padding-right: 11px;
    }
  }
`}</style>
    </>
  );
}