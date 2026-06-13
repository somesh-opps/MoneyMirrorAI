import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { authSignup } from "@/services/api";
import { useAuthStore } from "@/lib/authStore";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign Up — MoneyMirror AI" },
      { name: "description", content: "Create your MoneyMirror account." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      toast.error("Passwords do not match.");
      return;
    }
    setPasswordMismatch(false);
    setLoading(true);
    try {
      const res = await authSignup({ name, email, password, confirm_password: confirmPassword });
      if (res.success && res.user) {
        setUser(res.user);  // updates Zustand + localStorage atomically
        toast.success("Account created! Welcome to MoneyMirror.");
        navigate({ to: "/dashboard" });
      } else {
        toast.error(res.message || "Signup failed.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Could not connect to server.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center px-6 py-12 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-2/10 blur-[120px]" />
      </div>
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background mb-5 shadow-elevated">
            <User className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Create an account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Join MoneyMirror to unlock your financial twin.</p>
        </div>

        <section className="rounded-3xl border border-border bg-card p-8 shadow-card relative">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Full Name</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>

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
                  className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Must be at least 8 characters long.</p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Re-enter Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordMismatch) setPasswordMismatch(false);
                  }}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border py-3 pl-10 pr-4 text-sm transition-colors focus:outline-none focus:ring-2 bg-background ${
                    passwordMismatch
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-input focus:border-accent focus:ring-accent/20"
                  }`}
                />
              </div>
              {passwordMismatch && (
                <p className="mt-2 text-xs text-red-500 font-medium">Passwords do not match.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-bold text-background shadow-elevated transition-all hover:scale-[1.02] disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? "Creating account…" : "Sign Up"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-foreground hover:underline transition-colors">
              Sign in
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
