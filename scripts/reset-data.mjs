import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { MongoClient } from "mongodb";

const COLLECTIONS = [
  "users",
  "flights",
  "user",
  "session",
  "account",
  "verification",
  "rateLimit",
  "trips",
  "tripSearchLimits",
];

if (!process.env.MONGODB_CONNECTION_URI && existsSync(".env.local")) {
  loadEnvFile(".env.local");
}

const uri = process.env.MONGODB_CONNECTION_URI;
if (!uri) {
  throw new Error("MONGODB_CONNECTION_URI must be set directly or in .env.local.");
}

const parsedUri = new URL(uri);
if (parsedUri.protocol !== "mongodb:" && parsedUri.protocol !== "mongodb+srv:") {
  throw new Error("MONGODB_CONNECTION_URI must use mongodb:// or mongodb+srv://.");
}

const databaseName = decodeURIComponent(parsedUri.pathname.slice(1));
if (!databaseName || databaseName === "test" || databaseName.includes("/")) {
  throw new Error("MONGODB_CONNECTION_URI must name a non-default database.");
}

const host = `${parsedUri.hostname}${parsedUri.port ? `:${parsedUri.port}` : ""}`;
const target = `${host}/${databaseName}`;
const confirmation = `--confirm=${target}`;
const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

if (!process.argv.includes(confirmation)) {
  throw new Error(`Refusing to reset data. Run again with ${confirmation}.`);
}

if (!localHosts.has(parsedUri.hostname) && !process.argv.includes("--allow-remote")) {
  throw new Error(`Refusing to reset remote target ${target} without --allow-remote.`);
}

const client = new MongoClient(uri);
const database = client.db(databaseName);

try {
  await client.connect();
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  const existing = new Set(collections.map(({ name }) => name));
  const targets = COLLECTIONS.filter((name) => existing.has(name));
  for (const name of targets) {
    await database.collection(name).drop();
  }

  console.log(`Dropped ${targets.length} Airport Buddy collections from ${database.databaseName}.`);
} finally {
  await client.close();
}
