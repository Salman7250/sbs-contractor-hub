"use client";

import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Edit3,
  FileText,
  Package,
  RefreshCw,
  Truck,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  start_date: string;
  end_date: string;
  serial_number: string | null;
};

type Claim = {
  id: string;
  claim_number: string;
  status: string;
  issue: string;
  claim_date: string;
  resolution: string | null;
};

type Repair = {
  id: string;
  repair_number: string;
  status: string;
  priority: string;
  issue: string | null;
  serial_number: string | null;
};

type Activity = {
  id: string;
  action: string;
  message: string;
  created_by: string | null;
  created_at: string;
};

type Props = {
  rma: Rma;
  customer: Customer | null;
  product: Product | null;
  employee: Employee | null;
  warranty: Warranty | null;
  claim: Claim | null;
  repair: Repair | null;
  activity: Activity[];
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
  {
    background: string;
    color: string;
    border: string;
  }
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
  {
    background: string;
    color: string;
    border: string;
  }
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

const workflow: RmaStatus[] = [
  "requested",
  "under_review",
  "approved",
  "awaiting_return",
  "received",
  "inspecting",
  "resolution_pending",
  "completed",
];

const repairEligibleStatuses: RmaStatus[] = [
  "received",
  "inspecting",
  "resolution_pending",
  "repair",
];

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

function formatText(value: string | null) {
  if (!value) {
    return "—";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function getEmployeeName(employee: Employee | null) {
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

  return name || employee.email || "Employee";
}

function getStatusIcon(status: RmaStatus) {
  if (status === "completed") {
    return <CheckCircle2 size={16} />;
  }

  if (
    status === "rejected" ||
    status === "cancelled"
  ) {
    return <XCircle size={16} />;
  }

  if (
    status === "repair" ||
    status === "replacement"
  ) {
    return <Wrench size={16} />;
  }

  if (
    status === "received" ||
    status === "inspecting"
  ) {
    return <Package size={16} />;
  }

  return <Clock3 size={16} />;
}

export default function RmaDetailClient({
  rma,
  customer,
  product,
  employee,
  warranty,
  claim,
  repair,
  activity,
}: Props) {
  const router = useRouter();

  const [currentStatus, setCurrentStatus] =
    useState<RmaStatus>(rma.status);

  const [savingStatus, setSavingStatus] =
    useState(false);

  const [creatingRepair, setCreatingRepair] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [repairError, setRepairError] =
    useState("");

  const statusStyle =
    statusStyles[currentStatus];

  const priorityStyle =
    priorityStyles[rma.priority];

  const workflowIndex = workflow.indexOf(
    currentStatus,
  );

  const canCreateRepair =
    repair === null &&
    repairEligibleStatuses.includes(
      currentStatus,
    ) &&
    Boolean(rma.customer_id) &&
    Boolean(rma.product_id);

  const stats = useMemo(
    () => [
      {
        label: "RMA Number",
        value: rma.rma_number,
        icon: <FileText size={18} />,
      },
      {
        label: "Priority",
        value: priorityLabels[rma.priority],
        icon: <AlertCircle size={18} />,
      },
      {
        label: "Received",
        value: formatDate(rma.received_date),
        icon: <Package size={18} />,
      },
      {
        label: "Completed",
        value: formatDate(rma.completed_date),
        icon: <CheckCircle2 size={18} />,
      },
    ],
    [rma],
  );

  async function updateStatus(
    nextStatus: RmaStatus,
  ) {
    if (nextStatus === currentStatus) {
      return;
    }

    setSavingStatus(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
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

      if (
        membershipError ||
        !membership?.company_id
      ) {
        throw new Error(
          "Your company membership could not be verified.",
        );
      }

      if (
        membership.company_id !==
        rma.company_id
      ) {
        throw new Error(
          "You cannot update this RMA.",
        );
      }

      const companyId =
        membership.company_id;

      const {
        data: isAdmin,
        error: adminError,
      } = await supabase.rpc(
        "is_company_admin",
        {
          p_company_id: companyId,
        },
      );

      if (adminError) {
        throw adminError;
      }

      let hasPermission =
        Boolean(isAdmin);

      if (!hasPermission) {
        const {
          data: permissionResult,
          error: permissionError,
        } = await supabase.rpc(
          "employee_has_permission",
          {
            p_company_id: companyId,
            p_module: "rma",
            p_action: "manage",
          },
        );

        if (permissionError) {
          throw permissionError;
        }

        hasPermission =
          Boolean(permissionResult);
      }

      if (!hasPermission) {
        throw new Error(
          "You do not have permission to update RMAs.",
        );
      }

      const updatePayload: {
        status: RmaStatus;
        received_date?: string | null;
        inspection_date?: string | null;
        completed_date?: string | null;
      } = {
        status: nextStatus,
      };

      const today = new Date()
        .toISOString()
        .slice(0, 10);

      if (
        nextStatus === "received" &&
        !rma.received_date
      ) {
        updatePayload.received_date =
          today;
      }

      if (
        nextStatus === "inspecting" &&
        !rma.inspection_date
      ) {
        updatePayload.inspection_date =
          today;
      }

      if (
        nextStatus === "completed" &&
        !rma.completed_date
      ) {
        updatePayload.completed_date =
          today;
      }

      const { error: updateError } =
        await supabase
          .from("rmas")
          .update(updatePayload)
          .eq("id", rma.id)
          .eq("company_id", companyId);

      if (updateError) {
        throw updateError;
      }

      const { error: activityError } =
        await supabase
          .from("rma_activity")
          .insert({
            company_id: companyId,
            rma_id: rma.id,
            action: "status_changed",
            message: `RMA status changed from ${statusLabels[currentStatus]} to ${statusLabels[nextStatus]}.`,
            created_by: user.id,
          });

      if (activityError) {
        console.error(
          "RMA activity error:",
          activityError,
        );
      }

      setCurrentStatus(nextStatus);

      router.refresh();
    } catch (error) {
      console.error(
        "RMA status update error:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update RMA status.",
      );
    } finally {
      setSavingStatus(false);
    }
  }

  async function createRepairFromRma() {
    if (repair) {
      router.push(
        `/repairs/${repair.id}`,
      );
      return;
    }

    if (!rma.customer_id) {
      setRepairError(
        "A customer is required before creating a repair.",
      );
      return;
    }

    if (!rma.product_id) {
      setRepairError(
        "A product is required before creating a repair.",
      );
      return;
    }

    if (
      !repairEligibleStatuses.includes(
        currentStatus,
      )
    ) {
      setRepairError(
        "The RMA must be received, inspecting, resolution pending, or already in repair before a repair can be created.",
      );
      return;
    }

    setCreatingRepair(true);
    setRepairError("");
    setErrorMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
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

      if (
        membershipError ||
        !membership?.company_id
      ) {
        throw new Error(
          "Your company membership could not be verified.",
        );
      }

      if (
        membership.company_id !==
        rma.company_id
      ) {
        throw new Error(
          "You cannot create a repair from this RMA.",
        );
      }

      const {
        data: repairId,
        error: rpcError,
      } = await supabase.rpc(
        "create_repair_from_rma",
        {
          p_rma_id: rma.id,
        },
      );

      if (rpcError) {
        throw rpcError;
      }

      if (!repairId) {
        throw new Error(
          "The repair could not be created.",
        );
      }

      router.push(
        `/repairs/${repairId}`,
      );
      router.refresh();
    } catch (error) {
      console.error(
        "Create repair from RMA error:",
        error,
      );

      setRepairError(
        error instanceof Error
          ? error.message
          : "Unable to create a repair from this RMA.",
      );
    } finally {
      setCreatingRepair(false);
    }
  }

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <button
            type="button"
            className="back-button"
            onClick={() => router.push("/rma")}
          >
            <ArrowLeft size={16} />
            Back to RMA
          </button>

          <div className="eyebrow">
            SERVICE / RMA
          </div>

          <div className="title-row">
            <div>
              <h1>{rma.rma_number}</h1>

              <p>
                Return authorization and resolution
                workspace.
              </p>
            </div>

            <div className="header-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  router.push(
                    `/rma/${rma.id}/edit`,
                  )
                }
              >
                <Edit3 size={16} />
                Edit RMA
              </button>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="error-banner">
          <AlertCircle size={18} />

          <div>
            <strong>
              Unable to update RMA
            </strong>

            <span>
              {errorMessage}
            </span>
          </div>
        </div>
      )}

      <section className="hero-card">
        <div className="hero-main">
          <div className="hero-icon">
            <RefreshCw size={25} />
          </div>

          <div className="hero-content">
            <div className="hero-topline">
              <span
                className="status-badge"
                style={{
                  background:
                    statusStyle.background,
                  color:
                    statusStyle.color,
                  borderColor:
                    statusStyle.border,
                }}
              >
                {getStatusIcon(
                  currentStatus,
                )}

                {
                  statusLabels[
                    currentStatus
                  ]
                }
              </span>

              <span
                className="status-badge"
                style={{
                  background:
                    priorityStyle.background,
                  color:
                    priorityStyle.color,
                  borderColor:
                    priorityStyle.border,
                }}
              >
                {
                  priorityLabels[
                    rma.priority
                  ]
                }
              </span>
            </div>

            <h2>
              {rma.reason}
            </h2>

            <p>
              {rma.customer_description ||
                "No customer description provided."}
            </p>
          </div>
        </div>

        <div className="hero-meta">
          <div>
            <span>Created</span>

            <strong>
              {formatDateTime(
                rma.created_at,
              )}
            </strong>
          </div>

          <div>
            <span>Last Updated</span>

            <strong>
              {formatDateTime(
                rma.updated_at,
              )}
            </strong>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        {stats.map((stat) => (
          <div
            className="stat-card"
            key={stat.label}
          >
            <div className="stat-icon">
              {stat.icon}
            </div>

            <div className="stat-content">
              <span>
                {stat.label}
              </span>

              <strong>
                {stat.value}
              </strong>
            </div>
          </div>
        ))}
      </section>

      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              RMA Workflow
            </h2>

            <p>
              Move this return through its
              operational lifecycle.
            </p>
          </div>

          <ClipboardCheck size={20} />
        </div>

        <div className="workflow">
          {workflow.map(
            (step, index) => {
              const isActive =
                step === currentStatus;

              const isComplete =
                workflowIndex >= 0 &&
                index < workflowIndex;

              return (
                <button
                  key={step}
                  type="button"
                  className={`workflow-step ${
                    isActive
                      ? "active"
                      : isComplete
                        ? "complete"
                        : ""
                  }`}
                  onClick={() =>
                    updateStatus(step)
                  }
                  disabled={
                    savingStatus ||
                    currentStatus ===
                      "cancelled" ||
                    currentStatus ===
                      "rejected"
                  }
                >
                  <span className="workflow-dot">
                    {isComplete ||
                    isActive ? (
                      <CheckCircle2
                        size={16}
                      />
                    ) : (
                      <span>
                        {index + 1}
                      </span>
                    )}
                  </span>

                  <span className="workflow-label">
                    {
                      statusLabels[
                        step
                      ]
                    }
                  </span>
                </button>
              );
            },
          )}
        </div>

        <div className="workflow-secondary">
          {[
            "rejected",
            "repair",
            "replacement",
            "refund",
            "store_credit",
            "cancelled",
          ].map((step) => (
            <button
              key={step}
              type="button"
              className="secondary-status-button"
              onClick={() =>
                updateStatus(
                  step as RmaStatus,
                )
              }
              disabled={savingStatus}
            >
              {
                statusLabels[
                  step as RmaStatus
                ]
              }
            </button>
          ))}
        </div>
      </section>

      <div className="detail-grid">
        <section className="content-card">
          <div className="card-header">
            <div>
              <h2>Customer</h2>

              <p>
                Customer associated with this
                return.
              </p>
            </div>

            <UserRound size={20} />
          </div>

          {customer ? (
            <div className="info-content">
              <div className="profile-row">
                <div className="profile-icon">
                  <UserRound size={20} />
                </div>

                <div>
                  <strong>
                    {customer.name}
                  </strong>

                  {customer.email && (
                    <span>
                      {customer.email}
                    </span>
                  )}

                  {customer.phone && (
                    <span>
                      {customer.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-inline">
              No customer linked.
            </div>
          )}
        </section>

        <section className="content-card">
          <div className="card-header">
            <div>
              <h2>Product</h2>

              <p>
                Customer product associated
                with this RMA.
              </p>
            </div>

            <Package size={20} />
          </div>

          <div className="info-content">
            <div className="info-list">
              <div>
                <span>
                  Product
                </span>

                <strong>
                  {product?.name ||
                    "No product linked"}
                </strong>
              </div>

              <div>
                <span>
                  Serial Number
                </span>

                <strong>
                  {rma.serial_number ||
                    "Not provided"}
                </strong>
              </div>

              <div>
                <span>Order</span>

                <strong>
                  {rma.order_id ||
                    "Not linked"}
                </strong>
              </div>

              <div>
                <span>Invoice</span>

                <strong>
                  {rma.invoice_id ||
                    "Not linked"}
                </strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="detail-grid">
        <section className="content-card">
          <div className="card-header">
            <div>
              <h2>
                Warranty & Claim
              </h2>

              <p>
                Service records connected to
                this return.
              </p>
            </div>

            <CheckCircle2 size={20} />
          </div>

          <div className="info-content">
            <div className="info-list">
              <div>
                <span>
                  Warranty
                </span>

                <strong>
                  {warranty
                    ? warranty.warranty_number
                    : "Not linked"}
                </strong>
              </div>

              {warranty && (
                <>
                  <div>
                    <span>
                      Coverage
                    </span>

                    <strong>
                      {formatText(
                        warranty.coverage_type,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Warranty Status
                    </span>

                    <strong>
                      {formatText(
                        warranty.status,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Warranty End
                    </span>

                    <strong>
                      {formatDate(
                        warranty.end_date,
                      )}
                    </strong>
                  </div>
                </>
              )}

              <div>
                <span>Claim</span>

                <strong>
                  {claim
                    ? claim.claim_number
                    : "Not linked"}
                </strong>
              </div>

              {claim && (
                <div>
                  <span>
                    Claim Status
                  </span>

                  <strong>
                    {formatText(
                      claim.status,
                    )}
                  </strong>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="content-card">
          <div className="card-header">
            <div>
              <h2>Repair</h2>

              <p>
                Repair work associated with
                this RMA.
              </p>
            </div>

            <Wrench size={20} />
          </div>

          {repair ? (
            <div className="info-content">
              <div className="info-list">
                <div>
                  <span>
                    Repair Number
                  </span>

                  <strong>
                    {repair.repair_number}
                  </strong>
                </div>

                <div>
                  <span>Status</span>

                  <strong>
                    {formatText(
                      repair.status,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Priority
                  </span>

                  <strong>
                    {formatText(
                      repair.priority,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Serial</span>

                  <strong>
                    {repair.serial_number ||
                      rma.serial_number ||
                      "—"}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                className="link-button"
                onClick={() =>
                  router.push(
                    `/repairs/${repair.id}`,
                  )
                }
              >
                <Wrench size={14} />
                Open Repair
              </button>
            </div>
          ) : (
            <div className="repair-empty">
              <div className="empty-inline">
                No repair linked to this RMA.
              </div>

              {repairError && (
                <div className="repair-error">
                  <AlertCircle
                    size={15}
                  />

                  <span>
                    {repairError}
                  </span>
                </div>
              )}

              <div className="repair-action-area">
                <button
                  type="button"
                  className="create-repair-button"
                  onClick={
                    createRepairFromRma
                  }
                  disabled={
                    creatingRepair ||
                    !canCreateRepair
                  }
                >
                  <Wrench size={15} />

                  {creatingRepair
                    ? "Creating Repair..."
                    : "Create Repair"}
                </button>

                {!rma.customer_id ||
                !rma.product_id ? (
                  <span className="action-hint">
                    Customer and product are
                    required before a repair can
                    be created.
                  </span>
                ) : !repairEligibleStatuses.includes(
                    currentStatus,
                  ) ? (
                  <span className="action-hint">
                    The RMA must reach Received,
                    Inspecting, Resolution Pending,
                    or Repair before a repair can
                    be created.
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Return Handling
            </h2>

            <p>
              Shipment, receiving, and assignment
              information.
            </p>
          </div>

          <Truck size={20} />
        </div>

        <div className="info-grid">
          <div>
            <span>
              Return Carrier
            </span>

            <strong>
              {rma.return_carrier ||
                "Not provided"}
            </strong>
          </div>

          <div>
            <span>
              Tracking Number
            </span>

            <strong>
              {rma.return_tracking_number ||
                "Not provided"}
            </strong>
          </div>

          <div>
            <span>
              Received Date
            </span>

            <strong>
              {formatDate(
                rma.received_date,
              )}
            </strong>
          </div>

          <div>
            <span>
              Inspection Date
            </span>

            <strong>
              {formatDate(
                rma.inspection_date,
              )}
            </strong>
          </div>

          <div>
            <span>
              Assigned Employee
            </span>

            <strong>
              {getEmployeeName(
                employee,
              )}
            </strong>
          </div>

          <div>
            <span>
              Condition Received
            </span>

            <strong>
              {rma.condition_received ||
                "Not recorded"}
            </strong>
          </div>
        </div>
      </section>

      <div className="detail-grid">
        <section className="content-card">
          <div className="card-header">
            <div>
              <h2>
                Customer Description
              </h2>

              <p>
                Issue reported by the customer.
              </p>
            </div>

            <FileText size={20} />
          </div>

          <div className="text-content">
            {rma.customer_description ||
              "No customer description provided."}
          </div>

          {rma.customer_notes && (
            <>
              <div className="subsection-title">
                Customer Notes
              </div>

              <div className="text-content">
                {rma.customer_notes}
              </div>
            </>
          )}
        </section>

        <section className="content-card">
          <div className="card-header">
            <div>
              <h2>
                Inspection & Resolution
              </h2>

              <p>
                Internal inspection and final
                outcome.
              </p>
            </div>

            <ClipboardCheck size={20} />
          </div>

          <div className="text-blocks">
            <div>
              <span>
                Inspection Result
              </span>

              <p>
                {rma.inspection_result ||
                  "No inspection result recorded."}
              </p>
            </div>

            <div>
              <span>
                Resolution Notes
              </span>

              <p>
                {rma.resolution_notes ||
                  "No resolution recorded."}
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Internal Notes
            </h2>

            <p>
              Notes for SBS staff.
            </p>
          </div>

          <FileText size={20} />
        </div>

        <div className="text-content">
          {rma.internal_notes ||
            "No internal notes."}
        </div>
      </section>

      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>Activity</h2>

            <p>
              History of actions and status
              changes.
            </p>
          </div>

          <Clock3 size={20} />
        </div>

        {activity.length === 0 ? (
          <div className="empty-inline">
            No activity recorded yet.
          </div>
        ) : (
          <div className="activity-list">
            {activity.map((item) => (
              <div
                className="activity-row"
                key={item.id}
              >
                <div className="activity-icon">
                  <CalendarDays size={16} />
                </div>

                <div className="activity-content">
                  <strong>
                    {formatText(
                      item.action,
                    )}
                  </strong>

                  <span>
                    {item.message}
                  </span>

                  <small>
                    {formatDateTime(
                      item.created_at,
                    )}
                  </small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="record-card">
        <div>
          <span>
            RMA Record
          </span>

          <strong>
            {rma.rma_number}
          </strong>
        </div>

        <div>
          <span>Created</span>

          <strong>
            {formatDateTime(
              rma.created_at,
            )}
          </strong>
        </div>

        <div>
          <span>Updated</span>

          <strong>
            {formatDateTime(
              rma.updated_at,
            )}
          </strong>
        </div>
      </section>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .page-header {
          margin-bottom: 20px;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 15px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #6b7280;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .back-button:hover {
          color: #111827;
        }

        .eyebrow {
          margin-bottom: 6px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 28px;
          line-height: 1.2;
        }

        .page-header p {
          margin: 7px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 38px;
          padding: 0 13px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .primary-button {
          border: 1px solid #111827;
          background: #111827;
          color: #ffffff;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .secondary-button:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .error-banner {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 18px;
          padding: 13px 15px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
        }

        .error-banner svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .error-banner div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .error-banner strong {
          font-size: 13px;
        }

        .error-banner span {
          font-size: 12px;
        }

        .hero-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
          margin-bottom: 18px;
          padding: 22px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 1px 2px
            rgba(15, 23, 42, 0.04);
        }

        .hero-main {
          display: flex;
          align-items: flex-start;
          gap: 15px;
          min-width: 0;
        }

        .hero-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          flex-shrink: 0;
          border: 1px solid #e5e7eb;
          border-radius: 13px;
          background: #f9fafb;
          color: #374151;
        }

        .hero-content {
          min-width: 0;
        }

        .hero-topline {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-bottom: 9px;
        }

        .hero-content h2 {
          margin: 0;
          color: #111827;
          font-size: 18px;
        }

        .hero-content p {
          max-width: 700px;
          margin: 7px 0 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.55;
        }

        .hero-meta {
          display: flex;
          flex-shrink: 0;
          gap: 28px;
        }

        .hero-meta div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .hero-meta span,
        .info-list span,
        .info-grid span,
        .text-blocks span,
        .record-card span {
          color: #9ca3af;
          font-size: 11px;
          font-weight: 600;
        }

        .hero-meta strong {
          color: #374151;
          font-size: 12px;
          white-space: nowrap;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 27px;
          padding: 0 9px;
          border: 1px solid;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .stats-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 88px;
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 1px 2px
            rgba(15, 23, 42, 0.04);
        }

        .stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
          color: #374151;
        }

        .stat-content {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 3px;
        }

        .stat-content span {
          color: #6b7280;
          font-size: 11px;
          font-weight: 600;
        }

        .stat-content strong {
          overflow: hidden;
          color: #111827;
          font-size: 15px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .content-card {
          margin-bottom: 18px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 1px 2px
            rgba(15, 23, 42, 0.04);
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 18px 20px;
          border-bottom: 1px solid #f0f1f3;
        }

        .card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 15px;
          font-weight: 700;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .card-header > svg {
          flex-shrink: 0;
          color: #9ca3af;
        }

        .workflow {
          display: flex;
          align-items: flex-start;
          padding: 20px;
          overflow-x: auto;
        }

        .workflow-step {
          position: relative;
          display: flex;
          min-width: 115px;
          flex: 1;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          border: 0;
          background: transparent;
          color: #9ca3af;
          font-family: inherit;
          cursor: pointer;
        }

        .workflow-step:not(:last-child)::after {
          position: absolute;
          top: 15px;
          left: calc(50% + 17px);
          width: calc(100% - 34px);
          height: 1px;
          background: #e5e7eb;
          content: "";
        }

        .workflow-dot {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: 1px solid #d1d5db;
          border-radius: 50%;
          background: #ffffff;
          font-size: 11px;
          font-weight: 700;
        }

        .workflow-step.active {
          color: #111827;
        }

        .workflow-step.active .workflow-dot {
          border-color: #111827;
          background: #111827;
          color: #ffffff;
        }

        .workflow-step.complete {
          color: #374151;
        }

        .workflow-step.complete .workflow-dot {
          border-color: #d1d5db;
          background: #f3f4f6;
          color: #374151;
        }

        .workflow-step.complete::after {
          background: #d1d5db;
        }

        .workflow-label {
          max-width: 110px;
          font-size: 10px;
          font-weight: 600;
          line-height: 1.3;
          text-align: center;
        }

        .workflow-secondary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 0 20px 18px;
        }

        .secondary-status-button {
          min-height: 32px;
          padding: 0 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          color: #4b5563;
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .secondary-status-button:hover {
          background: #f9fafb;
          color: #111827;
        }

        .detail-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .detail-grid .content-card {
          margin-bottom: 0;
        }

        .info-content {
          padding: 20px;
        }

        .profile-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .profile-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
          color: #6b7280;
        }

        .profile-row > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .profile-row strong {
          color: #111827;
          font-size: 13px;
        }

        .profile-row span {
          color: #6b7280;
          font-size: 12px;
        }

        .info-list {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .info-list > div {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 5px;
        }

        .info-list strong {
          overflow-wrap: anywhere;
          color: #374151;
          font-size: 12px;
          line-height: 1.4;
        }

        .info-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 18px;
          padding: 20px;
        }

        .info-grid > div {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 5px;
        }

        .info-grid strong {
          overflow-wrap: anywhere;
          color: #374151;
          font-size: 12px;
          line-height: 1.4;
        }

        .link-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 18px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #111827;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .link-button:hover {
          text-decoration: underline;
        }

        .repair-empty {
          padding-bottom: 20px;
        }

        .repair-action-area {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 7px;
          padding: 0 20px;
        }

        .create-repair-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 38px;
          padding: 0 13px;
          border: 1px solid #111827;
          border-radius: 9px;
          background: #111827;
          color: #ffffff;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .create-repair-button:hover:not(:disabled) {
          border-color: #1f2937;
          background: #1f2937;
        }

        .create-repair-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .action-hint {
          max-width: 450px;
          color: #9ca3af;
          font-size: 11px;
          line-height: 1.45;
        }

        .repair-error {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          margin: 0 20px 12px;
          padding: 9px 10px;
          border: 1px solid #fecaca;
          border-radius: 8px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 11px;
          line-height: 1.45;
        }

        .repair-error svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .empty-inline {
          padding: 20px;
          color: #9ca3af;
          font-size: 12px;
        }

        .text-content {
          padding: 20px;
          color: #4b5563;
          font-size: 13px;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .subsection-title {
          padding: 0 20px 8px;
          color: #374151;
          font-size: 12px;
          font-weight: 700;
        }

        .text-blocks {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 20px;
          padding: 20px;
        }

        .text-blocks > div {
          min-width: 0;
        }

        .text-blocks p {
          margin: 7px 0 0;
          color: #4b5563;
          font-size: 13px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .activity-list {
          padding: 4px 20px;
        }

        .activity-row {
          display: flex;
          gap: 12px;
          padding: 15px 0;
          border-bottom: 1px solid #f0f1f3;
        }

        .activity-row:last-child {
          border-bottom: 0;
        }

        .activity-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
          color: #6b7280;
        }

        .activity-content {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 4px;
        }

        .activity-content strong {
          color: #374151;
          font-size: 12px;
        }

        .activity-content span {
          color: #6b7280;
          font-size: 12px;
          line-height: 1.45;
        }

        .activity-content small {
          color: #9ca3af;
          font-size: 10px;
        }

        .record-card {
          display: flex;
          flex-wrap: wrap;
          gap: 30px;
          padding: 16px 20px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #fafafa;
        }

        .record-card div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .record-card strong {
          color: #374151;
          font-size: 12px;
        }

        @media (max-width: 1100px) {
          .hero-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .hero-meta {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 18px;
          }

          .title-row {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            width: 100%;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .info-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .text-blocks {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .hero-main {
            flex-direction: column;
          }

          .hero-meta {
            flex-direction: column;
            gap: 12px;
          }

          .info-list,
          .info-grid {
            grid-template-columns: 1fr;
          }

          .workflow {
            justify-content: flex-start;
            min-width: 900px;
          }

          .workflow-secondary {
            overflow-x: auto;
            flex-wrap: nowrap;
          }

          .repair-action-area {
            align-items: stretch;
          }

          .create-repair-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}