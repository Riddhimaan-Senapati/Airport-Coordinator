begin;

create extension if not exists pgtap with schema extensions;
select plan(70);

select has_table('public', 'airports', 'airports table exists');
select has_table('public', 'trips', 'trips table exists');
select has_table('public', 'matches', 'matches table exists');
select has_table('public', 'notification_outbox', 'notification outbox exists');
select policies_are('public', 'notification_outbox', array[]::text[], 'clients have no outbox policy');
select policies_are('public', 'trips', array['users_read_their_trip'], 'trip RLS is owner-only');
select policies_are('public', 'matches', array['participants_read_their_matches'], 'match RLS is participant-only');
select ok(
  not has_function_privilege('anon', 'public.search_airports(text,integer)', 'EXECUTE'),
  'anonymous users cannot execute airport search'
);
select ok(
  position(
    'airport-buddy-trip-matching' in
    pg_get_functiondef('public.save_trip_and_find_matches(bigint,timestamp with time zone,smallint)'::regprocedure)
  ) = 0,
  'trip matching does not use a global advisory lock'
);
select ok(
  position(
    'airport:' in
    pg_get_functiondef('public.save_trip_and_find_matches(bigint,timestamp with time zone,smallint)'::regprocedure)
  ) > 0,
  'trip matching locks only affected airports'
);
select ok(
  position(
    'pg_advisory_xact_lock' in
    pg_get_functiondef('public.set_match_consent(uuid,boolean)'::regprocedure)
  ) = 0,
  'consent does not use an advisory lock'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'one@umass.edu', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'two@umass.edu', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'three@umass.edu', '', now(), now(), now());

insert into public.airports (
  id, ident, iata_code, gps_code, name, municipality, country_code, country_name,
  latitude, longitude, type, timezone, catalog_generation
) values (
  -900000001, 'TEST-KBOS', 'BOS', 'KBOS', 'Boston Logan International Airport', 'Boston', 'US', 'United States',
  42.3643, -71.0052, 'large_airport', 'America/New_York', 'test-generation'
), (
  -900000002, 'TEST-INACTIVE', 'TST', 'TST', 'Inactive Test Airport', 'Test City', 'US', 'United States',
  42.0, -72.0, 'small_airport', 'America/New_York', 'incomplete-generation'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  public.reconcile_airport_catalog('test-generation'),
  1::bigint,
  'catalog reconciliation activates only the completed generation'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('test.base_time', (now() + interval '1 day')::text, true);
select is(
  (select count(*)::integer from public.search_airports('TST', 10)),
  0,
  'airport search excludes inactive catalog rows'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.save_trip_and_find_matches(-900000001, current_setting('test.base_time')::timestamptz + interval '2 hours', 4::smallint) $$,
  'first user can save a trip'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ select public.save_trip_and_find_matches(-900000001, current_setting('test.base_time')::timestamptz, 3::smallint) $$,
  'reverse-direction interval overlap creates a match'
);
select is((select count(*)::integer from public.matches), 1, 'the symmetric overlap creates exactly one match');
select is(
  public.get_trip_dashboard()->'trip'->>'id',
  '00000000-0000-0000-0000-000000000002',
  'dashboard trip includes its stable UUID'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.matches), 0, 'RLS hides matches from nonparticipants');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is(
  (public.get_trip_dashboard()->'matches'->0->>'contactEmail')::text,
  null,
  'contact email stays hidden before mutual consent'
);

