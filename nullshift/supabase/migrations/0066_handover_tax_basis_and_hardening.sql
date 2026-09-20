-- 0066: owner decisions of 2026-09-20 and advisor hardening.
--   * The £600 independent handover fee is invoiced inclusive with no VAT line:
--     add 'inclusive_no_vat' to the tax_basis checks on service_schedules and
--     handover_schedules (0059) and make it the handover default.
--   * finance_exceptions_guard (0065) gains a pinned search_path (advisor WARN).
-- STATUS: APPLIED to Nullshift Ops on 2026-09-20 as handover_tax_basis_and_hardening.
-- Rollback: restore the two check constraints without the new value (only if no
-- row uses it) and `alter function public.finance_exceptions_guard() reset search_path`.

alter table public.service_schedules
  drop constraint if exists service_schedules_tax_basis_check;
alter table public.service_schedules
  add constraint service_schedules_tax_basis_check check (
    tax_basis in ('pending', 'standard_vat', 'exempt', 'zero_rated', 'inclusive_no_vat')
  );

alter table public.handover_schedules
  drop constraint if exists handover_schedules_tax_basis_check;
alter table public.handover_schedules
  add constraint handover_schedules_tax_basis_check check (
    tax_basis in ('pending', 'standard_vat', 'exempt', 'zero_rated', 'inclusive_no_vat')
  );
alter table public.handover_schedules
  alter column tax_basis set default 'inclusive_no_vat';

alter function public.finance_exceptions_guard() set search_path = public;
