"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Edit3,
  FileText,
  Package,
  Plus,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type RepairStatus =
  | "intake"
  | "diagnosing"
  | "awaiting_parts"
  | "in_repair"
  | "quality_check"
  | "ready_for_return"
  | "completed"
  | "cancelled";

type Priority = "low" | "normal" | "high" | "urgent";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Product = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
};

type Warranty = {
  id: string;
  warranty_number: string;
  status: string;
  coverage_type: string;
  start_date: string | null;
  end_date: string | null;
  serial_number: string | null;
};

type Claim = {
  id: string;
  claim_number: string;
  status: string;
  issue: string | null;
  claim_date: string | null;
  resolution: string | null;
};

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
  source: string;
  status: RepairStatus;
  priority: Priority;
  issue: string | null;
  diagnosis: string | null;
  work_performed: string | null;
  resolution: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  warranty_covered: boolean;
  estimated_labor: number | null;
  estimated_parts: number | null;
  estimated_total: number | null;
  actual_labor: number | null;
  actual_parts: number | null;
  actual_total: number | null;
  customer_charge: number | null;
  received_at: string | null;
  diagnosed_at: string | null;
  repair_started_at: string | null;
  quality_checked_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type RepairPart = {
  id: string;
  repair_id: string;
  product_id: string | null;
  variant_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  unit_charge: number;
  status: string;
  notes: string | null;
  created_at: string;
};

type Activity = {
  id: string;
  repair_id: string;
  action: string;
  message: string;
  created_by: string | null;
  created_at: string;
};

type Props = {
  repair: Repair;
  customer: Customer | null;
  product: Product | null;
  employee: Employee | null;
  warranty: Warranty | null;
  claim: Claim | null;
  parts: RepairPart[];
  activity: Activity[];
};

const statusLabels: Record<RepairStatus, string> = {
  intake: "Intake",
  diagnosing: "Diagnosing",
  awaiting_parts: "Awaiting Parts",
  in_repair: "In Repair",
  quality_check: "Quality Check",
  ready_for_return: "Ready for Return",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusStyles: Record<RepairStatus, string> = {
  intake: "status-intake",
  diagnosing: "status-diagnosing",
  awaiting_parts: "status-awaiting",
  in_repair: "status-repair",
  quality_check: "status-quality",
  ready_for_return: "status-ready",
  completed: "status-completed",
  cancelled: "status-cancelled",
};

const priorityLabels: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const priorityStyles: Record<Priority, string> = {
  low: "priority-low",
  normal: "priority-normal",
  high: "priority-high",
  urgent: "priority-urgent",
};

const workflowStatuses: RepairStatus[] = [
  "intake",
  "diagnosing",
  "awaiting_parts",
  "in_repair",
  "quality_check",
  "ready_for_return",
  "completed",
];

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value: number | null) {
  return Number(value ?? 0).toFixed(2);
}

