"use client";

import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Save,
  ShieldCheck,
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

type Props = {
  claim: Claim;
  warranty: Warranty;
  customer: Customer | null;
  product: Product | null;
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

function inputClass() {
  return "w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10";
}

function labelClass() {
  return "mb-1.5 block text-sm font-medium text-gray-700";
}

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

export default function ClaimEditClient({
  claim,
  warranty,
  customer,
  product,
}: Props) {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [claimNumber, setClaimNumber] =
    useState(claim.claim_number);

  const [status, setStatus] =
    useState(claim.status);

  const [issue, setIssue] =
    useState(claim.issue);

  const [resolution, setResolution] =
    useState(claim.resolution ?? "");

  const [claimDate, setClaimDate] =
    useState(claim.claim_date);

  const [resolvedDate, setResolvedDate] =
    useState(claim.resolved_date ?? "");

  const [notes, setNotes] =
    useState(claim.notes ?? "");

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const trimmedClaimNumber =
      claimNumber.trim();

    const trimmedIssue =
      issue.trim();

    const trimmedResolution =
      resolution.trim();

    const trimmedNotes =
      notes.trim();

    if (!trimmedClaimNumber) {
      setErrorMessage(
        "Claim number is required.",
      );
      return;
    }

    if (!trimmedIssue) {
      setErrorMessage(
        "Please describe the warranty issue.",
      );
      return;
    }

    if (!claimDate) {
      setErrorMessage(
        "Claim date is required.",
      );
      return;
    }

    if (
      status === "resolved" &&
      !resolvedDate
    ) {
      setErrorMessage(
        "A resolved date is required when the claim is marked as resolved.",
      );
      return;
    }

    if (
      resolvedDate &&
      resolvedDate < claimDate
    ) {
      setErrorMessage(
        "Resolved date cannot be before the claim date.",
      );
      return;
    }

    setSaving(true);

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

      let canManage =
        Boolean(isAdmin);

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

        canManage =
          Boolean(hasPermission);
      }

      if (!canManage) {
        throw new Error(
          "You do not have permission to edit warranty claims.",
        );
      }

      let finalResolvedDate:
        | string
        | null = null;

      if (status === "resolved") {
        finalResolvedDate =
          resolvedDate ||
          new Date()
            .toISOString()
            .slice(0, 10);
      }

      const {
        error: updateError,
      } = await supabase
        .from("warranty_claims")
        .update({
          claim_number:
            trimmedClaimNumber,
          status,
          issue: trimmedIssue,
          resolution:
            trimmedResolution ||
            null,
          claim_date: claimDate,
          resolved_date:
            finalResolvedDate,
          notes:
            trimmedNotes || null,
        })
        .eq("id", claim.id)
        .eq("company_id", companyId)
        .eq(
          "warranty_id",
          warranty.id,
        );

      if (updateError) {
        if (
          updateError.code ===
          "23505"
        ) {
          throw new Error(
            "That claim number already exists in this company.",
          );
        }

        throw new Error(
          updateError.message,
        );
      }

      const statusChanged =
        claim.status !== status;

      const activityMessage =
        statusChanged
          ? `Warranty claim ${trimmedClaimNumber} was updated and moved from ${formatStatus(
              claim.status,
            )} to ${formatStatus(status)}.`
          : `Warranty claim ${trimmedClaimNumber} was updated.`;

      await supabase
        .from("warranty_activity")
        .insert({
          company_id: companyId,
          warranty_id:
            warranty.id,
          action: statusChanged
            ? "claim_updated"
            : "claim_updated",
          message:
            activityMessage,
          created_by: user.id,
        });

      setSuccessMessage(
        "Warranty claim updated successfully.",
      );

      router.refresh();

      window.setTimeout(() => {
        router.push(
          `/warranty/claims/${claim.id}`,
        );
      }, 700);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while updating the claim.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-content">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/warranty/claims/${claim.id}`,
              )
            }
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to Claim
          </button>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white">
              <ShieldCheck size={23} />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Edit Warranty Claim
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Update claim details, status,
                resolution, and notes.
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-gray-700">
                  {claim.claim_number}
                </span>

                <span className="text-gray-300">
                  •
                </span>

                <span className="text-gray-500">
                  Warranty{" "}
                  {warranty.warranty_number}
                </span>
              </div>
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

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
              <h2 className="text-base font-semibold text-gray-900">
                Claim Details
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Manage the core information for this
                warranty claim.
              </p>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              <div>
                <label
                  className={labelClass()}
                >
                  Claim Number
                </label>

                <input
                  value={claimNumber}
                  onChange={(event) =>
                    setClaimNumber(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  placeholder="CLM-00001"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label
                  className={labelClass()}
                >
                  Status
                </label>

                <select
                  value={status}
                  onChange={(event) => {
                    const nextStatus =
                      event.target.value;

                    setStatus(nextStatus);

                    if (
                      nextStatus ===
                        "resolved" &&
                      !resolvedDate
                    ) {
                      setResolvedDate(
                        new Date()
                          .toISOString()
                          .slice(0, 10),
                      );
                    }

                    if (
                      nextStatus !==
                        "resolved" &&
                      resolvedDate
                    ) {
                      setResolvedDate("");
                    }
                  }}
                  className={inputClass()}
                  disabled={saving}
                >
                  {statusOptions.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="md:col-span-2">
                <label
                  className={labelClass()}
                >
                  Issue / Problem
                </label>

                <textarea
                  value={issue}
                  onChange={(event) =>
                    setIssue(
                      event.target.value,
                    )
                  }
                  className={`${inputClass()} min-h-36 resize-y`}
                  placeholder="Describe the customer's warranty issue..."
                  disabled={saving}
                  required
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
              <div className="flex items-center gap-2">
                <CalendarDays
                  size={18}
                  className="text-gray-700"
                />

                <h2 className="text-base font-semibold text-gray-900">
                  Claim Dates
                </h2>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                Record when the claim was opened and
                resolved.
              </p>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              <div>
                <label
                  className={labelClass()}
                >
                  Claim Date
                </label>

                <input
                  type="date"
                  value={claimDate}
                  onChange={(event) =>
                    setClaimDate(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label
                  className={labelClass()}
                >
                  Resolved Date
                </label>

                <input
                  type="date"
                  value={resolvedDate}
                  min={claimDate}
                  onChange={(event) =>
                    setResolvedDate(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  disabled={
                    saving ||
                    status !==
                      "resolved"
                  }
                />

                <p className="mt-1.5 text-xs text-gray-500">
                  Only used when the claim is resolved.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
              <h2 className="text-base font-semibold text-gray-900">
                Resolution
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Record how the customer's warranty issue
                was handled.
              </p>
            </div>

            <div className="p-6">
              <textarea
                value={resolution}
                onChange={(event) =>
                  setResolution(
                    event.target.value,
                  )
                }
                className={`${inputClass()} min-h-36 resize-y`}
                placeholder="Describe the resolution, replacement, approved action, or other outcome..."
                disabled={saving}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
              <h2 className="text-base font-semibold text-gray-900">
                Notes
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Add internal notes about this claim.
              </p>
            </div>

            <div className="p-6">
              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value,
                  )
                }
                className={`${inputClass()} min-h-32 resize-y`}
                placeholder="Add internal notes..."
                disabled={saving}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
              <h2 className="text-base font-semibold text-gray-900">
                Linked Warranty
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                This claim remains permanently connected
                to its existing warranty.
              </p>
            </div>

            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Warranty
                </p>

                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {warranty.warranty_number}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Customer
                </p>

                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {customer?.name ||
                    customer?.email ||
                    "No customer linked"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Product
                </p>

                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {product?.name ||
                    "No product linked"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Serial Number
                </p>

                <p className="mt-1 break-all text-sm font-semibold text-gray-900">
                  {warranty.serial_number ||
                    "—"}
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/warranty/claims/${claim.id}`,
                )
              }
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={17} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}