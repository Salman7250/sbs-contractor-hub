"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Filter,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";

type RepairStatus =
  | "intake"
  | "diagnosing"
  | "awaiting_parts"
  | "in_repair"
  | "quality_check"
  | "ready_for_return"
  | "completed"
  | "cancelled";

type RepairPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

type RepairSource =
  | "customer"
  | "warranty_claim"
  | "internal"
  | "rma";

type Repair = {
  id: string;
  company_id: string;
  repair_number: string;
  warranty_id: string | null;
  warranty_claim_id: string | null;
  customer_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  serialized_unit_id: string | null;
  serial_number: string | null;
  order_id: string | null;
  job_id: string | null;
  assigned_employee_id: string | null;
  source: RepairSource;
  status: RepairStatus;
  priority: RepairPriority;
  issue: string;
  diagnosis: string | null;
  work_performed: string | null;
  resolution: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  warranty_covered: boolean;
  estimated_labor: number;
  estimated_parts: number;
  estimated_total: number;
  actual_labor: number;
  actual_parts: number;
  actual_total: number;
  customer_charge: number;
  received_at: string;
  diagnosed_at: string | null;
  repair_started_at: string | null;
  quality_checked_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Customer = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  name: string;
};

type Claim = {
  id: string;
  warranty_id: string;
  claim_number: string;
  status: string;
};

