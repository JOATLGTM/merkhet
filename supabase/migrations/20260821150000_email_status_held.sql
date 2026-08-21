-- `held` — planned, recorded, deliberately not delivered.
--
-- Customer mail is withheld unless EMAIL_CUSTOMER_ENABLED=true. Those messages
-- were previously dropped before the insert, which left no way to review what
-- would have been sent. They are now written with this status instead.
--
-- Distinct from `pending`, which means "queued, provider not reached yet" —
-- conflating the two would make an unset API key look like a policy decision.

alter type public.email_status add value if not exists 'held';
