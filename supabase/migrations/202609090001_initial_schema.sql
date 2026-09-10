create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table public.airports (
  id bigint not null,
  ident text not null,
  iata_code text,
  gps_code text,
  name text not null,
  municipality text,
  country_code text not null,
  country_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  type text not null,
  timezone text not null,
  catalog_generation text not null,
  search_text text generated always as (
    lower(
      ident || ' ' ||
      coalesce(iata_code, '') || ' ' ||
      coalesce(gps_code, '') || ' ' ||
      name || ' ' ||
      coalesce(municipality, '') || ' ' ||
      country_code || ' ' ||
      country_name
    )
  ) stored,
  constraint airports_iata_code_format check (iata_code is null or iata_code ~ '^[A-Z0-9]{3}$'),
  constraint airports_gps_code_format check (gps_code is null or gps_code ~ '^[A-Z0-9]{3,4}$'),
  constraint airports_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint airports_catalog_generation_nonempty check (length(trim(catalog_generation)) > 0),
  constraint airports_latitude_range check (latitude between -90 and 90),
  constraint airports_longitude_range check (longitude between -180 and 180),
  constraint airports_type_known check (
    type in ('balloonport', 'closed', 'heliport', 'large_airport', 'medium_airport', 'seaplane_base', 'small_airport')
  ),
  primary key (catalog_generation, id),
  unique (catalog_generation, ident)
);

create index airports_id_idx on public.airports (id);
create index airports_iata_code_idx on public.airports (catalog_generation, iata_code) where iata_code is not null;
create index airports_gps_code_idx on public.airports (catalog_generation, gps_code) where gps_code is not null;
create index airports_search_text_trgm_idx on public.airports using gin (search_text extensions.gin_trgm_ops);

create table public.airport_catalog_state (
  singleton boolean primary key default true,
  active_generation text,
  activated_at timestamptz,
  constraint airport_catalog_state_singleton check (singleton)
);

insert into public.airport_catalog_state (singleton) values (true);

create table public.trips (
  user_id uuid primary key references auth.users (id) on delete cascade,
  airport_generation text not null,
  airport_id bigint not null,
  arrival_at timestamptz not null,
  wait_hours smallint not null,
  wait_until timestamptz not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_wait_hours_range check (wait_hours between 1 and 24),
  constraint trips_wait_window_consistent check (wait_until = arrival_at + make_interval(hours => wait_hours)),
  constraint trips_revision_positive check (revision > 0),
  foreign key (airport_generation, airport_id)
    references public.airports (catalog_generation, id)
);

create index trips_airport_overlap_idx on public.trips (airport_id, arrival_at, wait_until);

create table public.matches (
  id uuid primary key default extensions.gen_random_uuid(),
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  airport_generation text not null,
  airport_id bigint not null,
  revision_low bigint not null,
  revision_high bigint not null,
  overlap_start timestamptz not null,
  overlap_end timestamptz not null,
  consent_low boolean not null default false,
  consent_high boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_canonical_user_order check (user_low < user_high),
  constraint matches_overlap_nonempty check (overlap_start <= overlap_end),
  foreign key (airport_generation, airport_id)
    references public.airports (catalog_generation, id),
  unique (user_low, user_high)
);

create index matches_user_high_idx on public.matches (user_high);
create index matches_expiry_idx on public.matches (overlap_end);

create table public.notification_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  match_id uuid references public.matches (id) on delete set null,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  leased_until timestamptz,
  lease_token uuid,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_kind_known check (kind in ('match_found')),
  constraint notification_outbox_status_known check (status in ('pending', 'leased', 'sent', 'dead', 'cancelled')),
  constraint notification_outbox_attempt_count_nonnegative check (attempt_count >= 0)
);

create index notification_outbox_claim_idx
  on public.notification_outbox (available_at, created_at)
  where status in ('pending', 'leased');

alter table public.airports enable row level security;
alter table public.airport_catalog_state enable row level security;
alter table public.trips enable row level security;
alter table public.matches enable row level security;
alter table public.notification_outbox enable row level security;

create policy airports_are_publicly_readable
  on public.airports for select
  to anon, authenticated
  using (
    catalog_generation = (
      select active_generation from public.airport_catalog_state where singleton
    )
  );

create policy airport_catalog_state_is_publicly_readable
  on public.airport_catalog_state for select
  to anon, authenticated
  using (singleton);

create policy users_read_their_trip
  on public.trips for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy participants_read_their_matches
  on public.matches for select
  to authenticated
  using ((select auth.uid()) in (user_low, user_high));

