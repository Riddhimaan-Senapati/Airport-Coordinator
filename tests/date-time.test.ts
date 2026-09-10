import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { localDateTimeToUtc, parseLocalDateTime, utcToLocalDateTimeInput } from "../lib/date-time";

beforeAll(() => vi.stubEnv("TZ", "America/New_York"));
afterAll(() => vi.unstubAllEnvs());

describe("localDateTimeToUtc", () => {
  it("turns a browser-local wall time into a UTC instant", () => {
    const result = localDateTimeToUtc("2026-09-08T14:30");

    expect(result).not.toBeNull();
    if (!result) {
      throw new Error("Expected a UTC arrival instant.");
    }
    const arrival = new Date(result);
    expect([
      arrival.getFullYear(),
      arrival.getMonth() + 1,
      arrival.getDate(),
      arrival.getHours(),
      arrival.getMinutes(),
    ]).toEqual([2026, 9, 8, 14, 30]);
  });

  it.each([null, "", "not-a-date"])("rejects %s", (value) => {
    expect(localDateTimeToUtc(value)).toBeNull();
  });

  it("rejects a nonexistent local time during the daylight-saving gap", () => {
    expect(parseLocalDateTime("2026-03-08T02:30")).toBeNull();
    expect(localDateTimeToUtc("2026-03-08T02:30")).toBeNull();
  });

  it("rejects calendar values that JavaScript would normalize", () => {
    expect(parseLocalDateTime("2026-02-30T12:00")).toBeNull();
  });
});

describe("utcToLocalDateTimeInput", () => {
  it("round-trips a UTC instant through a browser-local value", () => {
    const utc = "2026-09-08T14:30:00.000Z";
    const local = utcToLocalDateTimeInput(utc);

    expect(localDateTimeToUtc(local)).toBe(utc);
  });

  it("rejects an invalid instant", () => {
    expect(utcToLocalDateTimeInput("not-a-date")).toBe("");
  });
});
