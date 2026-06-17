-- ============================================================
--  012 — Quiz funnel leads (/start)
--  Extends `enquiries` to carry the funnel's answers, lead score,
--  qualified|nurture segment and UTM attribution. Idempotent —
--  safe to re-run. Apply in Supabase: SQL Editor → New query → Run.
-- ============================================================

-- The /start funnel posts with source='funnel'. (source stays free text;
-- existing values: 'contact' | 'booking' | 'brief' | 'funnel'.)
alter table public.enquiries add column if not exists funnel_data jsonb;   -- { answers, recommendation }
alter table public.enquiries add column if not exists lead_score  int;
alter table public.enquiries add column if not exists segment     text;     -- 'qualified' | 'nurture'
alter table public.enquiries add column if not exists utm         jsonb;    -- { source, medium, campaign, term, content, referrer }

-- Helps the admin filter the funnel inbox by how leads were routed.
create index if not exists enquiries_segment_idx on public.enquiries (segment);

-- RLS already allows anonymous INSERT into enquiries (see schema.sql); the
-- funnel route uses the service-role client, so no policy change is needed.
