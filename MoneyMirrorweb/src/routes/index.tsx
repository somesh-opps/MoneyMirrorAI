import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Activity, Search, Users, ShieldCheck, Zap, Sparkles } from "lucide-react";
import { useAnalysisStore } from "@/lib/analysisStore";
import { demoTransactions } from "@/services/api";
import { useAuthStore } from "@/lib/authStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MoneyMirror AI — Your Financial Future, Explained in 60 Seconds" },
      { name: "description", content: "AI-powered financial health check. Detect hidden expenses, simulate your financial twin, and stay scam-safe." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Activity, title: "Financial Doctor", desc: "Instant health check of your spending patterns and savings discipline.", tone: "from-blue-500/15" },
  { icon: Search, title: "Invisible Expense Detector", desc: "Find subscriptions and silent leaks draining your account every month.", tone: "from-amber-500/15" },
  { icon: Users, title: "Financial Twin", desc: "Simulate your future net worth — current path vs. AI-optimized path.", tone: "from-emerald-500/15" },
  { icon: ShieldCheck, title: "Scam Shield AI", desc: "Paste any suspicious SMS or email. Get a risk score in seconds.", tone: "from-rose-500/15" },
  { icon: Zap, title: "Intervention Engine", desc: "Concrete, ranked actions to fix your finances — not generic advice.", tone: "from-violet-500/15" },
];

function Landing() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setAll = useAnalysisStore((s) => s.setAll);

  // Logged-in users belong on the dashboard, not the marketing/about page
  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const tryDemo = () => {
    setAll({
      transactions: demoTransactions,
      income: 85000,
      expenses: 52000,
      savings: 120000,
    });
    navigate({ to: "/results", search: { demo: true } as any });
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
          <div className="absolute bottom-0 right-10 h-72 w-72 rounded-full bg-chart-1/20 blur-[100px]" />
        </div>
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-card">
              <Sparkles className="h-3 w-3 text-accent" /> AI-powered personal finance
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
              Your financial future,<br />
              <span className="bg-gradient-to-r from-foreground via-foreground to-accent bg-clip-text text-transparent">
                explained in 60 seconds.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              Upload your transactions. We'll diagnose your spending, expose hidden expenses, and project the version of you that follows our advice.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/login"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-elevated transition-all hover:scale-[1.02]"
              >
                Start Financial Analysis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <button
                onClick={tryDemo}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground shadow-card transition-all hover:bg-muted"
              >
                Try Demo Dataset
              </button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">No signup. No data leaves your browser unless you connect a backend.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Five Lenses</div>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">Everything your money advisor should have told you.</h2>
          </div>
          <Link to="/scam-shield" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:underline">
            <ShieldCheck className="h-4 w-4" /> Try Scam Shield <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`group relative overflow-hidden rounded-3xl border border-border bg-card p-7 shadow-card transition-all hover:-translate-y-1 hover:shadow-elevated ${i === 2 ? "lg:row-span-2 lg:col-start-2 lg:row-start-1" : ""}`}
            >
              <div className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${f.tone} to-transparent blur-2xl`} />
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="mx-auto mb-20 max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-10 text-primary-foreground shadow-elevated md:p-14">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h3 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Ready to meet your financial twin?</h3>
              <p className="mt-2 max-w-md text-sm text-primary-foreground/70">Takes under 2 minutes. Bring a CSV of last month's transactions or use our demo dataset.</p>
            </div>
            <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-bold text-accent-foreground shadow-glow hover:scale-[1.02]">
              Start now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
