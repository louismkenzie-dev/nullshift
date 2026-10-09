import Link from "next/link";
import s from "../../shell.module.css";
import o from "../../ops.module.css";
import { Notice, first } from "../../sales/ops-ui";
import { createProspectFromForm } from "../actions";
import { AgencyTypeOptions, noticeFor } from "../outreach-ui";

export const dynamic = "force-dynamic";

export default async function NewProspectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const notice = noticeFor(first(sp.notice));

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/outreach">Outreach</Link> / New prospect
      </p>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>New prospect</h1>
          <p className={s.lead}>
            An agency we want to talk to about referral or white-label partnership. Only
            the company name is required; verify the contact details before queueing.
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

      <form action={createProspectFromForm} className={o.drawer}>
        <div className={s.card}>
          <div className={o.section}>
            <p className={o.sectionTitle}>Agency</p>
            <Field
              label="Company"
              name="company"
              required
              placeholder="The Sunday Commerce"
            />
            <Field label="Website" name="website" placeholder="sundaycommerce.co" />
            <div className={s.grid12}>
              <div className={s.span6}>
                <Field label="Country" name="country" placeholder="United Kingdom" />
              </div>
              <div className={s.span6}>
                <Field label="Region / city" name="region" placeholder="London" />
              </div>
            </div>
            <div className={s.grid12}>
              <div className={s.span6}>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Agency type</span>
                  <select
                    name="agency_type"
                    className={s.search}
                    style={{ maxWidth: "none" }}
                  >
                    <AgencyTypeOptions />
                  </select>
                </label>
              </div>
              <div className={s.span6}>
                <Field
                  label="Staff band"
                  name="staff_band"
                  placeholder="2–5, 6–10, 11–20"
                />
              </div>
            </div>
          </div>

          <div className={o.section}>
            <p className={o.sectionTitle}>Contact</p>
            <div className={s.grid12}>
              <div className={s.span6}>
                <Field label="Contact name" name="contact_name" />
              </div>
              <div className={s.span6}>
                <Field label="Role" name="contact_role" placeholder="Founder" />
              </div>
            </div>
            <Field label="Email" name="email" type="email" />
            <Field
              label="LinkedIn URL"
              name="linkedin_url"
              placeholder="https://linkedin.com/in/…"
            />
            <div className={s.grid12}>
              <div className={s.span6}>
                <Field
                  label="Instagram handle"
                  name="instagram_handle"
                  placeholder="@studio"
                />
              </div>
              <div className={s.span6}>
                <Field label="Phone" name="phone" />
              </div>
            </div>
          </div>

          <div className={o.section}>
            <p className={o.sectionTitle}>Fit</p>
            <Field
              label="Source (how we found them)"
              name="source"
              placeholder="LinkedIn search"
            />
            <label className={s.field}>
              <span className={s.fieldLabel}>Fit notes</span>
              <textarea
                name="fit_notes"
                rows={4}
                className={s.search}
                style={{ maxWidth: "none", height: "auto", padding: 10 }}
                placeholder="2–20 staff, no in-house dev team, sells to the clients we want…"
              />
            </label>
            <Field
              label="Tags (comma separated)"
              name="tags"
              placeholder="warm, growth, uk"
            />
          </div>
        </div>

        <aside className={o.aside} aria-label="Ownership">
          <section className={s.card}>
            <p className={o.sectionTitle}>Ownership</p>
            <Field label="Owner" name="owner" placeholder="Louis" />
            <label className={s.field}>
              <span className={s.fieldLabel}>Status</span>
              <select name="status" className={s.search} style={{ maxWidth: "none" }}>
                <option value="sourced">Sourced</option>
                <option value="verified">Verified</option>
                <option value="queued">Queued (start sequence)</option>
              </select>
            </label>
            <Field label="Next touch" name="next_touch_at" type="date" />
            <p className={s.queueMeta} style={{ marginTop: 0 }}>
              Queueing without a date makes step 1 (intro email) due the moment it is
              created.
            </p>
            <button type="submit" className={s.btnPrimary}>
              Create prospect
            </button>
          </section>
        </aside>
      </form>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={s.field}>
      <span className={s.fieldLabel}>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        className={s.search}
        style={{ maxWidth: "none" }}
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}
