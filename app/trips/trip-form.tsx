"use client";

import { useActionState, useEffect, useRef } from "react";

import { localDateTimeToUtc, utcToLocalDateTimeInput } from "../../lib/date-time";
import type { TripView } from "../../lib/trips";
import { saveTrip, type TripActionState } from "./actions";
import { AirportCombobox } from "./airport-combobox";

const initialState: TripActionState = { status: "idle" };

async function saveTripFromBrowser(
  previousState: TripActionState,
  formData: FormData,
): Promise<TripActionState> {
  const arrivalAtUtc = localDateTimeToUtc(formData.get("arrivalAtLocal"));
  if (!arrivalAtUtc) {
    return { status: "error", message: "Choose a valid arrival date and time." };
  }

  formData.set("arrivalAtUtc", arrivalAtUtc);
  formData.delete("arrivalAtLocal");
  return saveTrip(previousState, formData);
}

export function TripForm({ trip }: { trip: TripView | null }) {
  const [state, action, pending] = useActionState(saveTripFromBrowser, initialState);
  const arrivalInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (arrivalInput.current) {
      arrivalInput.current.value = trip ? utcToLocalDateTimeInput(trip.arrivalAtUtc) : "";
    }
  }, [trip]);

  return (
    <form action={action} className="space-y-5">
      <label className="block space-y-2">
        <span className="text-sm font-medium">Arrival date and time</span>
        <input
          className="field"
          name="arrivalAtLocal"
          ref={arrivalInput}
          type="datetime-local"
          required
        />
      </label>
      <AirportCombobox key={trip?.airport.id ?? "new"} initialAirport={trip?.airport} />
      <label className="block space-y-2">
        <span className="text-sm font-medium">Maximum wait time in hours</span>
        <input
          className="field"
          name="waitHours"
          type="number"
          min="1"
          max="24"
          step="1"
          defaultValue={trip?.waitHours ?? 1}
          required
        />
      </label>
      {state.status !== "idle" ? (
        <p
          className={`rounded-md p-3 text-sm ${
            state.status === "error" ? "bg-red-50 text-red-700" : "bg-secondary"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
      <button className="button-primary w-full" type="submit" disabled={pending}>
        {pending ? "Saving..." : trip ? "Update trip" : "Save trip and find matches"}
      </button>
    </form>
  );
}
