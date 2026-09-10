import { KeyIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="page-shell">
      <section className="panel mx-auto max-w-md space-y-6">
        <div className="text-center">
          <KeyIcon className="mx-auto mb-3 size-12" aria-hidden="true" />
          <h1 className="text-3xl font-bold">Reset your password</h1>
          <p className="mt-2 text-muted-foreground">
            Enter your UMass email and we will send you a reset link.
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="text-center text-sm">
          <Link className="text-link" href="/auth/signin">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
