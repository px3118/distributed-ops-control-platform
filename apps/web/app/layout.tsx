import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "../components/navigation";
import { ThemeToggle } from "../components/theme-toggle";

export const metadata: Metadata = {
  title: "Distributed Ops Control Platform",
  description: "Operational workbench for serialized asset control"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    (function () {
      try {
        var key = "ops_theme_mode";
        var saved = localStorage.getItem(key) || "system";
        var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        var resolved = saved === "system" ? (prefersDark ? "dark" : "light") : saved;
        var root = document.documentElement;
        root.classList.toggle("theme-dark", resolved === "dark");
        root.classList.toggle("theme-light", resolved === "light");
        root.setAttribute("data-theme", resolved);
      } catch (err) {
        document.documentElement.classList.add("theme-light");
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="mx-auto min-h-screen max-w-[1480px] px-4 py-6 md:px-6 md:py-7">
          <header className="mb-6 rounded-2xl border border-line bg-panel px-5 py-5 md:px-7 md:py-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="max-w-5xl">
                <div className="text-xs font-semibold tracking-wide text-fgMuted">
                  Operations Workbench
                </div>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-fg md:text-[2.1rem]">
                  Distributed Ops Control Platform
                </h1>
                <p className="mt-3 text-[15px] text-fgMuted">
                  A distributed operations control system that models how real-world systems drift out of sync and how that drift is detected and reconciled.
                </p>
                <p className="mt-1 text-[15px] text-fgMuted">
                  This project demonstrates event-driven state, projection consistency, and operator workflows for resolving inconsistencies across distributed sites.
                </p>
              </div>
              <ThemeToggle />
            </div>
            <Navigation />
            <p className="mt-4 rounded-lg border border-line bg-panelMuted px-3 py-2.5 text-sm text-fgMuted">
              Workflow: select a row, review the summary panel, then open detail when needed.
            </p>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
