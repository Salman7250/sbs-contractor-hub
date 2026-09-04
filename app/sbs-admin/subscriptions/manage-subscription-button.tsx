"use client";

import { useState } from "react";
import { updateSubscription } from "./actions/update-subscription";

type Props = {
  subscriptionId: string;
  currentStatus?: string | null;
  cancelAtPeriodEnd?: boolean | null;
};

export default function ManageSubscriptionButton({
  subscriptionId,
  currentStatus,
  cancelAtPeriodEnd,
}: Props) {
  const [open, setOpen] = useState(false);

  const [status, setStatus] = useState(
    currentStatus ?? "trialing"
  );

  const [cancelAtEnd, setCancelAtEnd] = useState(
    cancelAtPeriodEnd ?? false
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    formData.set("subscription_id", subscriptionId);

    const result = await updateSubscription(formData);

    if (!result.success) {
      setError(
        result.error || "Failed to update subscription."
      );
      setLoading(false);
      return;
    }

    setOpen(false);
    setLoading(false);

    window.location.reload();
  }

  function handleClose() {
    if (loading) return;

    setOpen(false);
    setError("");

    setStatus(currentStatus ?? "trialing");
    setCancelAtEnd(cancelAtPeriodEnd ?? false);
  }

  function handleOpen() {
    setError("");
    setStatus(currentStatus ?? "trialing");
    setCancelAtEnd(cancelAtPeriodEnd ?? false);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
      >
        Manage
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-700 px-6 py-5">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-white">
                  Manage Subscription
                </h2>

                <p className="mt-1 whitespace-normal break-words text-sm leading-5 text-slate-400">
                  Update the subscription status and cancellation
                  settings.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                aria-label="Close"
                className="shrink-0 text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form
              action={handleSubmit}
              className="w-full space-y-5 p-6"
            >
              {/* Error */}
              {error && (
                <div className="w-full whitespace-normal break-words rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-5 text-red-300">
                  {error}
                </div>
              )}

              {/* Status */}
              <div className="w-full min-w-0">
                <label
                  htmlFor={`status-${subscriptionId}`}
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Subscription Status
                </label>

                <select
                  id={`status-${subscriptionId}`}
                  name="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value)
                  }
                  disabled={loading}
                  className="block w-full min-w-0 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="trialing">
                    Trialing
                  </option>

                  <option value="active">
                    Active
                  </option>

                  <option value="past_due">
                    Past Due
                  </option>

                  <option value="paused">
                    Paused
                  </option>

                  <option value="canceled">
                    Canceled
                  </option>

                  <option value="incomplete">
                    Incomplete
                  </option>

                  <option value="incomplete_expired">
                    Incomplete Expired
                  </option>
                </select>
              </div>

              {/* Cancel at period end */}
              <label className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                <input
                  type="checkbox"
                  name="cancel_at_period_end"
                  value="true"
                  checked={cancelAtEnd}
                  onChange={(event) =>
                    setCancelAtEnd(event.target.checked)
                  }
                  disabled={loading}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-600"
                />

                <div className="w-0 min-w-0 flex-1">
                  <div className="w-full whitespace-normal break-words text-sm font-medium leading-5 text-white">
                    Cancel at period end
                  </div>

                  <div className="mt-1 w-full whitespace-normal break-words text-xs leading-5 text-slate-400">
                    The company keeps access until the current
                    billing period ends.
                  </div>
                </div>
              </label>

              {/* Information */}
              <div className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                <p className="w-full whitespace-normal break-words text-xs leading-5 text-slate-400">
                  Changing the subscription status may
                  automatically update the company&apos;s
                  plan-based module entitlements.
                </p>
              </div>

              {/* Actions */}
              <div className="flex w-full flex-col gap-3 border-t border-slate-700 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}