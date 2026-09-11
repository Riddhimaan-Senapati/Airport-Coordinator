import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import timezoneAt from "@photostructure/tz-lookup";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const DEFAULT_COUNTRIES_URL = "https://davidmegginson.github.io/ourairports-data/countries.csv";
const DEFAULT_BATCH_SIZE = 1_000;
const DEFAULT_PRUNE_BATCH_SIZE = 5_000;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1_000;

const ACTIVE_AIRPORT_TYPES = new Set([
  "balloonport",
  "heliport",
  "large_airport",
  "medium_airport",
  "seaplane_base",
  "small_airport",
]);

export async function* toTextChunks(source, decoder = new TextDecoder("utf-8")) {
  for await (const chunk of source) {
    yield typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
  }

  const remainder = decoder.decode();
  if (remainder.length > 0) yield remainder;
}

export async function* parseCsvStream(chunks) {
  let field = "";
  let row = [];
  let quoted = false;
  let pendingQuote = false;
  let started = false;

  for await (const chunk of chunks) {
    let index = 0;

    if (pendingQuote) {
      pendingQuote = false;
      if (chunk[0] === '"') {
        field += '"';
        index = 1;
      } else {
        quoted = false;
      }
    }

    for (; index < chunk.length; index += 1) {
      const character = chunk[index];

      if (quoted) {
        if (character === '"') {
          if (index + 1 < chunk.length) {
            if (chunk[index + 1] === '"') {
              field += '"';
              index += 1;
            } else {
              quoted = false;
            }
          } else {
            pendingQuote = true;
          }
        } else {
          field += character;
        }
        continue;
      }

      if (character === '"') {
        quoted = true;
        started = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
        started = true;
      } else if (character === "\n") {
        row.push(field);
        yield row;
        row = [];
        field = "";
        started = false;
      } else if (character !== "\r") {
        field += character;
        started = true;
      }
    }
  }

  if (pendingQuote) quoted = false;
  if (started || field.length > 0 || row.length > 0) {
    row.push(field);
    yield row;
  }
}

function valueAt(headers, row, column) {
  const index = headers.indexOf(column);
  return index === -1 ? "" : (row[index] ?? "").trim();
}

function optional(value) {
  return value.length === 0 ? null : value;
}

