"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@nullshift/ui/tokens";
import { TRADES, WELLNESS } from "@nullshift/content/marketing";
import { PlanLadder } from "@nullshift/ui/components/PlanLadder";
import { RevenueCalculator } from "@nullshift/ui/components/RevenueCalculator";

const TABS = [
  "Advisor",
  "Strategy",
  "Offer & Pricing",
  "Channels",
  "90-Day Roadmap",
  "Numbers",
] as const;
type Tab = (typeof TABS)[number];

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

/* ── Small branded primitives ──────────────────────────────── */
const Card = ({ children, accent }: { children: React.ReactNode; accent?: boolean }) => (
  <div
    style={{
      background: T.surface,
      border: `1px solid ${accent ? T.primary : T.border}`,
      borderRadius: T.r.lg,
      padding: 20,
      height: "100%",
    }}
  >
    {children}
  </div>
);
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div
    className="inline-flex items-center gap-2"
    style={{
      fontFamily: T.mono,
      fontSize: "0.66rem",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: T.muted,
    }}
  >
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: T.primary,
        boxShadow: `0 0 0 4px ${T.primary}22`,
      }}
    />
    {children}
  </div>
);
const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2
    style={{
      fontFamily: T.display,
      fontWeight: 600,
      fontSize: "clamp(1.4rem,2.6vw,2rem)",
      letterSpacing: "-0.02em",
      color: T.fg,
      margin: "8px 0 14px",
    }}
  >
    {children}
  </h2>
);
const Tag = ({
  children,
  tone = "primary",
}: {
  children: React.ReactNode;
  tone?: "primary" | "warn" | "info";
}) => {
  const c = tone === "warn" ? T.warning : tone === "info" ? T.info : T.primary;
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "0.62rem",
        letterSpacing: "0.04em",
        padding: "3px 9px",
        borderRadius: 999,
        background: `${c}1f`,
        color: c,
        border: `1px solid ${c}44`,
      }}
    >
      {children}
    </span>
  );
};

/* ── 90-day roadmap data ───────────────────────────────────── */
const ROADMAP: { phase: string; title: string; items: [string, string][] }[] = [
  {
    phase: "Phase 0",
    title: "Foundation — this week",
    items: [
      [
        "Lock the trades wedge & pick 2–3 target towns",
        "Where Google Ads + local SEO point",
      ],
      [
        "Ship the /trades 'Never Miss a Job' landing page",
        "Live — uses the Systems Lab as proof",
      ],
      [
        "Repackage pricing to the Growth System ladder",
        "Live — 'Own your system. Subscribe to results.'",
      ],
      ["Ship the Missed-Call Revenue calculator", "Live — quantifies pain in £"],
      [
        "Set up tracking: GA4, call tracking, simple CRM, GBP",
        "You can't optimise what you can't see",
      ],
      ["Write/film one flagship case study", "Seed with the booking-system testimonial"],
    ],
  },
  {
    phase: "Phase 1",
    title: "Ignite trades — weeks 1–4",
    items: [
      [
        "Launch Google Search ads on trade terms (£300–700/mo)",
        "Hottest intent, tight geography",
      ],
      [
        "Founder outbound: 20 personalised Loom teardowns / week",
        "Best channel for the first clients",
      ],
      ["Publish 4 niche SEO pages (trade × town)", "Compounding organic"],
      [
        "Cut 6–8 short-form videos from Systems Lab + the £24k hook",
        "Cheap, demonstrative creative",
      ],
      ["🎯 Target: first 3–5 retainer clients", "£600–1.2k MRR"],
    ],
  },
  {
    phase: "Phase 2",
    title: "Clone to wellness & compound — weeks 5–8",
    items: [
      [
        "Push the /wellness 'Zero No-Show' page + No-Show calculator",
        "Live — mirror the trades playbook",
      ],
      ["Add Meta retargeting (£150–300/mo)", "Re-engage demo & calculator visitors"],
      [
        "Stand up the referral program + 1–2 partnerships",
        "Suppliers, associations, chambers",
      ],
      ["Weekly content cadence: 2–3 videos + 1 SEO page", "Keep the flywheel turning"],
      ["🎯 Target: 8–12 total retainer clients", "~£2–3k MRR"],
    ],
  },
  {
    phase: "Phase 3",
    title: "Optimise & scale — weeks 9–12",
    items: [
      ["Optimise CAC — pause losers, double down on winners", "Protect the budget"],
      [
        "Upsell Foundation → Growth/Pro; add annual-prepay (2 mo free)",
        "Lift ARPU + lock retention",
      ],
      ["Systematise delivery with niche templates", "Each build faster & cheaper"],
      ["🎯 Target: 15–25 clients, £3.5–6k MRR, LTV:CAC > 3:1", "Run-rate to scale"],
    ],
  },
];

