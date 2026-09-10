begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

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
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select ok(
  has_function_privilege('service_role', 'public.notification_is_deliverable(uuid,uuid)', 'EXECUTE'),
  'service role can verify notification delivery eligibility'
);
create temporary table claimed_notification on commit drop as
select id, match_id
from public.claim_notification_batch(
  '00000000-0000-0000-0000-000000000099',
  1,
  120
);
select ok(
  (
    select public.notification_is_deliverable(
      id,
      '00000000-0000-0000-0000-000000000099'
    )
    from claimed_notification
  ),
  'a leased notification for a current match is deliverable'
);

reset role;
update public.trips
set revision = revision + 1
where user_id = (
  select matched.user_low
  from public.matches matched
  join claimed_notification claimed on claimed.match_id = matched.id
);
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select ok(
  not (
    select public.notification_is_deliverable(
      id,
      '00000000-0000-0000-0000-000000000099'
    )
    from claimed_notification
  ),
  'a leased notification becomes ineligible after a trip revision changes'
);
select is(
  (
    select outbox.status
    from public.notification_outbox outbox
    join claimed_notification claimed on claimed.id = outbox.id
  ),
  'cancelled',
  'an ineligible leased notification is cancelled atomically'
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
