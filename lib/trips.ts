import { ObjectId } from "mongodb";

import { getDatabase } from "./db";
import type { AirportCode, TripInput } from "./validation";

const HOUR_IN_MILLISECONDS = 3_600_000;

type ArrivalWindowInput = {
  start: Date;
  waitHours: number;
};

export function createArrivalWindow({ start, waitHours }: ArrivalWindowInput) {
  return {
    start,
    end: new Date(start.getTime() + waitHours * HOUR_IN_MILLISECONDS),
  };
}

type TripRecord = {
  _id: ObjectId;
  userId: ObjectId;
  airportCode: AirportCode;
  arrivalAtUtc: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type Match = {
  tripId: string;
  email: string;
  airportCode: AirportCode;
  arrivalAtUtc: string;
  differenceMinutes: number;
};

let indexesReady: Promise<unknown> | undefined;

async function trips() {
  const collection = (await getDatabase()).collection<TripRecord>("trips");
  indexesReady ??= Promise.all([
    collection.createIndex({ userId: 1 }, { unique: true }),
    collection.createIndex({ airportCode: 1, arrivalAtUtc: 1 }),
  ]);
  try {
    await indexesReady;
  } catch (error) {
    indexesReady = undefined;
    throw error;
  }
  return collection;
}

type SaveTripInput = {
  userId: string;
  trip: TripInput;
};

export async function saveTripAndFindMatches({ userId, trip }: SaveTripInput) {
  const userObjectId = new ObjectId(userId);
  const collection = await trips();
  const now = new Date();

  await collection.updateOne(
    { userId: userObjectId },
    {
      $set: {
        airportCode: trip.airportCode,
        arrivalAtUtc: trip.arrivalAtUtc,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  const window = createArrivalWindow({ start: trip.arrivalAtUtc, waitHours: trip.waitHours });
  const matchingTrips = await collection
    .find({
      userId: { $ne: userObjectId },
      airportCode: trip.airportCode,
      arrivalAtUtc: { $gte: window.start, $lte: window.end },
    })
    .sort({ arrivalAtUtc: 1, _id: 1 })
    .limit(50)
    .toArray();

  const database = await getDatabase();
  const matchingUsers = await database
    .collection<{ _id: ObjectId; email: string }>("user")
    .find({ _id: { $in: matchingTrips.map((match) => match.userId) } })
    .project({ email: 1 })
    .toArray();
  const emailByUser = new Map(matchingUsers.map((user) => [user._id.toHexString(), user.email]));

  return matchingTrips.flatMap((match): Match[] => {
    const email = emailByUser.get(match.userId.toHexString());
    if (!email) {
      return [];
    }

    return [
      {
        tripId: match._id.toHexString(),
        email,
        airportCode: match.airportCode,
        arrivalAtUtc: match.arrivalAtUtc.toISOString(),
        differenceMinutes: Math.round(
          (match.arrivalAtUtc.getTime() - trip.arrivalAtUtc.getTime()) / 60_000,
        ),
      },
    ];
  });
}