function formatSource(source: string) {
  const labels: Record<string, string> = {
    customer: "Customer",
    warranty_claim: "Warranty Claim",
    internal: "Internal",
    rma: "RMA",
  };

  return (
    labels[source] ??
    source
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function formatStatusText(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getEmployeeName(employee: Employee | null) {
  if (!employee) {
    return "Unassigned";
  }

  return (
    employee.display_name ||
    [employee.first_name, employee.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Unnamed Employee"
  );
}

function getStatusIcon(status: RepairStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={16} />;
    case "cancelled":
      return <XCircle size={16} />;
    case "quality_check":
      return <ClipboardCheck size={16} />;
    case "in_repair":
      return <Wrench size={16} />;
    case "awaiting_parts":
      return <Package size={16} />;
    default:
      return <Clock3 size={16} />;
  }
}

export default function RepairDetailClient({
  repair,
  customer,
  product,
  employee,
  warranty,
  claim,
  parts,
  activity,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [currentStatus, setCurrentStatus] = useState<RepairStatus>(
    repair.status,
  );
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  const estimatedLabor = Number(repair.estimated_labor ?? 0);
  const estimatedParts = Number(repair.estimated_parts ?? 0);
  const estimatedTotal = Number(
    repair.estimated_total ?? estimatedLabor + estimatedParts,
  );

  const actualLabor = Number(repair.actual_labor ?? 0);
  const actualParts = Number(repair.actual_parts ?? 0);
  const actualTotal = Number(
    repair.actual_total ?? actualLabor + actualParts,
  );

  const customerCharge = Number(repair.customer_charge ?? 0);

  const partsCost = parts.reduce(
    (total, part) =>
      total +
      Number(part.unit_cost ?? 0) * Number(part.quantity ?? 0),
    0,
  );

  const partsCharge = parts.reduce(
    (total, part) =>
      total +
      Number(part.unit_charge ?? 0) * Number(part.quantity ?? 0),
    0,
  );

  async function updateStatus(nextStatus: RepairStatus) {
    if (nextStatus === currentStatus || savingStatus) {
      return;
    }

    setSavingStatus(true);
    setStatusError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
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

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      if (!membership?.company_id) {
        throw new Error("No company membership was found.");
      }

      const companyId = membership.company_id;

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("is_company_admin", {
          p_company_id: companyId,
        });

      if (adminError) {
        throw new Error(adminError.message);
      }

      const { data: canManage, error: permissionError } =
        await supabase.rpc("employee_has_permission", {
          p_company_id: companyId,
          p_module: "repairs",
          p_action: "manage",
        });

      if (permissionError) {
        throw new Error(permissionError.message);
      }

      if (!isAdmin && !canManage) {
        throw new Error(
          "You do not have permission to update this repair.",
        );
      }

      const { error: updateError } = await supabase
        .from("repairs")
        .update({
          status: nextStatus,
        })
        .eq("id", repair.id)
        .eq("company_id", companyId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const { error: activityError } = await supabase
        .from("repair_activity")
        .insert({
          company_id: companyId,
          repair_id: repair.id,
          action: "status_changed",
          message: `Repair status changed from ${statusLabels[currentStatus]} to ${statusLabels[nextStatus]}.`,
          created_by: user.id,
        });

      if (activityError) {
        console.error(
          "Unable to create repair activity:",
          activityError.message,
        );
      }

      setCurrentStatus(nextStatus);
      router.refresh();
    } catch (error) {
      setStatusError(
        error instanceof Error
          ? error.message
          : "Unable to update repair status.",
      );
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <main className="page-content">
      <div className="top-bar">
        <button
          type="button"
          className="back-button"
          onClick={() => router.push("/repairs")}
        >
          <ArrowLeft size={16} />
          Back to Repairs
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={() => router.push(`/repairs/${repair.id}/edit`)}
        >
          <Edit3 size={15} />
          Edit Repair
        </button>
      </div>

      {statusError && (
        <div className="error-banner">
          <strong>Unable to update repair</strong>
          <span>{statusError}</span>
        </div>
      )}

      <section className="hero-card">
        <div className="hero-main">
          <div className="hero-icon">
            <Wrench size={24} />
          </div>

          <div className="hero-copy">
            <div className="eyebrow">Repair Record</div>

            <div className="hero-title-row">
              <h1>{repair.repair_number}</h1>

              <span
                className={`status-badge ${statusStyles[currentStatus]}`}
              >
                {getStatusIcon(currentStatus)}
                {statusLabels[currentStatus]}
              </span>

              <span
                className={`priority-badge ${priorityStyles[repair.priority]}`}
              >
                {priorityLabels[repair.priority]}
              </span>
            </div>

            <p>
              {customer?.name ?? "No customer linked"}
              {product ? ` • ${product.name}` : ""}
              {repair.serial_number
                ? ` • ${repair.serial_number}`
                : ""}
            </p>
          </div>
        </div>

        <div className="hero-meta">
          <div>
            <span>Source</span>
            <strong>{formatSource(repair.source)}</strong>
          </div>

          <div>
            <span>Received</span>
            <strong>{formatDate(repair.received_at)}</strong>
          </div>
        </div>
      </section>

      <section className="workflow-card">
        <div className="workflow-header">
          <div>
            <h2>Repair Workflow</h2>
            <p>
              Move the repair through its service lifecycle.
            </p>
          </div>

          {savingStatus && (
            <span className="saving-label">Saving...</span>
          )}
        </div>

        <div className="workflow-steps">
          {workflowStatuses.map((status) => (
            <button
              key={status}
              type="button"
              className={`workflow-step ${
                currentStatus === status
                  ? "workflow-step-active"
                  : ""
              }`}
              onClick={() => updateStatus(status)}
              disabled={
                savingStatus ||
                currentStatus === "cancelled" ||
                status === currentStatus
              }
            >
              <span className="workflow-step-number">
                {currentStatus === status ? (
                  getStatusIcon(status)
                ) : (
                  <span />
                )}
              </span>

              <span>{statusLabels[status]}</span>
            </button>
          ))}

          <button
            type="button"
            className={`workflow-step workflow-cancel ${
              currentStatus === "cancelled"
                ? "workflow-step-active"
                : ""
            }`}
            onClick={() => updateStatus("cancelled")}
            disabled={
              savingStatus || currentStatus === "cancelled"
            }
          >
            <span className="workflow-step-number">
              <XCircle size={15} />
            </span>

            <span>Cancelled</span>
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <CircleDollarSign size={18} />
          </div>

          <div>
            <span>Estimated Total</span>
            <strong>{formatMoney(estimatedTotal)}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Package size={18} />
          </div>

          <div>
            <span>Parts Cost</span>
            <strong>{formatMoney(partsCost)}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Wrench size={18} />
          </div>

          <div>
            <span>Actual Total</span>
            <strong>{formatMoney(actualTotal)}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <CircleDollarSign size={18} />
          </div>

          <div>
            <span>Customer Charge</span>
            <strong>{formatMoney(customerCharge)}</strong>
          </div>
        </div>
      </section>

      <div className="content-grid">
        <div className="main-column">
          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Repair Issue</h2>
                <p>Customer-reported problem.</p>
              </div>
            </div>

            <div className="text-block">
              {repair.issue || "No issue description recorded."}
            </div>
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Diagnosis</h2>
                <p>Technician diagnosis and findings.</p>
              </div>
            </div>

            <div className="text-block">
              {repair.diagnosis ||
                "Diagnosis has not been recorded yet."}
            </div>
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Work Performed</h2>
                <p>Service and repair work completed.</p>
              </div>
            </div>

            <div className="text-block">
              {repair.work_performed ||
                "No repair work has been recorded yet."}
            </div>
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Resolution</h2>
                <p>Final repair outcome.</p>
              </div>
            </div>

            <div className="text-block">
              {repair.resolution ||
                "No resolution has been recorded yet."}
            </div>
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Parts</h2>
                <p>Parts associated with this repair.</p>
              </div>

              <div className="parts-header-actions">
                <span className="count-badge">{parts.length}</span>

                <button
                  type="button"
                  className="add-part-button"
                  onClick={() =>
                    router.push(
                      `/repairs/${repair.id}/parts/new`,
                    )
                  }
                >
                  <Plus size={15} />
                  Add Part
                </button>
              </div>
            </div>

            {parts.length === 0 ? (
              <div className="empty-state">
                <Package size={22} />
                <strong>No parts added</strong>
                <span>
                  Add parts used or planned for this repair.
                </span>

                <button
                  type="button"
                  className="empty-add-part-button"
                  onClick={() =>
                    router.push(
                      `/repairs/${repair.id}/parts/new`,
                    )
                  }
                >
                  <Plus size={15} />
                  Add First Part
                </button>
              </div>
            ) : (
              <div className="parts-table-wrapper">
                <table className="parts-table">
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th>Qty</th>
                      <th>Unit Cost</th>
                      <th>Unit Charge</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {parts.map((part) => (
                      <tr key={part.id}>
                        <td>
                          <div className="part-name">
                            <strong>{part.description}</strong>

                            {part.notes && (
                              <span>{part.notes}</span>
                            )}
                          </div>
                        </td>

                        <td>{part.quantity}</td>

                        <td>{formatMoney(part.unit_cost)}</td>

                        <td>{formatMoney(part.unit_charge)}</td>

                        <td>
                          <span className="part-status">
                            {formatStatusText(part.status)}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="part-edit-button"
                            onClick={() =>
                              router.push(
                                `/repairs/${repair.id}/parts/${part.id}/edit`,
                              )
                            }
                          >
                            <Edit3 size={13} />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="parts-summary">
                  <div>
                    <span>Parts Cost</span>
                    <strong>{formatMoney(partsCost)}</strong>
                  </div>

                  <div>
                    <span>Parts Charge</span>
                    <strong>{formatMoney(partsCharge)}</strong>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Notes</h2>
                <p>Customer and internal notes.</p>
              </div>
            </div>

            <div className="notes-grid">
              <div className="note-box">
                <span>Customer Notes</span>
                <p>
                  {repair.customer_notes ||
                    "No customer notes recorded."}
                </p>
              </div>

              <div className="note-box">
                <span>Internal Notes</span>
                <p>
                  {repair.internal_notes ||
                    "No internal notes recorded."}
                </p>
              </div>
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Customer</h2>
                <p>Repair customer.</p>
              </div>
            </div>

            {customer ? (
              <div className="entity-card">
                <div className="entity-icon">
                  <UserRound size={18} />
                </div>

                <div className="entity-copy">
                  <strong>{customer.name}</strong>

                  {customer.email && (
                    <span>{customer.email}</span>
                  )}

                  {customer.phone && (
                    <span>{customer.phone}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="muted-value">
                No customer linked.
              </div>
            )}
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Product</h2>
                <p>Equipment being repaired.</p>
              </div>
            </div>

            {product ? (
              <div className="entity-card">
                <div className="entity-icon">
                  <Package size={18} />
                </div>

                <div className="entity-copy">
                  <strong>{product.name}</strong>

                  {repair.serial_number && (
                    <span>
                      Serial: {repair.serial_number}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="muted-value">
                No product linked.
              </div>
            )}
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Technician</h2>
                <p>Assigned employee.</p>
              </div>
            </div>

            {employee ? (
              <div className="entity-card">
                <div className="entity-icon">
                  <UserRound size={18} />
                </div>

                <div className="entity-copy">
                  <strong>{getEmployeeName(employee)}</strong>

                  {employee.job_title && (
                    <span>{employee.job_title}</span>
                  )}

                  {employee.email && (
                    <span>{employee.email}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="muted-value">
                No technician assigned.
              </div>
            )}
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Warranty</h2>
                <p>Warranty coverage.</p>
              </div>
            </div>

            {warranty ? (
              <div className="detail-list">
                <div>
                  <span>Warranty</span>
                  <strong>{warranty.warranty_number}</strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong className="capitalize">
                    {formatStatusText(warranty.status)}
                  </strong>
                </div>

                <div>
                  <span>Coverage</span>
                  <strong className="capitalize">
                    {formatStatusText(warranty.coverage_type)}
                  </strong>
                </div>

                <div>
                  <span>Start</span>
                  <strong>{formatDate(warranty.start_date)}</strong>
                </div>

                <div>
                  <span>Expires</span>
                  <strong>{formatDate(warranty.end_date)}</strong>
                </div>

                <div className="coverage-row">
                  <span>Repair Covered</span>

                  <strong
                    className={
                      repair.warranty_covered
                        ? "covered"
                        : "not-covered"
                    }
                  >
                    {repair.warranty_covered ? "Yes" : "No"}
                  </strong>
                </div>

                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    router.push(`/warranty/${warranty.id}`)
                  }
                >
                  View Warranty
                </button>
              </div>
            ) : (
              <div className="muted-value">
                No warranty linked.
              </div>
            )}
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Warranty Claim</h2>
                <p>Related customer claim.</p>
              </div>
            </div>

            {claim ? (
              <div className="detail-list">
                <div>
                  <span>Claim</span>
                  <strong>{claim.claim_number}</strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong className="capitalize">
                    {formatStatusText(claim.status)}
                  </strong>
                </div>

                <div>
                  <span>Claim Date</span>
                  <strong>{formatDate(claim.claim_date)}</strong>
                </div>

                {claim.issue && (
                  <div className="claim-issue">
                    <span>Issue</span>
                    <p>{claim.issue}</p>
                  </div>
                )}

                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    router.push(
                      `/warranty/claims/${claim.id}`,
                    )
                  }
                >
                  View Claim
                </button>
              </div>
            ) : (
              <div className="muted-value">
                No warranty claim linked.
              </div>
            )}
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Cost Breakdown</h2>
                <p>Estimated and actual repair costs.</p>
              </div>
            </div>

            <div className="cost-list">
              <div className="cost-section">
                <span className="cost-section-title">
                  Estimated
                </span>

                <div>
                  <span>Labor</span>
                  <strong>{formatMoney(estimatedLabor)}</strong>
                </div>

                <div>
                  <span>Parts</span>
                  <strong>{formatMoney(estimatedParts)}</strong>
                </div>

                <div className="cost-total">
                  <span>Total</span>
                  <strong>{formatMoney(estimatedTotal)}</strong>
                </div>
              </div>

              <div className="cost-section">
                <span className="cost-section-title">
                  Actual
                </span>

                <div>
                  <span>Labor</span>
                  <strong>{formatMoney(actualLabor)}</strong>
                </div>

                <div>
                  <span>Parts</span>
                  <strong>{formatMoney(actualParts)}</strong>
                </div>

                <div className="cost-total">
                  <span>Total</span>
                  <strong>{formatMoney(actualTotal)}</strong>
                </div>
              </div>

              <div className="charge-box">
                <span>Customer Charge</span>
                <strong>{formatMoney(customerCharge)}</strong>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="content-card activity-card">
        <div className="card-header">
          <div>
            <h2>Repair Activity</h2>
            <p>Timeline of actions and status changes.</p>
          </div>

          <span className="count-badge">{activity.length}</span>
        </div>

        {activity.length === 0 ? (
          <div className="empty-state">
            <FileText size={22} />
            <strong>No activity yet</strong>
            <span>Repair history will appear here.</span>
          </div>
        ) : (
          <div className="activity-list">
            {activity.map((item) => (
              <div className="activity-row" key={item.id}>
                <div className="activity-icon">
                  <Clock3 size={15} />
                </div>

                <div className="activity-content">
                  <div className="activity-top">
                    <strong>
                      {formatStatusText(item.action)}
                    </strong>

                    <span>
                      {formatDateTime(item.created_at)}
                    </span>
                  </div>

                  <p>{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="record-footer">
        <div>
          <CalendarDays size={15} />
          <span>
            Created {formatDateTime(repair.created_at)}
          </span>
        </div>

        <div>
          <Clock3 size={15} />
          <span>
            Updated {formatDateTime(repair.updated_at)}
          </span>
        </div>

        {repair.completed_at && (
          <div>
            <CheckCircle2 size={15} />
            <span>
              Completed {formatDateTime(repair.completed_at)}
            </span>
          </div>
        )}
      </section>

      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1500px;
          margin: 0 auto;
        }

        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .back-button,
        .secondary-button,
        .link-button,
        .add-part-button,
        .empty-add-part-button,
        .part-edit-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .back-button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #6b7280;
        }

        .back-button:hover {
          color: #111827;
        }

        .secondary-button {
          min-height: 38px;
          padding: 0 13px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          color: #374151;
        }

        .secondary-button:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .error-banner {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 18px;
          padding: 13px 15px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 13px;
        }

        .hero-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 24px;
          margin-bottom: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .hero-main {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .hero-icon {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #f3f4f6;
          color: #111827;
        }

        .hero-copy {
          min-width: 0;
        }

        .eyebrow {
          margin-bottom: 5px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .hero-title-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 26px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .hero-copy > p {
          margin: 6px 0 0;
          color: #6b7280;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hero-meta {
          display: flex;
          align-items: center;
          gap: 28px;
          flex-shrink: 0;
        }

        .hero-meta div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .hero-meta span {
          color: #9ca3af;
          font-size: 11px;
          font-weight: 600;
        }

        .hero-meta strong {
          color: #374151;
          font-size: 13px;
        }

        .status-badge,
        .priority-badge,
        .part-status,
        .count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .status-badge {
          min-height: 25px;
          padding: 0 9px;
          font-size: 11px;
          font-weight: 700;
        }

        .status-intake {
          background: #f3f4f6;
          color: #374151;
        }

        .status-diagnosing {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-awaiting {
          background: #fff7ed;
          color: #c2410c;
        }

        .status-repair {
          background: #f5f3ff;
          color: #6d28d9;
        }

        .status-quality {
          background: #ecfeff;
          color: #0e7490;
        }

        .status-ready {
          background: #f0fdf4;
          color: #15803d;
        }

        .status-completed {
          background: #dcfce7;
          color: #166534;
        }

        .status-cancelled {
          background: #fee2e2;
          color: #b91c1c;
        }

        .priority-badge {
          min-height: 25px;
          padding: 0 9px;
          font-size: 11px;
          font-weight: 700;
        }

        .priority-low {
          background: #f3f4f6;
          color: #6b7280;
        }

        .priority-normal {
          background: #eff6ff;
          color: #2563eb;
        }

        .priority-high {
          background: #fff7ed;
          color: #c2410c;
        }

        .priority-urgent {
          background: #fee2e2;
          color: #b91c1c;
        }

        .workflow-card {
          margin-bottom: 18px;
          padding: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .workflow-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .workflow-header h2,
        .card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .workflow-header p,
        .card-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .saving-label {
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
        }

        .workflow-steps {
          display: flex;
          align-items: stretch;
          gap: 7px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .workflow-step {
          min-width: 125px;
          min-height: 64px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 10px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #ffffff;
          color: #6b7280;
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition:
            border-color 0.15s ease,
            background 0.15s ease,
            color 0.15s ease;
        }

        .workflow-step:hover:not(:disabled) {
          border-color: #9ca3af;
          background: #f9fafb;
          color: #374151;
        }

        .workflow-step:disabled {
          cursor: default;
        }

        .workflow-step-active {
          border-color: #111827;
          background: #111827;
          color: #ffffff;
        }

        .workflow-step-active:hover:not(:disabled) {
          border-color: #111827;
          background: #111827;
          color: #ffffff;
        }

        .workflow-step-number {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f3f4f6;
          color: #6b7280;
        }

        .workflow-step-active .workflow-step-number {
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
        }

        .workflow-cancel {
          min-width: 105px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 78px;
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }

        .stat-icon {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #f3f4f6;
          color: #374151;
        }

        .stat-card div:last-child {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-card span {
          color: #6b7280;
          font-size: 11px;
          font-weight: 600;
        }

        .stat-card strong {
          color: #111827;
          font-size: 17px;
          font-weight: 700;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 18px;
          align-items: start;
        }

        .main-column,
        .side-column {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .content-card {
          padding: 21px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .parts-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .count-badge {
          min-width: 25px;
          height: 25px;
          padding: 0 8px;
          background: #f3f4f6;
          color: #374151;
          font-size: 11px;
          font-weight: 700;
        }

        .add-part-button {
          min-height: 34px;
          padding: 0 11px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          color: #374151;
          font-size: 12px;
        }

        .add-part-button:hover {
          border-color: #9ca3af;
          background: #f9fafb;
          color: #111827;
        }

        .text-block {
          min-height: 70px;
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #f9fafb;
          color: #374151;
          font-size: 13px;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .parts-table-wrapper {
          overflow-x: auto;
        }

        .parts-table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
        }

        .parts-table th {
          padding: 10px 11px;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          text-align: left;
          white-space: nowrap;
        }

        .parts-table td {
          padding: 13px 11px;
          border-bottom: 1px solid #f3f4f6;
          color: #374151;
          font-size: 12px;
        }

        .part-name {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .part-name strong {
          color: #111827;
          font-size: 12px;
        }

        .part-name span {
          color: #9ca3af;
          font-size: 11px;
        }

        .part-status {
          min-height: 23px;
          padding: 0 8px;
          background: #f3f4f6;
          color: #374151;
          font-size: 10px;
          font-weight: 700;
        }

        .part-edit-button {
          min-height: 32px;
          padding: 0 10px;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          background: #ffffff;
          color: #374151;
          font-size: 11px;
        }

        .part-edit-button:hover {
          border-color: #9ca3af;
          background: #f9fafb;
          color: #111827;
        }

        .parts-summary {
          display: flex;
          justify-content: flex-end;
          gap: 24px;
          padding-top: 15px;
        }

        .parts-summary div {
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: right;
        }

        .parts-summary span {
          color: #6b7280;
          font-size: 11px;
        }

        .parts-summary strong {
          color: #111827;
          font-size: 14px;
        }

        .notes-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .note-box {
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #f9fafb;
        }

        .note-box > span {
          display: block;
          margin-bottom: 8px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
        }

        .note-box p {
          margin: 0;
          color: #374151;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .entity-card {
          display: flex;
          align-items: flex-start;
          gap: 11px;
        }

        .entity-icon {
          width: 35px;
          height: 35px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #f3f4f6;
          color: #374151;
        }

        .entity-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .entity-copy strong {
          color: #111827;
          font-size: 13px;
        }

        .entity-copy span {
          color: #6b7280;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .muted-value {
          color: #9ca3af;
          font-size: 12px;
        }

        .detail-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .detail-list > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .detail-list span {
          color: #6b7280;
          font-size: 11px;
        }

        .detail-list strong {
          color: #374151;
          font-size: 12px;
          text-align: right;
        }

        .capitalize {
          text-transform: capitalize;
        }

        .coverage-row {
          padding-top: 11px;
          border-top: 1px solid #f3f4f6;
        }

        .covered {
          color: #15803d !important;
        }

        .not-covered {
          color: #b91c1c !important;
        }

        .claim-issue {
          display: block !important;
        }

        .claim-issue span {
          display: block;
          margin-bottom: 5px;
        }

        .claim-issue p {
          margin: 0;
          color: #374151;
          font-size: 12px;
          line-height: 1.5;
        }

        .link-button {
          width: 100%;
          min-height: 36px;
          margin-top: 3px;
          padding: 0 11px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          color: #374151;
        }

        .link-button:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .cost-list {
          display: flex;
          flex-direction: column;
          gap: 17px;
        }

        .cost-section {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .cost-section-title {
          color: #374151;
          font-size: 11px;
          font-weight: 700;
        }

        .cost-section > div {
          display: flex;
          justify-content: space-between;
          gap: 15px;
        }

        .cost-section > div span {
          color: #6b7280;
          font-size: 11px;
        }

        .cost-section > div strong {
          color: #374151;
          font-size: 12px;
        }

        .cost-total {
          padding-top: 9px;
          border-top: 1px solid #e5e7eb;
        }

        .cost-total span,
        .cost-total strong {
          color: #111827 !important;
          font-weight: 700;
        }

        .charge-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #f9fafb;
        }

        .charge-box span {
          color: #374151;
          font-size: 11px;
          font-weight: 700;
        }

        .charge-box strong {
          color: #111827;
          font-size: 15px;
        }

        .empty-state {
          min-height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: #9ca3af;
          text-align: center;
        }

        .empty-state strong {
          color: #6b7280;
          font-size: 12px;
        }

        .empty-state span {
          max-width: 360px;
          font-size: 11px;
          line-height: 1.5;
        }

        .empty-add-part-button {
          min-height: 34px;
          margin-top: 7px;
          padding: 0 11px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          color: #374151;
          font-size: 12px;
        }

        .empty-add-part-button:hover {
          border-color: #9ca3af;
          background: #f9fafb;
          color: #111827;
        }

        .activity-card {
          margin-top: 18px;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
        }

        .activity-row {
          display: flex;
          gap: 12px;
          padding: 15px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .activity-row:first-child {
          padding-top: 0;
        }

        .activity-row:last-child {
          padding-bottom: 0;
          border-bottom: 0;
        }

        .activity-icon {
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f3f4f6;
          color: #6b7280;
        }

        .activity-content {
          min-width: 0;
          flex: 1;
        }

        .activity-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .activity-top strong {
          color: #374151;
          font-size: 12px;
        }

        .activity-top span {
          flex-shrink: 0;
          color: #9ca3af;
          font-size: 10px;
        }

        .activity-content p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.5;
        }

        .record-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 14px;
          color: #9ca3af;
          font-size: 10px;
        }

        .record-footer div {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        @media (max-width: 1150px) {
          .content-grid {
            grid-template-columns: minmax(0, 1fr) 310px;
          }

          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .hero-card {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 900px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .notes-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .page-content {
            padding: 20px 16px;
          }

          .top-bar {
            align-items: flex-start;
          }

          .hero-card {
            padding: 18px;
          }

          .hero-main {
            align-items: flex-start;
          }

          .hero-title-row h1 {
            font-size: 22px;
          }

          .hero-copy > p {
            white-space: normal;
          }

          .hero-meta {
            width: 100%;
            justify-content: space-between;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: flex;
          }

          .content-card {
            padding: 18px;
          }

          .record-footer {
            justify-content: flex-start;
          }

          .parts-header-actions {
            align-items: flex-end;
            flex-direction: column;
          }

          .add-part-button {
            min-height: 32px;
          }
        }
      `}</style>
    </main>
  );
}