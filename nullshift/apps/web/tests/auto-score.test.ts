import { describe, expect, it } from "vitest";
import { analyseRepo, normaliseRepoName } from "@/lib/scoring/repoAnalysis";
import {
  analyseDatabase,
  buildFollowUpSql,
  parseFollowUp,
  parseScan,
  IDENT_RE,
} from "@/lib/scoring/dbAnalysis";
import {
  deriveScaleInputs,
  fieldsNeedingAPerson,
  provisionalScore,
} from "@/lib/scoring/derive";
import type { Evidence } from "@/lib/scoring/types";

/* A synthetic system shaped like a dance-school booking platform: Vite SPA,
   Supabase edge functions, Stripe, Mapbox, Resend, OpenAI, admin area. */
const danceRepo = {
  fullName: "acme/dance",
  defaultBranch: "main",
  paths: [
    "package.json",
    "vercel.json",
    "src/pages/Index.tsx",
    "src/pages/Auth.tsx",
    "src/pages/portal/Dashboard.tsx",
    "src/pages/portal/Bookings.tsx",
    "src/pages/admin/Dashboard.tsx",
    "src/pages/admin/Classes.tsx",
    "src/pages/admin/Staff.tsx",
    "src/pages/admin/Coupons.tsx",
    "src/pages/staff/Register.tsx",
    "src/hooks/useUserRole.ts",
    "src/lib/stripe.ts",
    "src/test/booking.test.ts",
    "supabase/functions/_shared/cors.ts",
    "supabase/functions/create-checkout/index.ts",
    "supabase/functions/payments-webhook/index.ts",
    "supabase/functions/send-email/index.ts",
    "supabase/functions/daily-reminders/index.ts",
    "supabase/functions/generate-avatar/index.ts",
    "supabase/migrations/0001_init.sql",
    "supabase/migrations/0002_bookings.sql",
    ".github/workflows/ci.yml",
    "node_modules/leftpad/package.json",
  ],
  packageJsons: [
    {
      path: "package.json",
      json: {
        dependencies: {
          react: "^18",
          "react-router-dom": "^6",
          "@supabase/supabase-js": "^2",
          "@stripe/stripe-js": "^9",
          "mapbox-gl": "^3",
          resend: "^3",
          openai: "^4",
          "plausible-tracker": "^0.3",
          zod: "^3",
          "@internal/ui": "workspace:*",
        },
        devDependencies: { vite: "^5", vitest: "^2", typescript: "^5" },
      },
    },
    {
      path: "node_modules/leftpad/package.json",
      json: { dependencies: { nothing: "1" } },
    },
  ],
  vercelJson: { rewrites: [] },
  meta: { sizeKb: 4200, language: "TypeScript", pushedAt: "2026-08-30T10:00:00Z" },
};

const danceScanRow = [
  {
    scan: {
      users_total: 178,
      mau_30: 138,
      new_30: 116,
      public_tables: 6,
      db_size_mb: 17,
      cron_jobs: 0,
      storage_buckets: 3,
      extensions: ["pgcrypto", "uuid-ossp"],
      tables: [
        {
          name: "profiles",
          rows: 175,
          columns: ["id", "user_id", "email", "phone", "postcode", "medical_info"],
        },
        { name: "user_roles", rows: 178, columns: ["id", "user_id", "role"] },
        {
          name: "staff",
          rows: 11,
          columns: ["id", "user_id", "is_active", "dbs_number"],
        },
        { name: "venues", rows: 17, columns: ["id", "name", "is_active", "postcode"] },
        { name: "bookings", rows: 223, columns: ["id", "class_id", "status", "amount"] },
        {
          name: "memberships",
          rows: 181,
          columns: ["id", "stripe_subscription_id", "status"],
        },
        { name: "party_inquiries", rows: 0, columns: ["id", "email", "status"] },
        { name: "class_sessions", rows: 580, columns: ["id", "status"] },
        { name: "attendance", rows: 1, columns: ["id", "status"] },
        { name: 'bad"name; drop', rows: 0, columns: ["id"] },
      ],
    },
  },
];

