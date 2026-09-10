# Airport Buddy codebase optimization plan

This program reduces shipped browser code, repeated authenticated request work, peak import memory, and notification latency.
It preserves the current Supabase migration and treats the working tree as the source of truth.
The stack runs AC-01 through AC-05 in order.
The operator reviews and lands the stack.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The pstack skill tree is the installed vendor tree at `~/.config/opencode/vendor/pstack/pstack/skills/`, and every `pstack/skills/...` path in this plan resolves under it. The program runs the `poteto-mode/playbooks/autopilot-stack.md` playbook from that tree. Owners stop at merge-ready. The operator reviews and lands AC-01 through AC-05 from the bottom of the stack.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on her explicit go.
- [ ] On her go, arm a `/goal` with this exact text. "Run `docs/codebase-optimization-plan.md` in AC-01 through AC-05 order. Verify every PR with unit, live, and perf evidence. Stop each PR at merge-ready. The operator merges. Finish when all five PRs are verified and stacked."
- [ ] Read these at program start. Read them again at every audit tick.
  - [ ] The plan from trunk. `git show origin/main:docs/codebase-optimization-plan.md`
  - [ ] The installed execution playbook at `~/.config/opencode/vendor/pstack/pstack/skills/poteto-mode/playbooks/autopilot-stack.md`.
  - [ ] The installed swarm skill at `~/.config/opencode/vendor/pstack/pstack/skills/swarm/SKILL.md`.
  - [ ] The installed PR playbook at `~/.config/opencode/vendor/pstack/pstack/skills/poteto-mode/playbooks/opening-a-pr.md`.
  - [ ] The installed prove-it-works and sequence-verifiable-units skills under `~/.config/opencode/vendor/pstack/pstack/skills/`.
- [ ] Arm the 30-minute audit tick.
- [ ] Use this tick prompt. "Read the execution playbook and the goal. Audit each active PR by its artifacts. Replace a stuck lane. Send a status message with each PR, owner, state, head SHA, verdict, operator gate, and blocker."
- [ ] On an operator hold, send every owner a zero-writes order.

### Spawn owners

- [ ] Spawn one owner per active PR on `openrouter/deepseek/deepseek-v4.1-flash`.
- [ ] Start AC-01 from `main`. Stack AC-02 on AC-01, AC-03 on AC-02, AC-04 on AC-03, and AC-05 on AC-04.
- [ ] Keep each owner inside the files named by its PR.
- [ ] Hold the review gate. AC-02 changes rendered ownership and confirmation behavior. It waits for operator review.

### PR mechanics

- [ ] Resolve the forge once. Use `origin pr` when Origin resolves the repository. Otherwise use `gh` and record the fallback.
- [ ] Open each PR ready. Never open it as a draft. A child targets its parent branch.
- [ ] Run `npm run lint` and `npm run typecheck` before the PR-facing push.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Triage each automated review finding on its evidence.
- [ ] Rebase onto the current parent before the merge-ready report.

### Verdict and merge

- [ ] At each merge-ready head SHA, run the verification swarm with `openrouter/deepseek/deepseek-v4.1-flash` workers.
- [ ] Mark a verdict clean only when every lane passes. Send findings back to the owner and verify each new head again.
- [ ] Append a clean PR to the stack. Never merge it. Preserve a clean verdict after rebases only when the patch ID stays unchanged.

### Boot recipe

Each live lane runs at the PR head and drives the browser through the available computer-use skill. Command lanes capture their terminal result as a screenshot.

- [ ] Check out the exact head SHA.
- [ ] Run `npm ci`, `npm run supabase:start`, `npm run db:reset`, and `npm run data:airports:import` when the lane needs database data.
- [ ] Start `npm run dev` and wait for `/api/health` to return 200.
- [ ] Save each screenshot under `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png`.

## Establish a smaller measured base (AC-01)

**Depends on.** None.

**Files.**

- [ ] Create `scripts/perf-baseline.mjs`.
- [ ] Edit `package.json`, `tsconfig.json`, `lib/trips.ts`, `tests/trips.test.ts`, and `.gitignore`.

**Build.**

- [ ] Add one rerunnable command that records build time, static client bytes, server output bytes, source lines, and peak RSS for a child command. Delete the unused TypeScript arrival-window helpers after the SQL tests cover the same boundaries. Narrow TypeScript inputs to active source roots. Leave `allowJs` alone, because Next.js re-adds it on every build. Ignore the generated airport catalog.

**You see.**

