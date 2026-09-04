import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

const STARTER_PLAN_ID =
  "b4f299fd-14ac-4ac7-82a6-0206d2205af0";

const PAYPAL_PRODUCT_ID =
  "PROD-5GA11834F62208102";

const PAYPAL_MONTHLY_PLAN_ID =
  "P-1CW42720V0712543HNKM7SLA";

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

    if (
      plan.paypal_product_id &&
      plan.paypal_product_id !==
        PAYPAL_PRODUCT_ID
    ) {
      throw new Error(
        "Starter already has a different PayPal Product ID. Recovery stopped for safety."
      );
    }

    if (
      plan.paypal_monthly_plan_id &&
      plan.paypal_monthly_plan_id !==
        PAYPAL_MONTHLY_PLAN_ID
    ) {
      throw new Error(
        "Starter already has a different PayPal Monthly Plan ID. Recovery stopped for safety."
      );
    }

    const { data: updatedPlan, error } =
      await supabase
        .from("plans")
        .update({
          paypal_product_id:
            PAYPAL_PRODUCT_ID,

          paypal_monthly_plan_id:
            PAYPAL_MONTHLY_PLAN_ID,
        })
        .eq("id", STARTER_PLAN_ID)
        .select(
          `
            id,
            name,
            paypal_product_id,
            paypal_monthly_plan_id,
            paypal_yearly_plan_id
          `
        )
        .single();

    if (error) {
      throw new Error(
        error.message ||
          "Unable to save recovered PayPal IDs."
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "Starter PayPal Product and Monthly Plan recovered successfully.",

      plan: updatedPlan,
    });
  } catch (error) {
    console.error(
      "Starter PayPal recovery error:",
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