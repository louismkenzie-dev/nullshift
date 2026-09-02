import { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { PRICING_VERSION, type ScaleInput, type ScaleResult } from "@/lib/pricing/nsi";
import { fetchRepoSnapshot } from "./collectors/github";
import {
  collectDatabaseEvidence,
  isSupabaseManagementConfigured,
} from "./collectors/supabase";
import { deriveScaleInputs, provisionalScore } from "./derive";
import { analyseRepo, normaliseRepoName } from "./repoAnalysis";
import type { Derivation, Evidence, FieldStates, SourceOutcome } from "./types";

/**
 * Auto-score a client's system: read the repository and the production
 * database named on the system passport, derive every Scale Index input that
 * can be read off them, score provisionally, and store the lot as a
 * scale_evidence row. Nothing here bills anyone — a person completes the
 * remaining fields on the pricing page and saves the assessment that
 * contractedMrr() reads.
 *
 * Runs from the pricing page button, when a project reaches live/care, and
 * from the periodic re-scan. Best-effort per source: a missing token or an
 * unreachable repo is recorded on the row, not thrown.
 */

export type AutoScoreTrigger = "manual" | "stage" | "cron";

export type AutoScoreOutcome =
  | {
      ok: true;
      evidenceId: string;
      evidence: Evidence;
      derivation: Derivation;
      result: ScaleResult;
    }
  | { ok: false; error: string };

type Service = ReturnType<typeof createServiceClient>;

export type EvidenceRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  trigger: AutoScoreTrigger;
  pricing_version: string;
  sources: Evidence["sources"];
  evidence: { repo: Evidence["repo"]; database: Evidence["database"] };
  derived: ScaleInput;
  field_states: FieldStates;
  notes: string[];
  provisional_nsi: number | null;
  provisional_band: string | null;
  provisional_mrr: number | null;
  collected_at: string;
};

export async function latestEvidence(
  service: Service,
  tenantId: string
): Promise<EvidenceRow | null> {
  const { data } = await service
    .from("scale_evidence")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as EvidenceRow | null) ?? null;
}

export async function runAutoScore(opts: {
  tenantId: string;
  projectId?: string | null;
  trigger: AutoScoreTrigger;
  actorId?: string | null;
}): Promise<AutoScoreOutcome> {
  const service = createServiceClient();

  // The project + its passport — where the repo and database live.
  let projectId = opts.projectId ?? null;
  if (!projectId) {
    const { data: proj } = await service
      .from("projects")
      .select("id")
      .eq("tenant_id", opts.tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    projectId = proj?.id ?? null;
  }
  const { data: passport } = projectId
    ? await service
        .from("system_profiles")
        .select("repo_full_name, default_branch, supabase_ref")
        .eq("project_id", projectId)
        .maybeSingle()
    : { data: null };

  const repoName = normaliseRepoName(passport?.repo_full_name);
  const dbRef = (passport?.supabase_ref ?? "").trim() || null;
  if (!repoName && !dbRef)
    return {
      ok: false,
      error:
        "Nothing to read: put the repository and Supabase ref on the system passport first.",
    };

  // The previous assessment's inputs — human answers carry over.
  const { data: prevRow } = await service
    .from("scale_assessments")
    .select("inputs")
    .eq("tenant_id", opts.tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prev = (prevRow?.inputs as ScaleInput | undefined) ?? null;

  const repoOutcome: SourceOutcome = { ok: false, ref: repoName, error: null };
  const dbOutcome: SourceOutcome = { ok: false, ref: dbRef, error: null };

  const [repoRes, dbRes] = await Promise.allSettled([
    repoName
      ? fetchRepoSnapshot(repoName, { branch: passport?.default_branch ?? null }).then(
          analyseRepo
        )
      : Promise.reject(new Error("No repository on the system passport")),
    dbRef
      ? isSupabaseManagementConfigured()
        ? collectDatabaseEvidence(dbRef)
        : Promise.reject(
            new Error("SUPABASE_ACCESS_TOKEN not set — the database could not be read")
          )
      : Promise.reject(new Error("No Supabase ref on the system passport")),
  ]);

  const repo = repoRes.status === "fulfilled" ? repoRes.value : null;
  if (repoRes.status === "fulfilled") repoOutcome.ok = true;
  else repoOutcome.error = messageOf(repoRes.reason);
  const database = dbRes.status === "fulfilled" ? dbRes.value : null;
  if (dbRes.status === "fulfilled") dbOutcome.ok = true;
  else dbOutcome.error = messageOf(dbRes.reason);

  const evidence: Evidence = {
    collectedAt: new Date().toISOString(),
    repo,
    database,
    sources: { repo: repoOutcome, database: dbOutcome },
  };
  const derivation = deriveScaleInputs(evidence, prev);
  const result = provisionalScore(derivation);

  const { data: row, error } = await service
    .from("scale_evidence")
    .insert({
      tenant_id: opts.tenantId,
      project_id: projectId,
      trigger: opts.trigger,
      pricing_version: PRICING_VERSION,
      sources: evidence.sources,
      evidence: { repo, database },
      derived: derivation.inputs,
      field_states: derivation.fieldStates,
      notes: derivation.notes,
      provisional_nsi: result.nsi,
      provisional_band: result.enterpriseReviewRequired ? "enterprise" : result.scaleBand,
      provisional_mrr: result.recommendedMrr,
      collected_by: opts.actorId ?? null,
    })
    .select("id")
    .single();
  if (error || !row)
    return { ok: false, error: `could not store the scan: ${error?.message}` };

  await logAuditAsService({
    action: "scale_evidence.collected",
    target: `tenant:${opts.tenantId}`,
    tenantId: opts.tenantId,
    metadata: {
      evidence: row.id,
      trigger: opts.trigger,
      actor: opts.actorId ?? null,
      repo: repoOutcome.ok,
      database: dbOutcome.ok,
      nsi: result.nsi,
      band: result.enterpriseReviewRequired ? "enterprise" : result.scaleBand,
      mau: database?.mau30 ?? null,
      dependencies: repo?.dependencyCount ?? null,
    },
  });

  return { ok: true, evidenceId: row.id, evidence, derivation, result };
}

const messageOf = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "unknown error";
