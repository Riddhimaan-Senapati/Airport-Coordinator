-- No new index: notification_outbox_claim_idx already covers the claim predicate,
-- and eligibility joins land on primary keys.

drop function if exists public.notification_is_deliverable(uuid, uuid);
drop function if exists public.claim_notification_batch(uuid, integer, integer);

create function public.claim_notification_batch(
  p_worker_id uuid,
  p_batch_size integer default 50,
  p_lease_seconds integer default 120
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  cancelled_count integer;
  batch_size integer := least(greatest(p_batch_size, 1), 100);
  lease_seconds integer := least(greatest(p_lease_seconds, 30), 900);
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if p_worker_id is null then
    raise exception 'Worker ID is required' using errcode = '22004';
  end if;

  update public.notification_outbox
  set status = 'dead', leased_until = null, lease_token = null, updated_at = now()
  where status = 'leased'
    and leased_until <= now()
    and attempt_count >= 10;

  with candidates as (
    select outbox.id
    from public.notification_outbox outbox
    where (
      outbox.status = 'pending'
      or (outbox.status = 'leased' and outbox.leased_until <= now())
    )
      and outbox.available_at <= now()
      and outbox.attempt_count < 10
    order by outbox.available_at, outbox.created_at
    for update skip locked
    limit batch_size
  ),
  eligible as (
    select outbox.id, outbox.match_id, users.email as recipient_email
    from candidates candidate
    join public.notification_outbox outbox on outbox.id = candidate.id
    join public.matches matched on matched.id = outbox.match_id
    join public.trips low_trip on low_trip.user_id = matched.user_low
    join public.trips high_trip on high_trip.user_id = matched.user_high
    left join auth.users users on users.id = outbox.recipient_user_id
    where outbox.recipient_user_id in (matched.user_low, matched.user_high)
      and matched.overlap_end > now()
      and low_trip.revision = matched.revision_low
      and high_trip.revision = matched.revision_high
  ),
  cancelled as (
    update public.notification_outbox outbox
    set status = 'cancelled', leased_until = null, lease_token = null, updated_at = now()
    where outbox.id in (select candidate.id from candidates candidate)
      and outbox.id not in (select eligible.id from eligible)
    returning outbox.id
  ),
  leased as (
    update public.notification_outbox outbox
    set
      status = 'leased',
      attempt_count = outbox.attempt_count + 1,
      leased_until = now() + make_interval(secs => lease_seconds),
      lease_token = p_worker_id,
      updated_at = now()
    from eligible
    where outbox.id = eligible.id
    returning outbox.id, eligible.match_id, eligible.recipient_email
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', leased.id,
          'match_id', leased.match_id,
          'recipient_email', leased.recipient_email
        )
      ),
      '[]'::jsonb
    ),
    (select count(*)::integer from cancelled)
  into claims, cancelled_count
  from leased;

  return jsonb_build_object('claims', claims, 'cancelled', cancelled_count);
end;
$$;

revoke execute on function public.claim_notification_batch(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_notification_batch(uuid, integer, integer) to service_role;
