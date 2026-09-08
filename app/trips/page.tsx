import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "../../lib/auth";
import { SignoutButton } from "./signout-button";
import { TripForm } from "./trip-form";

export default async function TripsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user.id) {
    redirect("/auth/signin");
  }

  return (
    <main className="page-shell">
      <section className="panel mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Find an airport buddy</h1>
            <p className="mt-2 text-muted-foreground">Signed in as {session.user.email}</p>
          </div>
          <SignoutButton />
        </header>
        <TripForm />
      </section>
    </main>
  );
}
