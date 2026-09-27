import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

import { hasCompanyModuleAccess } from "@/lib/auth/module-access";
import { getModuleRouteRule } from "@/lib/navigation/module-routes";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/set-password" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/auth/")
  );
}

function suspendedResponse() {
  return new NextResponse(
    `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Company Suspended</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 24px;
              background: #f3f5f8;
              font-family:
                Inter,
                ui-sans-serif,
                system-ui,
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                sans-serif;
              color: #0f172a;
            }

            .card {
              width: 100%;
              max-width: 520px;
              padding: 40px;
              border: 1px solid #e2e8f0;
              border-radius: 24px;
              background: #ffffff;
              box-shadow:
                0 24px 70px rgba(15, 23, 42, 0.08);
              text-align: center;
            }

            .icon {
              width: 58px;
              height: 58px;
              margin: 0 auto 22px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 16px;
              background: #fff7ed;
              color: #d97706;
              font-size: 26px;
              font-weight: 700;
            }

            h1 {
              margin: 0;
              font-size: 27px;
              line-height: 1.2;
              letter-spacing: -0.03em;
            }

            p {
              margin: 14px auto 0;
              max-width: 400px;
              color: #64748b;
              font-size: 14px;
              line-height: 1.7;
            }

            .note {
              margin-top: 24px;
              padding: 14px 16px;
              border-radius: 14px;
              background: #fffaf0;
              border: 1px solid #fed7aa;
              color: #9a6700;
              font-size: 13px;
              line-height: 1.6;
            }
          </style>
        </head>

        <body>
          <div class="card">
            <div class="icon">!</div>

            <h1>
              Your company is suspended
            </h1>

            <p>
              Access to the SBS platform has been
              temporarily suspended for your company.
            </p>

            <div class="note">
              Please contact your company administrator
              or SBS support for more information.
            </div>
          </div>
        </body>
      </html>
    `,
    {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export async function middleware(
  request: NextRequest,
) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value }) => {
              request.cookies.set(
                name,
                value,
              );
            },
          );

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }) => {
              response.cookies.set(
                name,
                value,
                options,
              );
            },
          );
        },
      },
    },
  );

  const pathname =
    request.nextUrl.pathname;

  /*
   * Always resolve the current authenticated user.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * =========================================================
   * CUSTOMER PORTAL
   * =========================================================
   */

  const isCustomerPortalPath =
    pathname === "/portal" ||
    pathname.startsWith("/portal/");

  if (isCustomerPortalPath) {
    /*
     * Portal login remains public.
     */
    if (
      pathname === "/portal/login"
    ) {
      return response;
    }

    /*
     * Portal pages require authentication.
     */
    if (!user) {
      const loginUrl = new URL(
        "/portal/login",
        request.url,
      );

      loginUrl.searchParams.set(
        "redirectTo",
        `${pathname}${request.nextUrl.search}`,
      );

      return NextResponse.redirect(
        loginUrl,
      );
    }

    /*
     * Get portal account.
     */
    const {
      data: portalUser,
      error: portalUserError,
    } = await supabase
      .from(
        "customer_portal_users",
      )
      .select(
        "id, company_id, status",
      )
      .eq(
        "user_id",
        user.id,
      )
      .limit(1)
      .maybeSingle();

    if (
      portalUserError ||
      !portalUser
    ) {
      return NextResponse.redirect(
        new URL(
          "/portal/login?error=portal-access-denied",
          request.url,
        ),
      );
    }

    /*
     * Portal account itself must be active.
     */
    if (
      portalUser.status !==
      "active"
    ) {
      return NextResponse.redirect(
        new URL(
          "/portal/login?error=portal-access-denied",
          request.url,
        ),
      );
    }

    /*
     * IMPORTANT:
     * Check the company status separately.
     */
    const {
      data: portalCompany,
      error: portalCompanyError,
    } = await supabase
      .from("companies")
      .select(
        "id, status",
      )
      .eq(
        "id",
        portalUser.company_id,
      )
      .maybeSingle();

    if (
      portalCompanyError ||
      !portalCompany
    ) {
      return new NextResponse(
        "Company not found.",
        {
          status: 403,
          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",
            "Cache-Control":
              "private, no-store",
          },
        },
      );
    }

    /*
     * BLOCK SUSPENDED COMPANY.
     */
    if (
      String(
        portalCompany.status ??
          "",
      ).toLowerCase() ===
      "suspended"
    ) {
      return suspendedResponse();
    }

    return response;
  }

  /*
   * =========================================================
   * ONBOARDING
   * =========================================================
   */

  if (
    pathname === "/onboarding"
  ) {
    if (!user) {
      const loginUrl = new URL(
        "/login",
        request.url,
      );

      loginUrl.searchParams.set(
        "redirectTo",
        "/onboarding",
      );

      return NextResponse.redirect(
        loginUrl,
      );
    }

    return response;
  }

  /*
   * =========================================================
   * PUBLIC ROUTES
   * =========================================================
   */

  if (isPublicPath(pathname)) {
    if (
      user &&
      pathname === "/login"
    ) {
      return NextResponse.redirect(
        new URL("/", request.url),
      );
    }

    return response;
  }

  /*
   * =========================================================
   * EMPLOYEE WORKSPACE
   * =========================================================
   */

  const rule =
    getModuleRouteRule(pathname);

  if (!rule) {
    return response;
  }

  /*
   * Protected employee routes require authentication.
   */
  if (!user) {
    const loginUrl = new URL(
      "/login",
      request.url,
    );

    loginUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(
      loginUrl,
    );
  }

  /*
   * Resolve company membership.
   */
  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("company_members")
    .select(
      "company_id",
    )
    .eq(
      "user_id",
      user.id,
    )
    .limit(1)
    .maybeSingle();

  if (
    membershipError ||
    !membership?.company_id
  ) {
    return NextResponse.redirect(
      new URL(
        "/login?error=no-company",
        request.url,
      ),
    );
  }

  /*
   * =========================================================
   * COMPANY STATUS CHECK
   * =========================================================
   *
   * This is the actual fix.
   *
   * A user can still have a valid Supabase session after
   * the company has been suspended. Therefore we check the
   * CURRENT database company status on every protected
   * workspace request.
   */

  const {
    data: company,
    error: companyError,
  } = await supabase
    .from("companies")
    .select(
      "id, status",
    )
    .eq(
      "id",
      membership.company_id,
    )
    .maybeSingle();

  if (
    companyError ||
    !company
  ) {
    return NextResponse.redirect(
      new URL(
        "/login?error=company-not-found",
        request.url,
      ),
    );
  }

  /*
   * Suspended companies are blocked BEFORE
   * module entitlements or employee permissions.
   */
  if (
    String(
      company.status ?? "",
    ).toLowerCase() ===
    "suspended"
  ) {
    return suspendedResponse();
  }

  /*
   * =========================================================
   * MODULE ENTITLEMENT
   * =========================================================
   */

  if (rule.entitlementModule) {
    try {
      const hasEntitlement =
        await hasCompanyModuleAccess(
          supabase,
          membership.company_id,
          rule.entitlementModule,
        );

      if (!hasEntitlement) {
        return NextResponse.redirect(
          new URL(
            "/?error=module-not-in-plan",
            request.url,
          ),
        );
      }
    } catch (error) {
      console.error(
        "Middleware module access check failed:",
        error,
      );

      return NextResponse.redirect(
        new URL(
          "/?error=module-access-check-failed",
          request.url,
        ),
      );
    }
  }

  /*
   * =========================================================
   * DATABASE PERMISSION CHECK
   * =========================================================
   */

  const {
    data: allowed,
    error: permissionError,
  } = await supabase.rpc(
    "employee_can_access",
    {
      p_company_id:
        membership.company_id,

      p_module:
        rule.permissionModule,

      p_action: "view",
    },
  );

  if (permissionError) {
    console.error(
      "Middleware permission check failed:",
      permissionError,
    );

    return NextResponse.redirect(
      new URL(
        "/?error=permission-check-failed",
        request.url,
      ),
    );
  }

  if (!allowed) {
    return NextResponse.redirect(
      new URL(
        "/?error=access-denied",
        request.url,
      ),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2|ttf)$).*)",
  ],
};