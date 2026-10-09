# Outreach deliverability plan (2026-10-09)

**Current state (checked with dig on 2026-10-09):** nullshift.co.uk DNS is at GoDaddy
(ns35/ns36.domaincontrol.com). Mail is Microsoft 365 (MX → mail.protection.outlook.com).
SPF already covers Microsoft 365 (secureserver.net include) and Resend. DMARC on the root is
`p=quarantine` (relaxed alignment, reports to GoDaddy). **No `selector1._domainkey` /
`selector2._domainkey` CNAMEs resolve**, so Microsoft 365 DKIM is NOT enabled for
nullshift.co.uk — mail currently passes DMARC on SPF alone. Enabling DKIM for the root domain
(Defender portal → Email authentication settings → DKIM → nullshift.co.uk → create the two
CNAMEs at GoDaddy → Enable) is the first fix; it needs Louis's admin login.

## Recommendation
Keep **louis@nullshift.co.uk** (Outlook) as the sender for partner outreach. Volume is low
(≤15/day, ≤75/week) and the domain is already warm from real correspondence, which is the
single biggest deliverability asset. A separate sending subdomain is still worth having so a
bad week never hurts client email:

**outreach.nullshift.co.uk** as a second Microsoft 365 domain with the mailbox
**louis@outreach.nullshift.co.uk** (an alias on the same licence, "send as" from Outlook).

## Steps that need Louis (admin logins)
1. Microsoft 365 admin → Settings → Domains → Add domain `outreach.nullshift.co.uk` →
   verify with the TXT record it gives you (MS=msXXXXXXXX) at GoDaddy.
2. Add the DNS records M365 lists for the subdomain at GoDaddy (names are relative to
   nullshift.co.uk):
   - MX  `outreach`  → `outreach-nullshift-co-uk.mail.protection.outlook.com` (M365 gives the exact host) priority 0
   - TXT `outreach`  → `v=spf1 include:spf.protection.outlook.com -all`
   - CNAME `selector1._domainkey.outreach` and `selector2._domainkey.outreach` → the two DKIM hosts M365 shows after you enable DKIM for the domain (Defender portal → Email authentication → DKIM)
   - TXT `_dmarc.outreach` → `v=DMARC1; p=quarantine; rua=mailto:louis@nullshift.co.uk; adkim=s; aspf=s`
   - If the root domain has no DMARC yet: TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:louis@nullshift.co.uk` (monitor first, tighten later)
3. M365 admin → Users → Louis → Manage email aliases → add `louis@outreach.nullshift.co.uk`.
   Outlook → New mail → From → choose the alias (enable "send from alias" in Exchange admin if hidden).
4. Warm-up: week 1 send ≤5/day from the alias to real contacts who will reply; week 2 ≤10;
   week 3 full volume. Until then, first batches go from louis@nullshift.co.uk.

## Rules the app and I follow
- Max 15 outreach emails per day, Tue–Thu preferred, recipient's local morning.
- Every email: real name, company address in the signature, plain-text first, one link max,
  no tracking pixels, "reply 'no' and I'll not write again" opt-out line.
- Stop the sequence on any reply; honour opt-outs the same day (status `unsubscribed` in
  /admin/outreach).
- UK PECR: B2B emails to corporate addresses are permitted without prior consent; we still
  only write to named decision-makers with a genuine fit, never to generic lists.
