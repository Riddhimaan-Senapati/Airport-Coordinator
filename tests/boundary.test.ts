import { describe, expect, it, vi } from "vitest";

vi.mock("../app/trips/actions", () => ({ deleteTrip: vi.fn() }));
vi.mock("../lib/supabase/client", () => ({ createClient: vi.fn() }));

import { signupErrorMessage } from "../app/auth/signup/signup-form";
import { confirmTripCancellation } from "../app/trips/cancel-trip-button";

describe("trip cancellation confirmation", () => {
  it("prompts and prevents submission when the traveler declines", () => {
    const preventDefault = vi.fn();
    const confirm = vi.fn(() => false);

    confirmTripCancellation({ preventDefault }, confirm);

    expect(confirm).toHaveBeenCalledWith("Cancel this trip and remove its matches?");
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("allows submission when the traveler accepts", () => {
    const preventDefault = vi.fn();

    confirmTripCancellation({ preventDefault }, () => true);

    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe("signup rejection message", () => {
  it("surfaces the database UMass domain message", () => {
    expect(signupErrorMessage({ message: "Use an @umass.edu email address." })).toBe(
      "Use an @umass.edu email address.",
    );
  });

  it("falls back when the rejection carries no message", () => {
    const fallback = "Could not create the account. Check the details or try again later.";

    expect(signupErrorMessage({ message: "" })).toBe(fallback);
    expect(signupErrorMessage(null)).toBe(fallback);
  });
});
