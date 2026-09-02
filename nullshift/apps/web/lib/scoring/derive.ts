import {
  calculateScalePricing,
  EMPTY_SCALE_INPUT,
  type PlatformRole,
  type ScaleInput,
  type ScaleResult,
} from "@/lib/pricing/nsi";
import type {
  Derivation,
  Evidence,
  FieldKey,
  FieldStates,
  IntegrationHit,
  VendorCostLine,
} from "./types";

/**
 * Turn evidence into Scale Index inputs — pure.
 *
 * Three kinds of field come out:
 *   auto      — read straight off the system (MAU, payments, integrations…).
 *               The evidence always wins over whatever was typed before.
 *   estimated — proposed from the evidence but really a judgment (platform
 *               role, vendor cost, whether AI is "operational"). A value a
 *               person already entered wins; otherwise the estimate is
 *               offered and flagged for confirmation.
 *   human     — nothing in the code or database can tell us (turnover,
 *               employees, SLA, regulation…). Carried over from the previous
 *               assessment, otherwise left blank / false.
 */

const fmt = (n: number) => n.toLocaleString("en-GB");

/** External services — the platform's own database/driver and our scheduled jobs don't count. */
export function externalIntegrations(hits: IntegrationHit[]): IntegrationHit[] {
  return hits.filter((h) => h.category !== "database" && h.category !== "automation");
}

export function estimateVendorCost(ev: Evidence): VendorCostLine[] {
  const lines: VendorCostLine[] = [];
  const repo = ev.repo;
  const db = ev.database;
  const cats = new Set((repo?.integrations ?? []).map((h) => h.category));

  if (db) {
    lines.push({
      item: "Supabase",
      monthlyGbp: 20,
      basis: "Pro plan assumed for a production database with daily backups",
    });
  }
  if (repo) {
    lines.push({
      item: "Hosting (Vercel)",
      monthlyGbp: 0,
      basis: "Hobby plan; £16 if the project sits in a Pro team",
    });
  }
  if (cats.has("ai")) {
    lines.push({
      item: "AI API usage",
      monthlyGbp: 10,
      basis: "Nominal — replace with the real bill",
    });
  }
  if (cats.has("email")) {
    const heavy = (db?.mau30 ?? 0) > 3000;
    lines.push({
      item: "Email delivery",
      monthlyGbp: heavy ? 15 : 0,
      basis: heavy
        ? "Above the free tier at this audience size"
        : "Free tier covers ~3k emails/month",
    });
  }
  if (cats.has("sms"))
    lines.push({ item: "SMS", monthlyGbp: 10, basis: "Nominal usage" });
  if (cats.has("maps")) lines.push({ item: "Maps", monthlyGbp: 0, basis: "Free tier" });
  if (cats.has("monitoring"))
    lines.push({ item: "Monitoring", monthlyGbp: 0, basis: "Free tier" });
  return lines;
}

function inferPlatformRole(ev: Evidence): { role: PlatformRole; why: string } {
  const repo = ev.repo;
  const db = ev.database;
  const repoPayments = (repo?.integrations ?? []).some((h) => h.category === "payments");
  const dbPayments = (db?.paymentTables ?? []).some((t) => (t.rows ?? 0) > 0);
  if (repoPayments || dbPayments)
    return {
      role: "transaction_critical",
      why: repoPayments ? "payments integration in the code" : "payment tables hold data",
    };
  const operational =
    (db?.operationalTables ?? []).some((t) => (t.rows ?? 0) > 0) ||
    (db?.usersTotal ?? 0) > 10 ||
    (!!repo?.hasAuth && (repo?.adminRouteCount ?? 0) > 0);
  if (operational)
    return { role: "operational", why: "authenticated users and operational records" };
  const leadGen =
    (db?.leadTables ?? []).length > 0 ||
    (repo?.integrations ?? []).some((h) => h.category === "email");
  if (leadGen) return { role: "lead_gen", why: "enquiry capture / email sending" };
  return { role: "informational", why: "no auth, payments or enquiry capture found" };
}

