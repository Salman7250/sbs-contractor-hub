import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

type Plan = {
  id: string;
  name: string;
  slug: string;

  monthly_price:
    | number
    | null;

  yearly_price:
    | number
    | null;

  is_active: boolean;
};

const descriptions: Record<
  string,
  string
> = {
  starter:
    "Essential tools for small businesses getting started with SBS.",

  professional:
    "Advanced business management tools for growing companies.",

  business:
    "Complete business operations platform for established companies.",

  enterprise:
    "Custom SBS deployment with advanced access and support.",
};

const moduleCounts: Record<
  string,
  number
> = {
  starter: 4,
  professional: 8,
  business: 12,
  enterprise: 999,
};

const popularPlans = new Set([
  "professional",
]);

export default async function AdminPlansPage() {
  await requirePlatformAdmin();

  const supabase =
    await createClient();

  const {
    data: plans,
    error,
  } = await supabase
    .from("plans")
    .select(
      `
        id,
        name,
        slug,
        monthly_price,
        yearly_price,
        is_active
      `
    )
    .order(
      "monthly_price",
      {
        ascending: true,
        nullsFirst: false,
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to load plans."
    );
  }

  const activePlans =
    (plans ?? []).filter(
      (plan) =>
        plan.is_active === true
    );

  /*
   * Get the number of companies
   * subscribed to each plan.
   */
  const planIds =
    activePlans.map(
      (plan) => plan.id
    );

  let subscriptions:
    | Array<{
        plan_id: string;
        company_id: string;
      }>
    | null = null;

  if (planIds.length > 0) {
    const {
      data: subscriptionRows,
    } = await supabase
      .from("subscriptions")
      .select(
        "plan_id, company_id"
      )
      .in(
        "plan_id",
        planIds
      )
      .in(
        "status",
        [
          "trialing",
          "active",
          "past_due",
          "paused",
        ]
      );

    subscriptions =
      subscriptionRows;
  }

  const companyCounts =
    new Map<string, number>();

  for (const subscription of
    subscriptions ?? []) {
    companyCounts.set(
      subscription.plan_id,
      (companyCounts.get(
        subscription.plan_id
      ) ?? 0) + 1
    );
  }

  const totalCompanies =
    Array.from(
      companyCounts.values()
    ).reduce(
      (total, count) =>
        total + count,
      0
    );

  const pricedPlans =
    activePlans.filter(
      (plan) =>
        plan.monthly_price !==
        null
    );

  const averagePrice =
    pricedPlans.length > 0
      ? pricedPlans.reduce(
          (total, plan) =>
            total +
            Number(
              plan.monthly_price ??
                0
            ),
          0
        ) /
        pricedPlans.length
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Platform Management
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Plans & Pricing
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Configure the SaaS plans that
            determine pricing, module access,
            limits, and subscription options
            for SBS customers.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 opacity-50"
        >
          + Create Plan
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PlanStat
          label="Total Plans"
          value={activePlans.length}
          icon="◈"
        />

        <PlanStat
          label="Active Plans"
          value={
            activePlans.filter(
              (plan) =>
                plan.is_active
            ).length
          }
          icon="✓"
        />

        <PlanStat
          label="Subscribed Companies"
          value={totalCompanies}
          icon="◫"
        />

        <PlanStat
          label="Avg. Monthly Price"
          value={`$${averagePrice.toFixed(
            0
          )}`}
          icon="$"
        />
      </div>

      {/* Pricing Cards */}
      <section>
        <div className="mb-5">
          <h2 className="font-semibold text-white">
            Available Plans
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Plans available for customer
            subscriptions.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {activePlans.map(
            (plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                companyCount={
                  companyCounts.get(
                    plan.id
                  ) ?? 0
                }
              />
            )
          )}
        </div>
      </section>

      {/* Plan Management Table */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-white">
              Plan Configuration
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Pricing and subscription
              configuration for each tier.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-xs text-slate-500">
            {activePlans.length} configured
            plans
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Plan
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Monthly
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Yearly
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Modules
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Companies
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>

                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {activePlans.map(
                (plan) => (
                  <tr
                    key={plan.id}
                    className="transition hover:bg-white/[0.025]"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white">
                          {plan.name.charAt(
                            0
                          )}
                        </div>

                        <div>
                          <div className="font-medium text-white">
                            {plan.name}
                          </div>

                          <div className="mt-1 font-mono text-[10px] text-slate-600">
                            {plan.slug}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      {plan.monthly_price !==
                      null ? (
                        <span className="text-sm text-slate-200">
                          $
                          {
                            plan.monthly_price
                          }

                          <span className="text-xs text-slate-600">
                            /mo
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">
                          Custom
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-5">
                      {plan.yearly_price !==
                      null ? (
                        <span className="text-sm text-slate-200">
                          $
                          {
                            plan.yearly_price
                          }

                          <span className="text-xs text-slate-600">
                            /yr
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">
                          Custom
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-5">
                      <span className="text-sm text-slate-300">
                        {getModuleCount(
                          plan.slug
                        )}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <span className="text-sm text-slate-300">
                        {companyCounts.get(
                          plan.id
                        ) ?? 0}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <StatusBadge
                        status={
                          plan.is_active
                            ? "active"
                            : "inactive"
                        }
                      />
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-600"
                        >
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing Architecture */}
      <section className="grid gap-5 lg:grid-cols-2">
        <ArchitectureCard
          icon="$"
          title="Centralized Pricing"
          description="SBS plan pricing is stored centrally so subscription pricing remains consistent across the platform."
        />

        <ArchitectureCard
          icon="◈"
          title="Module Entitlements"
          description="Each plan grants access to a defined set of SBS modules through the entitlement system."
        />
      </section>
    </div>
  );
}

function getModuleCount(
  slug: string
) {
  return moduleCounts[slug] ?? 0;
}

function getDescription(
  slug: string
) {
  return (
    descriptions[slug] ??
    "Sharif Business Solutions subscription plan."
  );
}

function PlanCard({
  plan,
  companyCount,
}: {
  plan: Plan;
  companyCount: number;
}) {
  const popular =
    popularPlans.has(
      plan.slug
    );

  const modules =
    getModuleCount(
      plan.slug
    );

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${
        popular
          ? "border-emerald-500/30 bg-emerald-500/[0.04]"
          : "border-white/10 bg-white/[0.03]"
      } p-6`}
    >
      {popular && (
        <div className="absolute right-4 top-4 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
          Popular
        </div>
      )}

      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white">
        {plan.name.charAt(
          0
        )}
      </div>

      <h3 className="mt-5 text-lg font-semibold text-white">
        {plan.name}
      </h3>

      <p className="mt-2 min-h-[48px] text-xs leading-5 text-slate-500">
        {getDescription(
          plan.slug
        )}
      </p>

      <div className="mt-6">
        {plan.monthly_price !==
        null ? (
          <>
            <span className="text-3xl font-bold tracking-tight text-white">
              $
              {
                plan.monthly_price
              }
            </span>

            <span className="ml-1 text-xs text-slate-600">
              /month
            </span>
          </>
        ) : (
          <span className="text-2xl font-bold text-white">
            Custom
          </span>
        )}
      </div>

      <div className="mt-2 text-xs text-slate-600">
        {plan.yearly_price !==
        null
          ? `$${plan.yearly_price} billed annually`
          : "Contact SBS for pricing"}
      </div>

      <div className="my-6 border-t border-white/10" />

      <div className="space-y-3">
        <FeatureRow
          label="Available modules"
          value={
            modules === 999
              ? "All modules"
              : `${modules}`
          }
        />

        <FeatureRow
          label="Companies"
          value={`${companyCount}`}
        />

        <FeatureRow
          label="Status"
          value={
            plan.is_active
              ? "active"
              : "inactive"
          }
        />
      </div>
    </div>
  );
}

function FeatureRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-slate-500">
        {label}
      </span>

      <span className="font-medium text-slate-300">
        {value}
      </span>
    </div>
  );
}

function PlanStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm text-slate-200">
        {icon}
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${
        status === "active"
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-slate-500/10 text-slate-400"
      }`}
    >
      {status}
    </span>
  );
}

function ArchitectureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm text-slate-300">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-white">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}