- [ ] `npm run perf:baseline` writes one JSON report. The report starts from 3,676 source lines, 1,291,125 static client bytes, and 22,113,346 server output bytes unless a clean rebuild changes those values.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Keep inclusive overlap and expiry coverage in `supabase/tests/database/airport_buddy.sql`. Run `npm test` and `npm run db:test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `inherit-parent` at the PR head, with the `swarm workers` role overridden to `openrouter/deepseek/deepseek-v4.1-flash`, the same model as the parent session.

- [ ] Lane 1. Regression lane against trunk. Open `/trips` on trunk and head. Save `ac01-trips.png`. Pass when both render the same trip and match states.
- [ ] Lane 2. Run signup and email validation. Save `ac01-signup.png`. Pass when invalid domains remain blocked.
- [ ] Lane 3. Save a trip with a boundary overlap. Save `ac01-overlap.png`. Pass when the match appears.
- [ ] Lane 4. Load an expired trip. Save `ac01-expired.png`. Pass when the dashboard omits it.
- [ ] Lane 5. Run `npm run typecheck`. Save `ac01-typecheck.png`. Pass when it exits zero and scans no stale frontend tree.
- [ ] Lane 6. Run `npm run lint`. Save `ac01-lint.png`. Pass when it exits zero.
- [ ] Lane 7. Run `npm run format:check`. Save `ac01-format.png`. Pass when it exits zero.
- [ ] Lane 8. Run `npm test`. Save `ac01-tests.png`. Pass when all application tests pass.
- [ ] Lane 9. Run `npm run db:test`. Save `ac01-db-tests.png`. Pass when all database tests pass.
- [ ] Lane 10. Run `npm run build`. Save `ac01-build.png`. Pass when Next.js builds every route.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Record source lines, client bytes, server bytes, build time, and peak RSS on trunk and head.
- [ ] Probe. Run `npm run perf:baseline` three times on trunk and head in alternating order.
- [ ] Baseline. Record the trunk median before judging the head.
- [ ] Rule. Fail when non-measurement source lines increase, client or server bytes grow over 1 percent, or median build time regresses over 5 percent.

**Review gate.** None. AC-01 is not review-gated.

**Merge.**

- [ ] Record the root clean verdict at the exact head SHA, finish automated review triage, and append AC-01 to the stack.

## Shrink the browser boundary (AC-02)

**Depends on.** AC-01.

**Files.**

- [ ] Edit `app/trips/trip-dashboard.tsx` and `app/auth/signup/signup-form.tsx`.
- [ ] Create `app/trips/cancel-trip-button.tsx` and focused boundary tests.

**Build.**

- [ ] Render the dashboard and match cards as Server Components. Keep only cancellation confirmation in a small Client Component. Remove the `emailSchema` import from the signup Client Component so Zod leaves the client graph. Keep the database signup hook as the authority for the UMass domain rule.

**You see.**

- [ ] The trips and signup screens behave the same. The signup client graph no longer contains Zod, and the dashboard data is not passed into a Client Component.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add boundary tests for the cancellation control and the UMass signup message. Run `npm test` and `npm run build`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `inherit-parent` at the PR head, with the `swarm workers` role overridden to `openrouter/deepseek/deepseek-v4.1-flash`, the same model as the parent session.

- [ ] Lane 1. Regression lane against trunk. Open the same populated dashboard on trunk and head. Save `ac02-dashboard.png`. Pass when trip and contact states match.
- [ ] Lane 2. Cancel a trip and reject the confirmation. Save `ac02-cancel-reject.png`. Pass when the trip remains.
- [ ] Lane 3. Cancel a trip and accept the confirmation. Save `ac02-cancel-accept.png`. Pass when the trip disappears.
- [ ] Lane 4. Request contact sharing. Save `ac02-request.png`. Pass when the waiting state appears.
- [ ] Lane 5. Accept a contact request. Save `ac02-accept.png`. Pass when the email appears only after mutual consent.
- [ ] Lane 6. Revoke contact sharing. Save `ac02-revoke.png`. Pass when the email disappears.
- [ ] Lane 7. Submit a non-UMass signup. Save `ac02-domain.png`. Pass when signup fails with the expected message.
- [ ] Lane 8. Submit mismatched passwords. Save `ac02-password.png`. Pass when the browser blocks submission.
- [ ] Lane 9. Navigate with JavaScript enabled. Save `ac02-hydration.png`. Pass when the console has no hydration error.
- [ ] Lane 10. Run the production bundle analyzer. Save `ac02-analyzer.png`. Pass when the route graph contains only the intended client islands.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Record compressed and uncompressed client bytes for `/trips` and `/auth/signup`, plus the RSC payload for a 50-match dashboard.
- [ ] Probe. Run `npx next experimental-analyze --output` on trunk and head, then load each route three times in alternating order.
- [ ] Baseline. Record trunk route bytes and hydration duration first. The current build contains a 392,318-byte client chunk with Zod.
- [ ] Rule. Fail when signup client bytes do not fall by at least 20 percent, trips client bytes do not fall by at least 5 percent, or interaction latency regresses over 5 percent.

**Review gate.** The operator reviews before merge.

- [ ] Copy the dashboard, cancellation, and signup screenshots into `docs/media/ac02-review-*.png`.
- [ ] Record a 30 to 60 second video of save, consent, and cancellation. Save it as `docs/media/ac02-review.mp4`.
- [ ] Post the screenshots and video to the operator. Stop at merge-ready.

**Merge.**

- [ ] Record the root clean verdict at the exact head SHA, finish automated review triage, and append AC-02 to the stack after operator approval.

## Remove repeated authenticated request work (AC-03)

**Depends on.** AC-02.

**Files.**

- [ ] Edit `lib/supabase/server.ts`, `lib/supabase/proxy.ts`, `app/trips/page.tsx`, `app/trips/actions.ts`, `app/api/airports/route.ts`, `app/trips/airport-combobox.tsx`, and `lib/trips.ts`.
- [ ] Create one client-safe Supabase public-config module only if it produces a net line reduction.

**Build.**

- [ ] Fetch current Supabase SSR documentation through Context7 before editing. Reuse one authenticated Supabase client within each request. Use claims for identity-only guards only when the current documentation and local JWT configuration support it. Stop one-character airport queries in the browser before they reach the route.

**You see.**

- [ ] A dashboard load performs one identity check and one dashboard RPC. An airport query shorter than two trimmed characters performs no request.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add request-count tests for dashboard loading, each server action, and airport query length. Run `npm test`, `npm run db:test`, and `npm run build`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `inherit-parent` at the PR head, with the `swarm workers` role overridden to `openrouter/deepseek/deepseek-v4.1-flash`, the same model as the parent session.

- [ ] Lane 1. Regression lane against trunk. Load `/trips` with the same account. Save `ac03-trips.png`. Pass when the head shows the same data with fewer upstream calls.
- [ ] Lane 2. Type one airport character. Save `ac03-one-char.png`. Pass when no airport request appears.
- [ ] Lane 3. Type an exact IATA code. Save `ac03-iata.png`. Pass when one settled request returns the right airport.
- [ ] Lane 4. Type a city name and then erase it. Save `ac03-abort.png`. Pass when stale results never replace the empty state.
- [ ] Lane 5. Save a trip. Save `ac03-save.png`. Pass when one business RPC succeeds.
- [ ] Lane 6. Delete a trip. Save `ac03-delete.png`. Pass when one business RPC succeeds.
- [ ] Lane 7. Accept contact sharing. Save `ac03-consent.png`. Pass when one business RPC succeeds.
- [ ] Lane 8. Let a session refresh. Save `ac03-refresh.png`. Pass when the refreshed cookies reach the response.
- [ ] Lane 9. Open a protected route while signed out. Save `ac03-redirect.png`. Pass when the app redirects to signin.
- [ ] Lane 10. Complete signin, callback, and signout. Save `ac03-auth-cycle.png`. Pass when the full cookie lifecycle works.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Count Auth and PostgREST calls per interaction and record p50 and p95 route latency.
- [ ] Probe. Add request IDs and temporary timing logs, then replay dashboard, search, save, delete, and consent on trunk and head.
- [ ] Baseline. Record trunk call counts and 30-run latency distributions first.
- [ ] Rule. Fail when one-character search makes a request, a server action creates more than one Supabase client, or authenticated route p95 does not improve by at least 15 percent without an error-rate increase.

**Review gate.** None. AC-03 is not review-gated.

**Merge.**

- [ ] Record the root clean verdict at the exact head SHA, finish automated review triage, and append AC-03 to the stack.

## Stream the airport catalog import (AC-04)

**Depends on.** AC-03.

**Files.**

- [ ] Replace `scripts/sync-airports.mjs` and `scripts/import-airports-to-supabase.mjs` with one bounded-memory import path.
- [ ] Edit `package.json`, `README.md`, `.gitignore`, and `tests/airports.test.ts`.
- [ ] Delete the generated `data/airports.json` workflow after the replacement passes.

**Build.**

- [ ] Stream the countries input into a small country map. Stream airport rows through normalization and 1,000-row Supabase batches. Preserve immutable generations, atomic activation, bounded pruning, and deterministic test fixtures. Do not retain all parsed rows or write the 10,138,888-byte intermediate file.

**You see.**

- [ ] One command downloads, normalizes, imports, activates, and prunes the catalog. Progress reports imported rows and peak RSS stays bounded as the airport input grows.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add chunk-boundary, quoted-field, malformed-row, retry, failed-batch, activation, and pruning tests. Run `npm test` and `npm run db:test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `inherit-parent` at the PR head, with the `swarm workers` role overridden to `openrouter/deepseek/deepseek-v4.1-flash`, the same model as the parent session.

