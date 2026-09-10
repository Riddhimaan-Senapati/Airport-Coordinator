# Airport Buddy

Airport Buddy helps UMass students find other travelers whose airport waiting windows overlap. The app supports active airports worldwide and keeps contact details private until both travelers consent.

The stack is Next.js 16, Supabase Auth, Postgres, Row Level Security, database functions, and a Supabase Edge Function.

## Run the app locally

Install Node.js 20.19 or later and Docker Desktop. Then run:

```powershell
npm install
npm run supabase:start
```

Copy the environment template:

```powershell
Copy-Item .env.example .env.local
```

Run `npx supabase status`. Copy the local API URL, publishable key, and service-role key into these `.env.local` fields:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Keep `APP_URL=http://localhost:3000`. Replace `MATCH_NOTIFICATION_WORKER_SECRET` with a long random value. The local app does not need a working Resend key unless you exercise the match-notification worker.

Apply the schema and load airports:

```powershell
npm run db:reset
npm run data:airports:import
npm run dev
```

Open these local services:

- App: `http://localhost:3000`
- Supabase Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`

Mailpit receives local Supabase Auth messages, including signup confirmations and password-reset links. Match notifications use the Resend API.

Stop the local stack with `npm run supabase:stop`.

## Manage the database

`npm run db:reset` destroys the local database, reapplies every migration in `supabase/migrations`, and leaves the airport table empty. Import the airport catalog again after each reset.

Run the database and application checks with:

```powershell
npm run db:test
npm run check
```

When the schema changes, regenerate `lib/database.types.ts` from the same Supabase instance before changing application callers.

## Refresh the airport catalog

The committed catalog comes from the public-domain OurAirports dataset. Refresh the generated file and import it:

```powershell
npm run data:airports:sync
npm run data:airports:import
```

The sync command downloads the current airport and country files. It derives an IANA timezone from each airport's coordinates and writes `data/airports.json`. The import command writes every batch to one immutable generation. After every batch succeeds, one database transaction changes the active-generation pointer. Searches continue using the prior complete generation until that change. The importer then removes unreferenced rows from older generations in bounded batches.

## Architecture

- Supabase Auth owns accounts, email confirmation, sessions, and password recovery. A Before User Created hook calls `public.restrict_signup_to_umass` so client-side validation cannot bypass the `@umass.edu` rule.
- Row Level Security lets users read only their own trip and matches in which they participate. The notification outbox is unavailable to browser clients.
- Transactional Postgres functions save trips, recalculate matches, record consent, and enqueue notifications. The transaction prevents a match from existing without its notification work.
- `pg_trgm` indexes power fuzzy airport search in Postgres. The browser receives at most ten results and never downloads the full catalog.
- The notification Edge Function claims leased outbox rows, sends mail through Resend, and records success or retry state. Each request uses the outbox ID as its Resend idempotency key, so a retry cannot send the same message twice. Schedule the worker outside request handling so failed messages remain recoverable.

Arrival times and waiting-window boundaries use Postgres `timestamptz` values. The server stores UTC instants. The browser formats those instants in the end user's local timezone.

## Deploy to production

Create a Supabase project and a separate hosting environment for the Next.js app. Do not reuse local keys or the local database.

1. Authenticate and link the repository:

   ```powershell
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```

2. Apply the committed schema:

   ```powershell
   npx supabase db push
   ```

3. In Supabase Auth, set the production Site URL and allow the app's `/auth/callback` URL. Keep email confirmations enabled. Configure the Before User Created hook to call `public.restrict_signup_to_umass`.

4. Configure custom SMTP for Auth messages. Verify the sender domain's SPF, DKIM, and DMARC records.

5. Set the production Next.js environment variables. Use the hosted project URL and publishable key. Keep the service-role key and worker secret server-only.

6. Import the current airport catalog with the production project URL and service-role key loaded in the shell:

   ```powershell
   npm run data:airports:sync
   npm run data:airports:import
   ```

7. Store the Edge Function secrets in Supabase and deploy the worker:

   ```powershell
   npx supabase secrets set MATCH_NOTIFICATION_WORKER_SECRET=<secret> RESEND_API_KEY=<key> EMAIL_FROM=<sender> APP_URL=https://<app-domain>
   npx supabase functions deploy process-match-notifications
   ```

8. Create a Supabase Cron job that sends a `POST` request to the deployed `process-match-notifications` function. Set its `Authorization` header to `Bearer <MATCH_NOTIFICATION_WORKER_SECRET>`. Run the job every minute and keep the secret out of migrations.

9. Run `npm run check` against production configuration in CI. Deploy the Next.js app only after the schema, airport import, Auth email, password recovery, and notification worker checks pass in staging.

Enable Supabase backups and point-in-time recovery before accepting real users. Perform a restore test and record the rollback procedure for both the database migration and the web deployment.
