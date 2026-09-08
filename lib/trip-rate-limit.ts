import { getDatabase } from "./db";

const WINDOW_MILLISECONDS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

type SearchLimit = {
  _id: string;
  count: number;
  expiresAt: Date;
};

let indexReady: Promise<string> | undefined;

export async function takeTripSearchSlot(userId: string) {
  const collection = (await getDatabase()).collection<SearchLimit>("tripSearchLimits");
  indexReady ??= collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  try {
    await indexReady;
  } catch (error) {
    indexReady = undefined;
    throw error;
  }

  const window = Math.floor(Date.now() / WINDOW_MILLISECONDS);
  const result = await collection.findOneAndUpdate(
    { _id: `${userId}:${window}` },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date((window + 2) * WINDOW_MILLISECONDS) },
    },
    { upsert: true, returnDocument: "after" },
  );

  return (result?.count ?? MAX_REQUESTS_PER_WINDOW + 1) <= MAX_REQUESTS_PER_WINDOW;
}
