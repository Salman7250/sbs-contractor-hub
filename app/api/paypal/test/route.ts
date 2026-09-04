import { NextResponse } from "next/server";
import {
  getPayPalAccessToken,
  getPayPalEnvironment,
} from "@/lib/paypal/client";

export async function GET() {
  try {
    await getPayPalAccessToken();

    return NextResponse.json({
      success: true,
      message: "PayPal authentication successful.",
      environment: getPayPalEnvironment(),
    });
  } catch (error) {
    console.error("PayPal authentication test error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unknown PayPal authentication error.",
        environment:
          process.env.PAYPAL_ENVIRONMENT ?? "not set",
        clientIdConfigured:
          Boolean(process.env.PAYPAL_CLIENT_ID),
        clientSecretConfigured:
          Boolean(process.env.PAYPAL_CLIENT_SECRET),
      },
      { status: 500 }
    );
  }
}