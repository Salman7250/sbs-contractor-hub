import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { paypalRequest } from "@/lib/paypal/client";

type PayPalWebhook = {
  id: string;
  url: string;
  event_types?: Array<{
    name: string;
    description?: string;
  }>;
};

type PayPalWebhooksResponse = {
  webhooks?: PayPalWebhook[];
};

export async function GET() {
  try {
    await requirePlatformAdmin();

    const result =
      await paypalRequest<PayPalWebhooksResponse>(
        "/v1/notifications/webhooks"
      );

    const webhooks = result.webhooks ?? [];

    return NextResponse.json({
      success: true,
      environment:
        process.env.PAYPAL_ENVIRONMENT === "live"
          ? "live"
          : "sandbox",
      webhooks: webhooks.map((webhook) => ({
        id: webhook.id,
        url: webhook.url,
        eventTypes:
          webhook.event_types?.map(
            (event) => event.name
          ) ?? [],
      })),
    });
  } catch (error) {
    console.error(
      "PayPal list webhooks error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve PayPal webhooks.",
      },
      { status: 500 }
    );
  }
}