describe("repository analysis", () => {
  const repo = analyseRepo(danceRepo);

  it("counts third-party runtime dependencies only", () => {
    // 10 declared, minus the workspace package; node_modules package.json ignored.
    expect(repo.dependencyCount).toBe(9);
    expect(repo.devDependencyCount).toBe(3);
    expect(repo.packageJsonPaths).toEqual(["package.json"]);
  });

  it("finds the external services from packages and function names", () => {
    const keys = repo.integrations.map((h) => h.key).sort();
    expect(keys).toEqual(
      [
        "mapbox",
        "openai",
        "plausible",
        "resend",
        "scheduled-jobs",
        "stripe",
        "supabase",
      ].sort()
    );
    const stripe = repo.integrations.find((h) => h.key === "stripe")!;
    expect(stripe.via).toContain("pkg:@stripe/stripe-js");
    expect(stripe.via).toContain("fn:create-checkout");
    expect(stripe.via).toContain("path:src/lib/stripe.ts");
  });

  it("sees the admin area, roles, functions, migrations, schedules and CI", () => {
    expect(repo.framework).toBe("React (SPA)");
    expect(repo.routeCount).toBe(9);
    expect(repo.adminRouteCount).toBe(5); // 4 admin + 1 staff
    expect(repo.hasAuth).toBe(true);
    expect(repo.hasRoleModel).toBe(true);
    expect(repo.edgeFunctionCount).toBe(5); // _shared excluded
    expect(repo.migrationCount).toBe(2);
    expect(repo.scheduledJobs).toBe(1);
    expect(repo.hasTests).toBe(true);
    expect(repo.hasCi).toBe(true);
  });

  it("normalises repository references", () => {
    expect(
      normaliseRepoName("https://github.com/louismkenzie-dev/The-dance-exclusive")
    ).toBe("louismkenzie-dev/The-dance-exclusive");
    expect(normaliseRepoName("owner/repo.git")).toBe("owner/repo");
    expect(normaliseRepoName("git@github.com:owner/repo")).toBe("owner/repo");
    expect(normaliseRepoName("nonsense")).toBeNull();
    expect(normaliseRepoName("owner/re po")).toBeNull();
  });
});

describe("database analysis", () => {
  const scan = parseScan(danceScanRow)!;

  it("parses the scan row", () => {
    expect(scan.users_total).toBe(178);
    expect(scan.mau_30).toBe(138);
    expect(scan.tables).toHaveLength(10);
  });

  it("builds a follow-up only from safe identifiers", () => {
    const follow = buildFollowUpSql(scan)!;
    expect(follow.keys).toEqual([
      "staff_total",
      "staff_active_30",
      "staff_table_count",
      "locations_count",
    ]);
    expect(follow.sql).toContain("public.user_roles");
    expect(follow.sql).toContain("public.staff where is_active = true");
    expect(follow.sql).toContain("public.venues where is_active = true");
    expect(follow.sql).not.toContain("drop");
    expect(IDENT_RE.test('bad"name; drop')).toBe(false);
  });

  it("classifies tables and columns", () => {
    const extra = parseFollowUp([
      {
        extra: {
          staff_total: 12,
          staff_active_30: 7,
          staff_table_count: 11,
          locations_count: 17,
        },
      },
    ]);
    const db = analyseDatabase("abcdefghijklmnopqrst", scan, extra);
    expect(db.roleModel).toEqual({
      source: "user_roles.role",
      staffTotal: 12,
      staffActive30: 7,
    });
    expect(db.locations).toEqual({ table: "venues", count: 17 });
    expect(db.paymentTables.map((t) => t.name)).toEqual(["memberships"]);
    expect(db.operationalTables.map((t) => t.name).sort()).toEqual([
      "attendance",
      "bookings",
      "class_sessions",
    ]);
    expect(db.leadTables.map((t) => t.name)).toEqual(["party_inquiries"]);
    expect(db.piiColumns).toBe(5); // email, phone, postcode, postcode, email
    expect(db.specialCategoryColumns).toBe(2); // medical_info, dbs_number
    expect(db.statusTables).toBe(5);
  });

  it("returns null for an empty or malformed scan", () => {
    expect(parseScan([])).toBeNull();
    expect(parseScan([{ scan: "not json" }])).toBeNull();
  });
});

