import { create } from "zustand";
import type {
  Transaction,
  DoctorResponse,
  Subscription,
  FinancialTwinResponse,
  Intervention,
} from "@/services/api";

type State = {
  transactions: Transaction[];
  income: number;
  expenses: number;
  savings: number;
  analysisMonth: string;         // e.g. "June 2026"
  doctor: DoctorResponse | null;
  subscriptions: Subscription[];
  twin: FinancialTwinResponse | null;
  interventions: Intervention[];
  setAll: (s: Partial<State>) => void;
  reset: () => void;
};

export const useAnalysisStore = create<State>((set) => ({
  transactions: [],
  income: 0,
  expenses: 0,
  savings: 0,
  analysisMonth: "",
  doctor: null,
  subscriptions: [],
  twin: null,
  interventions: [],
  setAll: (s) => set(s),
  reset: () =>
    set({
      transactions: [],
      income: 0,
      expenses: 0,
      savings: 0,
      analysisMonth: "",
      doctor: null,
      subscriptions: [],
      twin: null,
      interventions: [],
    }),
}));

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
