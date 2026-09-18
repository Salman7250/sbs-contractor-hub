import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Database,
  DollarSign,
  Globe,
  Mail,
  MapPin,
  Package,
  Phone,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import CompanyAdminControls from "./company-admin-controls";

type PageProps = {
  params: Promise<{
    companyId: string;
  }>;
};

type Company = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  timezone: string | null;
  currency: string | null;
  status: string | null;
  business_type: string | null;
  tax_registration_number: string | null;
  trade_license_number: string | null;
  legal_registration_type: string | null;
  authority_name: string | null;
  created_at: string;
};

type Subscription = {
  id: string;
  company_id: string;
  plan_id: string | null;
  status: string | null;
  billing_cycle: string | null;
  amount: number | null;
  currency: string | null;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
};

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  currency: string | null;
  is_active: boolean | null;
  is_popular: boolean | null;
  sort_order: number | null;
};

type Module = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean | null;
};

type PlanModule = {
  plan_id: string;
  module_id: string;
};

type Entitlement = {
  company_id: string;
  module_id: string;
  access: string;
  source: string | null;
  expires_at: string | null;
  reason: string | null;
};

type PlanLimit = {
  plan_id: string;
  limit_key: string;
  limit_value: number | null;
  is_unlimited: boolean;
};

type CompanyLimitOverride = {
  company_id: string;
  limit_key: string;
  limit_value: number | null;
  is_unlimited: boolean;
  expires_at: string | null;
  reason: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}

function getTrialDaysRemaining(value: string) {
  return Math.max(
    0,
    Math.ceil(
      (new Date(value).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    ),
  );
}

function formatMoney(
  amount: number | null,
  currency = "USD",
) {
  if (
    amount === null ||
    amount === undefined
  ) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusClasses(
  status: string | null,
) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";

    case "trial":
    case "trialing":
      return "bg-blue-50 text-blue-700 ring-blue-600/10";

    case "suspended":
      return "bg-amber-50 text-amber-700 ring-amber-600/10";

    case "cancelled":
    case "canceled":
      return "bg-red-50 text-red-700 ring-red-600/10";

    default:
      return "bg-slate-100 text-slate-600 ring-slate-500/10";
  }
}

function subscriptionClasses(
  status: string | null,
) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";

    case "trialing":
      return "bg-blue-50 text-blue-700";

    case "past_due":
      return "bg-amber-50 text-amber-700";

    case "cancelled":
    case "canceled":
      return "bg-red-50 text-red-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function prettyStatus(
  status: string | null,
) {
  if (!status) return "Unknown";

  if (status === "trialing") {
    return "Trialing";
  }

  if (status === "past_due") {
    return "Past due";
  }

  if (
    status === "cancelled" ||
    status === "canceled"
  ) {
    return "Cancelled";
  }

  return (
    status.charAt(0).toUpperCase() +
    status.slice(1)
  );
}

