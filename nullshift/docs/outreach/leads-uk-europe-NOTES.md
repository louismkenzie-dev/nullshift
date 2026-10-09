# Partner leads: UK + Europe (2026-10-09) — method and caveats

File: `docs/outreach/leads-uk-europe-2026-10-09.csv` (50 rows, exact header per brief).

## Method
1. Target profile from `docs/partners/PROGRAMME-BRIEF-2026-10-09.md`: growth consultants / fractional CMOs first, then marketing/SEO/PPC, design and brand studios, social media managers, accountants with an advisory arm. 2–20 staff, no in-house dev team, English-speaking.
2. Discovery: WebSearch (standard + extended) by category/city, then directory pages that could be fetched (Semrush Agency Partners small-business lists for UK/IE/NL/DE/ES/PT/SE/DK/NO/FI, Sortlist city pages where not blocked, NoGood Dublin list).
3. Verification: every row's own website was fetched (home + about/team/contact/imprint where they exist). Names, roles, emails, LinkedIn/Instagram and location come from those pages unless `source` says otherwise. Nothing was inferred that is not on the page; blank = not found.
4. Dev-team filter: agencies whose sites show in-house developers / "web development" as a core service were dropped (e.g. Growthlabs Bristol, Chillibyte, Quibble, Terrier Agency, MEEDEA, Whello, Concept Communication Oslo, Zeroten Helsinki, Dot IT). Squarespace/Wix/WordPress-template studios were kept. Where a site lists "websites" but names no developers, this is flagged in `fit_notes`.
5. `email_confidence`: `exact` = address printed on the site (or decoded from an obfuscated mailto). `unknown` = site uses a contact form only. No `pattern` guesses were made — none of the "unknown" sites expose a second address to derive a pattern from.
6. `staff_band` is an estimate from team pages / Semrush "1-9" style bands / "solo" wording; treat as indicative.

## Counts
- 50 rows: UK 30 (incl. The Sunday Commerce), Ireland 6, Germany 5, Netherlands 3, Spain 3, Sweden 2, Portugal 1.
- Exact emails: 39. Unknown: 11 (contact form only).
- By type: growth_consultant 20, seo_ppc 7, design_studio 7, marketing_agency 6, social_media 6, accountant 4.

## Caveats
- **The Sunday Commerce (row 1)**: no website, LinkedIn, Instagram, Companies House or mailbox trace found under that name (Gmail + Outlook searched). `sundaycommerce.com` / `thesundaycommerce.com` / `.co.uk` do not resolve. Louis must fill owner name, email, handles. Row left blank rather than guessed.
- **Web-search quota**: the shared 200-searches-per-turn budget ran out mid-task; the second half relied on direct site fetches and fetchable directories. Nordics, Spain and Portugal are thinner than the ~20-row Europe target because many Sortlist pages returned 403 and several Nordic agencies are local-language only (Danish/Norwegian/Finnish sites were excluded for the English-comms rule).
- **Size uncertain / lower priority**: James Todd & Co ("large and growing team"), R&Co Communications, Mytton Williams, Maktagg, Lunar Agency (has a sister build company), The SME Partners (lists website development but outsources its own site), Like Honey (lists "website construction").
- **No contact name on site**: Little Media Agency, Bag of Bees, Mytton Williams, James Todd & Co, RCOMMS, The SME Partners, Lunar, Like Honey, Reux Digital, Maktagg. First-name only: Studio 5 (Nicole), Front Page Advantage (Chris), The Lisbon Media (Harry).
- **Personal LinkedIn URLs** are given only where the site links them; otherwise the company page is used. Instagram handles are given without the `@`.
- Growth by Gardner's published address is a Gmail address (as shown on his site).
- Eureka Creates' site warns of phishing emails impersonating them — expect them to verify any inbound sender.

## Suggested next pass (needs a fresh search budget)
- Fill ~5 more Nordic/Iberian rows (Future Wave Digital Stockholm, Crater Madrid, La Saleta Barcelona, HAKI Barcelona, Lacomonline/Voilà Maison Lisbon were surfaced but not verified).
- Find founder names for the "no contact name" rows via LinkedIn/Companies House/CRO.
- Confirm headcounts for the four size-uncertain UK rows.
