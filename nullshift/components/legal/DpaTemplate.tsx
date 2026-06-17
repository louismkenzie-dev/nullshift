"use client";

import React from "react";
import { T } from "@/lib/tokens";
import { LEGAL_ENTITY, SUB_PROCESSORS } from "@/lib/legalEntity";

/* ============================================================
   Shared Data Processing Agreement renderer.

   Used in two modes:
   - "template"  → the public /legal DPA tab. Per-engagement fields
                   show as amber <Fill> chips.
   - "proposal"  → a specific client's DPA at /proposal/<id>/dpa,
                   pre-populated from the proposal. The client signs
                   the proposal once; that signature accepts this too.

   Variable fields (client identity, effective date, Annex 1 data,
   special category) are props. Nullshift's identity and the five
   authorised sub-processors come from lib/legalEntity.ts.
   ============================================================ */

export type DpaParty = {
  name?: string | null;
  country?: string | null;
  companyNumber?: string | null;
  registeredAddress?: string | null;
};

export type DpaTemplateProps = {
  client?: DpaParty;
  /** Pre-formatted effective date; null in proposal mode → "on acceptance". */
  effectiveDate?: string | null;
  /** Annex 1 — types of personal data (free text). */
  personalDataTypes?: string | null;
  specialCategory?: { present: boolean; detail?: string | null };
  /** Annex 1 — categories of data subjects (free text; sensible default if omitted). */
  dataSubjects?: string | null;
  /** Set once the proposal is signed. */
  accepted?: { name: string; at: string } | null;
  mode?: "template" | "proposal";
};

