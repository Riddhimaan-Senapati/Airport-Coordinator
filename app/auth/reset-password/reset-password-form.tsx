"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getTextField } from "../../../lib/form-data";
import { createClient } from "../../../lib/supabase/client";

type ResetPasswordFormProps = { canReset: boolean };

export function ResetPasswordForm({ canReset }: ResetPasswordFormProps) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canReset) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          This reset link is invalid or has expired.
        </p>
        <Link className="button-primary inline-flex" href="/auth/forgot-password">
          Request a new link
        </Link>
      </div>
    );
  }

  function submit(formData: FormData) {
    setError("");
    const newPassword = getTextField(formData, "password");
    const confirmPassword = getTextField(formData, "confirmPassword");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("Use a password between 12 and 128 characters.");
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error: resetError } = await supabase.auth.updateUser({ password: newPassword });

        if (resetError) {
          setError("This reset link is invalid or has expired. Request a new link.");
          return;
        }

        await supabase.auth.signOut();
        router.replace("/auth/signin?reset=success");
        router.refresh();
      } catch {
        setError("Could not reset your password. Try again.");
      }
    });
  }

  return (
    <form action={submit} className="space-y-4">
      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <label className="block space-y-2">
        <span className="text-sm font-medium">New password</span>
        <input
          className="field"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Confirm new password</span>
        <input
          className="field"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <button className="button-primary w-full" type="submit" disabled={pending}>
        {pending ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
}
