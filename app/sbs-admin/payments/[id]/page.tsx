import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  FileText,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

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
  metadata: Record<
    string,
    unknown
  >;
  created_at: string;
  updated_at: string;
};

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
};

type Subscription = {
  id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

type Plan = {
  id: string;
  name: string;
  slug: string;
  currency: string;
};

function formatCurrency(
  amount: number,
  currency = "USD",
) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(
  value: string | null,
) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStatus(
  status: string | null,
) {
  if (!status) return "Unknown";

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function getStatusStyles(
  status: string,
) {
  switch (status) {
    case "completed":
    case "paid":
    case "succeeded":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";

    case "pending":
    case "processing":
      return "bg-blue-50 text-blue-700 ring-blue-600/10";

    case "failed":
      return "bg-red-50 text-red-700 ring-red-600/10";

    case "refunded":
    case "partially_refunded":
      return "bg-violet-50 text-violet-700 ring-violet-600/10";

    default:
      return "bg-slate-100 text-slate-600 ring-slate-500/10";
  }
}

export default async function AdminPaymentDetailsPage({
  params,
}: PageProps) {
  await requirePlatformAdmin();

  const { id } = await params;

  const supabase = await createClient();

  const { data: paymentData, error } =
    await supabase
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
          metadata,
          created_at,
          updated_at
        `,
      )
      .eq("id", id)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!paymentData) {
    return (
      <div className="min-h-full bg-[#f3f5f8]">
        <div className="flex min-h-[500px] items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <CreditCard className="mx-auto h-10 w-10 text-slate-300" />

            <h1 className="mt-4 text-lg font-semibold text-slate-900">
              Payment not found
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              The payment may have been
              deleted or the ID is invalid.
            </p>

            <Link
              href="/sbs-admin/payments"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Payments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const payment =
    paymentData as Payment;

  const [
    companyResult,
    subscriptionResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(
        `
          id,
          name,
          email,
          phone,
          country
        `,
      )
      .eq("id", payment.company_id)
      .maybeSingle(),

    payment.subscription_id
      ? supabase
          .from("subscriptions")
          .select(
            `
              id,
              plan_id,
              status,
              billing_cycle,
              amount,
              currency,
              provider,
              provider_customer_id,
              provider_subscription_id,
              current_period_start,
              current_period_end
            `,
          )
          .eq(
            "id",
            payment.subscription_id,
          )
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),
  ]);

  if (companyResult.error) {
    throw new Error(
      companyResult.error.message,
    );
  }

  if (subscriptionResult.error) {
    throw new Error(
      subscriptionResult.error.message,
    );
  }

  const company =
    companyResult.data as Company | null;

  const subscription =
    subscriptionResult.data as Subscription | null;

  let plan: Plan | null = null;

  if (subscription?.plan_id) {
    const planResult =
      await supabase
        .from("plans")
        .select(
          `
            id,
            name,
            slug,
            currency
          `,
        )
        .eq(
          "id",
          subscription.plan_id,
        )
        .maybeSingle();

    if (planResult.error) {
      throw new Error(
        planResult.error.message,
      );
    }

    plan =
      planResult.data as Plan | null;
  }

  const isSuccessful = [
    "completed",
    "paid",
    "succeeded",
  ].includes(payment.status);

  const isPending = [
    "pending",
    "processing",
  ].includes(payment.status);

  const isFailed =
    payment.status === "failed";

  const isRefunded = [
    "refunded",
    "partially_refunded",
  ].includes(payment.status);

  return (
    <div className="min-h-full bg-[#f3f5f8]">
      {/* HEADER */}
      <div className="border-b border-slate-200 pb-7">
        <Link
          href="/sbs-admin/payments"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Payments
        </Link>

        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <CreditCard className="h-4 w-4" />
              Payment Details
            </div>

            <h1 className="mt-2 font-mono text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {payment.id}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Created{" "}
              {formatDate(
                payment.created_at,
              )}
            </p>
          </div>

          <span
            className={`inline-flex w-fit rounded-xl px-4 py-2 text-sm font-bold ring-1 ring-inset ${getStatusStyles(
              payment.status,
            )}`}
          >
            {formatStatus(
              payment.status,
            )}
          </span>
        </div>
      </div>

      {/* PAYMENT HERO */}
      <div className="mt-7 grid gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Amount"
          value={formatCurrency(
            Number(payment.amount),
            payment.currency,
          )}
          icon={
            <CreditCard className="h-5 w-5" />
          }
        />

        <SummaryCard
          label="Provider"
          value={payment.provider}
          icon={
            <DollarSignIcon />
          }
        />

        <SummaryCard
          label="Payment Type"
          value={payment.payment_type.replace(
            /_/g,
            " ",
          )}
          icon={
            <FileText className="h-5 w-5" />
          }
        />

        <SummaryCard
          label="Payment Date"
          value={formatDate(
            payment.paid_at,
          )}
          icon={
            isSuccessful ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : isPending ? (
              <Clock3 className="h-5 w-5" />
            ) : isFailed ? (
              <XCircle className="h-5 w-5" />
            ) : (
              <RotateCcw className="h-5 w-5" />
            )
          }
        />
      </div>

      {/* MAIN CONTENT */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          {/* PAYMENT INFORMATION */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Payment Information"
              description="Core payment and gateway information."
            />

            <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
              <InfoCell
                label="Payment ID"
                value={payment.id}
                mono
              />

              <InfoCell
                label="Provider"
                value={payment.provider}
                capitalize
              />

              <InfoCell
                label="Provider Transaction ID"
                value={
                  payment.provider_transaction_id ||
                  "—"
                }
                mono
              />

              <InfoCell
                label="Provider Order ID"
                value={
                  payment.provider_order_id ||
                  "—"
                }
                mono
              />

              <InfoCell
                label="Payment Method"
                value={
                  payment.payment_method ||
                  "—"
                }
                capitalize
              />

              <InfoCell
                label="Payment Type"
                value={payment.payment_type.replace(
                  /_/g,
                  " ",
                )}
                capitalize
              />

              <InfoCell
                label="Currency"
                value={payment.currency}
              />

              <InfoCell
                label="Amount"
                value={formatCurrency(
                  Number(payment.amount),
                  payment.currency,
                )}
                strong
              />
            </div>
          </section>

          {/* COMPANY */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Company"
              description="The SBS company associated with this payment."
            />

            <div className="p-5 sm:p-6">
              {company ? (
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                      {company.name
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {company.name}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {company.email ||
                          "No email"}
                      </div>

                      <div className="mt-0.5 text-xs text-slate-400">
                        {company.phone ||
                          company.country ||
                          "No additional contact information"}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/sbs-admin/companies/${company.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <Building2 className="h-4 w-4" />
                    View Company
                  </Link>
                </div>
              ) : (
                <div className="text-sm text-slate-400">
                  Company information is
                  unavailable.
                </div>
              )}
            </div>
          </section>

          {/* SUBSCRIPTION */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Subscription"
              description="Subscription associated with this payment."
            />

            {subscription ? (
              <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
                <InfoCell
                  label="Plan"
                  value={
                    plan?.name ||
                    "Unknown plan"
                  }
                />

                <InfoCell
                  label="Subscription Status"
                  value={formatStatus(
                    subscription.status,
                  )}
                />

                <InfoCell
                  label="Billing Cycle"
                  value={subscription.billing_cycle}
                  capitalize
                />

                <InfoCell
                  label="Subscription Amount"
                  value={formatCurrency(
                    Number(
                      subscription.amount,
                    ),
                    subscription.currency,
                  )}
                  strong
                />

                <InfoCell
                  label="Provider"
                  value={
                    subscription.provider ||
                    "—"
                  }
                  capitalize
                />

                <InfoCell
                  label="Provider Subscription ID"
                  value={
                    subscription.provider_subscription_id ||
                    "—"
                  }
                  mono
                />

                <InfoCell
                  label="Current Period Start"
                  value={formatDate(
                    subscription.current_period_start,
                  )}
                />

                <InfoCell
                  label="Current Period End"
                  value={formatDate(
                    subscription.current_period_end,
                  )}
                />
              </div>
            ) : (
              <div className="p-6 text-sm text-slate-400">
                No subscription is associated
                with this payment.
              </div>
            )}
          </section>

          {/* FAILURE / REFUND */}
          {(payment.failure_reason ||
            payment.refunded_at) && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                title={
                  payment.refunded_at
                    ? "Refund Information"
                    : "Failure Information"
                }
                description={
                  payment.refunded_at
                    ? "Refund details recorded against this payment."
                    : "Reason recorded for the failed payment."
                }
              />

              <div className="p-5 sm:p-6">
                {payment.failure_reason ? (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Failure Reason
                    </div>

                    <div className="mt-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                      {
                        payment.failure_reason
                      }
                    </div>
                  </div>
                ) : null}

                {payment.refunded_at ? (
                  <div
                    className={
                      payment.failure_reason
                        ? "mt-5"
                        : ""
                    }
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Refunded At
                    </div>

                    <div className="mt-2 text-sm font-semibold text-violet-700">
                      {formatDate(
                        payment.refunded_at,
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* TIMELINE */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Payment Timeline"
              description="Recorded payment lifecycle."
            />

            <div className="space-y-5 p-5">
              <TimelineItem
                title="Payment created"
                value={formatDate(
                  payment.created_at,
                )}
                active
              />

              {payment.paid_at ? (
                <TimelineItem
                  title="Payment completed"
                  value={formatDate(
                    payment.paid_at,
                  )}
                  active
                  success
                />
              ) : null}

              {payment.refunded_at ? (
                <TimelineItem
                  title="Payment refunded"
                  value={formatDate(
                    payment.refunded_at,
                  )}
                  active
                  refund
                />
              ) : null}

              <TimelineItem
                title="Last updated"
                value={formatDate(
                  payment.updated_at,
                )}
              />
            </div>
          </section>

          {/* PROVIDER */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Provider Details"
              description="Gateway identifiers and metadata."
            />

            <div className="p-5">
              <DetailRow
                label="Provider"
                value={payment.provider}
              />

              <DetailRow
                label="Transaction"
                value={
                  payment.provider_transaction_id ||
                  "—"
                }
                mono
              />

              <DetailRow
                label="Order"
                value={
                  payment.provider_order_id ||
                  "—"
                }
                mono
              />

              <div className="mt-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Metadata
                </div>

                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-[10px] leading-5 text-slate-300">
                  {JSON.stringify(
                    payment.metadata,
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
          </section>

          {/* ACTIONS */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Related Records"
              description="Navigate to associated SBS records."
            />

            <div className="space-y-1 p-3">
              {company ? (
                <RelatedLink
                  href={`/sbs-admin/companies/${company.id}`}
                  icon={
                    <Building2 className="h-4 w-4" />
                  }
                  title="View Company"
                />
              ) : null}

              {subscription ? (
                <RelatedLink
                  href={`/sbs-admin/subscriptions/${subscription.id}`}
                  icon={
                    <CreditCard className="h-4 w-4" />
                  }
                  title="View Subscription"
                />
              ) : null}

              <RelatedLink
                href="/sbs-admin/payments"
                icon={
                  <ArrowLeft className="h-4 w-4" />
                }
                title="Back to Payments"
              />

              {payment.provider_transaction_id ? (
                <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-xs text-slate-400">
                  <ExternalLink className="h-4 w-4" />

                  Provider transaction is stored
                  for gateway reconciliation.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        {icon}
      </div>

      <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
        {label}
      </div>

      <div className="mt-2 truncate text-lg font-bold text-slate-950">
        {value}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
      <h2 className="text-sm font-semibold text-slate-900">
        {title}
      </h2>

      <p className="mt-1 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

function InfoCell({
  label,
  value,
  mono = false,
  strong = false,
  capitalize = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="bg-white p-5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>

      <div
        className={[
          "mt-2 break-all text-sm",
          strong
            ? "font-bold text-slate-900"
            : "font-medium text-slate-700",
          mono
            ? "font-mono text-xs"
            : "",
          capitalize
            ? "capitalize"
            : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span
        className={[
          "max-w-[65%] break-all text-right text-xs font-semibold text-slate-700",
          mono ? "font-mono" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function TimelineItem({
  title,
  value,
  active = false,
  success = false,
  refund = false,
}: {
  title: string;
  value: string;
  active?: boolean;
  success?: boolean;
  refund?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={[
          "mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          success
            ? "bg-emerald-50 text-emerald-600"
            : refund
              ? "bg-violet-50 text-violet-600"
              : active
                ? "bg-blue-50 text-blue-600"
                : "bg-slate-100 text-slate-400",
        ].join(" ")}
      >
        {success ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : refund ? (
          <RotateCcw className="h-3.5 w-3.5" />
        ) : (
          <Clock3 className="h-3.5 w-3.5" />
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-700">
          {title}
        </div>

        <div className="mt-1 text-[11px] text-slate-400">
          {value}
        </div>
      </div>
    </div>
  );
}

function RelatedLink({
  href,
  icon,
  title,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-emerald-50 group-hover:text-emerald-600">
        {icon}
      </div>

      <span className="text-xs font-semibold text-slate-700">
        {title}
      </span>

      <ExternalLink className="ml-auto h-3.5 w-3.5 text-slate-300 transition group-hover:text-slate-500" />
    </Link>
  );
}

function DollarSignIcon() {
  return (
    <span className="text-sm font-bold">
      $
    </span>
  );
}