function numberAt(headers, row, column) {
  const value = valueAt(headers, row, column);
  if (value.length === 0) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeAirport(headers, row, countryNames = new Map()) {
  const id = numberAt(headers, row, "id");
  const type = valueAt(headers, row, "type");
  const ident = valueAt(headers, row, "ident");
  const name = valueAt(headers, row, "name");
  const latitude = numberAt(headers, row, "latitude_deg");
  const longitude = numberAt(headers, row, "longitude_deg");

  if (
    !Number.isInteger(id) ||
    !ACTIVE_AIRPORT_TYPES.has(type) ||
    ident.length === 0 ||
    name.length === 0 ||
    latitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude === null ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const countryCode = valueAt(headers, row, "iso_country");
  return [
    id,
    ident,
    optional(valueAt(headers, row, "iata_code")),
    optional(valueAt(headers, row, "gps_code")),
    name,
    optional(valueAt(headers, row, "municipality")),
    countryCode,
    countryNames.get(countryCode) ?? null,
    latitude,
    longitude,
    type,
    timezoneAt(latitude, longitude),
  ];
}

export function toDatabaseRow(airport, generation) {
  return {
    id: airport[0],
    ident: airport[1],
    iata_code: airport[2],
    gps_code: airport[3],
    name: airport[4],
    municipality: airport[5],
    country_code: airport[6],
    country_name: airport[7],
    latitude: airport[8],
    longitude: airport[9],
    type: airport[10],
    timezone: airport[11],
    catalog_generation: generation,
  };
}

async function openSource(source) {
  if (typeof source !== "string") return source;

  if (/^https?:\/\//u.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Failed to download ${source}: ${response.status}`);
    if (!response.body) throw new Error(`Download of ${source} returned no body.`);
    return response.body;
  }

  return createReadStream(resolve(source));
}

export async function loadCountryMap(source) {
  const rows = parseCsvStream(toTextChunks(await openSource(source)));
  const first = await rows.next();
  const names = new Map();
  if (first.done) return names;

  const headers = first.value;
  for await (const row of rows) {
    const code = valueAt(headers, row, "code");
    const name = valueAt(headers, row, "name");
    if (code.length > 0 && name.length > 0) names.set(code, name);
  }

  return names;
}

export async function* streamAirportBatches(source, countryNames, batchSize = DEFAULT_BATCH_SIZE) {
  const rows = parseCsvStream(toTextChunks(await openSource(source)));
  const first = await rows.next();
  if (first.done) throw new Error("The airports CSV is empty.");

  const headers = first.value;
  if (!headers.some((column) => column.trim() === "id")) {
    throw new Error("The airports CSV is missing the id column.");
  }

  let batch = [];
  for await (const row of rows) {
    const airport = normalizeAirport(headers, row, countryNames);
    if (airport === null) continue;
    batch.push(airport);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) yield batch;
}

function defaultWait(delayMs) {
  return new Promise((settle) => {
    setTimeout(settle, delayMs);
  });
}

export async function upsertBatch(client, rows, options = {}) {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const delayMs = options.delayMs ?? DEFAULT_RETRY_DELAY_MS;
  const wait = options.wait ?? defaultWait;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { error } = await client
      .from("airports")
      .upsert(rows, { onConflict: "catalog_generation,id" });
    if (!error) return;

    lastError = error;
    if (attempt < attempts) await wait(delayMs);
  }

  const offset = options.offset ?? 0;
  throw new Error(`Airport import failed at row ${offset}: ${lastError?.message ?? "unknown"}`);
}

export async function activateGeneration(client, generation) {
  const { data, error } = await client.rpc("reconcile_airport_catalog", {
    p_generation: generation,
  });
  if (error) throw new Error(`Airport reconciliation failed: ${error.message}`);
  return data;
}

export async function pruneAirportCatalog(client, options = {}) {
  const batchSize = options.batchSize ?? DEFAULT_PRUNE_BATCH_SIZE;
  let pruned = 0;

  for (;;) {
    const { data, error } = await client.rpc("prune_airport_catalog", {
      p_batch_size: batchSize,
    });
    if (error) throw new Error(`Airport catalog cleanup failed: ${error.message}`);
    if (!Number.isInteger(data) || data < 0) {
      throw new Error("Airport catalog cleanup returned an invalid row count.");
    }
    pruned += data;
    if (data === 0) return pruned;
  }
}

export async function importAirports(options) {
  const {
    client,
    airports,
    countries,
    generation = crypto.randomUUID(),
    batchSize = DEFAULT_BATCH_SIZE,
    pruneBatchSize = DEFAULT_PRUNE_BATCH_SIZE,
    attempts = DEFAULT_ATTEMPTS,
    delayMs = DEFAULT_RETRY_DELAY_MS,
    wait,
    onProgress,
  } = options;

  const countryNames = await loadCountryMap(countries);
  let imported = 0;

  for await (const batch of streamAirportBatches(airports, countryNames, batchSize)) {
    const rows = batch.map((airport) => toDatabaseRow(airport, generation));
    await upsertBatch(client, rows, { attempts, delayMs, wait, offset: imported });
    imported += rows.length;
    onProgress?.({ imported, generation });
  }

  if (imported === 0) throw new Error("The airports CSV produced no importable rows.");

  await activateGeneration(client, generation);
  const pruned = await pruneAirportCatalog(client, { batchSize: pruneBatchSize });
  return { generation, imported, pruned };
}

export function parseArguments(args) {
  const options = {
    airports: DEFAULT_AIRPORTS_URL,
    countries: DEFAULT_COUNTRIES_URL,
    batchSize: DEFAULT_BATCH_SIZE,
    pruneBatchSize: DEFAULT_PRUNE_BATCH_SIZE,
    attempts: DEFAULT_ATTEMPTS,
    delayMs: DEFAULT_RETRY_DELAY_MS,
  };

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value) throw new Error(`Unknown or incomplete argument: ${flag}`);
    if (flag === "--airports") options.airports = value;
    else if (flag === "--countries") options.countries = value;
    else if (flag === "--batch-size") options.batchSize = Number(value);
    else if (flag === "--prune-batch-size") options.pruneBatchSize = Number(value);
    else if (flag === "--attempts") options.attempts = Number(value);
    else if (flag === "--retry-delay-ms") options.delayMs = Number(value);
    else throw new Error(`Unknown or incomplete argument: ${flag}`);
    index += 1;
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = Date.now();
  const { generation, imported, pruned } = await importAirports({
    ...options,
    client,
    onProgress: ({ imported: count }) => {
      process.stdout.write(`Imported ${count.toLocaleString("en-US")} airports\r`);
    },
  });

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  process.stdout.write(`\nActivated generation ${generation} with `);
  process.stdout.write(`${imported.toLocaleString("en-US")} airports, pruned `);
  process.stdout.write(`${pruned.toLocaleString("en-US")} rows in ${seconds}s.\n`);
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isMain) await main();
