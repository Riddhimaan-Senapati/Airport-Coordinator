"use client";

import { useActionState } from "react";

import type { Match } from "../../lib/trips";
import { saveTrip, type TripActionState } from "./actions";

const initialState: TripActionState = { status: "idle" };

export function TripForm() {
  const [state, action, pending] = useActionState(saveTrip, initialState);

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-5">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Arrival date and time</span>
          <input className="field" name="arrivalAtLocal" type="datetime-local" required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Airport</span>
          <select className="field" name="airportCode" defaultValue="" required>
            <option value="" disabled>
              Select an airport
            </option>
            <option value="BOS">Boston Logan International Airport</option>
            <option value="JFK">John F. Kennedy International Airport</option>
            <option value="EWR">Newark Liberty International Airport</option>
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Maximum wait time in hours</span>
          <input
            className="field"
            name="waitHours"
            type="number"
            min="1"
            max="24"
            step="1"
            defaultValue="1"
            required
          />
        </label>
        {state.status === "error" ? (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
            {state.message}
          </p>
        ) : null}
        <button className="button-primary w-full" type="submit" disabled={pending}>
          {pending ? "Saving and finding matches..." : "Save trip and find matches"}
        </button>
      </form>

      {state.status === "success" ? <MatchResults matches={state.matches} /> : null}
    </div>
  );
}

function MatchResults({ matches }: { matches: Match[] }) {
  if (matches.length === 0) {
    return (
      <output className="block rounded-md bg-secondary p-4">
        Your trip was saved. No matching travelers were found yet.
      </output>
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="matches-heading">
      <h2 className="text-2xl font-semibold" id="matches-heading">
        Matching travelers
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3">Email</th>
              <th className="p-3">Arrival</th>
              <th className="p-3">Airport</th>
              <th className="p-3">Difference</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr className="border-b" key={match.tripId}>
                <td className="p-3">
                  <a className="text-link" href={`mailto:${match.email}`}>
                    {match.email}
                  </a>
                </td>
                <td className="p-3">{new Date(match.arrivalAtUtc).toLocaleString()}</td>
                <td className="p-3">{match.airportCode}</td>
                <td className="p-3">{match.differenceMinutes} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