- [ ] Lane 1. Regression lane against trunk. Import the same pinned fixtures. Save `ac04-import.png`. Pass when both produce the same active rows.
- [ ] Lane 2. Import the current public catalog. Save `ac04-current.png`. Pass when activation completes.
- [ ] Lane 3. Search an IATA code after import. Save `ac04-iata.png`. Pass when the expected airport appears.
- [ ] Lane 4. Search a city after import. Save `ac04-city.png`. Pass when relevant results appear.
- [ ] Lane 5. Fail a middle batch. Save `ac04-failed-batch.png`. Pass when the prior generation stays active.
- [ ] Lane 6. Retry the failed import. Save `ac04-retry.png`. Pass when one new generation becomes active.
- [ ] Lane 7. Interrupt the process. Save `ac04-interrupt.png`. Pass when no partial generation becomes active.
- [ ] Lane 8. Run pruning twice. Save `ac04-prune.png`. Pass when the second run removes zero rows.
- [ ] Lane 9. Import a quoted multiline fixture across stream chunks. Save `ac04-csv.png`. Pass when fields remain exact.
- [ ] Lane 10. Inspect the working tree. Save `ac04-artifact.png`. Pass when no generated airport catalog appears.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Record peak RSS, elapsed time, bytes read, rows imported, and intermediate disk bytes.
- [ ] Probe. Run the pinned catalog import on trunk and head three times in alternating order through `npm run perf:baseline`.
- [ ] Baseline. Record trunk peak RSS and elapsed time first with the current 72,553-row catalog.
- [ ] Rule. Fail when head peak RSS exceeds 128 MB, intermediate disk bytes exceed 1 MB, imported rows differ, or median elapsed time regresses over 10 percent.

