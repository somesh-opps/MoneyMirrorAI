import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowRight, CreditCard, ScanLine, ShieldCheck, Sparkles, TrendingUp, Wand2,
  CircleDollarSign, CalendarDays, User, Trash2, Activity, RefreshCw, Clock,
} from "lucide-react";
import { formatINR, useAnalysisStore } from "@/lib/analysisStore";
import { useAuthStore } from "@/lib/authStore";
import { getAnalysisHistory, deleteAnalysis, getUserStats, type AnalysisHistoryItem, type UserStats } from "@/services/api";
import { toast } from "sonner";

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

      {/* ── Analysis History (logged-in users only) ── */}
      {user?.user_id && <AnalysisHistoryPanel userId={user.user_id} />}

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

// ── Analysis History Panel ──────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  doctor:        { label: "Financial Doctor", color: "bg-accent/15 text-accent border-accent/30",             icon: <Activity className="h-3.5 w-3.5" /> },
  twin:          { label: "Financial Twin",   color: "bg-chart-2/15 text-chart-2 border-chart-2/30",         icon: <TrendingUp className="h-3.5 w-3.5" /> },
  subscriptions: { label: "Subscriptions",    color: "bg-destructive/15 text-destructive border-destructive/30", icon: <CreditCard className="h-3.5 w-3.5" /> },
  interventions: { label: "Action Plan",      color: "bg-success/15 text-success border-success/30",         icon: <Sparkles className="h-3.5 w-3.5" /> },
};

function AnalysisHistoryPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<AnalysisHistoryItem[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [histRes, statsRes] = await Promise.all([
        getAnalysisHistory(userId, undefined, 20),
        getUserStats(userId).catch(() => null),
      ]);
      setItems(histRes.analyses || []);
      if (statsRes?.success) setStats(statsRes.stats);
    } catch (e) {
      console.error("[AnalysisHistory] fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (analysisId: string) => {
    setDeleting(analysisId);
    try {
      await deleteAnalysis(analysisId, userId);
      setItems((prev) => prev.filter((a) => a.analysis_id !== analysisId));
      toast.success("Analysis removed from your history.");
      if (stats) setStats({ ...stats, total_analyses: Math.max(0, stats.total_analyses - 1) });
    } catch {
      toast.error("Could not delete analysis. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-xl font-bold">📊 Analysis History</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Every analysis run saved to your account — all keyed to your user ID.</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
          title="Refresh history"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold shadow-card">
            <Activity className="h-3.5 w-3.5 text-accent" />
            <span>{stats.total_analyses} total analyses</span>
          </div>
          {stats.last_login_at && (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold shadow-card">
              <Clock className="h-3.5 w-3.5 text-chart-2" />
              <span>Last login: {fmtDate(stats.last_login_at)}</span>
            </div>
          )}
          {stats.member_since && (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold shadow-card">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Member since {new Date(stats.member_since).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-card">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading your history…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-card">
          <p className="text-2xl mb-2">📭</p>
          <p className="text-sm font-semibold">No analyses yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Run your first analysis and it will appear here, saved to your account.</p>
          <Link to="/analyze" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-elevated hover:scale-[1.02] transition-all">
            Start Analysis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const meta = TYPE_META[item.analysis_type] ?? { label: item.analysis_type, color: "bg-muted text-foreground border-border", icon: null };
            const score = (item.result as any)?.summary?.score;
            const isDel = deleting === item.analysis_id;
            return (
              <div
                key={item.analysis_id}
                className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
              >
                {/* Type badge + date */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{fmtDate(item.created_at)}</span>
                </div>

                {/* Key figures */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  {item.inputs?.monthly_income ? (
                    <span className="text-muted-foreground">Income: <strong className="text-foreground">{formatINR(item.inputs.monthly_income)}</strong></span>
                  ) : null}
                  {item.inputs?.monthly_expenses ? (
                    <span className="text-muted-foreground">Expenses: <strong className="text-foreground">{formatINR(item.inputs.monthly_expenses)}</strong></span>
                  ) : null}
                  {item.inputs?.transaction_count ? (
                    <span className="text-muted-foreground">Transactions: <strong className="text-foreground">{item.inputs.transaction_count}</strong></span>
                  ) : null}
                  {score !== undefined && (
                    <span className="text-muted-foreground">Health Score: <strong className="text-accent">{score}/100</strong></span>
                  )}
                  {item.month && (
                    <span className="text-muted-foreground">Month: <strong className="text-foreground">{item.month}</strong></span>
                  )}
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(item.analysis_id)}
                  disabled={isDel}
                  className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  title="Delete this analysis"
                >
                  {isDel ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
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
