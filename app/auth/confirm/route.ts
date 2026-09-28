import {
  type EmailOtpType,
} from "@supabase/supabase-js";

import {
  type NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";

function getSafeRedirectPath(
  value: string | null,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }

  /*
   * Only allow internal application paths.
   *
   * This prevents an external URL from being supplied through
   * the confirmation link and used as an open redirect.
   */
  if (!value.startsWith("/")) {
    return fallback;
  }

  if (value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export async function GET(
  request: NextRequest,
) {
  const { searchParams } =
    new URL(request.url);

  const tokenHash =
    searchParams.get("token_hash");

  const type =
    searchParams.get(
      "type",
    ) as EmailOtpType | null;

  const plan =
    searchParams.get("plan");

  /*
   * Employee invitations may contain:
   *
   * /auth/confirm
   *   ?token_hash=...
   *   &type=invite
   *   &next=/set-password
   *
   * Company signup confirmation can use:
   *
   * /auth/confirm
   *   ?token_hash=...
   *   &type=email
   *   &next=/onboarding
   *
   * We still read these values for normal confirmation
   * handling and debugging.
   */
  const requestedNext =
    searchParams.get("next") ||
    searchParams.get("redirect_to");

  /*
   * =========================================================
   * DEBUG
   * =========================================================
   *
   * This lets us verify exactly what Supabase is sending to
   * the confirmation route and what redirect path we receive.
   */
  console.log(
    "AUTH CONFIRM DEBUG:",
    {
      type,
      requestedNext,
      tokenHashPresent:
        !!tokenHash,
      plan,
      pathname:
        request.nextUrl.pathname,
    },
  );

  const redirectTo =
    request.nextUrl.clone();

  /*
   * =========================================================
   * 1. Validate confirmation parameters
   * =========================================================
   */

  if (!tokenHash || !type) {
    console.log(
      "AUTH CONFIRM DEBUG: Missing tokenHash or type",
    );

    redirectTo.pathname =
      "/signup/verify";

    redirectTo.search =
      "?error=invalid_confirmation";

    return NextResponse.redirect(
      redirectTo,
    );
  }

  /*
   * =========================================================
   * 2. Verify Supabase confirmation token
   * =========================================================
   */

  const supabase =
    await createClient();

  const { error } =
    await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

  if (error) {
    console.error(
      "Email confirmation error:",
      {
        message:
          error.message,
        code:
          error.code,
        status:
          error.status,
      },
    );

    redirectTo.pathname =
      "/signup/verify";

    redirectTo.search =
      "?error=confirmation_failed";

    return NextResponse.redirect(
      redirectTo,
    );
  }

  /*
   * =========================================================
   * 3. Determine where the confirmed user should go
   * =========================================================
   *
   * INVITE:
   *     ALWAYS /set-password
   *
   * COMPANY SIGNUP:
   *     /onboarding
   */

  if (type === "invite") {
    /*
     * IMPORTANT:
     *
     * Employee invitations MUST always go to /set-password.
     *
     * We intentionally DO NOT honor:
     *
     *     ?next=...
     *     ?redirect_to=...
     *
     * here.
     *
     * This prevents an employee invitation from ever being
     * redirected into the company onboarding flow.
     */
    redirectTo.pathname =
      "/set-password";

    /*
     * Remove all query parameters after the invitation
     * token has been successfully verified.
     */
    redirectTo.search = "";

    /*
     * =======================================================
     * DEBUG INVITATION REDIRECT
     * =======================================================
     */
    console.log(
      "INVITE REDIRECT DEBUG:",
      {
        requestedNext,
        forcedPath:
          "/set-password",
        type,
      },
    );

    /*
     * =======================================================
     * DEBUG FINAL REDIRECT
     * =======================================================
     */
    console.log(
      "FINAL REDIRECT:",
      redirectTo.toString(),
    );

    return NextResponse.redirect(
      redirectTo,
    );
  }

  /*
   * =========================================================
   * 4. Normal company email confirmation
   * =========================================================
   *
   * Company signup users continue through the normal
   * business onboarding flow.
   */

  redirectTo.pathname =
    getSafeRedirectPath(
      requestedNext,
      "/onboarding",
    );

  /*
   * Preserve the selected pricing plan for company
   * onboarding when no custom redirect was supplied.
   */
  if (
    redirectTo.pathname ===
      "/onboarding" &&
    plan
  ) {
    redirectTo.search =
      `?plan=${encodeURIComponent(
        plan,
      )}`;
  } else {
    redirectTo.search = "";
  }

  /*
   * =========================================================
   * DEBUG COMPANY SIGNUP REDIRECT
   * =========================================================
   */
  console.log(
    "COMPANY SIGNUP REDIRECT DEBUG:",
    {
      requestedNext,
      finalPath:
        redirectTo.pathname,
      finalUrl:
        redirectTo.toString(),
      type,
      plan,
    },
  );

  return NextResponse.redirect(
    redirectTo,
  );
}