export function deriveScaleInputs(ev: Evidence, prev?: ScaleInput | null): Derivation {
  const repo = ev.repo;
  const db = ev.database;
  const base: ScaleInput = prev
    ? {
        ...EMPTY_SCALE_INPUT,
        ...prev,
        riskFlags: { ...prev.riskFlags },
        enterpriseFlags: { ...prev.enterpriseFlags },
      }
    : {
        ...EMPTY_SCALE_INPUT,
        riskFlags: { ...EMPTY_SCALE_INPUT.riskFlags },
        enterpriseFlags: { ...EMPTY_SCALE_INPUT.enterpriseFlags },
      };
  const inputs: ScaleInput = base;
  const states: FieldStates = {};
  const notes: string[] = [];
  const hasEvidence = !!repo || !!db;

  /* A. Audience */
  if (db && db.usersTotal > 0) {
    inputs.monthlyActiveUsers = db.mau30;
    states.monthlyActiveUsers = "auto";
    notes.push(
      `${fmt(db.mau30)} of ${fmt(db.usersTotal)} registered users signed in during the last 30 days (${fmt(db.newUsers30)} joined).`
    );
  } else {
    states.monthlyActiveUsers = "human";
    if (db)
      notes.push(
        "The database has no registered users — the site is not an authenticated system."
      );
  }
  states.monthlySessions = "human";
  if (states.monthlyActiveUsers === "human")
    notes.push(
      "No user activity to read — enter monthly sessions from analytics, or MAU if known."
    );

  /* B1. Platform role — estimated */
  if (hasEvidence) {
    const inferred = inferPlatformRole(ev);
    if (prev?.platformRole && prev.platformRole !== "informational") {
      states.platformRole = "estimated";
      notes.push(
        `Platform role kept as previously assessed; the evidence suggests "${inferred.role}" (${inferred.why}).`
      );
    } else {
      inputs.platformRole = inferred.role;
      states.platformRole = "estimated";
      notes.push(`Platform role suggested: ${inferred.role} — ${inferred.why}.`);
    }
  } else {
    states.platformRole = "human";
  }

  /* B2. Organisation scale — always human */
  states.annualTurnoverGbp = "human";
  states.employeeCount = "human";
  if (db?.roleModel.staffTotal != null)
    notes.push(
      `${fmt(db.roleModel.staffTotal)} staff-role users on ${db.roleModel.source} — a hint for Employees, not filled in (organisation scale is never inferred).`
    );

  /* C. Technical load — estimated vendor cost */
  const vendorCost = hasEvidence ? estimateVendorCost(ev) : [];
  const estimate = vendorCost.reduce((s, l) => s + l.monthlyGbp, 0);
  if (prev?.directMonthlyVendorCostGbp != null) {
    states.directMonthlyVendorCostGbp = "estimated";
    notes.push(
      `Vendor cost kept at £${fmt(prev.directMonthlyVendorCostGbp)} as previously entered (evidence estimate £${fmt(estimate)}/month).`
    );
  } else if (hasEvidence) {
    inputs.directMonthlyVendorCostGbp = estimate;
    states.directMonthlyVendorCostGbp = "estimated";
    notes.push(
      `Vendor cost estimated at £${fmt(estimate)}/month from the services detected — confirm against the real bills.`
    );
  } else {
    states.directMonthlyVendorCostGbp = "human";
  }

  /* D. Reach */
  const staff = db?.roleModel.staffActive30 ?? db?.roleModel.staffTotal ?? null;
  if (staff != null) {
    inputs.internalActiveUsers = staff;
    states.internalActiveUsers = "auto";
    notes.push(
      db?.roleModel.staffActive30 != null
        ? `${fmt(db.roleModel.staffActive30)} staff-role users active in the last 30 days.`
        : `${fmt(staff)} staff on ${db?.roleModel.source} (activity unknown).`
    );
  } else {
    states.internalActiveUsers = "human";
  }
  if (db?.locations) {
    inputs.locationsOrUnits = db.locations.count;
    states.locationsOrUnits = "auto";
    notes.push(
      `${fmt(db.locations.count)} active ${db.locations.table} in the database.`
    );
  } else {
    states.locationsOrUnits = "human";
  }

  /* E. Complexity & risk */
  const integrations = repo ? externalIntegrations(repo.integrations) : [];
  const repoPayments = integrations.some((h) => h.category === "payments");
  const dbPayments = (db?.paymentTables ?? []).length > 0;
  if (hasEvidence) {
    inputs.riskFlags.payments = repoPayments || dbPayments;
    states["risk.payments"] = "auto";
    if (inputs.riskFlags.payments)
      notes.push(
        `Takes payments: ${[
          ...integrations.filter((h) => h.category === "payments").map((h) => h.label),
          ...(db?.paymentTables ?? []).slice(0, 4).map((t) => t.name),
        ].join(", ")}.`
      );
  }

  if (db) {
    inputs.riskFlags.authenticatedPii = db.usersTotal > 0 && db.piiColumns > 0;
    states["risk.authenticatedPii"] = "auto";
    if (inputs.riskFlags.authenticatedPii)
      notes.push(
        `Holds personal data behind login: ${fmt(db.piiColumns)} PII columns${
          db.specialCategoryColumns > 0
            ? `, ${fmt(db.specialCategoryColumns)} special-category (medical / safeguarding) columns`
            : ""
        }.`
      );
  } else if (repo) {
    inputs.riskFlags.authenticatedPii = repo.hasAuth;
    states["risk.authenticatedPii"] = "estimated";
    if (repo.hasAuth)
      notes.push("Authentication found in the code; confirm it holds customer PII.");
  }

  if (repo) {
    const distinct = new Set(integrations.map((h) => h.key));
    inputs.riskFlags.threePlusIntegrations = distinct.size >= 3;
    states["risk.threePlusIntegrations"] = "auto";
    notes.push(
      `${fmt(repo.dependencyCount)} runtime dependencies; ${fmt(distinct.size)} external service${
        distinct.size === 1 ? "" : "s"
      }${distinct.size ? `: ${integrations.map((h) => h.label).join(", ")}` : ""}.`
    );

    const ai = integrations.filter((h) => h.category === "ai");
    if (ai.length > 0) {
      if (prev?.riskFlags.operationalAi === undefined || !prev)
        inputs.riskFlags.operationalAi = true;
      else inputs.riskFlags.operationalAi = prev.riskFlags.operationalAi;
      states["risk.operationalAi"] = "estimated";
      notes.push(
        `AI in use (${ai.map((h) => h.label).join(", ")} via ${ai
          .flatMap((h) => h.via)
          .slice(0, 3)
          .join(", ")}) — confirm it materially affects communication or fulfilment.`
      );
    } else {
      inputs.riskFlags.operationalAi = false;
      states["risk.operationalAi"] = "auto";
    }

    const adminArea = repo.adminRouteCount >= 3;
    const roles = repo.hasRoleModel || !!db?.roleModel.source;
    const workflows = (db?.statusTables ?? 0) >= 5;
    inputs.riskFlags.complexAdminWorkflows = adminArea && (roles || workflows);
    states["risk.complexAdminWorkflows"] = "auto";
    if (inputs.riskFlags.complexAdminWorkflows)
      notes.push(
        `Custom admin: ${fmt(repo.adminRouteCount)} admin routes of ${fmt(repo.routeCount)}${
          db?.roleModel.source ? `, roles on ${db.roleModel.source}` : ""
        }${workflows ? `, ${fmt(db!.statusTables)} tables with a status workflow` : ""}.`
      );
    if (repo.edgeFunctionCount > 0 || repo.scheduledJobs > 0)
      notes.push(
        `${fmt(repo.edgeFunctionCount)} edge functions, ${fmt(repo.scheduledJobs)} scheduled jobs, ${fmt(repo.migrationCount)} migrations.`
      );
  } else if (db) {
    inputs.riskFlags.complexAdminWorkflows =
      !!db.roleModel.source && db.statusTables >= 5;
    states["risk.complexAdminWorkflows"] = "estimated";
  }

  /* Enterprise triggers */
  if (db) {
    inputs.enterpriseFlags.highMau = db.mau30 >= 100_000;
    states["enterprise.highMau"] = "auto";
  } else {
    states["enterprise.highMau"] = "human";
  }
  if (hasEvidence) {
    const cost = inputs.directMonthlyVendorCostGbp ?? 0;
    inputs.enterpriseFlags.highVendorCost = cost >= 500;
    states["enterprise.highVendorCost"] = "estimated";
  } else {
    states["enterprise.highVendorCost"] = "human";
  }
  for (const k of [
    "specialSla",
    "regulatedSecurity",
    "multiEntity",
    "reservedCapacity",
    "exceptionalExposure",
  ] as const)
    states[`enterprise.${k}`] = "human";
  if ((db?.specialCategoryColumns ?? 0) > 0)
    notes.push(
      "Special-category data present — consider the 'Regulated / security review' trigger (a person decides)."
    );

  if (repo?.treeTruncated)
    notes.push(
      "The repository listing was truncated by GitHub — route and function counts are a floor."
    );

  return { inputs, fieldStates: states, notes, vendorCost };
}

export function provisionalScore(d: Derivation): ScaleResult {
  return calculateScalePricing(d.inputs);
}

/** The fields a person still has to look at, in form order. */
export function fieldsNeedingAPerson(states: FieldStates): FieldKey[] {
  return (Object.keys(states) as FieldKey[]).filter(
    (k) => states[k] === "human" || states[k] === "estimated"
  );
}
