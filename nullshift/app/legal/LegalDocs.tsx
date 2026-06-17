"use client";

import React from "react";
import { T } from "@/lib/tokens";
import { LEGAL_ENTITY } from "@/lib/legalEntity";
import { DpaTemplate } from "@/components/legal/DpaTemplate";

/* ============================================================
   Nullshift — Legal documents
   Source: solicitor-drafted documents supplied 2026-06-16
   (Privacy Policy, Cookie Policy, Website Terms of Use, DPA).

   Company identity comes from lib/legalEntity.ts (single source —
   shared with every client DPA). Facts only Nullshift can confirm
   (company number, registered office, ICO number) render as amber
   <Fill> chips until supplied there. Never fabricated.

   KEEP IN SYNC WITH THE SITE: if our data practices change — new
   cookies/analytics, new sub-processors, new data we collect —
   update the Cookie Policy tables, the Privacy Policy sections, and
   lib/legalEntity.ts (sub-processors). DPA text lives in
   components/legal/DpaTemplate.tsx.
   ============================================================ */

export const COMPANY = LEGAL_ENTITY.name;
export const DOMAIN = LEGAL_ENTITY.domain;
export const EMAIL = LEGAL_ENTITY.email;
export const LAST_UPDATED = "16 June 2026";

export const LEGAL_DOCS = [
  { key: "privacy", label: "Privacy Policy" },
  { key: "cookies", label: "Cookie Policy" },
  { key: "terms", label: "Terms of Use" },
  { key: "dpa", label: "Data Processing" },
] as const;

export type DocKey = (typeof LEGAL_DOCS)[number]["key"];

