"use client";

import { useState } from "react";

type Plan = {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  yearly_price: number;
  is_active: boolean;
};

type Subscription = {
  id: string;
  company_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
  plans: Plan | null;
};

type Payment = {
  id: string;
  subscription_id: string | null;
  provider: string;
  provider_transaction_id: string | null;
  provider_order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  payment_method: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  failure_reason: string | null;
  created_at: string;
};

type Props = {
  company: {
    id: string;
    name: string;
    currency: string | null;
  };
  subscription: Subscription | null;
  payments: Payment[];
  initialError: string | null;
};

function formatCurrency(
  amount: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getDisplayStatus(status: string) {
  const normalizedStatus = String(status);

  switch (normalizedStatus) {
    case "trialing":
      return "Trial";

    case "active":
      return "Active";

    case "past_due":
      return "Past Due";

    case "paused":
      return "Paused";

    case "incomplete":
      return "Awaiting Payment";

    case "incomplete_expired":
      return "Payment Expired";

    case "canceled":
      return "Canceled";

    case "succeeded":
      return "Paid";

    case "failed":
      return "Failed";

    case "refunded":
      return "Refunded";

    case "partially_refunded":
      return "Partially Refunded";

    case "pending":
      return "Pending";

    case "subscription":
      return "Subscription";

    case "one_time":
      return "One Time";

    case "refund":
      return "Refund";

    case "adjustment":
      return "Adjustment";

    default:
      return normalizedStatus
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        );
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "active":
    case "trialing":
    case "succeeded":
      return "bg-[#ecfdf3] text-[#027a48]";

    case "past_due":
    case "pending":
    case "incomplete":
      return "bg-[#fffaeb] text-[#b54708]";

    case "failed":
    case "canceled":
    case "incomplete_expired":
      return "bg-[#fef3f2] text-[#b42318]";

    case "refunded":
    case "partially_refunded":
      return "bg-[#f2f4f7] text-[#475467]";

    default:
      return "bg-[#f2f4f7] text-[#475467]";
  }
}

function getDaysRemaining(
  value: string | null
) {
  if (!value) return null;

  const end = new Date(value).getTime();

  if (Number.isNaN(end)) {
    return null;
  }

  const difference = end - Date.now();

  return Math.max(
    0,
    Math.ceil(
      difference / (1000 * 60 * 60 * 24)
    )
  );
}

