import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PREVIEW_COOKIE } from "@/lib/clientPreview";

export const dynamic = "force-dynamic";

/**
 * Leave a "view portal as client" preview.
 *
 * A plain navigation, for the same reason as the route that starts one: a
 * button that might not be hydrated is a button that might strand a staff
 * member inside a read-only portal. This lives under /portal because the
 * preview cookie is path-scoped there and can only be cleared from a request
 * that path matches.
 */
export async function GET(req: Request) {
  // Relative to the request — see the note in the route that starts a preview.
  const base = req.url;
  const store = await cookies();
  const tenantId = store.get(PREVIEW_COOKIE)?.value;

  store.set(PREVIEW_COOKIE, "", {
    path: "/portal",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });

  const res = NextResponse.redirect(
    new URL(tenantId ? `/admin/clients/${tenantId}` : "/admin/clients", base)
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}
