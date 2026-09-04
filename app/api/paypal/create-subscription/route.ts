import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createPayPalSubscription } from "@/lib/paypal/subscriptions";

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must be signed in to subscribe.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const companyId =
      typeof body?.companyId ===
      "string"
        ? body.companyId
        : "";

    const planId =
      typeof body?.planId ===
      "string"
        ? body.planId
        : "";

    const billingCycle =
      body?.billingCycle ===
      "yearly"
        ? "yearly"
        : body?.billingCycle ===
          "monthly"
        ? "monthly"
        : "";

    if (!companyId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "companyId is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!planId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "planId is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!billingCycle) {
      return NextResponse.json(
        {
          success: false,
          error:
            "billingCycle must be monthly or yearly.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * SECURITY:
     * Verify that the authenticated
     * user actually belongs to the
     * requested company.
     */
    const {
      data: membership,
      error:
        membershipError,
    } =
      await supabase
        .from("company_members")
        .select(
          "id, company_id, user_id, role"
        )
        .eq(
          "company_id",
          companyId
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (
      membershipError ||
      !membership
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You do not have access to this company.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Only allow active SBS plans.
     */
    const {
      data: plan,
      error: planError,
    } =
      await supabase
        .from("plans")
        .select(
          `
            id,
            name,
            slug,
            monthly_price,
            yearly_price,
            is_active,
            paypal_monthly_plan_id,
            paypal_yearly_plan_id
          `
        )
        .eq(
          "id",
          planId
        )
        .maybeSingle();

    if (
      planError ||
      !plan
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected SBS plan was not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!plan.is_active) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected SBS plan is inactive.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * NEVER trust the client for
     * the PayPal plan ID.
     *
     * We determine it from the
     * server-side SBS plans table.
     */
    const paypalPlanId =
      billingCycle ===
      "monthly"
        ? plan.paypal_monthly_plan_id
        : plan.paypal_yearly_plan_id;

    if (!paypalPlanId) {
      return NextResponse.json(
        {
          success: false,
          error:
            `The ${plan.name} ${billingCycle} plan is not connected to PayPal yet.`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Prevent multiple active/
     * pending subscriptions for
     * the same company.
     */
    const {
      data: existingSubscription,
      error:
        subscriptionLookupError,
    } =
      await supabase
        .from("subscriptions")
        .select(
          `
            id,
            status,
            plan_id,
            billing_cycle,
            provider_subscription_id
          `
        )
        .eq(
          "company_id",
          companyId
        )
        .in(
          "status",
          [
            "trialing",
            "active",
            "past_due",
            "paused",
            "incomplete",
          ]
        )
        .maybeSingle();

    if (
      subscriptionLookupError
    ) {
      throw new Error(
        subscriptionLookupError.message
      );
    }

    if (
      existingSubscription
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This company already has an active or pending subscription.",
          subscription:
            existingSubscription,
        },
        {
          status: 409,
        }
      );
    }

    const amount =
      Number(
        billingCycle ===
          "monthly"
          ? plan.monthly_price
          : plan.yearly_price
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount < 0
    ) {
      throw new Error(
        "The selected SBS plan has an invalid price."
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      throw new Error(
        "Missing NEXT_PUBLIC_APP_URL environment variable."
      );
    }

    const normalizedAppUrl =
      appUrl.replace(
        /\/$/,
        ""
      );

    /*
     * Create the PayPal subscription.
     */
    const paypalSubscription =
      await createPayPalSubscription(
        {
          planId:
            paypalPlanId,
          companyId,
          returnUrl:
            `${normalizedAppUrl}/billing/paypal/success`,
          cancelUrl:
            `${normalizedAppUrl}/billing/paypal/cancel`,
        }
      );

    /*
     * Store the PayPal subscription
     * immediately as incomplete.
     *
     * Webhooks will later promote it
     * to active/trialing/etc.
     */
    const {
      data:
        localSubscription,
      error:
        localSubscriptionError,
    } =
      await supabase
        .from("subscriptions")
        .insert({
          company_id:
            companyId,
          plan_id:
            plan.id,
          status:
            "incomplete",
          billing_cycle:
            billingCycle,
          amount,
          currency:
            "USD",
          provider:
            "paypal",
          provider_subscription_id:
            paypalSubscription.id,
        })
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

    if (
      localSubscriptionError
    ) {
      console.error(
        "Failed to save local subscription after PayPal creation:",
        localSubscriptionError
      );

      /*
       * IMPORTANT:
       * We do not attempt to silently
       * create another PayPal
       * subscription here.
       *
       * The PayPal subscription
       * already exists and must be
       * reconciled manually/retried
       * safely.
       */
      throw new Error(
        "PayPal subscription was created, but SBS could not save it locally. Contact support before retrying."
      );
    }

    return NextResponse.json(
      {
        success: true,
        subscription:
          localSubscription,
        paypal: {
          id:
            paypalSubscription.id,
          status:
            paypalSubscription.status,
          approvalUrl:
            paypalSubscription.approvalUrl,
        },
      }
    );
  } catch (error) {
    console.error(
      "PayPal subscription creation error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create PayPal subscription.",
      },
      {
        status: 500,
      }
    );
  }
}