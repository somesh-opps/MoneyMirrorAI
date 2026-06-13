import axios from "axios";
import {
  mockAnalyzeTransactions,
  mockDetectSubscriptions,
  mockFinancialTwin,
  mockScamShield,
  mockInterventions,
  demoTransactions,
} from "@/lib/mockData";

const API_URL = (import.meta as any).env?.VITE_API_URL || "";

if (!API_URL) {
  console.warn("[MoneyMirror] VITE_API_URL is not set — running on mock data.");
} else {
  console.info(`[MoneyMirror] Backend connected at ${API_URL}`);
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // 60s — financial computations can take a moment
  headers: { "Content-Type": "application/json" },
});

// Log every request / response for debugging
api.interceptors.request.use((config) => {
  console.debug(`[API] → ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});
api.interceptors.response.use(
  (res) => {
    console.debug(`[API] ← ${res.status} ${res.config.url}`);
    return res;
  },
  (err) => {
    console.error(`[API] ✗ ${err.config?.url}:`, err.message);
    return Promise.reject(err);
  },
);

// ─── Types ────────────────────────────────────────────
export type Transaction = { amount: number; description: string; date?: string };

export type DoctorResponse = {
  summary: {
    score: number;
    total_spent: number;
    total_income?: number;
    net?: number;
    transactions_count: number;
    status?: string;
    savings_rate?: number;
    expense_ratio?: number;
    emergency_fund_months?: number;
  };
  categories: Record<string, number>;
  // Financial Doctor enriched fields
  insights?: string[];
  recommendations?: string[];
  current_annual_savings?: number;
  optimized_annual_savings?: number;
  potential_extra_savings?: number;
  monthly_savings?: number;
  monthly_income?: number;
};

export type Subscription = {
  name: string;
  monthly_cost: number;
  annual_cost: number;
  potential_savings: number;
  category?: string;
  action_plan?: string;
};

export type FinancialTwinResponse = {
  current_path: { year: number; net_worth: number }[];
  optimized_path: { year: number; net_worth: number }[];
  best_case_path?: { year: number; net_worth: number }[];
  projected_savings: number;
  potential_gain: number;
  current_monthly_savings: number;
  optimized_monthly_savings: number;
  best_case_monthly_savings?: number;
  // New algorithm fields
  financial_twin_score?: number;
  persona?: string;
  current_milestones?: { "1_year": number; "3_year": number; "5_year": number };
  optimized_milestones?: { "1_year": number; "3_year": number; "5_year": number };
  scenarios?: { worst_case: number; average_case: number; best_case: number };
  monthly_improvement?: number;
  twin_recommendations?: string[];
  // 50/30/20 rule breakdown
  rule_502030?: {
    current: {
      needs: { amount: number; pct: number };
      wants: { amount: number; pct: number };
      savings: { amount: number; pct: number };
    };
    ideal: {
      needs: { amount: number; pct: number };
      wants: { amount: number; pct: number };
      savings: { amount: number; pct: number };
    };
    gap: { needs: number; wants: number; savings: number };
  };
};

export type Intervention = {
  priority: "high" | "medium" | "low";
  title: string;
  action: string;
  savings_impact: number;
  timeline: string;
  category: string;
};

export type ScamResponse = {
  risk_score: number;
  reasons: string[];
  risk_reasons?: string[];
  trust_signals?: string[];
  critical_flags?: string[];
  recommendation: string;
  verdict: "safe" | "suspicious" | "dangerous";
  confidence?: number;
};

export type AuthUser = {
  user_id: string;
  name: string;
  email: string;
  profile_image: string;
  created_at: string | null;
};

export type AuthResponse = {
  success: boolean;
  message: string;
  user?: AuthUser;
};

// ─── Fallback helper ──────────────────────────────────
async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: () => T,
  label: string,
): Promise<T> {
  if (!API_URL) {
    console.warn(`[API] No backend — using mock for ${label}`);
    return fallback();
  }
  try {
    return await fn();
  } catch (err) {
    console.error(`[API] ${label} failed, falling back to mock:`, err);
    return fallback();
  }
}

// Helper: safely read user_id from localStorage
function getUserId(): string | undefined {
  try {
    const raw = localStorage.getItem("mm_user");
    return raw ? JSON.parse(raw)?.user_id : undefined;
  } catch {
    return undefined;
  }
}

// ─── Financial endpoints (proxied through Flask → FastAPI) ────
export const analyzeTransactions = (
  transactions: Transaction[],
  opts?: { monthly_income?: number; monthly_savings?: number; current_emergency_fund?: number; month?: string },
) =>
  withFallback<DoctorResponse>(
    async () =>
      (
        await api.post("/analyze-transactions", {
          transactions,
          monthly_income: opts?.monthly_income ?? 0,
          monthly_savings: opts?.monthly_savings ?? 0,
          current_emergency_fund: opts?.current_emergency_fund ?? 0,
          user_id: getUserId(),       // ← persists to DB
          month: opts?.month,
        })
      ).data,
    () => mockAnalyzeTransactions(transactions),
    "analyzeTransactions",
  );

export const detectSubscriptions = (transactions: Transaction[], month?: string) =>
  withFallback<{ subscriptions: Subscription[] }>(
    async () => (await api.post("/detect-subscriptions", { transactions, user_id: getUserId(), month })).data,
    () => mockDetectSubscriptions(transactions),
    "detectSubscriptions",
  );

export const generateFinancialTwin = (payload: {
  monthly_income: number;
  monthly_expenses: number;
  current_savings: number;
  food_expense?: number;
  shopping_expense?: number;
  subscription_expense?: number;
  categories?: Record<string, number>;
  month?: string;
}) =>
  withFallback<FinancialTwinResponse>(
    async () => (await api.post("/financial-twin", { ...payload, user_id: getUserId() })).data,
    () => mockFinancialTwin({
      monthly_income: payload.monthly_income,
      monthly_expenses: payload.monthly_expenses,
      current_savings: payload.current_savings,
    }),
    "financialTwin",
  );

export const generateInterventions = (payload: {
  transactions: Transaction[];
  monthly_income: number;
  monthly_expenses: number;
  month?: string;
}) =>
  withFallback<{ interventions: Intervention[] }>(
    async () => (await api.post("/interventions", { ...payload, user_id: getUserId() })).data,
    () => ({ interventions: mockInterventions(payload) }),
    "interventions",
  );

// ─── Analysis history & personalization ─────────────────────────
export type AnalysisHistoryItem = {
  analysis_id: string;
  user_id: string;
  analysis_type: "doctor" | "twin" | "subscriptions" | "interventions";
  created_at: string;
  month?: string;
  year?: number;
  inputs: {
    monthly_income?: number;
    monthly_expenses?: number;
    monthly_savings?: number;
    current_savings?: number;
    transaction_count?: number;
  };
  result: Record<string, unknown>;
};

export type AnalysisSummary = {
  average_health_score: number;
  latest_health_score: number;
  earliest_health_score: number;
  avg_savings_rate: number;
  trend: "improving" | "stable" | "declining";
  last_analysis_date: string;
  months_tracked: number;
};

export const getAnalysisHistory = async (
  userId: string,
  type?: string,
  limit = 20,
  skip = 0,
): Promise<{ success: boolean; total: number; analyses: AnalysisHistoryItem[] }> => {
  const res = await api.get("/api/analyses", {
    params: { user_id: userId, type, limit, skip },
  });
  return res.data;
};

export const getAnalysisSummary = async (
  userId: string,
): Promise<{ success: boolean; total_analyses: number; summary: AnalysisSummary | null }> => {
  const res = await api.get("/api/analyses/summary", { params: { user_id: userId } });
  return res.data;
};

export const analyzeScam = (message: string) =>
  withFallback<ScamResponse>(
    async () => (await api.post("/scam-shield", { message })).data,
    () => mockScamShield(message),
    "scamShield",
  );

// ─── Auth endpoints (Flask only, no mock fallback) ───
export const authSignup = async (payload: {
  name: string;
  email: string;
  password: string;
  confirm_password?: string;
}): Promise<AuthResponse> => {
  const res = await api.post("/api/auth/signup", payload);
  return res.data;
};

export const authLogin = async (payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> => {
  const res = await api.post("/api/auth/login", payload);
  return res.data;
};

export const authForgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
  const res = await api.post("/api/auth/forgot-password", { email });
  return res.data;
};

export const authVerifyOtp = async (email: string, otp: string): Promise<{ success: boolean; message: string }> => {
  const res = await api.post("/api/auth/verify-reset-otp", { email, otp });
  return res.data;
};

export const authResetPassword = async (payload: {
  email: string;
  otp: string;
  new_password: string;
}): Promise<{ success: boolean; message: string }> => {
  const res = await api.post("/api/auth/reset-password", payload);
  return res.data;
};

export const authMe = async (email: string): Promise<AuthResponse> => {
  const res = await api.post("/api/auth/me", { email });
  return res.data;
};

// ─── CSV Upload ───────────────────────────────────────
export const uploadCsv = async (file: File): Promise<{ success: boolean; transactions: Transaction[]; count: number; message?: string }> => {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/upload-csv", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export { demoTransactions };
