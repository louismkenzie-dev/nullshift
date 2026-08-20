import { createServiceClient } from "@nullshift/db";
import { SUBPROCESSOR_REGISTER } from "@nullshift/content/legal/subprocessors";
import { CONTROL_LIBRARY } from "./library";
import { POLICY_TEMPLATES } from "./policyTemplates";
import { FREQUENCY_DAYS, addDays, toDateOnly } from "./schedule";
import { logSoc2Event } from "./events";

/**
 * Idempotent programme seeding — run from Settings by an explicit, audited
 * action, never silently at boot. Installing the control library, the policy
 * drafts and the initial registers is itself a recorded programme decision.
 *
 * Re-running is safe and additive: existing rows are matched by stable key
 * and their OPERATIONAL fields (owner, applicability, schedule, status,
 * review decisions) are never overwritten — only missing rows are created.
 */

export type SeedReport = {
  controlsCreated: number;
  policiesCreated: number;
  vendorsCreated: number;
  assetsCreated: number;
};

/** Integrations detected from server environment configuration. */
export function detectActiveIntegrations(): { key: string; label: string }[] {
  const list: { key: string; label: string; present: boolean }[] = [
    { key: "vercel", label: "Vercel (hosting)", present: true },
    { key: "supabase", label: "Supabase (database/auth/storage)", present: true },
    { key: "github", label: "GitHub (source control)", present: true },
    { key: "stripe", label: "Stripe (payments)", present: !!process.env.STRIPE_SECRET_KEY },
    {
      key: "gocardless",
      label: "GoCardless (Direct Debit)",
      present: !!process.env.GOCARDLESS_ACCESS_TOKEN,
    },
    { key: "xero", label: "Xero (accounting mirror)", present: !!process.env.XERO_CLIENT_ID },
    { key: "resend", label: "Resend (email)", present: !!process.env.RESEND_API_KEY },
    { key: "anthropic", label: "Anthropic (AI)", present: !!process.env.ANTHROPIC_API_KEY },
  ];
  return list.filter((l) => l.present).map(({ key, label }) => ({ key, label }));
}

const dataAccessFor = (categories: string[]): string => {
  const joined = categories.join(" ").toLowerCase();
  if (joined.includes("special")) return "special_category";
  if (joined.includes("client data") || joined.includes("stored files")) return "personal";
  if (joined.includes("contact") || joined.includes("billing")) return "personal";
  return "confidential";
};

