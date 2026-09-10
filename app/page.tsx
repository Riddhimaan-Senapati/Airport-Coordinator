import {
  ClockIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

const benefits = [
  {
    title: "Match overlapping windows",
    description: "A match appears only when both travelers' airport waiting windows overlap.",
    icon: UserGroupIcon,
  },
  {
    title: "Choose your window",
    description: "Set how long you can wait and only see arrivals inside that range.",
    icon: ClockIcon,
  },
  {
    title: "Keep access restricted",
    description: "Email addresses stay private until both travelers agree to connect.",
    icon: ShieldCheckIcon,
  },
] as const;

export default function HomePage() {
  return (
    <main className="page-shell">
      <div className="mx-auto max-w-4xl space-y-12">
        <section className="space-y-6 text-center">
          <PaperAirplaneIcon className="mx-auto size-16" aria-hidden="true" />
          <h1 className="text-5xl font-bold tracking-tight">Airport Buddy</h1>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Coordinate airport arrivals with other UMass students and share the ride to campus.
          </p>
          <div className="flex justify-center gap-4">
            <Link className="button-primary" href="/auth/signin">
              Sign in
            </Link>
            <Link className="button-secondary" href="/auth/signup">
              Create account
            </Link>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3" aria-label="Benefits">
          {benefits.map(({ title, description, icon: Icon }) => (
            <article className="panel text-center" key={title}>
              <Icon className="mx-auto mb-4 size-10" aria-hidden="true" />
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-muted-foreground">{description}</p>
            </article>
          ))}
        </section>
        <p className="text-center text-sm text-muted-foreground">
          <Link className="text-link" href="/privacy">
            Read the privacy notice
          </Link>
        </p>
      </div>
    </main>
  );
}
