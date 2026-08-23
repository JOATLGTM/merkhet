-- `redirected` — a client message delivered to the project owner instead.
--
-- Client mail is still withheld from clients until EMAIL_CUSTOMER_ENABLED=true,
-- but `held` meant it went nowhere and could only be reviewed by reading
-- `text_body` out of this table by hand. A withheld message nobody opens is a
-- message nobody has actually checked. Those now go to the project's owner
-- (`projects.created_by`) so the real rendered mail lands in a real inbox.
--
-- `held` is retained, not replaced: a project whose owner is missing or
-- deactivated has nowhere to redirect to, and dropping the message would be
-- worse than recording it undelivered.

alter type public.email_status add value if not exists 'redirected';

-- Who the message was *addressed to in the copy* when it was not who it was
-- delivered to. Null on every ordinary row. `to_addresses` always stays the
-- set the provider was actually handed, so a retry cannot leak a redirected
-- message to the client by replaying the wrong column.
alter table public.email_outbox
  add column if not exists intended_to_addresses text[];
