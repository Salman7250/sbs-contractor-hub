import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type InviteBody = {
  companyId?: string;
  customerId?: string;
  email?: string;
  role?: string;
};

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) => {
  return NextResponse.json(body, { status });
};

export async function POST(request: NextRequest) {
  try {
    // ---------------------------------------------------------
    // Parse request
    // ---------------------------------------------------------

    let body: InviteBody;

    try {
      body = (await request.json()) as InviteBody;
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Invalid JSON request.",
        },
        400,
      );
    }

    const companyId = String(body.companyId || "").trim();
    const customerId = String(body.customerId || "").trim();

    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    const role = String(body.role || "viewer")
      .trim()
      .toLowerCase();

    // ---------------------------------------------------------
    // Validate request
    // ---------------------------------------------------------

    if (!companyId) {
      return jsonResponse(
        {
          success: false,
          error: "Company ID is required.",
        },
        400,
      );
    }

    if (!customerId) {
      return jsonResponse(
        {
          success: false,
          error: "Customer ID is required.",
        },
        400,
      );
    }

    if (!email) {
      return jsonResponse(
        {
          success: false,
          error: "Email address is required.",
        },
        400,
      );
    }

    if (!email.includes("@")) {
      return jsonResponse(
        {
          success: false,
          error: "Please enter a valid email address.",
        },
        400,
      );
    }

    const allowedRoles = [
      "primary",
      "billing",
      "manager",
      "viewer",
    ];

    if (!allowedRoles.includes(role)) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid portal role.",
        },
        400,
      );
    }

    // ---------------------------------------------------------
    // Supabase server client
    // ---------------------------------------------------------

    const supabase = await createClient();

    // ---------------------------------------------------------
    // Verify current logged-in user
    // ---------------------------------------------------------

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "B2B portal invite authentication error:",
        authError,
      );

      return jsonResponse(
        {
          success: false,
          error: authError.message,
        },
        401,
      );
    }

    if (!user) {
      return jsonResponse(
        {
          success: false,
          error:
            "You must be signed in to invite a portal user.",
        },
        401,
      );
    }

    // ---------------------------------------------------------
    // Get current session
    // ---------------------------------------------------------

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error(
        "B2B portal invite session error:",
        sessionError,
      );

      return jsonResponse(
        {
          success: false,
          error: sessionError.message,
        },
        401,
      );
    }

    if (!session?.access_token) {
      return jsonResponse(
        {
          success: false,
          error:
            "Your login session could not be verified. Please sign in again.",
        },
        401,
      );
    }

    // ---------------------------------------------------------
    // Supabase configuration
    // ---------------------------------------------------------

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const publishableKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      console.error(
        "Supabase public configuration is missing.",
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Supabase configuration is missing.",
        },
        500,
      );
    }

    // ---------------------------------------------------------
    // Build portal redirect URL
    // ---------------------------------------------------------

    const origin =
      request.headers.get("origin") ||
      request.nextUrl.origin;

    const redirectTo = `${origin}/set-password`;

    // ---------------------------------------------------------
    // Call Supabase Edge Function
    //
    // The Edge Function is responsible for:
    //
    // 1. Verifying the authenticated user
    // 2. Verifying company membership
    // 3. Verifying administrator permissions
    // 4. Verifying customer ownership
    // 5. Generating Supabase Auth invitation
    // 6. Creating/updating customer_portal_users
    // 7. Sending invitation email through Resend
    //
    // IMPORTANT:
    // The user's JWT is passed in Authorization.
    // The publishable key is passed as apikey.
    // ---------------------------------------------------------

    const functionUrl =
      `${supabaseUrl}/functions/v1/b2b-portal-invite`;

    const functionResponse = await fetch(
      functionUrl,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${session.access_token}`,

          apikey: publishableKey,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          companyId,
          customerId,
          email,
          role,
          redirectTo,
        }),

        cache: "no-store",
      },
    );

    // ---------------------------------------------------------
    // Read Edge Function response
    // ---------------------------------------------------------

    const responseText =
      await functionResponse.text();

    let result: Record<string, unknown>;

    try {
      result = JSON.parse(responseText);
    } catch {
      console.error(
        "B2B portal invite returned non-JSON response:",
        responseText,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "The portal invitation service returned an invalid response.",
        },
        502,
      );
    }

    // ---------------------------------------------------------
    // Handle Edge Function errors
    // ---------------------------------------------------------

    if (!functionResponse.ok) {
      console.error(
        "B2B portal invite Edge Function error:",
        result,
      );

      return jsonResponse(
        {
          success: false,
          error:
            typeof result.error === "string"
              ? result.error
              : "Unable to send the portal invitation.",
        },
        functionResponse.status,
      );
    }

    // ---------------------------------------------------------
    // Successful invitation
    // ---------------------------------------------------------

    return jsonResponse(result);
  } catch (error) {
    console.error(
      "Unexpected B2B portal invite error:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to send the portal invitation.",
      },
      500,
    );
  }
}