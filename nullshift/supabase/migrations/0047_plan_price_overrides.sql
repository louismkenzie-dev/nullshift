-- 0047: per-plan price overrides on an assessment. The score sets the bracket
-- and the three prices follow from it; the owner may then set any of Core /
-- Pro / Max by hand, each with a reason the client sees on their chooser.
--   { "core": {"mrr": 90, "reason": "…"}, "pro": {...}, "max": {...} }
alter table public.scale_assessments
  add column if not exists plan_prices jsonb not null default '{}'::jsonb;
