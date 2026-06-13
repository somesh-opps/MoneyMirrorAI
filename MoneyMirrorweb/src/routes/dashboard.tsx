import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight, CreditCard, ScanLine, ShieldCheck, Sparkles, TrendingUp, Wand2,
  CircleDollarSign, CalendarDays, User
} from "lucide-react";
import { formatINR, useAnalysisStore } from "@/lib/analysisStore";
import { useAuthStore } from "@/lib/authStore";
import { getAnalysisHistory } from "@/services/api";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MoneyMirror AI" },
      { name: "description", content: "Your MoneyMirror AI home — insights, tools, and financial health at a glance." },
    ],
  }),
  component: DashboardPage,
});



function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { doctor, twin, analysisMonth, setAll } = useAnalysisStore();

  // Redirect if not logged in
  useEffect(() => {
    if (!user) navigate({ to: "/login" });
  }, [user, navigate]);

  // Auto-fetch latest analysis if not already loaded in store
  useEffect(() => {
    if (!user || !user.user_id) return;
    
    // Fetch doctor if missing
    if (!doctor) {
      getAnalysisHistory(user.user_id, "doctor", 1).then((res) => {
        if (res.analyses && res.analyses.length > 0) {
          const latest = res.analyses[0];
          setAll({
            doctor: latest.result as any,
            income: latest.inputs?.monthly_income || 0,
            expenses: latest.inputs?.monthly_expenses || 0,
            savings: latest.inputs?.current_savings || 0,
            analysisMonth: latest.month || new Date(latest.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          });
        }
      }).catch(console.error);
    }
    
    // Fetch twin if missing
    if (!twin) {
      getAnalysisHistory(user.user_id, "twin", 1).then((res) => {
        if (res.analyses && res.analyses.length > 0) {
          setAll({ twin: res.analyses[0].result as any });
        }
      }).catch(console.error);
    }
  }, [user, doctor, twin, setAll]);

  if (!user) return null;

  const firstName = user.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const hasResults = !!doctor;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16 space-y-12">

      {/* ── Hero welcome ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-10 text-primary-foreground shadow-elevated">
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" /> MoneyMirror AI
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
              {greeting}, {firstName}! 👋
            </h1>
            <p className="mt-3 max-w-lg text-sm text-primary-foreground/70">
              Your AI-powered financial co-pilot is ready. Analyze your spending, simulate your financial twin, and shield yourself from scams.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end shrink-0">
            <Link
              to="/analyze"
              className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-bold text-accent-foreground shadow-glow transition-all hover:scale-[1.03]"
            >
              Start Analysis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {hasResults && analysisMonth && (
              <span className="inline-flex items-center gap-1.5 text-xs text-primary-foreground/60">
                <CalendarDays className="h-3.5 w-3.5" /> Last analysis: {analysisMonth}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick stats (only if previous results exist) ── */}
      {hasResults && doctor && (
        <section>
          <h2 className="font-display text-xl font-bold mb-4">Your Last Analysis</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              icon={<Sparkles className="h-5 w-5 text-accent" />}
              label="Health Score"
              value={`${doctor.summary.score}/100`}
              sub={doctor.summary.status}
              accent
            />
            <StatCard
              icon={<CircleDollarSign className="h-5 w-5 text-chart-1" />}
              label="Total Spent"
              value={formatINR(doctor.summary.total_spent)}
              sub={`${doctor.summary.transactions_count} transactions`}
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5 text-success" />}
              label="5-Year Wealth"
              value={twin ? formatINR(twin.optimized_milestones?.["5_year"] ?? twin.projected_savings) : "—"}
              sub={twin?.persona}
            />
            <StatCard
              icon={<CalendarDays className="h-5 w-5 text-chart-3" />}
              label="Month"
              value={analysisMonth || "—"}
              sub="Analysis period"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
            >
              Re-analyze <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* ── Tool cards ── */}
      <section>
        <h2 className="font-display text-xl font-bold mb-6">What do you want to do?</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <ToolCard
            to="/analyze"
            icon={<ScanLine className="h-6 w-6" />}
            color="from-accent/20 to-accent/5 border-accent/30"
            iconColor="text-accent"
            title="Analyze Spending"
            description="Upload transactions or enter expenses manually. Get your financial health score in seconds."
            cta="Start now"
          />
          <ToolCard
            to="/subscriptions"
            icon={<CreditCard className="h-6 w-6" />}
            color="from-destructive/20 to-destructive/5 border-destructive/30"
            iconColor="text-destructive"
            title="Subscription Creep"
            description="Detect hidden recurring charges silently draining your account every month."
            cta={hasResults ? "View subscriptions" : "Run analysis first"}
          />
          <ToolCard
            to="/personalize"
            icon={<Wand2 className="h-6 w-6" />}
            color="from-chart-2/20 to-chart-2/5 border-chart-2/30"
            iconColor="text-chart-2"
            title="Personalize"
            description="Set your financial goals, risk profile, and savings targets to get tailored recommendations."
            cta="Customize"
          />
          <ToolCard
            to="/scam-shield"
            icon={<ShieldCheck className="h-6 w-6" />}
            color="from-success/20 to-success/5 border-success/30"
            iconColor="text-success"
            title="Scam Shield"
            description="Paste a suspicious message or payment request and get an instant AI risk score."
            cta="Check now"
          />
          <ToolCard
            to="/profile"
            icon={<User className="h-6 w-6" />}
            color="from-muted to-muted/40 border-border"
            iconColor="text-muted-foreground"
            title="My Profile"
            description="Update your name, email, and profile picture. Manage your account settings."
            cta="Edit profile"
          />
        </div>
      </section>

      {/* ── Tips section ── */}
      <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
        <h2 className="font-display text-xl font-bold">💡 Did you know?</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {TIPS.map((tip) => (
            <div key={tip.title} className="rounded-2xl bg-muted/50 p-4">
              <div className="text-xl">{tip.emoji}</div>
              <div className="mt-2 text-sm font-semibold">{tip.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{tip.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-card ${accent ? "border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="mt-3 font-display text-2xl font-bold truncate">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function ToolCard({ to, icon, color, iconColor, title, description, cta }: {
  to: string; icon: React.ReactNode; color: string; iconColor: string;
  title: string; description: string; cta: string;
}) {
  return (
    <Link
      to={to}
      className={`group flex flex-col rounded-3xl border bg-gradient-to-br p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-elevated ${color}`}
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-background shadow-card ${iconColor}`}>
        {icon}
      </div>
      <h3 className="mt-5 font-display text-lg font-bold tracking-tight">{title}</h3>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{description}</p>
      <div className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${iconColor}`}>
        {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

const TIPS = [
  {
    emoji: "📉",
    title: "The 50/30/20 Rule",
    body: "Spend 50% on needs, 30% on wants, and save/invest at least 20% of your income every month.",
  },
  {
    emoji: "🔁",
    title: "Subscription Creep",
    body: "The average person unknowingly spends ₹2,000–₹5,000/month on forgotten subscriptions. Audit yours.",
  },
  {
    emoji: "📈",
    title: "Start Your SIP Early",
    body: "₹5,000/month in a Nifty 50 index fund for 15 years grows to over ₹30 lakhs at 12% CAGR.",
  },
];
