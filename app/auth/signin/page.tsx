import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

import { SigninForm } from "./signin-form";

export default function SigninPage() {
  return (
    <main className="page-shell">
      <section className="panel mx-auto max-w-md space-y-6">
        <div className="text-center">
          <PaperAirplaneIcon className="mx-auto mb-3 size-12" aria-hidden="true" />
          <h1 className="text-3xl font-bold">Sign in</h1>
          <p className="mt-2 text-muted-foreground">Welcome back.</p>
        </div>
        <SigninForm />
        <p className="text-center text-sm text-muted-foreground">
          Need an account?{" "}
          <Link className="text-link" href="/auth/signup">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}
