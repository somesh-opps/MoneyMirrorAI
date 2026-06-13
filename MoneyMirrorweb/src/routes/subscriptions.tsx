import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CreditCard, Plus, Trash2, TrendingDown, RefreshCw,
  CheckCircle, ChevronDown, AlertTriangle, Sparkles,
} from "lucide-react";
import { useAnalysisStore } from "@/lib/analysisStore";
import { useAuthStore } from "@/lib/authStore";
import { formatINR } from "@/lib/analysisStore";
import type { Subscription } from "@/services/api";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscription Creep — MoneyMirror AI" },
      { name: "description", content: "Track and cut hidden subscription leaks draining your income every month." },
    ],
  }),
  component: SubscriptionCreepPage,
});

// ── Types ──────────────────────────────────────────────────────
type BillingCycle = "monthly" | "yearly" | "quarterly";
type Priority = "high" | "medium" | "low";

interface ManualSub {
  id: string;
  name: string;
  amount: number;
  cycle: BillingCycle;
  category: string;
  priority: Priority;
}

const CYCLE_MULTIPLIER: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

const POPULAR_SUBS = [
  "Netflix", "Spotify", "Amazon Prime", "Hotstar", "YouTube Premium",
  "Apple Music", "Swiggy One", "Zomato Pro", "GPT Plus", "Adobe CC",
  "LinkedIn Premium", "Notion", "Figma", "Slack", "Microsoft 365",
  "Dropbox", "iCloud", "Google One", "Zee5", "SonyLIV",
];

const CATEGORIES = [
  "Streaming", "Music", "Food Delivery", "Cloud Storage",
  "Productivity", "Gaming", "Education", "News", "Fitness", "Other",
];

const PRIORITY_COLOR: Record<Priority, string> = {
  high:   "border-destructive/40 bg-destructive/5",
  medium: "border-amber-400/40 bg-amber-50/5",
  low:    "border-border bg-muted/30",
};

const PRIORITY_BADGE: Record<Priority, string> = {
  high:   "bg-destructive/10 text-destructive",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low:    "bg-muted text-muted-foreground",
};

const STORAGE_KEY      = "mm_manual_subscriptions";
const AUTO_STORAGE_KEY = "mm_auto_subscriptions";
const CANCELLED_KEY    = "mm_cancelled_subs";

function loadJSON<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function saveManualSubs(subs: ManualSub[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(subs)); }
function saveAutoSubs(subs: Subscription[]) { localStorage.setItem(AUTO_STORAGE_KEY, JSON.stringify(subs)); }
function loadCancelled(): Set<string> { return new Set<string>(loadJSON<string[]>(CANCELLED_KEY, [])); }
function saveCancelled(s: Set<string>) { localStorage.setItem(CANCELLED_KEY, JSON.stringify([...s])); }

