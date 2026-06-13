import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Wand2, Sparkles, TrendingUp, TrendingDown, Minus,
  ShieldCheck, AlertTriangle, CreditCard, BarChart3,
  ArrowRight, ScanLine, CircleDollarSign, Lightbulb, History,
} from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { useAnalysisStore, formatINR } from "@/lib/analysisStore";
import { getAnalysisSummary, getAnalysisHistory, type AnalysisSummary, type AnalysisHistoryItem } from "@/services/api";
import { EmergencyReadiness } from "@/components/ResultComponents";

export const Route = createFileRoute("/personalize")({
  head: () => ({
    meta: [
      { title: "Personalize — MoneyMirror AI" },
      { name: "description", content: "Your detailed financial status and personalized AI recommendations." },
    ],
  }),
  component: PersonalizePage,
});

// ── Helpers ────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-amber-500";
  return "text-destructive";
}
function scoreBg(score: number) {
  if (score >= 70) return "from-success/20 to-success/5 border-success/30";
  if (score >= 40) return "from-amber-500/20 to-amber-500/5 border-amber-500/30";
  return "from-destructive/20 to-destructive/5 border-destructive/30";
}
function scoreLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  if (score >= 25) return "Needs Work";
  return "Critical";
}
function trendIcon(trend?: string) {
  if (trend === "improving") return <TrendingUp className="h-4 w-4 text-success" />;
  if (trend === "declining") return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}
function trendColor(trend?: string) {
  if (trend === "improving") return "text-success";
  if (trend === "declining") return "text-destructive";
  return "text-muted-foreground";
}

