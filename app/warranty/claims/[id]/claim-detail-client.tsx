"use client";

import {
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MessageSquare,
  Package,
  Pencil,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Claim = {
  id: string;
  company_id: string;
  warranty_id: string;
  claim_number: string;
  status: string;
  issue: string;
  resolution: string | null;
  claim_date: string;
  resolved_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Warranty = {
  id: string;
  warranty_number: string;
  customer_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  serial_number: string | null;
  status: string;
  coverage_type: string;
  purchase_date: string | null;
  start_date: string;
  end_date: string;
};

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type Product = {
  id: string;
  name: string | null;
};

type Activity = {
  id: string;
  warranty_id: string;
  action: string;
  message: string;
  created_by: string | null;
  created_at: string;
};

type Props = {
  claim: Claim;
  warranty: Warranty;
  customer: Customer | null;
  product: Product | null;
  activities: Activity[];
};

const statusOptions = [
  {
    value: "open",
    label: "Open",
  },
  {
    value: "under_review",
    label: "Under Review",
  },
  {
    value: "approved",
    label: "Approved",
  },
  {
    value: "rejected",
    label: "Rejected",
  },
  {
    value: "repair",
    label: "Repair",
  },
  {
    value: "replacement",
    label: "Replacement",
  },
  {
    value: "resolved",
    label: "Resolved",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

function formatStatus(status: string) {
  return status
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

function formatCoverage(coverage: string) {
  return coverage
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClasses(status: string) {
  switch (status) {
    case "open":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "under_review":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "approved":
      return "bg-green-50 text-green-700 border-green-200";

    case "rejected":
      return "bg-red-50 text-red-700 border-red-200";

    case "repair":
      return "bg-purple-50 text-purple-700 border-purple-200";

    case "replacement":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";

    case "resolved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "cancelled":
      return "bg-gray-100 text-gray-600 border-gray-200";

    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default function ClaimDetailClient({
  claim,
  warranty,
  customer,
  product,
  activities,
}: Props) {
  const router = useRouter();
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);

  const [currentStatus, setCurrentStatus] =
    useState(claim.status);

  const [updatingStatus, setUpdatingStatus] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  async function updateStatus(
    nextStatus: string,
  ) {
    if (
      updatingStatus ||
      nextStatus === currentStatus
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setUpdatingStatus(true);

    try {
      const {
        data: {
          user,
        },
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

      if (membershipError) {
        throw new Error(
          membershipError.message,
        );
      }

      if (!membership?.company_id) {
        throw new Error(
          "Your account is not connected to a company.",
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
        throw new Error(
          adminError.message,
        );
      }

      let canManage = Boolean(isAdmin);

      if (!canManage) {
        const {
          data: hasPermission,
          error: permissionError,
        } = await supabase.rpc(
          "employee_has_permission",
          {
            p_company_id: companyId,
            p_module: "warranty",
            p_action: "manage",
          },
        );

        if (permissionError) {
          throw new Error(
            permissionError.message,
          );
        }

        canManage = Boolean(
          hasPermission,
        );
      }

      if (!canManage) {
        throw new Error(
          "You do not have permission to manage warranty claims.",
        );
      }

      const updatePayload: {
        status: string;
        resolved_date?: string | null;
      } = {
        status: nextStatus,
      };

      if (nextStatus === "resolved") {
        updatePayload.resolved_date =
          new Date()
            .toISOString()
            .slice(0, 10);
      } else if (
        currentStatus === "resolved"
      ) {
        updatePayload.resolved_date =
          null;
      }

      const {
        error: updateError,
      } = await supabase
        .from("warranty_claims")
        .update(updatePayload)
        .eq("id", claim.id)
        .eq("company_id", companyId);

      if (updateError) {
        throw new Error(
          updateError.message,
        );
      }

      const statusLabel =
        formatStatus(nextStatus);

      await supabase
        .from("warranty_activity")
        .insert({
          company_id: companyId,
          warranty_id: warranty.id,
          action: "claim_status_updated",
          message: `Warranty claim ${claim.claim_number} moved to ${statusLabel}.`,
          created_by: user.id,
        });

      setCurrentStatus(nextStatus);
      setSuccessMessage(
        `Claim status changed to ${statusLabel}.`,
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update claim status.",
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  const statusLabel =
    formatStatus(currentStatus);

  const isResolved =
    currentStatus === "resolved";

  const isCancelled =
    currentStatus === "cancelled";

  return (
    <main className="page-content">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/warranty/${warranty.id}`,
              )
            }
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to Warranty
          </button>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white">
                <ShieldCheck size={23} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                    {claim.claim_number}
                  </h1>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                      currentStatus,
                    )}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  Warranty claim for{" "}
                  <span className="font-medium text-gray-700">
                    {warranty.warranty_number}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/warranty/claims/${params.id}/edit`,
                  )
                }
                disabled={updatingStatus}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Pencil size={16} />
                Edit Claim
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/warranty/${warranty.id}`,
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                <ShieldCheck size={16} />
                View Warranty
              </button>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
              <Clock3 size={18} />
            </div>

            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Claim Status
            </p>

            <p className="mt-1 text-lg font-semibold text-gray-900">
              {statusLabel}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
              <CalendarDays size={18} />
            </div>

            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Claim Date
            </p>

            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatDate(
                claim.claim_date,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
              <CheckCircle2 size={18} />
            </div>

            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Resolved Date
            </p>

            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatDate(
                claim.resolved_date,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
              <Package size={18} />
            </div>

            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Coverage
            </p>

            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatCoverage(
                warranty.coverage_type,
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-5">
                <div className="flex items-center gap-2">
                  <MessageSquare
                    size={18}
                    className="text-gray-700"
                  />

                  <h2 className="text-base font-semibold text-gray-900">
                    Claim Issue
                  </h2>
                </div>
              </div>

              <div className="p-6">
                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {claim.issue ||
                    "No issue description provided."}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-5">
                <h2 className="text-base font-semibold text-gray-900">
                  Resolution
                </h2>
              </div>

              <div className="p-6">
                {claim.resolution ? (
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {claim.resolution}
                  </p>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
                    <p className="text-sm text-gray-500">
                      No resolution has been recorded yet.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {claim.notes && (
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-5">
                  <h2 className="text-base font-semibold text-gray-900">
                    Notes
                  </h2>
                </div>

                <div className="p-6">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {claim.notes}
                  </p>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-5">
                <h2 className="text-base font-semibold text-gray-900">
                  Warranty Activity
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  History of activity connected to
                  this warranty.
                </p>
              </div>

              <div className="p-6">
                {activities.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
                    <FileText
                      size={22}
                      className="mx-auto mb-2 text-gray-400"
                    />

                    <p className="text-sm text-gray-500">
                      No activity has been recorded.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {activities.map(
                      (activity) => (
                        <div
                          key={activity.id}
                          className="relative flex gap-3"
                        >
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                            <FileText size={15} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-medium text-gray-900">
                                {activity.action
                                  .split("_")
                                  .map(
                                    (word) =>
                                      word
                                        .charAt(
                                          0,
                                        )
                                        .toUpperCase() +
                                      word.slice(
                                        1,
                                      ),
                                  )
                                  .join(" ")}
                              </p>

                              <p className="text-xs text-gray-400">
                                {formatDateTime(
                                  activity.created_at,
                                )}
                              </p>
                            </div>

                            <p className="mt-1 text-sm leading-5 text-gray-600">
                              {activity.message}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <div className="flex items-center gap-2">
                  <User
                    size={17}
                    className="text-gray-700"
                  />

                  <h2 className="text-sm font-semibold text-gray-900">
                    Customer
                  </h2>
                </div>
              </div>

              <div className="p-5">
                {customer ? (
                  <>
                    <p className="font-semibold text-gray-900">
                      {customer.name ||
                        "Unnamed Customer"}
                    </p>

                    {customer.email && (
                      <p className="mt-2 text-sm text-gray-600">
                        {customer.email}
                      </p>
                    )}

                    {customer.phone && (
                      <p className="mt-1 text-sm text-gray-600">
                        {customer.phone}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/customers/${customer.id}`,
                        )
                      }
                      className="mt-4 text-sm font-medium text-gray-900 hover:underline"
                    >
                      View Customer
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    No customer linked.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Package
                    size={17}
                    className="text-gray-700"
                  />

                  <h2 className="text-sm font-semibold text-gray-900">
                    Covered Product
                  </h2>
                </div>
              </div>

              <div className="p-5">
                <p className="font-semibold text-gray-900">
                  {product?.name ||
                    "No product linked"}
                </p>

                {warranty.serial_number && (
                  <div className="mt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Serial Number
                    </p>

                    <p className="mt-1 break-all text-sm text-gray-700">
                      {warranty.serial_number}
                    </p>
                  </div>
                )}

                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Warranty
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/warranty/${warranty.id}`,
                      )
                    }
                    className="mt-1 text-sm font-medium text-gray-900 hover:underline"
                  >
                    {warranty.warranty_number}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  Warranty Period
                </h2>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Purchase Date
                  </p>

                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {formatDate(
                      warranty.purchase_date,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Coverage Starts
                  </p>

                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {formatDate(
                      warranty.start_date,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Coverage Ends
                  </p>

                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {formatDate(
                      warranty.end_date,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Warranty Status
                  </p>

                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {formatStatus(
                      warranty.status,
                    )}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  Claim Actions
                </h2>
              </div>

              <div className="space-y-2 p-5">
                {statusOptions.map(
                  (option) => {
                    const selected =
                      option.value ===
                      currentStatus;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          updateStatus(
                            option.value,
                          )
                        }
                        disabled={
                          selected ||
                          updatingStatus
                        }
                        className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-medium transition ${
                          selected
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        } disabled:cursor-not-allowed disabled:opacity-70`}
                      >
                        <span>
                          {option.label}
                        </span>

                        {selected && (
                          <CheckCircle2
                            size={16}
                          />
                        )}
                      </button>
                    );
                  },
                )}

                {updatingStatus && (
                  <div className="flex items-center justify-center gap-2 pt-2 text-xs text-gray-500">
                    <Loader2
                      size={14}
                      className="animate-spin"
                    />
                    Updating claim...
                  </div>
                )}

                {(isResolved ||
                  isCancelled) && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-3 text-xs leading-5 text-gray-500">
                    {isResolved ? (
                      <CheckCircle2
                        size={15}
                        className="mt-0.5 shrink-0 text-green-600"
                      />
                    ) : (
                      <XCircle
                        size={15}
                        className="mt-0.5 shrink-0 text-gray-500"
                      />
                    )}

                    <span>
                      {isResolved
                        ? "This claim has been resolved. You can still update its status if needed."
                        : "This claim has been cancelled. You can still update its status if needed."}
                    </span>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}