import { Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, ShieldCheck, LayoutDashboard, ScanLine, CreditCard, User, LogOut, ChevronDown, Wand2, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/authStore";
import { useAnalysisStore } from "@/lib/analysisStore";

export function Navbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const resetAnalysis = useAnalysisStore((s) => s.reset);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    clearUser();      // clears localStorage + Zustand state → Navbar re-renders instantly
    resetAnalysis();  // wipe stale analysis data
    setDropOpen(false);
    navigate({ to: "/" });
  };

  const linkCls =
    "rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";
  const activeCls = "text-foreground font-semibold bg-muted/60";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[85rem] items-center justify-between px-6">

        {/* Logo */}
        <Link
          to={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 select-none"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-base font-bold tracking-tight">MoneyMirror</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">AI</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {user ? (
            <>
              {/* ── Logged-in links ── */}
              <Link to="/dashboard" className={linkCls} activeProps={{ className: activeCls }} activeOptions={{ exact: true }}>
                <span className="inline-flex items-center gap-1.5">
                  <LayoutDashboard className="h-3.5 w-3.5" /> Home
                </span>
              </Link>
              <Link to="/analyze" className={linkCls} activeProps={{ className: activeCls }}>
                <span className="inline-flex items-center gap-1.5">
                  <ScanLine className="h-3.5 w-3.5" /> Analyze
                </span>
              </Link>
              <Link to="/subscriptions" className={linkCls} activeProps={{ className: activeCls }}>
                <span className="inline-flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Subscription Creep
                </span>
              </Link>
              <Link to="/personalize" className={linkCls} activeProps={{ className: activeCls }}>
                <span className="inline-flex items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5" /> Personalize
                </span>
              </Link>
              <Link to="/chat" className={linkCls} activeProps={{ className: activeCls }}>
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Chat
                </span>
              </Link>
              <Link
                to="/scam-shield"
                className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:shadow-card transition-shadow"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-success" /> Scam Shield
              </Link>

              {/* Profile dropdown */}
              <div className="relative ml-2" ref={dropRef}>
                <button
                  onClick={() => setDropOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted transition-colors"
                >
                  {user.profile_image ? (
                    <img src={user.profile_image} className="h-6 w-6 rounded-full object-cover" alt="" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-hero text-[11px] font-bold text-primary-foreground">
                      {user.name?.[0]?.toUpperCase() ?? "U"}
                    </span>
                  )}
                  <span className="max-w-[90px] truncate">{user.name?.split(" ")[0]}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${dropOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {dropOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-border bg-card p-1.5 shadow-elevated animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <div className="text-xs font-semibold text-foreground truncate">{user.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setDropOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <User className="h-4 w-4" /> Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* ── Logged-out links ── */}
              <Link
                to="/"
                className={linkCls}
                activeProps={{ className: activeCls }}
                activeOptions={{ exact: true }}
              >
                Home
              </Link>
              <Link
                to="/chat"
                className={linkCls}
                activeProps={{ className: activeCls }}
              >
                Chat
              </Link>
              <Link
                to="/scam-shield"
                className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:shadow-card transition-shadow"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-success" /> Scam Shield
              </Link>
              <Link
                to="/login"
                className="ml-2 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-elevated hover:scale-[1.02] transition-transform"
              >
                Sign In
              </Link>
            </>
          )}
        </nav>

        {/* Mobile avatar / sign-in */}
        <div className="flex items-center gap-2 md:hidden">
          {user ? (
            <Link
              to="/dashboard"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-hero text-[12px] font-bold text-primary-foreground"
            >
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </Link>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
            >
              Sign In
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto flex max-w-[85rem] flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground md:flex-row">
        <span>© {new Date().getFullYear()} MoneyMirror AI — Your financial future, explained in 60 seconds.</span>
        <span>Built for the modern Indian saver.</span>
      </div>
    </footer>
  );
}
