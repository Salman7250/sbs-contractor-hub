import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { paypalRequest } from "@/lib/paypal/client";

type PayPalSubscription = {
  id: string;
  status?: string;
  plan_id?: string;
  custom_id?: string;
  create_time?: string;
  update_time?: string;
  billing_info?: {
    next_billing_time?: string;
    cycle_executions?: Array<{
      tenure_type?: string;
      sequence?: number;
      cycles_completed?: number;
      cycles_remaining?: number;
    }>;
  };
};

type UpdatedSubscription = {
  id: string;
  company_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  amount: number | string;
  currency: string;
  provider: string;
  provider_subscription_id: string;
};

type PageResult =
  | {
      success: true;
      subscription: UpdatedSubscription;
    }
  | {
      success: false;
      title: string;
      message: string;
    };

function mapPayPalStatus(
  status?: string
):
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "incomplete"
  | "incomplete_expired" {
  switch (status) {
    case "ACTIVE":
      return "active";

    case "SUSPENDED":
      return "paused";

    case "CANCELLED":
      return "canceled";

    case "EXPIRED":
      return "incomplete_expired";

    case "APPROVAL_PENDING":
      return "incomplete";

    default:
      return "incomplete";
  }
}

function formatStatus(status: string) {
  switch (status) {
    case "active":
      return "Active";

    case "trialing":
      return "Trialing";

    case "past_due":
      return "Past Due";

    case "paused":
      return "Paused";

    case "canceled":
      return "Canceled";

    case "incomplete":
      return "Pending";

    case "incomplete_expired":
      return "Expired";

    default:
      return status;
  }
}

async function processPayPalSubscription(
  paypalSubscriptionId: string,
  userId: string
): Promise<PageResult> {
  const supabase = await createClient();

  try {
    /*
     * Ask PayPal for the authoritative subscription state.
     * We do NOT trust the browser query parameters for status.
     */
    const paypalSubscription =
      await paypalRequest<PayPalSubscription>(
        `/v1/billing/subscriptions/${encodeURIComponent(
          paypalSubscriptionId
        )}`
      );

    if (!paypalSubscription.id) {
      throw new Error(
        "PayPal did not return a valid subscription."
      );
    }

    const companyId =
      typeof paypalSubscription.custom_id === "string"
        ? paypalSubscription.custom_id
        : "";

    if (!companyId) {
      throw new Error(
        "The PayPal subscription is not associated with an SBS company."
      );
    }

    /*
     * Verify that the currently signed-in user actually belongs
     * to the company associated with this PayPal subscription.
     */
    const { data: membership, error: membershipError } =
      await supabase
        .from("company_members")
        .select("id, company_id, user_id, role")
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .maybeSingle();

    if (membershipError || !membership) {
      return {
        success: false,
        title: "Subscription verification failed",
        message:
          "We received a PayPal subscription, but could not verify that it belongs to your company.",
      };
    }

    /*
     * Find the local SBS subscription created before the customer
     * was redirected to PayPal.
     */
    const {
      data: localSubscription,
      error: subscriptionLookupError,
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
          provider,
          provider_subscription_id
        `
      )
      .eq(
        "provider_subscription_id",
        paypalSubscriptionId
      )
      .eq("company_id", companyId)
      .maybeSingle();

    if (subscriptionLookupError) {
      throw new Error(
        subscriptionLookupError.message
      );
    }

    if (!localSubscription) {
      throw new Error(
        "The PayPal subscription was successful, but SBS could not find the corresponding local subscription."
      );
    }

    const newStatus = mapPayPalStatus(
      paypalSubscription.status
    );

    /*
     * PayPal is authoritative for the subscription status.
     *
     * The webhook remains responsible for ongoing lifecycle
     * synchronization. This update makes the customer experience
     * correct immediately after returning from checkout.
     */
    const { data: updatedSubscription, error: updateError } =
      await supabase
        .from("subscriptions")
        .update({
          status: newStatus,
          provider: "paypal",
          provider_subscription_id:
            paypalSubscription.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", localSubscription.id)
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
            provider_subscription_id
          `
        )
        .single();

    if (updateError || !updatedSubscription) {
      throw new Error(
        updateError?.message ||
          "Unable to update the SBS subscription."
      );
    }

    return {
      success: true,
      subscription:
        updatedSubscription as UpdatedSubscription,
    };
  } catch (error) {
    console.error(
      "PayPal success processing error:",
      error
    );

    return {
      success: false,
      title:
        "Payment received — subscription verification pending",
      message:
        "PayPal returned successfully, but SBS could not finish synchronizing your subscription immediately.",
    };
  }
}

