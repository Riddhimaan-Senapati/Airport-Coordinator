"use client";

import { useState, useTransition } from "react";

import { authClient } from "../../../lib/auth-client";
import { getTextField } from "../../../lib/form-data";
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
    const email = emailSchema.safeParse(getTextField(formData, "email"));
    if (!email.success) {
      setMessage(email.error.issues[0]?.message ?? "Use a valid @umass.edu email address.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const { error } = await authClient.signUp.email({
        name: getTextField(formData, "name"),
        email: email.data,
        password,
        callbackURL: "/trips",
      });

      if (error) {
        setMessage(error.message ?? "Could not create the account.");
        return;
      }

      setSuccess(true);
      setMessage("Check your UMass inbox to verify your email, then sign in.");
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
