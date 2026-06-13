import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { authLogin } from "@/services/api";
import { useAuthStore } from "@/lib/authStore";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — MoneyMirror AI" },
      { name: "description", content: "Login to your MoneyMirror account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authLogin({ email, password });
      if (res.success && res.user) {
        setUser(res.user);  // updates Zustand + localStorage atomically
        toast.success(`Welcome back, ${res.user.name}!`);
        navigate({ to: "/dashboard" });
      } else {
        toast.error(res.message || "Login failed.");
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
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[100px]" />
      </div>
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-5 shadow-elevated">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your credentials to continue to MoneyMirror.</p>
        </div>

        <section className="rounded-3xl border border-border bg-card p-8 shadow-card relative">
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
                  className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
                <Link to="/reset-password" className="text-xs font-semibold text-accent hover:underline transition-colors">Forgot password?</Link>
              </div>
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-elevated transition-all hover:scale-[1.02] hover:shadow-glow disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? "Signing in…" : "Sign In"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold text-foreground hover:underline transition-colors">
              Create one
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
