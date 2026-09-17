import Link from "next/link";
import { clientCreationEnabled, realDataEnabled } from "@/lib/next/live-data";
import { LiveSettings } from "../LiveViews";
import { activeFlags, OPS_V2_FLAG_KEYS } from "@/lib/flags";
import {
  SECRETS_NOTE,
  SETTINGS_HISTORY,
  SETTINGS_SECTIONS,
  settingsSectionById,
} from "@/lib/next/fixtures-ops";
import s from "../next.module.css";
import o from "../ops.module.css";
import { Notice, first, stateTone } from "../sales/ops-ui";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  if (realDataEnabled())
    return (
      <LiveSettings flags={activeFlags()} creationEnabled={clientCreationEnabled()} />
    );
  const sectionId = first(sp.section) ?? SETTINGS_SECTIONS[0].id;
  const section = settingsSectionById(sectionId) ?? SETTINGS_SECTIONS[0];
  const on = new Set(activeFlags());

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>Settings · fixtures · read-only in this slice</p>
          <h1 className={s.h1}>Settings</h1>
          <p className={s.lead}>
            Read access is separate from permission to change pricing, tax mapping,
            provider accounts or templates. Changes are versioned with effective dates and
            an impact preview.
          </p>
        </div>
      </div>

      <Notice tone="info">{SECRETS_NOTE}</Notice>

      <div className={o.settingsLayout} style={{ marginTop: 24 }}>
        <nav className={o.settingsNav} aria-label="Settings sections">
          {SETTINGS_SECTIONS.map((sec) => {
            const active = sec.id === section.id;
            return (
              <Link
                key={sec.id}
                href={`/admin/next/settings?section=${sec.id}`}
                className={`${o.settingsLink} ${active ? o.settingsLinkActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {sec.title}
              </Link>
            );
          })}
          <Link
            href="/admin/next/settings?section=history"
            className={`${o.settingsLink} ${sectionId === "history" ? o.settingsLinkActive : ""}`}
          >
            Version history
          </Link>
          <Link
            href="/admin/next/settings?section=flags"
            className={`${o.settingsLink} ${sectionId === "flags" ? o.settingsLinkActive : ""}`}
          >
            Feature flags
          </Link>
        </nav>

        {sectionId === "history" ? (
          <section className={s.card} aria-labelledby="history">
            <h2 className={s.h2} id="history">
              Version history
            </h2>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Section</th>
                  <th>Change</th>
                  <th>Effective from</th>
                  <th>By</th>
                  <th>Approved by</th>
                </tr>
              </thead>
              <tbody>
                {SETTINGS_HISTORY.map((h) => (
                  <tr key={`${h.at}-${h.section}`}>
                    <td className={s.mono}>{h.at}</td>
                    <td>{h.section}</td>
                    <td>{h.change}</td>
                    <td className={s.muted}>{h.effectiveFrom}</td>
                    <td>{h.by}</td>
                    <td className={s.muted}>{h.approvedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : sectionId === "flags" ? (
          <section className={s.card} aria-labelledby="flags">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="flags" style={{ margin: 0 }}>
                Feature flags (OPS_V2_FLAGS)
              </h2>
              <span className={s.mono}>read server-side · not editable here</span>
            </div>
            <ul className={s.list}>
              {OPS_V2_FLAG_KEYS.map((k) => (
                <li key={k} className={s.listItem}>
                  <span
                    className={s.mono}
                    style={{ textTransform: "none", letterSpacing: 0 }}
                  >
                    {k}
                  </span>
                  <span className={`${s.chip} ${on.has(k) ? s.chipSuccess : ""}`}>
                    {on.has(k) ? "on" : "off"}
                  </span>
                </li>
              ))}
            </ul>
            <p className={s.queueMeta} style={{ marginTop: 12 }}>
              Every new-model behaviour is off by default. Flags are set in the deployment
              environment, never from a form.
            </p>
          </section>
        ) : (
          <section className={s.card} aria-labelledby={`sec-${section.id}`}>
            <div className={s.cardTitle}>
              <h2 className={s.h2} id={`sec-${section.id}`} style={{ margin: 0 }}>
                {section.title}
              </h2>
              <span className={s.mono}>
                {section.version.id} ·{" "}
                <span className={`${s.chip} ${stateTone(section.version.status)}`}>
                  {section.version.status}
                </span>{" "}
                · effective {section.version.effectiveFrom}
              </span>
            </div>
            <p className={s.muted} style={{ marginTop: 0 }}>
              {section.summary}
            </p>

            <div className={o.permGrid}>
              <div className={o.perm}>
                <span className={s.mono}>Read</span>
                <div style={{ fontWeight: 600, marginTop: 4 }}>
                  {section.readPermission}
                </div>
              </div>
              <div className={`${o.perm} ${o.permChange}`}>
                <span className={s.mono}>Change</span>
                <div style={{ fontWeight: 600, marginTop: 4 }}>
                  {section.changePermission}
                </div>
              </div>
            </div>

            <div>
              {section.fields.map((f) => (
                <div key={f.label} className={o.fieldRow}>
                  <span className={s.muted}>{f.label}</span>
                  <span className={f.kind === "secret reference" ? o.secretRef : ""}>
                    {f.value}
                  </span>
                  <span className={s.mono}>{f.kind}</span>
                </div>
              ))}
            </div>

            {section.pendingChange ? (
              <div style={{ marginTop: 16 }}>
                <Notice tone="warning">
                  Pending change <strong>{section.pendingChange.id}</strong> · effective
                  from {section.pendingChange.effectiveFrom} · approved by{" "}
                  {section.pendingChange.approvedBy ?? "nobody yet"}
                  <div style={{ marginTop: 6 }}>
                    Impact preview: {section.pendingChange.impactPreview}
                  </div>
                </Notice>
              </div>
            ) : null}

            <div className={s.chips} style={{ marginTop: 16 }}>
              <button
                type="button"
                className={s.btn}
                disabled
                title={`Requires: ${section.changePermission} — writes not in this slice`}
              >
                Propose change
              </button>
              <button type="button" className={s.btn} disabled title="Not in this slice">
                Preview impact
              </button>
            </div>
            <p className={s.faint} style={{ margin: "8px 0 0", fontSize: 12 }}>
              A change creates a new version with an effective date; it never edits the
              version in force. Secrets are never included in a form or an export.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
