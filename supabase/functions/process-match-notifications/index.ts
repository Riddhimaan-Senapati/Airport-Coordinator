import { createClient } from "npm:@supabase/supabase-js@2.116.0";

type Notification = { id: string; recipient_user_id: string };

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

    let sent = 0;
    let failed = 0;
    let cancelled = 0;
    for (const notification of (data ?? []) as Notification[]) {
      try {
        const userResult = await supabase.auth.admin.getUserById(notification.recipient_user_id);
        if (userResult.error) throw userResult.error;
        const recipient = userResult.data.user?.email;
        if (!recipient) throw new Error("Recipient has no email address");

        const tripsUrl = new URL("/trips", appUrl).toString();
        const deliveryCheck = await supabase.rpc("notification_is_deliverable", {
          p_notification_id: notification.id,
          p_worker_id: workerId,
        });
        if (deliveryCheck.error) throw deliveryCheck.error;
        if (!deliveryCheck.data) {
          cancelled += 1;
          continue;
        }

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: "Bearer " + resendKey,
            "content-type": "application/json",
            "idempotency-key": notification.id,
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
          p_notification_id: notification.id,
          p_worker_id: workerId,
        });
        if (completion.error) throw completion.error;
        if (!completion.data) throw new Error("Notification lease expired before completion");
        sent += 1;
      } catch (cause) {
        failed += 1;
        await supabase.rpc("fail_notification", {
          p_notification_id: notification.id,
          p_worker_id: workerId,
          p_error: cause instanceof Error ? cause.message : "Unknown delivery failure",
        });
      }
    }

    return json({ claimed: (data ?? []).length, sent, failed, cancelled });
  } catch (cause) {
    return json(
      { error: cause instanceof Error ? cause.message : "Notification worker failed" },
      500,
    );
  }
});
