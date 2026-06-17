import { T } from "@nullshift/ui/tokens";
import {
  PAGE_OPTIONS, DESIGN_STYLES, PURPOSES, TIMELINES, LOGO_STATES,
  BUDGET_MIN, formatBudget, labelFor, type BriefData,
} from "@/lib/brief";

/** Read-only display of a submitted client brief. Used by the admin Enquiries
 *  inbox and the per-client dashboard. */
export function BriefViewer({ brief, dense = false }: { brief: BriefData; dense?: boolean }) {
  const pad = dense ? "10px 0" : "12px 0";
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex gap-4" style={{ padding: pad, borderBottom: `1px solid ${T.border}66`, fontSize: "0.85rem" }}>
      <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted, width: "120px", flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: T.sans, color: T.fg, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{value}</span>
    </div>
  );

  return (
    <div className="rounded-md p-5" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
      <div className="mb-3" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: T.primary }}>// CLIENT BRIEF</div>
      <Row label="Name" value={brief.clientName} />
      <Row label="Email" value={brief.clientEmail} />
      {brief.companyName && <Row label="Company" value={brief.companyName} />}
      <Row label="Pages" value={brief.pages.map(p => labelFor(PAGE_OPTIONS, p)).join(", ") || "—"} />
      {brief.customPage && <Row label="Other pages" value={brief.customPage} />}
      <Row label="Style" value={labelFor(DESIGN_STYLES, brief.designStyle)} />
      <Row label="Has logo" value={labelFor(LOGO_STATES, brief.hasLogo)} />
      {brief.logoNotes && <Row label="Logo notes" value={brief.logoNotes} />}
      <Row label="Purpose" value={labelFor(PURPOSES, brief.websitePurpose)} />
      {brief.purposeDetail && <Row label="Goal detail" value={brief.purposeDetail} />}
      <Row label="Budget" value={brief.budget >= BUDGET_MIN ? formatBudget(brief.budget) : "—"} />
      <Row label="Timeline" value={labelFor(TIMELINES, brief.timeline)} />
      {brief.additionalNotes && <Row label="Notes" value={brief.additionalNotes} />}
    </div>
  );
}
