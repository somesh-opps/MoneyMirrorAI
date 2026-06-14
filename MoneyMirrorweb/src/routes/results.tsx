import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAnalysisStore } from "@/lib/analysisStore";
import { analyzeTransactions, detectSubscriptions, generateFinancialTwin, generateInterventions } from "@/services/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  DashboardSummary,
  MoneyMirrorScore, FinancialSummary, ExpenseChart, SubscriptionCard,
  FinancialTwinSection, ActionCard, EmptyState, SectionHeader, EmergencyReadiness,
} from "@/components/ResultComponents";
import { formatINR } from "@/lib/analysisStore";
import { useAuthStore } from "@/lib/authStore";
import { ArrowRight, ShieldCheck, Activity, Search, Users, Zap, RefreshCw, BookMarked, X } from "lucide-react";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Your Financial Report — MoneyMirror AI" },
      { name: "description", content: "AI-generated financial doctor results, expense leaks, twin projection, and interventions." },
    ],
  }),
  component: ResultsPage,
});

const TABS = [
  { id: "doctor", label: "Financial Doctor", icon: Activity },
  { id: "expenses", label: "Subscription Creep", icon: Search },
  { id: "twin", label: "Financial Twin", icon: Users },
  { id: "actions", label: "Action Plan", icon: Zap },
] as const;

type TabId = (typeof TABS)[number]["id"];

