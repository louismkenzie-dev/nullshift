import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";

/**
 * Portal app proxy (Next.js 16 middleware). Refreshes the Supabase auth session
 * on every /portal request so Server Components see a fresh user. Per-tenant
 * authorisation (a client only ever sees their own tenant's rows) is enforced by
 * RLS + the dashboard layout's session check, not here.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseBrowserConfig()) {
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

  // Refresh the session (rotates the cookie when needed).
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/portal/:path*"],
};
