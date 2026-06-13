import { formatINR } from "@/lib/analysisStore";
import type { DoctorResponse, Subscription, FinancialTwinResponse, Intervention } from "@/services/api";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar,
} from "recharts";
import { AlertTriangle, ArrowUpRight, Sparkles, TrendingUp } from "lucide-react";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "oklch(0.7 0.15 200)", "oklch(0.6 0.18 340)"];

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Summary — shown at the very top of results, always visible
// ─────────────────────────────────────────────────────────────────────────────
export function DashboardSummary({
  score,
  potentialSavings,
  futureGain,
}: {
  score: number;
  potentialSavings: number;
  futureGain: number;
}) {
  const tone = score >= 75 ? "Excellent" : score >= 55 ? "Healthy" : score >= 35 ? "Needs work" : "Critical";
  const color = score >= 75 ? "var(--success)" : score >= 55 ? "var(--chart-1)" : score >= 35 ? "var(--warning)" : "var(--destructive)";
  const angle = (score / 100) * 360;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elevated">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="h-3 w-3" /> Your Financial Snapshot
        </span>
        <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr_1fr]">
          {/* Score gauge */}
          <div className="flex flex-col items-center gap-3 md:items-start md:flex-row md:gap-5">
            <div className="relative h-28 w-28 shrink-0">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(${color} ${angle}deg, rgba(255,255,255,0.15) 0deg)` }}
              />
              <div className="absolute inset-2.5 flex flex-col items-center justify-center rounded-full bg-gradient-hero shadow-inner">
                <span className="font-display text-3xl font-bold tracking-tight" style={{ color }}>
                  {score}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-widest text-primary-foreground/60">/ 100</span>
              </div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/60">MoneyMirror Score</div>
              <div className="mt-1 font-display text-2xl font-bold" style={{ color }}>
                {tone}
              </div>
              <div className="mt-1 text-xs text-primary-foreground/60">Financial health rating</div>
            </div>
          </div>

          {/* Potential savings */}
          <div className="flex flex-col justify-center rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/60">Potential Annual Savings</div>
            <div className="mt-2 font-display text-3xl font-bold text-accent">
              {formatINR(potentialSavings)}
            </div>
            <div className="mt-1 text-xs text-primary-foreground/60">From cutting hidden leaks</div>
          </div>

          {/* Future gain */}
          <div className="flex flex-col justify-center rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/60">Future Gain (10 yrs)</div>
            <div className="mt-2 font-display text-3xl font-bold text-accent">
              {formatINR(futureGain)}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-accent">
              <TrendingUp className="h-3 w-3" /> AI-optimized trajectory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MoneyMirrorScore
// ─────────────────────────────────────────────────────────────────────────────
export function MoneyMirrorScore({ score }: { score: number }) {
  const angle = (score / 100) * 360;
  const tone = score >= 75 ? "Excellent" : score >= 55 ? "Healthy" : score >= 35 ? "Needs work" : "Critical";
  const color = score >= 75 ? "var(--success)" : score >= 55 ? "var(--chart-1)" : score >= 35 ? "var(--warning)" : "var(--destructive)";
  return (
    <div className="glass-card relative overflow-hidden rounded-3xl p-8">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
        <div className="relative h-44 w-44 shrink-0">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: `conic-gradient(${color} ${angle}deg, var(--muted) 0deg)` }}
          />
          <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-card shadow-elevated">
            <span className="font-display text-5xl font-bold tracking-tight">{score}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div className="flex-1 text-center md:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" /> MoneyMirror Score
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Your financial health is <span style={{ color }}>{tone}</span>.
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            This score blends your spending pattern, subscription bloat, and savings discipline into a single signal.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FinancialSummary
// ─────────────────────────────────────────────────────────────────────────────
export function FinancialSummary({ doctor }: { doctor: DoctorResponse }) {
  const cards = [
    { label: "Total Spent", value: formatINR(doctor.summary.total_spent), accent: "text-foreground" },
    { label: "Transactions", value: String(doctor.summary.transactions_count), accent: "text-foreground" },
    { label: "Top Category", value: Object.entries(doctor.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—", accent: "text-foreground" },
    { label: "Categories Tracked", value: String(Object.keys(doctor.categories).length), accent: "text-foreground" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</div>
          <div className={`mt-2 font-display text-xl font-bold ${c.accent}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExpenseChart
