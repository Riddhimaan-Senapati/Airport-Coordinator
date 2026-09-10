"use client";

import { useState, useTransition } from "react";

import { getTextField } from "../../../lib/form-data";
import { createClient } from "../../../lib/supabase/client";

type RequestState = { kind: "idle" } | { kind: "error"; message: string } | { kind: "submitted" };

export function ForgotPasswordForm() {
  const [state, setState] = useState<RequestState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setState({ kind: "idle" });
    startTransition(async () => {
      try {
        const supabase = createClient();
        await supabase.auth.resetPasswordForEmail(getTextField(formData, "email"), {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
        });

        setState({ kind: "submitted" });
      } catch {
        setState({ kind: "error", message: "Could not send a reset link. Try again." });
      }
    });
  }

  if (state.kind === "submitted") {
    return (
      <output className="block rounded-md bg-green-50 p-3 text-sm text-green-800">
        If an account exists for that email, we sent a password reset link.
      </output>
    );
  }

  return (
    <form action={submit} className="space-y-4">
      {state.kind === "error" ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
      <label className="block space-y-2">
        <span className="text-sm font-medium">UMass email</span>
        <input className="field" name="email" type="email" autoComplete="email" required />
      </label>
      <button className="button-primary w-full" type="submit" disabled={pending}>
        {pending ? "Sending link..." : "Send reset link"}
      </button>
    </form>
  );
}
