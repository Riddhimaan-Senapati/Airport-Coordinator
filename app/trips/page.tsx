import { redirect } from "next/navigation";

import { createClient } from "../../lib/supabase/server";
import { getTripDashboard } from "../../lib/trips";
import { SignoutButton } from "./signout-button";
import { TripDashboard } from "./trip-dashboard";
import { TripForm } from "./trip-form";

export default async function TripsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/auth/signin");
  const dashboard = await getTripDashboard();

  return (
    <main className="page-shell">
      <section className="panel mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Find an airport buddy</h1>
            <p className="mt-2 text-muted-foreground">Signed in as {data.user.email}</p>
          </div>
          <SignoutButton />
        </header>
        <TripForm trip={dashboard.trip} />
        <TripDashboard dashboard={dashboard} />
      </section>
    </main>
  );
}