**Review gate.** None. AC-04 is not review-gated.

**Merge.**

- [ ] Record the root clean verdict at the exact head SHA, finish automated review triage, and append AC-04 to the stack.

## Collapse notification delivery round trips (AC-05)

**Depends on.** AC-04.

**Files.**

- [ ] Add a focused Supabase migration for the notification claim projection and any proven partial index.
- [ ] Edit `supabase/functions/process-match-notifications/index.ts` and `supabase/tests/database/airport_buddy.sql`.

**Build.**

- [ ] Return only delivery-ready claim data, including the recipient address, from one service-role RPC. Remove the per-item Auth lookup and deliverability RPC when the transaction can prove eligibility. Process at bounded concurrency between four and eight. Preserve leases, completion ownership, retries, cancellation, and the Resend idempotency key.

**You see.**

- [ ] A 50-item batch no longer performs roughly four serial remote operations per item. The result reports claimed, sent, failed, and cancelled counts.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add lease-expiry, cancellation, retry, idempotency, mixed-result, and concurrent-worker tests. Run `npm run db:test`, Edge Function tests, and `npm run check`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `inherit-parent` at the PR head, with the `swarm workers` role overridden to `openrouter/deepseek/deepseek-v4.1-flash`, the same model as the parent session.

- [ ] Lane 1. Regression lane against trunk. Deliver one notification on trunk and head. Save `ac05-single.png`. Pass when both deliver once.
- [ ] Lane 2. Deliver a 10-item batch. Save `ac05-ten.png`. Pass when all rows complete.
- [ ] Lane 3. Deliver a 50-item batch. Save `ac05-fifty.png`. Pass when the lease retains at least 20 seconds of slack.
- [ ] Lane 4. Run two workers. Save `ac05-workers.png`. Pass when no row is delivered twice.
- [ ] Lane 5. Cancel a match after claim. Save `ac05-cancel.png`. Pass when no email is sent.
- [ ] Lane 6. Return a Resend 429. Save `ac05-rate-limit.png`. Pass when the row returns to retry state.
- [ ] Lane 7. Return a Resend 500. Save `ac05-server-error.png`. Pass when the failure count and retry metadata update.
- [ ] Lane 8. Expire a lease during work. Save `ac05-lease.png`. Pass when a stale worker cannot complete the row.
- [ ] Lane 9. Replay the same outbox ID. Save `ac05-idempotency.png`. Pass when Resend receives the same idempotency key and sends once.
- [ ] Lane 10. Drain a mixed queue. Save `ac05-mixed.png`. Pass when each row reaches the correct terminal or retry state.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Record total batch time, remote calls, peak RSS, lease slack, throughput, and duplicate sends for 1, 10, and 50 items.
- [ ] Probe. Run a deterministic fake Resend service with fixed 50 ms, 250 ms, and 1,000 ms latency on trunk and head.
- [ ] Baseline. Record trunk batch distributions and queue query plans first.
- [ ] Rule. Fail when a 50-item batch exceeds 90 seconds, lease slack falls below 20 seconds, peak RSS grows over 10 MB, or any duplicate send occurs.

