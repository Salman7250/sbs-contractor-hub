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

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;

  /*
   * Always resolve the current Supabase user before making
   * authorization decisions.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * ---------------------------------------------------------
   * CUSTOMER PORTAL
   * ---------------------------------------------------------
   *
   * Customer portal users are separate from company employees.
   * They must not go through company_members or employee RBAC.
   */

  const isCustomerPortalPath =
    pathname === "/portal" ||
    pathname.startsWith("/portal/");

  if (isCustomerPortalPath) {
    /*
     * The portal login page is public.
     */
    if (pathname === "/portal/login") {
      return response;
    }

    /*
     * Every other portal page requires an authenticated user.
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

      return NextResponse.redirect(loginUrl);
    }

    /*
     * Verify that the authenticated user has an active
     * customer portal account.
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

    if (portalUserError || !portalUser) {
      return NextResponse.redirect(
        new URL(
          "/portal/login?error=portal-access-denied",
          request.url,
        ),
      );
    }

    /*
     * Customer portal authorization succeeded.
     * Do not run employee/company RBAC below.
     */
    return response;
  }

  /*
   * Onboarding is intentionally outside employee/company RBAC.
   *
   * A newly verified user does not have a company_members record
   * yet. They must therefore be allowed to reach onboarding before
   * company permissions can exist.
   */
  if (pathname === "/onboarding") {
    if (!user) {
      const loginUrl = new URL("/login", request.url);

      loginUrl.searchParams.set(
        "redirectTo",
        "/onboarding",
      );

      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  /*
   * Standard public application routes.
   */
  if (isPublicPath(pathname)) {
    if (user && pathname === "/login") {
      return NextResponse.redirect(
        new URL("/", request.url),
      );
    }

    return response;
  }

  const rule = getModuleRouteRule(pathname);

  /*
   * Routes that are not part of the employee workspace are left
   * alone.
   */
  if (!rule) {
    return response;
  }

  /*
   * Employee workspace requires authentication.
   */
  if (!user) {
    const loginUrl = new URL("/login", request.url);

    loginUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(loginUrl);
  }

  /*
   * Resolve the employee/company membership.
   */
  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.company_id) {
    return NextResponse.redirect(
      new URL(
        "/login?error=no-company",
        request.url,
      ),
    );
  }

  /*
   * Check module entitlement.
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
   * Database permission check for employee workspace.
   */
  const {
    data: allowed,
    error: permissionError,
  } = await supabase.rpc(
    "employee_can_access",
    {
      p_company_id: membership.company_id,
      p_module: rule.permissionModule,
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