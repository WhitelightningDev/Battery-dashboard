import type { ReactNode } from "react";

interface DashboardShellProps {
  children: ReactNode;
}

/** Render the shared page heading and constrain dashboard content width. */
export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <p className="eyebrow">Energy analytics</p>
        <h1>Battery Revenue Mini-Dashboard</h1>
        <p className="subtitle">
          Configure commercial terms using the available pricing scenarios.
        </p>
      </header>
      {children}
    </main>
  );
}
