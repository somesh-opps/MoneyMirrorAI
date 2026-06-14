import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { User, Mail, CalendarDays, LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { useAnalysisStore } from "@/lib/analysisStore";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — MoneyMirror AI" },
      { name: "description", content: "Manage your MoneyMirror account." },
    ],
  }),
  component: ProfilePage,
});



function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);

  useEffect(() => {
    if (!user) navigate({ to: "/login" });
  }, [user, navigate]);

  const handleLogout = () => {
    clearUser();
    useAnalysisStore.getState().reset();
    navigate({ to: "/login" });
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 space-y-8">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-hero text-3xl font-bold text-primary-foreground shadow-elevated mb-4">
          {user.name?.[0]?.toUpperCase() ?? "U"}
        </div>
        <h1 className="font-display text-3xl font-bold">{user.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-8 shadow-card space-y-5">
        <h2 className="font-display text-lg font-bold">Account Details</h2>

        <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Full Name</div>
            <div className="text-sm font-semibold mt-0.5">{user.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email Address</div>
            <div className="text-sm font-semibold mt-0.5">{user.email}</div>
          </div>
        </div>

        {user.created_at && (
          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Member Since</div>
              <div className="text-sm font-semibold mt-0.5">
                {new Date(user.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-destructive/40 bg-destructive/5 px-6 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </div>
  );
}
