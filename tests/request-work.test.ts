import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getIdentity: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../lib/supabase/server", () => ({
  createClient: mocks.createClient,
  getIdentity: mocks.getIdentity,
}));

import { changeContactConsent, deleteTrip, saveTrip } from "../app/trips/actions";
import TripsPage from "../app/trips/page";

function authenticated() {
  mocks.createClient.mockResolvedValue({ auth: { getClaims: vi.fn() }, rpc: mocks.rpc });
  mocks.getIdentity.mockResolvedValue({ email: "traveler@umass.edu", id: "user-id" });
  mocks.rpc.mockResolvedValue({
    data: { trip: null, matches: [] },
    error: null,
  });
}

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.getIdentity.mockReset();
  mocks.rpc.mockReset();
});

describe("dashboard request work", () => {
  it("loads with one client, one identity check, and one dashboard RPC", async () => {
    authenticated();

    const page = await TripsPage();

    expect(page).toBeTruthy();
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.getIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("get_trip_dashboard");
  });

  it("redirects an unauthenticated load without calling the dashboard RPC", async () => {
    mocks.createClient.mockResolvedValue({ auth: { getClaims: vi.fn() }, rpc: mocks.rpc });
    mocks.getIdentity.mockResolvedValue(null);

    await expect(TripsPage()).rejects.toThrow("NEXT_REDIRECT:/auth/signin");
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.getIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("server action request work", () => {
  it("saves a trip with one client, one identity check, and one RPC", async () => {
    authenticated();
    const formData = new FormData();
    formData.set("airportId", "3484");
    formData.set("arrivalAtUtc", new Date(Date.now() + 3_600_000).toISOString());
    formData.set("waitHours", "2");

    const result = await saveTrip({ status: "idle" }, formData);

    expect(result).toEqual({
      status: "success",
      message: "Your trip is saved.",
    });
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.getIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "save_trip_and_find_matches",
      expect.objectContaining({ p_airport_id: 3484, p_wait_hours: 2 }),
    );
  });

  it("deletes a trip with one client, one identity check, and one RPC", async () => {
    authenticated();

    await deleteTrip();

    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.getIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("delete_my_trip");
  });

  it("changes contact consent with one client, one identity check, and one RPC", async () => {
    authenticated();
    const formData = new FormData();
    formData.set("matchId", "22a1e916-36aa-4f86-b849-f5a09806cb57");
    formData.set("decision", "accept");

    await changeContactConsent(formData);

    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.getIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("set_match_consent", {
      p_match_id: "22a1e916-36aa-4f86-b849-f5a09806cb57",
      p_consented: true,
    });
  });
});
