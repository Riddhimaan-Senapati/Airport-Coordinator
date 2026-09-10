"use client";

import { useState, useTransition } from "react";

import { getTextField } from "../../../lib/form-data";
import { createClient } from "../../../lib/supabase/client";
import { emailSchema } from "../../../lib/validation";

export function SignupForm() {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage("");
    setSuccess(false);

    const password = getTextField(formData, "password");
    const confirmPassword = getTextField(formData, "confirmPassword");
    const name = getTextField(formData, "name").trim();
    const email = emailSchema.safeParse(getTextField(formData, "email"));
    if (!email.success) {
      setMessage(email.error.issues[0]?.message ?? "Use a valid @umass.edu email address.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 12 || password.length > 128 || !name) {
      setMessage("Enter your name and a password between 12 and 128 characters.");
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signUp({
          email: email.data,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/trips`,
          },
        });

        if (error) {
          setMessage("Could not create the account. Check the details or try again later.");
          return;
        }

        setSuccess(true);
        setMessage("Check your UMass inbox to verify your email, then sign in.");
      } catch {
        setMessage("Could not create the account. Try again later.");
      }
    });
  }

  return (
    <form action={submit} className="space-y-4">
      {message ? (
        <p
          className={`rounded-md p-3 text-sm ${success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}
          role={success ? "status" : "alert"}
        >
          {message}
        </p>
      ) : null}
      <label className="block space-y-2">
        <span className="text-sm font-medium">Name</span>
        <input className="field" name="name" autoComplete="name" required />
      </label>
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
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Confirm password</span>
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
        {pending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