**Review gate.** None. AC-05 is not review-gated.

**Merge.**

- [ ] Record the root clean verdict at the exact head SHA, finish automated review triage, and append AC-05 to the stack.

## Close the program

- [ ] Check every box above with a file, log, screenshot, test run, metric report, or SHA.
- [ ] Report the verified stack root and tip, each verdict, measured code deletion, client-byte change, peak-RSS change, route-latency change, and notification-throughput change.

## Appendix A. Prototype evidence

No implementation prototype ran because the operator asked for a plan only. The read-only baseline passed `npm run check` with 33 tests. The production build produced 1,291,125 static client bytes and 22,113,346 server output bytes. The signup client graph contains the 392,318-byte chunk that includes Zod.

The database query plans, request counts, route percentiles, importer peak RSS, and notification batch distribution remain unproven. AC-01 records the common baseline. AC-03 through AC-05 measure each domain before changing it.

## Appendix B. Alternatives rejected

- Removing the direct `tailwindcss` dependency lost. The official PostCSS setup has not proved that relying on the plugin's transitive dependency is supported.
- Adding `optimizePackageImports` lost. The app already imports Heroicons through a narrow subpath, and analyzer evidence does not show a package-import problem.
- Adding GiST, functional airport, or leased-notification indexes lost. Each index remains conditional on `EXPLAIN (ANALYZE, BUFFERS)` from representative data.
- Caching authenticated route output lost. Trip and consent state is private and changes after server actions. Removing duplicate work is safer than caching the result.
- Unbounded `Promise.all` in the notification worker lost. It risks Resend throttling, lease races, and memory spikes.

## Appendix C. Risks

- AC-01 touches a dirty Supabase migration. Rebase it only after the current migration is accepted. Never discard operator changes.
- AC-02 can break confirmation, hydration, or contact-state rendering. The operator review gate covers those interactions.
- AC-03 can break cookie refresh or weaken authentication. Keep proxy cookie propagation and verify the full auth lifecycle.
- AC-04 can activate an incomplete catalog. Preserve immutable generations and activate only after every batch succeeds.
- AC-05 can duplicate email or expire a lease. Preserve idempotency and completion ownership before adding concurrency.
- The installed checker at `~/.config/opencode/vendor/pstack/pstack/skills/poteto-mode/scripts/check-plan.mjs` requires the exact phrase Ten lanes on inherit-parent at the PR head in every live block. inherit-parent is the default role binding. The operator override sets the swarm workers role and the poteto-agent model to `openrouter/deepseek/deepseek-v4.1-flash`, recorded in the pstack model config.

## Appendix D. Links and reading list

- Read the [Next.js Server and Client Components guide](https://github.com/vercel/next.js/blob/canary/docs/01-app/01-getting-started/05-server-and-client-components.mdx) before AC-02.
- Read the [Next.js package bundling guide](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/package-bundling.mdx) before AC-02. Use `npx next experimental-analyze --output` for a saved Turbopack analysis.
- Read the [Next.js 16 upgrade guide](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/upgrading/version-16.mdx) before setting route metrics. Next.js 16 removed First Load JS from build output, so use route and browser measurements.
- Run Context7 for current `@supabase/ssr` documentation before AC-03 and AC-05. The resolved library ID is `/supabase/ssr`. Its docs state that `getUser()` makes one network call to the auth server, that `getSession()` reads the cookie with no network call, and that `getClaims()` validates a JWT locally in tokens-only mode. AC-03 relies on that distinction for a claims-based identity guard.
- The Next.js library ID is `/vercel/next.js`. Its Server and Client Components guide confirms that Server Component code never ships to the browser and that only serializable props cross into a Client Component. The `next experimental-analyze` command exists in this repo and takes `--output`, and it is Turbopack-only.
- Apply the `how` skill to AC-03 and AC-05. Use the `interrogate` skill before AC-05 changes the worker contract.
- Keep the execution trail per the `show-me-your-work` skill.
