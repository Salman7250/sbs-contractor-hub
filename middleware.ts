import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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
    pathname === "/account-suspended" ||
    pathname.startsWith("/auth/")
  );
}

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
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
   * Always resolve the current Supabase user.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * ---------------------------------------------------------
   * SUSPENDED ACCOUNT PAGE
   * ---------------------------------------------------------
   *
   * This page is allowed through middleware so a suspended
   * company can actually see the suspension message and
   * log out.
   *
   * It does NOT give access to the application.
   */
  if (pathname === "/account-suspended") {
    return response;
  }

  /*
   * ---------------------------------------------------------
   * CUSTOMER PORTAL
   * ---------------------------------------------------------
   */

  const isCustomerPortalPath =
    pathname === "/portal" ||
    pathname.startsWith("/portal/");

  if (isCustomerPortalPath) {
    /*
     * Portal login is public.
     */
    if (pathname === "/portal/login") {
      return response;
    }

    /*
     * All other portal pages require authentication.
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
     * Verify active customer portal account.
     */
    const {
      data: portalUser,
      error: portalUserError,
    } = await supabase
      .from("customer_portal_users")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "active")
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
     * Customer portal authorization succeeded.
     */
    return response;
  }

  /*
   * ---------------------------------------------------------
   * ONBOARDING
   * ---------------------------------------------------------
   */

  /*
 * ---------------------------------------------------------
 * ONBOARDING
 * ---------------------------------------------------------
 */

if (pathname === "/onboarding") {
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

  /*
   * Employees must NEVER enter company onboarding.
   *
   * Employee accounts already belong to a company and
   * therefore have no reason to complete company setup.
   */
  const {
    data: employee,
    error: employeeError,
  } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (employeeError) {
    console.error(
      "Onboarding employee lookup failed:",
      employeeError,
    );

    return NextResponse.redirect(
      new URL(
        "/?error=employee-check-failed",
        request.url,
      ),
    );
  }

  if (employee) {
    return NextResponse.redirect(
      new URL(
        "/",
        request.url,
      ),
    );
  }

  return response;
}

  /*
   * ---------------------------------------------------------
   * PUBLIC APPLICATION ROUTES
   * ---------------------------------------------------------
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
   * ---------------------------------------------------------
   * EMPLOYEE WORKSPACE ROUTES
   * ---------------------------------------------------------
   */

  const rule =
    getModuleRouteRule(pathname);

  /*
   * Routes outside the employee workspace
   * are left alone.
   */
  if (!rule) {
    return response;
  }

  /*
   * Employee workspace requires authentication.
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
   * ---------------------------------------------------------
   * RESOLVE COMPANY MEMBERSHIP + COMPANY STATUS
   * ---------------------------------------------------------
   */

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("company_members")
    .select(
      `
        company_id,
        companies (
          id,
          name,
          status
        )
      `,
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
   * Supabase can return the relationship as either
   * an object or an array depending on the generated
   * relationship shape.
   */
  const company = Array.isArray(
    membership.companies,
  )
    ? membership.companies[0]
    : membership.companies;

  /*
   * ---------------------------------------------------------
   * SUSPENDED COMPANY CHECK
   * ---------------------------------------------------------
   *
   * This is the important part.
   *
   * Once the company status is "suspended",
   * the user cannot enter ANY employee workspace
   * route.
   *
   * Opening another tab will hit this middleware again
   * and redirect back to /account-suspended.
   */
  if (
    company?.status ===
    "suspended"
  ) {
    return NextResponse.redirect(
      new URL(
        "/account-suspended",
        request.url,
      ),
    );
  }

  /*
   * ---------------------------------------------------------
   * MODULE ENTITLEMENT
   * ---------------------------------------------------------
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
   * ---------------------------------------------------------
   * EMPLOYEE PERMISSION CHECK
   * ---------------------------------------------------------
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