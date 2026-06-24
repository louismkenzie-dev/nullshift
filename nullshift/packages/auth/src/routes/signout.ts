import { NextResponse } from "next/server";
import { createClient } from "@nullshift/db";

export async function POST(req: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // After signing out, land on the homepage. Build the URL from the request
  // origin (NOT NEXT_PUBLIC_SITE_URL, which may be unset → localhost → "site not
  // found"), and use 303 so the browser follows with a GET rather than re-POSTing
  // to a page route (a 307/308 re-POST 404s). Callers may pass a relative `next`.
  const raw = new URL(req.url).searchParams.get("next") || "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return NextResponse.redirect(new URL(next, req.url), 303);
}
