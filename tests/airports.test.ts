import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: supabase.getUser },
    rpc: supabase.rpc,
  })),
}));

import { GET } from "../app/api/airports/route";

function request(query: string) {
  return new NextRequest(`http://localhost/api/airports?q=${encodeURIComponent(query)}`);
}

describe("GET /api/airports", () => {
  beforeEach(() => {
    supabase.getUser.mockReset();
    supabase.rpc.mockReset();
    supabase.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
  });

  it("rejects unauthenticated searches without calling the database", async () => {
    supabase.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(request("BOS"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects oversized queries", async () => {
    const response = await GET(request("a".repeat(101)));

    expect(response.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("returns no results for an empty authenticated query", async () => {
    const response = await GET(request("   "));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ airports: [] });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
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