describe("derivation", () => {
  const repo = analyseRepo(danceRepo);
  const scan = parseScan(danceScanRow)!;
  const db = analyseDatabase("abcdefghijklmnopqrst", scan, {
    staff_total: 12,
    staff_active_30: 7,
    staff_table_count: 11,
    locations_count: 17,
  });
  const evidence: Evidence = {
    collectedAt: "2026-09-02T12:00:00Z",
    repo,
    database: db,
    sources: {
      repo: { ok: true, ref: "acme/dance", error: null },
      database: { ok: true, ref: "abcdefghijklmnopqrst", error: null },
    },
  };

  it("fills the machine-readable fields and leaves the rest to a person", () => {
    const d = deriveScaleInputs(evidence, null);
    expect(d.inputs.monthlyActiveUsers).toBe(138);
    expect(d.inputs.platformRole).toBe("transaction_critical");
    expect(d.inputs.internalActiveUsers).toBe(7);
    expect(d.inputs.locationsOrUnits).toBe(17);
    expect(d.inputs.riskFlags).toEqual({
      payments: true,
      authenticatedPii: true,
      threePlusIntegrations: true,
      operationalAi: true,
      complexAdminWorkflows: true,
    });
    expect(d.inputs.enterpriseFlags.highMau).toBe(false);
    expect(d.inputs.annualTurnoverGbp).toBeNull();
    expect(d.inputs.employeeCount).toBeNull();
    // Supabase 20 + Vercel 0 + AI 10 + email 0 + maps 0
    expect(d.inputs.directMonthlyVendorCostGbp).toBe(30);

    expect(d.fieldStates.monthlyActiveUsers).toBe("auto");
    expect(d.fieldStates["risk.payments"]).toBe("auto");
    expect(d.fieldStates["risk.operationalAi"]).toBe("estimated");
    expect(d.fieldStates.directMonthlyVendorCostGbp).toBe("estimated");
    expect(d.fieldStates.annualTurnoverGbp).toBe("human");
    expect(d.fieldStates["enterprise.specialSla"]).toBe("human");

    const human = fieldsNeedingAPerson(d.fieldStates);
    expect(human).toContain("annualTurnoverGbp");
    expect(human).toContain("employeeCount");
    expect(human).not.toContain("monthlyActiveUsers");
    expect(human).not.toContain("risk.payments");
  });

  it("scores provisionally from the derived inputs", () => {
    const d = deriveScaleInputs(evidence, null);
    const r = provisionalScore(d);
    // audience 0 (138 < 500) + role 15 + org 0 + technical 8 (£30) + reach 10 (7 staff / 17 venues) + risk 15
    expect(r.componentScores).toEqual({
      audience: 0,
      commercialCriticality: 15,
      technicalLoad: 8,
      organisationReach: 15,
      complexityRisk: 15,
    });
    expect(r.nsi).toBe(53);
    expect(r.scaleBand).toBe("established");
    expect(r.recommendedMrr).toBe(120); // ceil5(max(40 × 2.5, 30 / 0.25)) for core
    expect(r.reviewFlags.some((f) => /turnover/.test(f))).toBe(true);
  });

  it("keeps what a person typed for estimated and human fields, but lets evidence win auto fields", () => {
    const d = deriveScaleInputs(evidence, {
      ...deriveScaleInputs(evidence, null).inputs,
      plan: "pro",
      monthlyActiveUsers: 5, // stale — evidence wins
      platformRole: "operational", // judgment — kept
      annualTurnoverGbp: 400_000,
      employeeCount: 8,
      directMonthlyVendorCostGbp: 45,
      riskFlags: {
        payments: false,
        authenticatedPii: false,
        threePlusIntegrations: false,
        operationalAi: false,
        complexAdminWorkflows: false,
      },
      enterpriseFlags: {
        highMau: false,
        highVendorCost: false,
        specialSla: true,
        regulatedSecurity: false,
        multiEntity: false,
        reservedCapacity: false,
        exceptionalExposure: false,
      },
    });
    expect(d.inputs.plan).toBe("pro");
    expect(d.inputs.monthlyActiveUsers).toBe(138);
    expect(d.inputs.platformRole).toBe("operational");
    expect(d.inputs.annualTurnoverGbp).toBe(400_000);
    expect(d.inputs.directMonthlyVendorCostGbp).toBe(45);
    expect(d.inputs.riskFlags.payments).toBe(true);
    expect(d.inputs.riskFlags.operationalAi).toBe(false);
    expect(d.inputs.enterpriseFlags.specialSla).toBe(true);
  });

  it("degrades to human-only when nothing could be read", () => {
    const empty: Evidence = {
      collectedAt: "2026-09-02T12:00:00Z",
      repo: null,
      database: null,
      sources: {
        repo: { ok: false, ref: null, error: "no repository on the passport" },
        database: { ok: false, ref: null, error: "SUPABASE_ACCESS_TOKEN not set" },
      },
    };
    const d = deriveScaleInputs(empty, null);
    expect(Object.values(d.fieldStates).every((s) => s === "human")).toBe(true);
    expect(d.vendorCost).toEqual([]);
  });

  it("scores a brochure site with no database as informational", () => {
    const brochure: Evidence = {
      ...evidence,
      database: null,
      repo: analyseRepo({
        fullName: "acme/site",
        defaultBranch: "main",
        paths: ["package.json", "app/page.tsx", "app/about/page.tsx"],
        packageJsons: [
          { path: "package.json", json: { dependencies: { next: "15", react: "19" } } },
        ],
      }),
    };
    const d = deriveScaleInputs(brochure, null);
    expect(d.inputs.platformRole).toBe("informational");
    expect(d.inputs.riskFlags.threePlusIntegrations).toBe(false);
    expect(d.fieldStates.monthlyActiveUsers).toBe("human");
  });
});
