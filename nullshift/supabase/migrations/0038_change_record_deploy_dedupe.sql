-- 0038: dedupe key for auto-mirrored deployments.
--
-- The Vercel deploy webhook (/api/vercel/deploy-hook) turns every production
-- deployment in the team — the Ops platform and the client systems alike —
-- into a soc2_change_records row, keyed by the Vercel deployment id in
-- deploy_ref. Webhooks retry; this partial unique index is what makes the
-- mirror idempotent (the same idempotency shape as control-run fire keys).
create unique index if not exists soc2_change_records_deploy_ref_idx
  on public.soc2_change_records (deploy_ref)
  where deploy_ref is not null;
