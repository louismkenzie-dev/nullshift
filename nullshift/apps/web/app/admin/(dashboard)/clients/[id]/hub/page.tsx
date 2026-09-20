import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IdCard,
  CreditCard,
  Bug,
  Shield,
  Gauge,
  Users,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { clientRef } from "@nullshift/ui/format";
import { PageHeader, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { StageStepper } from "@/components/portal/StageStepper";
import { loadClientBlock } from "@/lib/hub/load";
import {
  TILE_ORDER,
  TILE_TITLE,
  tileStates,
  type TileKey,
  type Tone,
} from "@/lib/hub/rules";

/**
 * Client block — one page per client (tenant), mirroring the portal home: the
 * client's name and signature-state chip, the primary system's StageStepper,
 * quick facts, then the seven tiles (Passport, Billing and Payment, Issues and
 * Bugs, Care Plan, Scale and Risk, Account management, Docs and Legal) as a
 * three-column grid of coloured, iconed cards. Every tile's colour and sub-line
 * comes from tileStates() — the same rule the Dashboard grid dots use.
 */
export const dynamic = "force-dynamic";

const TILE_ICON: Record<TileKey, LucideIcon> = {
  passport: IdCard,
  billing: CreditCard,
  issues: Bug,
  carePlan: Shield,
  scale: Gauge,
  account: Users,
  docs: FileText,
};

const TONE_COLOR: Record<Tone, string> = {
  danger: T.danger,
  warning: T.warning,
  success: T.success,
  muted: "var(--k-muted)",
};

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  textDecoration: "none",
};

const factLabel: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.58rem",
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--k-faint)",
};

const factValue: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.86rem",
  color: "var(--k-fg)",
  overflowWrap: "anywhere",
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span style={factLabel}>{label}</span>
      <span style={factValue}>{children}</span>
    </div>
  );
}

