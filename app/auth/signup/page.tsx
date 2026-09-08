import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

import { SignupForm } from "./signup-form";

export default function SignUpPage() {
  return (
    <main className="page-shell">
      <section className="panel mx-auto max-w-md space-y-6">
        <div className="text-center">
          <PaperAirplaneIcon className="mx-auto mb-3 size-12" aria-hidden="true" />
          <h1 className="text-3xl font-bold">Create an account</h1>
          <p className="mt-2 text-muted-foreground">Use your UMass email address.</p>
        </div>
        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="text-link" href="/auth/signin">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
