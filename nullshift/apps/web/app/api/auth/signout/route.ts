import { NextResponse } from "next/server";
import { createClient } from "@nullshift/db";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Redirect to portal login by default; callers that need the learn login
  // should post to a dedicated route or pass a `next` query param.
  const referer = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return NextResponse.redirect(new URL("/portal/login", referer));
}
