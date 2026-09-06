"use client";

import { useState, useTransition } from "react";
import { updateEntitlement } from "./actions/update-entitlement";
import { usePlanEntitlement as restorePlanEntitlement } from "./actions/use-plan-entitlement";

type Entitlement = {
  id: string;
  companyId: string;
  companyName: string;
  moduleId: string;
  moduleName: string;
  access: "enabled" | "disabled";
  source: "plan" | "override" | "free";
  expiresAt: string | null;
  reason: string | null;
};

type Props = {
  entitlement: Entitlement;
};

export default function ManageEntitlementButton({
  entitlement,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showUsePlanConfirm, setShowUsePlanConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [access, setAccess] = useState(entitlement.access);

  const [source, setSource] = useState<"override" | "free">(
    entitlement.source === "free" ? "free" : "override"
  );

  const [expiresAt, setExpiresAt] = useState(
    entitlement.expiresAt
      ? entitlement.expiresAt.slice(0, 10)
      : ""
  );

  const [reason, setReason] = useState(
    entitlement.reason ?? ""
  );

  function closeModal() {
    if (isPending) return;

    setOpen(false);
    setShowUsePlanConfirm(false);
    setError("");
    setSuccess("");
  }

  function handleSave() {
    setError("");
    setSuccess("");

    const formData = new FormData();

    formData.set("entitlement_id", entitlement.id);
    formData.set("access", access);
    formData.set("source", source);
    formData.set("expires_at", expiresAt);
    formData.set("reason", reason.trim());

    startTransition(async () => {
      const result = await updateEntitlement(formData);

      if (!result.success) {
        setError(
          result.error ?? "Failed to update entitlement."
        );
        return;
      }

      setSuccess("Entitlement updated successfully.");

      setTimeout(() => {
        window.location.reload();
      }, 700);
    });
  }

  function handleUsePlan() {
    setError("");
    setSuccess("");

    startTransition(async () => {
      const result = await restorePlanEntitlement(entitlement.id);

      if (!result.success) {
        setError(
          result.error ?? "Failed to restore plan access."
        );
        setShowUsePlanConfirm(false);
        return;
      }

      setSuccess(
        result.message ?? "Plan access restored successfully."
      );

      setTimeout(() => {
        window.location.reload();
      }, 700);
    });
  }

  return (
    <>
      {/* Manage Button */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError("");
          setSuccess("");
          setShowUsePlanConfirm(false);
        }}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
      >
        Manage
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">

            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Manage Entitlement
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  {entitlement.companyName} ·{" "}
                  {entitlement.moduleName}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="text-2xl leading-none text-slate-500 transition hover:text-white disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="space-y-5 px-6 py-6">

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
                  {success}
                </div>
              )}

              {!showUsePlanConfirm ? (
                <>
                  {/* Access */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Access
                    </label>

                    <select
                      value={access}
                      onChange={(e) =>
                        setAccess(
                          e.target.value as
                            | "enabled"
                            | "disabled"
                        )
                      }
                      disabled={isPending}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500 disabled:opacity-50"
                    >
                      <option value="enabled">
                        Enabled
                      </option>

                      <option value="disabled">
                        Disabled
                      </option>
                    </select>
                  </div>

                  {/* Source */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Source
                    </label>

                    <select
                      value={source}
                      onChange={(e) =>
                        setSource(
                          e.target.value as
                            | "override"
                            | "free"
                        )
                      }
                      disabled={isPending}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500 disabled:opacity-50"
                    >
                      <option value="override">
                        Override
                      </option>

                      <option value="free">
                        Free Access
                      </option>
                    </select>

                    <p className="mt-2 text-xs text-slate-500">
                      Override gives administrator-controlled
                      access. Free Access grants the module
                      without requiring it to be included in
                      the customer&apos;s plan.
                    </p>
                  </div>

                  {/* Expiration */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Expiration
                    </label>

                    <input
                      type="date"
                      value={expiresAt}
                      onChange={(e) =>
                        setExpiresAt(e.target.value)
                      }
                      disabled={isPending}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500 disabled:opacity-50"
                    />

                    <p className="mt-2 text-xs text-slate-500">
                      Leave empty for no expiration.
                    </p>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Reason
                    </label>

                    <textarea
                      value={reason}
                      onChange={(e) =>
                        setReason(e.target.value)
                      }
                      disabled={isPending}
                      rows={3}
                      placeholder="Why is this entitlement being changed?"
                      className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-slate-500 disabled:opacity-50"
                    />
                  </div>

                  {/* Current Status */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Current Status
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-500">
                          Access
                        </div>

                        <div className="mt-1 font-medium capitalize text-white">
                          {entitlement.access}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500">
                          Source
                        </div>

                        <div className="mt-1 font-medium capitalize text-white">
                          {entitlement.source}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500">
                          Expiration
                        </div>

                        <div className="mt-1 font-medium text-white">
                          {entitlement.expiresAt
                            ? new Date(
                                entitlement.expiresAt
                              ).toLocaleDateString()
                            : "No expiration"}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500">
                          Module
                        </div>

                        <div className="mt-1 font-medium text-white">
                          {entitlement.moduleName}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between">

                    {/* Use Plan */}
                    <button
                      type="button"
                      onClick={() =>
                        setShowUsePlanConfirm(true)
                      }
                      disabled={isPending}
                      className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-4 py-2.5 text-sm font-medium text-amber-300 transition hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Use Plan
                    </button>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={closeModal}
                        disabled={isPending}
                        className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-900 disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isPending}
                        className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPending
                          ? "Saving..."
                          : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Use Plan Confirmation */
                <div className="space-y-5">

                  <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-xl">
                        ⚠️
                      </div>

                      <div>
                        <h3 className="font-semibold text-amber-200">
                          Restore Plan Access?
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-amber-100/70">
                          This will remove the manual
                          override/free access and restore
                          this module according to the
                          company&apos;s current subscription
                          plan.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-amber-800/40 bg-black/20 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-amber-500/70">
                        Company
                      </div>

                      <div className="mt-1 text-sm font-medium text-amber-100">
                        {entitlement.companyName}
                      </div>

                      <div className="mt-3 text-xs uppercase tracking-wide text-amber-500/70">
                        Module
                      </div>

                      <div className="mt-1 text-sm font-medium text-amber-100">
                        {entitlement.moduleName}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
                    If the current plan includes this module,
                    access will become <strong className="text-white">Plan</strong>{" "}
                    access. If it does not, the manual
                    entitlement will be removed.
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
                    <button
                      type="button"
                      onClick={() =>
                        setShowUsePlanConfirm(false)
                      }
                      disabled={isPending}
                      className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-900 disabled:opacity-50"
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      onClick={handleUsePlan}
                      disabled={isPending}
                      className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending
                        ? "Restoring..."
                        : "Yes, Use Plan"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}