function MissingSubscriptionId() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Subscription information missing
        </h1>

        <p className="mt-3 text-gray-600">
          PayPal did not return a subscription ID. Please contact
          support if you believe your payment was completed.
        </p>

        <Link
          href="/billing"
          className="mt-6 inline-block rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Return to Billing
        </Link>
      </div>
    </main>
  );
}

function VerificationFailed({
  subscriptionId,
}: {
  subscriptionId: string;
}) {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Subscription verification failed
        </h1>

        <p className="mt-3 text-gray-600">
          We received a PayPal subscription, but could not verify
          that it belongs to your company.
        </p>

        <p className="mt-4 text-sm text-gray-500">
          Subscription ID: {subscriptionId}
        </p>

        <Link
          href="/billing"
          className="mt-6 inline-block rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Return to Billing
        </Link>
      </div>
    </main>
  );
}

function ProcessingError({
  subscriptionId,
  title,
  message,
}: {
  subscriptionId: string;
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          {title}
        </h1>

        <p className="mt-3 text-gray-600">
          {message}
        </p>

        <div className="mt-5 rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            PayPal Subscription ID
          </p>

          <p className="mt-1 break-all text-sm font-medium text-gray-900">
            {subscriptionId}
          </p>
        </div>

        <p className="mt-5 text-sm text-gray-500">
          The PayPal webhook system will continue processing the
          subscription event. You can return to Billing and check
          the subscription status shortly.
        </p>

        <Link
          href="/billing"
          className="mt-6 inline-block rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Return to Billing
        </Link>
      </div>
    </main>
  );
}

function SuccessfulSubscription({
  subscriptionId,
  subscription,
}: {
  subscriptionId: string;
  subscription: UpdatedSubscription;
}) {
  const displayStatus = formatStatus(
    subscription.status
  );

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-green-200 bg-white p-8 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="mt-6 text-3xl font-bold text-gray-900">
            PayPal subscription approved
          </h1>

          <p className="mt-3 text-gray-600">
            Your SBS subscription has been successfully connected
            to PayPal.
          </p>

          <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Subscription Status
                </p>

                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {displayStatus}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Billing Cycle
                </p>

                <p className="mt-1 text-lg font-semibold capitalize text-gray-900">
                  {subscription.billing_cycle}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Amount
                </p>

                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {subscription.currency}{" "}
                  {Number(subscription.amount).toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  PayPal Subscription
                </p>

                <p className="mt-1 break-all text-sm font-medium text-gray-900">
                  {subscriptionId}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              PayPal will notify SBS automatically about future
              subscription payments, renewals, cancellations, and
              payment failures.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/billing"
              className="rounded-lg bg-gray-900 px-5 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
            >
              Go to Billing
            </Link>

            <Link
              href="/"
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default async function PayPalSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    subscription_id?: string;
    token?: string;
    ba_token?: string;
  }>;
}) {
  const params = await searchParams;

  const paypalSubscriptionId =
    typeof params.subscription_id === "string"
      ? params.subscription_id
      : "";

  if (!paypalSubscriptionId) {
    return <MissingSubscriptionId />;
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/billing/paypal/success?subscription_id=${paypalSubscriptionId}`
      )}`
    );
  }

  const result = await processPayPalSubscription(
    paypalSubscriptionId,
    user.id
  );

  if (!result.success) {
    if (result.title === "Subscription verification failed") {
      return (
        <VerificationFailed
          subscriptionId={paypalSubscriptionId}
        />
      );
    }

    return (
      <ProcessingError
        subscriptionId={paypalSubscriptionId}
        title={result.title}
        message={result.message}
      />
    );
  }

  return (
    <SuccessfulSubscription
      subscriptionId={paypalSubscriptionId}
      subscription={result.subscription}
    />
  );
}