select public.set_match_consent((select id from public.matches limit 1), true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select public.set_match_consent((select id from public.matches limit 1), true);
select is(
  (public.get_trip_dashboard()->'matches'->0->>'contactEmail')::text,
  'one@umass.edu',
  'contact email appears after mutual consent'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select public.save_trip_and_find_matches(
  -900000001,
  current_setting('test.base_time')::timestamptz + interval '2 hours 30 minutes',
  4::smallint
);
select ok(
  not (select consent_low or consent_high from public.matches limit 1),
  'trip revision invalidates prior consent'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select public.save_trip_and_find_matches(
  -900000001,
  current_setting('test.base_time')::timestamptz + interval '6 hours 30 minutes',
  1::smallint
);
select ok(
  exists (
    select 1 from public.matches
    where overlap_start = overlap_end
      and '00000000-0000-0000-0000-000000000003' in (user_low, user_high)
  ),
  'an arrival exactly at a wait boundary is a match'
);

select public.save_trip_and_find_matches(
  -900000001,
  now() - interval '12 hours',
  1::smallint
);
select is(
  public.get_trip_dashboard()->'trip',
  'null'::jsonb,
  'expired trips are omitted from the dashboard'
);

reset role;
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'eleven@umass.edu', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'twelve@umass.edu', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000013', 'authenticated', 'authenticated', 'thirteen@umass.edu', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000014', 'authenticated', 'authenticated', 'fourteen@umass.edu', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000015', 'authenticated', 'authenticated', 'fifteen@umass.edu', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000016', 'authenticated', 'authenticated', 'sixteen@umass.edu', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000017', 'authenticated', 'authenticated', 'seventeen@umass.edu', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000018', 'authenticated', 'authenticated', 'eighteen@umass.edu', '', now(), now(), now());

insert into public.airports (
  id, ident, iata_code, gps_code, name, municipality, country_code, country_name,
  latitude, longitude, type, timezone, catalog_generation
) values (
  -900000003, 'TEST-KPVD', 'PVD', 'KPVD', 'Rhode Island T. F. Green Airport', 'Providence', 'US', 'United States',
  41.7240, -71.4283, 'medium_airport', 'America/New_York', 'notify-generation'
);

insert into public.trips (user_id, airport_generation, airport_id, arrival_at, wait_hours, wait_until, revision)
values
  ('00000000-0000-0000-0000-000000000011', 'notify-generation', -900000003, now() + interval '1 hour', 6, now() + interval '7 hours', 1),
  ('00000000-0000-0000-0000-000000000012', 'notify-generation', -900000003, now() + interval '2 hours', 6, now() + interval '8 hours', 1),
  ('00000000-0000-0000-0000-000000000013', 'notify-generation', -900000003, now() + interval '1 hour', 6, now() + interval '7 hours', 1),
  ('00000000-0000-0000-0000-000000000014', 'notify-generation', -900000003, now() + interval '2 hours', 6, now() + interval '8 hours', 1),
  ('00000000-0000-0000-0000-000000000015', 'notify-generation', -900000003, now() - interval '10 hours', 1, now() - interval '9 hours', 1),
  ('00000000-0000-0000-0000-000000000016', 'notify-generation', -900000003, now() - interval '10 hours', 1, now() - interval '9 hours', 1),
  ('00000000-0000-0000-0000-000000000017', 'notify-generation', -900000003, now() + interval '1 hour', 6, now() + interval '7 hours', 1),
  ('00000000-0000-0000-0000-000000000018', 'notify-generation', -900000003, now() + interval '2 hours', 6, now() + interval '8 hours', 1);

insert into public.matches (
  user_low, user_high, airport_generation, airport_id, revision_low, revision_high, overlap_start, overlap_end
) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012', 'notify-generation', -900000003, 1, 1, now() + interval '2 hours', now() + interval '7 hours'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000014', 'notify-generation', -900000003, 1, 1, now() + interval '2 hours', now() + interval '7 hours'),
  ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000016', 'notify-generation', -900000003, 1, 1, now() - interval '10 hours', now() - interval '9 hours'),
  ('00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000018', 'notify-generation', -900000003, 1, 1, now() + interval '2 hours', now() + interval '7 hours');

select ok(
  has_function_privilege('service_role', 'public.claim_notification_batch(uuid,integer,integer)', 'EXECUTE'),
  'service role can claim delivery-ready notifications'
);
select ok(
  not has_function_privilege('anon', 'public.claim_notification_batch(uuid,integer,integer)', 'EXECUTE'),
  'anonymous users cannot claim notifications'
);

reset role;
delete from public.notification_outbox;
insert into public.notification_outbox (
  match_id, recipient_user_id, kind, dedupe_key, status, available_at, leased_until, lease_token, attempt_count, sent_at
) values
  ((select id from public.matches where user_low = '00000000-0000-0000-0000-000000000011'), '00000000-0000-0000-0000-000000000011', 'match_found', 'mix-ok', 'pending', now(), null, null, 0, null),
  ((select id from public.matches where user_low = '00000000-0000-0000-0000-000000000015'), '00000000-0000-0000-0000-000000000015', 'match_found', 'mix-cancel', 'pending', now(), null, null, 0, null),
  ((select id from public.matches where user_low = '00000000-0000-0000-0000-000000000011'), '00000000-0000-0000-0000-000000000012', 'match_found', 'mix-future', 'pending', now() + interval '1 day', null, null, 0, null),
  ((select id from public.matches where user_low = '00000000-0000-0000-0000-000000000011'), '00000000-0000-0000-0000-000000000011', 'match_found', 'mix-sent', 'sent', now(), null, null, 1, now()),
  ((select id from public.matches where user_low = '00000000-0000-0000-0000-000000000013'), '00000000-0000-0000-0000-000000000013', 'match_found', 'mix-live', 'leased', now(), now() + interval '1 hour', '00000000-0000-0000-0000-0000000000c1', 1, null);
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table mixed_claim on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000a1', 50, 120) as payload;
select is(
  jsonb_array_length((select payload->'claims' from mixed_claim)),
  1,
  'a mixed batch claims only the delivery-ready row'
);
select is(
  (select payload->>'cancelled' from mixed_claim),
  '1',
  'a mixed batch reports the cancelled ineligible row'
);
select is(
  (select payload->'claims'->0->>'recipient_email' from mixed_claim),
  'eleven@umass.edu',
  'a claim projects the recipient address'
);
select is(
  (select status from public.notification_outbox where dedupe_key = 'mix-cancel'),
  'cancelled',
  'an ineligible pending row is cancelled during claim'
);
select is(
  (select status from public.notification_outbox where dedupe_key = 'mix-future'),
  'pending',
  'a not-yet-available row stays pending'
);
select is(
  (select status from public.notification_outbox where dedupe_key = 'mix-sent'),
  'sent',
  'an already-sent row is untouched'
);
select is(
  (select lease_token from public.notification_outbox where dedupe_key = 'mix-live'),
  '00000000-0000-0000-0000-0000000000c1',
  'a live lease is not stolen'
);
select is(
  (select status from public.notification_outbox where dedupe_key = 'mix-ok'),
  'leased',
  'the eligible row is leased'
);
select is(
  (select lease_token from public.notification_outbox where dedupe_key = 'mix-ok'),
  '00000000-0000-0000-0000-0000000000a1',
  'the eligible row carries the claiming worker lease'
);
select is(
  (select attempt_count from public.notification_outbox where dedupe_key = 'mix-ok'),
  1,
  'a claim records one delivery attempt'
);

reset role;
delete from public.notification_outbox;
insert into public.notification_outbox (match_id, recipient_user_id, kind, dedupe_key)
values ((select id from public.matches where user_low = '00000000-0000-0000-0000-000000000017'), '00000000-0000-0000-0000-000000000017', 'match_found', 'cancel-revision');
update public.trips
set revision = revision + 1
where user_id = '00000000-0000-0000-0000-000000000017';
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table cancel_claim on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000a1', 50, 120) as payload;
select is(
  jsonb_array_length((select payload->'claims' from cancel_claim)),
  0,
  'a revision-stale notification is not claimed'
);
select is(
  (select payload->>'cancelled' from cancel_claim),
  '1',
  'a revision-stale notification is reported cancelled'
);
select is(
  (select status from public.notification_outbox where dedupe_key = 'cancel-revision'),
  'cancelled',
  'a revision-stale notification is cancelled atomically'
);

reset role;
delete from public.notification_outbox;
insert into public.notification_outbox (match_id, recipient_user_id, kind, dedupe_key)
values ((select id from public.matches where user_low = '00000000-0000-0000-0000-000000000011'), '00000000-0000-0000-0000-000000000011', 'match_found', 'retry-key');
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table retry_first on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000a1', 50, 120) as payload;
select is(
  (select payload->'claims'->0->>'id' from retry_first),
  (select id::text from public.notification_outbox where dedupe_key = 'retry-key'),
  'a claim returns the queued notification id'
);
select ok(
  public.fail_notification(
    (select id from public.notification_outbox where dedupe_key = 'retry-key'),
    '00000000-0000-0000-0000-0000000000a1',
    'Resend returned 429'
  ),
  'a rate-limited delivery fails under its owning lease'
);
select is(
  (select status from public.notification_outbox where dedupe_key = 'retry-key'),
  'pending',
  'a failed notification returns to pending'
);
select is(
  (select attempt_count from public.notification_outbox where dedupe_key = 'retry-key'),
  1,
  'a failed notification keeps its attempt count'
);
select is(
  (select last_error from public.notification_outbox where dedupe_key = 'retry-key'),
  'Resend returned 429',
  'a failed notification records its error'
);
select ok(
  (select available_at > now() from public.notification_outbox where dedupe_key = 'retry-key'),
  'a failed notification backs off before retry'
);
create temporary table retry_blocked on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000b1', 50, 120) as payload;
select is(
  jsonb_array_length((select payload->'claims' from retry_blocked)),
  0,
  'a backed-off notification is not claimed early'
);
reset role;
update public.notification_outbox set available_at = now() where dedupe_key = 'retry-key';
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table retry_second on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000b1', 50, 120) as payload;
select is(
  (select payload->'claims'->0->>'id' from retry_second),
  (select id::text from public.notification_outbox where dedupe_key = 'retry-key'),
  'a retry reclaims the same queue row'
);
select is(
  (select attempt_count from public.notification_outbox where dedupe_key = 'retry-key'),
  2,
  'a retry increments the attempt count'
);
select ok(
  not public.fail_notification(
    (select id from public.notification_outbox where dedupe_key = 'retry-key'),
    '00000000-0000-0000-0000-0000000000a1',
    'stale worker'
  ),
  'a stale worker cannot fail a row owned by another lease'
);
select ok(
  public.fail_notification(
    (select id from public.notification_outbox where dedupe_key = 'retry-key'),
    '00000000-0000-0000-0000-0000000000b1',
    'Resend returned 500'
  ),
  'the owning worker can fail its lease'
);
select is(
  (select last_error from public.notification_outbox where dedupe_key = 'retry-key'),
  'Resend returned 500',
  'a server error updates retry metadata'
);

reset role;
delete from public.notification_outbox;
insert into public.notification_outbox (match_id, recipient_user_id, kind, dedupe_key)
values ((select id from public.matches where user_low = '00000000-0000-0000-0000-000000000013'), '00000000-0000-0000-0000-000000000013', 'match_found', 'lease-key');
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table lease_first on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000a1', 1, 30) as payload;
reset role;
update public.notification_outbox set leased_until = now() - interval '1 second' where dedupe_key = 'lease-key';
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table lease_second on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000b1', 1, 120) as payload;
select is(
  (select payload->'claims'->0->>'id' from lease_second),
  (select id::text from public.notification_outbox where dedupe_key = 'lease-key'),
  'an expired lease is reclaimed'
);
select is(
  (select lease_token from public.notification_outbox where dedupe_key = 'lease-key'),
  '00000000-0000-0000-0000-0000000000b1',
  'an expired lease transfers ownership'
);
select is(
  (select attempt_count from public.notification_outbox where dedupe_key = 'lease-key'),
  2,
  'reclaiming an expired lease records another attempt'
);
select ok(
  not public.complete_notification(
    (select id from public.notification_outbox where dedupe_key = 'lease-key'),
    '00000000-0000-0000-0000-0000000000a1'
  ),
  'the original worker cannot complete after reclaim'
);
select ok(
  public.complete_notification(
    (select id from public.notification_outbox where dedupe_key = 'lease-key'),
    '00000000-0000-0000-0000-0000000000b1'
  ),
  'the reclaiming worker completes the delivery'
);

reset role;
delete from public.notification_outbox;
insert into public.notification_outbox (match_id, recipient_user_id, kind, dedupe_key)
values ((select id from public.matches where user_low = '00000000-0000-0000-0000-000000000011'), '00000000-0000-0000-0000-000000000011', 'match_found', 'idem-key');
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table idem_first on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000a1', 1, 120) as payload;
select is(
  (select payload->'claims'->0->>'id' from idem_first),
  (select id::text from public.notification_outbox where dedupe_key = 'idem-key'),
  'the claim id is the stable Resend idempotency key'
);
select ok(
  public.fail_notification(
    (select id from public.notification_outbox where dedupe_key = 'idem-key'),
    '00000000-0000-0000-0000-0000000000a1',
    'Resend returned 429'
  ),
  'the first idempotent attempt fails'
);
reset role;
update public.notification_outbox set available_at = now() where dedupe_key = 'idem-key';
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table idem_second on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000a1', 1, 120) as payload;
select is(
  (select payload->'claims'->0->>'id' from idem_second),
  (select payload->'claims'->0->>'id' from idem_first),
  'a replay returns the same queue id for the same idempotency key'
);
select ok(
  public.complete_notification(
    (select id from public.notification_outbox where dedupe_key = 'idem-key'),
    '00000000-0000-0000-0000-0000000000a1'
  ),
  'the replayed delivery completes'
);
select is(
  (select status from public.notification_outbox where dedupe_key = 'idem-key'),
  'sent',
  'the completed row is terminal'
);
reset role;
select throws_ok(
  $$ insert into public.notification_outbox (match_id, recipient_user_id, kind, dedupe_key)
     values ((select id from public.matches where user_low = '00000000-0000-0000-0000-000000000011'), '00000000-0000-0000-0000-000000000011', 'match_found', 'idem-key') $$,
  '23505'::char(5),
  NULL,
  'a duplicate dedupe key cannot enqueue twice'
);

reset role;
delete from public.notification_outbox;
insert into public.notification_outbox (match_id, recipient_user_id, kind, dedupe_key)
values ((select id from public.matches where user_low = '00000000-0000-0000-0000-000000000013'), '00000000-0000-0000-0000-000000000014', 'match_found', 'worker-key');
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table worker_a on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000a1', 50, 120) as payload;
select is(
  jsonb_array_length((select payload->'claims' from worker_a)),
  1,
  'the first worker claims the ready row'
);
create temporary table worker_b on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000b1', 50, 120) as payload;
select is(
  jsonb_array_length((select payload->'claims' from worker_b)),
  0,
  'a second worker cannot double-claim a live lease'
);
select ok(
  not public.complete_notification(
    (select id from public.notification_outbox where dedupe_key = 'worker-key'),
    '00000000-0000-0000-0000-0000000000b1'
  ),
  'the second worker cannot complete the first worker lease'
);
select ok(
  public.complete_notification(
    (select id from public.notification_outbox where dedupe_key = 'worker-key'),
    '00000000-0000-0000-0000-0000000000a1'
  ),
  'the owning worker completes without a duplicate send'
);
create temporary table worker_c on commit drop as
select public.claim_notification_batch('00000000-0000-0000-0000-0000000000c1', 50, 120) as payload;
select is(
  jsonb_array_length((select payload->'claims' from worker_c)),
  0,
  'a completed row is never reclaimed'
);

reset role;
insert into public.airports (
  id, ident, iata_code, gps_code, name, municipality, country_code, country_name,
  latitude, longitude, type, timezone, catalog_generation
) values (
  -900000001, 'TEST-KBOS', 'BOS', 'KBOS', 'Boston Logan International Airport', 'Boston', 'US', 'United States',
  42.3643, -71.0052, 'large_airport', 'America/New_York', 'next-generation'
);
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  public.reconcile_airport_catalog('next-generation'),
  1::bigint,
  'pointer cutover activates a complete immutable generation'
);
select ok(
  public.prune_airport_catalog(5000) between 1 and 5000,
  'bounded pruning removes no more than its requested batch size'
);
select ok(
  exists (
    select 1 from public.airports
    where catalog_generation = 'test-generation'
      and id = -900000001
  ),
  'bounded pruning retains old-generation rows referenced by trips'
);
do $$
begin
  while public.prune_airport_catalog(10000) > 0 loop
    null;
  end loop;
end;
$$;
select is(
  public.prune_airport_catalog(5000),
  0,
  'bounded pruning is idempotent after removable rows are gone'
);

select * from finish();
rollback;
