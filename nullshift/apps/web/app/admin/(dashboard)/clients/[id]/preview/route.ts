import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireStaff } from "@nullshift/auth/guards";
import { createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { PREVIEW_COOKIE } from "@/lib/clientPreview";

export const dynamic = "force-dynamic";

/**
 * Start a "view portal as client" preview — as a plain navigation.
 *
 * This exists because the button that did this as a form + server action was
 * reported as unpressable, and a form-with-server-action inside a client
 * component has several ways to do nothing visible: an unhydrated island, a
 * pointer-events rule from an ancestor, an overlay, or the action returning
 * early and re-rendering the same page. A `<Link>` to this route has none of
 * them — it works with JavaScript disabled and cannot silently no-op, because
 * every refusal below redirects somewhere that says why.
 *
 * A GET that sets a cookie is a deliberate trade. It is staff-gated, it is
 * audited, it changes nothing about the client's data, and it expires itself
 * in two hours — a read-only view toggle, not a mutation.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = await params;
  // Relative to the request, never NEXT_PUBLIC_SITE_URL: on a Vercel preview
  // deployment that env var points at production, and a staff member clicking
  // "view as client" on a preview build would be thrown out to the live site.
  const base = req.url;

  const staff = await requireStaff();
  if (!staff.ok) {
    return NextResponse.redirect(new URL("/admin/login", base));
  }
  if (!tenantId) {
    return NextResponse.redirect(new URL("/admin/clients", base));
  }

  const service = createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) {
    // The one case that used to look identical to "the button is broken".
    return NextResponse.redirect(
      new URL("/admin/clients?preview_error=unknown_client", base)
    );
  }

  (await cookies()).set(PREVIEW_COOKIE, tenantId, {
    path: "/portal",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 2, // auto-expires — a forgotten preview never lingers
  });

  await logAudit({
    action: "client_preview.started",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { staff: staff.email, via: "link" },
  });

  // A fresh document every time — never a cached portal frame.
  const res = NextResponse.redirect(new URL("/portal", base));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
