import "server-only";

import { z } from "zod";

import { createClient } from "./supabase/server";
import type { TripInput } from "./validation";

const HOUR_IN_MILLISECONDS = 3_600_000;
const MINUTE_IN_MILLISECONDS = 60_000;

type ArrivalWindowInput = { start: Date; waitHours: number };
export type ArrivalWindow = { start: Date; end: Date };

export function createArrivalWindow({ start, waitHours }: ArrivalWindowInput): ArrivalWindow {
  return { start, end: new Date(start.getTime() + waitHours * HOUR_IN_MILLISECONDS) };
}

export function arrivalWindowsOverlap(left: ArrivalWindow, right: ArrivalWindow) {
  return left.start <= right.end && right.start <= left.end;
}

export function arrivalWindowIsActive(end: Date, now = new Date()) {
  return end > now;
}

export type TripAirport = {
  id: number;
  code: string;
  name: string;
  municipality: string | null;
  countryCode: string;
  timezone: string | null;
  latitude: number;
  longitude: number;
};

export type TripView = {
  id: string;
  airport: TripAirport;
  arrivalAtUtc: string;
  waitHours: number;
};

export type MatchContact =
  | { status: "available" }
  | { status: "waiting" }
  | { status: "requested" }
  | { status: "connected"; email: string };

export type MatchView = {
  id: string;
  airport: TripAirport;
  arrivalAtUtc: string;
  differenceMinutes: number;
  contact: MatchContact;
};

export type TripDashboard = { trip: TripView | null; matches: MatchView[] };

const instantSchema = z.iso.datetime({ offset: true });
const airportSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().min(1),
  name: z.string().min(1),
  municipality: z.string().nullable(),
  countryCode: z.string().length(2),
  timezone: z.string().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
const rpcTripSchema = z.object({
  id: z.uuid(),
  airport: airportSchema,
  arrivalAt: instantSchema,
  waitHours: z.number().int().min(1).max(24),
  waitUntil: instantSchema,
  revision: z.number().int().positive(),
});
const rpcMatchSchema = z
  .object({
    id: z.uuid(),
    overlapStart: instantSchema,
    overlapEnd: instantSchema,
    hasConsented: z.boolean(),
    otherHasConsented: z.boolean(),
    contactEmail: z.email().nullable(),
    otherTrip: z.object({ arrivalAt: instantSchema, waitUntil: instantSchema }),
  })
  .refine(
    (match) =>
      match.hasConsented && match.otherHasConsented
        ? match.contactEmail !== null
        : match.contactEmail === null,
    { message: "Contact disclosure does not match the consent state." },
  );
const rpcDashboardSchema = z
  .object({
    trip: rpcTripSchema.nullable(),
    matches: z.array(rpcMatchSchema),
  })
  .refine((dashboard) => dashboard.trip !== null || dashboard.matches.length === 0, {
    message: "A dashboard without a trip cannot contain matches.",
  });

type RpcMatch = z.infer<typeof rpcMatchSchema>;
type Disclosure = Pick<RpcMatch, "hasConsented" | "otherHasConsented" | "contactEmail">;

export function contactFromDisclosure(match: Disclosure): MatchContact {
  if (match.hasConsented && match.otherHasConsented && match.contactEmail) {
    return { status: "connected", email: match.contactEmail };
  }
  if (match.hasConsented) return { status: "waiting" };
  if (match.otherHasConsented) return { status: "requested" };
  return { status: "available" };
}

export function mapTripDashboard(value: unknown): TripDashboard {
  const dashboard = rpcDashboardSchema.parse(value);
  if (!dashboard.trip) return { trip: null, matches: [] };

  const trip = dashboard.trip;
  return {
    trip: {
      id: trip.id,
      airport: trip.airport,
      arrivalAtUtc: trip.arrivalAt,
      waitHours: trip.waitHours,
    },
    matches: dashboard.matches.map((match) => ({
      id: match.id,
      airport: trip.airport,
      arrivalAtUtc: match.otherTrip.arrivalAt,
      differenceMinutes: Math.round(
        Math.abs(
          new Date(match.otherTrip.arrivalAt).getTime() - new Date(trip.arrivalAt).getTime(),
        ) / MINUTE_IN_MILLISECONDS,
      ),
      contact: contactFromDisclosure(match),
    })),
  };
}

export async function saveTripAndFindMatches({ trip }: { trip: TripInput }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_trip_and_find_matches", {
    p_airport_id: trip.airportId,
    p_arrival_at: trip.arrivalAtUtc.toISOString(),
    p_wait_hours: trip.waitHours,
  });
  if (error) throw error;
}

export async function getTripDashboard(): Promise<TripDashboard> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_trip_dashboard");
  if (error) throw error;
  return mapTripDashboard(data);
}

export async function deleteTripForUser() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_trip");
  if (error) throw error;
}

export async function setContactConsent({
  matchId,
  consent,
}: {
  matchId: string;
  consent: boolean;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_match_consent", {
    p_match_id: matchId,
    p_consented: consent,
  });
  if (error) throw error;
}
