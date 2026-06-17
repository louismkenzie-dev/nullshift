import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";

/**
 * Admin app proxy (Next.js 16 middleware). Refreshes the Supabase auth session on
 * every request and gates the whole admin area behind a logged-in staff user.
 * The email-allowlist authorisation check still happens in the dashboard layout
 * (and will move to membership-based roles in Phase 1).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // If Supabase isn't configured yet, keep the admin routes usable and send
  // users to the login screen instead of crashing the request pipeline.
  if (!hasSupabaseBrowserConfig()) {
    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("setup", "1");
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLogin = pathname === "/admin/login";

  // Not logged in → bounce to login (except the login page itself)
  if (!isLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already logged in and hitting the login page → send to dashboard
  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