// ─────────────────────────────────────────────────────────────────────────────
export function ExpenseChart({ categories }: { categories: Record<string, number> }) {
  const data = Object.entries(categories).map(([name, value]) => ({ name, value }));
  if (data.length === 0) return <EmptyState label="No transaction data available." />;
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <h3 className="font-display text-lg font-bold">Spending by Category</h3>
      <p className="text-sm text-muted-foreground">Where your money actually went.</p>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex flex-col justify-center gap-2">
          {data.sort((a, b) => b.value - a.value).map((d, i) => (
            <li key={d.name} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-muted/60">
              <span className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {d.name}
              </span>
              <span className="font-mono text-sm font-semibold">{formatINR(d.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SubscriptionCard
// ─────────────────────────────────────────────────────────────────────────────
export function SubscriptionCard({ s }: { s: Subscription }) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.category || "Subscription"}</div>
          <div className="mt-1 font-display text-lg font-bold">{s.name}</div>
        </div>
        <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-warning-foreground">Leak</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
        <Stat label="Monthly" value={formatINR(s.monthly_cost)} />
        <Stat label="Annual" value={formatINR(s.annual_cost)} />
        <Stat label="You could save" value={formatINR(s.potential_savings)} highlight />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold ${highlight ? "text-success" : ""}`}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FinancialTwinSection — 3 trajectories: Current, Improved, Best Case
// ─────────────────────────────────────────────────────────────────────────────
export function FinancialTwinSection({ twin }: { twin: FinancialTwinResponse }) {
  const hasBestCase = !!twin.best_case_path && twin.best_case_path.length > 0;

  const merged = twin.current_path.map((c, i) => ({
    year: c.year,
    "Current": c.net_worth,
    "Improved": twin.optimized_path[i]?.net_worth ?? c.net_worth,
    ...(hasBestCase ? { "Best Case": twin.best_case_path![i]?.net_worth ?? twin.optimized_path[i]?.net_worth ?? c.net_worth } : {}),
  }));

  const pathCards = [
    {
      label: "Current Future",
      value: formatINR(twin.current_path[twin.current_path.length - 1]?.net_worth ?? 0),
      sublabel: `₹${Math.round(twin.current_monthly_savings / 1000)}k/mo saved`,
      color: "var(--chart-4)",
      bg: "bg-card",
      desc: "If nothing changes",
    },
    {
      label: "Improved Future",
      value: formatINR(twin.optimized_path[twin.optimized_path.length - 1]?.net_worth ?? 0),
      sublabel: `₹${Math.round(twin.optimized_monthly_savings / 1000)}k/mo saved`,
      color: "var(--chart-1)",
      bg: "bg-card",
      desc: "With MoneyMirror's advice",
    },
    ...(hasBestCase
      ? [
          {
            label: "Best Case Future",
            value: formatINR(twin.best_case_path![twin.best_case_path!.length - 1]?.net_worth ?? 0),
            sublabel: `₹${Math.round((twin.best_case_monthly_savings ?? 0) / 1000)}k/mo saved`,
            color: "var(--chart-2)",
            bg: "bg-card border-2 border-accent/40",
            desc: "Maximum optimization",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Hero gain banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elevated">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" /> AI Impact
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">Potential Financial Gain</h2>
            <p className="mt-2 max-w-md text-sm text-primary-foreground/70">
              If you follow MoneyMirror's recommendations, here's what your future self looks like in 12 months.
            </p>
          </div>
          <div className="md:text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/60">+ over 12 months</div>
            <div className="mt-1 font-display text-5xl font-bold tracking-tight md:text-6xl">
              {formatINR(twin.potential_gain)}
            </div>
            <div className="mt-2 inline-flex items-center gap-1 text-sm text-accent">
              <TrendingUp className="h-4 w-4" /> {formatINR(twin.optimized_monthly_savings - twin.current_monthly_savings)} extra / month
            </div>
          </div>
        </div>
      </div>

      {/* Path comparison cards */}
      <div className={`grid gap-4 ${hasBestCase ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {pathCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border border-border p-5 shadow-card ${card.bg}`}>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: card.color }} />
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</div>
            </div>
            <div className="mt-2 font-display text-2xl font-bold" style={{ color: card.color }}>
              {card.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{card.sublabel}</div>
            <div className="mt-2 text-[11px] font-medium text-muted-foreground/70 italic">{card.desc}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 12-month projection line chart */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-display text-lg font-bold">12-Month Savings Trajectory</h3>
          <p className="text-sm text-muted-foreground">
            {hasBestCase ? "Three paths: current, improved, and best case." : "Current path vs. AI-optimized path."}
          </p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={merged}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `Month ${v}`} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                <Legend />
                <Line type="monotone" dataKey="Current" stroke="var(--chart-4)" strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
                <Line type="monotone" dataKey="Improved" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
                {hasBestCase && (
                  <Line type="monotone" dataKey="Best Case" stroke="var(--chart-2)" strokeWidth={3} dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly savings bar chart */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-display text-lg font-bold">Monthly Savings Comparison</h3>
          <p className="text-sm text-muted-foreground">How much more you keep, every month.</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Current", value: twin.current_monthly_savings },
                  { name: "Improved", value: twin.optimized_monthly_savings },
                  ...(hasBestCase ? [{ name: "Best Case", value: twin.best_case_monthly_savings ?? 0 }] : []),
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                  <Cell fill="var(--chart-4)" />
                  <Cell fill="var(--chart-1)" />
                  {hasBestCase && <Cell fill="var(--chart-2)" />}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionCard (Intervention Engine)
// ─────────────────────────────────────────────────────────────────────────────
export function ActionCard({ i }: { i: Intervention }) {
  const tone = i.priority === "high" ? "destructive" : i.priority === "medium" ? "warning" : "muted";
  const toneStyle =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "bg-warning/15 text-warning-foreground"
        : "bg-muted text-muted-foreground";
  return (
    <div className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated">
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${toneStyle}`}>
          {i.priority} priority
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{i.category}</span>
      </div>
      <h4 className="mt-4 font-display text-lg font-bold tracking-tight">{i.title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{i.action}</p>
      <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Annual savings impact</div>
          <div className="mt-1 font-display text-2xl font-bold text-success">
            {i.savings_impact > 0 ? `+ ${formatINR(i.savings_impact)}` : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Timeline</div>
          <div className="mt-1 text-sm font-semibold">{i.timeline}</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────────────────────────
export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <AlertTriangle className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  cta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </div>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {cta && <div>{cta}</div>}
    </div>
  );
}

export { ArrowUpRight };
