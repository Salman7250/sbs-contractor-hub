import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { syncSBSPlanToPayPal } from "@/lib/paypal/sync-plans";

export async function POST(
  request: Request
) {
  try {
    await requirePlatformAdmin();

    const body =
      await request.json();

    const planId =
      typeof body?.planId ===
      "string"
        ? body.planId
        : "";

    if (!planId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "planId is required.",
        },
        { status: 400 }
      );
    }

    const result =
      await syncSBSPlanToPayPal(
        planId
      );

    return NextResponse.json(
      result
    );
  } catch (error) {
    console.error(
      "PayPal plan sync error:",
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