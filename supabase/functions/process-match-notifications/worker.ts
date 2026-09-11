export const CLAIM_BATCH_SIZE = 50;
export const LEASE_SECONDS = 360;
export const DELIVERY_CONCURRENCY = 5;
export const DELIVERY_TIMEOUT_MS = 30_000;
const MAX_ERROR_LENGTH = 2000;

export type NotificationClaim = Readonly<{
  id: string;
  match_id: string;
  recipient_email: string | null;
}>;

export type ClaimBatch = Readonly<{
  claims: NotificationClaim[];
  cancelled: number;
}>;

export type NotificationEmail = Readonly<{
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}>;

export type WorkerResult = Readonly<{
  claimed: number;
  sent: number;
  failed: number;
  cancelled: number;
}>;

export interface NotificationQueue {
  claimBatch(input: {
    workerId: string;
    batchSize: number;
    leaseSeconds: number;
  }): Promise<ClaimBatch>;
  complete(input: { notificationId: string; workerId: string }): Promise<boolean>;
  fail(input: { notificationId: string; workerId: string; error: string }): Promise<boolean>;
}

export interface MailTransport {
  send(email: NotificationEmail): Promise<void>;
}

export type WorkerOptions = Readonly<{
  workerId: string;
  appUrl: URL;
  emailFrom: string;
  queue: NotificationQueue;
  mail: MailTransport;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseClaimBatch(value: unknown): ClaimBatch {
  if (!isRecord(value) || !Array.isArray(value.claims)) {
    throw new Error("Invalid notification claim response");
  }

  const claims = value.claims.map((claim) => {
    if (
      !isRecord(claim) ||
      typeof claim.id !== "string" ||
      typeof claim.match_id !== "string" ||
      (claim.recipient_email !== null && typeof claim.recipient_email !== "string")
    ) {
      throw new Error("Invalid notification claim response");
    }
    return {
      id: claim.id,
      match_id: claim.match_id,
      recipient_email: claim.recipient_email,
    };
  });

  if (
    typeof value.cancelled !== "number" ||
    !Number.isSafeInteger(value.cancelled) ||
    value.cancelled < 0
  ) {
    throw new Error("Invalid notification claim response");
  }

  return { claims, cancelled: value.cancelled };
}

function boundedError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "Unknown delivery failure";
  return message.slice(0, MAX_ERROR_LENGTH);
}

function renderEmail(claim: NotificationClaim, appUrl: URL, emailFrom: string): NotificationEmail {
  const tripsUrl = new URL("/trips", appUrl).toString();
  return {
    from: emailFrom,
    to: claim.recipient_email ?? "",
    subject: "You have an airport match",
    html:
      '<p>Airport Buddy found another traveler whose airport wait overlaps yours.</p><p><a href="' +
      tripsUrl +
      '">Review your match</a> to decide whether to share contact details.</p>',
    text:
      "Airport Buddy found another traveler whose airport wait overlaps yours. Review your match: " +
      tripsUrl,
    idempotencyKey: claim.id,
  };
}

async function runBounded<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await task(item);
    }
  };
  const runners: Promise<void>[] = [];
  for (let lane = 0; lane < Math.min(limit, items.length); lane += 1) {
    runners.push(worker());
  }
  await Promise.all(runners);
}

export async function runWorker({
  workerId,
  appUrl,
  emailFrom,
  queue,
  mail,
}: WorkerOptions): Promise<WorkerResult> {
  const result = await queue.claimBatch({
    workerId,
    batchSize: CLAIM_BATCH_SIZE,
    leaseSeconds: LEASE_SECONDS,
  });
  let sent = 0;
  let failed = 0;

  await runBounded(result.claims, DELIVERY_CONCURRENCY, async (claim) => {
    try {
      if (!claim.recipient_email) throw new Error("Recipient has no email address");

      await mail.send(renderEmail(claim, appUrl, emailFrom));
      const completed = await queue.complete({
        notificationId: claim.id,
        workerId,
      });
      if (!completed) throw new Error("Notification lease expired before completion");
      sent += 1;
    } catch (cause) {
      failed += 1;
      const error = boundedError(cause);
      const recorded = await queue.fail({
        notificationId: claim.id,
        workerId,
        error,
      });
      if (!recorded) throw new Error("Notification lease expired before failure recording");
    }
  });

  return {
    claimed: result.claims.length,
    sent,
    failed,
    cancelled: result.cancelled,
  };
}
