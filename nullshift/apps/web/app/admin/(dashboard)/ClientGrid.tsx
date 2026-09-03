"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { T } from "@nullshift/ui/tokens";
import { StatusChip } from "@/components/app/AppKit";
import type { TileKey, Tone } from "@/lib/hub/rules";
import { openLead } from "./pipeline/actions";

/**
 * The client grid body — a search box, a count strip, the Enquiries row, the
 * client blocks and the Platform row. Pure presentation over the rows the
 * server page folded; the only interaction that reaches the server is the
 * openLead form on an enquiry block (the pipeline's existing action).
 */

export type GridBlock = {
  id: string;
  name: string;
  /** Lower-cased haystack for the search box. */
  search: string;
  vertical: string | null;
  contact: string | null;
  colour: { tone: Tone; label: string };
  summary: string;
  awaitingSignature: number;
  dots: { key: TileKey; title: string; tone: Tone; label: string }[];
};

export type GridLead = {
  id: string;
  name: string;
  sub: string;
  search: string;
  status: string;
  leadScore: number | null;
  requestedDate: string | null;
  /** Only leads with an email can be opened as a client (pipeline rule). */
  canOpen: boolean;
};

const TONE_COLOR: Record<Tone, string> = {
  danger: T.danger,
  warning: T.warning,
  success: T.success,
  muted: "var(--k-muted)",
};

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.62rem",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const rowLabel: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 10,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--k-faint)",
  marginBottom: 10,
};

const dateGB = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function blockStyle(tone: Tone): React.CSSProperties {
  return {
    background: "var(--k-surface)",
    borderLeft: `3px solid ${TONE_COLOR[tone]}`,
    padding: "14px 15px",
    textDecoration: "none",
    minHeight: 118,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    height: "100%",
    width: "100%",
    textAlign: "left",
    color: "inherit",
  };
}

