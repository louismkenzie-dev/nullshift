import { notFound } from "next/navigation";
import { getProposal, resolveClientByToken } from "@/lib/studio/data";
import { ClientShell, ProposalDocument } from "@/components/studio/Documents";
import { acceptAction, declineAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClientProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token, id } = await params;
  const sp = await searchParams;
  const hit = await resolveClientByToken(token);
  if (!hit) notFound();
  const p = await getProposal(hit.client.tenant_id, id);
  if (!p || p.client_id !== hit.client.id || p.status === "draft") notFound();
  const { profile, client } = hit;
  const expired = p.valid_until
    ? p.valid_until < new Date().toISOString().slice(0, 10)
    : false;
  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 24,
    marginTop: 16,
  };
  return (
    <ClientShell brand={profile.brand} poweredBy={hit.trialing}>
      <a
        href={`/c/${token}`}
        style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}
      >
        ← All documents
      </a>
      <div style={{ marginTop: 12 }}>
        <ProposalDocument p={p} profile={profile} client={client} />
      </div>
      <div
        style={{ ...card, borderColor: p.status === "accepted" ? "#a7f3d0" : "#e5e7eb" }}
      >
        {p.status === "accepted" ? (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, color: "#059669" }}>
              Accepted
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>
              Accepted by {p.accepted_name} on{" "}
              {new Date(p.accepted_at!).toLocaleString("en-GB")}.<br />
              <span
                style={{
                  color: "#9ca3af",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 12,
                }}
              >
                Record SHA-256 {p.accepted_hash}
              </span>
            </p>
          </>
        ) : p.status === "declined" ? (
          <p style={{ margin: 0, color: "#6b7280" }}>
            You declined this proposal. {profile.brand.name} has been told.
          </p>
        ) : expired ? (
          <p style={{ margin: 0, color: "#6b7280" }}>
            This proposal expired on{" "}
            {new Date(p.valid_until!).toLocaleDateString("en-GB")}. Contact{" "}
            {profile.brand.name} for a fresh one.
          </p>
        ) : (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Accept this proposal</h2>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 14,
                color: "#374151",
                lineHeight: 1.6,
              }}
            >
              Typing your full name and pressing Accept is your electronic signature. We
              record your name, the time and a hash of exactly what you accepted, and
              email you a copy.
            </p>
            {sp.error && <p style={{ color: "#dc2626", fontSize: 14 }}>{sp.error}</p>}
            <form
              action={acceptAction}
              style={{ display: "grid", gap: 12, maxWidth: 420 }}
            >
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="id" value={p.id} />
              <input
                name="name"
                required
                placeholder="Your full name"
                style={{
                  height: 46,
                  padding: "0 14px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 16,
                }}
              />
              <label style={{ display: "flex", gap: 10, fontSize: 14, color: "#374151" }}>
                <input type="checkbox" name="agree" required /> I have read the scope,
                investment and terms and accept them on behalf of{" "}
                {client.company || "myself"}.
              </label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="submit"
                  style={{
                    height: 46,
                    padding: "0 22px",
                    background: profile.brand.colour,
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  Accept proposal
                </button>
                <button
                  type="submit"
                  formAction={declineAction}
                  style={{
                    height: 46,
                    padding: "0 18px",
                    background: "transparent",
                    color: "#6b7280",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  Decline
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </ClientShell>
  );
}