/* ── Primitives ─────────────────────────────────────────────── */
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 mb-5 first:mt-0" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.25rem", letterSpacing: "-0.015em", lineHeight: 1.3, color: T.fg }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4" style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.8, letterSpacing: "-0.003em", color: T.muted }}>{children}</p>;
}
function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: T.fg }}>{children}</strong>;
}
function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-4 flex flex-col gap-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3" style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.7, letterSpacing: "-0.003em", color: T.muted }}>
          <span style={{ color: T.primary, flexShrink: 0, marginTop: 1 }}>—</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-x-auto" style={{ border: `1px solid ${T.border}`, borderRadius: T.r.lg }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.sans }}>
        <thead>
          <tr>{head.map((h, i) => (
            <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted, background: T.surface, borderBottom: `1px solid ${T.border}`, borderRight: i < head.length - 1 ? `1px solid ${T.border}` : "none", whiteSpace: "nowrap" }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((c, ci) => (
              <td key={ci} style={{ padding: "12px 16px", verticalAlign: "top", fontSize: "0.875rem", lineHeight: 1.6, color: T.muted, borderBottom: ri < rows.length - 1 ? `1px solid ${T.border}` : "none", borderRight: ci < r.length - 1 ? `1px solid ${T.border}` : "none" }}>{c}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Fill({ children }: { children: React.ReactNode }) {
  return (
    <span title="To be confirmed before signing" style={{ display: "inline-block", fontFamily: T.mono, fontSize: "0.78em", fontWeight: 500, letterSpacing: "0.02em", color: T.warning, background: T.warningSoft, border: `1px solid ${T.warning}55`, borderRadius: 5, padding: "0 7px", lineHeight: 1.6, whiteSpace: "nowrap" }}>{children}</span>
  );
}

/** Render a value, or an amber pending chip when it is missing. */
function val(value: string | null | undefined, label: string) {
  const v = (value ?? "").trim();
  return v ? <>{v}</> : <Fill>{label}</Fill>;
}

export function DpaTemplate({
  client = {},
  effectiveDate,
  personalDataTypes,
  specialCategory,
  dataSubjects,
  accepted = null,
  mode = "template",
}: DpaTemplateProps) {
  const N = LEGAL_ENTITY;
  const company = N.name;

  const effective =
    effectiveDate
      ? <>{effectiveDate}</>
      : mode === "proposal"
        ? <>On your acceptance of this proposal</>
        : <Fill>effective date — per engagement</Fill>;

  const dataSubjectsText =
    (dataSubjects ?? "").trim() ||
    "The Client's customers, website visitors, account holders, booking customers, and newsletter subscribers.";

  const specialCategoryCell = specialCategory?.present
    ? val(specialCategory.detail, "special category data & category — to add")
    : <>None.{mode === "template" ? <> <Fill>specify per engagement if applicable</Fill></> : null}</>;

  return (
    <div>
      <P><B>Between:</B></P>
      <P>
        (1) {val(client.name, "Client name")}, a company registered in {val(client.country, "country")} (company number {val(client.companyNumber, "client company number")}) whose registered office is at {val(client.registeredAddress, "client registered address")} (the &quot;Controller&quot; or &quot;Client&quot;); and
      </P>
      <P>
        (2) {company}, a business registered in the United Kingdom (company number {val(N.companyNumber, "company number — to confirm")}) whose registered office is at {val(N.registeredOffice, "registered office — to confirm")} (&quot;Nullshift&quot;, the &quot;Processor&quot;).
      </P>
      <P>each a &quot;party&quot; and together the &quot;parties&quot;.</P>
      <P>Effective date: {effective}</P>

      <H2>1. Background and purpose</H2>
      <P>1.1 This Data Processing Agreement (&quot;DPA&quot;) governs the Processing of Personal Data by Nullshift on behalf of the Client in connection with the website development, hosting, maintenance and related services that Nullshift provides to the Client (the &quot;Services&quot;), as set out in the parties&apos; main services agreement or statement of work (the &quot;Principal Agreement&quot;).</P>
      <P>1.2 This DPA forms part of, and is subject to, the Principal Agreement. Where there is any conflict between this DPA and the Principal Agreement on the subject of data protection, this DPA prevails.</P>
      <P>1.3 The parties agree that, in respect of the Personal Data processed under the Services, the Client is the Controller and Nullshift is the Processor.</P>

      <H2>2. Definitions</H2>
      <P>2.1 In this DPA:</P>
      <UL items={[
        <>&quot;Data Protection Law&quot; means all laws applicable to the Processing of Personal Data under this DPA, including the UK GDPR, the Data Protection Act 2018, the Data (Use and Access) Act 2025, and the Privacy and Electronic Communications Regulations 2003 (PECR), each as amended or replaced from time to time.</>,
        <>&quot;UK GDPR&quot; means Regulation (EU) 2016/679 as it forms part of the law of England and Wales, Scotland and Northern Ireland by virtue of the European Union (Withdrawal) Act 2018, as amended.</>,
        <>&quot;Controller&quot;, &quot;Processor&quot;, &quot;Data Subject&quot;, &quot;Personal Data&quot;, &quot;Personal Data Breach&quot;, &quot;Processing&quot;, &quot;Special Category Data&quot; and &quot;Sub-processor&quot; have the meanings given in Data Protection Law.</>,
        <>&quot;Restricted Transfer&quot; means a transfer of Personal Data to a country or territory outside the United Kingdom that is subject to restrictions under Data Protection Law.</>,
        <>&quot;UK Transfer Mechanism&quot; means the International Data Transfer Agreement (IDTA) or the International Data Transfer Addendum to the EU Standard Contractual Clauses, as issued by the Information Commissioner, or any successor mechanism.</>,
      ]} />

      <H2>3. Scope and details of Processing</H2>
      <P>3.1 The subject matter, duration, nature and purpose of the Processing, the types of Personal Data, and the categories of Data Subjects are set out in Annex 1.</P>
      <P>3.2 Nullshift will Process the Personal Data only for the purposes of providing the Services and as described in Annex 1, and not for any of its own purposes.</P>

      <H2>4. Nullshift&apos;s obligations</H2>
      <P>Nullshift will:</P>
      <P>4.1 <B>Process only on instructions.</B> Process the Personal Data only on the Client&apos;s documented instructions, including the instructions set out in this DPA and the Principal Agreement, unless required to do otherwise by law (in which case Nullshift will, where legally permitted, inform the Client before Processing).</P>
      <P>4.2 <B>Flag unlawful instructions.</B> Immediately inform the Client if, in Nullshift&apos;s opinion, an instruction infringes Data Protection Law.</P>
      <P>4.3 <B>Confidentiality.</B> Ensure that persons authorised to Process the Personal Data are bound by appropriate obligations of confidentiality.</P>
      <P>4.4 <B>Security.</B> Implement and maintain the technical and organisational measures set out in Annex 2 to ensure a level of security appropriate to the risk, in accordance with Article 32 UK GDPR.</P>
      <P>4.5 <B>Assist with Data Subject rights.</B> Taking into account the nature of the Processing, assist the Client by appropriate technical and organisational measures, insofar as possible, to respond to requests by Data Subjects exercising their rights under Data Protection Law (including access, rectification, erasure, restriction, portability and objection).</P>
      <P>4.6 <B>Assist with compliance.</B> Assist the Client in ensuring compliance with its obligations relating to security, Personal Data Breach notification, data protection impact assessments and prior consultation with the Information Commissioner, taking into account the nature of Processing and the information available to Nullshift.</P>
      <P>4.7 <B>Breach notification.</B> Notify the Client without undue delay, and in any event within 72 hours, after becoming aware of a Personal Data Breach affecting the Personal Data, and provide the Client with sufficient information to allow it to meet any obligations to report the breach to the Information Commissioner or affected Data Subjects.</P>
      <P>4.8 <B>Records and demonstration of compliance.</B> Make available to the Client all information reasonably necessary to demonstrate compliance with this DPA, and maintain written records of its Processing activities as required by Data Protection Law.</P>
      <P>4.9 <B>Audits.</B> Allow for and contribute to audits, including inspections, conducted by the Client or another auditor mandated by the Client, on reasonable prior written notice (and no more than once per year except where required by a regulator or following a Personal Data Breach), subject to reasonable confidentiality and security conditions.</P>

      <H2>5. Sub-processors</H2>
      <P>5.1 The Client provides general authorisation for Nullshift to engage the Sub-processors listed in Annex 3 to Process the Personal Data.</P>
      <P>5.2 Nullshift will impose on each Sub-processor, by written contract, data protection obligations substantially equivalent to those set out in this DPA, and remains fully liable to the Client for the performance of each Sub-processor&apos;s obligations.</P>
      <P>5.3 Nullshift will inform the Client of any intended addition or replacement of a Sub-processor at least 14 days in advance, giving the Client the opportunity to object on reasonable data protection grounds. If the Client objects and the parties cannot agree a resolution, either party may terminate the affected Services.</P>

      <H2>6. International transfers</H2>
      <P>6.1 Nullshift will not carry out a Restricted Transfer of the Personal Data without the Client&apos;s prior authorisation, except as already described in Annex 1 or Annex 3.</P>
      <P>6.2 Where the Services involve a Restricted Transfer, Nullshift will ensure an appropriate safeguard is in place, such as a UK Transfer Mechanism, and will configure hosting so that Personal Data is stored in a UK or European region where reasonably practicable.</P>

      <H2>7. Deletion and return of data</H2>
      <P>7.1 On termination or expiry of the Services, and at the Client&apos;s choice, Nullshift will delete or return all the Personal Data to the Client and delete existing copies, unless Data Protection Law requires continued storage.</P>
      <P>7.2 Nullshift will, on request, certify in writing that it has complied with this clause.</P>

      <H2>8. Liability</H2>
      <P>8.1 Each party&apos;s liability arising out of or related to this DPA is subject to the limitations and exclusions of liability set out in the Principal Agreement.</P>

      <H2>9. General</H2>
      <P>9.1 <B>Duration.</B> This DPA takes effect on the Effective Date and continues for as long as Nullshift Processes Personal Data on behalf of the Client.</P>
      <P>9.2 <B>Governing law.</B> This DPA is governed by the laws of England and Wales, and the parties submit to the exclusive jurisdiction of the courts of England and Wales.</P>
      <P>9.3 <B>Order of precedence.</B> Except as stated in clause 1.2, the Principal Agreement continues in full force.</P>

      <H2>Annex 1 — Details of the Processing</H2>
      <Table
        head={["Item", "Detail"]}
        rows={[
          ["Subject matter", `Provision of website development, hosting, and maintenance Services by ${company} to the Client.`],
          ["Duration", "For the term of the Principal Agreement and until deletion/return of the Personal Data under clause 7."],
          ["Nature and purpose", "Hosting and operating the Client's website/application and database; storing, retrieving, backing up, and securing data; technical maintenance and support."],
          ["Types of Personal Data", (personalDataTypes ?? "").trim()
            ? <>{personalDataTypes}</>
            : mode === "proposal"
              ? <Fill>types of personal data — to add</Fill>
              : <>Typically names, email addresses, postal addresses, telephone numbers, account credentials, booking/order details, payment-related identifiers (not full card data), IP addresses, and any other data the Client&apos;s site collects. <Fill>confirm actual fields per engagement</Fill></>],
          ["Special Category Data", specialCategoryCell],
          ["Categories of Data Subjects", dataSubjectsText],
          ["Frequency", "Continuous, for the duration of the Services."],
        ]}
      />

      <H2>Annex 2 — Technical and organisational security measures</H2>
      <P>Nullshift maintains measures including:</P>
      <UL items={[
        "Encryption of Personal Data in transit (TLS) and at rest, as provided by the hosting platform.",
        "Row-Level Security and least-privilege access controls on the database, separating each Client's data into its own dedicated project/organisation.",
        "Access to production systems restricted to authorised personnel using strong authentication (including multi-factor authentication where available).",
        "Regular automated backups and a documented restore process.",
        "Logging and monitoring of access to systems holding Personal Data.",
        "Secure software development practices and prompt application of security updates.",
        "A documented Personal Data Breach response process.",
        "Secure deletion of Personal Data on termination.",
      ]} />

      <H2>Annex 3 — Authorised Sub-processors</H2>
      <Table
        head={["Sub-processor", "Service provided", "Location of Processing"]}
        rows={SUB_PROCESSORS.map((s) => [s.name, s.service, s.location])}
      />
      <P>This list reflects the tools currently used and is updated to match the actual tools used for each Client.</P>
    </div>
  );
}
