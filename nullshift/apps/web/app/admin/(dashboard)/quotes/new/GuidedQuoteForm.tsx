"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  EMPTY_GUIDED_INPUT,
  FEATURES,
  PLAN_LABEL,
  TURNOVER_BANDS,
  TURNOVER_BAND_LABEL,
  URGENCY_LABEL,
  clientSummary,
  formatGbpMinor,
  guidedEstimate,
  type FeatureKey,
  type GuidedInput,
  type TurnoverBand,
  type Urgency,
} from "@/lib/estimator/guided";
import { saveGuidedDraft } from "../actions";
import s from "../../shell.module.css";
import g from "./guided.module.css";

/**
 * The guided estimator form. Everything on the right recomputes on every
 * change from the pure lib; the only server call is "Save as draft quote".
 */

export type ClientOption = { id: string; name: string };
export type ExistingDraft = {
  versionId: string;
  expectedUpdatedAt: string;
  editable: boolean;
  label: string;
};

const SECTORS = [
  "Trades and home services",
  "Health, wellness and beauty",
  "Fitness and dance studios",
  "Hospitality and events",
  "Professional services",
  "Retail and e-commerce",
  "Education and training",
  "Property and lettings",
  "Manufacturing and logistics",
  "Charity or membership body",
];

const toInt = (v: string): number | null => {
  const t = v.trim().replace(/[,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
const fromInt = (n: number | null | undefined): string => (n === null || n === undefined ? "" : String(n));

export function GuidedQuoteForm({
  clients,
  initial,
  existing,
}: {
  clients: ClientOption[];
  initial: GuidedInput | null;
  existing: ExistingDraft | null;
}) {
  const router = useRouter();
  const [input, setInput] = useState<GuidedInput>(initial ?? EMPTY_GUIDED_INPUT);
  const [otherUnknown, setOtherUnknown] = useState(initial?.integrations.otherCount === null);
  const [migrationUnknown, setMigrationUnknown] = useState(
    initial ? initial.migration.needed && initial.migration.recordCount === null : false
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => guidedEstimate(input), [input]);

  const patch = <K extends keyof GuidedInput>(key: K, value: Partial<GuidedInput[K]>) =>
    setInput((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...value } }));

  const toggleFeature = (key: FeatureKey, on: boolean) =>
    setInput((prev) => ({
      ...prev,
      features: on ? [...prev.features.filter((k) => k !== key), key] : prev.features.filter((k) => k !== key),
    }));

  const setQuantity = (key: FeatureKey, value: string) =>
    setInput((prev) => {
      const n = toInt(value);
      const quantities = { ...prev.quantities };
      if (n === null) delete quantities[key];
      else quantities[key] = n;
      return { ...prev, quantities };
    });

  const selectTenant = (id: string) => {
    const c = clients.find((x) => x.id === id) ?? null;
    patch("client", { tenantId: c ? c.id : null, ...(c ? { name: c.name } : {}) });
  };

  async function save() {
    setError(null);
    if (!input.client.name.trim()) {
      setError("Give the client or prospect a name before saving.");
      return;
    }
    setPending(true);
    try {
      const r = await saveGuidedDraft(
        input,
        existing && existing.editable
          ? { versionId: existing.versionId, expectedUpdatedAt: existing.expectedUpdatedAt }
          : null
      );
      if (!r.ok) {
        setError(
          r.reason === "stale"
            ? "That draft changed elsewhere. Open it from the quotes list and try again."
            : `Could not save: ${r.reason}${r.detail ? ` — ${r.detail}` : ""}`
        );
        return;
      }
      router.push(
        `/admin/quotes/${r.versionId}?notice=${encodeURIComponent(existing?.editable ? "ok:draft updated from the guided estimate" : "ok:draft v1 created from the guided estimate")}`
      );
    } catch {
      setError("We could not confirm the save. Your entries are still here; try again.");
    } finally {
      setPending(false);
    }
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(clientSummary(input, result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard is not available here. Select the summary text in the Studio instead.");
    }
  }

  const m = result.monthly;
  const b = result.build;
  const topDrivers = [...b.drivers].sort((x, y) => y.hours.base - x.hours.base).slice(0, 6);

  return (
    <div className={g.layout}>
      <form
        className={g.form}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {/* 1 · Who */}
        <section className={g.section} aria-labelledby="who">
          <div className={g.sectionHead}>
            <span className={g.sectionNo}>01</span>
            <h2 className={g.sectionTitle} id="who">
              Who
            </h2>
          </div>
          <p className={g.hint}>Pick an existing client or type a new name. The sector only labels the quote.</p>
          <div className={g.grid}>
            <label className={g.label}>
              <span className={g.labelText}>Existing client</span>
              <select
                className={g.select}
                value={input.client.tenantId ?? ""}
                onChange={(e) => selectTenant(e.target.value)}
              >
                <option value="">Prospect (no client record yet)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={g.label}>
              <span className={g.labelText}>Client or prospect name</span>
              <input
                className={g.input}
                value={input.client.name}
                onChange={(e) => patch("client", { name: e.target.value })}
                placeholder="e.g. Dance Exclusive"
                required
              />
            </label>
            <label className={`${g.label} ${g.full}`}>
              <span className={g.labelText}>Sector</span>
              <input
                className={g.input}
                list="guided-sectors"
                value={input.client.sector}
                onChange={(e) => patch("client", { sector: e.target.value })}
                placeholder="e.g. Trades and home services"
              />
              <datalist id="guided-sectors">
                {SECTORS.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </label>
          </div>
        </section>

        {/* 2 · How big */}
        <section className={g.section} aria-labelledby="size">
          <div className={g.sectionHead}>
            <span className={g.sectionNo}>02</span>
            <h2 className={g.sectionTitle} id="size">
              How big
            </h2>
          </div>
          <p className={g.hint}>
            Size sets the monthly. Monthly is what it costs us to run and support a system this size; the
            build is the one-off project price. Rough numbers are fine; blank means not known.
          </p>
          <div className={`${g.grid} ${g.grid3}`}>
            <label className={g.label}>
              <span className={g.labelText}>Staff</span>
              <input
                className={g.input}
                inputMode="numeric"
                value={fromInt(input.size.staffCount)}
                onChange={(e) => patch("size", { staffCount: toInt(e.target.value) })}
                placeholder="e.g. 6"
              />
              <span className={g.help}>People who will use it inside the business.</span>
            </label>
            <label className={g.label}>
              <span className={g.labelText}>Sites or locations</span>
              <input
                className={g.input}
                inputMode="numeric"
                value={fromInt(input.size.sites)}
                onChange={(e) => patch("size", { sites: toInt(e.target.value) })}
                placeholder="e.g. 1"
              />
              <span className={g.help}>Branches, studios, depots, clinics.</span>
            </label>
            <label className={g.label}>
              <span className={g.labelText}>Customers a month</span>
              <input
                className={g.input}
                inputMode="numeric"
                value={fromInt(input.size.customersPerMonth)}
                onChange={(e) => patch("size", { customersPerMonth: toInt(e.target.value) })}
                placeholder="e.g. 300"
              />
              <span className={g.help}>Bookings, orders or enquiries in a typical month.</span>
            </label>
            <label className={`${g.label} ${g.full}`}>
              <span className={g.labelText}>Annual turnover (optional)</span>
              <select
                className={g.select}
                value={input.size.turnoverBand ?? ""}
                onChange={(e) => patch("size", { turnoverBand: (e.target.value || null) as TurnoverBand | null })}
              >
                <option value="">Not known</option>
                {TURNOVER_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {TURNOVER_BAND_LABEL[band]}
                  </option>
                ))}
              </select>
              <span className={g.help}>Turnover outranks staff count in the scale score when both are given.</span>
            </label>
          </div>
        </section>

        {/* 3 · What they want */}
        <section className={g.section} aria-labelledby="want">
          <div className={g.sectionHead}>
            <span className={g.sectionNo}>03</span>
            <h2 className={g.sectionTitle} id="want">
              What they want
            </h2>
          </div>
          <p className={g.hint}>
            Tick what the system must do. Each item adds a work package with its own hours; the
            quantities fine-tune it.
          </p>
          <div className={g.features}>
            {FEATURES.map((f) => {
              const on = input.features.includes(f.key);
              return (
                <label key={f.key} className={`${g.feature} ${on ? g.featureOn : ""}`}>
                  <input type="checkbox" checked={on} onChange={(e) => toggleFeature(f.key, e.target.checked)} />
                  <span>{f.label}</span>
                  <span className={g.featureHint}>{f.hint}</span>
                  {on && f.perUnit ? (
                    <span className={g.featureQty}>
                      <input
                        inputMode="numeric"
                        aria-label={`${f.label}: ${f.perUnit.label}`}
                        value={fromInt(input.quantities[f.key])}
                        placeholder={String(f.perUnit.included)}
                        onChange={(e) => setQuantity(f.key, e.target.value)}
                      />
                      {f.perUnit.label} ({f.perUnit.included} included)
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </section>

        {/* 4 · Integrations & data */}
        <section className={g.section} aria-labelledby="data">
          <div className={g.sectionHead}>
            <span className={g.sectionNo}>04</span>
            <h2 className={g.sectionTitle} id="data">
              Integrations and data
            </h2>
          </div>
          <p className={g.hint}>
            Systems it must talk to, and data that must come across. Unknown counts widen the range;
            they never make it zero.
          </p>
          <div className={g.grid}>
            {(
              [
                ["accounting", "Accounting", "Xero, QuickBooks, Sage."],
                ["payments", "Payments provider", "An existing Stripe, GoCardless or SumUp account."],
                ["calendar", "Calendar", "Google or Outlook calendars."],
                ["email", "Email or marketing platform", "Mailchimp, Brevo, Outlook."],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className={g.check}>
                <input
                  type="checkbox"
                  checked={input.integrations[key]}
                  onChange={(e) => patch("integrations", { [key]: e.target.checked } as Partial<GuidedInput["integrations"]>)}
                />
                <span>
                  {label}
                  <span className={g.checkHint}>{hint}</span>
                </span>
              </label>
            ))}
            <label className={g.label}>
              <span className={g.labelText}>Other systems (count)</span>
              <input
                className={g.input}
                inputMode="numeric"
                disabled={otherUnknown}
                value={otherUnknown ? "" : fromInt(input.integrations.otherCount)}
                onChange={(e) => patch("integrations", { otherCount: toInt(e.target.value) ?? 0 })}
                placeholder="0"
              />
              <label className={g.check} style={{ padding: "4px 0 0" }}>
                <input
                  type="checkbox"
                  checked={otherUnknown}
                  onChange={(e) => {
                    setOtherUnknown(e.target.checked);
                    patch("integrations", { otherCount: e.target.checked ? null : 0 });
                  }}
                />
                <span>Some, not sure how many yet</span>
              </label>
            </label>
            <label className={g.label}>
              <span className={g.labelText}>Name them (optional)</span>
              <input
                className={g.input}
                value={input.integrations.otherNames}
                onChange={(e) => patch("integrations", { otherNames: e.target.value })}
                placeholder="e.g. Trello, a supplier API"
              />
            </label>
            <label className={`${g.check} ${g.full}`}>
              <input
                type="checkbox"
                checked={input.migration.needed}
                onChange={(e) => patch("migration", { needed: e.target.checked })}
              />
              <span>
                Move existing data across
                <span className={g.checkHint}>From spreadsheets or another system into the new one.</span>
              </span>
            </label>
            {input.migration.needed ? (
              <>
                <label className={g.label}>
                  <span className={g.labelText}>Rough record count</span>
                  <input
                    className={g.input}
                    inputMode="numeric"
                    disabled={migrationUnknown}
                    value={migrationUnknown ? "" : fromInt(input.migration.recordCount)}
                    onChange={(e) => patch("migration", { recordCount: toInt(e.target.value) })}
                    placeholder="e.g. 5000"
                  />
                  <label className={g.check} style={{ padding: "4px 0 0" }}>
                    <input
                      type="checkbox"
                      checked={migrationUnknown}
                      onChange={(e) => {
                        setMigrationUnknown(e.target.checked);
                        if (e.target.checked) patch("migration", { recordCount: null });
                      }}
                    />
                    <span>Not known yet</span>
                  </label>
                </label>
                <label className={g.label}>
                  <span className={g.labelText}>Where from</span>
                  <input
                    className={g.input}
                    value={input.migration.source}
                    onChange={(e) => patch("migration", { source: e.target.value })}
                    placeholder="e.g. Excel, Acuity, an old CRM"
                  />
                </label>
              </>
            ) : null}
          </div>
        </section>

        {/* 5 · Constraints */}
        <section className={g.section} aria-labelledby="constraints">
          <div className={g.sectionHead}>
            <span className={g.sectionNo}>05</span>
            <h2 className={g.sectionTitle} id="constraints">
              Constraints
            </h2>
          </div>
          <p className={g.hint}>Things that add work or risk without adding features.</p>
          <div className={g.grid}>
            <label className={`${g.label} ${g.full}`}>
              <span className={g.labelText}>Deadline</span>
              <select
                className={g.select}
                value={input.constraints.urgency}
                onChange={(e) => patch("constraints", { urgency: e.target.value as Urgency })}
              >
                {(Object.keys(URGENCY_LABEL) as Urgency[]).map((u) => (
                  <option key={u} value={u}>
                    {URGENCY_LABEL[u]}
                  </option>
                ))}
              </select>
              <span className={g.help}>A tight date adds coordination hours and contingency.</span>
            </label>
            <label className={g.check}>
              <input
                type="checkbox"
                checked={input.constraints.sensitiveData}
                onChange={(e) => patch("constraints", { sensitiveData: e.target.checked })}
              />
              <span>
                Sensitive or regulated data
                <span className={g.checkHint}>Medical, financial, children, or anything a regulator cares about.</span>
              </span>
            </label>
            <label className={g.check}>
              <input
                type="checkbox"
                checked={input.constraints.clientOwnAccounts}
                onChange={(e) => patch("constraints", { clientOwnAccounts: e.target.checked })}
              />
              <span>
                Runs on the client&apos;s own accounts
                <span className={g.checkHint}>Hosting, payments and email set up in their name from day one.</span>
              </span>
            </label>
          </div>
        </section>
      </form>

      {/* Results */}
      <aside className={g.results} aria-label="Estimate" aria-live="polite">
        <div className={g.block}>
          <span className={g.eyebrow}>Build · one-off</span>
          <div className={g.big}>{formatGbpMinor(b.recommendedMinor)}</div>
          <div className={g.range}>
            Range {formatGbpMinor(b.lowMinor)} – {formatGbpMinor(b.highMinor)} · {b.hours.base} h base ·
            contingency {b.contingencyPct}% · floor {formatGbpMinor(b.floorMinor)}
          </div>
          {b.reviewRequired ? (
            <p className={g.note}>Above the review threshold. Not capped; a second person reviews it.</p>
          ) : null}
        </div>

        <div className={g.block}>
          <span className={g.eyebrow}>
            Monthly · {m.bandLabel}
            {m.multiplier !== null ? ` band, ×${m.multiplier}` : ""} · NSI {m.nsi}
          </span>
          <div className={g.plans}>
            {(["core", "pro", "max"] as const).map((plan) => (
              <div key={plan} className={`${g.plan} ${m.recommendedPlan === plan ? g.planOn : ""}`}>
                <div className={g.planName}>{PLAN_LABEL[plan]}</div>
                <div className={g.planPrice}>
                  {formatGbpMinor(m[`${plan}Minor`])}
                  <small> /mo</small>
                </div>
              </div>
            ))}
          </div>
          <div className={g.range}>
            {m.enterpriseReview
              ? "Enterprise review needed: the engine will not price this size automatically."
              : `Suggest ${PLAN_LABEL[m.recommendedPlan]}: ${m.reason}.`}
          </div>
        </div>

        <div className={g.block}>
          <span className={g.eyebrow}>What drives the build</span>
          <ul className={g.drivers}>
            {topDrivers.map((d) => (
              <li key={d.id} className={g.driver}>
                <span>{d.label}</span>
                <span className={g.driverHours}>
                  {d.hours.base} h{d.uncertain ? " (wide)" : ""}
                </span>
                <span className={g.driverReason}>{d.reason}</span>
              </li>
            ))}
          </ul>
          {b.drivers.length > topDrivers.length ? (
            <div className={g.help} style={{ marginTop: 6 }}>
              {b.drivers.length - topDrivers.length} more in the Studio.
            </div>
          ) : null}
        </div>

        <div className={g.block}>
          <span className={g.eyebrow}>Confidence</span>
          <div style={{ marginTop: 6 }}>
            <span
              className={`${s.chip} ${result.confidence === "low" ? s.chipWarning : result.confidence === "high" ? s.chipSuccess : s.chipInfo}`}
            >
              {result.confidence}
            </span>
            {result.discoveryRecommended ? (
              <span className={s.muted} style={{ marginLeft: 8, fontSize: 13 }}>
                Discovery recommended before a fixed price.
              </span>
            ) : null}
          </div>
          {result.notes.map((n) => (
            <p key={n} className={g.note}>
              {n}
            </p>
          ))}
        </div>

        <div className={g.block}>
          {error ? (
            <p className={g.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={g.actions}>
            <button type="button" className={s.btnPrimary} onClick={() => void save()} disabled={pending}>
              {pending ? "Saving…" : existing?.editable ? "Update draft quote" : "Save as draft quote"}
            </button>
            <button type="button" className={s.btn} onClick={() => void copySummary()}>
              {copied ? "Copied" : "Copy summary"}
            </button>
            {existing ? (
              <Link href={`/admin/quotes/${existing.versionId}`} className={s.btn}>
                Back to {existing.label}
              </Link>
            ) : (
              <Link href="/admin/quotes" className={s.btn}>
                Cancel
              </Link>
            )}
          </div>
          <p className={g.help} style={{ marginTop: 8 }}>
            {existing && !existing.editable
              ? "That version is frozen, so saving creates a new opportunity and draft."
              : "Saving creates an opportunity at Scope ready and a v1 draft in the Studio with these packages, prices and the managed route. Copy summary puts a client-safe version on the clipboard: no hours, costs or margins."}
          </p>
        </div>
      </aside>
    </div>
  );
}
