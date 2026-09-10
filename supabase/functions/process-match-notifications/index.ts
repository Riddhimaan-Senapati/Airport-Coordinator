import { createClient } from "npm:@supabase/supabase-js@2.116.0";

type Claim = { id: string; match_id: string; recipient_email: string | null };
type ClaimResult = { claims: Claim[]; cancelled: number };

const DELIVERY_CONCURRENCY = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(name + " is required");
  return value;
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

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const workerSecret = requiredEnv("MATCH_NOTIFICATION_WORKER_SECRET");
    if (request.headers.get("authorization") !== "Bearer " + workerSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const resendKey = requiredEnv("RESEND_API_KEY");
    const emailFrom = requiredEnv("EMAIL_FROM");
    const appUrl = new URL(requiredEnv("APP_URL"));
    const workerId = crypto.randomUUID();
    const { data, error } = await supabase.rpc("claim_notification_batch", {
      p_worker_id: workerId,
      p_batch_size: 50,
      p_lease_seconds: 120,
    });
    if (error) throw error;

    const result = (data ?? {}) as ClaimResult;
    const claims = result.claims ?? [];
    let sent = 0;
    let failed = 0;
    const cancelled = result.cancelled ?? 0;

    await runBounded(claims, DELIVERY_CONCURRENCY, async (claim) => {
      try {
        const recipient = claim.recipient_email;
        if (!recipient) throw new Error("Recipient has no email address");

        const tripsUrl = new URL("/trips", appUrl).toString();
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: "Bearer " + resendKey,
            "content-type": "application/json",
            "idempotency-key": claim.id,
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [recipient],
            subject: "You have an airport match",
            html:
              '<p>Airport Buddy found another traveler whose airport wait overlaps yours.</p><p><a href="' +
              tripsUrl +
              '">Review your match</a> to decide whether to share contact details.</p>',
            text:
              "Airport Buddy found another traveler whose airport wait overlaps yours. Review your match: " +
              tripsUrl,
          }),
        });
        if (!response.ok) {
          throw new Error("Resend returned " + response.status + ": " + (await response.text()));
        }

        const completion = await supabase.rpc("complete_notification", {
          p_notification_id: claim.id,
          p_worker_id: workerId,
        });
        if (completion.error) throw completion.error;
        if (!completion.data) throw new Error("Notification lease expired before completion");
        sent += 1;
      } catch (cause) {
        failed += 1;
        await supabase.rpc("fail_notification", {
          p_notification_id: claim.id,
          p_worker_id: workerId,
          p_error: cause instanceof Error ? cause.message : "Unknown delivery failure",
        });
      }
    });

    return json({ claimed: claims.length, sent, failed, cancelled });
  } catch (cause) {
    return json(
      { error: cause instanceof Error ? cause.message : "Notification worker failed" },
      500,
    );
  }
});
