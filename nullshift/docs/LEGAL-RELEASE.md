# Legal release record

Tracks the state of the Nullshift legal framework against the implementation
spec's release checklist (§20). Update this file whenever a checklist item
changes state — it is the record of what was verified and when.

## Current state

| Field | Value | Set |
|---|---|---|
| Contracting entity | Nullshift Development Ltd | default in `legal/config.ts` |
| Company number | 17284213 | default |
| Jurisdiction | England and Wales | default |
| Registered office | 66 Paul Street, London, England, United Kingdom, EC2A 4NA | default |
| VAT status | **Not VAT registered** | confirmed by owner, 20 Aug 2026 |
| ICO registration | ZC214743 | default — verify against the live register |
| Public policy version | `PUBLIC_2026_08_v1` | |
| Client agreement version | `MSA_2026_08_v1` | |
| Pricing version | `NSI_v1_2026_08` | |
| **Effective date** | **20 August 2026 — IN FORCE** | set by owner, 20 Aug 2026 |

Every value is env-overridable (`NEXT_PUBLIC_*`); the table records the
effective default. `apps/web/scripts/legal-guard.mjs` fails a production build
if the identity fields are missing, and runs before every `next build`.

## ⚠ Solicitor review — outstanding

Both source documents state that solicitor review is required before first use:

> *"SOLICITOR REVIEW REQUIRED BEFORE FIRST USE… Do not deploy the pack until
> every item marked [DEPLOYMENT FIELD] or [OPERATIONAL CONFIRMATION] has been
> completed and verified."* — Client Legal Pack

> *"legal text must be solicitor-reviewed before production acceptance is
> enabled"* — Implementation Specification, status line

The effective date was set to 20 August 2026 on the owner's express
instruction, before that review was completed. This is recorded here so the
decision is visible rather than implicit. Setting the date turned on binding
contract acceptance (`bindingAcceptanceEnabled()`), which gates the client
acceptance flow.

**To take the pack back out of force**: clear the effective date (set
`NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE=""` or remove the default in
`legal/config.ts`). Public pages revert to a "Draft — not yet in force" notice
and binding acceptance is disabled again.

A solicitor should still review, in particular: the MSA liability caps against
actual PI and cyber cover; the IP assignment against contractor and employee
agreements; the payments wording against the real Stripe architecture; the AI
schedule; and the public privacy and cookie policies.

## Release checklist (§20)

| # | Item | State |
|---|---|---|
| 1 | Legal entity verified against Companies House | ⬜ not verified against live record |
| 2 | Company number, registered office, jurisdiction inserted everywhere | ✅ generated from `legal/config.ts` |
| 3 | VAT status verified | ✅ not VAT registered (20 Aug 2026) |
| 4 | Legal / privacy / support emails monitored | ⚠ legal + privacy set; **support and billing unset** |
| 5 | PI and cyber insurance reviewed against MSA liability caps | ⬜ |
| 6 | Contractor / employee IP and confidentiality agreements | ⬜ |
| 7 | Hosting / database backup commitments verified operationally | ⬜ |
| 8 | Actual subprocessor list completed | ⚠ 7 providers listed, **all unverified** (legal name, location, transfer mechanism) |
| 9 | International-transfer mechanisms reviewed | ⬜ blocked on #8 |
| 10 | Cookie inventory created from actual production scripts | ✅ 3 strictly-necessary entries; no analytics/marketing in the build |
| 11 | Consent manager tested before analytics/marketing scripts fire | ✅ no non-necessary scripts exist to gate; manager enforces defaults |
| 12 | Privacy complaint form + 30-day acknowledgement alert tested | ✅ form live; ⚠ alert cron not yet wired |
| 13 | Stripe / Connect architecture reviewed; no Nullshift custody | ⚠ classification enforced in code; **real architecture not yet classified per client** |
| 14 | AI features display AI notice and sensitive-data warning | ✅ components shipped |
| 15 | High-risk / significant automated decisions blocked by default | ✅ `orderFormBlockers()` |
| 16 | Terms versioning, hash and durable-copy flow tested | ✅ hashing tested; durable copy = portal PDFs |
| 17 | Change Order flow prevents unapproved feature work | ✅ classification + Change Order states |
| 18 | Pricing re-band never auto-charges without approval + notice | ✅ notice workflow |
| 19 | Solicitor review of MSA, DPA, caps, IP, payments, AI, public policies | ⬜ **outstanding** |

Legend: ✅ done · ⚠ partial, see note · ⬜ not started (needs a human, not code)