// ── Page ───────────────────────────────────────────────────────
function PersonalizePage() {
  const navigate  = useNavigate();
  const user      = useAuthStore((s) => s.user);
  const { doctor, twin, subscriptions, income, expenses, savings, analysisMonth, setAll } = useAnalysisStore();

  const [historySummary, setHistorySummary] = useState<AnalysisSummary | null>(null);
  const [historyTotal,   setHistoryTotal]   = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyList,    setHistoryList]    = useState<AnalysisHistoryItem[]>([]);

  useEffect(() => {
    if (!user) { navigate({ to: "/login" }); return; }
    if (!user.user_id) return;
    setHistoryLoading(true);

    Promise.all([
      getAnalysisSummary(user.user_id),
      getAnalysisHistory(user.user_id, "doctor", 10)
    ])
      .then(([summaryRes, historyRes]) => {
        setHistorySummary(summaryRes.summary);
        setHistoryTotal(summaryRes.total_analyses);
        
        const rawDocs = historyRes.analyses || [];
        
        // Deduplicate by month label (keep only the latest run for each month)
        const docs: typeof rawDocs = [];
        const seenMonths = new Set();
        for (const doc of rawDocs) {
          const monthLabel = doc.month || new Date(doc.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
          if (!seenMonths.has(monthLabel)) {
            seenMonths.add(monthLabel);
            docs.push(doc);
          }
        }
        
        setHistoryList(docs);

        // Auto-load latest analysis if store is empty
        if (!useAnalysisStore.getState().doctor && docs.length > 0) {
          const latest = docs[0];
          setAll({
            doctor: latest.result as any,
            income: latest.inputs?.monthly_income || 0,
            expenses: latest.inputs?.monthly_expenses || 0,
            savings: latest.inputs?.current_savings || 0,
            analysisMonth: latest.month || new Date(latest.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          });

          // Fetch the matching twin logic asynchronously
          getAnalysisHistory(user.user_id, "twin", 1).then(r => {
             if (r.analyses && r.analyses[0]) {
               setAll({ twin: r.analyses[0].result as any });
             }
          });
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setHistoryLoading(false));
  }, [user, navigate, setAll]);

  if (!user) return null;

  const hasAnalysis = !!doctor;

  // ── Derived metrics ──
  const healthScore    = doctor?.summary?.score ?? 0;
  const healthStatus   = doctor?.summary?.status ?? "";
  const totalSpent     = doctor?.summary?.total_spent ?? 0;
  const txCount        = doctor?.summary?.transactions_count ?? 0;
  const categories     = doctor?.categories ?? {};
  const insights       = doctor?.doctor_insights ?? {};
  const savingsRate    = insights?.savings_rate ?? 0;
  const expenseRatio   = insights?.expense_ratio ?? 0;
  const topCategories  = Object.entries(categories)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 6);

  const twinScore   = twin?.financial_twin_score;
  const persona     = twin?.persona;
  const milestone5y = twin?.optimized_milestones?.["5_year"];
  const rule        = twin?.rule_502030;
  const twinRecs    = twin?.twin_recommendations ?? [];

  const subMonthly = subscriptions.reduce((s, x) => s + x.monthly_cost, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16 space-y-8">

      {/* ── Page header ── */}
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            <Wand2 className="h-3 w-3" /> Personalize
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Your Financial Status
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasAnalysis
              ? `Based on your analysis${analysisMonth ? ` for ${analysisMonth}` : ""} · ${txCount} transactions`
              : "Run your first analysis to unlock personalized insights"}
          </p>
        </div>
        <Link
          to="/analyze"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors mt-4 md:mt-0"
        >
          <ScanLine className="h-4 w-4 text-accent" />
          {hasAnalysis ? "Re-analyze" : "Start Analysis"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── No analysis state ── */}
      {!hasAnalysis && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-14 text-center shadow-card">
          <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <h2 className="font-display text-xl font-bold">No analysis data yet</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            Upload your bank statement or enter transactions to get a detailed financial health breakdown.
          </p>
          <Link
            to="/analyze"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevated hover:scale-[1.02] transition-transform"
          >
            Start Analysis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {hasAnalysis && (
        <>
          {/* ── Row 1: Health Score + History Summary ── */}
          <div className="grid gap-5 md:grid-cols-3">

            {/* Health score card */}
            <div className={`col-span-1 rounded-3xl border bg-gradient-to-br p-6 shadow-card ${scoreBg(healthScore)}`}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Financial Health Score</div>
              <div className={`mt-3 font-display text-6xl font-black ${scoreColor(healthScore)}`}>
                {healthScore}
              </div>
              <div className={`mt-1 text-lg font-bold ${scoreColor(healthScore)}`}>{scoreLabel(healthScore)}</div>
              <div className="mt-2 text-xs text-muted-foreground capitalize">{healthStatus}</div>
              {/* Score bar */}
              <div className="mt-4 h-2 w-full rounded-full bg-background/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${healthScore >= 70 ? "bg-success" : healthScore >= 40 ? "bg-amber-500" : "bg-destructive"}`}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>0</span><span>50</span><span>100</span>
              </div>
            </div>

            {/* Key metrics */}
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <MetricCard
                icon={<CircleDollarSign className="h-4 w-4 text-chart-1" />}
                label="Total Spent"
                value={formatINR(totalSpent)}
                sub={`${txCount} transactions`}
              />
              <MetricCard
                icon={<TrendingUp className="h-4 w-4 text-success" />}
                label="Savings Rate"
                value={`${savingsRate.toFixed(1)}%`}
                sub={savingsRate >= 20 ? "✓ Above 20% target" : "↑ Target: 20%"}
                valueColor={savingsRate >= 20 ? "text-success" : "text-amber-500"}
              />
              <MetricCard
                icon={<BarChart3 className="h-4 w-4 text-chart-2" />}
                label="Expense Ratio"
                value={`${expenseRatio.toFixed(1)}%`}
                sub={expenseRatio <= 80 ? "✓ Under control" : "↓ Target: <80%"}
                valueColor={expenseRatio <= 80 ? "text-success" : "text-destructive"}
              />
              <MetricCard
                icon={<CreditCard className="h-4 w-4 text-destructive" />}
                label="Subscription Leak"
                value={subMonthly > 0 ? formatINR(subMonthly) + "/mo" : "—"}
                sub={subMonthly > 0 ? formatINR(subMonthly * 12) + "/year" : "None detected"}
                valueColor={subMonthly > 0 ? "text-destructive" : "text-success"}
              />
            </div>
          </div>

          {/* ── Row 2: 50/30/20 Split ── */}
          {rule && (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                <div>
                  <h2 className="font-display text-lg font-bold">50/30/20 Rule Analysis</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    How your spending compares to the ideal split
                  </p>
                </div>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                  Target savings: {formatINR(rule.ideal.savings.amount)}/mo
                </span>
              </div>
              <div className="space-y-5">
                {(["needs", "wants", "savings"] as const).map((bucket) => {
                  const cur   = rule.current[bucket];
                  const ideal = rule.ideal[bucket];
                  const gap   = rule.gap[bucket];
                  const labels  = { needs: "🏠 Needs", wants: "🛍️ Wants", savings: "💰 Savings" };
                  const barClr  = { needs: "bg-chart-1", wants: "bg-chart-2", savings: "bg-success" };
                  const txtClr  = { needs: "text-chart-1", wants: "text-chart-2", savings: "text-success" };
                  const over    = gap > 0 && bucket !== "savings";
                  const under   = gap > 0 && bucket === "savings";
                  return (
                    <div key={bucket}>
                      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                        <span className="text-sm font-semibold">{labels[bucket]}</span>
                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          <span className="text-muted-foreground">
                            You: <strong>{cur.pct}%</strong> ({formatINR(cur.amount)})
                          </span>
                          <span className={txtClr[bucket]}>Ideal: <strong>{ideal.pct}%</strong></span>
                          {gap > 0
                            ? <span className="font-bold text-destructive">
                                {over ? `▲ ₹${Math.round(gap).toLocaleString("en-IN")} over`
                                      : `▼ ₹${Math.round(gap).toLocaleString("en-IN")} short`}
                              </span>
                            : <span className="font-bold text-success">✓ On track</span>
                          }
                        </div>
                      </div>
                      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barClr[bucket]}`}
                          style={{ width: `${Math.min(cur.pct, 100)}%` }}
                        />
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-foreground/40"
                          style={{ left: `${ideal.pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Row 3: Top Spending + Financial Twin ── */}
          <div className="grid gap-5 md:grid-cols-2">

            {/* Top categories */}
            {topCategories.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <h2 className="font-display text-lg font-bold mb-4">Top Spending Categories</h2>
                <div className="space-y-3">
                  {topCategories.map(([cat, amt], i) => {
                    const pct = totalSpent > 0 ? Math.round((amt as number) / totalSpent * 100) : 0;
                    const colors = ["bg-chart-1","bg-chart-2","bg-chart-3","bg-chart-4","bg-accent","bg-success"];
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1 text-xs">
                          <span className="font-medium">{cat}</span>
                          <span className="text-muted-foreground">{formatINR(amt as number)} · {pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Financial Twin card */}
            {(twinScore !== undefined || persona) && (
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card flex flex-col gap-4">
                <h2 className="font-display text-lg font-bold">Financial Twin</h2>
                {persona && (
                  <span className="self-start inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-1.5 text-sm font-bold text-accent">
                    🧑‍💼 {persona}
                  </span>
                )}
                {twinScore !== undefined && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">Twin Score</div>
                    <div className="flex items-end gap-2">
                      <span className={`font-display text-4xl font-black ${scoreColor(twinScore)}`}>{twinScore}</span>
                      <span className="text-muted-foreground text-sm pb-1">/100</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${twinScore >= 70 ? "bg-success" : twinScore >= 40 ? "bg-amber-500" : "bg-destructive"}`}
                        style={{ width: `${twinScore}%` }} />
                    </div>
                  </div>
                )}
                {milestone5y && (
                  <div className="rounded-2xl bg-muted/50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">5-Year Wealth (Optimized)</div>
                    <div className="mt-1 font-display text-2xl font-bold text-success">{formatINR(milestone5y)}</div>
                  </div>
                )}
                <Link to="/results" className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
                  View full projection <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* ── Row 4: AI Recommendations ── */}
          {twinRecs.length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-accent" /> Personalized Recommendations
              </h2>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                Generated from your actual spending — fix these to improve your score.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {twinRecs.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-2xl bg-muted/40 border border-border px-4 py-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                      {i + 1}
                    </span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Row 4.5: Emergency Readiness ── */}
          {(doctor?.summary?.emergency_fund_months !== undefined || insights?.emergency_fund_months !== undefined) && (
            <EmergencyReadiness months={doctor?.summary?.emergency_fund_months ?? insights?.emergency_fund_months ?? 0} />
          )}

          {/* ── Row 5: Doctor Insights ── */}
          {Object.keys(insights).length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-success" /> Financial Doctor Insights
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {insights.emergency_fund_months !== undefined && (
                  <InsightPill
                    label="Emergency Fund Coverage"
                    value={`${insights.emergency_fund_months.toFixed(1)} months`}
                    ok={insights.emergency_fund_months >= 3}
                    hint="Target: 6 months"
                  />
                )}
                {insights.savings_rate !== undefined && (
                  <InsightPill
                    label="Savings Rate"
                    value={`${insights.savings_rate.toFixed(1)}%`}
                    ok={insights.savings_rate >= 20}
                    hint="Target: ≥ 20%"
                  />
                )}
                {insights.expense_ratio !== undefined && (
                  <InsightPill
                    label="Expense Ratio"
                    value={`${insights.expense_ratio.toFixed(1)}%`}
                    ok={insights.expense_ratio <= 80}
                    hint="Target: ≤ 80%"
                  />
                )}
                {income > 0 && (
                  <InsightPill
                    label="Monthly Income"
                    value={formatINR(income)}
                    ok={true}
                    hint="Your declared income"
                  />
                )}
                {expenses > 0 && (
                  <InsightPill
                    label="Monthly Expenses"
                    value={formatINR(expenses)}
                    ok={expenses < income * 0.8}
                    hint={expenses < income * 0.8 ? "Under 80% of income" : "Above 80% of income"}
                  />
                )}
                {savings > 0 && (
                  <InsightPill
                    label="Current Savings"
                    value={formatINR(savings)}
                    ok={true}
                    hint="Your emergency fund"
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Row 6: Historical trend (from DB) ── */}
          {!historyLoading && (historySummary || historyTotal > 0) && (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-chart-1" /> Your Progress Over Time
              </h2>
              {historySummary ? (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <MetricCard
                    icon={<BarChart3 className="h-4 w-4 text-accent" />}
                    label="Analyses Run"
                    value={`${historyTotal}`}
                    sub="total sessions"
                  />
                  <MetricCard
                    icon={<Sparkles className="h-4 w-4 text-success" />}
                    label="Avg Health Score"
                    value={`${historySummary.average_health_score}`}
                    sub="across all sessions"
                    valueColor={scoreColor(historySummary.average_health_score)}
                  />
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {trendIcon(historySummary.trend)} Trend
                    </div>
                    <div className={`mt-2 font-display text-xl font-bold capitalize ${trendColor(historySummary.trend)}`}>
                      {historySummary.trend}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {historySummary.earliest_health_score} → {historySummary.latest_health_score}
                    </div>
                  </div>
                  <MetricCard
                    icon={<TrendingUp className="h-4 w-4 text-chart-3" />}
                    label="Months Tracked"
                    value={`${historySummary.months_tracked}`}
                    sub="unique periods"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Run more analyses to see your progress trend.</p>
              )}
            </div>
          )}

          {/* ── Row 7: Analysis History ── */}
          {historyList.length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card mt-8">
              <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" /> Analysis History
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {historyList.map(item => (
                  <button 
                    key={item.analysis_id}
                    onClick={() => {
                      setAll({
                        doctor: item.result as any,
                        income: item.inputs?.monthly_income || 0,
                        expenses: item.inputs?.monthly_expenses || 0,
                        savings: item.inputs?.current_savings || 0,
                        analysisMonth: item.month || new Date(item.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
                      });
                      getAnalysisHistory(user.user_id, "twin", 5).then(r => {
                         // Find matching twin for this month/year or just latest
                         const twinMatch = r.analyses?.find(t => t.month === item.month) || r.analyses?.[0];
                         if (twinMatch) setAll({ twin: twinMatch.result as any });
                      });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex flex-col items-start justify-center rounded-2xl bg-muted/30 border border-border px-5 py-4 hover:bg-muted/60 transition-colors text-left"
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="font-bold text-base">
                        {item.month || new Date(item.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </div>
                      <div className={`font-display text-xl font-bold ${scoreColor((item.result as any).summary?.score || 0)}`}>
                        {(item.result as any).summary?.score || "N/A"}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(item.created_at).toLocaleDateString()} · {(item.result as any).summary?.transactions_count || 0} transactions
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, valueColor = "text-foreground" }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; valueColor?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`mt-2 font-display text-2xl font-bold ${valueColor}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function InsightPill({ label, value, ok, hint }: {
  label: string; value: string; ok: boolean; hint?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${ok ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
      <div className="flex items-center gap-1.5">
        {ok
          ? <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0" />
          : <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
        }
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</span>
      </div>
      <div className={`mt-2 font-display text-xl font-bold ${ok ? "text-success" : "text-destructive"}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
