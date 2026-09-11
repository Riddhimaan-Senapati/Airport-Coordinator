import { describe, expect, it, vi } from "vitest";

import {
  CLAIM_BATCH_SIZE,
  DELIVERY_CONCURRENCY,
  DELIVERY_TIMEOUT_MS,
  LEASE_SECONDS,
  parseClaimBatch,
  runWorker,
  type MailTransport,
  type NotificationClaim,
  type NotificationEmail,
  type NotificationQueue,
  type WorkerOptions,
} from "../supabase/functions/process-match-notifications/worker";

const APP_URL = new URL("https://airport-buddy.example");

function claim(id: string, recipientEmail: string | null): NotificationClaim {
  return { id, match_id: `match-${id}`, recipient_email: recipientEmail };
}

function setup(
  claims: NotificationClaim[],
  options: { cancelled?: number; complete?: boolean; fail?: boolean } = {},
) {
  const claimBatch = vi.fn(async () => ({
    claims,
    cancelled: options.cancelled ?? 0,
  }));
  const complete = vi.fn(async () => options.complete ?? true);
  const fail = vi.fn(async () => options.fail ?? true);
  const send = vi.fn(async (_email: NotificationEmail) => undefined);
  const queue: NotificationQueue = { claimBatch, complete, fail };
  const mail: MailTransport = { send };
  const worker: WorkerOptions = {
    workerId: "worker-id",
    appUrl: APP_URL,
    emailFrom: "Airport Buddy <notifications@example.com>",
    queue,
    mail,
  };
  return { claimBatch, complete, fail, send, worker };
}

describe("match notification worker", () => {
  it("keeps the lease beyond the maximum delivery timeout budget", () => {
    const deliveryBudget = Math.ceil(CLAIM_BATCH_SIZE / DELIVERY_CONCURRENCY) * DELIVERY_TIMEOUT_MS;

    expect(LEASE_SECONDS * 1000).toBeGreaterThan(deliveryBudget);
  });

  it("parses a valid claim batch", () => {
    expect(
      parseClaimBatch({
        claims: [claim("valid", "traveler@umass.edu")],
        cancelled: 2,
      }),
    ).toEqual({
      claims: [claim("valid", "traveler@umass.edu")],
      cancelled: 2,
    });
  });

  it.each([
    null,
    {},
    { claims: "invalid", cancelled: 0 },
    { claims: [{ id: 1, match_id: "match", recipient_email: null }], cancelled: 0 },
    { claims: [], cancelled: -1 },
  ])("rejects an invalid claim batch", (value) => {
    expect(() => parseClaimBatch(value)).toThrow("Invalid notification claim response");
  });

  it("returns empty counts without sending when the queue is empty", async () => {
    const { claimBatch, send, worker } = setup([], { cancelled: 3 });

    await expect(runWorker(worker)).resolves.toEqual({
      claimed: 0,
      sent: 0,
      failed: 0,
      cancelled: 3,
    });
    expect(claimBatch).toHaveBeenCalledWith({
      workerId: "worker-id",
      batchSize: CLAIM_BATCH_SIZE,
      leaseSeconds: LEASE_SECONDS,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("reports mixed success, failure, and cancellation results", async () => {
    const { complete, fail, send, worker } = setup(
      [
        claim("sent", "sent@umass.edu"),
        claim("missing", null),
        claim("failed", "failed@umass.edu"),
      ],
      { cancelled: 4 },
    );
    send.mockImplementation(async (email) => {
      if (email.to === "failed@umass.edu") throw new Error("Resend returned 429");
      return undefined;
    });

    await expect(runWorker(worker)).resolves.toEqual({
      claimed: 3,
      sent: 1,
      failed: 2,
      cancelled: 4,
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledWith({ notificationId: "sent", workerId: "worker-id" });
    expect(fail).toHaveBeenCalledWith({
      notificationId: "missing",
      workerId: "worker-id",
      error: "Recipient has no email address",
    });
    expect(fail).toHaveBeenCalledWith({
      notificationId: "failed",
      workerId: "worker-id",
      error: "Resend returned 429",
    });
  });

  it("does not exceed the delivery concurrency limit", async () => {
    const claims = Array.from({ length: 12 }, (_, index) =>
      claim(`claim-${index}`, `${index}@umass.edu`),
    );
    const { send, worker } = setup(claims);
    let active = 0;
    let maximum = 0;
    send.mockImplementation(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return undefined;
    });

    await expect(runWorker(worker)).resolves.toMatchObject({ claimed: 12, sent: 12 });
    expect(maximum).toBe(DELIVERY_CONCURRENCY);
  });

  it("uses the stable notification id as the mail idempotency key", async () => {
    const { send, worker } = setup([claim("stable-id", "traveler@umass.edu")]);

    await runWorker(worker);
    await runWorker(worker);

    expect(send.mock.calls.map(([email]) => email.idempotencyKey)).toEqual([
      "stable-id",
      "stable-id",
    ]);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: "traveler@umass.edu",
      subject: "You have an airport match",
      text: expect.stringContaining("https://airport-buddy.example/trips"),
    });
  });

  it("records a failed delivery when completion loses lease ownership", async () => {
    const { complete, fail, worker } = setup([claim("lease-lost", "traveler@umass.edu")], {
      complete: false,
    });

    await expect(runWorker(worker)).resolves.toEqual({
      claimed: 1,
      sent: 0,
      failed: 1,
      cancelled: 0,
    });
    expect(complete).toHaveBeenCalledWith({
      notificationId: "lease-lost",
      workerId: "worker-id",
    });
    expect(fail).toHaveBeenCalledWith({
      notificationId: "lease-lost",
      workerId: "worker-id",
      error: "Notification lease expired before completion",
    });
  });

  it("fails the worker when failure recording loses lease ownership", async () => {
    const { worker } = setup([claim("failure-lease-lost", null)], { fail: false });

    await expect(runWorker(worker)).rejects.toThrow(
      "Notification lease expired before failure recording",
    );
  });
});
