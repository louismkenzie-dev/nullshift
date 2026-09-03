import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { Reveal } from "@/components/kyma";
import { ensureProject } from "../actions";
import { Badge, TilePage, btn, card, h2, loadTenantAndProjects } from "../_shared";

/**
 * Passport tile — the system itself. One project: straight to its passport
 * (/admin/systems/[projectId]). None: start the build project, which is the
 * row the whole tile grid keys on. Several: pick which system's passport.
 */
export const dynamic = "force-dynamic";

export default async function ClientPassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tenantId } = await params;
  if (!(await requireStaff()).ok) notFound();
  const { tenant: t, projects } = await loadTenantAndProjects(tenantId);
  if (projects.length === 1) redirect(`/admin/systems/${projects[0].id}`);

  const htid = <input type="hidden" name="tenant_id" value={tenantId} />;

  return (
    <TilePage
      tenantId={tenantId}
      tenantName={t.name}
      index="01"
      label="Passport"
      title={t.name}
      lead={
        projects.length === 0
          ? "No system yet. Starting the build project creates the record that the proposal, invoicing, deliverables and the passport all hang off."
          : `${projects.length} systems — open the passport for the one you want.`
      }
    >
      {projects.length === 0 ? (
        <Reveal>
          <section style={card}>
            <h2 style={{ ...h2, marginBottom: 6 }}>Build project</h2>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.85rem",
                color: "var(--k-faint)",
                marginBottom: 12,
              }}
            >
              Start the build project to unlock the proposal, change requests, invoicing
              and deliverables for this client. The passport (repo, database, build goal,
              runbook) is written once the project exists.
            </p>
            <form action={ensureProject}>
              {htid}
              <input type="hidden" name="name" value={`${t.name} — build`} />
              <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")}>
                Start build project →
              </SubmitButton>
            </form>
          </section>
        </Reveal>
      ) : (
        <Reveal>
          <section style={card}>
            <h2 style={h2}>Systems</h2>
            <div className="flex flex-col">
              {projects.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/admin/systems/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-2"
                  style={{
                    padding: "10px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.92rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {p.name}
                    {p.live_url ? (
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: 11,
                          color: "var(--k-faint)",
                        }}
                      >
                        {" "}
                        · {p.live_url}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge s={p.stage} />
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--k-accent)",
                      }}
                    >
                      Passport →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>
      )}
    </TilePage>
  );
}
