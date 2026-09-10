"use client";

import type { FormEvent } from "react";

import type { MatchView, TripDashboard as DashboardData } from "../../lib/trips";
import { changeContactConsent, deleteTrip } from "./actions";

export function TripDashboard({ dashboard }: { dashboard: DashboardData }) {
  if (!dashboard.trip) return null;

  function confirmCancellation(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Cancel this trip and remove its matches?")) {
      event.preventDefault();
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-secondary p-4" aria-labelledby="current-trip-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold" id="current-trip-heading">
              Your current trip
            </h2>
            <p className="mt-2">
              {dashboard.trip.airport.code} ·{" "}
              {new Date(dashboard.trip.arrivalAtUtc).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">
              Waiting up to {dashboard.trip.waitHours}{" "}
              {dashboard.trip.waitHours === 1 ? "hour" : "hours"}
            </p>
          </div>
          <form action={deleteTrip} onSubmit={confirmCancellation}>
            <button className="button-secondary" type="submit">
              Cancel trip
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="matches-heading">
        <h2 className="text-2xl font-semibold" id="matches-heading">
          Matches
        </h2>
        {dashboard.matches.length === 0 ? (
          <p className="rounded-md bg-secondary p-4">No matching travelers were found yet.</p>
        ) : (
          <div className="space-y-3">
            {dashboard.matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MatchCard({ match }: { match: MatchView }) {
  const decision =
    match.contact.status === "available" || match.contact.status === "requested"
      ? "accept"
      : "revoke";
  const label =
    match.contact.status === "available"
      ? "Request contact"
      : match.contact.status === "waiting"
        ? "Withdraw request"
        : match.contact.status === "requested"
          ? "Accept request"
          : "Stop sharing";

  return (
    <article className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium">UMass traveler at {match.airport.code}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(match.arrivalAtUtc).toLocaleString()} · {match.differenceMinutes} min apart
          </p>
          {match.contact.status === "waiting" ? (
            <p className="mt-2 text-sm text-muted-foreground">Waiting for approval.</p>
          ) : null}
          {match.contact.status === "requested" ? (
            <p className="mt-2 text-sm text-muted-foreground">This traveler wants to connect.</p>
          ) : null}
          {match.contact.status === "connected" ? (
            <a className="mt-2 block text-link" href={`mailto:${match.contact.email}`}>
              {match.contact.email}
            </a>
          ) : null}
        </div>
        <form action={changeContactConsent}>
          <input name="matchId" type="hidden" value={match.id} />
          <input name="decision" type="hidden" value={decision} />
          <button className="button-primary" type="submit">
            {label}
          </button>
        </form>
      </div>
    </article>
  );
}
