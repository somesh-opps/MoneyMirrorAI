import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Mail, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — MoneyMirror AI" },
      { name: "description", content: "Reset your MoneyMirror password." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate sending email
    setIsSent(true);
    toast.success("Recovery instructions sent!");
  };

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center px-6 py-12 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1/10 blur-[100px]" />
      </div>
      
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-chart-1 text-chart-1-foreground mb-5 shadow-elevated">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Forgot password?</h1>
          <p className="mt-2 text-sm text-muted-foreground">No worries, we'll send you reset instructions.</p>
        </div>

        <section className="rounded-3xl border border-border bg-card p-8 shadow-card relative">
          {!isSent ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Email Address</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm transition-colors focus:border-chart-1 focus:outline-none focus:ring-2 focus:ring-chart-1/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="group mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-chart-1 px-6 py-3.5 text-sm font-bold text-white shadow-elevated transition-all hover:scale-[1.02]"
              >
                Reset Password
              </button>
            </form>
          ) : (
            <div className="text-center py-6">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Sparkles className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="font-display text-lg font-bold tracking-tight">Check your email</h3>
              <p className="mt-2 text-sm text-muted-foreground mb-6">
                We've sent a password reset link to <strong>{email}</strong>.
              </p>
              <button
                onClick={() => setIsSent(false)}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Didn't receive the email? Click to try again
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
