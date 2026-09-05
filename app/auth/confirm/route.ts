import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") || "/";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL(
        "/login?error=invalid_invitation",
        requestUrl.origin
      )
    );
  }

  const supabase = await createClient();

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
        requestUrl.origin
      )
    );
  }

  const safeNext =
    next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/";

  return NextResponse.redirect(
    new URL(safeNext, requestUrl.origin)
  );
}