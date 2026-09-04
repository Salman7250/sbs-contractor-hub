import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import CreateSubscriptionForm from "./create-subscription-form";
import ManageSubscriptionButton from "./manage-subscription-button";

type SubscriptionRow = {
  id: string;
  company_id: string;
  plan_id: string | null;
  status: string;
  billing_cycle: string;
  amount: number | null;
  currency: string | null;
  started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

type CompanyRow = {
  id: string;
  name: string;
};

type PlanRow = {
  id: string;
  name: string;
  slug: string;
  monthly_price: number | null;
  yearly_price: number | null;
  is_active: boolean;
};

function formatMoney(
  amount: number | null,
  currency: string | null
) {
  if (amount === null || amount === undefined) {
    return "—";
  }

  const code = currency || "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

function formatDate(date: string | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function statusClasses(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "trialing":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";

    case "past_due":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    case "paused":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";

    case "canceled":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    case "incomplete":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";

    case "incomplete_expired":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    default:
      return "border-slate-700 bg-slate-800 text-slate-300";
  }
}

function billingLabel(billingCycle: string) {
  switch (billingCycle) {
    case "monthly":
      return "Monthly";

    case "yearly":
      return "Yearly";

    default:
      return billingCycle;
  }
}

export default async function AdminSubscriptionsPage() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const [
    subscriptionsResult,
    companiesResult,
    plansResult,
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(`
        id,
        company_id,
        plan_id,
        status,
        billing_cycle,
        amount,
        currency,
        started_at,
        trial_ends_at,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        canceled_at,
        provider,
        provider_customer_id,
        provider_subscription_id,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false }),

    supabase
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true }),

    supabase
      .from("plans")
      .select(
        "id, name, slug, monthly_price, yearly_price, is_active"
      )
      .order("monthly_price", { ascending: true }),
  ]);

  const {
    data: subscriptions,
    error: subscriptionsError,
  } = subscriptionsResult;

  const {
    data: companies,
    error: companiesError,
  } = companiesResult;

  const {
    data: plans,
    error: plansError,
  } = plansResult;

  if (subscriptionsError) {
    console.error("Failed to load subscriptions:", {
      message: subscriptionsError.message,
      code: subscriptionsError.code,
      details: subscriptionsError.details,
      hint: subscriptionsError.hint,
    });
  }

  if (companiesError) {
    console.error("Failed to load companies:", {
      message: companiesError.message,
      code: companiesError.code,
      details: companiesError.details,
      hint: companiesError.hint,
    });
  }

  if (plansError) {
    console.error("Failed to load plans:", {
      message: plansError.message,
      code: plansError.code,
      details: plansError.details,
      hint: plansError.hint,
    });
  }

  const subscriptionRows =
    (subscriptions ?? []) as SubscriptionRow[];

  const companyRows = (companies ?? []) as CompanyRow[];

  const planRows = (plans ?? []).filter(
    (plan) => plan.is_active === true
  ) as PlanRow[];

  const companyMap = new Map(
    companyRows.map((company) => [
      company.id,
      company.name,
    ])
  );

  const planMap = new Map(
    planRows.map((plan) => [plan.id, plan])
  );

  const activeCount = subscriptionRows.filter(
    (subscription) =>
      subscription.status === "active"
  ).length;

  const trialingCount = subscriptionRows.filter(
    (subscription) =>
      subscription.status === "trialing"
  ).length;

  const pastDueCount = subscriptionRows.filter(
    (subscription) =>
      subscription.status === "past_due"
  ).length;

  const canceledCount = subscriptionRows.filter(
    (subscription) =>
      subscription.status === "canceled"
  ).length;

  const totalMRR = subscriptionRows
    .filter(
      (subscription) =>
        subscription.status === "active" &&
        subscription.billing_cycle === "monthly"
    )
    .reduce(
      (total, subscription) =>
        total + Number(subscription.amount ?? 0),
      0
    );

  const totalARR = subscriptionRows
    .filter(
      (subscription) =>
        subscription.status === "active"
    )
    .reduce((total, subscription) => {
      const amount = Number(subscription.amount ?? 0);

      if (subscription.billing_cycle === "yearly") {
        return total + amount;
      }

      return total + amount * 12;
    }, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Link
              href="/sbs-admin"
              className="transition hover:text-slate-300"
            >
              Platform Admin
            </Link>

            <span>/</span>

            <span className="text-slate-400">
              Subscriptions
            </span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Subscriptions
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Manage company subscriptions, billing cycles,
            plan assignments, and subscription status.
          </p>
        </div>

        <CreateSubscriptionForm
          companies={companyRows}
          plans={planRows}
        />
      </div>

      {/* Errors */}
      {(subscriptionsError ||
        companiesError ||
        plansError) && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <h2 className="font-semibold text-red-300">
            Some subscription data could not be loaded
          </h2>

          <div className="mt-3 space-y-2 text-sm text-red-200">
            {subscriptionsError && (
              <div>
                <strong>Subscriptions:</strong>{" "}
                {subscriptionsError.message}
              </div>
            )}

            {companiesError && (
              <div>
                <strong>Companies:</strong>{" "}
                {companiesError.message}
              </div>
            )}

            {plansError && (
              <div>
                <strong>Plans:</strong>{" "}
                {plansError.message}

                {plansError.code && (
                  <div className="mt-1 text-xs text-red-300">
                    Code: {plansError.code}
                  </div>
                )}

                {plansError.details && (
                  <div className="mt-1 text-xs text-red-300">
                    {plansError.details}
                  </div>
                )}

                {plansError.hint && (
                  <div className="mt-1 text-xs text-red-300">
                    Hint: {plansError.hint}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total Subscriptions
          </p>

          <p className="mt-3 text-3xl font-semibold text-white">
            {subscriptionRows.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Active
          </p>

          <p className="mt-3 text-3xl font-semibold text-emerald-300">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Trialing
          </p>

          <p className="mt-3 text-3xl font-semibold text-blue-300">
            {trialingCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Past Due
          </p>

          <p className="mt-3 text-3xl font-semibold text-amber-300">
            {pastDueCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Canceled
          </p>

          <p className="mt-3 text-3xl font-semibold text-red-300">
            {canceledCount}
          </p>
        </div>
      </div>

      {/* Revenue summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-sm font-medium text-slate-400">
            Estimated MRR
          </p>

          <p className="mt-2 text-3xl font-semibold text-white">
            {formatMoney(totalMRR, "USD")}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Active monthly subscriptions only.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-sm font-medium text-slate-400">
            Estimated ARR
          </p>

          <p className="mt-2 text-3xl font-semibold text-white">
            {formatMoney(totalARR, "USD")}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Based on current active subscription amounts.
          </p>
        </div>
      </div>

      {/* Subscriptions table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        <div className="border-b border-slate-800 px-6 py-5">
          <h2 className="text-lg font-semibold text-white">
            All Subscriptions
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Current subscription records across all
            companies.
          </p>
        </div>

        {subscriptionRows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-800">
              <span className="text-xl text-slate-400">
                $
              </span>
            </div>

            <h3 className="mt-4 text-sm font-semibold text-white">
              No subscriptions yet
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Create a subscription to assign a plan to a
              company.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Company
                  </th>

                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Plan
                  </th>

                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Billing
                  </th>

                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Amount
                  </th>

                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Period End
                  </th>

                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Created
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {subscriptionRows.map(
                  (subscription) => {
                    const companyName =
                      companyMap.get(
                        subscription.company_id
                      ) ??
                      "Unknown Company";

                    const plan = subscription.plan_id
                      ? planMap.get(
                          subscription.plan_id
                        )
                      : null;

                    return (
                      <tr
                        key={subscription.id}
                        className="transition hover:bg-slate-800/30"
                      >
                        {/* Company */}
                        <td className="whitespace-nowrap px-6 py-5">
                          <div className="font-medium text-white">
                            {companyName}
                          </div>

                          <div className="mt-1 font-mono text-xs text-slate-600">
                            {subscription.company_id}
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="whitespace-nowrap px-6 py-5">
                          {plan ? (
                            <>
                              <div className="font-medium text-slate-200">
                                {plan.name}
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {plan.slug}
                              </div>
                            </>
                          ) : (
                            <span className="text-sm text-slate-500">
                              No plan
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-6 py-5">
                          <div className="flex flex-col items-start gap-2">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                                subscription.status
                              )}`}
                            >
                              {subscription.status.replace(
                                /_/g,
                                " "
                              )}
                            </span>

                            {subscription.cancel_at_period_end && (
                              <span className="text-xs text-amber-400">
                                Cancels at period end
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Billing */}
                        <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-300">
                          {billingLabel(
                            subscription.billing_cycle
                          )}
                        </td>

                        {/* Amount */}
                        <td className="whitespace-nowrap px-6 py-5">
                          <div className="text-sm font-medium text-white">
                            {formatMoney(
                              subscription.amount,
                              subscription.currency
                            )}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {subscription.currency ??
                              "USD"}
                          </div>
                        </td>

                        {/* Period */}
                        <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-400">
                          {formatDate(
                            subscription.current_period_end
                          )}
                        </td>

                        {/* Created */}
                        <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-400">
                          {formatDate(
                            subscription.created_at
                          )}
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap px-6 py-5 text-right">
                          <ManageSubscriptionButton
                            subscriptionId={
                              subscription.id
                            }
                            currentStatus={
                              subscription.status
                            }
                            cancelAtPeriodEnd={
                              subscription.cancel_at_period_end
                            }
                          />
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}