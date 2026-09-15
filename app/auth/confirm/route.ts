import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") || "/";

  /*
   * The confirmation endpoint must receive both
   * token_hash and type from the Supabase invitation link.
   */
  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL(
        "/login?error=invalid_invitation",
        requestUrl.origin,
      ),
    );
  }

  const supabase = await createClient();

  /*
   * Verify the invitation token.
   *
   * verifyOtp() also allows the Supabase server client
   * to persist the authenticated session through cookies.
   */
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as
      | "signup"
      | "invite"
      | "magiclink"
      | "recovery"
      | "email_change"
      | "email",
  });

  if (error) {
    console.error("Auth confirmation error:", error);

    return NextResponse.redirect(
      new URL(
        "/login?error=invitation_expired",
        requestUrl.origin,
      ),
    );
  }

  /*
   * Only allow internal relative redirects.
   *
   * This prevents the invitation URL from being used
   * as an open redirect to another website.
   */
  const safeNext =
    next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/";

  /*
   * Employee invitations should finish at the
   * password setup page.
   */
  return NextResponse.redirect(
    new URL(safeNext, requestUrl.origin),
  );
}