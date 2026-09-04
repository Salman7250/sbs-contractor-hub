"use client";

import { useState } from "react";
import { createSubscription } from "./actions/create-subscription";

type Company = {
  id: string;
  name: string;
};

type Plan = {
  id: string;
  name: string;
  slug: string;
  monthly_price: number | null;
  yearly_price: number | null;
};

type Props = {
  companies: Company[];
  plans: Plan[];
};

export default function CreateSubscriptionForm({
  companies,
  plans,
}: Props) {
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [planId, setPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [status, setStatus] = useState("trialing");
  const [trialDays, setTrialDays] = useState("14");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = plans.find((plan) => plan.id === planId);

  const amount =
    billingCycle === "yearly"
      ? Number(selectedPlan?.yearly_price ?? 0)
      : Number(selectedPlan?.monthly_price ?? 0);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const result = await createSubscription(formData);

    if (!result.success) {
      setError(result.error || "Failed to create subscription.");
      setLoading(false);
      return;
    }

    setOpen(false);
    setCompanyId("");
    setPlanId("");
    setBillingCycle("monthly");
    setStatus("trialing");
    setTrialDays("14");
    setLoading(false);

    window.location.reload();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
      >
        + Create Subscription
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Create Subscription
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Assign a plan to a company.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 transition hover:text-white"
              >
                ✕
              </button>
            </div>

            <form action={handleSubmit} className="space-y-5 p-6">
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Company
                </label>

                <select
                  name="company_id"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500"
                >
                  <option value="">Select company</option>

                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Plan
                </label>

                <select
                  name="plan_id"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500"
                >
                  <option value="">Select plan</option>

                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Billing Cycle
                  </label>

                  <select
                    name="billing_cycle"
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Status
                  </label>

                  <select
                    name="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500"
                  >
                    <option value="trialing">Trialing</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>

              {status === "trialing" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Trial Period
                  </label>

                  <div className="flex items-center gap-3">
                    <input
                      name="trial_days"
                      type="number"
                      min="0"
                      max="365"
                      value={trialDays}
                      onChange={(e) => setTrialDays(e.target.value)}
                      className="w-32 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500"
                    />

                    <span className="text-sm text-slate-400">
                      days
                    </span>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">
                    Subscription Amount
                  </span>

                  <span className="text-lg font-semibold text-white">
                    {amount > 0
                      ? `$${amount.toFixed(2)}`
                      : "Custom"}
                  </span>
                </div>

                {selectedPlan && (
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedPlan.name} ·{" "}
                    {billingCycle === "yearly"
                      ? "Yearly"
                      : "Monthly"}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-700 pt-5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}