import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Airport Buddy",
  description: "Coordinate airport arrivals with other UMass students.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
