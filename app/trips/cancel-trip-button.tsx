"use client";

import type { FormEvent } from "react";

import { deleteTrip } from "./actions";

const CANCELLATION_PROMPT = "Cancel this trip and remove its matches?";

export function confirmTripCancellation(
  event: Pick<FormEvent<HTMLFormElement>, "preventDefault">,
  confirm: (prompt: string) => boolean,
) {
  if (!confirm(CANCELLATION_PROMPT)) {
    event.preventDefault();
  }
}

export function CancelTripButton() {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    confirmTripCancellation(event, (prompt) => window.confirm(prompt));
  }

  return (
    <form action={deleteTrip} onSubmit={onSubmit}>
      <button className="button-secondary" type="submit">
        Cancel trip
      </button>
    </form>
  );
}
