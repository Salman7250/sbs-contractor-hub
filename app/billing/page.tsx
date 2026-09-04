import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import AppShell from "@/app/components/app-shell";
import BillingPageClient from "./billing-page-client";

export default async function BillingPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

  if (membershipError || !membership) {
    return (
      <AppShell
        title="Billing"
        description="Manage your subscription and billing."
      >
        <div className="rounded-[14px] border border-[#e1e7ee] bg-white p-5">
          <div className="flex items-start gap-3.5">
            <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#fff1f0] font-extrabold text-[#b42318]">
              !
            </div>

            <div>
              <h2 className="m-0 text-[14px] font-bold leading-5 text-[#17202b]">
                Unable to load billing
              </h2>

              <p className="mt-1 text-[12px] leading-[18px] text-[#687585]">
                We couldn't determine your company
                membership. Please refresh the page or
                contact support.
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const { data: company, error: companyError } =
    await supabase
      .from("companies")
      .select("id, name, currency, timezone")
      .eq("id", membership.company_id)
      .maybeSingle();

  if (companyError || !company) {
    return (
      <AppShell
        title="Billing"
        description="Manage your subscription and billing."
      >
        <div className="rounded-[14px] border border-[#e1e7ee] bg-white p-5">
          <div className="flex items-start gap-3.5">
            <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#fff1f0] font-extrabold text-[#b42318]">
              !
            </div>

            <div>
              <h2 className="m-0 text-[14px] font-bold leading-5 text-[#17202b]">
                Company not found
              </h2>

              <p className="mt-1 text-[12px] leading-[18px] text-[#687585]">
                We couldn't load your company
                information. Please refresh the page or
                contact support.
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const {
    data: subscription,
    error: subscriptionError,
  } = await supabase
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
        plans (
          id,
          name,
          slug,
          monthly_price,
          yearly_price,
          is_active
        )
      `
    )
    .eq("company_id", company.id)
    .in("status", [
      "trialing",
      "active",
      "past_due",
      "paused",
      "incomplete",
    ])
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  const {
    data: payments,
    error: paymentsError,
  } = await supabase
    .from("payments")
    .select(
      `
        id,
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
    .eq("company_id", company.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(20);

  const normalizedSubscription = subscription
    ? {
        ...subscription,
        plans: Array.isArray(subscription.plans)
          ? subscription.plans[0] ?? null
          : subscription.plans,
      }
    : null;

  return (
    <AppShell
      title="Billing"
      description="Manage your subscription, payment method, and billing history."
    >
      <BillingPageClient
        company={{
          id: company.id,
          name: company.name,
          currency: company.currency,
        }}
        subscription={normalizedSubscription}
        payments={payments ?? []}
        initialError={
          subscriptionError
            ? "Unable to load subscription information."
            : paymentsError
              ? "Unable to load payment history."
              : null
        }
      />
    </AppShell>
  );
}