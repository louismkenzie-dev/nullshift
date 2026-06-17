import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";

/**
 * GET /api/admin/project-updates?client_id=<id>
 * Returns all updates for a client, newest first.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("project_updates")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updates: data ?? [] });
}

/**
 * POST /api/admin/project-updates  (multipart/form-data)
 *
 * Fields:
 *   client_id      string (required)
 *   type           "update" | "decision" | "branding"
 *   title          string (required)
 *   body           string
 *   requires_action "true" | "false"
 *   options        JSON string — array of {id,label,description?,image_url?}
 *   images         File (repeatable) — uploaded to Supabase Storage "project-updates" bucket
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const clientId       = (formData.get("client_id") as string | null)?.trim();
  const type           = (formData.get("type") as string | null) ?? "update";
  const title          = (formData.get("title") as string | null)?.trim();
  const body           = (formData.get("body") as string | null)?.trim() || null;
  const requiresAction = formData.get("requires_action") === "true";
  const optionsRaw     = formData.get("options") as string | null;

  if (!clientId || !title) {
    return NextResponse.json({ error: "client_id and title are required." }, { status: 400 });
  }

  const supabase = (() => { try { return createServiceClient(); } catch { return null; } })();
  if (!supabase) return NextResponse.json({ error: "Backend not configured." }, { status: 500 });

  // ── Upload image files to Supabase Storage ──────────────────────────────
  const files = formData.getAll("images") as File[];
  const imageUrls: string[] = [];

  for (const file of files) {
    if (!file || file.size === 0) continue;
    const ext  = file.name.split(".").pop() ?? "bin";
    const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buf  = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from("project-updates")
      .upload(path, buf, { contentType: file.type, upsert: false });

    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage
        .from("project-updates")
        .getPublicUrl(path);
      imageUrls.push(publicUrl);
    } else {
      console.error("Storage upload error:", uploadErr.message);
    }
  }

  const options = (() => {
    try { return optionsRaw ? JSON.parse(optionsRaw) : []; }
    catch { return []; }
  })();

  const { data, error } = await supabase
    .from("project_updates")
    .insert({
      client_id: clientId,
      type,
      title,
      body,
      image_urls: imageUrls,
      requires_action: requiresAction,
      action_resolved: false,
      options,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, update: data });
}
