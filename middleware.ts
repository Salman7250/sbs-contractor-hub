import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type PermissionRule = {
  prefix: string;
  module: string;
  action: string;
};

const PROTECTED_ROUTES: PermissionRule[] = [
  { prefix: "/", module: "dashboard", action: "view" },

  { prefix: "/customers", module: "customers", action: "view" },
  { prefix: "/leads", module: "leads", action: "view" },
  { prefix: "/jobs", module: "jobs", action: "view" },
  { prefix: "/estimates", module: "quotes", action: "view" },
  { prefix: "/sales", module: "sales_orders", action: "view" },
  { prefix: "/invoices", module: "invoices", action: "view" },
  { prefix: "/payments", module: "payments", action: "view" },

  { prefix: "/products", module: "products", action: "view" },
  { prefix: "/serial-numbers", module: "serial_numbers", action: "view" },
  { prefix: "/inventory", module: "inventory", action: "view" },
  { prefix: "/warehouses", module: "warehouses", action: "view" },
  { prefix: "/pricing", module: "pricing", action: "view" },

  { prefix: "/suppliers", module: "suppliers", action: "view" },
  { prefix: "/purchase-orders", module: "purchase_orders", action: "view" },
  { prefix: "/expenses", module: "expenses", action: "view" },

  { prefix: "/warranty", module: "warranty", action: "view" },
  { prefix: "/repairs", module: "repairs", action: "view" },
  { prefix: "/rma", module: "rma", action: "view" },
  { prefix: "/service-providers", module: "service_jobs", action: "view" },
  { prefix: "/service-jobs", module: "service_jobs", action: "view" },

  { prefix: "/b2b-portal", module: "b2b_portal", action: "view" },
  { prefix: "/reports", module: "reports", action: "view" },
  { prefix: "/employees", module: "employees", action: "view" },
  { prefix: "/documents", module: "documents", action: "view" },
  { prefix: "/settings", module: "settings", action: "view" },
];

function getPermissionRule(pathname: string): PermissionRule | null {
  return (
    PROTECTED_ROUTES
      .slice()
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find(
        (rule) =>
          pathname === rule.prefix ||
          pathname.startsWith(`${rule.prefix}/`),
      ) ?? null
  );
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
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

  const rule = getPermissionRule(pathname);

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

  /*
   * The database function is the source of truth. It recognizes
   * platform admins, company admins, and employee role permissions.
   */
  const { data: allowed, error: permissionError } = await supabase.rpc(
    "employee_can_access",
    {
      p_company_id: membership.company_id,
      p_module: rule.module,
      p_action: rule.action,
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
