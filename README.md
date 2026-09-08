# Airport Buddy

Airport Buddy helps UMass students find other students arriving at the same airport within a chosen wait time.

The project is one Next.js application. Next.js renders the pages and server endpoints, Better Auth manages verified accounts and cookie-backed sessions, Nodemailer sends verification messages, and the MongoDB driver stores application data.

## Requirements

- Node.js 20.19 or newer
- Docker Desktop, or separate MongoDB and SMTP services

## Run locally

1. Install the dependencies.

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env.local`.

3. Set `BETTER_AUTH_SECRET` to at least 32 random characters.

4. Start MongoDB and Mailpit.

   ```sh
   docker compose up -d --wait
   ```

5. Start the development server.

   ```sh
   npm run dev
   ```

6. Open `http://localhost:3000`. Development verification emails appear in Mailpit at `http://localhost:8025`.

## Check the project

Run every local check with one command.

```sh
npm run check
```

The command runs TypeScript, Oxlint, Oxfmt, Vitest, and the production build.

Use these commands to run one check:

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`

Run `npm run format` to format the repository with Oxfmt.

## Authentication

Registration accepts only the exact `@umass.edu` domain. New accounts must follow the email link before signing in. Better Auth rate-limits sign-in, sign-up, and verification-email requests.

This version uses Better Auth's `user`, `session`, `account`, and `verification` collections and the application's `trips` collection. The earlier prototype contained no production users, so its data can be discarded instead of migrated.

To remove all legacy and local test data, stop the application and run:

```sh
npm run data:reset -- --confirm=127.0.0.1:27017/airport-coordinator
```

The command loads `MONGODB_CONNECTION_URI` from the environment or `.env.local`, requires the exact host and database as confirmation, and drops only Airport Buddy's known collections. Remote databases also require `--allow-remote`. Better Auth and the trip service recreate their collections and indexes when the application is used again.
