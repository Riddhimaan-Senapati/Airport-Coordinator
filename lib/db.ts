import { MongoClient } from "mongodb";

declare global {
  var airportCoordinatorMongoClient: MongoClient | undefined;
}

const connectionUri = process.env.MONGODB_CONNECTION_URI;

if (!connectionUri && process.env.NODE_ENV === "production") {
  throw new Error("MONGODB_CONNECTION_URI is required in production.");
}

export const mongoClient =
  globalThis.airportCoordinatorMongoClient ??
  new MongoClient(connectionUri ?? "mongodb://127.0.0.1:27017/airport-coordinator");

globalThis.airportCoordinatorMongoClient = mongoClient;

export const database = mongoClient.db();

export async function getDatabase() {
  await mongoClient.connect();
  return database;
}
