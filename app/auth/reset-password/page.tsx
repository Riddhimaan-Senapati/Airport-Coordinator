import { KeyIcon } from "@heroicons/react/24/outline";

import { getCurrentUser } from "../../../lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  return (
    <main className="page-shell">
      <section className="panel mx-auto max-w-md space-y-6">
        <div className="text-center">
          <KeyIcon className="mx-auto mb-3 size-12" aria-hidden="true" />
          <h1 className="text-3xl font-bold">Choose a new password</h1>
          <p className="mt-2 text-muted-foreground">Use at least 12 characters.</p>
        </div>
        <ResetPasswordForm canReset={Boolean(user)} />
      </section>
    </main>
  );
}
