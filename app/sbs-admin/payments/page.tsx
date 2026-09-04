import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

type Payment = {
  id: string;
  company_id: string;
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
  companies:
    | {
        name: string;
      }
    | null;
  subscriptions:
    | {
        id: string;
        plan_id: string;
        plans:
          | {
              name: string;
            }
          | null;
      }
    | null;
};

export default async function AdminPaymentsPage() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("payments")
    .select(
      `
        id,
        company_id,
        subscription_id,
        provider,
        provider_transaction_id,
        provider_order_id,
        amount,
        currency,
        status,
        payment_type,
        payment_method,
        paid_at,
        refunded_at,
        failure_reason,
        created_at,
        companies (
          name
        ),
        subscriptions (
          id,
          plan_id,
          plans (
            name
          )
        )
      `
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error("Payments query error:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }

  const payments = (data ?? []) as unknown as Payment[];

  const successfulPayments = payments.filter(
    (payment) => payment.status === "succeeded"
  );

  const pendingPayments = payments.filter(
    (payment) => payment.status === "pending"
  );

  const failedPayments = payments.filter(
    (payment) => payment.status === "failed"
  );

  const refundedPayments = payments.filter(
    (payment) =>
      payment.status === "refunded" ||
      payment.status === "partially_refunded"
  );

  const totalRevenue = successfulPayments.reduce(
    (total, payment) =>
      total + Number(payment.amount || 0),
    0
  );

  const pendingAmount = pendingPayments.reduce(
    (total, payment) =>
      total + Number(payment.amount || 0),
    0
  );

  const failedAmount = failedPayments.reduce(
    (total, payment) =>
      total + Number(payment.amount || 0),
    0
  );

  const refundedAmount = refundedPayments.reduce(
    (total, payment) =>
      total + Number(payment.amount || 0),
    0
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Platform Management
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Payments
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Monitor customer payments, transaction status,
            revenue, refunds, and payment activity across SBS.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-600"
        >
          Export Transactions
        </button>
      </div>

      {/* Database Error */}
      {error && (
        <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-5">
          <div className="flex gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-sm text-red-400">
              !
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-red-300">
                Unable to load payment records
              </h3>

              <p className="mt-1 break-words text-xs leading-5 text-red-400/70">
                {error.message}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PaymentStat
          label="Successful Revenue"
          value={formatCurrency(totalRevenue)}
          icon="$"
        />

        <PaymentStat
          label="Successful Payments"
          value={successfulPayments.length}
          icon="✓"
        />

        <PaymentStat
          label="Pending Amount"
          value={formatCurrency(pendingAmount)}
          icon="◷"
          warning
        />

        <PaymentStat
          label="Failed Amount"
          value={formatCurrency(failedAmount)}
          icon="!"
          danger={failedAmount > 0}
        />
      </div>

      {/* Provider Status */}
      <section className="grid gap-5 lg:grid-cols-3">
        <ProviderCard
          name="Payment Provider"
          value="PayPal"
          description="PayPal is the planned payment provider for SBS subscriptions."
          icon="$"
        />

        <ProviderCard
          name="Webhooks"
          value="Not Configured"
          description="Secure PayPal webhook processing will be connected during the billing integration phase."
          icon="↻"
          warning
        />

        <ProviderCard
          name="Transaction Sync"
          value="Not Active"
          description="Transactions will synchronize automatically after PayPal billing is connected."
          icon="⇄"
          warning
        />
      </section>

      {/* Payment Overview */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          label="Total Transactions"
          value={payments.length}
        />

        <OverviewCard
          label="Refunded Transactions"
          value={refundedPayments.length}
        />

        <OverviewCard
          label="Refunded Amount"
          value={formatCurrency(refundedAmount)}
        />

        <OverviewCard
          label="PayPal Transactions"
          value={
            payments.filter(
              (payment) =>
                payment.provider.toLowerCase() ===
                "paypal"
            ).length
          }
        />
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
          <input
            type="text"
            disabled
            placeholder="Search transaction or company..."
            className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
          />

          <select
            disabled
            defaultValue="all"
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-500 outline-none"
          >
            <option value="all">
              All statuses
            </option>

            <option value="succeeded">
              Successful
            </option>

            <option value="pending">
              Pending
            </option>

            <option value="failed">
              Failed
            </option>

            <option value="refunded">
              Refunded
            </option>

            <option value="partially_refunded">
              Partially Refunded
            </option>

            <option value="canceled">
              Canceled
            </option>
          </select>

          <select
            disabled
            defaultValue="all"
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-500 outline-none"
          >
            <option value="all">
              All payment methods
            </option>

            <option value="paypal">
              PayPal
            </option>

            <option value="card">
              Card
            </option>

            <option value="bank">
              Bank
            </option>

            <option value="other">
              Other
            </option>
          </select>
        </div>
      </section>

      {/* Transactions */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="font-semibold text-white">
              Transactions
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Payment records stored by SBS.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-xs text-slate-500">
            {payments.length}{" "}
            {payments.length === 1
              ? "transaction"
              : "transactions"}
          </div>
        </div>

        {payments.length === 0 ? (
          <EmptyPayments />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Transaction
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Company
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Plan
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Amount
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Provider
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Payment Date
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="transition hover:bg-white/[0.025]"
                  >
                    <td className="px-6 py-5">
                      <div className="font-mono text-xs text-slate-300">
                        {shortId(payment.id)}
                      </div>

                      {payment.provider_transaction_id && (
                        <div className="mt-1 max-w-[180px] truncate font-mono text-[10px] text-slate-600">
                          {payment.provider_transaction_id}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-5">
                      <div className="font-medium text-white">
                        {payment.companies?.name ??
                          "Unknown Company"}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="text-sm text-slate-300">
                        {payment.subscriptions?.plans?.name ??
                          "—"}
                      </div>

                      <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">
                        {formatPaymentType(
                          payment.payment_type
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <span className="font-medium text-slate-200">
                        {formatMoney(
                          payment.amount,
                          payment.currency
                        )}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <div className="text-sm font-medium capitalize text-slate-300">
                        {payment.provider ||
                          "—"}
                      </div>

                      <div className="mt-1 text-xs text-slate-600">
                        {payment.payment_method ||
                          "Payment provider"}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <PaymentStatus
                        status={payment.status}
                      />
                    </td>

                    <td className="px-6 py-5">
                      <span className="text-sm text-slate-400">
                        {formatDate(
                          payment.paid_at ??
                            payment.created_at
                        )}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-right">
                      <button
                        type="button"
                        disabled
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-600"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Payment Architecture */}
      <section>
        <div className="mb-5">
          <h2 className="font-semibold text-white">
            Payment Architecture
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            The production lifecycle planned for SBS billing.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <FlowStep
            number="01"
            title="Checkout"
            description="Customer selects a subscription and starts PayPal checkout."
          />

          <FlowStep
            number="02"
            title="PayPal"
            description="PayPal processes and confirms the customer payment."
          />

          <FlowStep
            number="03"
            title="Webhook"
            description="SBS securely receives the PayPal payment event."
          />

          <FlowStep
            number="04"
            title="Record"
            description="SBS records the transaction and updates subscription state."
          />

          <FlowStep
            number="05"
            title="Entitlement"
            description="The company's module access is synchronized automatically."
          />
        </div>
      </section>

      {/* Notice */}
      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
        <div className="flex gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-sm text-amber-400">
            !
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-amber-300">
              PayPal billing is not connected yet
            </h3>

            <p className="mt-1 break-words text-xs leading-5 text-amber-400/60">
              The Payments interface is now connected to
              the SBS payment database. No real payment
              processing occurs until the PayPal checkout,
              API integration, webhook verification, and
              subscription billing flow are implemented.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatMoney(
  amount: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${
      currency || "USD"
    }`;
  }
}

function formatDate(date: string | null) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortId(id: string) {
  if (!id) return "—";

  return `${id.slice(0, 8)}...`;
}

function formatPaymentType(
  type: string
) {
  switch (type) {
    case "subscription":
      return "Subscription";

    case "one_time":
      return "One-time";

    case "refund":
      return "Refund";

    case "adjustment":
      return "Adjustment";

    default:
      return type || "Payment";
  }
}

function PaymentStat({
  label,
  value,
  icon,
  warning = false,
  danger = false,
}: {
  label: string;
  value: number | string;
  icon: string;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm text-slate-200">
          {icon}
        </div>

        <span
          className={`h-2 w-2 rounded-full ${
            danger
              ? "bg-red-400"
              : warning
                ? "bg-amber-400"
                : "bg-emerald-400"
          }`}
        />
      </div>

      <div className="mt-5">
        <div className="text-3xl font-bold tracking-tight text-white">
          {value}
        </div>

        <div className="mt-1 text-sm text-slate-500">
          {label}
        </div>
      </div>
    </div>
  );
}

function OverviewCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-600">
        {label}
      </div>

      <div className="mt-3 text-2xl font-bold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

function ProviderCard({
  name,
  value,
  description,
  icon,
  warning = false,
}: {
  name: string;
  value: string;
  description: string;
  icon: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm text-slate-300">
          {icon}
        </div>

        <span
          className={`h-2 w-2 rounded-full ${
            warning
              ? "bg-amber-400"
              : "bg-emerald-400"
          }`}
        />
      </div>

      <div className="mt-5 text-xs uppercase tracking-wider text-slate-600">
        {name}
      </div>

      <div
        className={`mt-2 text-lg font-semibold ${
          warning
            ? "text-amber-400"
            : "text-white"
        }`}
      >
        {value}
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function PaymentStatus({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    succeeded:
      "bg-emerald-500/10 text-emerald-400",

    pending:
      "bg-blue-500/10 text-blue-400",

    failed:
      "bg-red-500/10 text-red-400",

    refunded:
      "bg-purple-500/10 text-purple-400",

    partially_refunded:
      "bg-purple-500/10 text-purple-400",

    canceled:
      "bg-slate-500/10 text-slate-400",
  };

  const labels: Record<string, string> = {
    succeeded: "Successful",
    pending: "Pending",
    failed: "Failed",
    refunded: "Refunded",
    partially_refunded: "Partially Refunded",
    canceled: "Canceled",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-white/5 text-slate-400"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function EmptyPayments() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-lg text-slate-500">
        $
      </div>

      <h3 className="mt-5 text-sm font-semibold text-white">
        No payment transactions yet
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Real payment transactions will appear here after
        PayPal billing is connected and customers complete
        payments.
      </p>
    </div>
  );
}

function FlowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-[10px] font-bold tracking-[0.2em] text-emerald-400">
        {number}
      </div>

      <h3 className="mt-3 text-sm font-semibold text-white">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}