function prettyLimitKey(key: string) {
  return key
    .replace(/_per_month/g, " / month")
    .replace(/_per_year/g, " / year")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "CO";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

export default async function CompanyControlCenter({
  params,
}: PageProps) {
  await requirePlatformAdmin();

  const { companyId } = await params;

  const supabase = await createClient();

  const [
    companyResult,
    subscriptionResult,
    plansResult,
    modulesResult,
    planModulesResult,
    entitlementsResult,
    planLimitsResult,
    overridesResult,
    membersResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(
        `
          id,
          name,
          slug,
          logo_url,
          email,
          phone,
          website,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          timezone,
          currency,
          status,
          business_type,
          tax_registration_number,
          trade_license_number,
          legal_registration_type,
          authority_name,
          created_at
        `,
      )
      .eq("id", companyId)
      .maybeSingle(),

    supabase
      .from("subscriptions")
      .select(
        `
          id,
          company_id,
          plan_id,
          status,
          billing_cycle,
          amount,
          currency,
          provider,
          provider_customer_id,
          provider_subscription_id,
          started_at,
          trial_ends_at,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          canceled_at
        `,
      )
      .eq("company_id", companyId)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("plans")
      .select(
        `
          id,
          name,
          slug,
          description,
          monthly_price,
          yearly_price,
          currency,
          is_active,
          is_popular,
          sort_order
        `,
      )
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from("modules")
      .select(
        `
          id,
          name,
          slug,
          description,
          is_active
        `,
      )
      .order("name"),

    supabase
      .from("plan_modules")
      .select(
        "plan_id, module_id",
      ),

    supabase
      .from("company_entitlements")
      .select(
        `
          company_id,
          module_id,
          access,
          source,
          expires_at,
          reason
        `,
      )
      .eq("company_id", companyId),

    supabase
      .from("plan_limits")
      .select(
        `
          plan_id,
          limit_key,
          limit_value,
          is_unlimited
        `,
      ),

    supabase
      .from("company_limit_overrides")
      .select(
        `
          company_id,
          limit_key,
          limit_value,
          is_unlimited,
          expires_at,
          reason
        `,
      )
      .eq("company_id", companyId),

    supabase
      .from("company_members")
      .select("id, company_id")
      .eq("company_id", companyId),
  ]);

  if (companyResult.error) {
    throw new Error(
      companyResult.error.message,
    );
  }

  if (!companyResult.data) {
    return (
      <div className="min-h-full bg-[#f3f5f8] p-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/sbs-admin/companies"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Companies
          </Link>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <Building2 className="mx-auto h-10 w-10 text-slate-300" />

            <h1 className="mt-4 text-xl font-bold text-slate-900">
              Company not found
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              The requested company does not
              exist or is no longer available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (subscriptionResult.error) {
    throw new Error(
      subscriptionResult.error.message,
    );
  }

  if (plansResult.error) {
    throw new Error(
      plansResult.error.message,
    );
  }

  if (modulesResult.error) {
    throw new Error(
      modulesResult.error.message,
    );
  }

  if (planModulesResult.error) {
    throw new Error(
      planModulesResult.error.message,
    );
  }

  if (entitlementsResult.error) {
    throw new Error(
      entitlementsResult.error.message,
    );
  }

  if (planLimitsResult.error) {
    throw new Error(
      planLimitsResult.error.message,
    );
  }

  if (overridesResult.error) {
    throw new Error(
      overridesResult.error.message,
    );
  }

  if (membersResult.error) {
    throw new Error(
      membersResult.error.message,
    );
  }

  const company =
    companyResult.data as Company;

  const subscriptions =
    (subscriptionResult.data ??
      []) as Subscription[];

  const plans =
    (plansResult.data ?? []) as Plan[];

  const modules =
    (modulesResult.data ??
      []) as Module[];

  const planModules =
    (planModulesResult.data ??
      []) as PlanModule[];

  const entitlements =
    (entitlementsResult.data ??
      []) as Entitlement[];

  const planLimits =
    (planLimitsResult.data ??
      []) as PlanLimit[];

  const overrides =
    (overridesResult.data ??
      []) as CompanyLimitOverride[];

  const memberCount =
    membersResult.data?.length ?? 0;

  const subscription =
    subscriptions.find(
      (item) =>
        item.status === "active" ||
        item.status === "trialing",
    ) ??
    subscriptions[0] ??
    null;

  const currentPlan = subscription?.plan_id
    ? plans.find(
        (plan) =>
          plan.id ===
          subscription.plan_id,
      ) ?? null
    : null;

  const currentPlanModules = currentPlan
    ? new Set(
        planModules
          .filter(
            (item) =>
              item.plan_id ===
              currentPlan.id,
          )
          .map(
            (item) =>
              item.module_id,
          ),
      )
    : new Set<string>();

  const entitlementMap = new Map(
    entitlements.map((item) => [
      item.module_id,
      item,
    ]),
  );

  const enabledModules =
    modules.filter((module) => {
      const entitlement =
        entitlementMap.get(
          module.id,
        );

      if (entitlement) {
        return (
          entitlement.access ===
          "enabled"
        );
      }

      return currentPlanModules.has(
        module.id,
      );
    });

  const activeModuleCount =
    enabledModules.length;

  const moduleRows = modules.map(
    (module) => {
      const entitlement =
        entitlementMap.get(
          module.id,
        );

      const includedInPlan =
        currentPlanModules.has(
          module.id,
        );

      const enabled = entitlement
        ? entitlement.access ===
          "enabled"
        : includedInPlan;

      const isOverride =
        Boolean(
          entitlement &&
            entitlement.source &&
            entitlement.source !==
              "subscription" &&
            entitlement.source !==
              "plan",
        );

      return {
        module,
        includedInPlan,
        enabled,
        entitlement,
        isOverride,
      };
    },
  );

  const limitMap = new Map(
    planLimits
      .filter(
        (limit) =>
          !currentPlan ||
          limit.plan_id ===
            currentPlan.id,
      )
      .map((limit) => [
        limit.limit_key,
        limit,
      ]),
  );

  const overrideMap = new Map(
    overrides.map((override) => [
      override.limit_key,
      override,
    ]),
  );

  const allLimitKeys =
    Array.from(
      new Set([
        ...limitMap.keys(),
        ...overrideMap.keys(),
      ]),
    ).sort();

  const effectiveLimits =
    allLimitKeys.map(
      (limitKey) => {
        const base =
          limitMap.get(
            limitKey,
          );

        const override =
          overrideMap.get(
            limitKey,
          );

        const effective =
          override ?? base;

        return {
          key: limitKey,
          base,
          override,
          effective,
        };
      },
    );

  const isTrial =
    company.status === "trial" ||
    subscription?.status ===
      "trialing";

  const trialDaysRemaining =
    subscription?.trial_ends_at
      ? getTrialDaysRemaining(
          subscription.trial_ends_at,
        )
      : null;

  const activePlans = plans
    .filter(
      (plan) =>
        plan.is_active !== false,
    )
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) -
        (b.sort_order ?? 0),
    );

  return (
    <div className="min-h-full bg-[#f3f5f8]">
      {/* Back */}
      <div className="mb-6">
        <Link
          href="/sbs-admin/companies"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Companies
        </Link>
      </div>

      {/* =====================================================
          COMPANY HEADER
          ===================================================== */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-6 lg:px-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="h-16 w-16 rounded-2xl border border-slate-200 object-contain p-2"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white">
                  {getInitials(
                    company.name,
                  )}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                    {company.name}
                  </h1>

                  <span
                    className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusClasses(
                      company.status,
                    )}`}
                  >
                    {company.status ||
                      "Unknown"}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span>
                    {company.slug ||
                      "No slug"}
                  </span>

                  <span className="hidden text-slate-300 sm:inline">
                    •
                  </span>

                  <span>
                    Joined{" "}
                    {formatDate(
                      company.created_at,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <CompanyAdminControls
              companyId={
                company.id
              }
              companyName={
                company.name
              }
              companyStatus={
                company.status
              }
              subscription={
                subscription
                  ? {
                      id: subscription.id,
                      status:
                        subscription.status,
                      billing_cycle:
                        subscription.billing_cycle,
                      trial_ends_at:
                        subscription.trial_ends_at,
                    }
                  : null
              }
              plans={activePlans}
              modules={modules}
              moduleRows={moduleRows.map(
                (row) => ({
                  module: row.module,
                  enabled:
                    row.enabled,
                  includedInPlan:
                    row.includedInPlan,
                  isOverride:
                    row.isOverride,
                  reason:
                    row.entitlement
                      ?.reason ??
                    null,
                }),
              )}
              limitRows={effectiveLimits.map(
                (row) => ({
                  key: row.key,
                  base: row.base
                    ? {
                        limit_value:
                          row.base
                            .limit_value,
                        is_unlimited:
                          row.base
                            .is_unlimited,
                      }
                    : null,
                  override:
                    row.override
                      ? {
                          limit_value:
                            row.override
                              .limit_value,
                          is_unlimited:
                            row.override
                              .is_unlimited,
                        }
                      : null,
                }),
              )}
            />
          </div>
        </div>

        <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <HeaderMetric
            icon={
              <CreditCard className="h-4 w-4" />
            }
            label="Current Plan"
            value={
              currentPlan?.name ??
              "No plan"
            }
          />

          <HeaderMetric
            icon={
              <Users className="h-4 w-4" />
            }
            label="Users"
            value={memberCount.toString()}
          />

          <HeaderMetric
            icon={
              <Package className="h-4 w-4" />
            }
            label="Active Modules"
            value={`${activeModuleCount} / ${modules.length}`}
          />

          <HeaderMetric
            icon={
              <DollarSignIcon />
            }
            label="Monthly Value"
            value={
              subscription?.amount !=
              null
                ? formatMoney(
                    subscription.amount,
                    subscription.currency ||
                      currentPlan?.currency ||
                      "USD",
                  )
                : "—"
            }
          />
        </div>
      </section>

      {/* =====================================================
          OVERVIEW
          ===================================================== */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section
          id="company-information"
          className="rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <SectionHeader
            icon={
              <Building2 className="h-5 w-5" />
            }
            title="Company Information"
            description="Business identity and contact information."
          />

          <div className="grid gap-x-8 gap-y-6 p-6 sm:grid-cols-2">
            <InfoItem
              icon={
                <Building2 className="h-4 w-4" />
              }
              label="Business Name"
              value={company.name}
            />

            <InfoItem
              icon={
                <Globe className="h-4 w-4" />
              }
              label="Website"
              value={company.website}
            />

            <InfoItem
              icon={
                <Mail className="h-4 w-4" />
              }
              label="Business Email"
              value={company.email}
            />

            <InfoItem
              icon={
                <Phone className="h-4 w-4" />
              }
              label="Phone"
              value={company.phone}
            />

            <InfoItem
              icon={
                <Package className="h-4 w-4" />
              }
              label="Business Type"
              value={
                company.business_type
                  ? company.business_type ===
                    "product"
                    ? "Product Business"
                    : "Service Business"
                  : null
              }
            />

            <InfoItem
              icon={
                <Globe className="h-4 w-4" />
              }
              label="Timezone"
              value={
                company.timezone
              }
            />

            <InfoItem
              icon={
                <MapPin className="h-4 w-4" />
              }
              label="Address"
              value={[
                company.address_line1,
                company.address_line2,
                company.city,
                company.state,
                company.postal_code,
                company.country,
              ]
                .filter(Boolean)
                .join(", ")}
              wide
            />

            <InfoItem
              icon={
                <Shield className="h-4 w-4" />
              }
              label="Tax Registration Number"
              value={
                company.tax_registration_number
              }
            />

            <InfoItem
              icon={
                <Shield className="h-4 w-4" />
              }
              label="Trade License Number"
              value={
                company.trade_license_number
              }
            />

            <InfoItem
              icon={
                <Building2 className="h-4 w-4" />
              }
              label="Legal Registration"
              value={
                company.legal_registration_type
              }
            />

            <InfoItem
              icon={
                <Building2 className="h-4 w-4" />
              }
              label="Authority"
              value={
                company.authority_name
              }
            />
          </div>
        </section>

        {/* ===================================================
            SUBSCRIPTION
            =================================================== */}
        <section
          id="subscription"
          className="rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <SectionHeader
            icon={
              <CreditCard className="h-5 w-5" />
            }
            title="Subscription"
            description="Current billing and subscription state."
          />

          <div className="space-y-5 p-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Current Plan
                  </div>

                  <div className="mt-1 text-xl font-bold text-slate-950">
                    {currentPlan?.name ??
                      "No plan assigned"}
                  </div>
                </div>

                {subscription ? (
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${subscriptionClasses(
                      subscription.status,
                    )}`}
                  >
                    {prettyStatus(
                      subscription.status,
                    )}
                  </span>
                ) : null}
              </div>

              {currentPlan ? (
                <div className="mt-3 text-sm text-slate-500">
                  {formatMoney(
                    subscription?.amount ??
                      (subscription?.billing_cycle ===
                      "yearly"
                        ? currentPlan.yearly_price
                        : currentPlan.monthly_price),
                    subscription?.currency ||
                      currentPlan.currency ||
                      "USD",
                  )}

                  {subscription?.billing_cycle ===
                  "yearly"
                    ? " / year"
                    : " / month"}
                </div>
              ) : null}
            </div>

            <SubscriptionRow
              label="Billing Cycle"
              value={
                subscription?.billing_cycle
                  ? subscription.billing_cycle
                      .charAt(0)
                      .toUpperCase() +
                    subscription.billing_cycle.slice(
                      1,
                    )
                  : "—"
              }
            />

            <SubscriptionRow
              label="Started"
              value={formatDate(
                subscription?.started_at ??
                  null,
              )}
            />

            <SubscriptionRow
              label="Current Period"
              value={
                subscription
                  ? `${formatDate(
                      subscription.current_period_start,
                    )} – ${formatDate(
                      subscription.current_period_end,
                    )}`
                  : "—"
              }
            />

            <SubscriptionRow
              label="Trial Ends"
              value={formatDate(
                subscription?.trial_ends_at ??
                  null,
              )}
            />

            {isTrial ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />

                  <div>
                    <div className="text-sm font-semibold text-blue-900">
                      Trial account
                    </div>

                    <p className="mt-1 text-xs leading-5 text-blue-700">
                      {trialDaysRemaining !==
                      null
                        ? `${trialDaysRemaining} days remaining on the current trial.`
                        : "Trial end date is not available."}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {subscription?.cancel_at_period_end ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

                  <div>
                    <div className="text-sm font-semibold text-amber-900">
                      Cancellation scheduled
                    </div>

                    <p className="mt-1 text-xs text-amber-700">
                      This subscription is
                      scheduled to cancel at
                      the end of the current
                      billing period.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Link
                href="#subscription"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Billing details
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>

              <Link
                href="/sbs-admin/payments"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Payments
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* =====================================================
          MODULE ACCESS
          ===================================================== */}
      <section
        id="modules"
        className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <SectionHeader
          icon={
            <Shield className="h-5 w-5" />
          }
          title="Module Access"
          description="Plan-based access and company-level entitlement overrides."
          action={
            <Link
              href="#module-controls"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Manage Modules
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          }
        />

        <div className="grid gap-3 p-6 md:grid-cols-2 xl:grid-cols-3">
          {moduleRows.map(
            ({
              module,
              includedInPlan,
              enabled,
              entitlement,
              isOverride,
            }) => (
              <div
                key={module.id}
                className={`rounded-xl border p-4 transition ${
                  enabled
                    ? "border-slate-200 bg-white"
                    : "border-slate-200 bg-slate-50/70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                        enabled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {module.name
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {module.name}
                      </div>

                      <div className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                        {module.slug}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      enabled
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {enabled
                      ? "Enabled"
                      : "Disabled"}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="text-xs text-slate-500">
                    {isOverride
                      ? "Admin override"
                      : includedInPlan
                        ? "Included in plan"
                        : "Not included"}
                  </div>

                  {isOverride ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                      Override
                    </span>
                  ) : null}
                </div>

                {entitlement?.reason ? (
                  <div className="mt-2 text-[11px] leading-4 text-slate-400">
                    {entitlement.reason}
                  </div>
                ) : null}
              </div>
            ),
          )}
        </div>
      </section>

      {/* =====================================================
          RESOURCE LIMITS
          ===================================================== */}
      <section
        id="limits"
        className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <SectionHeader
          icon={
            <Database className="h-5 w-5" />
          }
          title="Resource Limits"
          description="Plan limits and company-specific overrides."
          action={
            <Link
              href="#limit-controls"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Override Limit
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          }
        />

        {effectiveLimits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Resource
                  </th>

                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Plan Limit
                  </th>

                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Override
                  </th>

                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Effective
                  </th>

                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Source
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {effectiveLimits.map(
                  ({
                    key,
                    base,
                    override,
                    effective,
                  }) => (
                    <tr
                      key={key}
                      className="hover:bg-slate-50/70"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-800">
                          {prettyLimitKey(
                            key,
                          )}
                        </div>

                        <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {key}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        <LimitValue
                          limit={base}
                        />
                      </td>

                      <td className="px-6 py-4">
                        {override ? (
                          <LimitValue
                            limit={override}
                            highlighted
                          />
                        ) : (
                          <span className="text-sm text-slate-400">
                            None
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-900">
                          <LimitValue
                            limit={effective}
                          />
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            override
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {override
                            ? "Admin Override"
                            : "Plan"}
                        </span>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Database className="mx-auto h-8 w-8 text-slate-300" />

            <p className="mt-3 text-sm font-medium text-slate-700">
              No resource limits configured
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Limits will appear here once
              the assigned plan has limits.
            </p>
          </div>
        )}
      </section>

      {/* =====================================================
          ADMIN ACTIONS
          ===================================================== */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          icon={
            <ShieldAlert className="h-5 w-5" />
          }
          title="Admin Actions"
          description="Platform-level controls for this company."
        />

        <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-4">
          <ActionLink
            href="#top-controls"
            title="Change Plan"
            description="Move this company to another subscription plan."
          />

          <ActionLink
            href="#top-controls"
            title="Extend Trial"
            description="Add additional trial time to the current subscription."
          />

          <ActionLink
            href="#module-controls"
            title="Module Override"
            description="Grant or remove access to an individual module."
          />

          <ActionLink
            href="#limit-controls"
            title="Limit Override"
            description="Customize a resource limit for this company."
          />

          <ActionLink
            href={`/sbs-admin/users?company=${company.id}`}
            title="Manage Users"
            description="Review company members and account access."
          />

          <ActionLink
            href="#subscription"
            title="Billing"
            description="Review billing provider and subscription information."
          />

          <ActionLink
            href="#company-information"
            title="Company Settings"
            description="Review business configuration and registration data."
          />

          <ActionLink
            href="#top-controls"
            title={
              company.status ===
              "suspended"
                ? "Reactivate Company"
                : "Suspend Company"
            }
            description={
              company.status ===
              "suspended"
                ? "Restore access to this company workspace."
                : "Temporarily disable the company workspace."
            }
            danger={
              company.status !==
              "suspended"
            }
          />
        </div>
      </section>

      {/* Metadata */}
      <div className="mt-6 grid gap-4 pb-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Company ID
          </div>

          <div className="mt-2 break-all font-mono text-xs text-slate-600">
            {company.id}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Subscription ID
          </div>

          <div className="mt-2 break-all font-mono text-xs text-slate-600">
            {subscription?.id ||
              "No subscription"}
          </div>

          {subscription?.provider ? (
            <div className="mt-2 text-xs text-slate-400">
              Provider:{" "}
              <span className="font-medium text-slate-600">
                {subscription.provider}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   COMPONENTS
   ============================================================ */

function SectionHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {title}
          </h2>

          <p className="mt-0.5 text-xs text-slate-400">
            {description}
          </p>
        </div>
      </div>

      {action}
    </div>
  );
}

function HeaderMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      <div className="text-slate-400">
        {icon}
      </div>

      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </div>

        <div className="mt-0.5 truncate text-sm font-semibold text-slate-800">
          {value}
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
  wide = false,
}: {
  icon: React.ReactNode;
  label: string;
  value:
    | string
    | null
    | undefined;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide ? "sm:col-span-2" : ""
      }
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>

      <div className="mt-2 break-words text-sm font-medium leading-6 text-slate-800">
        {value || "Not provided"}
      </div>
    </div>
  );
}

function SubscriptionRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
      <span className="text-xs text-slate-400">
        {label}
      </span>

      <span className="text-right text-sm font-medium text-slate-700">
        {value}
      </span>
    </div>
  );
}

function LimitValue({
  limit,
  highlighted = false,
}: {
  limit:
    | {
        limit_value:
          | number
          | null;
        is_unlimited: boolean;
      }
    | null
    | undefined;
  highlighted?: boolean;
}) {
  if (!limit) {
    return (
      <span className="text-slate-400">
        —
      </span>
    );
  }

  if (limit.is_unlimited) {
    return (
      <span
        className={
          highlighted
            ? "font-semibold text-blue-700"
            : "font-semibold text-emerald-700"
        }
      >
        Unlimited
      </span>
    );
  }

  return (
    <span
      className={
        highlighted
          ? "font-semibold text-blue-700"
          : "text-slate-700"
      }
    >
      {limit.limit_value?.toLocaleString() ??
        "0"}
    </span>
  );
}

function ActionLink({
  href,
  title,
  description,
  danger = false,
}: {
  href: string;
  title: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
        danger
          ? "border-red-100 bg-red-50/30 hover:border-red-200 hover:bg-red-50"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`text-sm font-semibold ${
              danger
                ? "text-red-700"
                : "text-slate-800"
            }`}
          >
            {title}
          </div>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            {description}
          </p>
        </div>

        <ChevronRight
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            danger
              ? "text-red-300"
              : "text-slate-300"
          } transition group-hover:translate-x-0.5`}
        />
      </div>
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
