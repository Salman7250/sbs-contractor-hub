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
   * Always refresh the Supabase auth session before making
   * authorization decisions.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPublicPath(pathname)) {
    if (user && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return response;
  }

  const rule = getModuleRouteRule(pathname);

  /*
   * Routes that are not part of the employee workspace are left
   * alone. This keeps public/customer-specific routes from being
   * accidentally intercepted by employee RBAC.
   */
  if (!rule) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(loginUrl);
  }

  /*
   * Resolve the caller's company. The application currently uses
   * the first company_members record for the signed-in workspace.
   */
  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.company_id) {
    return NextResponse.redirect(
      new URL("/login?error=no-company", request.url),
    );
  }

  if (rule.entitlementModule) {
    try {
      const hasEntitlement = await hasCompanyModuleAccess(
        supabase,
        membership.company_id,
        rule.entitlementModule,
      );

      if (!hasEntitlement) {
        return NextResponse.redirect(
          new URL("/?error=module-not-in-plan", request.url),
        );
      }
    } catch (error) {
      console.error("Middleware module access check failed:", error);

      return NextResponse.redirect(
        new URL("/?error=module-access-check-failed", request.url),
      );
    }
  }

  /*
   * The database function is the source of truth. It recognizes
   * platform admins, company admins, and employee role permissions.
   */
  const { data: allowed, error: permissionError } = await supabase.rpc(
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
      new URL("/?error=permission-check-failed", request.url),
    );
  }

  if (!allowed) {
    return NextResponse.redirect(
      new URL("/?error=access-denied", request.url),
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run middleware for application routes while excluding
     * Next internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2|ttf)$).*)",
  ],
};
