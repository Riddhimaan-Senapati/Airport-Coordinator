"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getTextField } from "../../../lib/form-data";
import { createClient } from "../../../lib/supabase/client";

type SigninFormProps = {
  initialError?: string;
  notice?: string;
};

export function SigninForm({ initialError = "", notice }: SigninFormProps) {
  const [error, setError] = useState(initialError);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: getTextField(formData, "email"),
          password: getTextField(formData, "password"),
        });

        if (signInError) {
          setError("Invalid email or password, or the email has not been verified.");
          return;
        }

        router.replace("/trips");
        router.refresh();
      } catch {
        setError("Could not sign in. Try again.");
      }
    });
  }

  return (
    <form action={submit} className="space-y-4">
      {notice ? (
        <output className="block rounded-md bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </output>
      ) : null}
      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <label className="block space-y-2">
        <span className="text-sm font-medium">UMass email</span>
        <input className="field" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Password</span>
        <input
          className="field"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
        />
      </label>
      <button className="button-primary w-full" type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
