import { requirePlatformAdmin } from "@/lib/auth/platform-admin";

const discounts = [
  {
    id: "DISC-001",
    code: "WELCOME25",
    description: "25% off first subscription",
    type: "Percentage",
    value: "25%",
    appliesTo: "All Plans",
    status: "active",
    usage: "12 / 100",
    expires: "Oct 31, 2026",
  },
  {
    id: "DISC-002",
    code: "SBS50",
    description: "Special $50 discount",
    type: "Fixed Amount",
    value: "$50",
    appliesTo: "Professional",
    status: "active",
    usage: "4 / 25",
    expires: "Dec 31, 2026",
  },
  {
    id: "DISC-003",
    code: "EARLYBIRD",
    description: "Early customer discount",
    type: "Percentage",
    value: "15%",
    appliesTo: "All Plans",
    status: "active",
    usage: "18 / 50",
    expires: "Sep 30, 2026",
  },
  {
    id: "DISC-004",
    code: "SUMMER26",
    description: "Summer promotional discount",
    type: "Percentage",
    value: "20%",
    appliesTo: "Starter",
    status: "expired",
    usage: "31 / 50",
    expires: "Aug 31, 2026",
  },
  {
    id: "DISC-005",
    code: "PARTNER100",
    description: "Partner referral discount",
    type: "Fixed Amount",
    value: "$100",
    appliesTo: "Business",
    status: "disabled",
    usage: "7 / 20",
    expires: "Nov 30, 2026",
  },
];

const discountRules = [
  {
    title: "Percentage Discount",
    description:
      "Reduce the subscription price by a defined percentage.",
    example: "25% off",
    icon: "%",
  },
  {
    title: "Fixed Amount",
    description:
      "Subtract a fixed monetary amount from an eligible purchase.",
    example: "$50 off",
    icon: "$",
  },
  {
    title: "Plan Specific",
    description:
      "Restrict a discount to one or more specific subscription plans.",
    example: "Professional only",
    icon: "P",
  },
  {
    title: "Usage Limited",
    description:
      "Limit the number of times a promotional code can be redeemed.",
    example: "100 redemptions",
    icon: "#",
  },
];

export default async function AdminDiscountsPage() {
  await requirePlatformAdmin();

  const activeDiscounts = discounts.filter(
    (discount) => discount.status === "active"
  );

  const expiredDiscounts = discounts.filter(
    (discount) => discount.status === "expired"
  );

  const disabledDiscounts = discounts.filter(
    (discount) => discount.status === "disabled"
  );

  const totalUsage = discounts.reduce((total, discount) => {
    const current = Number(discount.usage.split("/")[0]);
    return total + current;
  }, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Revenue Management
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Discounts
          </h1>

          <p className="mt-2 max-w-3xl text-slate-400">
            Create and manage promotional codes, subscription
            discounts, partner offers, and limited-time pricing
            incentives across SBS.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700"
        >
          Create Discount
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DiscountStat
          label="Active Discounts"
          value={activeDiscounts.length}
          icon="%"
        />

        <DiscountStat
          label="Total Redemptions"
          value={totalUsage}
          icon="↗"
        />

        <DiscountStat
          label="Expired"
          value={expiredDiscounts.length}
          icon="◷"
          warning
        />

        <DiscountStat
          label="Disabled"
          value={disabledDiscounts.length}
          icon="×"
          danger
        />
      </div>

      {/* Discount Rules */}
      <section>
        <div className="mb-5">
          <h2 className="font-semibold text-white">
            Discount Types
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Supported promotional mechanisms for the SBS billing
            system.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {discountRules.map((rule) => (
            <div
              key={rule.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-slate-300">
                  {rule.icon}
                </div>

                <span className="text-[10px] uppercase tracking-wider text-slate-600">
                  Supported
                </span>
              </div>

              <h3 className="mt-5 text-sm font-semibold text-white">
                {rule.title}
              </h3>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {rule.description}
              </p>

              <div className="mt-4 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-400">
                Example:{" "}
                <span className="text-slate-300">
                  {rule.example}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
          <input
            type="text"
            disabled
            placeholder="Search discount code..."
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
            <option value="active">
              Active
            </option>
            <option value="expired">
              Expired
            </option>
            <option value="disabled">
              Disabled
            </option>
          </select>

          <select
            disabled
            defaultValue="all"
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-500 outline-none"
          >
            <option value="all">
              All types
            </option>
            <option value="percentage">
              Percentage
            </option>
            <option value="fixed">
              Fixed Amount
            </option>
          </select>
        </div>
      </section>

      {/* Discounts Table */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="font-semibold text-white">
              Promotional Codes
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Manage platform-wide discount campaigns.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-xs text-slate-500">
            {discounts.length} codes
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Code
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Description
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Discount
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Applies To
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Usage
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Expires
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>

                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {discounts.map((discount) => (
                <tr
                  key={discount.id}
                  className="transition hover:bg-white/[0.025]"
                >
                  <td className="px-6 py-5">
                    <div className="font-mono text-xs font-semibold text-emerald-400">
                      {discount.code}
                    </div>

                    <div className="mt-1 text-[10px] text-slate-600">
                      {discount.id}
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <span className="text-sm text-slate-300">
                      {discount.description}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <div className="font-semibold text-white">
                      {discount.value}
                    </div>

                    <div className="mt-1 text-[10px] text-slate-600">
                      {discount.type}
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <span className="text-sm text-slate-400">
                      {discount.appliesTo}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <span className="text-sm text-slate-300">
                      {discount.usage}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <span className="text-sm text-slate-400">
                      {discount.expires}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <DiscountStatus
                      status={discount.status}
                    />
                  </td>

                  <td className="px-6 py-5 text-right">
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-600"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Discount Logic */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-sm text-emerald-400">
            %
          </div>

          <h3 className="mt-5 font-semibold text-white">
            Discount Evaluation
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            During checkout, SBS should validate the promotional
            code against its status, expiration, usage limit,
            eligible plans, and other configured restrictions.
          </p>

          <div className="mt-5 rounded-xl border border-white/10 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-500">
            Code Valid
            <br />
            + Not Expired
            <br />
            + Usage Available
            <br />
            + Plan Eligible
            <br />
            = Discount Applied
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-sm text-amber-400">
            $
          </div>

          <h3 className="mt-5 font-semibold text-white">
            Revenue Protection
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Discounts should never be trusted from the browser.
            The server-side billing system must calculate and
            validate the final payable amount before charging the
            customer.
          </p>

          <div className="mt-5 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-4 text-xs leading-5 text-amber-400/60">
            Original Price → Discount Validation → Final Price →
            Payment Provider
          </div>
        </div>
      </section>

      {/* Notice */}
      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
        <div className="flex gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-sm text-amber-400">
            !
          </div>

          <div>
            <h3 className="text-sm font-semibold text-amber-300">
              Discount engine is not connected
            </h3>

            <p className="mt-1 text-xs leading-5 text-amber-400/60">
              The discount codes shown above are interface
              placeholders. No promotional codes are currently
              being applied to real customer billing. The
              production implementation will connect discounts
              with plans, subscriptions, checkout, payments,
              usage limits, and expiration rules.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function DiscountStat({
  label,
  value,
  icon,
  warning = false,
  danger = false,
}: {
  label: string;
  value: number;
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

function DiscountStatus({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400",
    expired: "bg-slate-500/10 text-slate-400",
    disabled: "bg-red-500/10 text-red-400",
  };

  const labels: Record<string, string> = {
    active: "Active",
    expired: "Expired",
    disabled: "Disabled",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] ?? "bg-white/5 text-slate-400"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}