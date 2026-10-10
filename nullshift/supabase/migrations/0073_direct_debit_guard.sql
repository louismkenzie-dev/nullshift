-- 0073 — Direct Debit guard rails.
--
-- Two new finance-exception kinds for the one invariant the Direct Debit
-- rail must hold: money leaves a client's account under a GoCardless mandate
-- ONLY as the plan we hold for them (our subscription, at the contracted
-- amount).
--
--   unexpected_collection  a payment on the client's mandate that is not the
--                          plan: a one-off created in the GoCardless
--                          dashboard, a payment from a subscription we do not
--                          hold, or the plan subscription collecting a
--                          different amount. Urgent. external_ref = the
--                          GoCardless payment id, so a redelivered webhook
--                          and the daily sweep land on the same open row.
--   direct_debit_drift     the live GoCardless subscription's amount differs
--                          from the contracted MRR (amended outside the
--                          system, or our price changed without amending
--                          GoCardless). Urgent. external_ref = the GoCardless
--                          subscription id. Auto-resolved by the sweep once
--                          the amounts agree again.
--
-- Everything else about finance_exceptions (0065) is unchanged.

alter table public.finance_exceptions
  drop constraint if exists finance_exceptions_kind_check;

alter table public.finance_exceptions
  add constraint finance_exceptions_kind_check check (
    kind in (
      'missing_consent',
      'cancelled_mandate',
      'failed_collection',
      'xero_outage',
      'duplicate_warning',
      'balance_mismatch',
      'link_closure_failed',
      'unmatched_payout',
      'missing_activation_gate',
      'unexpected_collection',
      'direct_debit_drift',
      'other'
    )
  );
