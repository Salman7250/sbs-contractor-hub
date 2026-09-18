import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

import SubscriptionManagement from "./subscription-management";

export type Company = {
  id: string;
  name: string;
  slug: string;
  status: string;
  email: string | null;
  currency: string;
};

export type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  currency: string;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
};

export type Subscription = {
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
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
  base_amount: number;
  discount_type: string | null;
  discount_value: number;
  discount_ends_at: string | null;
  admin_notes: string | null;
  price_override: boolean;
};

export type CompanyDiscount = {
  id: string;
  company_id: string;
  plan_id: string | null;
  name: string;
  code: string | null;
  discount_type: string;
  discount_value: number;
  duration_type: string;
  starts_at: string;
  expires_at: string | null;
  billing_cycle: string | null;
  is_active: boolean;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanLimit = {
  id: string;
  plan_id: string;
  limit_key: string;
  limit_value: number | null;
  is_unlimited: boolean;
};

export type CompanyLimitOverride = {
  id: string;
  company_id: string;
  limit_key: string;
  limit_value: number | null;
  is_unlimited: boolean;
  expires_at: string | null;
  reason: string | null;
};

export type Payment = {
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
};

export default async function AdminSubscriptionsPage() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const [
    companiesResult,
    plansResult,
    subscriptionsResult,
    discountsResult,
    limitsResult,
    limitOverridesResult,
    paymentsResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, name, slug, status, email, currency"
      )
      .order("name", {
        ascending: true,
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
        `
      )
      .order("sort_order", {
        ascending: true,
      }),

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
          updated_at,
          base_amount,
          discount_type,
          discount_value,
          discount_ends_at,
          admin_notes,
          price_override
        `
      )
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("company_discounts")
      .select(
        `
          id,
          company_id,
          plan_id,
          name,
          code,
          discount_type,
          discount_value,
          duration_type,
          starts_at,
          expires_at,
          billing_cycle,
          is_active,
          reason,
          created_by,
          created_at,
          updated_at
        `
      )
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("plan_limits")
      .select(
        `
          id,
          plan_id,
          limit_key,
          limit_value,
          is_unlimited
        `
      )
      .order("limit_key", {
        ascending: true,
      }),

    supabase
      .from("company_limit_overrides")
      .select(
        `
          id,
          company_id,
          limit_key,
          limit_value,
          is_unlimited,
          expires_at,
          reason
        `
      )
      .order("created_at", {
        ascending: false,
      }),

    supabase
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
          created_at
        `
      )
      .order("created_at", {
        ascending: false,
      }),
  ]);

  if (companiesResult.error) {
    throw new Error(
      companiesResult.error.message ||
        "Unable to load companies."
    );
  }

  if (plansResult.error) {
    throw new Error(
      plansResult.error.message ||
        "Unable to load plans."
    );
  }

  if (subscriptionsResult.error) {
    throw new Error(
      subscriptionsResult.error.message ||
        "Unable to load subscriptions."
    );
  }

  if (discountsResult.error) {
    throw new Error(
      discountsResult.error.message ||
        "Unable to load company discounts."
    );
  }

  if (limitsResult.error) {
    throw new Error(
      limitsResult.error.message ||
        "Unable to load plan limits."
    );
  }

  if (limitOverridesResult.error) {
    throw new Error(
      limitOverridesResult.error.message ||
        "Unable to load company limit overrides."
    );
  }

  if (paymentsResult.error) {
    throw new Error(
      paymentsResult.error.message ||
        "Unable to load payments."
    );
  }

  const companies: Company[] = (
    companiesResult.data ?? []
  ).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    email: row.email ?? null,
    currency: row.currency ?? "USD",
  }));

  const plans: Plan[] = (
    plansResult.data ?? []
  ).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    monthly_price:
      row.monthly_price === null
        ? null
        : Number(row.monthly_price),
    yearly_price:
      row.yearly_price === null
        ? null
        : Number(row.yearly_price),
    currency: row.currency ?? "USD",
    is_active: Boolean(row.is_active),
    is_popular: Boolean(row.is_popular),
    sort_order: Number(
      row.sort_order ?? 0
    ),
  }));

  const subscriptions: Subscription[] = (
    subscriptionsResult.data ?? []
  ).map((row) => ({
    id: row.id,
    company_id: row.company_id,
    plan_id: row.plan_id,
    status: row.status,
    billing_cycle: row.billing_cycle,
    amount: Number(row.amount ?? 0),
    currency: row.currency ?? "USD",
    started_at:
      row.started_at ?? null,
    trial_ends_at:
      row.trial_ends_at ?? null,
    current_period_start:
      row.current_period_start ??
      null,
    current_period_end:
      row.current_period_end ?? null,
    cancel_at_period_end:
      Boolean(
        row.cancel_at_period_end
      ),
    canceled_at:
      row.canceled_at ?? null,
    provider:
      row.provider ?? null,
    provider_customer_id:
      row.provider_customer_id ??
      null,
    provider_subscription_id:
      row.provider_subscription_id ??
      null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    base_amount: Number(
      row.base_amount ?? 0
    ),
    discount_type:
      row.discount_type ?? null,
    discount_value: Number(
      row.discount_value ?? 0
    ),
    discount_ends_at:
      row.discount_ends_at ?? null,
    admin_notes:
      row.admin_notes ?? null,
    price_override:
      Boolean(row.price_override),
  }));

  const discounts: CompanyDiscount[] = (
    discountsResult.data ?? []
  ).map((row) => ({
    id: row.id,
    company_id: row.company_id,
    plan_id: row.plan_id ?? null,
    name: row.name,
    code: row.code ?? null,
    discount_type:
      row.discount_type,
    discount_value: Number(
      row.discount_value ?? 0
    ),
    duration_type:
      row.duration_type,
    starts_at: row.starts_at,
    expires_at:
      row.expires_at ?? null,
    billing_cycle:
      row.billing_cycle ?? null,
    is_active:
      Boolean(row.is_active),
    reason:
      row.reason ?? null,
    created_by:
      row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const planLimits: PlanLimit[] = (
    limitsResult.data ?? []
  ).map((row) => ({
    id: row.id,
    plan_id: row.plan_id,
    limit_key: row.limit_key,
    limit_value:
      row.limit_value === null
        ? null
        : Number(row.limit_value),
    is_unlimited:
      Boolean(row.is_unlimited),
  }));

  const companyLimitOverrides: CompanyLimitOverride[] =
    (
      limitOverridesResult.data ??
      []
    ).map((row) => ({
      id: row.id,
      company_id:
        row.company_id,
      limit_key:
        row.limit_key,
      limit_value:
        row.limit_value === null
          ? null
          : Number(row.limit_value),
      is_unlimited:
        Boolean(row.is_unlimited),
      expires_at:
        row.expires_at ?? null,
      reason:
        row.reason ?? null,
    }));

  const payments: Payment[] = (
    paymentsResult.data ?? []
  ).map((row) => ({
    id: row.id,
    company_id: row.company_id,
    subscription_id:
      row.subscription_id ??
      null,
    provider:
      row.provider,
    provider_transaction_id:
      row.provider_transaction_id ??
      null,
    provider_order_id:
      row.provider_order_id ??
      null,
    amount: Number(
      row.amount ?? 0
    ),
    currency:
      row.currency ?? "USD",
    status:
      row.status,
    payment_type:
      row.payment_type,
    payment_method:
      row.payment_method ??
      null,
    paid_at:
      row.paid_at ?? null,
    refunded_at:
      row.refunded_at ?? null,
    failure_reason:
      row.failure_reason ??
      null,
    created_at:
      row.created_at,
  }));

  return (
    <SubscriptionManagement
      companies={companies}
      plans={plans}
      subscriptions={subscriptions}
      discounts={discounts}
      planLimits={planLimits}
      companyLimitOverrides={
        companyLimitOverrides
      }
      payments={payments}
    />
  );
}