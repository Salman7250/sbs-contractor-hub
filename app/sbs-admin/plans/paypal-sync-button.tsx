"use client";

import { useState } from "react";

type SyncResult = {
  success: boolean;

  error?: string;

  plan?: {
    id: string;
    name: string;
    slug: string;
  };

  paypal?: {
    productId: string;
    monthlyPlanId: string;
    yearlyPlanId: string;
  };

  sync?: {
    product: "existing" | "reconciled" | "created";
    monthly: "existing" | "reconciled" | "created";
    yearly: "existing" | "reconciled" | "created";
  };
};

export default function PayPalSyncButton({
  planId,
}: {
  planId: string;
}) {
  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState<SyncResult | null>(null);

  async function handleSync() {
    if (loading) return;

    setLoading(true);
    setResult(null);

    try {
      const response =
        await fetch(
          "/api/paypal/sync-plan",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              planId,
            }),
          }
        );

      const data =
        (await response.json()) as SyncResult;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "PayPal synchronization failed."
        );
      }

      setResult(data);

      /*
       * Refresh the Server Component so
       * newly reconciled PayPal IDs appear
       * immediately in the Plans page.
       */
      window.location.reload();
    } catch (error) {
      setResult({
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "PayPal synchronization failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  const syncStatus =
    result?.sync;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 transition hover:border-blue-500/30 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300/30 border-t-blue-300" />
            Syncing...
          </>
        ) : (
          <>
            <span>↻</span>
            Sync PayPal
          </>
        )}
      </button>

      {syncStatus && (
        <div className="text-right text-[10px] leading-4">
          <div className="text-emerald-400">
            PayPal synchronized
          </div>

          <div className="text-slate-600">
            Product: {syncStatus.product}
            {" · "}
            Monthly: {syncStatus.monthly}
            {" · "}
            Yearly: {syncStatus.yearly}
          </div>
        </div>
      )}

      {result &&
        !result.success &&
        result.error && (
          <div className="max-w-[280px] text-right text-[10px] leading-4 text-red-400">
            {result.error}
          </div>
        )}
    </div>
  );
}