export default async function ClientBlockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tenantId } = await params;
  if (!(await requireStaff()).ok) notFound();
  const block = await loadClientBlock(tenantId);
  if (!block) notFound();
  const tiles = tileStates(block);
  const project = block.project;
  const owners = project
    ? (
        [
          ["Account", project.owners.account],
          ["Delivery", project.owners.delivery],
          ["Technical", project.owners.technical],
          ["Finance", project.owners.finance],
        ] as const
      ).filter(([, v]) => !!v)
    : [];
  const needsYou = TILE_ORDER.map((key) => ({ key, ...tiles[key] })).filter(
    (t) => t.tone === "danger" || t.tone === "warning"
  );

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <Link href="/admin" style={{ ...mono, color: "var(--k-muted)" }}>
        ← Grid
      </Link>

      <div style={{ marginTop: 12 }}>
        <PageHeader
          index="01"
          label="Client"
          title={
            <span className="inline-flex items-center flex-wrap gap-2.5">
              {block.tenant.name}
              <span
                title="Client reference"
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  textTransform: "none",
                  color: "var(--k-muted)",
                  background: "var(--k-surface)",
                  border: "1px solid var(--k-border)",
                  padding: "3px 9px",
                  verticalAlign: "middle",
                }}
              >
                {clientRef(tenantId)}
              </span>
            </span>
          }
          lead={
            [block.tenant.vertical, block.tenant.contactName, block.tenant.contactEmail]
              .filter(Boolean)
              .join(" · ") || "No contact details yet"
          }
          actions={
            <>
              <StatusChip tone={block.colour.tone}>{block.colour.label}</StatusChip>
              {block.awaitingSignature > 0 && (
                <StatusChip tone="warning">
                  {block.awaitingSignature} awaiting signature
                </StatusChip>
              )}
              {/* Plain <a>: the preview route sets a cookie and redirects into
                  the portal, so it needs a full page load, not a client nav. */}
              <a
                href={`/admin/clients/${tenantId}/preview`}
                title="Open this client's portal exactly as they see it — read-only"
                style={{ ...mono, color: "var(--k-accent)" }}
              >
                View portal as client →
              </a>
            </>
          }
        />
      </div>

      {/* Primary system — where the build is (the portal's system card). */}
      <Reveal>
        <div
          className="k-kard min-w-0"
          style={{ background: "var(--k-surface)", padding: "18px 20px", marginTop: 24 }}
        >
          {project ? (
            <>
              <div
                className="flex items-center justify-between gap-3 flex-wrap"
                style={{ marginBottom: 12 }}
              >
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span
                    className="min-w-0 break-words"
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                    }}
                  >
                    {project.name}
                  </span>
                  {block.projects.length > 1 && (
                    <span style={{ ...mono, color: "var(--k-muted)" }}>
                      {block.projects.length} systems —{" "}
                      {block.projects
                        .slice(1)
                        .map((p) => p.name)
                        .join(", ")}{" "}
                      also on the Passport tile
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 flex-wrap">
                  <Link
                    href={`/admin/systems/${project.id}`}
                    style={{ ...mono, color: "var(--k-accent)" }}
                  >
                    System passport →
                  </Link>
                  {project.liveUrl && (
                    <a
                      href={project.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="kb kb-primary kb-sm"
                    >
                      Open site
                      <span className="k-arrow" aria-hidden>
                        ↗
                      </span>
                    </a>
                  )}
                </span>
              </div>
              <StageStepper stage={project.stage ?? "discovery"} />
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9rem",
                  color: "var(--k-muted)",
                }}
              >
                No build project yet — nothing to stage until one exists.
              </span>
              <Link href={tiles.passport.href} className="kb kb-primary kb-sm">
                Start build project
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </Link>
            </div>
          )}

          {/* Quick facts */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-4"
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--k-border)",
            }}
          >
            <Fact label="Contact">
              {block.tenant.contactName ?? "—"}
              {block.tenant.contactEmail && (
                <>
                  <br />
                  <a
                    href={`mailto:${block.tenant.contactEmail}`}
                    style={{ color: "var(--k-muted)", textDecoration: "none" }}
                  >
                    {block.tenant.contactEmail}
                  </a>
                </>
              )}
            </Fact>
            <Fact label="Owners">
              {owners.length ? (
                owners.map(([k, v]) => (
                  <span key={k} style={{ display: "block" }}>
                    <span style={{ color: "var(--k-muted)" }}>{k}:</span> {v}
                  </span>
                ))
              ) : (
                <span style={{ color: T.warning }}>No owners set</span>
              )}
            </Fact>
            <Fact label="Live URL">
              {project?.liveUrl ? (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--k-accent)", textDecoration: "none" }}
                >
                  {project.liveUrl.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                <span style={{ color: "var(--k-muted)" }}>Not live yet</span>
              )}
            </Fact>
            <Fact label="Next action">
              {project?.nextAction ? (
                <>
                  {project.nextAction}
                  {project.nextActionOwner && (
                    <span style={{ color: "var(--k-muted)" }}>
                      {" "}
                      — {project.nextActionOwner}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: T.warning }}>None set</span>
              )}
            </Fact>
          </div>
        </div>
      </Reveal>

      {/* The seven tiles — portal quick-nav anatomy, traffic-light toned. */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        style={{ marginTop: 16 }}
      >
        {TILE_ORDER.map((key, i) => {
          const tile = tiles[key];
          const Icon = TILE_ICON[key];
          const color = TONE_COLOR[tile.tone];
          return (
            <Reveal key={key} delay={Math.min(i, 6) * 0.04}>
              <Link
                href={tile.href}
                className="k-kard k-kard-h flex flex-col gap-3 h-full"
                style={{
                  background: "var(--k-surface)",
                  padding: "14px 15px",
                  textDecoration: "none",
                  minHeight: 128,
                }}
              >
                <span className="flex items-start justify-between gap-2">
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      width: 34,
                      height: 34,
                      background: `color-mix(in oklab, ${color} 14%, transparent)`,
                      border: `1px solid color-mix(in oklab, ${color} 38%, transparent)`,
                    }}
                  >
                    <Icon size={17} color={color} strokeWidth={1.8} />
                  </span>
                  <StatusChip tone={tile.tone}>{tile.label}</StatusChip>
                </span>
                <span className="flex flex-col gap-0.5" style={{ marginTop: "auto" }}>
                  <span
                    className="inline-flex items-center justify-between gap-2"
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                    }}
                  >
                    {TILE_TITLE[key]}
                    <span className="k-arrow" aria-hidden style={{ color }}>
                      →
                    </span>
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.6rem",
                      fontWeight: 500,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color,
                    }}
                  >
                    {tile.sub}
                  </span>
                </span>
              </Link>
            </Reveal>
          );
        })}
      </div>

      {/* Needs you — every tile in warning / danger, with its reason. */}
      <Reveal>
        <div
          className="k-kard"
          style={{ background: "var(--k-surface)", marginTop: 16, marginBottom: 40 }}
        >
          <div
            className="flex items-center justify-between gap-3"
            style={{ padding: "12px 16px", borderBottom: "1px solid var(--k-border)" }}
          >
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.66rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--k-muted)",
              }}
            >
              {"// NEEDS YOU"}
            </span>
            <span style={{ ...mono, color: needsYou.length ? T.warning : T.success }}>
              {needsYou.length
                ? `${needsYou.length} tile${needsYou.length === 1 ? "" : "s"}`
                : "All clear"}
            </span>
          </div>
          {needsYou.length === 0 ? (
            <p
              style={{
                padding: "16px",
                fontFamily: T.sans,
                fontSize: "0.85rem",
                color: "var(--k-muted)",
              }}
            >
              Nothing waiting on you — every tile is green or not applicable yet.
            </p>
          ) : (
            <div className="flex flex-col">
              {needsYou.map((t, i) => (
                <Link
                  key={t.key}
                  href={t.href}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-[var(--k-bg)]"
                  style={{
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                  }}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <StatusChip tone={t.tone}>{t.label}</StatusChip>
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        textTransform: "uppercase",
                        color: "var(--k-fg)",
                      }}
                    >
                      {TILE_TITLE[t.key]}
                    </span>
                  </span>
                  <span
                    style={{ ...mono, textTransform: "none", color: "var(--k-muted)" }}
                  >
                    {t.sub}{" "}
                    <span
                      className="k-arrow"
                      aria-hidden
                      style={{ color: "var(--k-accent)" }}
                    >
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
