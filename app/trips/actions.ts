"use server";

import { ObjectId } from "mongodb";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "../../lib/auth";
import { takeTripSearchSlot } from "../../lib/trip-rate-limit";
import { saveTripAndFindMatches, type Match } from "../../lib/trips";
import { tripInputSchema } from "../../lib/validation";

export type TripActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; matches: Match[] };

export async function saveTrip(
  _state: TripActionState,
  formData: FormData,
): Promise<TripActionState> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user.id || !ObjectId.isValid(session.user.id)) {
    redirect("/auth/signin");
  }

  const arrivalValue = formData.get("arrivalAtLocal");
  const arrival = typeof arrivalValue === "string" ? new Date(arrivalValue) : null;
  const parsed = tripInputSchema.safeParse({
    airportCode: formData.get("airportCode"),
    arrivalAtUtc:
      arrival && !Number.isNaN(arrival.getTime()) ? arrival.toISOString() : arrivalValue,
    waitHours: formData.get("waitHours"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the trip details.",
    };
  }

  try {
    if (!(await takeTripSearchSlot(session.user.id))) {
      return { status: "error", message: "Too many searches. Wait a minute and try again." };
    }
    const matches = await saveTripAndFindMatches({
      userId: session.user.id,
      trip: parsed.data,
    });
    return { status: "success", matches };
  } catch {
    return { status: "error", message: "Could not finish this request. Try again." };
  }
}
