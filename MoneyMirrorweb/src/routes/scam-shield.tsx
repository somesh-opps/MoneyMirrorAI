import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, AlertTriangle, ShieldAlert, Send } from "lucide-react";
import { analyzeScam, type ScamResponse } from "@/services/api";

export const Route = createFileRoute("/scam-shield")({
  head: () => ({
    meta: [
      { title: "Scam Shield AI — MoneyMirror" },
      { name: "description", content: "Paste a suspicious SMS, email, or WhatsApp message. Get an AI risk score in seconds." },
    ],
  }),
  component: ScamShield,
});

const EXAMPLES = [
  "Your KYC expires today. Click http://bit.ly/x to update or your account will be blocked.",
  "Congratulations! You've won ₹50,000 in our lucky draw. Share OTP to claim.",
  "Hi, this is your bank. We notice unusual activity. Please confirm your card CVV.",
];

function ScamShield() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScamResponse | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    const r = await analyzeScam(text.trim());
    setResult(r);
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
      <div className="text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-accent shadow-glow">
          <ShieldCheck className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="mt-5 font-display text-4xl font-bold tracking-tight md:text-5xl">Scam Shield AI</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
          Paste any suspicious SMS, WhatsApp message, email, or text. Get an instant risk verdict.
        </p>
      </div>

      <form onSubmit={submit} className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suspicious message</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder='"Your KYC expires today. Click immediately."'
          className="mt-2 w-full rounded-xl border border-input bg-background p-4 text-sm leading-relaxed shadow-inner focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setText(ex)}
                className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Try example {i + 1}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevated transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {loading ? "Analyzing..." : "Analyze Risk"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-10 text-center shadow-card">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Scanning for scam signals…</p>
        </div>
      )}

      {result && <ScamResult r={result} />}
    </div>
  );
}

function ScamResult({ r }: { r: ScamResponse }) {
  const color =
    r.verdict === "dangerous" ? "var(--destructive)" :
    r.verdict === "suspicious" ? "var(--warning)" :
    "var(--success)";
  const label = r.verdict === "dangerous" ? "DANGEROUS" : r.verdict === "suspicious" ? "SUSPICIOUS" : "LOOKS SAFE";
  const Icon = r.verdict === "safe" ? ShieldCheck : r.verdict === "suspicious" ? AlertTriangle : ShieldAlert;
  const angle = (r.risk_score / 100) * 360;
  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-6 rounded-3xl border border-border bg-card p-8 shadow-elevated md:grid-cols-[auto_1fr] md:items-center">
        <div className="relative mx-auto h-44 w-44 md:mx-0">
          <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${color} ${angle}deg, var(--muted) 0deg)` }} />
          <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-card shadow-card">
            <span className="font-display text-5xl font-bold tracking-tight">{r.risk_score}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Risk score</span>
          </div>
        </div>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider" style={{ background: `${color}22`, color }}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">AI verdict</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.recommendation}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-8 shadow-card">
        <h3 className="font-display text-lg font-bold">Why this score</h3>
        <p className="text-sm text-muted-foreground">Signals our model detected in your message.</p>
        {r.reasons.length === 0 ? (
          <p className="mt-6 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">No scam signals detected.</p>
        ) : (
          <ul className="mt-5 space-y-2.5">
            {r.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-background/50 px-4 py-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-[10px] font-bold text-destructive">!</span>
                {reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
