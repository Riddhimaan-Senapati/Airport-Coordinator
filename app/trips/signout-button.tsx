"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { authClient } from "../../lib/auth-client";

export function SignoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await authClient.signOut();
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <button className="button-secondary" type="button" disabled={pending} onClick={signOut}>
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
