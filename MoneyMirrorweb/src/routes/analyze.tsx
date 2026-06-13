import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { ArrowRight, Sparkles, Plus, X, Upload, FileText, CalendarDays } from "lucide-react";
import { useAnalysisStore } from "@/lib/analysisStore";
import { demoTransactions, uploadCsv, type Transaction } from "@/services/api";
import { toast } from "sonner";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Start your analysis — MoneyMirror AI" },
      { name: "description", content: "Enter your transactions and income to begin." },
    ],
  }),
  component: AnalyzePage,
});

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i); // 2 past + current + 2 future

function AnalyzePage() {
  const navigate = useNavigate();
  const setAll = useAnalysisStore((s) => s.setAll);
  const [transactions, setTransactions] = useState<Transaction[]>([
    { description: "", amount: 0 },
  ]);
  const [income, setIncome] = useState<number>(0);
  const [expenses, setExpenses] = useState<number>(0);
  const [savings, setSavings] = useState<number>(0);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const addTransaction = () => {
    setTransactions([...transactions, { description: "", amount: 0 }]);
  };

  const removeTransaction = (index: number) => {
    setTransactions(transactions.filter((_, i) => i !== index));
  };

  const updateTransaction = (index: number, field: keyof Transaction, value: string | number) => {
    const updated = [...transactions];
    updated[index] = { ...updated[index], [field]: value };
    setTransactions(updated);
  };

  const loadDemo = () => {
    setTransactions(demoTransactions);
    setIncome(85000);
    setExpenses(52000);
    setSavings(120000);
    setCsvFileName(null);
    toast.success("Demo dataset loaded.");
  };

  const [csvUploading, setCsvUploading] = useState(false);

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvUploading(true);
    try {
      const json = await uploadCsv(file);
      if (!json.success || !json.transactions?.length) {
        toast.error(json.message || "No valid transactions found in CSV.");
        return;
      }
      setTransactions(json.transactions);
      setCsvFileName(file.name);
      toast.success(`Loaded ${json.count} transactions from ${file.name}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Could not reach the server. Is the backend running?";
      toast.error(msg);
    } finally {
      setCsvUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validTx = transactions.filter((t) => t.description.trim() !== "" && t.amount > 0);
    if (validTx.length === 0) return toast.error("Please add at least one valid transaction.");
    if (!income || !expenses) return toast.error("Enter monthly income and expenses.");
    const monthLabel = `${MONTHS[selectedMonth]} ${selectedYear}`;
    setAll({ transactions: validTx, income, expenses, savings, analysisMonth: monthLabel });
    navigate({ to: "/results" });
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <div className="mb-10 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Step 1 of 1
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Tell us about your money.</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Two short sections. Everything stays in your browser unless a backend is connected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* CSV Upload */}
          <label
            htmlFor="csv-upload"
            className={`cursor-pointer inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold shadow-card hover:bg-muted transition-colors ${csvUploading ? "opacity-60 pointer-events-none" : ""}`}
            title="CSV format: date,description,amount"
          >
            <Upload className="h-3.5 w-3.5 text-accent" />
            {csvUploading ? "Uploading…" : "Upload CSV"}
          </label>
          <input
            id="csv-upload"
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={handleCSVUpload}
          />
          {/* Demo data */}
          <button
            type="button"
            onClick={loadDemo}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold shadow-card hover:bg-muted transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Fill with demo data
          </button>
        </div>
      </div>

      {/* CSV badge — shows which file was loaded */}
      {csvFileName && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground shadow-card">
          <FileText className="h-3.5 w-3.5 text-accent" />
          {csvFileName}
          <button
            type="button"
            onClick={() => {
              setCsvFileName(null);
              setTransactions([{ description: "", amount: 0 }]);
            }}
            className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-8">
        {/* Section A — Transactions */}
        <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-xs font-bold text-accent">A.</span>
            <h2 className="font-display text-xl font-bold tracking-tight">Transactions</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter where you spend your money and how much you spend <strong>per month</strong>.{" "}
            <span className="text-accent font-medium">Or upload a monthly CSV above.</span>
          </p>

          {/* Month / Year selector */}
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted/40 px-5 py-4">
            <CalendarDays className="h-4 w-4 shrink-0 text-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Data for month:
            </span>
            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="rounded-xl border border-input bg-background py-2 pl-3 pr-8 text-sm font-semibold focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-xl border border-input bg-background py-2 pl-3 pr-8 text-sm font-semibold focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <span className="ml-auto hidden sm:inline-block text-xs text-muted-foreground">
              Selected: <strong>{MONTHS[selectedMonth]} {selectedYear}</strong>
            </span>
          </div>

          {/* Datalist — shared across all rows */}
          <datalist id="expenditure-types">
            {/* Food & Dining */}
            <option value="Swiggy Order" />
            <option value="Zomato Order" />
            <option value="Starbucks Coffee" />
            <option value="Restaurant Dining" />
            <option value="Grocery Shopping" />
            <option value="BigBasket Order" />
            <option value="Blinkit Order" />
            <option value="Zepto Order" />
            {/* Transport */}
            <option value="Uber Ride" />
            <option value="Ola Cab" />
            <option value="Rapido Bike" />
            <option value="Metro / Bus Pass" />
            <option value="Petrol / Fuel" />
            <option value="FastTag Recharge" />
            {/* Subscriptions */}
            <option value="Netflix Subscription" />
            <option value="Spotify Premium" />
            <option value="Amazon Prime" />
            <option value="Disney+ Hotstar" />
            <option value="YouTube Premium" />
            <option value="Apple iCloud" />
            <option value="Zee5 Subscription" />
            {/* Bills & Utilities */}
            <option value="Rent" />
            <option value="Electricity Bill" />
            <option value="Water Bill" />
            <option value="Wifi / Broadband" />
            <option value="Mobile Recharge" />
            <option value="Gas Cylinder" />
            <option value="LIC / Insurance Premium" />
            <option value="Home Loan EMI" />
            <option value="Personal Loan EMI" />
            {/* Shopping */}
            <option value="Amazon Shopping" />
            <option value="Myntra Shopping" />
            <option value="Flipkart Order" />
            <option value="Meesho Order" />
            <option value="Nykaa Beauty" />
            {/* Health */}
            <option value="Pharmacy / Medicine" />
            <option value="Doctor Consultation" />
            <option value="Gym Membership" />
            <option value="Cult Fit Subscription" />
            {/* Education */}
            <option value="Udemy Course" />
            <option value="Coursera Subscription" />
            <option value="School / Tuition Fees" />
            <option value="Books & Stationery" />
            {/* Investments */}
            <option value="Mutual Fund SIP" />
            <option value="Stocks / Zerodha" />
            <option value="PPF / NPS Contribution" />
            <option value="Fixed Deposit" />
            {/* Entertainment */}
            <option value="Movie Tickets" />
            <option value="BookMyShow" />
            <option value="Gaming / Steam" />
          </datalist>

          <div className="mt-5 space-y-4">
            {transactions.map((tx, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-start gap-3">
                <div className="flex-1 w-full">
                  {idx === 0 && (
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                      Expenditure Type
                    </label>
                  )}
                  <input
                    type="text"
                    list="expenditure-types"
                    value={tx.description}
                    onChange={(e) => updateTransaction(idx, "description", e.target.value)}
                    placeholder="e.g. Swiggy, Uber, Rent…"
                    autoComplete="off"
                    className="w-full rounded-xl border border-input bg-background py-3 px-3 font-medium text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div className="flex-1 w-full">
                  {idx === 0 && (
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                      Monthly Amount (₹)
                    </label>
                  )}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={tx.amount || ""}
                      onChange={(e) => updateTransaction(idx, "amount", Number(e.target.value))}
                      placeholder="500"
                      className="w-full rounded-xl border border-input bg-background py-3 pl-7 pr-3 font-mono text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeTransaction(idx)}
                  className={`p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-muted ${idx === 0 ? "mt-6" : "mt-0 sm:mt-0"}`}
                  title="Remove transaction"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>


          <button
            type="button"
            onClick={addTransaction}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add another expense
          </button>
        </section>

        {/* Section B — Financial Twin Inputs */}
        <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-xs font-bold text-accent">B.</span>
            <h2 className="font-display text-xl font-bold tracking-tight">Financial Twin Inputs</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">All values in ₹.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <NumField label="Monthly Income" value={income} onChange={setIncome} placeholder="85000" />
            <NumField label="Monthly Expenses" value={expenses} onChange={setExpenses} placeholder="52000" />
            <NumField label="Current Savings" value={savings} onChange={setSavings} placeholder="120000" />
          </div>
        </section>

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">By analyzing, you agree to MoneyMirror's terms.</p>
          <button
            type="submit"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-elevated transition-all hover:scale-[1.02]"
          >
            Analyze &amp; Generate Twin
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="relative mt-2">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={placeholder}
          className="w-full rounded-xl border border-input bg-background py-3 pl-8 pr-3 font-mono text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>
    </div>
  );
}
