import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const plan = searchParams.get("plan");

  const redirectTo = request.nextUrl.clone();

  if (!tokenHash || !type) {
    redirectTo.pathname = "/signup/verify";
    redirectTo.search = "?error=invalid_confirmation";

    return NextResponse.redirect(redirectTo);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    console.error("Email confirmation error:", {
      message: error.message,
      code: error.code,
      status: error.status,
    });

    redirectTo.pathname = "/signup/verify";
    redirectTo.search = "?error=confirmation_failed";

    return NextResponse.redirect(redirectTo);
  }

  /*
   * Email is now confirmed and Supabase has established
   * the authenticated session.
   *
   * Continue directly to business onboarding.
   */
  redirectTo.pathname = "/onboarding";
  redirectTo.search = plan
    ? `?plan=${encodeURIComponent(plan)}`
    : "";

  return NextResponse.redirect(redirectTo);
}