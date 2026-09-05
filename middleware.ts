import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
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
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isLoginPage = pathname === "/login";

  if (!user && !isLoginPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginPage) {
    const redirectTo =
      request.nextUrl.searchParams.get("redirectTo") || "/";

    const safeRedirect =
      redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : "/";

    const appUrl = request.nextUrl.clone();
    appUrl.pathname = safeRedirect;
    appUrl.search = "";

    return NextResponse.redirect(appUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/leads/:path*",
    "/customers/:path*",
    "/jobs/:path*",
    "/estimates/:path*",
    "/invoices/:path*",
    "/settings/:path*",
    "/sales/:path*",
    "/login",
  ],
};