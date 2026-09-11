import { createClient } from "npm:@supabase/supabase-js@2.116.0";

import {
  runWorker,
  DELIVERY_TIMEOUT_MS,
  type MailTransport,
  parseClaimBatch,
  type NotificationQueue,
} from "./worker.ts";

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

function createQueue(supabase: ReturnType<typeof createClient>): NotificationQueue {
  return {
    async claimBatch({ workerId, batchSize, leaseSeconds }) {
      const { data, error } = await supabase.rpc("claim_notification_batch", {
        p_worker_id: workerId,
        p_batch_size: batchSize,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw error;

      return parseClaimBatch(data);
    },
    async complete({ notificationId, workerId }) {
      const { data, error } = await supabase.rpc("complete_notification", {
        p_notification_id: notificationId,
        p_worker_id: workerId,
      });
      if (error) throw error;
      return Boolean(data);
    },
    async fail({ notificationId, workerId, error: message }) {
      const { data, error } = await supabase.rpc("fail_notification", {
        p_notification_id: notificationId,
        p_worker_id: workerId,
        p_error: message,
      });
      if (error) throw error;
      return Boolean(data);
    },
  };
}

function createMailTransport(resendKey: string): MailTransport {
  return {
    async send(email) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: "Bearer " + resendKey,
          "content-type": "application/json",
          "idempotency-key": email.idempotencyKey,
        },
        body: JSON.stringify({
          from: email.from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });
      if (!response.ok) {
        const message = (await response.text()).slice(0, 2000);
        throw new Error("Resend returned " + response.status + ": " + message);
      }
    },
  };
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
    const result = await runWorker({
      workerId: crypto.randomUUID(),
      appUrl: new URL(requiredEnv("APP_URL")),
      emailFrom: requiredEnv("EMAIL_FROM"),
      queue: createQueue(supabase),
      mail: createMailTransport(requiredEnv("RESEND_API_KEY")),
    });

    return json(result);
  } catch (cause) {
    return json(
      { error: cause instanceof Error ? cause.message : "Notification worker failed" },
      500,
    );
  }
});
