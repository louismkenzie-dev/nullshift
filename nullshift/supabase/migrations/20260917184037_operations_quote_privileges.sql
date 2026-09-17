-- Supabase default grants also include TRUNCATE/TRIGGER/REFERENCES, which are
-- unnecessary for the API. RLS does not protect TRUNCATE: revoke explicitly.
revoke truncate, references, trigger on public.opportunities, public.quotes, public.quote_versions, public.quote_approvals from authenticated;
