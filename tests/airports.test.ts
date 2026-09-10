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
