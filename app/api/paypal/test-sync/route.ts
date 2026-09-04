import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { syncSBSPlanToPayPal } from "@/lib/paypal/sync-plans";

const STARTER_PLAN_ID =
  "b4f299fd-14ac-4ac7-82a6-0206d2205af0";

export async function GET() {
  try {
    await requirePlatformAdmin();

    const result =
      await syncSBSPlanToPayPal(
        STARTER_PLAN_ID
      );

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "PayPal Starter sync test error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown PayPal synchronization error.",
      },
      { status: 500 }
    );
  }
}