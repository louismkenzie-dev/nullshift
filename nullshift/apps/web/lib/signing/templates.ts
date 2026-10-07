import type { SignatureKind } from "./model";

/**
 * Starting points for a signable document. A template fills the editor; staff
 * change whatever they need before issuing. Nothing here is binding until it
 * has been issued and signed.
 *
 * The first one is the document this whole system was built to send: the
 * Rising Stars Talent ID proposal follow-up to Suffolk Tennis LTA, kept
 * verbatim from the email Louis wrote, with the names made parameters.
 */

export type SigningTemplateContext = {
  clientName: string;
  contactFirstName: string;
  projectName: string | null;
};

export type SigningTemplate = {
  id: string;
  label: string;
  kind: SignatureKind;
  title: (ctx: SigningTemplateContext) => string;
  source: (ctx: SigningTemplateContext) => string;
  /** `Label | £0.00` per line — the editor's costing field. */
  commercialLines: string;
  commercialNote: string | null;
};

export const SIGNING_TEMPLATES: SigningTemplate[] = [
  {
    id: "rising_stars_talent_id",
    label: "Rising Stars Talent ID — proposal follow-up (Suffolk Tennis)",
    kind: "proposal_addendum",
    title: () => "Rising Stars Talent ID — proposal follow-up",
    source: (ctx) => `# Rising Stars Talent ID — proposal follow-up

Hi ${ctx.contactFirstName},

Thanks for going through it so thoroughly. These are exactly the right questions, and the short answer to all fourteen is yes. You're right that the programme will change as you learn from the first sessions. So everything below is something you set yourself, not something you'd need me to change.

## Your questions at a glance

| # | Your question | Answer | How it works |
| --- | --- | --- | --- |
| 1 | Flexible player numbers | Yes | Each session has its own size: 16, 20, 24 or whatever the courts and coaches allow. |
| 2 | Boys and girls split per session | Yes | Set per session: 8/8, 10/6, mixed, whatever suits that day. |
| 3 | Hold weekly invitations until the window is reviewed | Yes | Nothing is released until the whole Talent ID window is reviewed and you approve it. |
| 4 | Six to eight players per coach | Yes | Allocations aren't fixed. The system checks every child can still be seen by two coaches. |
| 5 | Change the weekly day, time and venue | Yes | You edit these yourself, for example moving from Wednesday to Friday. |
| 6 | Edit or add routes | Yes | Routes are a list you manage. Rename them, add new ones and set what each one sends. |
| 7 | Edit the assessment areas and levels | Yes | You can change the ten areas and four levels. Past assessments keep the framework they were scored on. |
| 8 | Several sessions in one Talent ID window | Yes | Sessions and venues sit inside one window and are calibrated together. |
| 9 | Calibration filters | Yes | Filter by session, venue, year of birth or gender, or view the whole cohort. |
| 10 | Leave decisions pending | Yes | Any player can stay pending until the window closes. |
| 11 | Admin approval before anything is sent | Yes | Nothing goes to parents until you've approved it, and you can change any decision first. |
| 12 | Weekly group capacity and reserve list | Yes | Each weekly group has a maximum. When it's full, players go onto a reserve list. |
| 13 | Move players between routes later | Yes | Players can move between Rising Stars, Development and County with their full history. |
| 14 | Edit and approve all communications | Yes | All wording for parent reports, invitations and follow-ups is editable and approved by you. |

## One Talent ID window

I agree this is the right way round, and I've built the design around it. Every player from every session goes into the same calibration screen. You can review the whole cohort together, leave any decision pending until you've seen everyone, and only then release the reports and invitations.

## Coach allocations

The system checks the numbers for you when you set a session up. For every child to be seen by two coaches, the coaches' allocations need to add up to twice the number of players. For example, 24 players at eight per coach needs six coaches. If the numbers don't work, it tells you before the day rather than during it.

## Timing

I know you need County's sign-off first. The earlier that comes, the more of the October window the system covers on the day itself. If it lands too late for the 25th and 26th, nothing is lost. Those sessions can be scored on paper and entered afterwards, then calibrated with the 1 November session as one window.

## Costing

Your questions add a little to the build, mainly making the assessment framework, routes, communications and weekly group sizes editable by you.

The other points are included at no extra cost. That covers flexible session sizes and splits, coach allocations, the shared Talent ID window, pending decisions, admin approval, calibration filters, editable weekly sessions and moving players between routes. It's a one-off build price, with no change to existing running costs.

> This is an additional build on top of the ${ctx.projectName ?? `${ctx.clientName} system`} already delivered, and is priced and agreed separately from it.

Thanks again, ${ctx.contactFirstName}. Really good to see it coming together.`,
    commercialLines: [
      "Rising Stars Talent ID build, as proposed (stages 1 to 4) | £1,195.00",
      "Flexibility additions: editable assessment areas and levels, editable routes, editable and approved communications, weekly group capacity with reserve lists | £120.00",
      "Max plan discount (25%) | −£328.75",
    ].join("\n"),
    commercialNote:
      "One-off build price on the Max plan. No change to existing running costs. Nullshift is not VAT registered; no VAT is charged.",
  },
  {
    id: "additional_build",
    label: "Additional build — blank",
    kind: "change_order",
    title: (ctx) => `Additional build — ${ctx.clientName}`,
    source: (ctx) => `# Additional build

Hi ${ctx.contactFirstName},

## What we will build

Describe the capability in plain English: what it does, who uses it, and what changes for them.

## What is included

-
-

## What is not included

-

## Done means

-

## Timing

> This is an additional build on top of ${ctx.projectName ?? `the ${ctx.clientName} system`} already delivered, and is priced and agreed separately from it.`,
    commercialLines: "Build | £0.00",
    commercialNote:
      "One-off build price. No change to existing running costs. Nullshift is not VAT registered; no VAT is charged.",
  },
  {
    id: "blank",
    label: "Blank document",
    kind: "other",
    title: (ctx) => `Agreement — ${ctx.clientName}`,
    source: (ctx) => `# Title

Hi ${ctx.contactFirstName},

`,
    commercialLines: "",
    commercialNote: null,
  },
];

export const templateById = (id: string | null | undefined): SigningTemplate | null =>
  SIGNING_TEMPLATES.find((t) => t.id === id) ?? null;

/** "Ollie Sutton" → "Ollie"; empty → "there". */
export const firstNameOf = (name: string | null | undefined): string =>
  (name ?? "").trim().split(/\s+/)[0] || "there";
