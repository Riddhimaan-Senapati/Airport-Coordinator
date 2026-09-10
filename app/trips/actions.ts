"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getTextField } from "../../lib/form-data";
import { createClient } from "../../lib/supabase/server";
import { deleteTripForUser, saveTripAndFindMatches, setContactConsent } from "../../lib/trips";
import { contactConsentSchema, tripInputSchema } from "../../lib/validation";

export type TripActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/auth/signin");
}

export async function saveTrip(
  _state: TripActionState,
  formData: FormData,
): Promise<TripActionState> {
  await requireUser();
  const parsed = tripInputSchema.safeParse({
    airportId: formData.get("airportId"),
    arrivalAtUtc: formData.get("arrivalAtUtc"),
    waitHours: formData.get("waitHours"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the trip details.",
    };
  }

  try {
    await saveTripAndFindMatches({ trip: parsed.data });
    revalidatePath("/trips");
    return { status: "success", message: "Your trip is saved." };
  } catch {
    return { status: "error", message: "Could not save this trip. Try again." };
  }
}

export async function deleteTrip() {
  await requireUser();
  await deleteTripForUser();
  revalidatePath("/trips");
}

export async function changeContactConsent(formData: FormData) {
  await requireUser();
  const parsed = contactConsentSchema.safeParse({
    matchId: getTextField(formData, "matchId"),
    decision: getTextField(formData, "decision"),
  });
  if (!parsed.success) return;

  await setContactConsent({
    matchId: parsed.data.matchId,
    consent: parsed.data.decision === "accept",
  });
  revalidatePath("/trips");
}
