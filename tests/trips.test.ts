import { describe, expect, it } from "vitest";

import { createArrivalWindow } from "../lib/trips";

describe("createArrivalWindow", () => {
  it("adds whole hours to the arrival instant", () => {
    const start = new Date("2026-09-08T14:30:00.000Z");

    expect(createArrivalWindow({ start, waitHours: 3 })).toEqual({
      start,
      end: new Date("2026-09-08T17:30:00.000Z"),
    });
  });
});
