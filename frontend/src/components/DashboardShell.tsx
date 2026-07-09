import type { ReactNode } from "react";

interface DashboardShellProps {
  children: ReactNode;
}

/** Render the SaaS-style application frame around the dashboard workspace. */
export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="app-shell">
      <aside className="side-nav" aria-label="Primary navigation">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <div>
            <strong>Basis Energy</strong>
            <span>Capital dashboard</span>
          </div>
        </div>

        <nav className="nav-menu">
          <a className="nav-item nav-item-active" href="#fan-chart-title">
            <span aria-hidden="true">◒</span>
            Forecast fan
          </a>
          <a className="nav-item" href="#deal-terms-title">
            <span aria-hidden="true">▣</span>
            Deal terms
          </a>
          <a className="nav-item nav-item-muted" href="#headline-price-title">
            <span aria-hidden="true">◌</span>
            Pricing cell
          </a>
        </nav>

        <div className="side-nav-footer">
          <span>Dataset</span>
          <strong>take-home v2</strong>
        </div>
      </aside>

      <main className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Energy analytics</p>
            <h1>Battery dashboard</h1>
            <p className="subtitle">
              Pricing controls on the left. Forecast fan on the right.
            </p>
          </div>
          <div className="dashboard-header-meta" aria-label="Dashboard status">
            <span>Mode</span>
            <strong>Fan chart</strong>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
