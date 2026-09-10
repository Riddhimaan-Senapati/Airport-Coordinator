import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import timezoneAt from "@photostructure/tz-lookup";

const DEFAULT_AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const DEFAULT_COUNTRIES_URL = "https://davidmegginson.github.io/ourairports-data/countries.csv";
const DEFAULT_OUTPUT = resolve("data/airports.json");

const ACTIVE_AIRPORT_TYPES = new Set([
  "balloonport",
  "heliport",
  "large_airport",
  "medium_airport",
  "seaplane_base",
  "small_airport",
]);

export function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
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
  const normalized = [
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

  return normalized;
}

function parseArguments(arguments_) {
  const options = {
    airports: DEFAULT_AIRPORTS_URL,
    countries: DEFAULT_COUNTRIES_URL,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (!value || !["--airports", "--countries", "--output"].includes(flag)) {
      throw new Error(`Unknown or incomplete argument: ${flag}`);
    }
    options[flag.slice(2)] = value;
    index += 1;
  }

  return options;
}

async function readSource(location) {
  if (/^https?:\/\//u.test(location)) {
    const response = await fetch(location);
    if (!response.ok) {
      throw new Error(`Failed to download ${location}: ${response.status}`);
    }
    return response.text();
  }

  return readFile(resolve(location), "utf8");
}

function countryNameMap(csv) {
  const [headers, ...rows] = parseCsv(csv);
  if (!headers) return new Map();

  return new Map(
    rows
      .map((row) => [valueAt(headers, row, "code"), valueAt(headers, row, "name")])
      .filter(([code, name]) => code.length > 0 && name.length > 0),
  );
}

export async function syncAirports(options) {
  const [airportsCsv, countriesCsv] = await Promise.all([
    readSource(options.airports),
    readSource(options.countries),
  ]);
  const [headers, ...rows] = parseCsv(airportsCsv);
  if (!headers) throw new Error("The airports CSV is empty.");

  const names = countryNameMap(countriesCsv);
  const airports = rows
    .map((row) => normalizeAirport(headers, row, names))
    .filter((airport) => airport !== null)
    .sort((left, right) => left[0] - right[0]);

  const payload = {
    version: 1,
    source: DEFAULT_AIRPORTS_URL,
    columns: [
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
    ],
    airports,
  };

  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
  return airports.length;
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isMain) {
  const options = parseArguments(process.argv.slice(2));
  const count = await syncAirports(options);
  process.stdout.write(`Wrote ${count.toLocaleString("en-US")} airports to ${options.output}\n`);
}