revoke all on public.airports, public.airport_catalog_state, public.trips, public.matches, public.notification_outbox from anon, authenticated;
grant select on public.airports, public.airport_catalog_state to anon, authenticated;
grant select on public.trips, public.matches to authenticated;

create or replace function public.require_umass_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  email_is_confirmed boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select lower(email), email_confirmed_at is not null
  into current_email, email_is_confirmed
  from auth.users
  where id = current_user_id;

  if current_email is null
    or current_email !~ '^[^@]+@umass\.edu$'
    or not coalesce(email_is_confirmed, false)
  then
    raise exception 'A confirmed @umass.edu account is required' using errcode = '28000';
  end if;

  return current_user_id;
end;
$$;

create or replace function public.restrict_signup_to_umass(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  signup_email text := lower(event->'user'->>'email');
begin
  if signup_email is null or signup_email !~ '^[^@]+@umass\.edu$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'Use an @umass.edu email address.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

revoke execute on function public.require_umass_user() from public, anon, authenticated;
revoke execute on function public.restrict_signup_to_umass(jsonb) from public, anon, authenticated;
grant execute on function public.restrict_signup_to_umass(jsonb) to supabase_auth_admin;

create or replace function public.search_airports(query text, result_limit integer default 10)
returns table (
  id bigint,
  code text,
  iata_code text,
  gps_code text,
  ident text,
  name text,
  municipality text,
  country_code text,
  country_name text,
  timezone text,
  latitude double precision,
  longitude double precision,
  type text,
  score real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select
      lower(trim(query)) as value,
      least(greatest(coalesce(result_limit, 10), 1), 10) as row_limit
  )
  select
    airport.id,
    coalesce(airport.iata_code, airport.gps_code, airport.ident) as code,
    airport.iata_code,
    airport.gps_code,
    airport.ident,
    airport.name,
    airport.municipality,
    airport.country_code,
    airport.country_name,
    airport.timezone,
    airport.latitude,
    airport.longitude,
    airport.type,
    (
      case
        when lower(coalesce(airport.iata_code, '')) = input.value then 10
        when lower(coalesce(airport.gps_code, '')) = input.value then 9
        when lower(airport.ident) = input.value then 8
        when lower(airport.name) = input.value then 7
        else 0
      end
      + extensions.word_similarity(input.value, airport.search_text)
      + case airport.type
          when 'large_airport' then 0.30
          when 'medium_airport' then 0.20
          when 'small_airport' then 0.10
          else 0
        end
    )::real as score
  from public.airports airport
  join public.airport_catalog_state catalog_state
    on catalog_state.singleton
    and catalog_state.active_generation = airport.catalog_generation
  cross join input
  where length(input.value) between 2 and 100
    and (
      lower(coalesce(airport.iata_code, '')) = input.value
      or lower(coalesce(airport.gps_code, '')) = input.value
      or lower(airport.ident) = input.value
      or input.value operator(extensions.<%) airport.search_text
    )
  order by score desc, airport.name, airport.id
  limit (select row_limit from input);
$$;

revoke execute on function public.search_airports(text, integer) from public, anon;
grant execute on function public.search_airports(text, integer) to authenticated;

create or replace function public.reconcile_airport_catalog(p_generation text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  active_count bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if p_generation is null or length(trim(p_generation)) = 0 then
    raise exception 'Catalog generation is required' using errcode = '22004';
  end if;

  select count(*) into active_count
  from public.airports
  where catalog_generation = p_generation;

  if active_count = 0 then
    raise exception 'Catalog generation has no airports' using errcode = '22023';
  end if;

  update public.airport_catalog_state
  set active_generation = p_generation, activated_at = now()
  where singleton;

  return active_count;
end;
$$;

revoke execute on function public.reconcile_airport_catalog(text) from public, anon, authenticated;
grant execute on function public.reconcile_airport_catalog(text) to service_role;

create or replace function public.prune_airport_catalog(p_batch_size integer default 5000)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;

  with candidates as (
    select airport.catalog_generation, airport.id
    from public.airports airport
    cross join public.airport_catalog_state catalog_state
    where catalog_state.singleton
      and airport.catalog_generation <> catalog_state.active_generation
      and not exists (
        select 1
        from public.trips trip
        where trip.airport_generation = airport.catalog_generation
          and trip.airport_id = airport.id
      )
      and not exists (
        select 1
        from public.matches matched
        where matched.airport_generation = airport.catalog_generation
          and matched.airport_id = airport.id
      )
    order by airport.catalog_generation, airport.id
    limit least(greatest(coalesce(p_batch_size, 5000), 1), 10000)
  )
  delete from public.airports airport
  using candidates
  where airport.catalog_generation = candidates.catalog_generation
    and airport.id = candidates.id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke execute on function public.prune_airport_catalog(integer) from public, anon, authenticated;
grant execute on function public.prune_airport_catalog(integer) to service_role;

create or replace function public.trip_json(trip public.trips)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', trip.user_id,
    'airport', jsonb_build_object(
      'id', airport.id,
      'code', coalesce(airport.iata_code, airport.gps_code, airport.ident),
      'name', airport.name,
      'municipality', airport.municipality,
      'countryCode', airport.country_code,
      'timezone', airport.timezone,
      'latitude', airport.latitude,
      'longitude', airport.longitude
    ),
    'arrivalAt', trip.arrival_at,
    'waitHours', trip.wait_hours,
    'waitUntil', trip.wait_until,
    'revision', trip.revision
  )
  from public.airports airport
  where airport.catalog_generation = trip.airport_generation
    and airport.id = trip.airport_id;
$$;

revoke execute on function public.trip_json(public.trips) from public, anon, authenticated;

create or replace function public.cancel_pending_match_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_outbox
  set status = 'cancelled', leased_until = null, lease_token = null, updated_at = now()
  where match_id = old.id and status in ('pending', 'leased');
  return old;
end;
$$;

create trigger cancel_notifications_before_match_delete
before delete on public.matches
for each row execute function public.cancel_pending_match_notifications();

create or replace function public.save_trip_and_find_matches(
  p_airport_id bigint,
  p_arrival_at timestamptz,
  p_wait_hours smallint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_umass_user();
  saved_trip public.trips;
  previous_airport_id bigint;
  selected_airport_generation text;
  new_match record;
begin
  if p_arrival_at is null then
    raise exception 'Arrival time is required' using errcode = '22004';
  end if;
  if p_arrival_at < now() - interval '1 day'
    or p_arrival_at > now() + interval '1 year'
  then
    raise exception 'Arrival must be between yesterday and one year from now' using errcode = '22023';
  end if;
  if p_wait_hours is null or p_wait_hours not between 1 and 24 then
    raise exception 'Wait hours must be between 1 and 24' using errcode = '22023';
  end if;
  select catalog_state.active_generation into selected_airport_generation
  from public.airport_catalog_state catalog_state
  join public.airports airport
    on airport.catalog_generation = catalog_state.active_generation
    and airport.id = p_airport_id
  where catalog_state.singleton;

  if selected_airport_generation is null then
    raise exception 'Unknown airport' using errcode = '23503';
  end if;

  select airport_id into previous_airport_id
  from public.trips
  where user_id = current_user_id
  for update;

  if previous_airport_id is null or previous_airport_id = p_airport_id then
    perform pg_advisory_xact_lock(hashtextextended('airport:' || p_airport_id::text, 0));
  elsif previous_airport_id < p_airport_id then
    perform pg_advisory_xact_lock(hashtextextended('airport:' || previous_airport_id::text, 0));
    perform pg_advisory_xact_lock(hashtextextended('airport:' || p_airport_id::text, 0));
  else
    perform pg_advisory_xact_lock(hashtextextended('airport:' || p_airport_id::text, 0));
    perform pg_advisory_xact_lock(hashtextextended('airport:' || previous_airport_id::text, 0));
  end if;

  delete from public.matches
  where current_user_id in (user_low, user_high);

  insert into public.trips (
    user_id, airport_generation, airport_id, arrival_at, wait_hours, wait_until, revision
  ) values (
    current_user_id,
    selected_airport_generation,
    p_airport_id,
    p_arrival_at,
    p_wait_hours,
    p_arrival_at + make_interval(hours => p_wait_hours),
    1
  )
  on conflict (user_id) do update set
    airport_generation = excluded.airport_generation,
    airport_id = excluded.airport_id,
    arrival_at = excluded.arrival_at,
    wait_hours = excluded.wait_hours,
    wait_until = excluded.wait_until,
    revision = public.trips.revision + 1,
    updated_at = now()
  returning * into saved_trip;

  for new_match in
    insert into public.matches (
      user_low,
      user_high,
      airport_generation,
      airport_id,
      revision_low,
      revision_high,
      overlap_start,
      overlap_end
    )
    select
      least(saved_trip.user_id, other_trip.user_id),
      greatest(saved_trip.user_id, other_trip.user_id),
      saved_trip.airport_generation,
      saved_trip.airport_id,
      case when saved_trip.user_id < other_trip.user_id then saved_trip.revision else other_trip.revision end,
      case when saved_trip.user_id < other_trip.user_id then other_trip.revision else saved_trip.revision end,
      greatest(saved_trip.arrival_at, other_trip.arrival_at),
      least(saved_trip.wait_until, other_trip.wait_until)
    from public.trips other_trip
    where other_trip.user_id <> saved_trip.user_id
      and other_trip.airport_id = saved_trip.airport_id
      and saved_trip.arrival_at <= other_trip.wait_until
      and other_trip.arrival_at <= saved_trip.wait_until
    returning id, user_low, user_high, revision_low, revision_high
  loop
    insert into public.notification_outbox (
      match_id, recipient_user_id, kind, payload, dedupe_key
    ) values
      (
        new_match.id,
        new_match.user_low,
        'match_found',
        jsonb_build_object('matchId', new_match.id),
        concat('match:', new_match.id, ':', new_match.user_low, ':', new_match.revision_low)
      ),
      (
        new_match.id,
        new_match.user_high,
        'match_found',
        jsonb_build_object('matchId', new_match.id),
        concat('match:', new_match.id, ':', new_match.user_high, ':', new_match.revision_high)
      );
  end loop;

  return public.trip_json(saved_trip);
end;
$$;

revoke execute on function public.save_trip_and_find_matches(bigint, timestamptz, smallint) from public, anon;
grant execute on function public.save_trip_and_find_matches(bigint, timestamptz, smallint) to authenticated;

create or replace function public.delete_my_trip()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_umass_user();
  current_airport_id bigint;
  deleted_count integer;
begin
  select airport_id into current_airport_id
  from public.trips
  where user_id = current_user_id
  for update;

  if current_airport_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('airport:' || current_airport_id::text, 0));
  delete from public.matches where current_user_id in (user_low, user_high);
  delete from public.trips where user_id = current_user_id;
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke execute on function public.delete_my_trip() from public, anon;
grant execute on function public.delete_my_trip() to authenticated;

create or replace function public.set_match_consent(p_match_id uuid, p_consented boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_umass_user();
  selected_match public.matches;
  other_user_id uuid;
  other_email text;
begin
  if p_consented is null then
    raise exception 'Consent value is required' using errcode = '22004';
  end if;

  select * into selected_match
  from public.matches
  where id = p_match_id
  for update;

  if selected_match.id is null
    or current_user_id not in (selected_match.user_low, selected_match.user_high)
    or selected_match.overlap_end <= now()
    or not exists (
      select 1
      from public.trips low_trip, public.trips high_trip
      where low_trip.user_id = selected_match.user_low
        and high_trip.user_id = selected_match.user_high
        and low_trip.revision = selected_match.revision_low
        and high_trip.revision = selected_match.revision_high
    )
  then
    raise exception 'Match is unavailable' using errcode = 'P0002';
  end if;

  update public.matches as target
  set
    consent_low = case when target.user_low = current_user_id then p_consented else target.consent_low end,
    consent_high = case when target.user_high = current_user_id then p_consented else target.consent_high end,
    updated_at = now()
  where target.id = selected_match.id
  returning * into selected_match;

  other_user_id := case
    when selected_match.user_low = current_user_id then selected_match.user_high
    else selected_match.user_low
  end;

  if selected_match.consent_low and selected_match.consent_high then
    select email into other_email from auth.users where id = other_user_id;
  end if;

  return jsonb_build_object(
    'matchId', selected_match.id,
    'hasConsented', case
      when selected_match.user_low = current_user_id then selected_match.consent_low
      else selected_match.consent_high
    end,
    'otherHasConsented', case
      when selected_match.user_low = current_user_id then selected_match.consent_high
      else selected_match.consent_low
    end,
    'contactEmail', other_email
  );
end;
$$;

revoke execute on function public.set_match_consent(uuid, boolean) from public, anon;
grant execute on function public.set_match_consent(uuid, boolean) to authenticated;

create or replace function public.get_trip_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_umass_user();
  own_trip public.trips;
  dashboard_matches jsonb;
begin
  select * into own_trip
  from public.trips
  where user_id = current_user_id
    and wait_until >= now();

  if own_trip.user_id is null then
    return jsonb_build_object('trip', null, 'matches', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(match_json order by match_json->>'overlapStart'), '[]'::jsonb)
  into dashboard_matches
  from (
    select jsonb_build_object(
      'id', matched.id,
      'overlapStart', matched.overlap_start,
      'overlapEnd', matched.overlap_end,
      'hasConsented', case when matched.user_low = current_user_id then matched.consent_low else matched.consent_high end,
      'otherHasConsented', case when matched.user_low = current_user_id then matched.consent_high else matched.consent_low end,
      'contactEmail', case
        when matched.consent_low and matched.consent_high then other_auth.email
        else null
      end,
      'otherTrip', jsonb_build_object(
        'arrivalAt', other_trip.arrival_at,
        'waitUntil', other_trip.wait_until
      )
    ) as match_json
    from public.matches matched
    join public.trips other_trip on other_trip.user_id = case
      when matched.user_low = current_user_id then matched.user_high else matched.user_low
    end
    join auth.users other_auth on other_auth.id = other_trip.user_id
    where current_user_id in (matched.user_low, matched.user_high)
      and matched.overlap_end > now()
      and exists (
        select 1 from public.trips low_trip, public.trips high_trip
        where low_trip.user_id = matched.user_low
          and high_trip.user_id = matched.user_high
          and low_trip.revision = matched.revision_low
          and high_trip.revision = matched.revision_high
      )
  ) visible_matches;

  return jsonb_build_object(
    'trip', public.trip_json(own_trip),
    'matches', dashboard_matches
  );
end;
$$;

revoke execute on function public.get_trip_dashboard() from public, anon;
grant execute on function public.get_trip_dashboard() to authenticated;

create or replace function public.claim_notification_batch(
  p_worker_id uuid,
  p_batch_size integer default 50,
  p_lease_seconds integer default 120
)
returns setof public.notification_outbox
language plpgsql
volatile
security definer
set search_path = ''
as $$
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

  return query
  with claimable as (
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
    limit least(greatest(p_batch_size, 1), 100)
  )
  update public.notification_outbox outbox
  set
    status = 'leased',
    attempt_count = outbox.attempt_count + 1,
    leased_until = now() + make_interval(secs => least(greatest(p_lease_seconds, 30), 900)),
    lease_token = p_worker_id,
    updated_at = now()
  from claimable
  where outbox.id = claimable.id
  returning outbox.*;
end;
$$;

create or replace function public.complete_notification(p_notification_id uuid, p_worker_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  update public.notification_outbox
  set status = 'sent', sent_at = now(), leased_until = null, lease_token = null, last_error = null, updated_at = now()
  where id = p_notification_id and status = 'leased' and lease_token = p_worker_id;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.notification_is_deliverable(
  p_notification_id uuid,
  p_worker_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  queued_notification public.notification_outbox;
  deliverable boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;

  select * into queued_notification
  from public.notification_outbox
  where id = p_notification_id
    and status = 'leased'
    and lease_token = p_worker_id
    and leased_until > now()
  for update;

  if queued_notification.id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.matches matched
    join public.trips low_trip on low_trip.user_id = matched.user_low
    join public.trips high_trip on high_trip.user_id = matched.user_high
    where matched.id = queued_notification.match_id
      and queued_notification.recipient_user_id in (matched.user_low, matched.user_high)
      and matched.overlap_end > now()
      and low_trip.revision = matched.revision_low
      and high_trip.revision = matched.revision_high
  ) into deliverable;

  if not deliverable then
    update public.notification_outbox
    set
      status = 'cancelled',
      leased_until = null,
      lease_token = null,
      updated_at = now()
    where id = queued_notification.id;
  end if;

  return deliverable;
end;
$$;

create or replace function public.fail_notification(
  p_notification_id uuid,
  p_worker_id uuid,
  p_error text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  update public.notification_outbox
  set
    status = case when attempt_count >= 10 then 'dead' else 'pending' end,
    available_at = case
      when attempt_count >= 10 then available_at
      else now() + make_interval(secs => least(3600, (power(2, greatest(attempt_count, 1)) * 30)::integer))
    end,
    leased_until = null,
    lease_token = null,
    last_error = left(coalesce(p_error, 'Unknown delivery error'), 2000),
    updated_at = now()
  where id = p_notification_id and status = 'leased' and lease_token = p_worker_id;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke execute on function public.claim_notification_batch(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.complete_notification(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fail_notification(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.notification_is_deliverable(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_notification_batch(uuid, integer, integer) to service_role;
grant execute on function public.complete_notification(uuid, uuid) to service_role;
grant execute on function public.fail_notification(uuid, uuid, text) to service_role;
grant execute on function public.notification_is_deliverable(uuid, uuid) to service_role;

revoke execute on function public.cancel_pending_match_notifications() from public, anon, authenticated;

comment on table public.airports is 'Generated from the public-domain OurAirports catalog.';
comment on table public.notification_outbox is 'Durable, lease-based delivery queue. Only the service role may access it.';
comment on function public.save_trip_and_find_matches(bigint, timestamptz, smallint) is 'Atomically saves one current trip and rebuilds all symmetric interval-overlap matches.';