function ResultsPage() {
  const navigate = useNavigate();
  const { transactions, income, expenses, savings, analysisMonth, doctor, subscriptions, twin, interventions, setAll } = useAnalysisStore();
  const user = useAuthStore((s) => s.user);
  const [savedBanner, setSavedBanner] = useState(false);

  // FIX #4: Two separate booleans.
  // showLoading = controls whether the loading screen is rendered at all.
  // ready = set to true once all API calls resolve.
  // LoadingScreen runs to 90%, then waits for ready=true, then finishes and sets showLoading=false.
  const [showLoading, setShowLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("doctor");

  useEffect(() => {
    if (transactions.length === 0 && !income) {
      navigate({ to: "/analyze" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const monthlySavings = Math.max(0, income - expenses);

        const d = await analyzeTransactions(transactions, {
          monthly_income: income,
          monthly_expenses: expenses,
          monthly_savings: monthlySavings,
          current_emergency_fund: savings,
          month: analysisMonth,
        });

        if (cancelled) return;

        // Step 2: remaining 3 calls run in parallel, now that d.categories is ready
        const [sub, t, ints] = await Promise.all([
          detectSubscriptions(transactions, analysisMonth),
          generateFinancialTwin({
            monthly_income: income,
            monthly_expenses: expenses,
            current_savings: savings,
            food_expense: (d.categories?.["Food Delivery"] ?? 0) + (d.categories?.["Food"] ?? 0),
            shopping_expense: d.categories?.["Shopping"] ?? 0,
            subscription_expense: d.categories?.["Subscriptions"] ?? 0,
            categories: d.categories ?? {},
            month: analysisMonth,
          }),
          generateInterventions({ transactions, monthly_income: income, monthly_expenses: expenses, month: analysisMonth }),
        ]);

        if (cancelled) return;
        setAll({ doctor: d, subscriptions: sub.subscriptions, twin: t, interventions: ints.interventions });
        // Show saved banner if user is logged in
        if (user?.user_id) setSavedBanner(true);
      } catch (err) {
        console.error("[Results] API fetch failed:", err);
      } finally {
        if (!cancelled) setReady(true); // always unblock the loading screen
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show loading screen until animation completes (onDone is called by LoadingScreen after its bar hits 100%)
  if (showLoading) {
    return <LoadingScreen isComplete={ready} onDone={() => setShowLoading(false)} />;
  }

  // Guard: if data somehow missing after loading, redirect
  if (!doctor || !twin) {
    navigate({ to: "/analyze" });
    return null;
  }

  const totalSubMonthly = subscriptions.reduce((s, x) => s + x.monthly_cost, 0);
  const totalSubAnnual = subscriptions.reduce((s, x) => s + x.annual_cost, 0);
  const totalPotentialSavings = subscriptions.reduce((s, x) => s + x.potential_savings, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-12 md:py-16">

      {/* FIX #5: Dashboard Summary — always visible at top */}
      <DashboardSummary
        score={doctor.summary.score}
        potentialSavings={totalPotentialSavings}
        futureGain={twin.potential_gain}
      />

      {/* Saved-to-account banner */}
      {savedBanner && user?.user_id && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success/5 px-5 py-3 text-sm shadow-card">
          <div className="flex items-center gap-2.5">
            <BookMarked className="h-4 w-4 shrink-0 text-success" />
            <span className="text-success font-medium">
              Analysis saved to your account
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              — linked to user <code className="font-mono text-[11px]">{user.user_id}</code>
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/dashboard"
              className="text-xs font-semibold text-success hover:underline"
            >
              View history →
            </Link>
            <button
              onClick={() => setSavedBanner(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="sticky top-[65px] z-30 -mx-6 bg-background/80 px-6 py-3 backdrop-blur-xl border-b border-border/60">
        {analysisMonth && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <span>📅</span> {analysisMonth}
          </div>
        )}
        <div className="flex overflow-x-auto gap-1 rounded-2xl border border-border bg-card p-1 shadow-card">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${activeTab === tab.id
                  ? "bg-foreground text-background shadow-elevated"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">

        {/* ── Financial Doctor ── */}
        {activeTab === "doctor" && (
          <section className="space-y-6">
            <SectionHeader
              eyebrow="01 · Financial Doctor"
              title="Your money, diagnosed."
              description="A single score plus the categories that shaped it."
            />
            <MoneyMirrorScore score={doctor.summary.score} />
            <EmergencyReadiness months={doctor.summary.emergency_fund_months ?? 0} />

            {/* Extra doctor stats */}
            {(doctor.summary.savings_rate !== undefined || doctor.summary.expense_ratio !== undefined) && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatPill label="Savings Rate" value={`${doctor.summary.savings_rate ?? 0}%`} />
                <StatPill label="Expense Ratio" value={`${doctor.summary.expense_ratio ?? 0}%`} />
                <StatPill label="Emergency Fund" value={`${doctor.summary.emergency_fund_months ?? 0} mo`} />
                <StatPill label="Health Status" value={doctor.summary.status ?? "—"} />
              </div>
            )}

            <FinancialSummary doctor={doctor} />
            <ExpenseChart categories={doctor.categories} />

            {/* Insights */}
            {doctor.insights && doctor.insights.length > 0 && (
              <div className="rounded-3xl border border-warning/40 bg-warning/5 p-6 shadow-card">
                <h3 className="font-display text-lg font-bold text-warning-foreground">⚠️ Key Insights</h3>
                <ul className="mt-3 space-y-2">
                  {doctor.insights.map((ins, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-warning/20 text-center text-[10px] font-bold leading-4 text-warning-foreground">{i + 1}</span>
                      {ins}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {doctor.recommendations && doctor.recommendations.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <h3 className="font-display text-lg font-bold">✅ Recommendations</h3>
                <ul className="mt-3 space-y-2">
                  {doctor.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-0.5 shrink-0 text-success">→</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* ── Invisible Expense Detector ── */}
        {activeTab === "expenses" && (
          <section className="space-y-6">
            <SectionHeader
              eyebrow="02 · Subscription Creep"
              title="The leaks you didn't notice."
              description="Recurring charges that quietly add up over a year."
            />
            {subscriptions.length === 0 ? (
              <EmptyState label="No recurring subscriptions detected in your data." />
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <Tile label="Monthly subscription bill" value={formatINR(totalSubMonthly)} />
                  <Tile label="Annual subscription bill" value={formatINR(totalSubAnnual)} />
                  <Tile label="You could save / year" value={formatINR(totalPotentialSavings)} highlight />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {subscriptions.map((s, i) => <SubscriptionCard key={i} s={s} />)}
                </div>
              </>
            )}
          </section>
        )}

        {/* ── Financial Twin ── */}
        {activeTab === "twin" && twin && (
          <section className="space-y-6">
            <SectionHeader
              eyebrow="02 · Financial Twin"
              title="Your future self, simulated."
              description="12-Month savings trajectory based on your real spending patterns."
            />

            {/* Persona + Twin Score banner */}
            {(twin.persona || twin.financial_twin_score !== undefined) && (
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-6 py-4 shadow-card">
                {twin.persona && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-1.5 text-sm font-bold text-accent">
                    🧑‍💼 {twin.persona}
                  </span>
                )}
                {twin.financial_twin_score !== undefined && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm font-semibold text-foreground">
                    Twin Score: <strong>{twin.financial_twin_score}/100</strong>
                  </span>
                )}
                {twin.monthly_improvement !== undefined && twin.monthly_improvement > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Monthly improvement potential:{" "}
                    <strong className="text-success">{formatINR(twin.monthly_improvement)}/mo</strong>
                  </span>
                )}
              </div>
            )}

            <FinancialTwinSection twin={twin} />






            {/* Scenario Comparison */}
            {twin.scenarios && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Worst Case (1 yr)</div>
                  <div className="mt-2 font-display text-xl font-bold text-destructive">{formatINR(twin.scenarios.worst_case)}</div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Improved (1 yr)</div>
                  <div className="mt-2 font-display text-xl font-bold">{formatINR(twin.scenarios.average_case)}</div>
                </div>
                <div className="rounded-2xl border border-success/30 bg-success/5 p-4 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Best Case (1 yr)</div>
                  <div className="mt-2 font-display text-xl font-bold text-success">{formatINR(twin.scenarios.best_case)}</div>
                </div>
              </div>
            )}

            {/* Twin Recommendations */}
            {twin.twin_recommendations && twin.twin_recommendations.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <h3 className="font-display text-lg font-bold">💡 Spending Optimizations</h3>
                <ul className="mt-3 space-y-2">
                  {twin.twin_recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-0.5 shrink-0 text-accent">→</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* ── Intervention Engine ── */}
        {activeTab === "actions" && (
          <section className="space-y-6">
            <SectionHeader
              eyebrow="04 · Intervention Engine"
              title="Do this. In this order."
              description="Concrete actions ranked by priority and annual savings impact."
            />
            {interventions.length === 0 ? (
              <EmptyState label="No specific interventions generated. Your finances look healthy!" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {interventions.map((i, idx) => <ActionCard key={idx} i={i} />)}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Footer CTAs ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Scam Shield CTA */}
        <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
          <div className="flex flex-col items-start gap-4">
            <div>
              <h3 className="font-display text-xl font-bold tracking-tight">Got a suspicious message?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Run any SMS, email or WhatsApp through Scam Shield AI for a risk verdict.
              </p>
            </div>
            <Link
              to="/scam-shield"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
            >
              <ShieldCheck className="h-4 w-4" /> Open Scam Shield <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* FIX #6: Analyze Again */}
        <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
          <div className="flex flex-col items-start gap-4">
            <div>
              <h3 className="font-display text-xl font-bold tracking-tight">Want to re-run your analysis?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Change your income, expenses, or transactions and generate a new report.
              </p>
            </div>
            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/70"
            >
              <RefreshCw className="h-4 w-4" /> Analyze Again
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border p-5 shadow-card ${highlight ? "bg-gradient-accent text-accent-foreground" : "bg-card"}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${highlight ? "text-accent-foreground/80" : "text-muted-foreground"}`}>
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}
