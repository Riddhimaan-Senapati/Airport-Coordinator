import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="page-shell">
      <article className="panel mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Privacy notice</h1>
          <p className="mt-2 text-muted-foreground">Last updated September 8, 2026.</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">What Airport Buddy stores</h2>
          <p>
            Airport Buddy stores your name, UMass email address, password hash, sessions,
            verification and password-reset records, and rate-limit records. Trip data includes the
            airport&apos;s identifier, code, name, municipality, country code, time zone, latitude,
            and longitude. It also includes the arrival instant in UTC, wait time, matching records,
            and contact choices. The app records whether it sent each match email.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Airport catalog</h2>
          <p>
            Airport Buddy uses the public-domain OurAirports catalog to support airports worldwide.
            OurAirports updates its source data nightly. Airport names, codes, municipalities,
            country codes, coordinates, and optional time zones are public airport information
            rather than traveler information.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">How the data is used</h2>
          <p>
            The app uses account data to verify access, keep you signed in, and send account email.
            It uses trip data to find verified UMass travelers at the same airport whose waiting
            windows overlap. The app keeps the arrival instant in UTC and converts it to local time
            for input and display. Match notices do not include another traveler&apos;s email
            address.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">When contact details are shared</h2>
          <p>
            The app reveals email addresses only after both matched travelers choose to connect.
            Either traveler can stop sharing from the trip page.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Retention and deletion</h2>
          <p>
            Each trip expires when its waiting window ends. A match expires when the shorter of its
            two waiting windows ends. The app deletes each remaining notification record 30 days
            after that match ends. Canceling a trip removes the trip, its matches, and its
            notification records. Authentication records remain because the app does not yet offer
            self-service account deletion.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Questions</h2>
          <p>
            For a privacy question or an account-deletion request,{" "}
            <a className="text-link" href="https://github.com/Riddhimaan-Senapati">
              open the project owner&apos;s GitHub profile
            </a>{" "}
            and use a private contact method listed there. Do not put passwords, account details,
            travel details, or verification links in a public issue.
          </p>
        </section>

        <Link className="text-link" href="/">
          Back to Airport Buddy
        </Link>
      </article>
    </main>
  );
}
