import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
  createClient: vi.fn(),
  getIdentity: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: supabase.createClient,
  getIdentity: supabase.getIdentity,
}));

import { GET } from "../app/api/airports/route";
import { shouldSearchAirport } from "../app/trips/airport-combobox";
import {
  activateGeneration,
  importAirports,
  normalizeAirport,
  parseCsvStream,
  pruneAirportCatalog,
  streamAirportBatches,
  toTextChunks,
  upsertBatch,
} from "../scripts/import-airports.mjs";

function request(query: string) {
  return new NextRequest(`http://localhost/api/airports?q=${encodeURIComponent(query)}`);
}

describe("GET /api/airports", () => {
  beforeEach(() => {
    supabase.createClient.mockReset();
    supabase.getIdentity.mockReset();
    supabase.rpc.mockReset();
    supabase.createClient.mockResolvedValue({ rpc: supabase.rpc });
    supabase.getIdentity.mockResolvedValue({
      email: "traveler@umass.edu",
      id: "user-id",
    });
  });

  it("rejects unauthenticated searches without calling the database", async () => {
    supabase.getIdentity.mockResolvedValue(null);

    const response = await GET(request("BOS"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
    expect(supabase.createClient).toHaveBeenCalledTimes(1);
    expect(supabase.getIdentity).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects oversized queries before creating a client", async () => {
    const response = await GET(request("a".repeat(101)));

    expect(response.status).toBe(400);
    expect(supabase.createClient).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("returns no results for an empty authenticated query", async () => {
    const response = await GET(request("   "));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ airports: [] });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(supabase.createClient).toHaveBeenCalledTimes(1);
    expect(supabase.getIdentity).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("returns no results for a one-character query without calling the database", async () => {
    const response = await GET(request("b"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ airports: [] });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(supabase.getIdentity).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("maps the capped Supabase search response for the combobox", async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        {
          id: 3484,
          code: "BOS",
          name: "Logan International Airport",
          municipality: "Boston",
          country_code: "US",
        },
      ],
      error: null,
    });

    const response = await GET(request("boston"));

    expect(supabase.createClient).toHaveBeenCalledTimes(1);
    expect(supabase.getIdentity).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("search_airports", {
      query: "boston",
      result_limit: 10,
    });
    await expect(response.json()).resolves.toEqual({
      airports: [
        {
          id: 3484,
          code: "BOS",
          name: "Logan International Airport",
          municipality: "Boston",
          countryCode: "US",
        },
      ],
    });
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
  });

  it("returns a service error when airport search fails", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });

    const response = await GET(request("BOS"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Airport search is unavailable." });
  });
});

describe("shouldSearchAirport", () => {
  it("requires at least two trimmed characters", () => {
    expect(shouldSearchAirport("")).toBe(false);
    expect(shouldSearchAirport(" ")).toBe(false);
    expect(shouldSearchAirport("b")).toBe(false);
    expect(shouldSearchAirport(" b ")).toBe(false);
    expect(shouldSearchAirport("bo")).toBe(true);
    expect(shouldSearchAirport(" BOS ")).toBe(true);
  });
});

const airportsHeader =
  "id,ident,type,name,latitude_deg,longitude_deg,iso_country,municipality,iata_code,gps_code";
const countriesCsv = "code,name\nUS,United States\nGB,United Kingdom\n";
const loganAirport =
  "1,BOS,large_airport,Logan International Airport,42.363,-71.006,US,Boston,BOS,KBOS";

type BatchUpsert = (
  rows: Record<string, unknown>[],
  options: Record<string, unknown>,
) => Promise<{ error: unknown }>;
type CatalogRpc = (
  name: string,
  parameters: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

function airportRow(id: number) {
  return `${id},A${id},small_airport,Airport ${id},10,20,US,Town,,A${id}`;
}

function airportsCsv(...rows: string[]) {
  return [airportsHeader, ...rows].join("\n");
}

function fakeSupabase(overrides: { upsert?: BatchUpsert; rpc?: CatalogRpc } = {}) {
  return {
    from: vi.fn(() => ({
      upsert: overrides.upsert ?? vi.fn(async () => ({ error: null })),
    })),
    rpc: overrides.rpc ?? vi.fn(async () => ({ data: 0, error: null })),
  };
}

describe("airport catalog import", () => {
  it("parses quoted fields and embedded newlines across stream chunks", async () => {
    const source = 'id,name\r\n1,"Line one\nLine two"\r\n2,"He said ""hi"", ok"\r\n';
    const chunks = [];
    for (let index = 0; index < source.length; index += 3) {
      chunks.push(source.slice(index, index + 3));
    }

    const rows = [];
    for await (const row of parseCsvStream(toTextChunks(chunks))) rows.push(row);

    expect(rows).toEqual([
      ["id", "name"],
      ["1", "Line one\nLine two"],
      ["2", 'He said "hi", ok'],
    ]);
  });

  it("reassembles an escaped quote split across chunks", async () => {
    const rows = [];
    for await (const row of parseCsvStream(toTextChunks(['a,"x"', '"y"\n']))) rows.push(row);

    expect(rows).toEqual([["a", 'x"y']]);
  });

  it("decodes multibyte characters split across byte chunks", async () => {
    const bytes = Buffer.from('id,name\n1,"caf\u00e9"\n');
    const chunks = [bytes.subarray(0, 15), bytes.subarray(15)];

    const rows = [];
    for await (const row of parseCsvStream(toTextChunks(chunks))) rows.push(row);

    expect(rows).toEqual([
      ["id", "name"],
      ["1", "caf\u00e9"],
    ]);
  });

  it("rejects malformed airport rows", () => {
    const headers = airportsHeader.split(",");
    const countryNames = new Map([["US", "United States"]]);
    const parse = (row: string) => normalizeAirport(headers, row.split(","), countryNames);

    expect(parse(loganAirport)).not.toBeNull();
    expect(parse("nope,BOS,large_airport,Logan,42,-71,US,Boston,,")).toBeNull();
    expect(parse("2,BOS,closed,Logan,42,-71,US,Boston,,")).toBeNull();
    expect(parse("3,BOS,large_airport,,42,-71,US,Boston,,")).toBeNull();
    expect(parse("4,BOS,large_airport,Logan,91,-71,US,Boston,,")).toBeNull();
  });

  it("batches normalized airports and skips malformed rows", async () => {
    const source = [
      airportsCsv(loganAirport, "bad,BAD,large_airport,No Id,42,-71,US,Town,,", airportRow(2)),
    ];

    const batches = [];
    const countryNames = new Map([["US", "United States"]]);
    for await (const batch of streamAirportBatches(source, countryNames, 1)) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(1);
    expect(batches[0][0][0]).toBe(1);
    expect(batches[1][0][0]).toBe(2);
  });

  it("retries a transient batch failure", async () => {
    let calls = 0;
    const upsert = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? { error: { message: "temporary" } } : { error: null };
    });

    await upsertBatch(fakeSupabase({ upsert }), [{ id: 1 }], {
      attempts: 3,
      wait: async () => {},
    });

    expect(calls).toBe(2);
  });

  it("fails a batch after the retry budget", async () => {
    const upsert = vi.fn(async () => ({ error: { message: "permanent" } }));

    await expect(
      upsertBatch(fakeSupabase({ upsert }), [{ id: 1 }], {
        attempts: 2,
        wait: async () => {},
      }),
    ).rejects.toThrow("permanent");

    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("activates a generation through the reconcile RPC", async () => {
    const rpc = vi.fn(async () => ({ data: 42, error: null }));
    const parameters = { p_generation: "generation-7" };

    await expect(activateGeneration(fakeSupabase({ rpc }), "generation-7")).resolves.toBe(42);
    expect(rpc).toHaveBeenCalledWith("reconcile_airport_catalog", parameters);
  });

  it("prunes unreferenced rows until a batch deletes none", async () => {
    const responses = [5_000, 120, 0];
    const rpc = vi.fn(async () => ({ data: responses.shift(), error: null }));

    const pruned = await pruneAirportCatalog(fakeSupabase({ rpc }), { batchSize: 1_000 });

    expect(pruned).toBe(5_120);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenCalledWith("prune_airport_catalog", { p_batch_size: 1_000 });
  });

  it("imports every batch before activating and pruning one generation", async () => {
    const batches: Record<string, unknown>[][] = [];
    const upsert = vi.fn(async (rows: Record<string, unknown>[]) => {
      batches.push(rows);
      return { error: null };
    });
    const rpc = vi.fn(async (name: string) =>
      name === "reconcile_airport_catalog" ? { data: 3, error: null } : { data: 0, error: null },
    );

    const result = await importAirports({
      client: fakeSupabase({ upsert, rpc }),
      airports: [airportsCsv(airportRow(1), airportRow(2), airportRow(3))],
      countries: [countriesCsv],
      generation: "generation-1",
      batchSize: 2,
    });

    expect(result).toEqual({ generation: "generation-1", imported: 3, pruned: 0 });
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(2);
    expect(batches[1]).toHaveLength(1);
    expect(batches[0][0]).toMatchObject({ id: 1, catalog_generation: "generation-1" });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "reconcile_airport_catalog",
      "prune_airport_catalog",
    ]);
    expect(rpc).toHaveBeenNthCalledWith(1, "reconcile_airport_catalog", {
      p_generation: "generation-1",
    });
  });

  it("leaves the active generation untouched when a batch fails", async () => {
    const upsert = vi.fn(async () => ({ error: { message: "batch failed" } }));
    const rpc = vi.fn(async () => ({ data: 0, error: null }));

    await expect(
      importAirports({
        client: fakeSupabase({ upsert, rpc }),
        airports: [airportsCsv(airportRow(1), airportRow(2))],
        countries: [countriesCsv],
        generation: "generation-2",
        batchSize: 1,
        attempts: 2,
        wait: async () => {},
      }),
    ).rejects.toThrow("batch failed");

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(rpc).not.toHaveBeenCalled();
  });
});
