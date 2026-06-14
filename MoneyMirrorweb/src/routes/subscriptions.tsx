import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  CreditCard, Plus, Trash2, TrendingDown, RefreshCw,
  CheckCircle, ChevronDown, AlertTriangle, Sparkles, Loader2,
} from "lucide-react";
import { useAnalysisStore } from "@/lib/analysisStore";
import { useAuthStore } from "@/lib/authStore";
import { formatINR } from "@/lib/analysisStore";
import {
  getUserSubscriptions, addUserSubscription, updateUserSubscription,
  deleteUserSubscription, type DbSubscription,
} from "@/services/api";
import { toast } from "sonner";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscription Creep — MoneyMirror AI" },
      { name: "description", content: "Track and cut hidden subscription leaks draining your income every month." },
    ],
  }),
  component: SubscriptionCreepPage,
});

type BillingCycle = "monthly" | "quarterly" | "yearly";
type Priority = "high" | "medium" | "low";

const CYCLE_MULTIPLIER: Record<BillingCycle, number> = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

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

function SubscriptionCreepPage() {
  const navigate  = useNavigate();
  const user      = useAuthStore((s) => s.user);
  const { subscriptions: autoSubsFromStore } = useAnalysisStore();

  const [subs,       setSubs]       = useState<DbSubscription[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showForm,   setShowForm]   = useState(false);
  const [editingSub, setEditingSub] = useState<DbSubscription | null>(null);
  const [form, setForm] = useState({
    name: "", amount: "", cycle: "monthly" as BillingCycle,
    category: "Streaming", priority: "medium" as Priority,
  });
  const [formError, setFormError] = useState("");

  useEffect(() => { if (!user) navigate({ to: "/login" }); }, [user, navigate]);

  // Fetch all subscriptions for this user from MongoDB
  const fetchSubs = useCallback(async () => {
    if (!user?.user_id) return;
    setLoading(true);
    try {
      const res = await getUserSubscriptions(user.user_id);
      setSubs(res.subscriptions || []);
    } catch {
      toast.error("Could not load subscriptions.");
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  // Auto-merge newly detected subs from analysis store → MongoDB
  useEffect(() => {
    if (!user?.user_id || !autoSubsFromStore.length) return;
    // They are already upserted by the backend when /detect-subscriptions runs.
    // Just refresh the list.
    fetchSubs();
  }, [autoSubsFromStore, user?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const active    = subs.filter((s) => s.status === "active");
  const cancelled = subs.filter((s) => s.status === "cancelled");

  const totalMonthly = active.reduce((sum, s) => sum + s.monthly_cost, 0);
  const totalAnnual  = totalMonthly * 12;

  const openAdd = () => {
    setForm({ name: "", amount: "", cycle: "monthly", category: "Streaming", priority: "medium" });
    setEditingSub(null);
    setFormError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEdit = (sub: DbSubscription) => {
    setForm({
      name: sub.name,
      amount: String(sub.amount ?? sub.monthly_cost),
      cycle: (sub.cycle as BillingCycle) || "monthly",
      category: sub.category || "Other",
      priority: (sub.priority as Priority) || "medium",
    });
    setEditingSub(sub);
    setFormError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveSub = async () => {
    if (!form.name.trim()) { setFormError("Name is required"); return; }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) { setFormError("Enter a valid amount"); return; }
    setFormError("");
    setSaving(true);
    try {
      if (editingSub) {
        await updateUserSubscription(editingSub.sub_id, user.user_id!, {
          name: form.name.trim(), amount: amt,
          cycle: form.cycle, category: form.category, priority: form.priority,
        });
        toast.success("Subscription updated.");
      } else {
        await addUserSubscription({
          user_id: user.user_id!, name: form.name.trim(), amount: amt,
          cycle: form.cycle, category: form.category, priority: form.priority,
        });
        toast.success("Subscription added.");
      }
      setShowForm(false);
      setEditingSub(null);
      await fetchSubs();
    } catch {
      toast.error("Could not save subscription.");
    } finally {
      setSaving(false);
    }
  };

  const markCancelled = async (sub: DbSubscription) => {
    try {
      await updateUserSubscription(sub.sub_id, user.user_id!, { status: "cancelled" });
      toast.success(`${sub.name} marked as cancelled.`);
      await fetchSubs();
    } catch {
      toast.error("Could not update subscription.");
    }
  };

  const undoCancel = async (sub: DbSubscription) => {
    try {
      await updateUserSubscription(sub.sub_id, user.user_id!, { status: "active" });
      await fetchSubs();
    } catch {
      toast.error("Could not restore subscription.");
    }
  };

  const removeSub = async (sub: DbSubscription) => {
    setDeletingId(sub.sub_id);
    try {
      await deleteUserSubscription(sub.sub_id, user.user_id!);
      toast.success(`${sub.name} removed.`);
      setSubs((p) => p.filter((s) => s.sub_id !== sub.sub_id));
    } catch {
      toast.error("Could not delete subscription.");
    } finally {
      setDeletingId(null);
    }
  };

  const [showCancelled, setShowCancelled] = useState(false);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:py-16 space-y-8">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-destructive/20 via-destructive/10 to-card border border-destructive/20 p-8 shadow-card">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-destructive/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive">
              <CreditCard className="h-3 w-3" /> Subscription Creep Detector
            </span>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Hidden money leaks, exposed.</h1>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Your subscriptions are saved to your account — only you can see them.
            </p>
          </div>
          {active.length > 0 && (
            <div className="flex flex-col gap-1 shrink-0 text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Monthly leak</div>
              <div className="font-display text-4xl font-bold text-destructive">{formatINR(Math.round(totalMonthly))}</div>
              <div className="text-xs text-muted-foreground">{formatINR(Math.round(totalAnnual))}/year</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      {active.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total Active"    value={`${active.length}`}                      sub="subscriptions"   color="text-foreground" />
          <StatCard label="Monthly Drain"   value={formatINR(Math.round(totalMonthly))}     sub="every month"     color="text-destructive" />
          <StatCard label="Annual Cost"     value={formatINR(Math.round(totalAnnual))}      sub="per year"        color="text-destructive" />
          <StatCard label="Auto-detected"   value={`${active.filter(s=>s.source==="auto").length}`} sub="from analysis" color="text-chart-1" />
        </div>
      )}

      {/* ── Main card ── */}
      <section className="rounded-3xl border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-bold">My Subscriptions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Saved to your account · only visible to you</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchSubs} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors" title="Refresh">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-elevated hover:scale-[1.02] transition-transform">
              <Plus className="h-4 w-4" /> Add Subscription
            </button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="border-b border-border bg-muted/30 px-6 py-6 space-y-4">
            <h3 className="text-sm font-bold">{editingSub ? "Edit Subscription" : "New Subscription"}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name *</label>
                <input
                  list="popular-subs"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Netflix, Spotify…"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <datalist id="popular-subs">{POPULAR_SUBS.map((s) => <option key={s} value={s} />)}</datalist>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount (₹) *</label>
                <input
                  type="number" min="1" value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 499"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Billing Cycle", field: "cycle" as const, options: [["monthly","Monthly"],["quarterly","Quarterly"],["yearly","Yearly"]] },
                { label: "Category", field: "category" as const, options: CATEGORIES.map(c=>[c,c]) },
                { label: "Priority", field: "priority" as const, options: [["high","🔴 High"],["medium","🟡 Medium"],["low","🟢 Low"]] },
              ].map(({ label, field, options }) => (
                <div key={field}>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
                  <div className="relative">
                    <select
                      value={(form as any)[field]}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 pr-8"
                    >
                      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
            {formError && <p className="flex items-center gap-1.5 text-xs text-destructive font-medium"><AlertTriangle className="h-3.5 w-3.5" />{formError}</p>}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={saveSub} disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground shadow-glow hover:scale-[1.02] transition-transform disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {saving ? "Saving…" : editingSub ? "Save Changes" : "Add Subscription"}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingSub(null); setFormError(""); }}
                className="rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >Cancel</button>
              {form.amount && (
                <span className="ml-auto text-xs text-muted-foreground">
                  ≈ <strong>{formatINR(Math.round(parseFloat(form.amount || "0") * CYCLE_MULTIPLIER[form.cycle]))}/mo</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Loading your subscriptions…</p>
          </div>
        ) : active.length === 0 && !showForm ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center px-6">
            <CreditCard className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">No subscriptions yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Click <strong>"Add Subscription"</strong> to manually track charges, or run a transaction analysis to auto-detect them.
            </p>
            <Link to="/analyze" className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Auto-detect from transactions
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {active.map((sub) => (
              <SubRow
                key={sub.sub_id}
                sub={sub}
                deleting={deletingId === sub.sub_id}
                onEdit={() => openEdit(sub)}
                onCancel={() => markCancelled(sub)}
                onDelete={() => removeSub(sub)}
              />
            ))}
          </div>
        )}

        {/* Cancelled section */}
        {cancelled.length > 0 && (
          <div className="border-t border-border">
            <button
              onClick={() => setShowCancelled((v) => !v)}
              className="flex w-full items-center justify-between px-6 py-4 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                {cancelled.length} Cancelled subscription{cancelled.length > 1 ? "s" : ""}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showCancelled ? "rotate-180" : ""}`} />
            </button>
            {showCancelled && (
              <div className="divide-y divide-border border-t border-border">
                {cancelled.map((sub) => (
                  <div key={sub.sub_id} className="flex items-center justify-between px-6 py-3 bg-success/5">
                    <div>
                      <span className="text-sm font-semibold line-through text-muted-foreground">{sub.name}</span>
                      <span className="ml-2 text-xs text-success font-semibold">Cancelled · saving {formatINR(sub.monthly_cost)}/mo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => undoCancel(sub)} className="text-[11px] text-muted-foreground hover:text-foreground underline">Undo</button>
                      <button
                        onClick={() => removeSub(sub)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        {deletingId === sub.sub_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Tips ── */}
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
              The average Indian spends ₹2,000–₹5,000/month on forgotten subscriptions — up to <strong>₹60,000/year</strong>.
            </div>
          </div>
          <Link to="/analyze" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors whitespace-nowrap">
            <RefreshCw className="h-3.5 w-3.5" /> Re-analyze transactions
          </Link>
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function SubRow({ sub, deleting, onEdit, onCancel, onDelete }: {
  sub: DbSubscription;
  deleting: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const priority = (sub.priority ?? "low") as Priority;
  const emoji =
    sub.category === "Streaming" ? "🎬" : sub.category === "Music" ? "🎵" :
    sub.category === "Food Delivery" ? "🍕" : sub.category === "Gaming" ? "🎮" :
    sub.category === "Education" ? "📚" : sub.category === "Fitness" ? "💪" :
    sub.source === "auto" ? "🔍" : "💳";

  return (
    <div className={`flex items-center gap-4 px-6 py-4 transition-colors ${PRIORITY_COLOR[priority]}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background border border-border text-lg">{emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate">{sub.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PRIORITY_BADGE[priority]}`}>{priority}</span>
          {sub.source === "auto" && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent font-semibold">Auto-detected</span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{sub.category}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{formatINR(sub.monthly_cost)}/mo</span>
          <span className="text-destructive font-semibold">{formatINR(sub.annual_cost)}/year</span>
          {sub.potential_savings > 0 && <span className="text-success font-semibold">Save {formatINR(sub.potential_savings)}</span>}
        </div>
        {sub.action_plan && (
          <p className="mt-1 text-[11px] text-muted-foreground/80 leading-relaxed max-w-md">{sub.action_plan}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {sub.source === "manual" && (
          <button onClick={onEdit} className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            Edit
          </button>
        )}
        <button onClick={onCancel} className="rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-[11px] font-semibold text-success hover:bg-success/20 transition-colors">
          ✓ Cancelled
        </button>
        <button onClick={onDelete} disabled={deleting} className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

const TIPS = [
  { emoji: "📋", title: "Do a monthly audit", body: "Set a recurring calendar reminder on the 1st of each month to review all card charges." },
  { emoji: "🔔", title: "Use free-trial alerts", body: "Set a phone alarm 2 days before any free trial ends so you can cancel before being charged." },
  { emoji: "🔒", title: "Use a virtual card", body: "Create a virtual debit card with a monthly spend limit just for subscriptions to cap your leak." },
];