/* ── Primitives ─────────────────────────────────────────────── */
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 mb-5 first:mt-0" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.25rem", letterSpacing: "-0.015em", lineHeight: 1.3, color: T.fg }}>
      {children}
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-7 mb-3" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1rem", letterSpacing: "-0.01em", lineHeight: 1.3, color: T.fg }}>
      {children}
    </h3>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4" style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.8, letterSpacing: "-0.003em", color: T.muted }}>
      {children}
    </p>
  );
}
function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2" style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.75, letterSpacing: "-0.004em", color: `${T.fg}cc` }}>
      {children}
    </p>
  );
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
          <tr>
            {head.map((h, i) => (
              <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted, background: T.surface, borderBottom: `1px solid ${T.border}`, borderRight: i < head.length - 1 ? `1px solid ${T.border}` : "none", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} style={{ padding: "12px 16px", verticalAlign: "top", fontSize: "0.875rem", lineHeight: 1.6, color: T.muted, borderBottom: ri < rows.length - 1 ? `1px solid ${T.border}` : "none", borderRight: ci < r.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
/** A fact only Nullshift can supply — render value, or a clearly pending chip. */
function entity(value: string | null, label: string) {
  return value ? <>{value}</> : (
    <span title="To be confirmed by Nullshift before publishing" style={{ display: "inline-block", fontFamily: T.mono, fontSize: "0.78em", fontWeight: 500, letterSpacing: "0.02em", color: T.warning, background: T.warningSoft, border: `1px solid ${T.warning}55`, borderRadius: 5, padding: "0 7px", lineHeight: 1.6, whiteSpace: "nowrap" }}>{label}</span>
  );
}
function Mail() {
  return <a href={`mailto:${EMAIL}`} style={{ color: T.primary, textDecoration: "none" }}>{EMAIL}</a>;
}
function Meta() {
  return (
    <p className="mb-8" style={{ fontFamily: T.mono, fontSize: "0.6875rem", letterSpacing: "0.08em", textTransform: "uppercase", color: `${T.muted}aa` }}>
      Last updated: {LAST_UPDATED}
    </p>
  );
}

/* ── Privacy Policy ─────────────────────────────────────────── */
export function PrivacyDoc() {
  return (
    <div>
      <Meta />
      <Lead>
        This Privacy Policy explains how {COMPANY} (&quot;Nullshift&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses, and protects personal data when you visit {DOMAIN}, contact us, or use our services. We are the data controller for the personal data described in this policy.
      </Lead>
      <P>
        We are committed to protecting your personal data and handling it in line with the UK GDPR, the Data Protection Act 2018 (as amended by the Data (Use and Access) Act 2025), and related UK data protection law.
      </P>

      <H2>1. Who we are</H2>
      <P>
        {COMPANY} is a web and software development business registered in the United Kingdom (company number {entity(LEGAL_ENTITY.companyNumber, "company number — to confirm")}), registered office {entity(LEGAL_ENTITY.registeredOffice, "registered office — to confirm")}.
      </P>
      <P>
        We are registered with the Information Commissioner&apos;s Office (ICO) under registration number {entity(LEGAL_ENTITY.ico, "ICO registration number — to confirm")}.
      </P>
      <P>If you have any questions about this policy or your personal data, contact us at <Mail />.</P>

      <H2>2. The personal data we collect</H2>
      <P>Depending on how you interact with us, we may collect:</P>
      <UL items={[
        <><strong style={{ color: T.fg }}>Contact and enquiry data</strong> — your name, email address, phone number, company name, and the content of messages you send us through our contact form or by email.</>,
        <><strong style={{ color: T.fg }}>Client and project data</strong> — information needed to deliver our services, including billing details, project requirements, and account information.</>,
        <><strong style={{ color: T.fg }}>Technical data</strong> — IP address, browser type, device information, and pages visited, collected through cookies and similar technologies (see our Cookie Policy).</>,
        <><strong style={{ color: T.fg }}>Communications</strong> — records of our correspondence with you.</>,
      ]} />
      <P>We do not intentionally collect special category data (such as health or biometric data) about visitors to this website.</P>

      <H2>3. How we use your personal data, and our lawful basis</H2>
      <Table
        head={["Purpose", "Lawful basis (UK GDPR Article 6)"]}
        rows={[
          ["Responding to your enquiries and providing quotes", "Legitimate interests; steps prior to entering a contract"],
          ["Delivering our services to clients", "Performance of a contract"],
          ["Sending invoices and managing payments", "Performance of a contract; legal obligation"],
          ["Maintaining business and accounting records", "Legal obligation"],
          ["Improving and securing our website", "Legitimate interests"],
          ["Sending marketing emails (where you have opted in)", "Consent"],
        ]}
      />
      <P>Where we rely on legitimate interests, our interest is in operating, promoting, and securing our business, and we balance this against your rights and freedoms.</P>

      <H2>4. Cookies</H2>
      <P>Our website uses cookies and similar technologies. Non-essential cookies (such as analytics) are only set with your consent. For full details, see our Cookie Policy.</P>

      <H2>5. Who we share your data with</H2>
      <P>We may share your personal data with:</P>
      <UL items={[
        "Service providers who help us run our business (for example, hosting, email, analytics, and payment providers), who act as our processors and only process data on our instructions.",
        "Professional advisers such as accountants and lawyers, where necessary.",
        "Authorities or third parties where we are required to by law.",
      ]} />
      <P>We do not sell your personal data.</P>

      <H2>6. International transfers</H2>
      <P>Some of our service providers may process data outside the United Kingdom. Where this happens, we ensure an appropriate safeguard is in place — such as the ICO&apos;s International Data Transfer Agreement or Addendum, or transfers to a country with UK adequacy status. Where practicable, we choose UK or European hosting regions.</P>

      <H2>7. How long we keep your data</H2>
      <P>We keep personal data only as long as necessary for the purposes set out above:</P>
      <UL items={[
        "Enquiries that do not become clients: up to 24 months.",
        "Client and financial records: at least 6 years, to meet UK tax and accounting requirements.",
        "Marketing consents: until you withdraw consent.",
      ]} />

      <H2>8. Your rights</H2>
      <P>Under UK data protection law you have the right to:</P>
      <UL items={[
        "be informed about how we use your data;",
        "access the personal data we hold about you;",
        "have inaccurate data corrected;",
        "have your data erased in certain circumstances;",
        "restrict or object to our processing;",
        "data portability;",
        "withdraw consent at any time, where we rely on consent.",
      ]} />
      <P>To exercise any of these rights, contact us at <Mail />. We will respond within one month.</P>

      <H2>9. Complaints</H2>
      <P>If you are unhappy with how we have handled your personal data, please contact us first at <Mail /> so we can try to put things right. You have the right to make a formal complaint to us, and we will acknowledge and respond to it in line with our complaints procedure.</P>
      <P>You also have the right to complain to the Information Commissioner&apos;s Office (ICO):</P>
      <UL items={[
        <>Website: <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: T.primary, textDecoration: "none" }}>ico.org.uk</a></>,
        "Helpline: 0303 123 1113",
      ]} />

      <H2>10. Changes to this policy</H2>
      <P>We may update this policy from time to time. The &quot;last updated&quot; date at the top shows when it was last changed.</P>
    </div>
  );
}

/* ── Cookie Policy ──────────────────────────────────────────── */
export function CookiesDoc() {
  return (
    <div>
      <Meta />
      <Lead>
        This Cookie Policy explains how {COMPANY} (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) uses cookies and similar technologies on {DOMAIN}. It should be read alongside our Privacy Policy.
      </Lead>

      <H2>1. What cookies are</H2>
      <P>Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work, to improve them, and to provide information to site owners. Similar technologies (such as pixels and local storage) work in comparable ways and are covered by this policy.</P>

      <H2>2. Your consent</H2>
      <P>Under the Privacy and Electronic Communications Regulations (PECR) and the UK GDPR, non-essential cookies (such as analytics and marketing cookies) may only be set after you have given consent. Strictly necessary cookies do not require consent because the site cannot function properly without them.</P>
      <P>At present we use <strong style={{ color: T.fg }}>only strictly necessary cookies</strong>. We do not use analytics, advertising, or third-party tracking cookies, so no consent is currently required. If we introduce any non-essential cookies in future, we will ask for your consent through a cookie banner before setting them, and you will be able to withdraw it at any time.</P>

      <H2>3. The cookies we use</H2>
      <H3>Strictly necessary cookies</H3>
      <P>These are essential for the website to function and cannot be switched off. They do not store information used for advertising or tracking.</P>
      <Table
        head={["Cookie", "Purpose", "Duration"]}
        rows={[
          [<code key="c" style={{ fontFamily: T.mono, fontSize: "0.82em", color: T.fg }}>sb-&lt;project&gt;-auth-token</code>, "Set by our authentication provider (Supabase) only when you sign in to the client portal. Keeps you securely logged in across pages.", "Session — up to 1 year, refreshed on use"],
          [<code key="p" style={{ fontFamily: T.mono, fontSize: "0.82em", color: T.fg }}>sb-&lt;project&gt;-auth-token-code-verifier</code>, "A short-lived security token used during the sign-in flow to protect your login.", "A few minutes (sign-in only)"],
        ]}
      />

      <H3>Analytics cookies</H3>
      <P>We do not currently set any analytics cookies. We do not use Google Analytics or any third-party analytics that track you across sites.</P>

      <H3>Marketing cookies</H3>
      <P>We do not currently set any marketing or advertising cookies, and we do not use retargeting or advertising pixels.</P>

      <H3>Local storage (first-party, not tracking)</H3>
      <P>Our site uses your browser&apos;s local and session storage for a few essential, first-party functions — never for advertising or cross-site tracking. These include: remembering that you have already seen our intro animation, storing your light/dark display preference, and temporarily saving your progress through our enquiry forms so you don&apos;t lose your answers. This information stays in your browser.</P>

      <H2>4. Managing cookies in your browser</H2>
      <P>Most browsers let you refuse or delete cookies through their settings. Note that blocking strictly necessary cookies may affect how the site works — for example, you may not be able to stay signed in to the client portal. Guidance for common browsers is available at <a href="https://www.aboutcookies.org" target="_blank" rel="noopener noreferrer" style={{ color: T.primary, textDecoration: "none" }}>aboutcookies.org</a>.</P>

      <H2>5. Changes to this policy</H2>
      <P>We may update this policy when our use of cookies changes. The &quot;last updated&quot; date shows when it was last revised.</P>
      <P>If you have questions about our use of cookies, contact us at <Mail />.</P>
    </div>
  );
}

/* ── Website Terms of Use ───────────────────────────────────── */
export function TermsDoc() {
  return (
    <div>
      <Meta />
      <Lead>
        These terms govern your use of the website at {DOMAIN} (the &quot;Site&quot;), operated by {COMPANY} (&quot;Nullshift&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By using the Site, you agree to these terms. If you do not agree, please do not use the Site.
      </Lead>
      <P>These Website Terms of Use cover use of the Site itself. They are separate from any contract under which we provide development, hosting, or other services to clients (which is governed by a separate services agreement).</P>

      <H2>1. About us</H2>
      <P>{COMPANY} is a web and software development business registered in the United Kingdom, company number {entity(LEGAL_ENTITY.companyNumber, "company number — to confirm")}, registered office {entity(LEGAL_ENTITY.registeredOffice, "registered office — to confirm")}. You can contact us at <Mail />.</P>

      <H2>2. Using the Site</H2>
      <P>2.1 You may use the Site for lawful purposes only. You must not:</P>
      <UL items={[
        "use the Site in any way that breaches applicable law or regulation;",
        "attempt to gain unauthorised access to the Site, its server, or any connected systems;",
        "introduce malicious code, or attempt to disrupt or overload the Site;",
        "copy, reproduce, or republish material from the Site except as permitted below.",
      ]} />
      <P>2.2 We may suspend, withdraw, or restrict the availability of all or part of the Site for business and operational reasons without notice.</P>

      <H2>3. Intellectual property</H2>
      <P>3.1 Unless otherwise stated, we own or license all intellectual property rights in the Site and its content (including text, design, graphics, and logos).</P>
      <P>3.2 You may view and print pages from the Site for your own personal or internal business use. You may not use any content for commercial purposes without our written permission.</P>

      <H2>4. No reliance on information</H2>
      <P>4.1 The content on the Site is provided for general information only. It is not advice (including legal, financial, or technical advice) and you should not rely on it for any particular purpose.</P>
      <P>4.2 While we make reasonable efforts to keep the content up to date, we make no representations or warranties that the content is accurate, complete, or current.</P>

      <H2>5. Links to other sites</H2>
      <P>The Site may contain links to third-party websites. We have no control over, and accept no responsibility for, the content of those sites.</P>

      <H2>6. Our liability</H2>
      <P>6.1 Nothing in these terms excludes or limits our liability where it would be unlawful to do so, including liability for death or personal injury caused by negligence, or for fraud.</P>
      <P>6.2 To the extent permitted by law, we exclude all implied warranties and will not be liable for any loss or damage arising from your use of, or inability to use, the Site, or from reliance on its content.</P>

      <H2>7. Privacy and cookies</H2>
      <P>Your use of the Site is also governed by our Privacy Policy and Cookie Policy.</P>

      <H2>8. Changes to these terms</H2>
      <P>We may revise these terms at any time by updating this page. Please check this page from time to time. Your continued use of the Site means you accept any revised terms.</P>

      <H2>9. Governing law</H2>
      <P>These terms are governed by the laws of England and Wales, and any disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.</P>
    </div>
  );
}

/* ── Data Processing Agreement (public template) ────────────── */
export function DpaDoc() {
  return (
    <div>
      <Meta />
      <div className="mb-6 flex items-start gap-3 px-4 py-3.5" style={{ border: `1px solid ${T.border}`, background: T.surface, borderRadius: T.r.md }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, flexShrink: 0, marginTop: 6 }} />
        <p style={{ fontFamily: T.sans, fontSize: "0.8125rem", lineHeight: 1.65, color: T.muted }}>
          This is the template Data Processing Agreement we enter into with business clients. When you accept a proposal, a copy is pre-populated for your engagement and signed as part of that proposal — the bracketed fields below are completed automatically at that point.
        </p>
      </div>
      <DpaTemplate mode="template" />
    </div>
  );
}