const KPIS: [string, string, string, string][] = [
  ["Qualified leads / month", "15–25", "30–45", "50+"],
  ["Discovery calls / month", "6–10", "12–18", "20+"],
  ["New retainer clients (cumulative)", "3–5", "8–12", "15–25"],
  ["MRR", "£600–1.2k", "£2–3k", "£3.5–6k"],
  ["Blended CAC", "< £600", "< £450", "< £400"],
  ["Proposal → close rate", "25%", "30%", "35%+"],
  ["LTV : CAC", "—", "> 2:1", "> 3:1"],
];

export default function MarketingCommandCentre() {
  const [tab, setTab] = useState<Tab>("Advisor");

  return (
    <div>
      {/* Hero */}
      <div style={{ marginBottom: 18 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Eyebrow>Marketing Command Centre · June 2026</Eyebrow>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "0.66rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: T.primary,
              border: `1px solid ${T.primary}44`,
              background: `${T.primary}12`,
              borderRadius: 999,
              padding: "6px 12px",
            }}
          >
            North star — Recurring revenue
          </span>
        </div>
        <h1
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "clamp(1.9rem,4vw,3rem)",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: T.fg,
            marginTop: 14,
          }}
        >
          Stop selling websites.
          <br />
          <span className="hero-glow" style={{ color: T.primary }}>
            Start selling recovered revenue.
          </span>
        </h1>
        <div
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"
          style={{ marginTop: 22 }}
        >
          {[
            ["£24k/yr", "lost by the average UK trade to missed calls — our hook"],
            ["£1.6bn", "lost to salon no-shows a year — the clone market"],
            ["~85%", "gross margin on the recurring automation layer"],
            ["£3.5–6k", "target MRR by day 90 (15–25 retainer clients)"],
          ].map(([n, l]) => (
            <div
              key={l}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.lg,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontFamily: T.display,
                  fontWeight: 700,
                  fontSize: "1.6rem",
                  letterSpacing: "-0.02em",
                  color: T.primary,
                }}
              >
                {n}
              </div>
              <div
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.8rem",
                  color: T.muted,
                  marginTop: 4,
                  lineHeight: 1.4,
                }}
              >
                {l}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1.5 overflow-x-auto"
        style={{
          borderBottom: `1px solid ${T.border}`,
          marginBottom: 24,
          paddingBottom: 2,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              whiteSpace: "nowrap",
              fontFamily: T.sans,
              fontSize: "0.86rem",
              fontWeight: 500,
              padding: "9px 14px",
              borderRadius: 0,
              border: "none",
              cursor: "pointer",
              color: tab === t ? T.primary : T.muted,
              background: tab === t ? `${T.primary}12` : "transparent",
              borderBottom: `2px solid ${tab === t ? T.primary : "transparent"}`,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Panels */}
      {tab === "Advisor" && <AdvisorPlaybook />}

      {tab === "Strategy" && (
        <div>
          <div
            style={{
              borderLeft: `3px solid ${T.primary}`,
              background: `${T.primary}0d`,
              borderRadius: 0,
              padding: "16px 20px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "1.2rem",
                lineHeight: 1.35,
                color: T.fg,
              }}
            >
              &ldquo;Agency-quality build, freelancer-beating price, builder-beating
              ownership — live in weeks, and we run the system that brings you
              customers.&rdquo;
            </div>
            <div
              style={{
                color: T.muted,
                marginTop: 8,
                fontFamily: T.sans,
                fontSize: "0.9rem",
              }}
            >
              Brand line for the recurring model:{" "}
              <strong style={{ color: T.fg }}>
                &ldquo;Own your system. Subscribe to results.&rdquo;
              </strong>
            </div>
          </div>
          <H2>Who we sell to first</H2>
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <Tag>#1 · Dominate first</Tag>
              <h3
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  color: T.fg,
                  margin: "10px 0 6px",
                }}
              >
                Trades / Home Services
              </h3>
              <p style={{ color: T.muted, fontSize: "0.88rem", lineHeight: 1.55 }}>
                Plumbers, electricians, builders. The UK&apos;s #1 business sector.
                ~£24k/yr lost to missed calls; 85% of callers never leave a voicemail.
                Offer: <strong style={{ color: T.fg }}>Never Miss a Job</strong>{" "}
                £149–£399/mo.
              </p>
            </Card>
            <Card>
              <Tag>#2 · Clone the playbook</Tag>
              <h3
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  color: T.fg,
                  margin: "10px 0 6px",
                }}
              >
                Health &amp; Wellness
              </h3>
              <p style={{ color: T.muted, fontSize: "0.88rem", lineHeight: 1.55 }}>
                Salons, clinics, gyms. No-shows eat up to 20% of revenue; deposits cut
                them 70–85%. Offer: <strong style={{ color: T.fg }}>Zero No-Show</strong>{" "}
                £129–£349/mo.
              </p>
            </Card>
            <Card>
              <Tag tone="info">#3 · Tailwind, later</Tag>
              <h3
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  color: T.fg,
                  margin: "10px 0 6px",
                }}
              >
                Accountants (MTD)
              </h3>
              <p style={{ color: T.muted, fontSize: "0.88rem", lineHeight: 1.55 }}>
                Making Tax Digital is mandatory from April 2026 — a forced wave of
                &ldquo;client portal + document automation&rdquo; demand. Trust-heavy,
                slower sale → Q3/Q4.
              </p>
            </Card>
          </div>
          <H2>The hole in the market</H2>
          <div
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.r.lg,
              padding: 18,
            }}
          >
            {[
              [
                "Traditional agencies",
                "£2k–15k · 8–16 wks",
                "Slow, opaque pricing, lock-in (billed £337 to change one photo)",
                false,
              ],
              [
                "Freelance markets",
                "£500–2,500",
                "Quality lottery, plagiarism, no accountability",
                false,
              ],
              [
                "DIY builders",
                "£29–159/mo forever",
                "You never own it · can't export · 'monthly ransom'",
                false,
              ],
              [
                "Automation / WaaS",
                "£500–5,000/mo",
                "Rent-forever dependency · rebilled tool markups (£30 → £100)",
                false,
              ],
              [
                "▲ Nullshift",
                "setup + £129–399/mo",
                "Bespoke + fast + you own it + ethical recurring + live demos",
                true,
              ],
            ].map(([name, price, weak, win]) => (
              <div
                key={name as string}
                className="grid"
                style={{
                  gridTemplateColumns: "minmax(120px,180px) 1fr",
                  gap: 14,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: win ? T.primary : T.fg,
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{ fontFamily: T.mono, fontSize: "0.66rem", color: T.faint }}
                  >
                    {price}
                  </div>
                </div>
                <div
                  style={{
                    height: 26,
                    borderRadius: 0,
                    display: "flex",
                    alignItems: "center",
                    paddingInline: 10,
                    background: win
                      ? `linear-gradient(90deg, ${T.primary}40, ${T.primary}66)`
                      : `linear-gradient(90deg, ${T.danger}25, ${T.warning}25)`,
                    border: win ? `1px solid ${T.primary}80` : "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.76rem",
                      color: win ? T.fg : T.muted,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {weak}
                  </span>
                </div>
              </div>
            ))}
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: T.faint,
                marginTop: 12,
              }}
            >
              ⚠ Never compete on cheapest monthly vs £29 WaaS — win on outcome +
              ownership.
            </p>
          </div>
        </div>
      )}

      {tab === "Offer & Pricing" && (
        <div>
          <H2>The recurring-revenue engine</H2>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.95rem",
              lineHeight: 1.6,
              color: T.muted,
              maxWidth: "70ch",
              marginBottom: 20,
            }}
          >
            Stop selling deliverables; sell outcomes as subscriptions. The setup fee makes
            acquisition pay back almost immediately; the monthly compounds into MRR at
            ~85% gross margin.
          </p>
          <PlanLadder />
          <H2>Reframe the tiers you already have</H2>
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <h3
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  color: T.fg,
                  marginBottom: 6,
                }}
              >
                Partner → Done-with-you
              </h3>
              <p style={{ color: T.muted, fontSize: "0.88rem", lineHeight: 1.55 }}>
                <strong style={{ color: T.primary }}>£749/mo</strong> · we build it and
                teach you to own it in 12 months. Premium, sticky.
              </p>
            </Card>
            <Card>
              <h3
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  color: T.fg,
                  marginBottom: 6,
                }}
              >
                Maintenance → folded in
              </h3>
              <p style={{ color: T.muted, fontSize: "0.88rem", lineHeight: 1.55 }}>
                <strong style={{ color: T.primary }}>£249/mo</strong> · don&apos;t sell it
                naked — bake it into the care plans so every client is on an outcome plan.
              </p>
            </Card>
            <Card>
              <h3
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  color: T.fg,
                  marginBottom: 6,
                }}
              >
                Learning subs → entry + nurture
              </h3>
              <p style={{ color: T.muted, fontSize: "0.88rem", lineHeight: 1.55 }}>
                <strong style={{ color: T.primary }}>£19.99–£249/mo</strong> · the
                &ldquo;start here&rdquo; for DIY-ers and the holding pen for leads
                who&apos;ll ascend.
              </p>
            </Card>
          </div>
        </div>
      )}

      {tab === "Channels" && (
        <div>
          <H2>Channel strategy — organic core + £300–£1,000/mo paid</H2>
          {[
            {
              tier: "Tier 1 — do first, they convert",
              cards: [
                [
                  "Google Search Ads",
                  "High-intent local: '[trade] website [town]'. £300–700/mo — small budget works because intent is red-hot.",
                ],
                [
                  "Founder-led outbound",
                  "15–25 personalised 60-sec Loom teardowns/week. Best channel for your first 10–20 clients.",
                ],
                [
                  "Local SEO + GBP",
                  "Niche pages (trade × town). Own the 'money keyword' local searches organically.",
                ],
              ],
            },
            {
              tier: "Tier 2 — build in parallel",
              cards: [
                [
                  "Short-form video",
                  "Site teardowns, 'the £24k phone call', Systems Lab clips. Cheap, demonstrative.",
                ],
                [
                  "Meta retargeting",
                  "£150–300/mo retargeting demo/calculator visitors. Strong for wellness.",
                ],
                [
                  "Lead-magnet calculators",
                  "Missed-Call & No-Show tools quantify pain in £, then route to a call.",
                ],
              ],
            },
            {
              tier: "Tier 3 — multipliers",
              cards: [
                [
                  "Partnerships & referrals",
                  "Trade merchants, salon wholesalers, chambers. Reward: a free month or £100/signed client.",
                ],
                [
                  "Case-study engine",
                  "Every client = 'we recovered £X'. Make a video testimonial part of onboarding.",
                ],
                [
                  "Email nurture",
                  "Calculators + subs feed a list; monthly 'money on the table' emails convert.",
                ],
              ],
            },
          ].map((g) => (
            <div key={g.tier} style={{ marginBottom: 20 }}>
              <h3
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  color: T.fg,
                  marginBottom: 10,
                }}
              >
                {g.tier}
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {g.cards.map(([t, b]) => (
                  <Card key={t}>
                    <h4
                      style={{
                        fontFamily: T.display,
                        fontWeight: 600,
                        fontSize: "0.98rem",
                        color: T.fg,
                        marginBottom: 6,
                      }}
                    >
                      {t}
                    </h4>
                    <p style={{ color: T.muted, fontSize: "0.86rem", lineHeight: 1.55 }}>
                      {b}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          <div
            style={{
              borderLeft: `3px solid ${T.primary}`,
              background: `${T.primary}0d`,
              borderRadius: 0,
              padding: "14px 18px",
            }}
          >
            <strong style={{ color: T.fg }}>Paid budget starter (£600/mo):</strong>{" "}
            <span style={{ color: T.muted }}>
              Google Search £400 · Meta retargeting £150 · creative/tools £50. Scale
              Google first once CAC proves out.
            </span>
          </div>
        </div>
      )}

      {tab === "90-Day Roadmap" && <Roadmap />}

      {tab === "Numbers" && (
        <div>
          <H2>KPI targets</H2>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
                minWidth: 520,
              }}
            >
              <thead>
                <tr>
                  {["Metric", "30-day", "60-day", "90-day"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderBottom: `1px solid ${T.border}`,
                        fontFamily: T.mono,
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: T.muted,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {KPIS.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      background: row[0] === "MRR" ? `${T.primary}0a` : "transparent",
                    }}
                  >
                    {row.map((c, j) => (
                      <td
                        key={j}
                        style={{
                          padding: "10px 12px",
                          borderBottom: `1px solid ${T.border}`,
                          color: j === 0 ? T.fg : row[0] === "MRR" ? T.primary : T.muted,
                          fontWeight: j === 0 ? 600 : 400,
                          fontFamily: j > 0 && row[0] === "MRR" ? T.mono : T.sans,
                        }}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <H2>MRR &amp; unit-economics calculator</H2>
          <MrrCalculator />
          <H2>Lead magnet — &ldquo;Missed-Call Revenue&rdquo;</H2>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.9rem",
              color: T.muted,
              marginBottom: 14,
            }}
          >
            The trades hook as an interactive tool — the same one embedded on /trades.
          </p>
          <RevenueCalculator calc={TRADES.calc} />
          <div style={{ marginTop: 14 }}>
            <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
              The wellness clone (&ldquo;No-Show Cost&rdquo;) lives on{" "}
              <a href="/wellness" style={{ color: T.primary }}>
                /wellness
              </a>
              .
            </p>
          </div>
          <div style={{ marginTop: 18 }}>
            <RevenueCalculator calc={WELLNESS.calc} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Roadmap (localStorage progress) ──────────────────────── */
function Roadmap() {
  const all = useMemo(
    () => ROADMAP.flatMap((p, pi) => p.items.map((_, ii) => `${pi}-${ii}`)),
    []
  );
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem("ns_mkt_roadmap") || "{}"));
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = (id: string) =>
    setDone((d) => {
      const n = { ...d, [id]: !d[id] };
      try {
        localStorage.setItem("ns_mkt_roadmap", JSON.stringify(n));
      } catch {
        /* ignore */
      }
      return n;
    });
  const completed = all.filter((id) => done[id]).length;
  const pct = Math.round((completed / all.length) * 100);
  return (
    <div>
      <H2>90-day execution roadmap</H2>
      <div
        className="flex items-center gap-4"
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.r.lg,
          padding: "14px 18px",
          marginBottom: 18,
        }}
      >
        <span
          style={{
            fontFamily: T.sans,
            fontSize: "0.85rem",
            fontWeight: 600,
            color: T.muted,
          }}
        >
          Progress
        </span>
        <div
          style={{
            flex: 1,
            height: 10,
            background: T.elevated,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${T.primary}, ${T.primaryHover})`,
              transition: "width .3s",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: T.mono,
            fontWeight: 600,
            color: T.primary,
            minWidth: 44,
            textAlign: "right",
          }}
        >
          {pct}%
        </span>
      </div>
      {ROADMAP.map((p, pi) => (
        <div key={p.phase} style={{ marginBottom: 16 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.72rem",
                color: T.primary,
                border: `1px solid ${T.primary}44`,
                borderRadius: 0,
                padding: "3px 8px",
              }}
            >
              {p.phase}
            </span>
            <strong style={{ fontFamily: T.sans, fontSize: "0.92rem", color: T.fg }}>
              {p.title}
            </strong>
          </div>
          {p.items.map(([t, s], ii) => {
            const id = `${pi}-${ii}`;
            const isDone = !!done[id];
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className="flex gap-3 items-start w-full text-left"
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 0,
                  padding: "12px 14px",
                  marginBottom: 8,
                  cursor: "pointer",
                  opacity: isDone ? 0.55 : 1,
                }}
              >
                <span
                  style={{
                    flex: "0 0 20px",
                    height: 20,
                    borderRadius: 0,
                    border: `1.5px solid ${isDone ? T.primary : T.borderStr}`,
                    background: isDone ? T.primary : "transparent",
                    color: T.bg,
                    display: "grid",
                    placeItems: "center",
                    fontSize: "0.78rem",
                    marginTop: 1,
                  }}
                >
                  {isDone ? "✓" : ""}
                </span>
                <span>
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      color: T.fg,
                      textDecoration: isDone ? "line-through" : "none",
                      display: "block",
                    }}
                  >
                    {t}
                  </span>
                  <span
                    style={{ fontFamily: T.sans, fontSize: "0.78rem", color: T.faint }}
                  >
                    {s}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── Advisor playbook (use the /marketing-advisor agent in Claude Code) ── */
const ADVISOR_MODES: [string, string][] = [
  [
    "Campaign",
    "Concept, hook, audience, channel, offer, creative angles, CTA + the metric it moves — anchored on a real stat (£24k / £1.6bn).",
  ],
  [
    "Ad copy",
    "3–5 ready-to-paste variants per platform. Pain in pounds, ownership + speed, clear CTA.",
  ],
  [
    "Landing page",
    "Section-by-section web copy: hero, proof, offer ladder, objection-busters, demo CTA, FAQ.",
  ],
  [
    "Outreach",
    "60-sec Loom teardown scripts, cold email/DM sequences, follow-ups — referencing the prospect's actual listing.",
  ],
  [
    "SEO / content",
    "Niche trade×town pages, calculators, short-form video scripts — mapped to a keyword + funnel stage.",
  ],
  [
    "Weekly plan",
    "A prioritised do-list tied to the 90-day roadmap and KPI targets, with effort estimates.",
  ],
  [
    "Funnel / pricing audit",
    "Reads the site, finds the leaks, ranks fixes by MRR impact.",
  ],
  [
    "KPI review",
    "Interprets your numbers against the targets and names the single highest-leverage next action.",
  ],
];
const ADVISOR_PROMPTS = [
  "Plan my marketing week",
  "Write the Never-Miss-a-Job hero + offer section",
  "10 trade outreach Looms for Leeds",
  "Google Ads for electricians in [town]",
  "Audit my pricing page for MRR",
  "5 short-form video scripts from the Systems Lab",
  "Zero-No-Show campaign for salons",
  "Monthly client report template that prevents churn",
];

function AdvisorPlaybook() {
  return (
    <div>
      <div
        style={{
          borderLeft: `3px solid ${T.primary}`,
          background: `${T.primary}0d`,
          borderRadius: 0,
          padding: "18px 22px",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "1.2rem",
            color: T.fg,
          }}
        >
          Your in-house growth marketer lives in Claude Code.
        </div>
        <p
          style={{
            color: T.muted,
            marginTop: 8,
            fontFamily: T.sans,
            fontSize: "0.92rem",
            lineHeight: 1.6,
            maxWidth: "70ch",
          }}
        >
          Run{" "}
          <code
            style={{
              fontFamily: T.mono,
              fontSize: "0.85em",
              background: T.elevated,
              padding: "2px 7px",
              borderRadius: 0,
              color: T.primary,
            }}
          >
            /marketing-advisor
          </code>{" "}
          in Claude Code. The agent (
          <span style={{ fontFamily: T.mono, fontSize: "0.82em", color: T.faint }}>
            .claude/agents/marketing-advisor.md
          </span>
          ) reads your full strategy and writes campaigns, copy, outreach and plans
          straight into the repo — tied to MRR and pounds.{" "}
          <strong style={{ color: T.fg }}>
            No API key, included with your Claude Code plan.
          </strong>
        </p>
      </div>

      <H2>What to ask it</H2>
      <div className="grid sm:grid-cols-2 gap-4">
        {ADVISOR_MODES.map(([t, d]) => (
          <Card key={t}>
            <h3
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "0.98rem",
                color: T.fg,
                marginBottom: 6,
              }}
            >
              {t}
            </h3>
            <p style={{ color: T.muted, fontSize: "0.86rem", lineHeight: 1.55 }}>{d}</p>
          </Card>
        ))}
      </div>

      <H2>Quick-start prompts</H2>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.88rem",
          color: T.muted,
          marginBottom: 14,
        }}
      >
        Copy any of these into Claude Code:
      </p>
      <div className="flex flex-col gap-2">
        {ADVISOR_PROMPTS.map((p) => (
          <div
            key={p}
            className="flex items-center gap-3"
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.r.md,
              padding: "11px 14px",
            }}
          >
            <span style={{ fontFamily: T.mono, fontSize: "0.72rem", color: T.primary }}>
              /marketing-advisor
            </span>
            <span style={{ fontFamily: T.sans, fontSize: "0.88rem", color: T.fg }}>
              {p}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── MRR / unit-economics calculator ──────────────────────── */
function MrrCalculator() {
  const [v, setV] = useState({
    clients: 20,
    fee: 220,
    setup: 600,
    margin: 85,
    ret: 21,
    cac: 400,
  });
  const set = (k: keyof typeof v, val: number) => setV((p) => ({ ...p, [k]: val }));
  const mrr = v.clients * v.fee;
  const ltv = v.setup + v.fee * (v.margin / 100) * v.ret;
  const ratio = v.cac > 0 ? ltv / v.cac : 0;
  const payback = Math.max(0, (v.cac - v.setup) / (v.fee * (v.margin / 100)));
  const sliders: [
    keyof typeof v,
    string,
    number,
    number,
    number,
    (n: number) => string,
  ][] = [
    ["clients", "Retainer clients", 1, 100, 1, (n) => String(n)],
    ["fee", "Avg monthly fee", 99, 749, 10, gbp],
    ["setup", "Avg setup fee", 0, 1500, 50, gbp],
    ["margin", "Gross margin on monthly", 50, 95, 1, (n) => n + "%"],
    ["ret", "Avg retention (months)", 6, 48, 1, String],
    ["cac", "Cost to acquire (CAC)", 50, 1500, 10, gbp],
  ];
  return (
    <div className="grid md:grid-cols-2 gap-5" style={{ marginBottom: 8 }}>
      <Card>
        <div className="flex flex-col gap-4">
          {sliders.map(([k, label, min, max, step, fmt]) => (
            <div key={k}>
              <label
                className="flex items-center justify-between"
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.84rem",
                  color: T.muted,
                  marginBottom: 6,
                }}
              >
                <span>{label}</span>
                <span style={{ fontFamily: T.mono, fontWeight: 600, color: T.primary }}>
                  {fmt(v[k])}
                </span>
              </label>
              <input
                type="range"
                className="ns-range"
                min={min}
                max={max}
                step={step}
                value={v[k]}
                onChange={(e) => set(k, +e.target.value)}
              />
            </div>
          ))}
        </div>
      </Card>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {[
            ["MRR", gbp(mrr), T.primary],
            ["ARR", gbp(mrr * 12), T.primary],
            ["LTV / client", gbp(ltv), T.info],
            [
              "LTV : CAC",
              ratio.toFixed(1) + ":1",
              ratio >= 3 ? T.primary : ratio >= 2 ? T.warning : T.danger,
            ],
          ].map(([l, val, c]) => (
            <div
              key={l as string}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.md,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontFamily: T.display,
                  fontWeight: 700,
                  fontSize: "1.5rem",
                  letterSpacing: "-0.02em",
                  color: c as string,
                }}
              >
                {val}
              </div>
              <div
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.78rem",
                  color: T.muted,
                  marginTop: 2,
                }}
              >
                {l}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: T.r.md,
            padding: 16,
          }}
        >
          <div style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted }}>
            CAC payback incl. setup fee
          </div>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: "1.25rem",
              color: T.fg,
            }}
          >
            {payback.toFixed(1)} months
          </div>
          <div
            style={{
              fontFamily: T.sans,
              fontSize: "0.8rem",
              marginTop: 6,
              color: ratio >= 3 ? T.primary : ratio >= 2 ? T.warning : T.danger,
            }}
          >
            {ratio >= 3
              ? "✅ Healthy — above the 3:1 benchmark. Press the accelerator."
              : ratio >= 2
                ? "🟡 Workable — improve retention or lower CAC to clear 3:1."
                : "🔴 Tight — cut acquisition cost or raise fee/retention."}
          </div>
        </div>
      </div>
    </div>
  );
}