const STATUS_OPTIONS: {
  value: RepairStatus;
  label: string;
}[] = [
  {
    value: "intake",
    label: "Intake",
  },
  {
    value: "diagnosing",
    label: "Diagnosing",
  },
  {
    value: "awaiting_parts",
    label: "Awaiting Parts",
  },
  {
    value: "in_repair",
    label: "In Repair",
  },
  {
    value: "quality_check",
    label: "Quality Check",
  },
  {
    value: "ready_for_return",
    label: "Ready for Return",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

const PRIORITY_OPTIONS: {
  value: RepairPriority;
  label: string;
}[] = [
  {
    value: "low",
    label: "Low",
  },
  {
    value: "normal",
    label: "Normal",
  },
  {
    value: "high",
    label: "High",
  },
  {
    value: "urgent",
    label: "Urgent",
  },
];

const SOURCE_OPTIONS: {
  value: RepairSource;
  label: string;
}[] = [
  {
    value: "customer",
    label: "Customer",
  },
  {
    value: "warranty_claim",
    label: "Warranty Claim",
  },
  {
    value: "internal",
    label: "Internal",
  },
  {
    value: "rma",
    label: "RMA",
  },
];

function formatStatus(status: RepairStatus) {
  return (
    STATUS_OPTIONS.find(
      (item) => item.value === status
    )?.label ||
    status
  );
}

function formatPriority(
  priority: RepairPriority
) {
  return (
    PRIORITY_OPTIONS.find(
      (item) => item.value === priority
    )?.label ||
    priority
  );
}

function formatSource(source: RepairSource) {
  return (
    SOURCE_OPTIONS.find(
      (item) => item.value === source
    )?.label ||
    source
  );
}

function formatDate(value: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusClass(status: RepairStatus) {
  switch (status) {
    case "completed":
      return "status status-green";

    case "in_repair":
      return "status status-blue";

    case "ready_for_return":
      return "status status-purple";

    case "quality_check":
      return "status status-indigo";

    case "awaiting_parts":
      return "status status-orange";

    case "diagnosing":
      return "status status-yellow";

    case "cancelled":
      return "status status-gray";

    default:
      return "status status-gray";
  }
}

function getPriorityClass(
  priority: RepairPriority
) {
  switch (priority) {
    case "urgent":
      return "priority priority-urgent";

    case "high":
      return "priority priority-high";

    case "low":
      return "priority priority-low";

    default:
      return "priority priority-normal";
  }
}

export default function RepairsClient({
  repairs,
  customers,
  products,
  employees,
  claims,
}: {
  repairs: Repair[];
  customers: Customer[];
  products: Product[];
  employees: Employee[];
  claims: Claim[];
}) {
  const router = useRouter();

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [priorityFilter, setPriorityFilter] =
    useState("all");

  const [sourceFilter, setSourceFilter] =
    useState("all");

  const [employeeFilter, setEmployeeFilter] =
    useState("all");

  const [showFilters, setShowFilters] =
    useState(false);

  const customerMap = useMemo(
    () =>
      new Map(
        customers.map((customer) => [
          customer.id,
          customer.name,
        ])
      ),
    [customers]
  );

  const productMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          product.name,
        ])
      ),
    [products]
  );

  const employeeMap = useMemo(
    () =>
      new Map(
        employees.map((employee) => [
          employee.id,
          employee.name,
        ])
      ),
    [employees]
  );

  const claimMap = useMemo(
    () =>
      new Map(
        claims.map((claim) => [
          claim.id,
          claim.claim_number,
        ])
      ),
    [claims]
  );

  const stats = useMemo(() => {
    return {
      total: repairs.length,

      intake: repairs.filter(
        (repair) =>
          repair.status === "intake"
      ).length,

      inRepair: repairs.filter(
        (repair) =>
          repair.status === "in_repair"
      ).length,

      awaitingParts: repairs.filter(
        (repair) =>
          repair.status ===
          "awaiting_parts"
      ).length,

      readyForReturn: repairs.filter(
        (repair) =>
          repair.status ===
          "ready_for_return"
      ).length,

      completed: repairs.filter(
        (repair) =>
          repair.status === "completed"
      ).length,
    };
  }, [repairs]);

  const filteredRepairs = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return repairs.filter((repair) => {
      const customerName =
        repair.customer_id
          ? customerMap.get(
              repair.customer_id
            ) || ""
          : "";

      const productName =
        repair.product_id
          ? productMap.get(
              repair.product_id
            ) || ""
          : "";

      const employeeName =
        repair.assigned_employee_id
          ? employeeMap.get(
              repair.assigned_employee_id
            ) || ""
          : "";

      const claimNumber =
        repair.warranty_claim_id
          ? claimMap.get(
              repair.warranty_claim_id
            ) || ""
          : "";

      const searchableText = [
        repair.repair_number,
        repair.issue,
        repair.diagnosis || "",
        repair.resolution || "",
        repair.serial_number || "",
        repair.order_id || "",
        repair.job_id || "",
        customerName,
        productName,
        employeeName,
        claimNumber,
        formatSource(repair.source),
        formatStatus(repair.status),
        formatPriority(repair.priority),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        searchableText.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        repair.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        repair.priority ===
          priorityFilter;

      const matchesSource =
        sourceFilter === "all" ||
        repair.source === sourceFilter;

      const matchesEmployee =
        employeeFilter === "all" ||
        repair.assigned_employee_id ===
          employeeFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesSource &&
        matchesEmployee
      );
    });
  }, [
    repairs,
    search,
    statusFilter,
    priorityFilter,
    sourceFilter,
    employeeFilter,
    customerMap,
    productMap,
    employeeMap,
    claimMap,
  ]);

  const activeFilterCount =
    [
      statusFilter !== "all",
      priorityFilter !== "all",
      sourceFilter !== "all",
      employeeFilter !== "all",
    ].filter(Boolean).length;

  function clearFilters() {
    setStatusFilter("all");
    setPriorityFilter("all");
    setSourceFilter("all");
    setEmployeeFilter("all");
    setSearch("");
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            SERVICE
          </div>

          <h1>Repairs</h1>

          <p>
            Manage diagnostics, parts,
            technicians, and repair
            completion.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.refresh()
            }
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              router.push(
                "/repairs/new"
              )
            }
          >
            <Plus size={16} />
            New Repair
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-gray">
            <Wrench size={19} />
          </div>

          <div>
            <span className="stat-label">
              Total Repairs
            </span>

            <strong>
              {stats.total}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-orange">
            <Clock3 size={19} />
          </div>

          <div>
            <span className="stat-label">
              Intake
            </span>

            <strong>
              {stats.intake}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <Wrench size={19} />
          </div>

          <div>
            <span className="stat-label">
              In Repair
            </span>

            <strong>
              {stats.inRepair}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-yellow">
            <PackageSearch size={19} />
          </div>

          <div>
            <span className="stat-label">
              Awaiting Parts
            </span>

            <strong>
              {stats.awaitingParts}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">
            <CheckCircle2 size={19} />
          </div>

          <div>
            <span className="stat-label">
              Ready for Return
            </span>

            <strong>
              {stats.readyForReturn}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-green">
            <CheckCircle2 size={19} />
          </div>

          <div>
            <span className="stat-label">
              Completed
            </span>

            <strong>
              {stats.completed}
            </strong>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search repairs, customers, products, serial numbers..."
            />
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              className={`filter-button ${
                activeFilterCount > 0
                  ? "filter-button-active"
                  : ""
              }`}
              onClick={() =>
                setShowFilters(
                  (value) => !value
                )
              }
            >
              <Filter size={16} />
              Filters

              {activeFilterCount >
                0 && (
                <span className="filter-count">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="filters-panel">
            <div className="filter-field">
              <label>
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Statuses
                </option>

                {STATUS_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="filter-field">
              <label>
                Priority
              </label>

              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Priorities
                </option>

                {PRIORITY_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="filter-field">
              <label>
                Source
              </label>

              <select
                value={sourceFilter}
                onChange={(event) =>
                  setSourceFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Sources
                </option>

                {SOURCE_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="filter-field">
              <label>
                Technician
              </label>

              <select
                value={employeeFilter}
                onChange={(event) =>
                  setEmployeeFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Technicians
                </option>

                {employees.map(
                  (employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                    >
                      {employee.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <button
              type="button"
              className="clear-filters"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        )}

        <div className="table-header-row">
          <div>
            {filteredRepairs.length}{" "}
            {filteredRepairs.length === 1
              ? "repair"
              : "repairs"}
          </div>
        </div>

        {filteredRepairs.length ===
        0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              {repairs.length === 0 ? (
                <Wrench size={25} />
              ) : (
                <AlertCircle
                  size={25}
                />
              )}
            </div>

            <h3>
              {repairs.length === 0
                ? "No repairs yet"
                : "No repairs found"}
            </h3>

            <p>
              {repairs.length === 0
                ? "Create your first repair to start tracking diagnostics and service work."
                : "Try changing your search or filters."}
            </p>

            {repairs.length ===
              0 && (
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  router.push(
                    "/repairs/new"
                  )
                }
              >
                <Plus size={16} />
                New Repair
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Repair
                  </th>

                  <th>
                    Customer
                  </th>

                  <th>
                    Product
                  </th>

                  <th>
                    Serial
                  </th>

                  <th>
                    Technician
                  </th>

                  <th>
                    Priority
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Received
                  </th>

                  <th>
                    View
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRepairs.map(
                  (repair) => {
                    const customerName =
                      repair.customer_id
                        ? customerMap.get(
                            repair.customer_id
                          )
                        : null;

                    const productName =
                      repair.product_id
                        ? productMap.get(
                            repair.product_id
                          )
                        : null;

                    const technician =
                      repair.assigned_employee_id
                        ? employeeMap.get(
                            repair.assigned_employee_id
                          )
                        : null;

                    return (
                      <tr
                        key={
                          repair.id
                        }
                      >
                        <td>
                          <div className="repair-number">
                            {
                              repair.repair_number
                            }
                          </div>

                          <div className="repair-source">
                            {
                              formatSource(
                                repair.source
                              )
                            }

                            {repair.warranty_covered && (
                              <span className="warranty-tag">
                                Warranty
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="primary-text">
                            {customerName ||
                              "—"}
                          </div>
                        </td>

                        <td>
                          <div className="primary-text">
                            {productName ||
                              "—"}
                          </div>
                        </td>

                        <td>
                          <span className="serial-text">
                            {
                              repair.serial_number ||
                              "—"
                            }
                          </span>
                        </td>

                        <td>
                          <span className="secondary-text">
                            {technician ||
                              "Unassigned"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={getPriorityClass(
                              repair.priority
                            )}
                          >
                            {
                              formatPriority(
                                repair.priority
                              )
                            }
                          </span>
                        </td>

                        <td>
                          <span
                            className={getStatusClass(
                              repair.status
                            )}
                          >
                            {
                              formatStatus(
                                repair.status
                              )
                            }
                          </span>
                        </td>

                        <td>
                          <span className="secondary-text">
                            {formatDate(
                              repair.received_at
                            )}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="view-button"
                            onClick={() =>
                              router.push(
                                `/repairs/${repair.id}`
                              )
                            }
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          margin-bottom: 7px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .page-header h1 {
          margin: 0;
          color: #111827;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 700;
        }

        .page-header p {
          margin: 7px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .primary-button,
        .secondary-button,
        .filter-button,
        .view-button,
        .clear-filters {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 38px;
          padding: 0 13px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;
        }

        .primary-button {
          border: 1px solid #111827;
          background: #111827;
          color: #ffffff;
        }

        .primary-button:hover {
          background: #1f2937;
          border-color: #1f2937;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .secondary-button:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 13px;
          min-height: 92px;
          padding: 17px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border-radius: 10px;
        }

        .stat-icon-gray {
          background: #f3f4f6;
          color: #4b5563;
        }

        .stat-icon-orange {
          background: #fff7ed;
          color: #c2410c;
        }

        .stat-icon-blue {
          background: #eff6ff;
          color: #2563eb;
        }

        .stat-icon-yellow {
          background: #fefce8;
          color: #a16207;
        }

        .stat-icon-purple {
          background: #faf5ff;
          color: #9333ea;
        }

        .stat-icon-green {
          background: #ecfdf5;
          color: #059669;
        }

        .stat-label {
          display: block;
          margin-bottom: 5px;
          color: #6b7280;
          font-size: 12px;
          font-weight: 500;
        }

        .stat-card strong {
          display: block;
          color: #111827;
          font-size: 23px;
          line-height: 1;
          font-weight: 700;
        }

        .content-card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 17px;
          border-bottom: 1px solid #e5e7eb;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 9px;
          width: min(520px, 100%);
          min-height: 39px;
          padding: 0 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          color: #9ca3af;
        }

        .search-box:focus-within {
          border-color: #9ca3af;
          box-shadow:
            0 0 0 3px rgba(17, 24, 39, 0.06);
        }

        .search-box input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #111827;
          font-family: inherit;
          font-size: 13px;
        }

        .search-box input::placeholder {
          color: #9ca3af;
        }

        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-button {
          position: relative;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .filter-button:hover,
        .filter-button-active {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .filter-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 19px;
          height: 19px;
          padding: 0 5px;
          border-radius: 999px;
          background: #111827;
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
        }

        .filters-panel {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr))
            auto;
          align-items: end;
          gap: 12px;
          padding: 16px 17px;
          border-bottom: 1px solid #e5e7eb;
          background: #fafafa;
        }

        .filter-field label {
          display: block;
          margin-bottom: 6px;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
        }

        .filter-field select {
          width: 100%;
          height: 38px;
          padding: 0 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          outline: 0;
          background: #ffffff;
          color: #374151;
          font-family: inherit;
          font-size: 13px;
        }

        .filter-field select:focus {
          border-color: #9ca3af;
        }

        .clear-filters {
          min-height: 38px;
          border: 0;
          background: transparent;
          color: #6b7280;
        }

        .clear-filters:hover {
          color: #111827;
        }

        .table-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 44px;
          padding: 0 17px;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
          font-weight: 500;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1100px;
        }

        th {
          padding: 12px 14px;
          border-bottom: 1px solid #e5e7eb;
          background: #fafafa;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          text-align: left;
          white-space: nowrap;
        }

        td {
          padding: 14px;
          border-bottom: 1px solid #f0f1f3;
          color: #374151;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #fafafa;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        .repair-number {
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }

        .repair-source {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          color: #9ca3af;
          font-size: 11px;
        }

        .warranty-tag {
          display: inline-flex;
          align-items: center;
          min-height: 18px;
          padding: 0 6px;
          border-radius: 999px;
          background: #ecfdf5;
          color: #047857;
          font-size: 9px;
          font-weight: 700;
        }

        .primary-text {
          color: #374151;
          font-weight: 500;
        }

        .secondary-text {
          color: #6b7280;
        }

        .serial-text {
          color: #4b5563;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
        }

        .status,
        .priority {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 25px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .status-green {
          background: #ecfdf5;
          color: #047857;
        }

        .status-blue {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-purple {
          background: #faf5ff;
          color: #7e22ce;
        }

        .status-indigo {
          background: #eef2ff;
          color: #4338ca;
        }

        .status-orange {
          background: #fff7ed;
          color: #c2410c;
        }

        .status-yellow {
          background: #fefce8;
          color: #a16207;
        }

        .status-gray {
          background: #f3f4f6;
          color: #4b5563;
        }

        .priority-urgent {
          background: #fef2f2;
          color: #b91c1c;
        }

        .priority-high {
          background: #fff7ed;
          color: #c2410c;
        }

        .priority-normal {
          background: #f3f4f6;
          color: #4b5563;
        }

        .priority-low {
          background: #f0fdf4;
          color: #15803d;
        }

        .view-button {
          min-height: 33px;
          padding: 0 11px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .view-button:hover {
          border-color: #9ca3af;
          background: #f9fafb;
          color: #111827;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 360px;
          padding: 40px 20px;
          text-align: center;
        }

        .empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          margin-bottom: 14px;
          border-radius: 12px;
          background: #f3f4f6;
          color: #6b7280;
        }

        .empty-state h3 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .empty-state p {
          max-width: 420px;
          margin: 7px 0 18px;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.6;
        }

        @media (max-width: 1300px) {
          .stats-grid {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 900px) {
          .page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }

          .filters-panel {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .page-content {
            padding: 18px;
          }

          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .search-box {
            width: 100%;
          }

          .toolbar-actions {
            width: 100%;
          }

          .filter-button {
            width: 100%;
          }

          .filters-panel {
            grid-template-columns: 1fr;
          }

          .header-actions {
            flex-direction: column;
          }

          .header-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}