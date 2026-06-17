import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";

/* Public endpoint — the client-facing proposal page posts here to record a
   signature/acceptance. Uses the service-role client so no broad anon RLS
   is needed; the proposal id (a UUID) is the access token. */
export async function POST(request: Request) {
  let body: { id?: string; name?: string; signature?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = body.id?.trim();
  const name = body.name?.trim();
  const signature = body.signature?.trim();
  if (!id || !name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    // Don't allow re-accepting an already accepted proposal.
    const { data: existing } = await supabase.from("proposals").select("accepted_at, client_id").eq("id", id).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    if (existing.accepted_at) return NextResponse.json({ error: "This proposal has already been accepted." }, { status: 409 });

    const { error } = await supabase.from("proposals").update({
      accepted_at: new Date().toISOString(),
      accepted_name: name,
      accepted_signature: signature || name,
      status: "accepted",
    }).eq("id", id);
    if (error) return NextResponse.json({ error: "Could not record acceptance." }, { status: 500 });

    // Accepted proposal → mark the client as won.
    if (existing.client_id) {
      await supabase.from("clients").update({ status: "won" }).eq("id", existing.client_id);
    }
  } catch {
    return NextResponse.json({ error: "Backend not configured." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