// ── Page ───────────────────────────────────────────────────────
function SubscriptionCreepPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { subscriptions: autoSubsFromStore } = useAnalysisStore();

  const [manualSubs, setManualSubs]   = useState<ManualSub[]>(() => loadJSON<ManualSub[]>(STORAGE_KEY, []));
  const [autoSubs,   setAutoSubs]     = useState<Subscription[]>(() => loadJSON<Subscription[]>(AUTO_STORAGE_KEY, []));
  const [cancelled,  setCancelled]    = useState<Set<string>>(loadCancelled);
  const [showCancelled, setShowCancelled] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "", cycle: "monthly" as BillingCycle, category: "Streaming", priority: "medium" as Priority });
  const [formError, setFormError] = useState("");

  useEffect(() => { if (!user) navigate({ to: "/login" }); }, [user, navigate]);

  // Sync new auto-detected subs from store → merge into persisted list (no duplicates by name)
  useEffect(() => {
    if (!autoSubsFromStore.length) return;
    setAutoSubs((prev) => {
      const existing = new Set(prev.map((s) => s.name.toLowerCase()));
      const newOnes  = autoSubsFromStore.filter((s) => !existing.has(s.name.toLowerCase()));
      const merged   = [...newOnes, ...prev];
      saveAutoSubs(merged);
      return merged;
    });
  }, [autoSubsFromStore]);

  useEffect(() => { saveManualSubs(manualSubs); }, [manualSubs]);
  useEffect(() => { saveCancelled(cancelled); }, [cancelled]);

  if (!user) return null;

  const markCancelled = (id: string) => { setCancelled((p) => new Set([...p, id])); setPendingCancel(null); };
  const undoCancel    = (id: string) => setCancelled((p) => { const s = new Set(p); s.delete(id); return s; });
  const deleteAutoSub = (name: string) => {
    setAutoSubs((p) => { const n = p.filter((s) => s.name !== name); saveAutoSubs(n); return n; });
    setCancelled((p) => { const s = new Set(p); s.delete(name); return s; });
  };
  const deleteSub = (id: string) => setManualSubs((p) => p.filter((s) => s.id !== id));

  const activeManual    = manualSubs.filter((s) => !cancelled.has(s.id));
  const activeAuto      = autoSubs.filter((s) => !cancelled.has(s.name));
  const cancelledManual = manualSubs.filter((s) =>  cancelled.has(s.id));
  const cancelledAuto   = autoSubs.filter((s) =>  cancelled.has(s.name));
  const cancelledCount  = cancelledManual.length + cancelledAuto.length;

  const manualMonthly = activeManual.reduce((sum, s) => sum + s.amount * CYCLE_MULTIPLIER[s.cycle], 0);
  const autoMonthly   = activeAuto.reduce((sum, s) => sum + s.monthly_cost, 0);
  const totalMonthly  = manualMonthly + autoMonthly;
  const totalAnnual   = totalMonthly * 12;
  const totalCount    = activeManual.length + activeAuto.length;

  const addSub = () => {
    if (!form.name.trim()) { setFormError("Subscription name is required"); return; }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) { setFormError("Enter a valid amount"); return; }
    setFormError("");
    const newSub: ManualSub = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      amount: amt,
      cycle: form.cycle,
      category: form.category,
      priority: form.priority,
    };
    setManualSubs((prev) => [newSub, ...prev]);
    setForm({ name: "", amount: "", cycle: "monthly", category: "Streaming", priority: "medium" });
    setShowForm(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:py-16 space-y-8">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-destructive/20 via-destructive/10 to-card border border-destructive/20 p-8 shadow-card">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-destructive/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive">
              <CreditCard className="h-3 w-3" /> Subscription Creep Detector
            </span>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
              Hidden money leaks, exposed.
            </h1>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Add your subscriptions manually or import them automatically from your transaction analysis.
            </p>
          </div>
          {totalCount > 0 && (
            <div className="flex flex-col gap-1 shrink-0 text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Monthly leak</div>
              <div className="font-display text-4xl font-bold text-destructive">{formatINR(Math.round(totalMonthly))}</div>
              <div className="text-xs text-muted-foreground">{formatINR(Math.round(totalAnnual))}/year</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────── */}
      {totalCount > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total Subscriptions" value={`${totalCount}`}      sub="active"           color="text-foreground" />
          <StatCard label="Monthly Drain"        value={formatINR(Math.round(totalMonthly))} sub="every month" color="text-destructive" />
          <StatCard label="Annual Cost"          value={formatINR(Math.round(totalAnnual))}  sub="per year"   color="text-destructive" />
          <StatCard label="Auto-detected"        value={`${activeAuto.length}`}  sub="from analysis"  color="text-chart-1" />
        </div>
      )}

      {/* ── Add subscription section ─────────────────────── */}
      <section className="rounded-3xl border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-bold">My Subscriptions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Add subscriptions you pay for regularly</p>
          </div>
          <button
            onClick={() => { setShowForm((v) => !v); setFormError(""); }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-elevated hover:scale-[1.02] transition-transform"
          >
            <Plus className="h-4 w-4" /> Add Subscription
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="border-b border-border bg-muted/30 px-6 py-6 space-y-4">
            <h3 className="text-sm font-bold text-foreground">New Subscription</h3>

            {/* Name with datalist */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Subscription Name *
                </label>
                <input
                  id="sub-name"
                  list="popular-subs"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Netflix, Spotify…"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <datalist id="popular-subs">
                  {POPULAR_SUBS.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 499"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* Billing cycle */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Billing Cycle
                </label>
                <div className="relative">
                  <select
                    value={form.cycle}
                    onChange={(e) => setForm((f) => ({ ...f, cycle: e.target.value as BillingCycle }))}
                    className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 pr-8"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 pr-8"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Priority to Cancel
                </label>
                <div className="relative">
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}
                    className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 pr-8"
                  >
                    <option value="high">🔴 High — Cancel ASAP</option>
                    <option value="medium">🟡 Medium — Review</option>
                    <option value="low">🟢 Low — Keep for now</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {formError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> {formError}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={addSub}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground shadow-glow hover:scale-[1.02] transition-transform"
              >
                <Plus className="h-4 w-4" /> Add Subscription
              </button>
              <button
                onClick={() => { setShowForm(false); setFormError(""); }}
                className="rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              {form.amount && form.cycle && (
                <span className="ml-auto text-xs text-muted-foreground">
                  ≈ <strong>{formatINR(Math.round(parseFloat(form.amount) * CYCLE_MULTIPLIER[form.cycle]))}/mo</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Manual subs list */}
        <div className="divide-y divide-border">
          {activeManual.length === 0 && activeAuto.length === 0 && !showForm && (
            <div className="flex flex-col items-center gap-3 py-14 text-center px-6">
              <CreditCard className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-muted-foreground">No subscriptions yet</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Click <strong>"Add Subscription"</strong> above to manually track your recurring charges,
                or run a transaction analysis to auto-detect them.
              </p>
              <Link
                to="/analyze"
                className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-accent" /> Auto-detect from transactions
              </Link>
            </div>
          )}

          {activeManual.map((sub) => (
            <ManualSubRow
              key={sub.id}
              sub={sub}
              onDelete={() => deleteSub(sub.id)}
              onMarkCancelled={() => markCancelled(sub.id)}
            />
          ))}

          {/* Auto-detected from analysis — persist until marked cancelled */}
          {activeAuto.map((sub) => (
            <AutoSubRow
              key={sub.name}
              sub={sub}
              pendingCancel={pendingCancel}
              setPendingCancel={setPendingCancel}
              onMarkCancelled={() => markCancelled(sub.name)}
            />
          ))}

          {totalCount === 0 && cancelledCount === 0 && !showForm && (
            <div className="flex flex-col items-center gap-3 py-14 text-center px-6">
              <CreditCard className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-muted-foreground">No subscriptions yet</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Click <strong>"Add Subscription"</strong> above to manually track your recurring charges,
                or run a transaction analysis to auto-detect them.
              </p>
              <Link to="/analyze" className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors">
                <Sparkles className="h-3.5 w-3.5 text-accent" /> Auto-detect from transactions
              </Link>
            </div>
          )}
        </div>

        {/* ── Cancelled section ── */}
        {cancelledCount > 0 && (
          <div className="border-t border-border">
            <button
              onClick={() => setShowCancelled((v) => !v)}
              className="flex w-full items-center justify-between px-6 py-4 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                {cancelledCount} Cancelled subscription{cancelledCount > 1 ? "s" : ""}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showCancelled ? "rotate-180" : ""}`} />
            </button>

            {showCancelled && (
              <div className="divide-y divide-border border-t border-border">
                {[...cancelledManual.map((s) => ({
                  id: s.id, name: s.name, monthly: Math.round(s.amount * CYCLE_MULTIPLIER[s.cycle]), isManual: true,
                })),
                ...cancelledAuto.map((s) => ({
                  id: s.name, name: s.name, monthly: s.monthly_cost, isManual: false,
                }))].map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-6 py-3 bg-success/5">
                    <div>
                      <span className="text-sm font-semibold line-through text-muted-foreground">{item.name}</span>
                      <span className="ml-2 text-xs text-success font-semibold">Cancelled · saving {formatINR(item.monthly)}/mo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => undoCancel(item.id)} className="text-[11px] text-muted-foreground hover:text-foreground underline">Undo</button>
                      <button onClick={() => item.isManual ? deleteSub(item.id) : deleteAutoSub(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Tips ─────────────────────────────────────────── */}
      <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-destructive" /> How to beat subscription creep
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {TIPS.map((t) => (
            <div key={t.title} className="rounded-2xl bg-muted/50 p-4">
              <div className="text-xl">{t.emoji}</div>
              <div className="mt-2 text-sm font-semibold">{t.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t.body}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between flex-wrap gap-3 rounded-2xl bg-muted/30 px-5 py-4">
          <div>
            <div className="text-sm font-semibold">Did you know?</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              The average Indian spends ₹2,000–₹5,000/month on subscriptions they forgot about.
              That's up to <strong>₹60,000/year</strong> silently leaving your account.
            </div>
          </div>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Re-analyze transactions
          </Link>
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function ManualSubRow({ sub, onDelete, onMarkCancelled }: {
  sub: ManualSub; onDelete: () => void; onMarkCancelled: () => void;
}) {
  const monthly = Math.round(sub.amount * CYCLE_MULTIPLIER[sub.cycle]);
  return (
    <div className={`flex items-center gap-4 px-6 py-4 transition-colors ${PRIORITY_COLOR[sub.priority]}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background border border-border text-lg">
        {sub.category === "Streaming" ? "🎬" : sub.category === "Music" ? "🎵" :
          sub.category === "Food Delivery" ? "🍕" : sub.category === "Gaming" ? "🎮" :
          sub.category === "Education" ? "📚" : sub.category === "Fitness" ? "💪" : "💳"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate">{sub.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PRIORITY_BADGE[sub.priority]}`}>{sub.priority}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{sub.category}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>₹{sub.amount.toLocaleString("en-IN")}/{sub.cycle === "monthly" ? "mo" : sub.cycle === "quarterly" ? "qtr" : "yr"}</span>
          <span>→ ≈ {formatINR(monthly)}/mo</span>
          <span className="text-destructive font-semibold">{formatINR(monthly * 12)}/year</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onMarkCancelled}
          className="rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-[11px] font-semibold text-success hover:bg-success/20 transition-colors">
          ✓ Cancelled
        </button>
        <button onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function AutoSubRow({ sub, pendingCancel, setPendingCancel, onMarkCancelled }: {
  sub: Subscription;
  pendingCancel: string | null;
  setPendingCancel: (id: string | null) => void;
  onMarkCancelled: () => void;
}) {
  const priority = (sub.priority ?? "low") as Priority;
  const isPending = pendingCancel === sub.name;
  return (
    <div className={`flex items-center gap-4 px-6 py-4 ${PRIORITY_COLOR[priority]}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background border border-border text-sm">🔍</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate">{sub.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PRIORITY_BADGE[priority]}`}>{priority}</span>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent font-semibold">Auto-detected</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{formatINR(sub.monthly_cost)}/mo</span>
          <span className="text-destructive font-semibold">{formatINR(sub.annual_cost)}/year</span>
          {sub.potential_savings > 0 && <span className="text-success font-semibold">Save {formatINR(sub.potential_savings)}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isPending ? (
          <>
            <span className="text-[11px] text-muted-foreground">Confirm?</span>
            <button onClick={onMarkCancelled}
              className="rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-[11px] font-bold text-success hover:bg-success/20 transition-colors">
              Yes, cancelled
            </button>
            <button onClick={() => setPendingCancel(null)}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] hover:bg-muted transition-colors">
              Keep
            </button>
          </>
        ) : (
          <button onClick={() => setPendingCancel(sub.name)}
            className="rounded-lg border border-success/40 bg-success/5 px-2.5 py-1.5 text-[11px] font-semibold text-success hover:bg-success/20 transition-colors">
            ✓ Mark Cancelled
          </button>
        )}
      </div>
    </div>
  );
}


const TIPS = [
  {
    emoji: "📋",
    title: "Do a monthly audit",
    body: "Set a recurring calendar reminder on the 1st of each month to review all card charges.",
  },
  {
    emoji: "🔔",
    title: "Use free-trial alerts",
    body: "Set a phone alarm 2 days before any free trial ends so you can cancel before being charged.",
  },
  {
    emoji: "🔒",
    title: "Use a virtual card",
    body: "Create a virtual debit card with a monthly spend limit just for subscriptions to cap your leak.",
  },
];
