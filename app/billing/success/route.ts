import { NextResponse } from "next/server";
import { completePayPalSubscription } from "@/lib/paypal/complete-subscription";

export async function GET(
  request: Request,
) {
  const url = new URL(request.url);

  /*
   * This route supports the older
   * /billing/success callback as well as
   * the new /billing/paypal/success route.
   */
  const paypalSubscriptionId =
    url.searchParams.get(
      "subscription_id",
    );

  if (!paypalSubscriptionId) {
    const errorUrl = new URL(
      "/settings/billing",
      url.origin,
    );

    errorUrl.searchParams.set(
      "billing_error",
      "PayPal did not return a subscription ID.",
    );

    return NextResponse.redirect(
      errorUrl,
    );
  }

  try {
    const result =
      await completePayPalSubscription(
        paypalSubscriptionId,
      );

    const successUrl = new URL(
      "/settings/billing",
      url.origin,
    );

    if (
      result.subscription.status ===
      "active"
    ) {
      successUrl.searchParams.set(
        "billing_success",
        "subscription_active",
      );
    } else if (
      result.subscription.status ===
      "pending"
    ) {
      successUrl.searchParams.set(
        "billing_success",
        "subscription_pending",
      );
    } else {
      successUrl.searchParams.set(
        "billing_success",
        result.subscription.status,
      );
    }

    return NextResponse.redirect(
      successUrl,
    );
  } catch (error) {
    console.error(
      "PayPal subscription completion error:",
      error,
    );

    const errorUrl = new URL(
      "/settings/billing",
      url.origin,
    );

    errorUrl.searchParams.set(
      "billing_error",
      error instanceof Error
        ? error.message
        : "Unable to complete PayPal subscription.",
    );

    return NextResponse.redirect(
      errorUrl,
    );
  }
}