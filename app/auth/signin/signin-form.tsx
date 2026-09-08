"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { authClient } from "../../../lib/auth-client";
import { getTextField } from "../../../lib/form-data";

export function SigninForm() {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await authClient.signIn.email({
        email: getTextField(formData, "email"),
        password: getTextField(formData, "password"),
        callbackURL: "/trips",
      });

      if (result.error) {
        setError(result.error.message ?? "Invalid email or password.");
        return;
      }

      router.replace("/trips");
      router.refresh();
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
