-- Add payment_terms text field to proposals so the admin can specify
-- instalment schedules, deposit requirements, etc., and have them
-- appear on the client-facing proposal document.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS payment_terms text;
