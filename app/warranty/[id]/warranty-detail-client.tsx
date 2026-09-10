"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Edit,
  FileText,
  Loader2,
  MessageSquare,
  Package,
  Plus,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

type Warranty = {
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

type Claim = {
  id: string;
  company_id: string;
  warranty_id: string;
  claim_number: string;
  status:
    | "open"
    | "under_review"
    | "approved"
    | "rejected"
    | "repair"
    | "replacement"
    | "resolved"
    | "cancelled";
  issue: string;
  resolution: string | null;
  claim_date: string;
  resolved_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Activity = {
  id: string;
  company_id: string;
  warranty_id: string;
  action: string;
  message: string;
  created_by: string | null;
  created_at: string;
};

type Props = {
  warranty: Warranty;
  customer: Customer | null;
  product: Product | null;
  claims: Claim[];
  activity: Activity[];
};

const claimStatusStyles: Record<string, string> = {
  open: "claim-open",
  under_review: "claim-review",
  approved: "claim-approved",
  rejected: "claim-rejected",
  repair: "claim-repair",
  replacement: "claim-replacement",
  resolved: "claim-resolved",
  cancelled: "claim-cancelled",
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCoverage(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getDaysRemaining(endDate: string) {
  const end = new Date(`${endDate}T23:59:59`);
  const now = new Date();

  return Math.ceil(
    (end.getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

export default function WarrantyDetailClient({
  warranty,
  customer,
  product,
  claims: initialClaims,
  activity: initialActivity,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [claims, setClaims] =
    useState<Claim[]>(initialClaims);

  const [activity, setActivity] =
    useState<Activity[]>(initialActivity);

  const [showClaimModal, setShowClaimModal] =
    useState(false);

  const [savingClaim, setSavingClaim] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [claimForm, setClaimForm] = useState({
    issue: "",
    notes: "",
  });

  const daysRemaining = useMemo(
    () => getDaysRemaining(warranty.end_date),
    [warranty.end_date],
  );

  const activeClaimCount = claims.filter(
    (claim) =>
      claim.status === "open" ||
      claim.status === "under_review" ||
      claim.status === "approved" ||
      claim.status === "repair" ||
      claim.status === "replacement",
  ).length;

  const resolvedClaimCount = claims.filter(
    (claim) => claim.status === "resolved",
  ).length;

  function closeClaimModal() {
    if (savingClaim) {
      return;
    }

    setShowClaimModal(false);
    setErrorMessage("");

    setClaimForm({
      issue: "",
      notes: "",
    });
  }

  async function createClaim(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!claimForm.issue.trim()) {
      setErrorMessage(
        "Please describe the warranty issue.",
      );
      return;
    }

    setSavingClaim(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Your session has expired.",
        );
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
          "No company membership was found.",
        );
      }

      if (
        membership.company_id !==
        warranty.company_id
      ) {
        throw new Error(
          "You do not have access to this warranty.",
        );
      }

      const {
        data: hasManagePermission,
        error: permissionError,
      } = await supabase.rpc(
        "employee_has_permission",
        {
          p_company_id:
            warranty.company_id,
          p_module: "warranty",
          p_action: "manage",
        },
      );

      const {
        data: isAdmin,
        error: adminError,
      } = await supabase.rpc(
        "is_company_admin",
        {
          p_company_id:
            warranty.company_id,
        },
      );

      if (permissionError) {
        throw new Error(
          permissionError.message,
        );
      }

      if (adminError) {
        throw new Error(
          adminError.message,
        );
      }

      if (
        !hasManagePermission &&
        !isAdmin
      ) {
        throw new Error(
          "You do not have permission to create warranty claims.",
        );
      }

      const {
        data: latestClaim,
        error: latestError,
      } = await supabase
        .from("warranty_claims")
        .select("claim_number")
        .eq(
          "company_id",
          warranty.company_id,
        )
        .like(
          "claim_number",
          "CLM-%",
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (latestError) {
        throw new Error(
          latestError.message,
        );
      }

      let nextNumber = 1;

      if (latestClaim?.claim_number) {
        const match =
          latestClaim.claim_number.match(
            /^CLM-(\d+)$/,
          );

        if (match) {
          nextNumber =
            Number(match[1]) + 1;
        }
      }

      const claimNumber =
        `CLM-${String(nextNumber).padStart(
          5,
          "0",
        )}`;

      const {
        data: claim,
        error: claimError,
      } = await supabase
        .from("warranty_claims")
        .insert({
          company_id:
            warranty.company_id,
          warranty_id: warranty.id,
          claim_number: claimNumber,
          status: "open",
          issue:
            claimForm.issue.trim(),
          notes:
            claimForm.notes.trim() ||
            null,
          claim_date: new Date()
            .toISOString()
            .slice(0, 10),
          created_by: user.id,
        })
        .select(
          `
            id,
            company_id,
            warranty_id,
            claim_number,
            status,
            issue,
            resolution,
            claim_date,
            resolved_date,
            notes,
            created_by,
            created_at,
            updated_at
          `,
        )
        .single();

      if (claimError) {
        throw new Error(
          claimError.message,
        );
      }

      if (!claim) {
        throw new Error(
          "Claim was created but could not be loaded.",
        );
      }

      const {
        data: activityRecord,
      } = await supabase
        .from("warranty_activity")
        .insert({
          company_id:
            warranty.company_id,
          warranty_id: warranty.id,
          action: "claim_created",
          message: `Warranty claim ${claimNumber} was created.`,
          created_by: user.id,
        })
        .select(
          `
            id,
            company_id,
            warranty_id,
            action,
            message,
            created_by,
            created_at
          `,
        )
        .single();

      setClaims((current) => [
        claim as Claim,
        ...current,
      ]);

      if (activityRecord) {
        setActivity((current) => [
          activityRecord as Activity,
          ...current,
        ]);
      }

      closeClaimModal();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create warranty claim.",
      );
    } finally {
      setSavingClaim(false);
    }
  }

  return (
    <main className="page-content">
      <div className="top-actions">
        <button
          type="button"
          className="back-button"
          onClick={() =>
            router.push("/warranty")
          }
        >
          <ArrowLeft size={16} />
          Back to Warranty
        </button>

        <div className="action-buttons">
          <Link
            href={`/warranty/${warranty.id}/edit`}
            className="secondary-button"
          >
            <Edit size={16} />
            Edit Warranty
          </Link>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setErrorMessage("");
              setShowClaimModal(true);
            }}
          >
            <Plus size={17} />
            New Claim
          </button>
        </div>
      </div>

      <section className="hero-card">
        <div className="hero-main">
          <div className="hero-icon">
            <ShieldCheck size={27} />
          </div>

          <div>
            <div className="eyebrow">
              Warranty
            </div>

            <h1>
              {warranty.warranty_number}
            </h1>

            <div className="hero-meta">
              <span>
                {formatCoverage(
                  warranty.coverage_type,
                )}
              </span>

              <span className="meta-separator">
                •
              </span>

              <span>
                {formatDate(
                  warranty.start_date,
                )}{" "}
                —{" "}
                {formatDate(
                  warranty.end_date,
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="hero-status">
          <span
            className={`status-badge status-${warranty.status}`}
          >
            {formatStatus(
              warranty.status,
            )}
          </span>

          {warranty.status !==
            "expired" &&
            warranty.status !==
              "void" &&
            warranty.status !==
              "claimed" && (
              <span className="days-remaining">
                {daysRemaining > 0
                  ? `${daysRemaining} days remaining`
                  : "Warranty expires today"}
              </span>
            )}
        </div>
      </section>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <ShieldCheck size={19} />
          </div>

          <div>
            <div className="stat-value">
              {formatStatus(
                warranty.status,
              )}
            </div>

            <div className="stat-label">
              Current Status
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Clock3 size={19} />
          </div>

          <div>
            <div className="stat-value">
              {daysRemaining > 0
                ? daysRemaining
                : 0}
            </div>

            <div className="stat-label">
              Days Remaining
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <AlertCircle size={19} />
          </div>

          <div>
            <div className="stat-value">
              {activeClaimCount}
            </div>

            <div className="stat-label">
              Open Claims
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <CheckCircle2 size={19} />
          </div>

          <div>
            <div className="stat-value">
              {resolvedClaimCount}
            </div>

            <div className="stat-label">
              Resolved Claims
            </div>
          </div>
        </div>
      </div>

      <div className="content-grid">
        <div className="main-column">
          <section className="content-card">
            <div className="section-header">
              <div>
                <h2>
                  Warranty Information
                </h2>

                <p>
                  Details and coverage
                  information.
                </p>
              </div>
            </div>

            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">
                  Warranty Number
                </span>

                <span className="detail-value">
                  {
                    warranty.warranty_number
                  }
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Coverage Type
                </span>

                <span className="detail-value">
                  {formatCoverage(
                    warranty.coverage_type,
                  )}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Purchase Date
                </span>

                <span className="detail-value">
                  {formatDate(
                    warranty.purchase_date,
                  )}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Start Date
                </span>

                <span className="detail-value">
                  {formatDate(
                    warranty.start_date,
                  )}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  End Date
                </span>

                <span className="detail-value">
                  {formatDate(
                    warranty.end_date,
                  )}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Serial Number
                </span>

                <span className="detail-value mono">
                  {warranty.serial_number ||
                    "—"}
                </span>
              </div>
            </div>
          </section>

          <section className="content-card">
            <div className="section-header">
              <div>
                <h2>
                  Customer & Product
                </h2>

                <p>
                  The customer and covered
                  product.
                </p>
              </div>
            </div>

            <div className="association-grid">
              <div className="association-card">
                <div className="association-icon">
                  <UserRound size={19} />
                </div>

                <div className="association-content">
                  <span className="association-label">
                    Customer
                  </span>

                  {customer ? (
                    <>
                      <span className="association-name">
                        {customer.name}
                      </span>

                      {customer.email && (
                        <span className="association-meta">
                          {customer.email}
                        </span>
                      )}

                      {customer.phone && (
                        <span className="association-meta">
                          {customer.phone}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="association-name muted">
                      No customer assigned
                    </span>
                  )}
                </div>
              </div>

              <div className="association-card">
                <div className="association-icon">
                  <Package size={19} />
                </div>

                <div className="association-content">
                  <span className="association-label">
                    Product
                  </span>

                  {product ? (
                    <span className="association-name">
                      {product.name}
                    </span>
                  ) : (
                    <span className="association-name muted">
                      No product assigned
                    </span>
                  )}

                  {warranty.serial_number && (
                    <span className="association-meta">
                      Serial:{" "}
                      {
                        warranty.serial_number
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="content-card">
            <div className="section-header section-header-with-action">
              <div>
                <h2>
                  Warranty Claims
                </h2>

                <p>
                  Track issues and claim
                  resolution.
                </p>
              </div>

              <button
                type="button"
                className="small-primary-button"
                onClick={() => {
                  setErrorMessage("");
                  setShowClaimModal(true);
                }}
              >
                <Plus size={15} />
                New Claim
              </button>
            </div>

            {claims.length === 0 ? (
              <div className="empty-section">
                <div className="empty-section-icon">
                  <FileText size={22} />
                </div>

                <h3>
                  No claims yet
                </h3>

                <p>
                  Create a warranty claim
                  when the customer reports
                  an issue.
                </p>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setErrorMessage("");
                    setShowClaimModal(true);
                  }}
                >
                  <Plus size={16} />
                  Create First Claim
                </button>
              </div>
            ) : (
              <div className="claims-list">
                {claims.map((claim) => (
                  <div
                    className="claim-row"
                    key={claim.id}
                  >
                    <div className="claim-icon">
                      <FileText size={18} />
                    </div>

                    <div className="claim-content">
                      <div className="claim-top">
                        <span className="claim-number">
                          {
                            claim.claim_number
                          }
                        </span>

                        <span
                          className={`claim-status ${
                            claimStatusStyles[
                              claim.status
                            ] ?? ""
                          }`}
                        >
                          {formatStatus(
                            claim.status,
                          )}
                        </span>
                      </div>

                      <p className="claim-issue">
                        {claim.issue}
                      </p>

                      <div className="claim-meta">
                        <span>
                          Filed{" "}
                          {formatDate(
                            claim.claim_date,
                          )}
                        </span>

                        {claim.resolved_date && (
                          <>
                            <span>
                              •
                            </span>

                            <span>
                              Resolved{" "}
                              {formatDate(
                                claim.resolved_date,
                              )}
                            </span>
                          </>
                        )}
                      </div>

                      {claim.resolution && (
                        <div className="resolution-box">
                          <strong>
                            Resolution
                          </strong>

                          <span>
                            {
                              claim.resolution
                            }
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="claim-actions">
                      <button
                        type="button"
                        className="view-claim-button"
                        onClick={() =>
                          router.push(
                            `/warranty/claims/${claim.id}`,
                          )
                        }
                      >
                        View Claim
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {(warranty.terms ||
            warranty.notes) && (
            <section className="content-card">
              <div className="section-header">
                <div>
                  <h2>
                    Terms & Notes
                  </h2>

                  <p>
                    Additional warranty
                    information.
                  </p>
                </div>
              </div>

              <div className="text-sections">
                {warranty.terms && (
                  <div className="text-section">
                    <span className="detail-label">
                      Warranty Terms
                    </span>

                    <p>
                      {warranty.terms}
                    </p>
                  </div>
                )}

                {warranty.notes && (
                  <div className="text-section">
                    <span className="detail-label">
                      Internal Notes
                    </span>

                    <p>
                      {warranty.notes}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="side-column">
          <section className="content-card">
            <div className="section-header">
              <div>
                <h2>Activity</h2>

                <p>
                  Warranty history.
                </p>
              </div>
            </div>

            {activity.length === 0 ? (
              <div className="activity-empty">
                <MessageSquare size={20} />
                <span>
                  No activity recorded yet.
                </span>
              </div>
            ) : (
              <div className="activity-list">
                {activity.map(
                  (item) => (
                    <div
                      className="activity-item"
                      key={item.id}
                    >
                      <div className="activity-dot" />

                      <div className="activity-content">
                        <span className="activity-action">
                          {formatStatus(
                            item.action,
                          )}
                        </span>

                        <p>
                          {item.message}
                        </p>

                        <span className="activity-date">
                          {formatDateTime(
                            item.created_at,
                          )}
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </section>

          <section className="content-card record-card">
            <div className="section-header">
              <div>
                <h2>Record</h2>

                <p>
                  Warranty record
                  information.
                </p>
              </div>
            </div>

            <div className="record-list">
              <div>
                <span>Created</span>

                <strong>
                  {formatDateTime(
                    warranty.created_at,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Last Updated
                </span>

                <strong>
                  {formatDateTime(
                    warranty.updated_at,
                  )}
                </strong>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {showClaimModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeClaimModal();
            }
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-modal-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="claim-modal-title">
                  New Warranty Claim
                </h2>

                <p>
                  Create a claim for{" "}
                  {
                    warranty.warranty_number
                  }
                  .
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeClaimModal
                }
                disabled={savingClaim}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div className="modal-error">
                <AlertCircle size={17} />

                <span>
                  {errorMessage}
                </span>
              </div>
            )}

            <form
              onSubmit={createClaim}
            >
              <div className="modal-body">
                <div className="field">
                  <label htmlFor="claim_issue">
                    Issue{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <textarea
                    id="claim_issue"
                    value={
                      claimForm.issue
                    }
                    onChange={(event) =>
                      setClaimForm(
                        (current) => ({
                          ...current,
                          issue:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Describe the customer's issue..."
                    rows={6}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="claim_notes">
                    Notes
                  </label>

                  <textarea
                    id="claim_notes"
                    value={
                      claimForm.notes
                    }
                    onChange={(event) =>
                      setClaimForm(
                        (current) => ({
                          ...current,
                          notes:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Add any internal notes..."
                    rows={4}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={
                    closeClaimModal
                  }
                  disabled={savingClaim}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-button"
                  disabled={savingClaim}
                >
                  {savingClaim ? (
                    <>
                      <Loader2
                        size={16}
                        className="spinner"
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Claim
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .top-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .action-buttons {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .back-button,
        .secondary-button,
        .primary-button,
        .small-primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;
        }

        .back-button {
          min-height: 38px;
          padding: 0 13px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .back-button:hover {
          border-color: #9ca3af;
          background: #f9fafb;
          color: #111827;
        }

        .secondary-button {
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .secondary-button:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .primary-button {
          min-height: 40px;
          padding: 0 15px;
          border: 1px solid #111827;
          background: #111827;
          color: #ffffff;
        }

        .primary-button:hover {
          border-color: #1f2937;
          background: #1f2937;
        }

        .small-primary-button {
          min-height: 34px;
          padding: 0 11px;
          border: 1px solid #111827;
          background: #111827;
          color: #ffffff;
          font-size: 12px;
        }

        .small-primary-button:hover {
          background: #1f2937;
        }

        .hero-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 18px;
          padding: 24px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .hero-main {
          display: flex;
          align-items: center;
          gap: 15px;
          min-width: 0;
        }

        .hero-icon {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 54px;
          height: 54px;
          border-radius: 14px;
          background: #f3f4f6;
          color: #374151;
        }

        .eyebrow {
          margin-bottom: 4px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .hero-card h1 {
          margin: 0;
          color: #111827;
          font-size: 25px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .hero-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          margin-top: 6px;
          color: #6b7280;
          font-size: 13px;
        }

        .meta-separator {
          color: #d1d5db;
        }

        .hero-status {
          display: flex;
          flex-shrink: 0;
          flex-direction: column;
          align-items: flex-end;
          gap: 7px;
        }

        .status-badge,
        .claim-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-badge {
          min-height: 28px;
          padding: 0 10px;
        }

        .status-active {
          background: #ecfdf5;
          color: #047857;
        }

        .status-expiring {
          background: #fffbeb;
          color: #b45309;
        }

        .status-expired {
          background: #fef2f2;
          color: #b91c1c;
        }

        .status-claimed {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-void {
          background: #f3f4f6;
          color: #6b7280;
        }

        .days-remaining {
          color: #6b7280;
          font-size: 12px;
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
          min-height: 82px;
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .stat-icon {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #f3f4f6;
          color: #374151;
        }

        .stat-value {
          color: #111827;
          font-size: 18px;
          font-weight: 700;
        }

        .stat-label {
          margin-top: 3px;
          color: #6b7280;
          font-size: 12px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
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
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .section-header {
          padding: 18px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .section-header-with-action {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .section-header h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .section-header p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 17px 20px;
          border-bottom: 1px solid #f1f5f9;
        }

        .detail-label {
          color: #9ca3af;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .detail-value {
          color: #374151;
          font-size: 13px;
          font-weight: 600;
        }

        .mono {
          font-family:
            ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
        }

        .association-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          padding: 18px 20px 20px;
        }

        .association-card {
          display: flex;
          gap: 12px;
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 11px;
          background: #fafafa;
        }

        .association-icon {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: #ffffff;
          color: #4b5563;
        }

        .association-content {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 3px;
        }

        .association-label {
          color: #9ca3af;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .association-name {
          overflow: hidden;
          color: #374151;
          font-size: 13px;
          font-weight: 700;
          text-overflow: ellipsis;
        }

        .association-name.muted {
          color: #9ca3af;
          font-weight: 500;
        }

        .association-meta {
          overflow: hidden;
          color: #6b7280;
          font-size: 11px;
          text-overflow: ellipsis;
        }

        .claims-list {
          display: flex;
          flex-direction: column;
        }

        .claim-row {
          display: flex;
          gap: 13px;
          padding: 17px 20px;
          border-bottom: 1px solid #f1f5f9;
        }

        .claim-row:last-child {
          border-bottom: 0;
        }

        .claim-icon {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #f3f4f6;
          color: #4b5563;
        }

        .claim-content {
          min-width: 0;
          flex: 1;
        }

        .claim-top {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .claim-number {
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }

        .claim-status {
          min-height: 23px;
          padding: 0 8px;
        }

        .claim-open {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .claim-review {
          background: #fffbeb;
          color: #b45309;
        }

        .claim-approved {
          background: #ecfdf5;
          color: #047857;
        }

        .claim-rejected {
          background: #fef2f2;
          color: #b91c1c;
        }

        .claim-repair {
          background: #f5f3ff;
          color: #6d28d9;
        }

        .claim-replacement {
          background: #f0fdfa;
          color: #0f766e;
        }

        .claim-resolved {
          background: #ecfdf5;
          color: #047857;
        }

        .claim-cancelled {
          background: #f3f4f6;
          color: #6b7280;
        }

        .claim-issue {
          margin: 8px 0 7px;
          color: #374151;
          font-size: 13px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .claim-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          color: #9ca3af;
          font-size: 11px;
        }

        .claim-actions {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          align-self: center;
          margin-left: 12px;
        }

        .view-claim-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0 11px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          color: #374151;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;
        }

        .view-claim-button:hover {
          border-color: #9ca3af;
          background: #f9fafb;
          color: #111827;
        }

        .resolution-box {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-top: 11px;
          padding: 10px 11px;
          border-radius: 8px;
          background: #f9fafb;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.5;
        }

        .resolution-box strong {
          color: #374151;
          font-size: 11px;
        }

        .empty-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 42px 20px;
          text-align: center;
        }

        .empty-section-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          margin-bottom: 12px;
          border-radius: 13px;
          background: #f3f4f6;
          color: #6b7280;
        }

        .empty-section h3 {
          margin: 0;
          color: #111827;
          font-size: 15px;
          font-weight: 700;
        }

        .empty-section p {
          max-width: 390px;
          margin: 6px 0 16px;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.5;
        }

        .text-sections {
          padding: 18px 20px 20px;
        }

        .text-section + .text-section {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #f1f5f9;
        }

        .text-section p {
          margin: 7px 0 0;
          color: #4b5563;
          font-size: 13px;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .activity-list {
          padding: 18px 20px 20px;
        }

        .activity-item {
          position: relative;
          display: flex;
          gap: 11px;
        }

        .activity-item + .activity-item {
          margin-top: 18px;
        }

        .activity-item:not(:last-child)::before {
          position: absolute;
          top: 10px;
          bottom: -20px;
          left: 4px;
          width: 1px;
          background: #e5e7eb;
          content: "";
        }

        .activity-dot {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          width: 9px;
          height: 9px;
          margin-top: 4px;
          border: 2px solid #ffffff;
          border-radius: 50%;
          background: #9ca3af;
          box-shadow: 0 0 0 1px #d1d5db;
        }

        .activity-content {
          min-width: 0;
        }

        .activity-action {
          color: #374151;
          font-size: 12px;
          font-weight: 700;
        }

        .activity-content p {
          margin: 3px 0;
          color: #6b7280;
          font-size: 11px;
          line-height: 1.45;
        }

        .activity-date {
          color: #9ca3af;
          font-size: 10px;
        }

        .activity-empty {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 28px 20px;
          color: #9ca3af;
          font-size: 12px;
        }

        .record-list {
          padding: 16px 20px;
        }

        .record-list > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 11px 0;
        }

        .record-list > div + div {
          border-top: 1px solid #f1f5f9;
        }

        .record-list span {
          color: #9ca3af;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .record-list strong {
          color: #4b5563;
          font-size: 11px;
          font-weight: 600;
        }

        .modal-backdrop {
          position: fixed;
          z-index: 1000;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.48);
        }

        .modal {
          width: 100%;
          max-width: 560px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          color: #111827;
          font-size: 18px;
          font-weight: 700;
        }

        .modal-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          padding: 0;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #ffffff;
          color: #6b7280;
          cursor: pointer;
        }

        .modal-close:hover:not(:disabled) {
          background: #f9fafb;
          color: #111827;
        }

        .modal-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 16px 20px 0;
          padding: 11px 12px;
          border: 1px solid #fecaca;
          border-radius: 9px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 12px;
          line-height: 1.45;
        }

        .modal-body {
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding: 20px;
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

        .field textarea {
          display: block;
          width: 100%;
          box-sizing: border-box;
          padding: 11px 12px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          outline: none;
          background: #ffffff;
          color: #111827;
          font-family: inherit;
          font-size: 13px;
          line-height: 1.5;
          resize: vertical;
        }

        .field textarea::placeholder {
          color: #9ca3af;
        }

        .field textarea:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.06);
        }

        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
          padding: 15px 20px;
          border-top: 1px solid #e5e7eb;
          background: #fafafa;
        }

        .cancel-button,
        .save-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 13px;
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
          opacity: 0.55;
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

        @media (max-width: 1100px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: start;
          }

          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .page-content {
            padding: 20px;
          }

          .top-actions,
          .hero-card {
            align-items: stretch;
            flex-direction: column;
          }

          .action-buttons {
            width: 100%;
          }

          .action-buttons > * {
            flex: 1;
          }

          .hero-main {
            align-items: flex-start;
          }

          .hero-status {
            align-items: flex-start;
          }

          .details-grid,
          .association-grid,
          .side-column {
            grid-template-columns: 1fr;
          }

          .claim-row {
            flex-wrap: wrap;
          }

          .claim-actions {
            width: 100%;
            margin-left: 51px;
          }

          .view-claim-button {
            width: auto;
          }
        }

        @media (max-width: 560px) {
          .page-content {
            padding: 16px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .action-buttons {
            flex-direction: column;
          }

          .action-buttons > * {
            width: 100%;
          }

          .hero-card {
            padding: 18px;
          }

          .hero-card h1 {
            font-size: 21px;
          }

          .section-header-with-action {
            align-items: flex-start;
            flex-direction: column;
          }

          .modal-backdrop {
            align-items: flex-end;
            padding: 0;
          }

          .modal {
            max-width: none;
            border-radius: 14px 14px 0 0;
          }
        }
      `}</style>
    </main>
  );
}