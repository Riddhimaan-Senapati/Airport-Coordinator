import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

import { SigninForm } from "./signin-form";

type SigninPageProps = {
  searchParams: Promise<{ error?: string | string[]; reset?: string | string[] }>;
};

export default async function SigninPage({ searchParams }: SigninPageProps) {
  const { error, reset } = await searchParams;
  const notice =
    reset === "success" ? "Password updated. Sign in with your new password." : undefined;
  const initialError =
    error === "callback" ? "This authentication link is invalid or has expired." : undefined;

  return (
    <main className="page-shell">
      <section className="panel mx-auto max-w-md space-y-6">
        <div className="text-center">
          <PaperAirplaneIcon className="mx-auto mb-3 size-12" aria-hidden="true" />
          <h1 className="text-3xl font-bold">Sign in</h1>
          <p className="mt-2 text-muted-foreground">Welcome back.</p>
        </div>
        <SigninForm initialError={initialError} notice={notice} />
        <p className="text-center text-sm">
          <Link className="text-link" href="/auth/forgot-password">
            Forgot your password?
          </Link>
        </p>
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
