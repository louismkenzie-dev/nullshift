import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { maskFor } from "@/lib/vault/records";
import { deleteRecord, revealRecord, saveRecord } from "./actions";

/**
 * Business vault — Null Shift's own sensitive references (HMRC UTR,
 * Companies House authentication code, policy and account numbers).
 *
 * Values are encrypted in Supabase Vault, whose key lives outside the
 * database: this page never loads one. A value is fetched only when someone
 * presses Reveal, which needs a two-factor session and is written to the
 * audit trail every time, successful or not.
 */
export const dynamic = "force-dynamic";

type Record = {
  id: string;
  name: string;
  note: string | null;
  hint: string | null;
  secret_id: string | null;
  updated_at: string;
  updated_by: string | null;
  last_revealed_at: string | null;
  last_revealed_by: string | null;
};

const mono = {
  fontFamily: T.mono,
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--k-muted)",
};

const inp: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.88rem",
  padding: "8px 10px",
  background: "var(--k-bg)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 2,
  width: "100%",
};

const btn = (bg: string, fg: string): React.CSSProperties => ({
  fontFamily: T.mono,
  fontSize: 11,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  padding: "8px 13px",
  background: bg,
  color: fg,
  border: "1px solid var(--k-border)",
  borderRadius: 2,
  cursor: "pointer",
});

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{
    err?: string;
    saved?: string;
    deleted?: string;
    edit?: string;
    shown?: string;
    value?: string;
  }>;
}) {
  if (!(await requireStaff()).ok) notFound();
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("business_records")
    .select(
      "id, name, note, hint, secret_id, updated_at, updated_by, last_revealed_at, last_revealed_by"
    )
    .order("name");
  const records = (rows ?? []) as Record[];
  const editing = sp.edit ? records.find((r) => r.id === sp.edit) : null;

  return (
    <div>
      <PageHeader
        index="12"
        label="Admin"
        title="Business vault"
        lead="Null Shift's own sensitive references — HMRC UTR, Companies House codes, policy and account numbers. Encrypted at rest; revealing one needs two-factor and is logged."
        actions={
          <span style={mono}>
            {records.length} record{records.length === 1 ? "" : "s"}
          </span>
        }
      />

      {(sp.err || sp.saved || sp.deleted) && (
        <Reveal className="block" delay={0.03}>
          <div
            role="status"
            style={{
              border: `1px solid ${sp.err ? "var(--k-danger)" : "var(--k-success)"}`,
              borderRadius: 2,
              padding: "10px 14px",
              margin: "18px 0 0",
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: sp.err ? "var(--k-danger)" : "var(--k-fg)",
            }}
          >
            {sp.err ?? (sp.deleted ? "Record deleted." : "Saved.")}
          </div>
        </Reveal>
      )}

      {/* A revealed value, shown once. Navigating anywhere clears it. */}
      {sp.shown && sp.value !== undefined && (
        <Reveal className="block" delay={0.04}>
          <Panel label="// REVEALED" style={{ marginTop: 18 }}>
            <p style={{ ...mono, marginBottom: 6 }}>
              {records.find((r) => r.id === sp.shown)?.name ?? "Value"}
            </p>
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "1.05rem",
                color: "var(--k-fg)",
                wordBreak: "break-all",
                margin: 0,
              }}
            >
              {sp.value || "(empty)"}
            </p>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: "var(--k-faint)",
                margin: "10px 0 0",
              }}
            >
              This view was recorded in the audit trail.{" "}
              <Link href="/admin/vault" style={{ color: "var(--k-accent)" }}>
                Hide it
              </Link>
            </p>
          </Panel>
        </Reveal>
      )}

      {/* ── Add / edit ─────────────────────────────────────── */}
      <Reveal className="block" delay={0.05}>
        <Panel
          label={editing ? "// EDIT RECORD" : "// ADD RECORD"}
          style={{ margin: "18px 0 16px" }}
        >
          <form action={saveRecord} className="flex flex-col gap-3">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <label className="flex flex-col gap-1.5">
                <span style={mono}>Name</span>
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editing?.name ?? ""}
                  placeholder="HMRC UTR"
                  style={inp}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span style={mono}>Value</span>
                <input
                  name="value"
                  type="password"
                  autoComplete="off"
                  maxLength={2000}
                  placeholder={
                    editing ? "Leave blank to keep the current value" : "1234567890"
                  }
                  style={inp}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span style={mono}>Note (optional)</span>
              <input
                name="note"
                maxLength={500}
                defaultValue={editing?.note ?? ""}
                placeholder="Where it is used, who issued it"
                style={inp}
              />
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <SubmitButton
                style={btn("var(--k-accent)", "var(--k-on-accent)")}
                pendingLabel="Saving…"
              >
                {editing ? "Save changes" : "Add record"}
              </SubmitButton>
              {editing && (
                <Link href="/admin/vault" style={{ ...mono, textDecoration: "none" }}>
                  Cancel
                </Link>
              )}
            </div>
          </form>
        </Panel>
      </Reveal>

      {/* ── Records ────────────────────────────────────────── */}
      <Reveal className="block" delay={0.07}>
        <Panel label="// RECORDS" pad={false}>
          {records.length === 0 ? (
            <p
              className="text-center py-8"
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
            >
              Nothing stored yet. Add your HMRC UTR above and it will be encrypted before
              it touches the database.
            </p>
          ) : (
            records.map((r, i) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2"
                style={{
                  padding: "12px 14px",
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                }}
              >
                <div className="min-w-0" style={{ flex: "1 1 220px" }}>
                  <div
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {r.name}
                  </div>
                  {r.note && (
                    <div
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.8rem",
                        color: "var(--k-faint)",
                        marginTop: 2,
                      }}
                    >
                      {r.note}
                    </div>
                  )}
                  <div style={{ ...mono, marginTop: 4 }}>
                    Updated {shortDate(r.updated_at)}
                    {r.updated_by ? ` by ${r.updated_by}` : ""}
                    {r.last_revealed_at
                      ? ` · last revealed ${shortDate(r.last_revealed_at)}${r.last_revealed_by ? ` by ${r.last_revealed_by}` : ""}`
                      : ""}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.9rem",
                    color: "var(--k-muted)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {maskFor(r.hint)}
                </span>
                {!r.secret_id && <StatusChip tone="danger">No value stored</StatusChip>}
                <div className="flex items-center gap-2 flex-wrap">
                  <form action={revealRecord}>
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton
                      style={btn("transparent", "var(--k-fg)")}
                      disabled={!r.secret_id}
                      pendingLabel="Revealing…"
                    >
                      Reveal
                    </SubmitButton>
                  </form>
                  <Link
                    href={`/admin/vault?edit=${r.id}`}
                    style={{
                      ...btn("transparent", "var(--k-muted)"),
                      textDecoration: "none",
                    }}
                  >
                    Edit
                  </Link>
                  <form action={deleteRecord}>
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton style={btn("transparent", "var(--k-danger)")}>
                      Delete
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ))
          )}
        </Panel>
      </Reveal>

      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.8rem",
          color: "var(--k-faint)",
          marginTop: 14,
        }}
      >
        Values are encrypted with a key held outside the database, so a database backup
        does not contain them. Revealing one requires two-factor authentication — set it
        up under{" "}
        <Link href="/admin/security" style={{ color: "var(--k-accent)" }}>
          Security
        </Link>{" "}
        if Reveal refuses.
      </p>
    </div>
  );
}
