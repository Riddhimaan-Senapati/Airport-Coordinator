import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

const batchSize = 1_000;
const catalogUrl = new URL("../data/airports.json", import.meta.url);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const columnIndex = new Map(catalog.columns.map((column, index) => [column, index]));
const requiredColumns = [
  "id",
  "ident",
  "iataCode",
  "gpsCode",
  "name",
  "municipality",
  "countryCode",
  "countryName",
  "latitude",
  "longitude",
  "type",
  "timezone",
];

for (const column of requiredColumns) {
  if (!columnIndex.has(column)) {
    throw new Error(`Airport catalog is missing the ${column} column.`);
  }
}

const field = (row, name) => row[columnIndex.get(name)];
const generation = crypto.randomUUID();
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (let offset = 0; offset < catalog.airports.length; offset += batchSize) {
  const rows = catalog.airports.slice(offset, offset + batchSize).map((row) => ({
    id: field(row, "id"),
    ident: field(row, "ident"),
    iata_code: field(row, "iataCode"),
    gps_code: field(row, "gpsCode"),
    name: field(row, "name"),
    municipality: field(row, "municipality"),
    country_code: field(row, "countryCode"),
    country_name: field(row, "countryName"),
    latitude: field(row, "latitude"),
    longitude: field(row, "longitude"),
    type: field(row, "type"),
    timezone: field(row, "timezone"),
    catalog_generation: generation,
  }));

  const { error } = await supabase
    .from("airports")
    .upsert(rows, { onConflict: "catalog_generation,id" });

  if (error) {
    throw new Error(`Airport import failed at row ${offset}: ${error.message}`);
  }

  console.log(
    `Imported ${Math.min(offset + batchSize, catalog.airports.length)}/${catalog.airports.length}`,
  );
}

const { error: reconciliationError } = await supabase.rpc("reconcile_airport_catalog", {
  p_generation: generation,
});

if (reconciliationError) {
  throw new Error(`Airport reconciliation failed: ${reconciliationError.message}`);
}

let pruned;
do {
  const { data, error } = await supabase.rpc("prune_airport_catalog", {
    p_batch_size: 5_000,
  });
  if (error) {
    throw new Error(`Airport catalog cleanup failed: ${error.message}`);
  }
  if (!Number.isInteger(data) || data < 0) {
    throw new Error("Airport catalog cleanup returned an invalid row count.");
  }
  pruned = data;
} while (pruned > 0);
