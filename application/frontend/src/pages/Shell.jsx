import { useState } from "react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, ChevronDown, FlaskConical, LayoutDashboard, Loader2, LogOut, Plus, Sparkles } from "lucide-react";
import { useAuth, usePortfolios } from "../state";
import { api } from "../api";
import { Button, Logo, ThemeToggle, Skeleton } from "../ui";

const nav = [
  { to: "/app", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/app/risk", label: "Risk Lab", icon: FlaskConical },
];

function Onboarding() {
  const { refresh, select } = usePortfolios();
  const [busy, setBusy] = useState(null);
  const make = async (kind) => {
    setBusy(kind);
    try { const p = kind === "demo" ? await api.createDemo() : await api.createPortfolio("My Portfolio"); await refresh(); select(p.id); } finally { setBusy(null); }
  };
  return (
    <div className="mx-auto mt-16 max-w-xl text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand2 text-bg"><Sparkles /></div>
      <h2 className="text-2xl font-bold">Let's set up your first portfolio</h2>
      <p className="mt-2 text-sm text-muted">Load a labelled sample portfolio to explore every analysis, or start empty and add transactions or import a CSV.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Button size="lg" onClick={() => make("demo")} disabled={!!busy}>{busy === "demo" && <Loader2 size={16} className="animate-spin" />}Load demo portfolio</Button>
        <Button size="lg" variant="ghost" onClick={() => make("empty")} disabled={!!busy}>Start empty</Button>
      </div>
    </div>
  );
}

function Switcher() {
  const { list, selected, select, refresh } = usePortfolios();
  const [open, setOpen] = useState(false);
  const cur = list?.find((p) => p.id === selected);
  const add = async () => {
    const name = window.prompt("Portfolio name");
    if (!name?.trim()) return;
    const p = await api.createPortfolio(name.trim()); await refresh(); select(p.id); setOpen(false);
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-raised/50 px-3 py-2.5 text-left text-sm hover:bg-raised">
        <span className="min-w-0"><span className="block text-[10px] uppercase tracking-wider text-muted">Portfolio</span><span className="block truncate font-medium">{cur?.name || "—"}</span></span>
        <ChevronDown size={15} className="text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
          {list.map((p) => (
            <button key={p.id} onClick={() => { select(p.id); setOpen(false); }} className={`block w-full truncate px-3 py-2.5 text-left text-sm hover:bg-raised ${p.id === selected ? "text-brand" : ""}`}>{p.name}</button>
          ))}
          <button onClick={add} className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-sm text-muted hover:bg-raised hover:text-fg"><Plus size={14} /> New portfolio</button>
        </div>
      )}
    </div>
  );
}

export default function Shell() {
  const { user, logout } = useAuth();
  const { list } = usePortfolios();
  if (user === null) return <Navigate to="/auth" replace />;
  const initials = (user?.displayName || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-surface/70 p-4 backdrop-blur-xl lg:flex">
        <div className="px-2 pb-5 pt-2"><Logo /></div>
        {list && list.length > 0 && <Switcher />}
        <nav className="mt-5 space-y-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "text-fg" : "text-muted hover:text-fg"}`}>
              {({ isActive }) => (<>
                {isActive && <motion.span layoutId="pill" className="absolute inset-0 rounded-xl border border-brand/20 bg-brand/10" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                <n.icon size={17} className={`relative ${isActive ? "text-brand" : ""}`} /><span className="relative">{n.label}</span>
              </>)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-line bg-raised/40 p-3 text-[11px] leading-relaxed text-muted">Read-only analytics. Not investment advice. Forecasts show assumptions and uncertainty.</div>
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-raised/40 p-2.5">
            {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" /> : <div className="grid h-8 w-8 place-items-center rounded-full bg-brand/20 text-sm font-semibold text-brand">{initials}</div>}
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{user?.displayName || "Investor"}</div><div className="truncate text-[11px] text-muted">{user?.email}</div></div>
            <ThemeToggle />
            <button onClick={logout} aria-label="Sign out" className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-down"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo size={28} />
        <div className="flex items-center gap-2"><ThemeToggle /><button onClick={logout} aria-label="Sign out" className="rounded-xl border border-line p-2 text-muted"><LogOut size={16} /></button></div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
        {user === undefined || list === null ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : list.length === 0 ? <Onboarding /> : <Outlet />}
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl border border-line bg-surface/90 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium ${isActive ? "bg-brand/10 text-brand" : "text-muted"}`}><n.icon size={18} />{n.label}</NavLink>
        ))}
      </nav>
    </div>
  );
}
