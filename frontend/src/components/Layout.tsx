import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/" },
    { name: "Transactions", path: "/transactions" },
    { name: "Counterparties", path: "/entities" },
    { name: "Import Statement", path: "/upload" },
    { name: "Import History", path: "/accounts" },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <Link to="/" className="text-xl font-bold tracking-tight text-slate-900">
            LedgerMind
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200 text-xs text-slate-400">
          Exasol Hackathon 2026
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}