import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasCompanyModuleAccess } from "@/lib/auth/module-access";
import { getModuleRouteRule } from "@/lib/navigation/module-routes";

type PlatformRuntimePolicy = {
  maintenance_mode: boolean;
  platform_lockdown: boolean;
  new_company_signups_enabled: boolean;
  is_platform_admin: boolean;
  platform_admin_role: "super_admin" | "support" | null;
};

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/set-password" ||
    pathname === "/onboarding" ||
    pathname === "/account-suspended" ||
    pathname === "/maintenance" ||
    pathname.startsWith("/auth/")
  );
}

function isPlatformAdminPath(pathname: string) {
  return pathname === "/sbs-admin" || pathname.startsWith("/sbs-admin/");
}

function isMaintenanceExemptPath(pathname: string) {
  return (
    pathname === "/maintenance" ||
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/set-password" ||
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

  const pathname = request.nextUrl.pathname;

  /*
   * ---------------------------------------------------------
   * AUTHENTICATION
   * ---------------------------------------------------------
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * ---------------------------------------------------------
   * PLATFORM RUNTIME POLICY
   * ---------------------------------------------------------
   *
   * This is intentionally resolved before company-level
   * authorization so platform-wide emergency controls can
   * stop access before normal workspace checks run.
   *
   * Anonymous users do not need this policy because the
   * public application routes remain available.
   */
  let platformPolicy: PlatformRuntimePolicy | null = null;

  if (user) {
    const {
      data,
      error: platformPolicyError,
    } = await supabase.rpc(
      "get_platform_runtime_policy",
    );

    if (platformPolicyError) {
      console.error(
        "Platform runtime policy lookup failed:",
        platformPolicyError,
      );

      /*
       * Fail closed for authenticated application users.
       * Platform-admin routes are also blocked if the platform
       * policy cannot be safely determined.
       *
       * This prevents a runtime policy failure from accidentally
       * bypassing maintenance or lockdown.
       */
      if (
        pathname !== "/login" &&
        !isMaintenanceExemptPath(pathname)
      ) {
        return NextResponse.redirect(
          new URL(
            "/maintenance?reason=policy-check-failed",
            request.url,
          ),
        );
      }
    } else {
      platformPolicy =
        data as PlatformRuntimePolicy | null;
    }
  }

  const isPlatformAdmin =
    platformPolicy?.is_platform_admin === true;

  const isPlatformAdminRoute =
    isPlatformAdminPath(pathname);

  /*
   * ---------------------------------------------------------
   * PLATFORM ADMIN ACCESS
   * ---------------------------------------------------------
   *
   * Platform admins can always reach /sbs-admin during
   * maintenance mode or platform lockdown.
   *
   * Non-admin users are never allowed to use the platform
   * admin area.
   */
  if (isPlatformAdminRoute) {
    if (!user) {
      const loginUrl = new URL(
        "/login",
        request.url,
      );

      loginUrl.searchParams.set(
        "redirectTo",
        `${pathname}${request.nextUrl.search}`,
      );

      return NextResponse.redirect(loginUrl);
    }

    if (!isPlatformAdmin) {
      return NextResponse.redirect(
        new URL(
          "/?error=platform-admin-access-denied",
          request.url,
        ),
      );
    }

    return response;
  }

  /*
   * ---------------------------------------------------------
   * PLATFORM MAINTENANCE / LOCKDOWN
   * ---------------------------------------------------------
   *
   * Platform admins bypass both controls.
   *
   * Maintenance mode and lockdown intentionally stop normal
   * authenticated application traffic before company-level
   * authorization is evaluated.
   */
  if (
    user &&
    platformPolicy &&
    !isPlatformAdmin &&
    (
      platformPolicy.maintenance_mode ||
      platformPolicy.platform_lockdown
    ) &&
    !isMaintenanceExemptPath(pathname)
  ) {
    const maintenanceUrl = new URL(
      "/maintenance",
      request.url,
    );

    if (platformPolicy.platform_lockdown) {
      maintenanceUrl.searchParams.set(
        "mode",
        "lockdown",
      );
    } else {
      maintenanceUrl.searchParams.set(
        "mode",
        "maintenance",
      );
    }

    return NextResponse.redirect(
      maintenanceUrl,
    );
  }

  /*
   * ---------------------------------------------------------
   * SUSPENDED ACCOUNT PAGE
   * ---------------------------------------------------------
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
    if (pathname === "/portal/login") {
      return response;
    }

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

    return response;
  }

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

  if (!rule) {
    return response;
  }

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

  const company = Array.isArray(
    membership.companies,
  )
    ? membership.companies[0]
    : membership.companies;

  /*
   * ---------------------------------------------------------
   * SUSPENDED COMPANY CHECK
   * ---------------------------------------------------------
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
      p_action:
        "view",
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
