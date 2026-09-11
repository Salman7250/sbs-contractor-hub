"use client";

import { FormEvent, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Save,
  Wrench,
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

type RepairPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

type Repair = {
  id: string;
  company_id: string;
  repair_number: string;
  warranty_id: string | null;
  warranty_claim_id: string | null;
  customer_id: string | null;
  product_id: string | null;
  assigned_employee_id: string | null;
  status: RepairStatus;
  priority: RepairPriority;
  source: string;
  issue: string | null;
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
  received_at: string | null;
  diagnosed_at: string | null;
  repair_started_at: string | null;
  quality_checked_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
};

type Customer = {
  id: string;
  name: string;
} | null;

type Product = {
  id: string;
  name: string;
} | null;

type EmployeeOption = {
  id: string;
  name: string;
  jobTitle: string | null;
};

type Warranty = {
  id: string;
  warranty_number: string;
  status: string;
  coverage_type: string;
  start_date: string;
  end_date: string;
  serial_number: string | null;
} | null;

type Claim = {
  id: string;
  claim_number: string;
  status: string;
  issue: string | null;
  claim_date: string;
  resolution: string | null;
} | null;

type Props = {
  repair: Repair;
  customer: Customer;
  product: Product;
  employeeOptions: EmployeeOption[];
  warranty: Warranty;
  claim: Claim;
};

const statusOptions: Array<{
  value: RepairStatus;
  label: string;
}> = [
  { value: "intake", label: "Intake" },
  { value: "diagnosing", label: "Diagnosing" },
  { value: "awaiting_parts", label: "Awaiting Parts" },
  { value: "in_repair", label: "In Repair" },
  { value: "quality_check", label: "Quality Check" },
  { value: "ready_for_return", label: "Ready for Return" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const priorityOptions: Array<{
  value: RepairPriority;
  label: string;
}> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function formatStatus(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCoverage(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toInputDateTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function dateTimeToIso(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function RepairEditClient({
  repair,
  customer,
  product,
  employeeOptions,
  warranty,
  claim,
}: Props) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [status, setStatus] = useState<RepairStatus>(repair.status);
  const [priority, setPriority] = useState<RepairPriority>(repair.priority);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(
    repair.assigned_employee_id ?? "",
  );
  const [warrantyCovered, setWarrantyCovered] = useState(
    repair.warranty_covered,
  );

  const [issue, setIssue] = useState(repair.issue ?? "");
  const [diagnosis, setDiagnosis] = useState(repair.diagnosis ?? "");
  const [workPerformed, setWorkPerformed] = useState(
    repair.work_performed ?? "",
  );
  const [resolution, setResolution] = useState(
    repair.resolution ?? "",
  );
  const [customerNotes, setCustomerNotes] = useState(
    repair.customer_notes ?? "",
  );
  const [internalNotes, setInternalNotes] = useState(
    repair.internal_notes ?? "",
  );

  const [estimatedLabor, setEstimatedLabor] = useState(
    String(repair.estimated_labor ?? 0),
  );
  const [estimatedParts, setEstimatedParts] = useState(
    String(repair.estimated_parts ?? 0),
  );
  const [estimatedTotal, setEstimatedTotal] = useState(
    String(repair.estimated_total ?? 0),
  );
  const [actualLabor, setActualLabor] = useState(
    String(repair.actual_labor ?? 0),
  );
  const [actualParts, setActualParts] = useState(
    String(repair.actual_parts ?? 0),
  );
  const [actualTotal, setActualTotal] = useState(
    String(repair.actual_total ?? 0),
  );
  const [customerCharge, setCustomerCharge] = useState(
    String(repair.customer_charge ?? 0),
  );

  const [receivedAt, setReceivedAt] = useState(
    toInputDateTime(repair.received_at),
  );
  const [diagnosedAt, setDiagnosedAt] = useState(
    toInputDateTime(repair.diagnosed_at),
  );
  const [repairStartedAt, setRepairStartedAt] = useState(
    toInputDateTime(repair.repair_started_at),
  );
  const [qualityCheckedAt, setQualityCheckedAt] = useState(
    toInputDateTime(repair.quality_checked_at),
  );
  const [completedAt, setCompletedAt] = useState(
    toInputDateTime(repair.completed_at),
  );
  const [cancelledAt, setCancelledAt] = useState(
    toInputDateTime(repair.cancelled_at),
  );

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const calculatedEstimatedTotal =
    Number(estimatedLabor || 0) + Number(estimatedParts || 0);

  const calculatedActualTotal =
    Number(actualLabor || 0) + Number(actualParts || 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError || !membership?.company_id) {
        throw new Error("Your company membership could not be verified.");
      }

      const companyId = membership.company_id;

      if (companyId !== repair.company_id) {
        throw new Error("You are not authorized to edit this repair.");
      }

      const { data: isAdmin, error: adminError } = await supabase.rpc(
        "is_company_admin",
        {
          p_company_id: companyId,
        },
      );

      if (adminError) {
        throw new Error("Could not verify your company permissions.");
      }

      let hasPermission = Boolean(isAdmin);

      if (!hasPermission) {
        const { data: canManageRepair, error: permissionError } =
          await supabase.rpc("employee_has_permission", {
            p_company_id: companyId,
            p_module: "repairs",
            p_action: "manage",
          });

        if (permissionError) {
          throw new Error("Could not verify your repair permissions.");
        }

        hasPermission = Boolean(canManageRepair);
      }

      if (!hasPermission) {
        throw new Error(
          "You do not have permission to manage repairs.",
        );
      }

      const parsedEstimatedLabor = Number(estimatedLabor || 0);
      const parsedEstimatedParts = Number(estimatedParts || 0);
      const parsedEstimatedTotal = Number(estimatedTotal || 0);
      const parsedActualLabor = Number(actualLabor || 0);
      const parsedActualParts = Number(actualParts || 0);
      const parsedActualTotal = Number(actualTotal || 0);
      const parsedCustomerCharge = Number(customerCharge || 0);

      const amounts = [
        parsedEstimatedLabor,
        parsedEstimatedParts,
        parsedEstimatedTotal,
        parsedActualLabor,
        parsedActualParts,
        parsedActualTotal,
        parsedCustomerCharge,
      ];

      if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
        throw new Error(
          "All financial amounts must be valid non-negative numbers.",
        );
      }

      if (
        Math.abs(
          parsedEstimatedTotal -
            (parsedEstimatedLabor + parsedEstimatedParts),
        ) > 0.01
      ) {
        throw new Error(
          "Estimated total must equal estimated labor plus estimated parts.",
        );
      }

      if (
        Math.abs(
          parsedActualTotal -
            (parsedActualLabor + parsedActualParts),
        ) > 0.01
      ) {
        throw new Error(
          "Actual total must equal actual labor plus actual parts.",
        );
      }

      if (status === "completed" && !completedAt) {
        setCompletedAt(new Date().toISOString().slice(0, 16));
      }

      if (status === "cancelled" && !cancelledAt) {
        setCancelledAt(new Date().toISOString().slice(0, 16));
      }

      const now = new Date().toISOString();

      const nextReceivedAt =
        receivedAt ? dateTimeToIso(receivedAt) : null;

      const nextDiagnosedAt =
        diagnosedAt ? dateTimeToIso(diagnosedAt) : null;

      const nextRepairStartedAt =
        repairStartedAt ? dateTimeToIso(repairStartedAt) : null;

      const nextQualityCheckedAt =
        qualityCheckedAt ? dateTimeToIso(qualityCheckedAt) : null;

      const nextCompletedAt =
        status === "completed"
          ? dateTimeToIso(completedAt) ?? now
          : completedAt
            ? dateTimeToIso(completedAt)
            : null;

      const nextCancelledAt =
        status === "cancelled"
          ? dateTimeToIso(cancelledAt) ?? now
          : cancelledAt
            ? dateTimeToIso(cancelledAt)
            : null;

      const { data: updatedRepair, error: updateError } = await supabase
        .from("repairs")
        .update({
          status,
          priority,
          assigned_employee_id: assignedEmployeeId || null,
          warranty_covered: warrantyCovered,
          issue: issue.trim() || null,
          diagnosis: diagnosis.trim() || null,
          work_performed: workPerformed.trim() || null,
          resolution: resolution.trim() || null,
          customer_notes: customerNotes.trim() || null,
          internal_notes: internalNotes.trim() || null,
          estimated_labor: parsedEstimatedLabor,
          estimated_parts: parsedEstimatedParts,
          estimated_total: parsedEstimatedTotal,
          actual_labor: parsedActualLabor,
          actual_parts: parsedActualParts,
          actual_total: parsedActualTotal,
          customer_charge: parsedCustomerCharge,
          received_at: nextReceivedAt,
          diagnosed_at: nextDiagnosedAt,
          repair_started_at: nextRepairStartedAt,
          quality_checked_at: nextQualityCheckedAt,
          completed_at: nextCompletedAt,
          cancelled_at: nextCancelledAt,
        })
        .eq("id", params.id)
        .eq("company_id", companyId)
        .select("id, status, priority, assigned_employee_id")
        .maybeSingle();

      if (updateError) {
        throw new Error(
          updateError.message ||
            "The repair could not be updated.",
        );
      }

      if (!updatedRepair) {
        throw new Error(
          "The repair was not updated. It may no longer exist.",
        );
      }

      const activityMessages: string[] = [];

      if (repair.status !== status) {
        activityMessages.push(
          `Status changed from ${formatStatus(
            repair.status,
          )} to ${formatStatus(status)}.`,
        );
      }

      if (repair.priority !== priority) {
        activityMessages.push(
          `Priority changed from ${formatStatus(
            repair.priority,
          )} to ${formatStatus(priority)}.`,
        );
      }

      if (
        repair.assigned_employee_id !==
        (assignedEmployeeId || null)
      ) {
        const selectedEmployee = employeeOptions.find(
          (employee) => employee.id === assignedEmployeeId,
        );

        activityMessages.push(
          selectedEmployee
            ? `Technician assigned to ${selectedEmployee.name}.`
            : "Technician assignment removed.",
        );
      }

      if (repair.warranty_covered !== warrantyCovered) {
        activityMessages.push(
          warrantyCovered
            ? "Warranty coverage marked as covered."
            : "Warranty coverage marked as customer charge.",
        );
      }

      if (repair.diagnosis !== (diagnosis.trim() || null)) {
        activityMessages.push("Diagnosis updated.");
      }

      if (
        repair.work_performed !==
        (workPerformed.trim() || null)
      ) {
        activityMessages.push("Work performed updated.");
      }

      if (repair.resolution !== (resolution.trim() || null)) {
        activityMessages.push("Resolution updated.");
      }

      if (repair.customer_charge !== parsedCustomerCharge) {
        activityMessages.push("Customer charge updated.");
      }

      if (activityMessages.length > 0) {
        const { error: activityError } = await supabase
          .from("repair_activity")
          .insert({
            company_id: companyId,
            repair_id: repair.id,
            action: "updated",
            message: activityMessages.join(" "),
            created_by: user.id,
          });

        if (activityError) {
          console.error(
            "Repair activity logging failed:",
            activityError,
          );
        }
      }

      router.refresh();
      router.push(`/repairs/${repair.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while updating the repair.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Wrench size={15} />
            Repair Management
          </div>

          <h1>Edit Repair</h1>

          <p>
            Update the repair workflow, technical findings,
            technician assignment, costs, and customer-facing
            information.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => router.push(`/repairs/${repair.id}`)}
          >
            <ArrowLeft size={16} />
            Back to Repair
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="error-banner">
          <strong>Unable to save repair</strong>
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Repair Workflow</h2>
                <p>Control the current repair stage and priority.</p>
              </div>
            </div>

            <div className="fields-grid">
              <div className="field">
                <label>Repair Number</label>
                <input
                  value={repair.repair_number}
                  readOnly
                  className="readonly-input"
                />
              </div>

              <div className="field">
                <label>Status</label>
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as RepairStatus)
                  }
                >
                  {statusOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Priority</label>
                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(
                      event.target.value as RepairPriority,
                    )
                  }
                >
                  {priorityOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Technician</label>
                <select
                  value={assignedEmployeeId}
                  onChange={(event) =>
                    setAssignedEmployeeId(event.target.value)
                  }
                >
                  <option value="">Unassigned</option>

                  {employeeOptions.map((employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                    >
                      {employee.name}
                      {employee.jobTitle
                        ? ` — ${employee.jobTitle}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field full-width">
                <label>Warranty Coverage</label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={warrantyCovered}
                    onChange={(event) =>
                      setWarrantyCovered(event.target.checked)
                    }
                  />

                  <span>
                    Mark this repair as covered under warranty
                  </span>
                </label>

                {warranty ? (
                  <div className="info-strip">
                    <strong>{warranty.warranty_number}</strong>
                    <span>
                      {formatCoverage(warranty.coverage_type)} ·{" "}
                      {warranty.status}
                    </span>
                  </div>
                ) : (
                  <div className="muted-help">
                    This repair is not currently linked to a warranty.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>Customer & Product</h2>
                <p>Reference information for this repair.</p>
              </div>
            </div>

            <div className="reference-grid">
              <div className="reference-item">
                <span>Customer</span>
                <strong>
                  {customer?.name ?? "No customer linked"}
                </strong>
              </div>

              <div className="reference-item">
                <span>Product</span>
                <strong>
                  {product?.name ?? "No product linked"}
                </strong>
              </div>

              {claim ? (
                <div className="reference-item">
                  <span>Warranty Claim</span>
                  <strong>{claim.claim_number}</strong>
                  <small>{formatStatus(claim.status)}</small>
                </div>
              ) : null}

              {warranty ? (
                <div className="reference-item">
                  <span>Warranty</span>
                  <strong>{warranty.warranty_number}</strong>
                  <small>
                    {warranty.start_date} → {warranty.end_date}
                  </small>
                </div>
              ) : null}
            </div>
          </section>

          <section className="card full-card">
            <div className="card-header">
              <div>
                <h2>Technical Details</h2>
                <p>
                  Record diagnosis, repair work, and the final
                  resolution.
                </p>
              </div>
            </div>

            <div className="stacked-fields">
              <div className="field">
                <label>Customer Issue</label>
                <textarea
                  value={issue}
                  onChange={(event) =>
                    setIssue(event.target.value)
                  }
                  rows={4}
                  placeholder="Describe the customer's reported issue..."
                />
              </div>

              <div className="field">
                <label>Diagnosis</label>
                <textarea
                  value={diagnosis}
                  onChange={(event) =>
                    setDiagnosis(event.target.value)
                  }
                  rows={5}
                  placeholder="Record the technician's diagnosis..."
                />
              </div>

              <div className="field">
                <label>Work Performed</label>
                <textarea
                  value={workPerformed}
                  onChange={(event) =>
                    setWorkPerformed(event.target.value)
                  }
                  rows={5}
                  placeholder="Describe the repair work completed..."
                />
              </div>

              <div className="field">
                <label>Resolution</label>
                <textarea
                  value={resolution}
                  onChange={(event) =>
                    setResolution(event.target.value)
                  }
                  rows={4}
                  placeholder="Describe the final resolution..."
                />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>Estimated Costs</h2>
                <p>Expected labor and parts costs.</p>
              </div>
            </div>

            <div className="fields-grid">
              <div className="field">
                <label>Estimated Labor</label>
                <div className="money-input">
                  <span>USD</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={estimatedLabor}
                    onChange={(event) =>
                      setEstimatedLabor(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label>Estimated Parts</label>
                <div className="money-input">
                  <span>USD</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={estimatedParts}
                    onChange={(event) =>
                      setEstimatedParts(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label>Estimated Total</label>
                <div className="money-input">
                  <span>USD</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={estimatedTotal}
                    onChange={(event) =>
                      setEstimatedTotal(event.target.value)
                    }
                  />
                </div>

                <div className="calculation-note">
                  Labor + parts ={" "}
                  <strong>
                    {money(calculatedEstimatedTotal)}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>Actual Costs</h2>
                <p>Record the actual repair costs.</p>
              </div>
            </div>

            <div className="fields-grid">
              <div className="field">
                <label>Actual Labor</label>
                <div className="money-input">
                  <span>USD</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={actualLabor}
                    onChange={(event) =>
                      setActualLabor(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label>Actual Parts</label>
                <div className="money-input">
                  <span>USD</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={actualParts}
                    onChange={(event) =>
                      setActualParts(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label>Actual Total</label>
                <div className="money-input">
                  <span>USD</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={actualTotal}
                    onChange={(event) =>
                      setActualTotal(event.target.value)
                    }
                  />
                </div>

                <div className="calculation-note">
                  Labor + parts ={" "}
                  <strong>
                    {money(calculatedActualTotal)}
                  </strong>
                </div>
              </div>

              <div className="field">
                <label>Customer Charge</label>
                <div className="money-input">
                  <span>USD</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customerCharge}
                    onChange={(event) =>
                      setCustomerCharge(event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="card full-card">
            <div className="card-header">
              <div>
                <h2>Repair Timeline</h2>
                <p>
                  Adjust operational timestamps when required.
                </p>
              </div>
            </div>

            <div className="fields-grid">
              <div className="field">
                <label>Received At</label>
                <input
                  type="datetime-local"
                  value={receivedAt}
                  onChange={(event) =>
                    setReceivedAt(event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Diagnosed At</label>
                <input
                  type="datetime-local"
                  value={diagnosedAt}
                  onChange={(event) =>
                    setDiagnosedAt(event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Repair Started At</label>
                <input
                  type="datetime-local"
                  value={repairStartedAt}
                  onChange={(event) =>
                    setRepairStartedAt(event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Quality Checked At</label>
                <input
                  type="datetime-local"
                  value={qualityCheckedAt}
                  onChange={(event) =>
                    setQualityCheckedAt(event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Completed At</label>
                <input
                  type="datetime-local"
                  value={completedAt}
                  onChange={(event) =>
                    setCompletedAt(event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Cancelled At</label>
                <input
                  type="datetime-local"
                  value={cancelledAt}
                  onChange={(event) =>
                    setCancelledAt(event.target.value)
                  }
                />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>Customer Notes</h2>
                <p>Information suitable for customer communication.</p>
              </div>
            </div>

            <div className="field">
              <textarea
                value={customerNotes}
                onChange={(event) =>
                  setCustomerNotes(event.target.value)
                }
                rows={7}
                placeholder="Add customer-facing notes..."
              />
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>Internal Notes</h2>
                <p>Private operational notes for your team.</p>
              </div>
            </div>

            <div className="field">
              <textarea
                value={internalNotes}
                onChange={(event) =>
                  setInternalNotes(event.target.value)
                }
                rows={7}
                placeholder="Add internal repair notes..."
              />
            </div>
          </section>
        </div>

        <div className="form-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={() => router.push(`/repairs/${repair.id}`)}
            disabled={saving}
          >
            <ArrowLeft size={16} />
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 8px;
          color: #16a34a;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .page-header p {
          max-width: 760px;
          margin: 8px 0 0;
          color: #6b7280;
          font-size: 14px;
          line-height: 1.6;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }

        .card {
          min-width: 0;
          padding: 22px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .full-card {
          grid-column: 1 / -1;
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        .card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          line-height: 1.4;
          font-weight: 700;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.5;
        }

        .fields-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .stacked-fields {
          display: grid;
          gap: 18px;
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

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #ffffff;
          color: #111827;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .field input,
        .field select {
          min-height: 42px;
          padding: 0 12px;
        }

        .field textarea {
          min-height: 100px;
          padding: 11px 12px;
          resize: vertical;
          line-height: 1.55;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #16a34a;
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1);
        }

        .readonly-input {
          background: #f9fafb !important;
          color: #6b7280 !important;
          cursor: not-allowed;
        }

        .checkbox-row {
          display: flex !important;
          align-items: center;
          gap: 9px;
          min-height: 42px;
          margin: 0 !important;
          padding: 10px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #f9fafb;
          cursor: pointer;
        }

        .checkbox-row input {
          width: 16px;
          height: 16px;
          min-height: 16px;
          margin: 0;
          accent-color: #16a34a;
        }

        .checkbox-row span {
          color: #374151;
          font-size: 13px;
          font-weight: 500;
        }

        .info-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 10px;
          padding: 11px 12px;
          border: 1px solid #dcfce7;
          border-radius: 9px;
          background: #f0fdf4;
          color: #166534;
          font-size: 12px;
        }

        .info-strip strong {
          font-size: 13px;
        }

        .muted-help {
          margin-top: 8px;
          color: #9ca3af;
          font-size: 12px;
        }

        .reference-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .reference-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          padding: 14px;
          border: 1px solid #eef2f7;
          border-radius: 10px;
          background: #f9fafb;
        }

        .reference-item span {
          color: #6b7280;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .reference-item strong {
          overflow: hidden;
          color: #111827;
          font-size: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .reference-item small {
          color: #6b7280;
          font-size: 12px;
        }

        .money-input {
          display: flex;
          align-items: stretch;
        }

        .money-input span {
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          border: 1px solid #d1d5db;
          border-right: 0;
          border-radius: 9px 0 0 9px;
          background: #f9fafb;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
        }

        .money-input input {
          border-radius: 0 9px 9px 0;
        }

        .calculation-note {
          margin-top: 7px;
          color: #6b7280;
          font-size: 11px;
        }

        .calculation-note strong {
          color: #111827;
        }

        .error-banner {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-bottom: 20px;
          padding: 13px 15px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 13px;
          line-height: 1.5;
        }

        .secondary-button,
        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            opacity 0.15s ease;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .secondary-button:hover:not(:disabled) {
          border-color: #9ca3af;
          background: #f9fafb;
          color: #111827;
        }

        .primary-button {
          border: 1px solid #16a34a;
          background: #16a34a;
          color: #ffffff;
        }

        .primary-button:hover:not(:disabled) {
          border-color: #15803d;
          background: #15803d;
        }

        .secondary-button:disabled,
        .primary-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .form-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
          padding: 18px 0 4px;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.4);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 980px) {
          .form-grid {
            grid-template-columns: 1fr;
          }

          .full-card {
            grid-column: auto;
          }
        }

        @media (max-width: 700px) {
          .page-content {
            padding: 20px;
          }

          .page-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            width: 100%;
          }

          .fields-grid,
          .reference-grid {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: auto;
          }

          .card {
            padding: 18px;
          }

          .form-footer {
            flex-direction: column-reverse;
          }

          .form-footer button {
            width: 100%;
          }

          .info-strip {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}