export async function seedProgramme(actorEmail: string): Promise<SeedReport> {
  const db = createServiceClient();
  const today = toDateOnly(new Date());
  const report: SeedReport = {
    controlsCreated: 0,
    policiesCreated: 0,
    vendorsCreated: 0,
    assetsCreated: 0,
  };

  /* ── controls ─────────────────────────────────────────────── */
  const { data: existingControls } = await db.from("soc2_controls").select("key");
  const haveControl = new Set((existingControls ?? []).map((c) => c.key));
  for (const seed of CONTROL_LIBRARY) {
    if (haveControl.has(seed.key)) continue;
    const freqDays = FREQUENCY_DAYS[seed.frequency];
    // First performance lands within a month so the programme starts with a
    // baseline of each control, whatever its ongoing cadence.
    const firstDue = freqDays === null ? null : addDays(today, Math.min(freqDays, 30));
    const { error } = await db.from("soc2_controls").insert({
      key: seed.key,
      tsc_category: seed.tscCategory,
      tsc_refs: seed.tscRefs as never,
      name: seed.name,
      objective: seed.objective,
      description: seed.description,
      frequency: seed.frequency,
      test_procedure: seed.testProcedure,
      evidence_requirements: seed.evidenceRequirements,
      policy_key: seed.policyKey,
      automation: seed.automation,
      next_due_at: firstDue,
    });
    if (!error) report.controlsCreated += 1;
  }

  /* ── policies + v1 drafts ─────────────────────────────────── */
  const { data: existingPolicies } = await db.from("soc2_policies").select("key");
  const havePolicy = new Set((existingPolicies ?? []).map((p) => p.key));
  for (const tpl of POLICY_TEMPLATES) {
    if (havePolicy.has(tpl.key)) continue;
    const { data: policy, error } = await db
      .from("soc2_policies")
      .insert({
        key: tpl.key,
        title: tpl.title,
        requires_acknowledgement: tpl.requiresAcknowledgement,
        acknowledgement_audience: tpl.acknowledgementAudience,
        legal_review_required: tpl.legalReviewRequired,
      })
      .select("id")
      .single();
    if (error || !policy) continue;
    await db.from("soc2_policy_versions").insert({
      policy_id: policy.id,
      version: 1,
      body_md: tpl.body,
      changelog: "Seeded draft — requires human review before approval.",
      created_by: actorEmail,
    });
    report.policiesCreated += 1;
  }

  /* ── vendors from the sub-processor register + live integrations ── */
  const { data: existingVendors } = await db.from("soc2_vendors").select("name, subprocessor_id");
  const haveVendorKey = new Set(
    (existingVendors ?? []).flatMap((v) => [
      v.name.toLowerCase(),
      ...(v.subprocessor_id ? [v.subprocessor_id.toLowerCase()] : []),
    ])
  );
  for (const sub of SUBPROCESSOR_REGISTER) {
    if (sub.retiredAt) continue;
    if (haveVendorKey.has(sub.id.toLowerCase()) || haveVendorKey.has(sub.tradingName.toLowerCase()))
      continue;
    const { error } = await db.from("soc2_vendors").insert({
      name: sub.tradingName,
      service: sub.purpose,
      subprocessor_id: sub.id,
      data_access: dataAccessFor(sub.dataCategories),
      // The legal register itself says these are unverified placeholders:
      // seed them as PROPOSED so approval is a real, recorded review.
      status: "proposed",
      transfer_note: sub.verified
        ? `Processing: ${sub.processingCountries.join(", ")}; mechanism: ${sub.transferMechanism ?? "n/a"}`
        : "UNVERIFIED in legal register — confirm legal name, processing countries and transfer mechanism.",
      notes: `Seeded from the sub-processor register (${sub.id}). DPA: ${sub.dpaUrl ?? "unknown"}.`,
      security_docs: [] as never,
    });
    if (!error) {
      report.vendorsCreated += 1;
      haveVendorKey.add(sub.tradingName.toLowerCase());
    }
  }
  for (const integ of detectActiveIntegrations()) {
    if (haveVendorKey.has(integ.key)) continue;
    const { error } = await db.from("soc2_vendors").insert({
      name: integ.key.charAt(0).toUpperCase() + integ.key.slice(1),
      service: integ.label,
      subprocessor_id: null,
      data_access: "confidential",
      status: "proposed",
      notes: "Seeded from live environment configuration — classify data access and review.",
      security_docs: [] as never,
    });
    if (!error) {
      report.vendorsCreated += 1;
      haveVendorKey.add(integ.key);
    }
  }

  /* ── assets: platform estate + client systems ─────────────── */
  const { data: existingAssets } = await db.from("soc2_assets").select("name");
  const haveAsset = new Set((existingAssets ?? []).map((a) => a.name.toLowerCase()));
  const platformAssets: {
    name: string;
    kind: string;
    description: string;
    classification: string;
    criticality: string;
  }[] = [
    {
      name: "Null Shift Ops platform (apps/web)",
      kind: "application",
      description: "Marketing site + /admin staff hub + /portal client portal on one Next.js app.",
      classification: "confidential",
      criticality: "critical",
    },
    {
      name: "Supabase production project",
      kind: "cloud_account",
      description: "Postgres + Auth + Storage for all tenants; RLS-enforced isolation.",
      classification: "restricted",
      criticality: "critical",
    },
    {
      name: "Vercel production project",
      kind: "cloud_account",
      description: "Hosting, TLS, deployments and cron for the Ops platform.",
      classification: "confidential",
      criticality: "critical",
    },
    {
      name: "GitHub (nullshift monorepo)",
      kind: "repository",
      description: "Source of the Ops platform. Client repos are separate assets.",
      classification: "confidential",
      criticality: "high",
    },
    {
      name: "Production environment (nullshift.co.uk)",
      kind: "environment",
      description: "Live environment serving clients; separated from preview builds.",
      classification: "confidential",
      criticality: "critical",
    },
    {
      name: "Evidence store (soc2-evidence bucket)",
      kind: "data_store",
      description: "Private bucket for readiness evidence; signed, expiring downloads only.",
      classification: "restricted",
      criticality: "medium",
    },
  ];
  for (const a of platformAssets) {
    if (haveAsset.has(a.name.toLowerCase())) continue;
    const { error } = await db.from("soc2_assets").insert(a as never);
    if (!error) {
      report.assetsCreated += 1;
      haveAsset.add(a.name.toLowerCase());
    }
  }
  // One asset per client system passport (the systems Null Shift operates).
  // Passports are keyed by project_id and carry no name of their own — the
  // project (and its tenant) names the system.
  const { data: systems } = await db
    .from("system_profiles")
    .select("project_id, tenant_id, repo_full_name, projects(name)")
    .limit(500);
  for (const sys of systems ?? []) {
    const projectRel = sys.projects as { name?: string } | { name?: string }[] | null;
    const projectName = (Array.isArray(projectRel) ? projectRel[0]?.name : projectRel?.name) ?? sys.repo_full_name ?? sys.project_id;
    const assetName = `Client system: ${projectName}`;
    if (haveAsset.has(assetName.toLowerCase())) continue;
    const { error } = await db.from("soc2_assets").insert({
      name: assetName,
      kind: "service",
      description: "Client production system operated/supported under a care plan.",
      system_profile_id: sys.project_id,
      tenant_id: sys.tenant_id,
      classification: "confidential",
      criticality: "high",
    });
    if (!error) {
      report.assetsCreated += 1;
      haveAsset.add(assetName.toLowerCase());
    }
  }

  await logSoc2Event({
    recordType: "settings",
    recordId: "00000000-0000-0000-0000-000000000000",
    type: "programme.seeded",
    summary: `Programme seed run: ${report.controlsCreated} controls, ${report.policiesCreated} policies, ${report.vendorsCreated} vendors, ${report.assetsCreated} assets created.`,
    detail: { ...report },
    actor: actorEmail,
  });

  return report;
}