function BlockCard({ block }: { block: GridBlock }) {
  return (
    <Link
      href={`/admin/clients/${block.id}`}
      className="k-kard k-kard-h"
      style={blockStyle(block.colour.tone)}
      title={`Open ${block.name}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-0.5 min-w-0">
          <span
            className="truncate"
            style={{
              fontFamily: T.sans,
              fontWeight: 700,
              fontSize: "0.95rem",
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: "var(--k-fg)",
            }}
          >
            {block.name}
          </span>
          <span className="truncate" style={{ ...mono, color: "var(--k-muted)" }}>
            {block.summary}
          </span>
        </span>
        <StatusChip tone={block.colour.tone}>{block.colour.label}</StatusChip>
      </span>

      <span
        className="flex items-center justify-between gap-3"
        style={{ marginTop: "auto" }}
      >
        {/* Seven tile dots — hover for the tile name and its state. */}
        <span className="flex items-center gap-1.5" aria-label="Tile states">
          {block.dots.map((d) => (
            <span
              key={d.key}
              title={`${d.title}: ${d.label}`}
              aria-label={`${d.title}: ${d.label}`}
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: TONE_COLOR[d.tone],
                opacity: d.tone === "muted" ? 0.45 : 1,
                boxShadow:
                  d.tone === "danger"
                    ? `0 0 0 2px color-mix(in oklab, ${T.danger} 25%, transparent)`
                    : "none",
                flexShrink: 0,
              }}
            />
          ))}
        </span>
        {block.awaitingSignature > 0 && (
          <span
            style={{
              ...mono,
              fontSize: "0.56rem",
              color: T.warning,
              border: `1px solid color-mix(in oklab, ${T.warning} 45%, transparent)`,
              padding: "2px 6px",
              whiteSpace: "nowrap",
            }}
          >
            {block.awaitingSignature} awaiting signature
          </span>
        )}
      </span>
    </Link>
  );
}

function LeadCard({ lead }: { lead: GridLead }) {
  const inner = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-0.5 min-w-0">
          <span
            className="truncate"
            style={{
              fontFamily: T.sans,
              fontWeight: 700,
              fontSize: "0.95rem",
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: "var(--k-fg)",
            }}
          >
            {lead.name}
          </span>
          <span className="truncate" style={{ ...mono, color: "var(--k-muted)" }}>
            {lead.sub || "No contact details"}
          </span>
        </span>
        <StatusChip tone="danger">Enquiry</StatusChip>
      </span>
      <span
        className="flex items-center justify-between gap-3"
        style={{ ...mono, color: "var(--k-muted)", marginTop: "auto" }}
      >
        <span>
          {lead.status.replace(/_/g, " ")}
          {lead.leadScore !== null ? ` · score ${lead.leadScore}` : ""}
          {lead.requestedDate ? ` · call ${dateGB(lead.requestedDate)}` : ""}
        </span>
        <span style={{ color: T.danger }}>
          {lead.canOpen ? "Open as client →" : "No email · pipeline →"}
        </span>
      </span>
    </>
  );
  if (!lead.canOpen)
    return (
      <Link
        href="/admin/pipeline"
        className="k-kard k-kard-h"
        style={blockStyle("danger")}
        title="This enquiry has no email address — manage it on the pipeline"
      >
        {inner}
      </Link>
    );
  return (
    <form action={openLead} className="h-full">
      <input type="hidden" name="id" value={lead.id} />
      <button
        type="submit"
        className="k-kard k-kard-h cursor-pointer"
        style={blockStyle("danger")}
        title="Open this enquiry as a client (creates the client block)"
      >
        {inner}
      </button>
    </form>
  );
}

function Count({ tone, label, n }: { tone: Tone; label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: TONE_COLOR[tone],
          opacity: tone === "muted" ? 0.5 : 1,
        }}
      />
      <span style={{ fontFamily: T.sans, fontWeight: 800, color: "var(--k-fg)" }}>
        {n}
      </span>
      <span style={{ ...mono, color: "var(--k-muted)" }}>{label}</span>
    </span>
  );
}

export function ClientGrid({
  clients,
  enquiries,
  platform,
}: {
  clients: GridBlock[];
  enquiries: GridLead[];
  platform: GridBlock[];
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const shownClients = useMemo(
    () => (needle ? clients.filter((c) => c.search.includes(needle)) : clients),
    [clients, needle]
  );
  const shownLeads = useMemo(
    () => (needle ? enquiries.filter((l) => l.search.includes(needle)) : enquiries),
    [enquiries, needle]
  );
  const shownPlatform = useMemo(
    () => (needle ? platform.filter((c) => c.search.includes(needle)) : platform),
    [platform, needle]
  );

  const green = clients.filter((c) => c.colour.tone === "success").length;
  const orange = clients.filter((c) => c.colour.tone === "warning").length;
  const red = clients.filter((c) => c.colour.tone === "danger").length;

  return (
    <div className="mt-6 flex flex-col gap-7">
      {/* Count strip + search */}
      <div
        className="k-kard flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
        style={{ background: "var(--k-surface)", padding: "12px 16px" }}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Count tone="success" label="signed" n={green} />
          <Count tone="warning" label="awaiting signature" n={orange} />
          <Count tone="danger" label="not sent" n={red} />
          <Count tone="danger" label="enquiries" n={enquiries.length} />
        </div>
        <label
          className="inline-flex items-center gap-2"
          style={{
            border: "1px solid var(--k-border)",
            padding: "6px 10px",
            minWidth: 220,
            background: "var(--k-bg)",
          }}
        >
          <Search size={13} color="var(--k-muted)" strokeWidth={1.8} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by client name"
            aria-label="Filter clients by name"
            style={{
              background: "transparent",
              border: 0,
              outline: "none",
              fontFamily: T.mono,
              fontSize: 12,
              color: "var(--k-fg)",
              width: "100%",
            }}
          />
        </label>
      </div>

      {/* Enquiries — leads with no client yet */}
      {shownLeads.length > 0 && (
        <section>
          <div style={rowLabel}>
            {"// ENQUIRIES"} · {shownLeads.length}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shownLeads.map((l) => (
              <LeadCard key={l.id} lead={l} />
            ))}
          </div>
        </section>
      )}

      {/* Clients */}
      <section>
        <div style={rowLabel}>
          {"// CLIENTS"} · {shownClients.length}
          {needle && shownClients.length !== clients.length
            ? ` of ${clients.length}`
            : ""}
        </div>
        {shownClients.length === 0 ? (
          <div
            className="k-kard"
            style={{
              background: "var(--k-surface)",
              padding: "28px 18px",
              textAlign: "center",
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: "var(--k-muted)",
            }}
          >
            {needle ? (
              <>No client matches &ldquo;{q.trim()}&rdquo;.</>
            ) : (
              <>
                No clients yet — open an enquiry above or{" "}
                <Link href="/admin/clients" style={{ color: "var(--k-accent)" }}>
                  add a client
                </Link>
                .
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shownClients.map((c) => (
              <BlockCard key={c.id} block={c} />
            ))}
          </div>
        )}
      </section>

      {/* Platform — the internal tenant, no traffic light */}
      {shownPlatform.length > 0 && (
        <section>
          <div style={rowLabel}>{"// PLATFORM"}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shownPlatform.map((c) => (
              <BlockCard key={c.id} block={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
