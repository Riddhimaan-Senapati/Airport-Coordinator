"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { createClient } from "../../lib/supabase/client";

export function SignoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
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