export default function BillingPageClient({
  company,
  subscription,
  payments,
  initialError,
}: Props) {
  const [billingCycle, setBillingCycle] =
    useState<"monthly" | "yearly">(
      subscription?.billing_cycle === "yearly"
        ? "yearly"
        : "monthly"
    );

  const [loadingPlan, setLoadingPlan] =
    useState<string | null>(null);

  const [error, setError] = useState<string | null>(
    initialError
  );

  const activePlan =
    subscription?.plans ?? null;

  const currency =
    subscription?.currency ||
    company.currency ||
    "USD";

  const trialDays =
    subscription &&
    subscription.status === "trialing"
      ? getDaysRemaining(
          subscription.trial_ends_at
        )
      : null;

  const hasSubscription =
    subscription !== null;

  async function handleSubscribe(
    planId: string
  ) {
    setError(null);
    setLoadingPlan(planId);

    try {
      const response = await fetch(
        "/api/paypal/create-subscription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyId: company.id,
            planId,
            billingCycle,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      const approvalUrl =
        data?.approvalUrl ??
        data?.subscription?.approvalUrl ??
        data?.data?.approvalUrl ??
        data?.paypal?.approvalUrl;

      if (!response.ok || !approvalUrl) {
        throw new Error(
          data?.error ||
            data?.subscription?.error ||
            data?.paypal?.error ||
            "Unable to start PayPal checkout."
        );
      }

      window.location.href = approvalUrl;
    } catch (err) {
      console.error(
        "PayPal subscription error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to start PayPal checkout."
      );

      setLoadingPlan(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="flex items-start gap-3 rounded-[12px] border border-[#f3d0cb] bg-[#fff7f6] p-[15px_16px] text-[#7a271a]">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/70 text-[12px] font-extrabold">
            !
          </div>

          <div className="min-w-0">
            <strong className="block text-[12px] leading-[17px]">
              Billing action failed
            </strong>

            <p className="m-0 mt-0.5 text-[11px] leading-[17px]">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto grid h-7 w-7 shrink-0 place-items-center border-0 bg-transparent text-[19px] leading-none text-inherit"
            aria-label="Close error"
          >
            ×
          </button>
        </div>
      )}

      {hasSubscription && subscription ? (
        <>
          <section className="flex flex-col gap-6 rounded-[16px] border border-[#172033] bg-[#172033] p-[22px] text-white shadow-[0_8px_25px_rgba(23,32,51,0.12)] min-[901px]:flex-row min-[901px]:items-center min-[901px]:justify-between">
            <div className="flex min-w-0 items-center gap-[15px]">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-white/10 text-[20px] font-bold">
                $
              </div>

              <div className="min-w-0">
                <div className="mb-1 text-[9px] font-bold leading-[13px] tracking-[0.08em] text-white/55">
                  CURRENT PLAN
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="m-0 text-[20px] font-bold leading-[27px]">
                    {activePlan?.name ||
                      "Current Plan"}
                  </h2>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold leading-[13px] text-white/85">
                    <span className="h-[5px] w-[5px] rounded-full bg-current" />

                    {getDisplayStatus(
                      subscription.status
                    )}
                  </span>
                </div>

                <p className="m-0 mt-0.5 text-[11px] leading-[17px] text-white/60">
                  {subscription.billing_cycle ===
                  "yearly"
                    ? "Billed annually"
                    : "Billed monthly"}{" "}
                  ·{" "}
                  {formatCurrency(
                    Number(subscription.amount),
                    currency
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-[15px] min-[901px]:flex-row min-[901px]:items-center">
              {subscription.status ===
                "trialing" &&
                trialDays !== null && (
                  <div className="flex flex-col items-start min-[901px]:items-end">
                    <strong className="text-[20px] leading-[23px]">
                      {trialDays}
                    </strong>

                    <span className="text-[9px] text-white/60">
                      days left in trial
                    </span>
                  </div>
                )}

              <button
                type="button"
                disabled
                className="h-[38px] w-full cursor-not-allowed rounded-[9px] border border-white/15 bg-white/[0.08] px-3.5 text-[11px] font-semibold text-white/55 min-[621px]:w-auto"
              >
                Manage Plan
              </button>
            </div>
          </section>

          {subscription.cancel_at_period_end && (
            <div className="flex items-start gap-3 rounded-[12px] border border-[#f2df9a] bg-[#fffbeb] p-[15px_16px] text-[#713f12]">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/70 text-[12px] font-extrabold">
                !
              </div>

              <div>
                <strong className="block text-[12px] leading-[17px]">
                  Subscription scheduled to
                  cancel
                </strong>

                <p className="m-0 mt-0.5 text-[11px] leading-[17px]">
                  Your plan will remain active
                  until{" "}
                  <strong>
                    {formatDate(
                      subscription.current_period_end
                    )}
                  </strong>
                  .
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 min-[901px]:grid-cols-2">
            <section className="overflow-hidden rounded-[14px] border border-[#e1e7ee] bg-white">
              <div className="border-b border-[#edf0f4] p-[19px_20px]">
                <h2 className="m-0 text-[14px] font-bold leading-5 text-[#17202b]">
                  Subscription
                </h2>

                <p className="m-0 mt-0.5 text-[11px] leading-[17px] text-[#7a8695]">
                  Details about your current SaaS
                  subscription.
                </p>
              </div>

              <div className="grid grid-cols-1 min-[621px]:grid-cols-2">
                <BillingDetail
                  label="Plan"
                  value={
                    activePlan?.name || "—"
                  }
                />

                <BillingDetail
                  label="Billing cycle"
                  value={
                    subscription.billing_cycle ===
                    "yearly"
                      ? "Yearly"
                      : "Monthly"
                  }
                />

                <BillingDetail
                  label="Amount"
                  value={formatCurrency(
                    Number(subscription.amount),
                    currency
                  )}
                />

                <BillingDetail
                  label="Started"
                  value={formatDate(
                    subscription.started_at
                  )}
                />

                <BillingDetail
                  label="Current period"
                  value={`${formatDate(
                    subscription.current_period_start
                  )} — ${formatDate(
                    subscription.current_period_end
                  )}`}
                />

                <BillingDetail
                  label="Payment provider"
                  value={subscription.provider}
                  capitalize
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-[14px] border border-[#e1e7ee] bg-white">
              <div className="border-b border-[#edf0f4] p-[19px_20px]">
                <h2 className="m-0 text-[14px] font-bold leading-5 text-[#17202b]">
                  Payment Method
                </h2>

                <p className="m-0 mt-0.5 text-[11px] leading-[17px] text-[#7a8695]">
                  Your subscription is processed
                  securely by PayPal.
                </p>
              </div>

              <div className="mx-5 mb-3 mt-[18px] flex items-center gap-[11px] rounded-[11px] border border-[#e1e7ee] bg-[#f8fafc] p-[13px]">
                <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-[#172033] text-[14px] font-extrabold text-white">
                  P
                </div>

                <div>
                  <strong className="block text-[11px] leading-4 text-[#17202b]">
                    PayPal
                  </strong>

                  <span className="mt-px block text-[10px] leading-[15px] text-[#7a8695]">
                    Secure subscription payments
                  </span>
                </div>
              </div>

              <div className="px-5 pb-[18px] text-[10px] leading-4 text-[#8a95a3]">
                Payment details are managed
                securely by PayPal. SBS does not
                store your PayPal password or
                payment card information.
              </div>
            </section>
          </div>
        </>
      ) : (
        <section className="rounded-[14px] border border-[#e1e7ee] bg-white px-[25px] py-[42px] text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-[13px] bg-[#eef1f6] text-[19px] font-extrabold text-[#172033]">
            $
          </div>

          <h2 className="m-0 text-[17px] font-bold leading-6 text-[#17202b]">
            Choose a plan
          </h2>

          <p className="mx-auto mt-1 max-w-[500px] text-[11px] leading-[18px] text-[#7a8695]">
            Your company doesn't have an active
            subscription yet. Choose a plan below
            to get started with Sharif Business
            Solutions.
          </p>
        </section>
      )}

      <section className="pt-1">
        <div className="mb-3.5 flex flex-col items-start justify-between gap-5 min-[621px]:flex-row min-[621px]:items-end">
          <div>
            <h2 className="m-0 text-[14px] font-bold leading-5 text-[#17202b]">
              {hasSubscription
                ? "Available Plans"
                : "Choose Your Plan"}
            </h2>

            <p className="m-0 mt-0.5 text-[11px] leading-[17px] text-[#7a8695]">
              Select the plan that best fits your
              business.
            </p>
          </div>

          <div className="flex w-full items-center gap-[3px] rounded-[9px] border border-[#e1e7ee] bg-white p-[3px] min-[621px]:w-auto">
            <button
              type="button"
              className={`h-[30px] flex-1 rounded-[7px] px-2.5 text-[10px] font-semibold transition-colors min-[621px]:min-w-[80px] ${
                billingCycle === "monthly"
                  ? "bg-[#172033] text-white"
                  : "bg-transparent text-[#7a8695] hover:bg-[#f8fafc]"
              }`}
              onClick={() =>
                setBillingCycle("monthly")
              }
            >
              Monthly
            </button>

            <button
              type="button"
              className={`h-[30px] flex-1 rounded-[7px] px-2.5 text-[10px] font-semibold transition-colors min-[621px]:min-w-[80px] ${
                billingCycle === "yearly"
                  ? "bg-[#172033] text-white"
                  : "bg-transparent text-[#7a8695] hover:bg-[#f8fafc]"
              }`}
              onClick={() =>
                setBillingCycle("yearly")
              }
            >
              Yearly{" "}
              <span
                className={`ml-1 rounded px-1 py-0.5 text-[8px] ${
                  billingCycle === "yearly"
                    ? "bg-white/10 text-white"
                    : "bg-[#ecfdf3] text-[#027a48]"
                }`}
              >
                Save
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 min-[621px]:grid-cols-2 min-[1251px]:grid-cols-4">
          <PlanCard
            name="Starter"
            description="Core tools for small contractor businesses."
            price={
              billingCycle === "monthly"
                ? 39
                : 390
            }
            billingCycle={billingCycle}
            features={[
              "CRM",
              "Leads",
              "Customers",
              "Jobs",
            ]}
            isCurrent={
              activePlan?.slug === "starter"
            }
            loading={
              loadingPlan ===
              "b4f299fd-14ac-4ac7-82a6-0206d2205af0"
            }
            onSelect={() =>
              handleSubscribe(
                "b4f299fd-14ac-4ac7-82a6-0206d2205af0"
              )
            }
          />

          <PlanCard
            name="Professional"
            description="More tools for growing contractor teams."
            price={
              billingCycle === "monthly"
                ? 79
                : 790
            }
            billingCycle={billingCycle}
            popular
            features={[
              "Everything in Starter",
              "Estimates",
              "Invoices",
              "Employees",
              "Reports",
            ]}
            isCurrent={
              activePlan?.slug ===
              "professional"
            }
            loading={
              loadingPlan ===
              "a05a7849-677c-4853-bb55-dc7a2df7aa1d"
            }
            onSelect={() =>
              handleSubscribe(
                "a05a7849-677c-4853-bb55-dc7a2df7aa1d"
              )
            }
          />

          <PlanCard
            name="Business"
            description="Complete business management for larger teams."
            price={
              billingCycle === "monthly"
                ? 149
                : 1490
            }
            billingCycle={billingCycle}
            features={[
              "All modules",
              "CRM & Sales",
              "Operations",
              "Finance",
              "HR",
              "Analytics",
            ]}
            isCurrent={
              activePlan?.slug === "business"
            }
            loading={
              loadingPlan ===
              "27542a3a-dcbd-452c-bb30-bc1d9e793d89"
            }
            onSelect={() =>
              handleSubscribe(
                "27542a3a-dcbd-452c-bb30-bc1d9e793d89"
              )
            }
          />

          <PlanCard
            name="Enterprise"
            description="Full platform access for enterprise organizations."
            price={
              billingCycle === "monthly"
                ? 299
                : 2990
            }
            billingCycle={billingCycle}
            features={[
              "All modules",
              "Unlimited platform access",
              "Advanced administration",
              "Enterprise controls",
              "Priority support",
            ]}
            isCurrent={
              activePlan?.slug ===
              "enterprise"
            }
            loading={
              loadingPlan ===
              "8fbd627f-f067-4815-9c17-9d3cb3ce5490"
            }
            onSelect={() =>
              handleSubscribe(
                "8fbd627f-f067-4815-9c17-9d3cb3ce5490"
              )
            }
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-[#e1e7ee] bg-white">
        <div className="border-b border-[#edf0f4] p-[19px_20px]">
          <h2 className="m-0 text-[14px] font-bold leading-5 text-[#17202b]">
            Payment History
          </h2>

          <p className="m-0 mt-0.5 text-[11px] leading-[17px] text-[#7a8695]">
            Recent payments and billing
            transactions for {company.name}.
          </p>
        </div>

        {payments.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-[22px]">
            <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-[#f2f4f7] font-extrabold text-[#667085]">
              $
            </div>

            <div>
              <strong className="block text-[11px] leading-4 text-[#344054]">
                No payments yet
              </strong>

              <p className="m-0 mt-0.5 text-[10px] leading-[15px] text-[#8a95a3]">
                Your payment history will appear
                here once a transaction is
                processed.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-[#e1e7ee] bg-[#f8fafc] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.04em] text-[#8a95a3]">
                    Date
                  </th>

                  <th className="border-b border-[#e1e7ee] bg-[#f8fafc] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.04em] text-[#8a95a3]">
                    Type
                  </th>

                  <th className="border-b border-[#e1e7ee] bg-[#f8fafc] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.04em] text-[#8a95a3]">
                    Provider
                  </th>

                  <th className="border-b border-[#e1e7ee] bg-[#f8fafc] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.04em] text-[#8a95a3]">
                    Transaction
                  </th>

                  <th className="border-b border-[#e1e7ee] bg-[#f8fafc] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.04em] text-[#8a95a3]">
                    Status
                  </th>

                  <th className="border-b border-[#e1e7ee] bg-[#f8fafc] px-4 py-2.5 text-right text-[9px] font-bold uppercase tracking-[0.04em] text-[#8a95a3]">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="border-b border-[#edf0f4] px-4 py-[13px] align-middle text-[10px] leading-[15px] text-[#596678]">
                      <div>
                        <strong className="block font-semibold text-[#344054]">
                          {formatDate(
                            payment.paid_at ||
                              payment.created_at
                          )}
                        </strong>

                        <span className="mt-px block text-[9px] text-[#98a2b3]">
                          {formatDateTime(
                            payment.paid_at ||
                              payment.created_at
                          )}
                        </span>
                      </div>
                    </td>

                    <td className="border-b border-[#edf0f4] px-4 py-[13px] align-middle text-[10px] leading-[15px] text-[#596678]">
                      {getDisplayStatus(
                        payment.payment_type
                      )}
                    </td>

                    <td className="border-b border-[#edf0f4] px-4 py-[13px] align-middle text-[10px] capitalize leading-[15px] text-[#596678]">
                      {payment.provider}
                    </td>

                    <td className="border-b border-[#edf0f4] px-4 py-[13px] align-middle text-[10px] leading-[15px] text-[#596678]">
                      <span className="inline-block max-w-[170px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9px] text-[#667085]">
                        {payment.provider_transaction_id ||
                          payment.provider_order_id ||
                          "—"}
                      </span>
                    </td>

                    <td className="border-b border-[#edf0f4] px-4 py-[13px] align-middle">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold leading-[13px] whitespace-nowrap ${getStatusClass(
                          payment.status
                        )}`}
                      >
                        <span className="h-[5px] w-[5px] rounded-full bg-current" />

                        {getDisplayStatus(
                          payment.status
                        )}
                      </span>
                    </td>

                    <td className="border-b border-[#edf0f4] px-4 py-[13px] text-right align-middle text-[10px] font-bold leading-[15px] text-[#172033]">
                      {formatCurrency(
                        Number(payment.amount),
                        payment.currency
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BillingDetail({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="border-b border-[#edf0f4] p-[15px_20px] min-[621px]:odd:border-r">
      <span className="mb-1 block text-[9px] font-semibold uppercase leading-[14px] tracking-[0.05em] text-[#8a95a3]">
        {label}
      </span>

      <strong
        className={`block break-words text-[11px] font-semibold leading-[17px] text-[#253142] ${
          capitalize ? "capitalize" : ""
        }`}
      >
        {value}
      </strong>
    </div>
  );
}

function PlanCard({
  name,
  description,
  price,
  billingCycle,
  features,
  popular,
  isCurrent,
  loading,
  onSelect,
}: {
  name: string;
  description: string;
  price: number;
  billingCycle: "monthly" | "yearly";
  features: string[];
  popular?: boolean;
  isCurrent: boolean;
  loading: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`relative flex min-w-0 flex-col rounded-[14px] border bg-white p-[19px] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#d0d8e2] hover:shadow-[0_8px_24px_rgba(16,24,40,0.06)] ${
        isCurrent
          ? "border-[#172033] shadow-[0_0_0_1px_#172033]"
          : "border-[#e1e7ee]"
      }`}
    >
      {popular && (
        <span className="absolute right-3 top-3 rounded-full bg-[#eef1f6] px-[7px] py-1 text-[8px] font-bold uppercase leading-[11px] tracking-[0.05em] text-[#172033]">
          Popular
        </span>
      )}

      <h3 className="m-0 text-[15px] font-bold leading-[21px] text-[#17202b]">
        {name}
      </h3>

      <p className="mt-1 min-h-[34px] text-[10px] leading-4 text-[#7a8695]">
        {description}
      </p>

      <div className="my-[18px] flex items-baseline gap-[3px]">
        <strong className="text-[25px] font-extrabold leading-[30px] tracking-[-0.03em] text-[#172033]">
          ${price.toLocaleString("en-US")}
        </strong>

        <span className="text-[9px] text-[#8a95a3]">
          /{billingCycle === "monthly"
            ? "month"
            : "year"}
        </span>
      </div>

      <ul className="mb-[19px] flex flex-1 list-none flex-col gap-2 p-0">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-[7px] text-[10px] leading-[15px] text-[#596678]"
          >
            <span className="font-extrabold text-[#15803d]">
              ✓
            </span>

            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={`h-[37px] w-full rounded-[9px] border text-[10px] font-bold transition-colors ${
          isCurrent
            ? "cursor-not-allowed border-[#e1e7ee] bg-[#f2f4f7] text-[#7a8695]"
            : "border-[#172033] bg-[#172033] text-white hover:bg-[#273249] disabled:cursor-not-allowed disabled:opacity-55"
        }`}
        disabled={isCurrent || loading}
        onClick={onSelect}
      >
        {loading
          ? "Opening PayPal..."
          : isCurrent
            ? "Current Plan"
            : "Subscribe with PayPal"}
      </button>
    </div>
  );
}