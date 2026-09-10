import { describe, expect, it } from "vitest";

import { emailSchema, tripInputSchema } from "../lib/validation";

const validArrival = () => new Date(Date.now() + 86_400_000).toISOString();

describe("emailSchema", () => {
  it("normalizes a UMass email", () => {
    expect(emailSchema.parse("  Student@UMASS.EDU ")).toBe("student@umass.edu");
  });

  it.each([
    "student@fakeumass.edu",
    "student@sub.umass.edu",
    "person@elsewhere@umass.edu",
    "not-an-email",
  ])("rejects %s", (email) => {
    expect(emailSchema.safeParse(email).success).toBe(false);
  });
});

describe("tripInputSchema", () => {
  it("parses a valid trip boundary payload", () => {
    const arrival = new Date(Date.now() + 86_400_000);
    const result = tripInputSchema.parse({
      airportId: "3484",
      arrivalAtUtc: arrival.toISOString(),
      waitHours: "2",
    });

    expect(result).toEqual({
      airportId: 3484,
      arrivalAtUtc: arrival,
      waitHours: 2,
    });
  });

  it.each(["0", "25", "1.5", "unknown"])("rejects wait time %s", (waitHours) => {
    expect(
      tripInputSchema.safeParse({
        airportId: "3484",
        arrivalAtUtc: validArrival(),
        waitHours,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-numeric airport identifier", () => {
    expect(
      tripInputSchema.safeParse({
        airportId: "LAX",
        arrivalAtUtc: validArrival(),
        waitHours: "2",
      }).success,
    ).toBe(false);
  });

  it("rejects arrivals more than a year away", () => {
    expect(
      tripInputSchema.safeParse({
        airportId: "3484",
        arrivalAtUtc: new Date(Date.now() + 31_536_000_000 + 86_400_000).toISOString(),
        waitHours: "2",
      }).success,
    ).toBe(false);
  });
});
