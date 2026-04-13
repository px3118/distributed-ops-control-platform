import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "../components/navigation";

export const metadata: Metadata = {
  title: "Distributed Ops Control Platform",
  description: "Operational workbench for serialized asset control"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-[1400px] p-6">
          <header className="mb-6 rounded-lg border border-line bg-panel px-5 py-4">
            <h1 className="text-xl font-semibold">Distributed Ops Control Platform</h1>
            <p className="mt-1 text-sm text-fgMuted">
              A distributed operations control system that models how real-world systems drift out of sync and how that drift is detected and reconciled.
            </p>
            <p className="mt-1 text-sm text-fgMuted">
              This project demonstrates event-driven state, projection consistency, and operator workflows for resolving inconsistencies across distributed sites.
            </p>
            <Navigation />
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
