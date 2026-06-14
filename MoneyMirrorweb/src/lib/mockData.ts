import type {
  Transaction,
  DoctorResponse,
  Subscription,
  FinancialTwinResponse,
  ScamResponse,
  Intervention,
} from "@/services/api";

export const demoTransactions: Transaction[] = [
  { amount: 499, description: "Netflix Subscription" },
  { amount: 199, description: "Spotify Premium" },
  { amount: 1499, description: "Amazon Prime Annual" },
  { amount: 320, description: "Swiggy Order" },
  { amount: 540, description: "Zomato Dinner" },
  { amount: 280, description: "Swiggy Lunch" },
  { amount: 1200, description: "Uber Ride" },
  { amount: 850, description: "BigBasket Groceries" },
  { amount: 2400, description: "Electricity Bill" },
  { amount: 6500, description: "Rent Share" },
  { amount: 999, description: "Apple iCloud" },
  { amount: 149, description: "YouTube Premium" },
  { amount: 720, description: "Zomato Late Night" },
  { amount: 450, description: "Starbucks Coffee" },
  { amount: 1800, description: "Myntra Shopping" },
  { amount: 220, description: "Ola Auto" },
  { amount: 380, description: "Swiggy Breakfast" },
  { amount: 599, description: "Disney+ Hotstar" },
];

const categorize = (desc: string): string => {
  const d = desc.toLowerCase();
  if (/(netflix|spotify|prime|hotstar|youtube|icloud|disney)/.test(d)) return "Subscriptions";
  if (/(swiggy|zomato|starbucks|cafe)/.test(d)) return "Food Delivery";
  if (/(uber|ola|auto|cab|metro|fuel)/.test(d)) return "Transport";
  if (/(rent|electricity|water|gas|bill)/.test(d)) return "Bills & Utilities";
  if (/(grocer|bigbasket|blinkit|zepto)/.test(d)) return "Groceries";
  if (/(amazon|myntra|flipkart|shopping)/.test(d)) return "Shopping";
  return "Other";
};

const subKeywords = ["netflix", "spotify", "prime", "hotstar", "youtube", "icloud", "disney"];

export function mockAnalyzeTransactions(transactions: Transaction[]): DoctorResponse {
  const categories: Record<string, number> = {};
  let total = 0;
  for (const t of transactions) {
    const c = categorize(t.description);
    categories[c] = (categories[c] || 0) + t.amount;
    total += t.amount;
  }
  // Score: lower discretionary share -> higher score
  const discretionary = (categories["Food Delivery"] || 0) + (categories["Shopping"] || 0) + (categories["Subscriptions"] || 0);
  const ratio = total ? discretionary / total : 0;
  const score = Math.max(20, Math.min(95, Math.round(95 - ratio * 100)));
  return {
    summary: { score, total_spent: total, transactions_count: transactions.length },
    categories,
  };
}

export function mockDetectSubscriptions(transactions: Transaction[]): { subscriptions: Subscription[] } {
  const subs: Subscription[] = [];
  for (const t of transactions) {
    const d = t.description.toLowerCase();
    if (subKeywords.some((k) => d.includes(k))) {
      const monthly = t.amount > 1000 ? Math.round(t.amount / 12) : t.amount;
      subs.push({
        name: t.description,
        monthly_cost: monthly,
        annual_cost: monthly * 12,
        potential_savings: Math.round(monthly * 12 * 0.6),
        category: "Entertainment",
      });
    }
  }
  return { subscriptions: subs };
}

export function mockFinancialTwin(p: {
  monthly_income: number;
  monthly_expenses: number;
  current_savings: number;
}): FinancialTwinResponse {
  const currentSave = Math.max(0, p.monthly_income - p.monthly_expenses);
  const optimizedExpenses = p.monthly_expenses * 0.82; // 18% reduction
  const optimizedSave = Math.max(0, p.monthly_income - optimizedExpenses);
  const bestCaseExpenses = p.monthly_expenses * 0.65; // 35% reduction (aggressive)
  const bestCaseSave = Math.max(0, p.monthly_income - bestCaseExpenses);
  const years = 10;
  const rate = 0.09;
  const current_path: { year: number; net_worth: number }[] = [];
  const optimized_path: { year: number; net_worth: number }[] = [];
  const best_case_path: { year: number; net_worth: number }[] = [];
  let cw = p.current_savings;
  let ow = p.current_savings;
  let bw = p.current_savings;
  for (let y = 0; y <= years; y++) {
    current_path.push({ year: new Date().getFullYear() + y, net_worth: Math.round(cw) });
    optimized_path.push({ year: new Date().getFullYear() + y, net_worth: Math.round(ow) });
    best_case_path.push({ year: new Date().getFullYear() + y, net_worth: Math.round(bw) });
    cw = cw * (1 + rate) + currentSave * 12;
    ow = ow * (1 + rate) + optimizedSave * 12;
    bw = bw * (1 + rate) + bestCaseSave * 12;
  }
  const projected = optimized_path[years].net_worth;
  const gain = projected - current_path[years].net_worth;
  return {
    current_path,
    optimized_path,
    best_case_path,
    projected_savings: projected,
    potential_gain: gain,
    current_monthly_savings: Math.round(currentSave),
    optimized_monthly_savings: Math.round(optimizedSave),
    best_case_monthly_savings: Math.round(bestCaseSave),
  };
}

