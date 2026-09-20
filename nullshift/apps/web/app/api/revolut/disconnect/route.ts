import { NextResponse } from "next/server";
import { requireStaff } from "@nullshift/auth/guards";
import { createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { readRevolutEnv } from "@/lib/revolut/client";
import { activeConnection, revokeConnection } from "@/lib/revolut/store";

export const dynamic = "force-dynamic";

/** POST /api/revolut/disconnect — staff; marks the active connection revoked and deletes its secrets. */
export async function POST() {
  const staff = await requireStaff();
  if (!staff.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const env = readRevolutEnv();
  if (!env.ok) return NextResponse.json({ ok: true, skipped: "not_configured" });
  const conn = await activeConnection(createServiceClient(), env.value.environment);
  if (!conn) return NextResponse.json({ ok: true, skipped: "not_connected" });
  await revokeConnection(conn.id, staff.userId);
  await logAudit({ action: "revolut.disconnected", target: `revolut_connection:${conn.id}` });
  return NextResponse.json({ ok: true, connectionId: conn.id });
}
