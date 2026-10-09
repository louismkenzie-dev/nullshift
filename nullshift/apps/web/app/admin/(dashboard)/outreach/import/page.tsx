import Link from "next/link";
import { AGENCY_TYPES, CSV_COLUMNS } from "@/lib/ops/outreachData";
import s from "../../shell.module.css";
import o from "../../ops.module.css";
import { Notice, first } from "../../sales/ops-ui";
import { importCsvFromForm } from "../actions";
import { noticeFor } from "../outreach-ui";

export const dynamic = "force-dynamic";

const EXAMPLE = `company,website,country,agency_type,contact_name,contact_role,email,linkedin_url,instagram_handle,source,fit_notes
The Sunday Commerce,sundaycommerce.co,United Kingdom,growth_consultant,Jane Doe,Founder,jane@sundaycommerce.co,https://linkedin.com/in/janedoe,@sundaycommerce,warm intro,"Knows Louis, interest already expressed"`;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const notice = noticeFor(first(sp.notice));

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/outreach">Outreach</Link> / Import CSV
      </p>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>Import prospects</h1>
          <p className={s.lead}>
            Paste a CSV (or tab-separated) list with a header row. Only{" "}
            <span className={s.mono}>company</span> is required. Rows whose email already
            exists are skipped, never overwritten. Everything lands as <em>sourced</em>{" "}
            unless you tick &ldquo;queue immediately&rdquo;.
          </p>
        </div>
        <Link href="/admin/outreach" className={s.btn}>
          Back
        </Link>
      </div>

      {notice ? (
        <div style={{ marginBottom: 16 }}>
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      ) : null}

      <form action={importCsvFromForm} className={o.drawer}>
        <div className={s.card}>
          <div className={o.section}>
            <p className={o.sectionTitle}>CSV</p>
            <textarea
              name="csv"
              rows={16}
              required
              className={s.search}
              style={{
                maxWidth: "none",
                height: "auto",
                padding: 10,
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: 12,
              }}
              placeholder={EXAMPLE}
              aria-label="CSV text"
            />
          </div>
          <div className={o.section}>
            <p className={o.sectionTitle}>Columns</p>
            <div className={s.chips}>
              {CSV_COLUMNS.map((c) => (
                <span
                  key={c}
                  className={`${s.chip} ${c === "company" ? s.chipInfo : ""}`}
                >
                  {c}
                </span>
              ))}
            </div>
            <p className={s.queueMeta}>
              Any order; unknown columns are ignored.{" "}
              <span className={s.mono}>agency_type</span> accepts{" "}
              {AGENCY_TYPES.join(", ")} (friendly spellings such as &ldquo;SEO&rdquo; or
              &ldquo;growth&rdquo; are mapped; anything else becomes &ldquo;other&rdquo;).
            </p>
          </div>
        </div>

        <aside className={o.aside} aria-label="Import options">
          <section className={s.card}>
            <p className={o.sectionTitle}>Defaults</p>
            <label className={s.field}>
              <span className={s.fieldLabel}>Source (when the row has none)</span>
              <input
                name="source"
                className={s.search}
                style={{ maxWidth: "none" }}
                placeholder="Clutch list, Oct 2026"
              />
            </label>
            <label className={s.field}>
              <span className={s.fieldLabel}>Owner</span>
              <input
                name="owner"
                className={s.search}
                style={{ maxWidth: "none" }}
                placeholder="Louis"
              />
            </label>
            <label
              className={s.field}
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <input type="checkbox" name="queue" />
              <span>Queue immediately (step 1 due now)</span>
            </label>
            <p className={s.queueMeta}>
              Leave unticked to verify each prospect before its sequence starts. At most
              500 rows per paste.
            </p>
            <button type="submit" className={s.btnPrimary}>
              Import
            </button>
          </section>
        </aside>
      </form>
    </>
  );
}