export function mockInterventions(p: {
  transactions: Transaction[];
  monthly_income: number;
  monthly_expenses: number;
}): Intervention[] {
  const cats = mockAnalyzeTransactions(p.transactions).categories;
  const out: Intervention[] = [];
  if ((cats["Subscriptions"] || 0) > 500) {
    out.push({
      priority: "high",
      title: "Cancel Overlapping Subscriptions",
      action: "You have 4+ streaming subscriptions. Keep 2, cancel the rest.",
      savings_impact: Math.round((cats["Subscriptions"] || 0) * 0.6 * 12),
      timeline: "This week",
      category: "Subscriptions",
    });
  }
  if ((cats["Food Delivery"] || 0) > 1000) {
    out.push({
      priority: "high",
      title: "Reduce Food Delivery by 50%",
      action: "Meal prep 3 days a week to cut Swiggy/Zomato spend significantly.",
      savings_impact: Math.round((cats["Food Delivery"] || 0) * 0.5 * 12),
      timeline: "This month",
      category: "Food",
    });
  }
  if (p.monthly_income > p.monthly_expenses) {
    out.push({
      priority: "medium",
      title: "Start a SIP in Index Funds",
      action: `Invest ₹${Math.round((p.monthly_income - p.monthly_expenses) * 0.4).toLocaleString("en-IN")} monthly in a low-cost index fund.`,
      savings_impact: Math.round((p.monthly_income - p.monthly_expenses) * 0.4 * 12 * 1.5),
      timeline: "Next 30 days",
      category: "Investments",
    });
  }
  out.push({
    priority: "low",
    title: "Build a 6-Month Emergency Fund",
    action: "Park 6× your monthly expenses in a high-yield savings account.",
    savings_impact: 0,
    timeline: "6-12 months",
    category: "Safety Net",
  });
  return out;
}

export function mockScamShield(message: string): ScamResponse {
  const m = message.toLowerCase();
  const flags: { reason: string; weight: number }[] = [];
  if (/kyc|aadhaar|pan/.test(m)) flags.push({ reason: "Mentions KYC / Aadhaar / PAN — a top phishing lure.", weight: 25 });
  if (/click|link|http|bit\.ly|tinyurl/.test(m)) flags.push({ reason: "Contains a suspicious link or call-to-click.", weight: 25 });
  if (/urgent|immediately|today|expires|expire|24 hours|2 hours/.test(m)) flags.push({ reason: "Uses urgency or fear to force quick action.", weight: 20 });
  if (/otp|password|cvv|pin/.test(m)) flags.push({ reason: "Asks for OTP, password, CVV or PIN — never share these.", weight: 25 });
  if (/lottery|prize|won|congratulations|cashback|reward/.test(m)) flags.push({ reason: "Promises a prize, reward, or unexpected money.", weight: 20 });
  if (/bank|account|suspend|block|frozen/.test(m)) flags.push({ reason: "Impersonates a bank or threatens account suspension.", weight: 15 });
  if (/whatsapp|telegram|investment|crypto|trading/.test(m)) flags.push({ reason: "Mentions chat-app investment / trading group — common scam vector.", weight: 15 });

  const risk = Math.min(98, flags.reduce((s, f) => s + f.weight, message.length < 20 ? 5 : 10));
  const verdict: ScamResponse["verdict"] = risk >= 70 ? "dangerous" : risk >= 40 ? "suspicious" : "safe";
  const recommendation =
    verdict === "dangerous"
      ? "Do NOT click any link or respond. Delete the message and report it to your bank or the cybercrime helpline (1930)."
      : verdict === "suspicious"
        ? "Treat with caution. Verify the sender through official channels before taking any action."
        : "Message looks low-risk, but always confirm requests for money or credentials directly with the source.";
  return {
    risk_score: risk,
    reasons: flags.map((f) => f.reason),
    recommendation,
    verdict,
  };
}
