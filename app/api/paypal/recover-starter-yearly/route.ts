import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

import {
  createPayPalBillingPlan,
  activatePayPalBillingPlan,
} from "@/lib/paypal/catalog";

const STARTER_PLAN_ID =
  "b4f299fd-14ac-4ac7-82a6-0206d2205af0";

const PAYPAL_PRODUCT_ID =
  "PROD-5GA11834F62208102";

export async function GET() {
  try {
    await requirePlatformAdmin();

    const supabase =
      await createClient();

    const { data: plan, error: planError } =
      await supabase
        .from("plans")
        .select(
          `
            id,
            name,
            slug,
            yearly_price,
            is_active,
            paypal_product_id,
            paypal_monthly_plan_id,
            paypal_yearly_plan_id
          `
        )
        .eq("id", STARTER_PLAN_ID)
        .maybeSingle();

    if (planError) {
      throw new Error(
        planError.message ||
          "Unable to load Starter plan."
      );
    }

    if (!plan) {
      throw new Error(
        "Starter plan was not found."
      );
    }

    if (!plan.is_active) {
      throw new Error(
        "Starter plan is inactive."
      );
    }

    if (
      plan.paypal_product_id &&
      plan.paypal_product_id !==
        PAYPAL_PRODUCT_ID
    ) {
      throw new Error(
        "Starter has a different PayPal Product ID. Recovery stopped for safety."
      );
    }

    if (plan.paypal_yearly_plan_id) {
      return NextResponse.json({
        success: true,
        message:
          "Starter already has a PayPal yearly plan.",
        plan,
      });
    }

    const yearlyPrice =
      Number(plan.yearly_price ?? 0);

    if (
      !Number.isFinite(yearlyPrice) ||
      yearlyPrice < 0
    ) {
      throw new Error(
        "Starter yearly price is invalid."
      );
    }

    const yearlyPlan =
      await createPayPalBillingPlan({
        productId:
          PAYPAL_PRODUCT_ID,

        name:
          "SBS Starter Yearly",

        description:
          "Starter yearly subscription for Sharif Business Solutions.",

        amount:
          yearlyPrice,

        currency: "USD",

        billingInterval: "YEAR",
      });

    let finalStatus =
      yearlyPlan.status;

    if (
      yearlyPlan.status !==
      "ACTIVE"
    ) {
      const activation =
        await activatePayPalBillingPlan(
          yearlyPlan.id
        );

      finalStatus =
        activation.status;
    }

    const {
      data: updatedPlan,
      error: updateError,
    } = await supabase
      .from("plans")
      .update({
        paypal_product_id:
          PAYPAL_PRODUCT_ID,

        paypal_yearly_plan_id:
          yearlyPlan.id,
      })
      .eq("id", STARTER_PLAN_ID)
      .select(
        `
          id,
          name,
          slug,
          monthly_price,
          yearly_price,
          is_active,
          paypal_product_id,
          paypal_monthly_plan_id,
          paypal_yearly_plan_id
        `
      )
      .single();

    if (updateError) {
      throw new Error(
        updateError.message ||
          "PayPal yearly plan was created but SBS could not save the Plan ID."
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "Starter yearly PayPal plan created and connected successfully.",

      paypal: {
        productId:
          PAYPAL_PRODUCT_ID,

        yearlyPlanId:
          yearlyPlan.id,

        status:
          finalStatus,
      },

      plan: updatedPlan,
    });
  } catch (error) {
    console.error(
      "Starter PayPal yearly recovery error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown recovery error.",
      },
      { status: 500 }
    );
  }
}