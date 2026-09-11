import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { contactFromDisclosure, mapTripDashboard } from "../lib/trips";

describe("contact disclosure", () => {
  const match = {
    id: "22a1e916-36aa-4f86-b849-f5a09806cb57",
    hasConsented: false,
    otherHasConsented: false,
    contactEmail: null,
    otherTrip: { arrivalAt: "2026-09-08T15:30:00.000Z" },
  };

  it("does not expose contact details until both travelers consent", () => {
    expect(contactFromDisclosure(match)).toEqual({ status: "available" });
    expect(contactFromDisclosure({ ...match, otherHasConsented: true })).toEqual({
      status: "requested",
    });
    expect(contactFromDisclosure({ ...match, hasConsented: true })).toEqual({ status: "waiting" });
  });

  it("exposes the email only after mutual consent", () => {
    expect(
      contactFromDisclosure({
        ...match,
        hasConsented: true,
        otherHasConsented: true,
        contactEmail: "traveler@umass.edu",
      }),
    ).toEqual({ status: "connected", email: "traveler@umass.edu" });
  });
});

describe("dashboard mapping", () => {
  it("preserves UTC instants and computes the arrival difference", () => {
    const airport = {
      id: 3484,
      code: "BOS",
      name: "Logan International Airport",
      municipality: "Boston",
      countryCode: "US",
      timezone: "America/New_York",
      latitude: 42.3643,
      longitude: -71.0052,
    };
    const dashboard = mapTripDashboard({
      trip: {
        id: "50d8dcff-60ce-43d7-b6f2-f1a6498d1f7b",
        airport,
        arrivalAt: "2026-09-08T15:00:00.000Z",
        waitHours: 2,
        waitUntil: "2026-09-08T17:00:00.000Z",
        revision: 1,
      },
      matches: [
        {
          id: "22a1e916-36aa-4f86-b849-f5a09806cb57",
          overlapStart: "2026-09-08T15:45:00.000Z",
          overlapEnd: "2026-09-08T17:00:00.000Z",
          hasConsented: false,
          otherHasConsented: false,
          contactEmail: null,
          otherTrip: {
            arrivalAt: "2026-09-08T15:45:00.000Z",
            waitUntil: "2026-09-08T17:45:00.000Z",
          },
        },
      ],
    });

    expect(dashboard.trip?.arrivalAtUtc).toBe("2026-09-08T15:00:00.000Z");
    expect(dashboard.matches[0]).toMatchObject({ airport, differenceMinutes: 45 });
  });

  it("rejects malformed dates returned by the dashboard RPC", () => {
    expect(() =>
      mapTripDashboard({
        trip: {
          id: "50d8dcff-60ce-43d7-b6f2-f1a6498d1f7b",
          airport: {
            id: 3484,
            code: "BOS",
            name: "Logan International Airport",
            municipality: "Boston",
            countryCode: "US",
            timezone: "America/New_York",
            latitude: 42.3643,
            longitude: -71.0052,
          },
          arrivalAt: "not-an-instant",
          waitHours: 2,
          waitUntil: "2026-09-08T17:00:00.000Z",
          revision: 1,
        },
        matches: [],
      }),
    ).toThrow();
  });

  it("rejects contact details without mutual consent", () => {
    expect(() =>
      mapTripDashboard({
        trip: {
          id: "50d8dcff-60ce-43d7-b6f2-f1a6498d1f7b",
          airport: {
            id: 3484,
            code: "BOS",
            name: "Logan International Airport",
            municipality: "Boston",
            countryCode: "US",
            timezone: "America/New_York",
            latitude: 42.3643,
            longitude: -71.0052,
          },
          arrivalAt: "2026-09-08T15:00:00.000Z",
          waitHours: 2,
          waitUntil: "2026-09-08T17:00:00.000Z",
          revision: 1,
        },
        matches: [
          {
            id: "22a1e916-36aa-4f86-b849-f5a09806cb57",
            overlapStart: "2026-09-08T15:45:00.000Z",
            overlapEnd: "2026-09-08T17:00:00.000Z",
            hasConsented: false,
            otherHasConsented: false,
            contactEmail: "traveler@umass.edu",
            otherTrip: {
              arrivalAt: "2026-09-08T15:45:00.000Z",
              waitUntil: "2026-09-08T17:45:00.000Z",
            },
          },
        ],
      }),
    ).toThrow("Contact disclosure does not match the consent state.");
  });
});
