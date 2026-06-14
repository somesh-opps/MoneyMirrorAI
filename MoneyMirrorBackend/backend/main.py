"""
main.py — MoneyMirror Financial Computation Engine (FastAPI, port 8001)
All financial calculations are done here using numpy & pandas.
app.py (Flask) proxies requests from the frontend to these endpoints.
"""

import io
import re
import os
import math
import csv as csv_module
import json
import requests
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

import numpy as np
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="MoneyMirror Computation Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────

class Transaction(BaseModel):
    description: str
    amount: float
    date: Optional[str] = None


class TransactionsPayload(BaseModel):
    transactions: list[Transaction]
    # Financial doctor inputs (optional — fallback to 0 if not provided)
    monthly_income: float = 0.0
    monthly_expenses: float = 0.0   # user's declared monthly expense figure
    monthly_savings: float = 0.0
    current_emergency_fund: float = 0.0  # user's current savings / emergency fund balance


class FinancialTwinPayload(BaseModel):
    monthly_income: float
    monthly_expenses: float
    current_savings: float
    # Category amounts — passed from the transaction analyser for smarter projections
    food_expense: float = 0.0
    shopping_expense: float = 0.0
    subscription_expense: float = 0.0
    # Full category breakdown for 50/30/20 split
    categories: dict = {}


class InterventionsPayload(BaseModel):
    transactions: list[Transaction]
    monthly_income: float
    monthly_expenses: float


class ScamShieldPayload(BaseModel):
    message: str


# ─────────────────────────────────────────────
# Category mapping (vectorised via pandas)
# ─────────────────────────────────────────────

CATEGORY_RULES: list[tuple[str, str]] = [
    (r"netflix|spotify|prime|hotstar|youtube|icloud|disney|zee5|sonyliv|jiocinema|crunchyroll|audible", "Subscriptions"),
    (r"swiggy|zomato|starbucks|cafe|dunkin|dominos|pizza|mcdonalds|kfc|burger|restaurant|food|blinkit|zepto", "Food Delivery"),
    (r"uber|ola|auto|cab|metro|fuel|petrol|diesel|fastag|rapido|bike", "Transport"),
    (r"rent|electricity|water|gas|bill|wifi|broadband|airtel|jio|bsnl|tata sky|dth|insurance|emi|loan", "Bills & Utilities"),
    (r"grocer|bigbasket|nature basket|dmart|reliance fresh|smart bazaar|vegetable|fruit|milk|dairy", "Groceries"),
    (r"amazon|myntra|flipkart|ajio|meesho|nykaa|beauty|cosmetics|clothes|fashion|shopping|mall", "Shopping"),
    (r"gym|fitness|cult|yoga|sport|health|pharmacy|medicine|hospital|clinic|doctor", "Health & Fitness"),
    (r"school|college|course|udemy|coursera|book|education|tuition|class|learning", "Education"),
    (r"invest|mutual fund|sip|stocks|zerodha|groww|upstox|angel|crypto|nps|ppf|fd", "Investments"),
    (r"movie|bookmyshow|pvr|inox|concert|event|game|netflix|entertainment", "Entertainment"),
    (r"salary|income|bonus|credit|refund|cashback|reward", "Income"),
]

SUBSCRIPTION_KEYWORDS = re.compile(
    r"netflix|spotify|prime|hotstar|youtube|icloud|disney|zee5|sonyliv|jiocinema|"
    r"crunchyroll|audible|apple one|google one|microsoft 365|adobe|canva|dropbox|"
    r"linkedin|github|notion",
    re.IGNORECASE,
)


def _categorize_series(descriptions: pd.Series) -> pd.Series:
    """Vectorised categorisation using pandas string methods."""
    result = pd.Series(["Other"] * len(descriptions), index=descriptions.index)
    for pattern, category in reversed(CATEGORY_RULES):
        mask = descriptions.str.contains(pattern, case=False, na=False, regex=True)
        result[mask] = category
    return result


# ─────────────────────────────────────────────
# Financial Doctor core logic
# ─────────────────────────────────────────────

def financial_doctor(
    monthly_income: float,
    monthly_expenses: float,
    monthly_savings: float,
    current_emergency_fund: float,
    expenses: list[dict],
) -> dict:
    """
    Calculates a 0-100 financial health score from:
      - savings rate     (30 pts max)
      - expense ratio    (30 pts max)
      - emergency fund   (40 pts max)
    Also returns insights, recommendations, and annual savings projections.
    """
    total_tx_amount = sum(item["amount"] for item in expenses)

    # Use declared monthly figures; fall back to transaction totals
    effective_income   = monthly_income  if monthly_income  > 0 else 0
    effective_expenses = monthly_expenses if monthly_expenses > 0 else total_tx_amount
    effective_savings  = monthly_savings if monthly_savings > 0 else max(0, effective_income - effective_expenses)

    savings_rate  = (effective_savings  / effective_income   * 100) if effective_income  > 0 else 0
    expense_ratio = (effective_expenses / effective_income   * 100) if effective_income  > 0 else 100

    # ── Savings Score (30 pts) ──────────────────────────────────
    if savings_rate >= 25:
        savings_points = 30
    elif savings_rate >= 15:
        savings_points = 22
    elif savings_rate >= 10:
        savings_points = 15
    elif savings_rate >= 5:
        savings_points = 8
    else:
        savings_points = 0

    # ── Expense Score (30 pts) ──────────────────────────────────
    if expense_ratio <= 50:
        expense_points = 30
    elif expense_ratio <= 65:
        expense_points = 22
    elif expense_ratio <= 80:
        expense_points = 15
    elif expense_ratio <= 95:
        expense_points = 8
    else:
        expense_points = 0

    # ── Emergency Fund Score (40 pts) ───────────────────────────
    # Use monthly_expenses (not raw tx total) as the monthly burn rate
    monthly_burn = effective_expenses if effective_expenses > 0 else max(total_tx_amount, 1)
    months_covered = current_emergency_fund / monthly_burn if monthly_burn > 0 else 0

    if months_covered >= 6:
        emergency_points = 40
    elif months_covered >= 4:
        emergency_points = 30
    elif months_covered >= 2:
        emergency_points = 18
    elif months_covered >= 1:
        emergency_points = 10
    else:
        emergency_points = 0

    financial_score = min(savings_points + expense_points + emergency_points, 100)

    # Status labels — aligned with frontend (ResultComponents.tsx)
    if financial_score >= 75:
        status = "Excellent"
    elif financial_score >= 55:
        status = "Healthy"
    elif financial_score >= 35:
        status = "Needs work"
    else:
        status = "Critical"

    # Category breakdown
    category_breakdown: dict[str, float] = {}
    for item in expenses:
        cat = item["category"]
        category_breakdown[cat] = category_breakdown.get(cat, 0) + item["amount"]

    insights: list[str] = []
    recommendations: list[str] = []

    food = category_breakdown.get("Food", 0) + category_breakdown.get("Food Delivery", 0)
    shopping = category_breakdown.get("Shopping", 0)
    subscriptions = category_breakdown.get("Subscriptions", 0)

    if effective_income > 0 and food > effective_income * 0.30:
        insights.append("Food spending exceeds 30% of income.")
        recommendations.append("Reduce food expenses by 10-15%.")

    if effective_income > 0 and shopping > effective_income * 0.20:
        insights.append("Shopping expenses are unusually high.")
        recommendations.append("Reduce discretionary shopping.")

    if effective_income > 0 and subscriptions > effective_income * 0.05:
        insights.append("Subscription spending is high.")
        recommendations.append("Review unused subscriptions.")

    if savings_rate < 20:
        recommendations.append("Increase monthly savings to at least 20% of income.")

    if months_covered < 3:
        recommendations.append(f"Build an emergency fund of at least {int(monthly_burn * 3):,} (3× monthly expenses).")

    current_annual_savings = effective_savings * 12
    optimized_annual_savings = (effective_savings + 1000) * 12

    return {
        "financial_score": financial_score,
        "status": status,
        "monthly_income": effective_income,
        "monthly_expenses": effective_expenses,
        "monthly_savings": effective_savings,
        "savings_rate": round(savings_rate, 2),
        "expense_ratio": round(expense_ratio, 2),
        "emergency_fund_months": round(months_covered, 2),
        "category_breakdown": {k: round(float(v), 2) for k, v in category_breakdown.items()},
        "insights": insights,
        "recommendations": recommendations,
        "current_annual_savings": current_annual_savings,
        "optimized_annual_savings": optimized_annual_savings,
        "potential_extra_savings": optimized_annual_savings - current_annual_savings,
    }


# ─────────────────────────────────────────────
# /analyze-transactions
# ─────────────────────────────────────────────

@app.post("/analyze-transactions")
def analyze_transactions(payload: TransactionsPayload):
    """
    Categorise transactions with pandas, then run the financial_doctor
    scoring algorithm. Returns backward-compat summary/categories shape
    plus all new doctor fields.
    """
    if not payload.transactions:
        raise HTTPException(status_code=400, detail="transactions list is empty")

    df = pd.DataFrame([t.model_dump() for t in payload.transactions])
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
    df = df[df["amount"] > 0]
    df["category"] = _categorize_series(df["description"])

    expense_df = df[df["category"] != "Income"]
    total_spent = float(expense_df["amount"].sum())
    pandas_categories = expense_df.groupby("category")["amount"].sum().round(2).to_dict()

    # Build expenses list for financial_doctor
    expenses_for_doctor = [
        {"category": cat, "amount": float(amt)}
        for cat, amt in pandas_categories.items()
    ]

    monthly_income  = payload.monthly_income
    monthly_expenses = payload.monthly_expenses
    monthly_savings  = payload.monthly_savings
    current_emergency_fund = payload.current_emergency_fund

    # If monthly_savings not supplied, compute from income - expenses
    if monthly_savings == 0 and monthly_income > 0 and monthly_expenses > 0:
        monthly_savings = max(0.0, monthly_income - monthly_expenses)

    # Run the financial doctor
    doctor = financial_doctor(
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        monthly_savings=monthly_savings,
        current_emergency_fund=current_emergency_fund,
        expenses=expenses_for_doctor,
    )

    net = round(monthly_income - doctor["monthly_expenses"], 2)

    return {
        # ── Backward-compat shape (used by existing frontend components) ──
        "summary": {
            "score": doctor["financial_score"],
            "total_spent": round(total_spent, 2),
            "total_income": float(df[df["category"] == "Income"]["amount"].sum()),
            "net": net,
            "transactions_count": len(df),
            # Extra summary fields
            "status": doctor["status"],
            "savings_rate": doctor["savings_rate"],
            "expense_ratio": doctor["expense_ratio"],
            "emergency_fund_months": doctor["emergency_fund_months"],
        },
        "categories": {k: round(float(v), 2) for k, v in pandas_categories.items()},
        # ── New doctor fields ──
        "insights": doctor["insights"],
        "recommendations": doctor["recommendations"],
        "current_annual_savings": doctor["current_annual_savings"],
        "optimized_annual_savings": doctor["optimized_annual_savings"],
        "potential_extra_savings": doctor["potential_extra_savings"],
        "monthly_savings": doctor["monthly_savings"],
        "monthly_income": doctor["monthly_income"],
    }



# ─────────────────────────────────────────────
# /detect-subscriptions
# ─────────────────────────────────────────────

@app.post("/detect-subscriptions")
def detect_subscriptions(payload: TransactionsPayload):
    """
    Detect recurring subscriptions using keyword matching + pandas.
    """
    df = pd.DataFrame([t.model_dump() for t in payload.transactions])
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)

    mask = df["description"].str.contains(SUBSCRIPTION_KEYWORDS, na=False)
    sub_df = df[mask & (df["amount"] > 0)].copy()

    subscriptions = []
    for _, row in sub_df.iterrows():
        amt = float(row["amount"])
        # Heuristic: if amount > 1000 treat as annual charge
        if amt > 1000:
            monthly = round(amt / 12, 2)
            annual = round(amt, 2)
        else:
            monthly = round(amt, 2)
            annual = round(amt * 12, 2)

        savings = round(annual * 0.55, 2)   # 55% savings if cancelled
        
        name = str(row["description"]).strip()
        action_plan = f"Cancel {name} if unused, share the account, or downgrade to a basic tier to easily recover ₹{int(savings)}/year."
        
        subscriptions.append({
            "name": name,
            "monthly_cost": monthly,
            "annual_cost": annual,
            "potential_savings": savings,
            "category": "Entertainment",
            "action_plan": action_plan,
        })

    return {"subscriptions": subscriptions}


# ─────────────────────────────────────────────────────────────
# Financial Twin Algorithm (8-Step Process)
# ─────────────────────────────────────────────────────────────

def financial_twin_algo(
    monthly_income: float,
    monthly_expenses: float,
    current_savings: float,
) -> dict:
    if monthly_income <= 0:
        monthly_income = 1  # avoid division by zero

    # Step 1: Calculate Monthly Savings
    monthly_savings = monthly_income - monthly_expenses
    
    # Step 2: Current Trajectory (12 months)
    current_year_end = current_savings + (monthly_savings * 12)

    # Step 3: Improved Trajectory (15% reduction in expenses)
    improved_expenses = monthly_expenses * 0.85
    improved_monthly_savings = monthly_income - improved_expenses
    improved_year_end = current_savings + (improved_monthly_savings * 12)

    # Step 4: Best Case Trajectory (25% reduction + 10% discipline bonus)
    best_expenses = monthly_expenses * 0.75
    base_best_monthly_savings = monthly_income - best_expenses
    best_monthly_savings = base_best_monthly_savings * 1.10
    best_year_end = current_savings + (best_monthly_savings * 12)

    # Step 5: Potential Gain
    potential_gain = best_year_end - current_year_end

    # Step 6: MoneyMirror Score
    # Savings Rate (40 points max)
    savings_rate = max(0.0, monthly_savings / monthly_income)
    savings_score = min(40.0, (savings_rate / 0.30) * 40.0) if savings_rate > 0 else 0.0

    # Expense Ratio (30 points max)
    expense_ratio = monthly_expenses / monthly_income
    if expense_ratio <= 0.50:
        expense_score = 30.0
    elif expense_ratio >= 0.90:
        expense_score = 0.0
    else:
        # linear interpolation between 0.50 and 0.90
        expense_score = 30.0 * (1.0 - ((expense_ratio - 0.50) / 0.40))

    # Emergency Fund (30 points max)
    target_ef = monthly_expenses * 3
    if target_ef > 0:
        ef_score = min(30.0, (current_savings / target_ef) * 30.0)
    else:
        ef_score = 30.0

    mm_score = int(savings_score + expense_score + ef_score)

    # Step 7: Generate Graph Data (12 months)
    current_path = []
    improved_path = []
    best_case_path = []

    for month in range(1, 13):
        current_path.append({
            "year": month, # 'year' key kept for frontend backward compatibility
            "net_worth": round(current_savings + monthly_savings * month, 2)
        })
        improved_path.append({
            "year": month,
            "net_worth": round(current_savings + improved_monthly_savings * month, 2)
        })
        best_case_path.append({
            "year": month,
            "net_worth": round(current_savings + best_monthly_savings * month, 2)
        })

    # Persona based on best_year_end
    if best_year_end >= 1_000_000:
        persona = "Wealth Builder"
    elif best_year_end >= 500_000:
        persona = "Financially Stable"
    else:
        persona = "Financially Vulnerable"

    return {
        "monthly_savings": monthly_savings,
        "improved_monthly_savings": improved_monthly_savings,
        "best_monthly_savings": best_monthly_savings,
        "current_year_end": current_year_end,
        "improved_year_end": improved_year_end,
        "best_year_end": best_year_end,
        "potential_gain": potential_gain,
        "financial_twin_score": mm_score,
        "savings_rate": savings_rate,
        "expense_ratio": expense_ratio,
        "persona": persona,
        "current_path": current_path,
        "improved_path": improved_path,
        "best_case_path": best_case_path,
    }


# ─────────────────────────────────────────────
# /financial-twin
# ─────────────────────────────────────────────

@app.post("/financial-twin")
def generate_financial_twin(payload: FinancialTwinPayload):
    """
    Implements the 8-Step Financial Twin simulation.
    """
    income   = max(0.0, payload.monthly_income)
    expenses = max(0.0, payload.monthly_expenses)
    savings  = max(0.0, payload.current_savings)

    result = financial_twin_algo(
        monthly_income=income,
        monthly_expenses=expenses,
        current_savings=savings,
    )

    # ── AI Generated Recommendations ──
    twin_recommendations = [
        "Reduce overall expenses by 15% to hit the Improved Trajectory.",
        "Cut subscriptions and dining out by 25% to hit the Best Case Trajectory.",
        "Maintain financial discipline to earn a 10% bonus on your savings rate.",
        "Use the AI interventions to identify exact leaks."
    ]

    prompt = f"""You are a financial advisor AI. Analyze the user's monthly budget:
- Income: ₹{income}
- Expenses: ₹{expenses}
- Current Savings: ₹{savings}
- Food/Dining: ₹{payload.food_expense}
- Shopping: ₹{payload.shopping_expense}
- Subscriptions: ₹{payload.subscription_expense}

Provide exactly 4 concise, highly actionable spending optimization recommendations to help them improve their financial trajectory.
Be specific to their amounts.
Respond ONLY with a valid JSON array of exactly 4 strings. No markdown formatting, just the raw JSON array. Example: ["Rec 1", "Rec 2", "Rec 3", "Rec 4"]"""

    groq_keys = [
        os.getenv("GROQ_API_KEY_1"),
        os.getenv("GROQ_API_KEY_2"),
        os.getenv("GROQ_API_KEY_3"),
        os.getenv("GROK_API_KEY_1")
    ]
    groq_keys = [k for k in groq_keys if k]
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    for key in groq_keys:
        try:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.4,
                },
                timeout=12
            )
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"].strip()
                if content.startswith("```"):
                    content = re.sub(r"^```(json)?|```$", "", content).strip()
                recs = json.loads(content)
                if isinstance(recs, list) and len(recs) >= 1:
                    twin_recommendations = [str(r) for r in recs[:4]]
                    break
        except Exception:
            continue

    return {
        "current_path": result["current_path"],
        "optimized_path": result["improved_path"],
        "best_case_path": result["best_case_path"],
        "projected_savings": result["best_year_end"],
        "potential_gain": result["potential_gain"],
        "current_monthly_savings": int(max(0, result["monthly_savings"])),
        "optimized_monthly_savings": int(max(0, result["improved_monthly_savings"])),
        "best_case_monthly_savings": int(max(0, result["best_monthly_savings"])),
        "financial_twin_score": result["financial_twin_score"],
        "persona": result["persona"],
        "monthly_improvement": max(0.0, result["improved_monthly_savings"] - result["monthly_savings"]),
        # Dummy values for frontend backward compatibility
        "current_milestones": { "1_year": result["current_year_end"], "3_year": result["current_year_end"] * 3, "5_year": result["current_year_end"] * 5 },
        "optimized_milestones": { "1_year": result["improved_year_end"], "3_year": result["improved_year_end"] * 3, "5_year": result["improved_year_end"] * 5 },
        "scenarios": {
            "worst_case": result["current_year_end"],
            "average_case": result["improved_year_end"],
            "best_case": result["best_year_end"]
        },
        "twin_recommendations": twin_recommendations,
        "rule_502030": None
    }


# ─────────────────────────────────────────────
# /interventions
# ─────────────────────────────────────────────

@app.post("/interventions")
def interventions(payload: InterventionsPayload):
    """
    Generate ranked, personalised financial interventions from transaction data.
    Uses pandas groupby + numpy priority scoring.
    """
    df = pd.DataFrame([t.model_dump() for t in payload.transactions])
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
    df = df[df["amount"] > 0]
    df["category"] = _categorize_series(df["description"])
    cats = df.groupby("category")["amount"].sum().to_dict()

    income = max(0.0, payload.monthly_income)
    expenses = max(0.0, payload.monthly_expenses)
    monthly_save = income - expenses

    # ── AI Generated Interventions ──
    prompt = f"""You are a financial planning AI. The user's monthly profile is:
- Income: ₹{income}
- Expenses: ₹{expenses}
- Savings generated this month: ₹{monthly_save}
- Exact Category breakdown: {json.dumps(cats)}

Based on these EXACT amounts, generate between 3 and 5 concrete, highly specific financial interventions.
Each intervention MUST follow this JSON schema:
{{
  "priority": "high" | "medium" | "low",
  "title": "Short title of the action",
  "action": "A specific sentence explaining exactly what to do and exactly how much they will save. Use the exact numbers provided.",
  "savings_impact": <integer representing annual financial gain in ₹, e.g. 15000>,
  "timeline": "e.g., 'This week', 'Next 30 days', 'Ongoing'",
  "category": "e.g., 'Subscriptions', 'Food', 'Investments', 'Safety Net'"
}}

Return ONLY a valid JSON array of these objects. No markdown formatting, no explanations, just the raw array."""

    groq_keys = [
        os.getenv("GROQ_API_KEY_1"),
        os.getenv("GROQ_API_KEY_2"),
        os.getenv("GROQ_API_KEY_3"),
        os.getenv("GROK_API_KEY_1")
    ]
    groq_keys = [k for k in groq_keys if k]
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    
    actions = []
    
    for key in groq_keys:
        try:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.4,
                },
                timeout=15
            )
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"].strip()
                if content.startswith("```"):
                    content = re.sub(r"^```(json)?|```$", "", content).strip()
                recs = json.loads(content)
                if isinstance(recs, list) and len(recs) > 0:
                    for r in recs:
                        if "priority" in r and "title" in r and "action" in r and "savings_impact" in r:
                            actions.append({
                                "priority": str(r.get("priority", "medium")).lower(),
                                "title": str(r.get("title", "")),
                                "action": str(r.get("action", "")),
                                "savings_impact": int(r.get("savings_impact", 0)),
                                "timeline": str(r.get("timeline", "Ongoing")),
                                "category": str(r.get("category", "General")),
                            })
                    if len(actions) > 0:
                        break
        except Exception:
            continue

    # Fallback if AI fails
    if not actions:
        sub_spend = float(cats.get("Subscriptions", 0))
        if sub_spend > 300:
            savings = round(sub_spend * 0.60 * 12)
            actions.append({
                "priority": "high", "title": "Cancel Redundant Subscriptions",
                "action": f"You're spending ₹{int(sub_spend):,}/mo. Audit and cancel at least 60% to save ₹{savings:,}/year.",
                "savings_impact": savings, "timeline": "This week", "category": "Subscriptions"
            })
            
        food_spend = float(cats.get("Food Delivery", 0))
        if food_spend > 800:
            savings = round(food_spend * 0.50 * 12)
            actions.append({
                "priority": "high", "title": "Reduce Food Delivery by 50%",
                "action": f"₹{int(food_spend):,}/mo detected. Meal-prep 3 days/week to save ₹{savings:,}/year.",
                "savings_impact": savings, "timeline": "This month", "category": "Food"
            })
            
        if monthly_save > 2000:
            sip = round(monthly_save * 0.40)
            proj = int(sip * 12 * ((1.09 ** 10 - 1) / 0.09) * 1.09)
            actions.append({
                "priority": "medium", "title": "Start a Monthly SIP in Index Funds",
                "action": f"Invest ₹{sip:,}/mo. Estimated value in 10 years: ₹{proj:,}.",
                "savings_impact": proj, "timeline": "Next 30 days", "category": "Investments"
            })
            
        emergency = round(expenses * 6)
        actions.append({
            "priority": "low", "title": "Build a 6-Month Emergency Fund",
            "action": f"Target is ₹{emergency:,} (6× monthly expenses). Park it in a liquid mutual fund or FD.",
            "savings_impact": 0, "timeline": "6–12 months", "category": "Safety Net"
        })

    # Sort by priority weight
    priority_order = {"high": 0, "medium": 1, "low": 2}
    actions.sort(key=lambda x: (priority_order.get(x["priority"], 3), -x["savings_impact"]))

    return {"interventions": actions}


# ─────────────────────────────────────────────
# /scam-shield
# ─────────────────────────────────────────────

@app.post("/scam-shield")
def scam_shield(payload: ScamShieldPayload):
    """
    Redesigned Scam Detection Engine
    Layer 1: Deterministic Multi-Factor Scoring
    Layer 2: Generative Fraud Intent Analysis
    Layer 3: Escalation Combiner
    """
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    m_lower = message.lower()

    # ── Configuration ──
    TRUSTED_DOMAINS = [
        "sbi.co.in", "icicibank.com", "hdfcbank.com", "axisbank.com",
        "gov.in", "uidai.gov.in",
        "amazon.in", "flipkart.com", "google.com", "paytm.com", "phonepe.com"
    ]
    SUSPICIOUS_DOMAINS = [".xyz", ".top", ".click", ".live", ".vip", "bit.ly", "tinyurl"]

    # ── Scores & Arrays ──
    trust_score = 0
    domain_risk = 0
    urgency_score = 0
    credential_risk = 0
    manipulation_score = 0

    trust_signals = []
    risk_reasons = []
    critical_flags = []

    # 1. DOMAIN ANALYSIS
    urls = re.findall(r'https?://[^\s]+', message)
    has_trusted_domain = False
    has_suspicious_domain = False
    has_unknown_domain = False

    for url in urls:
        domain_found = False
        for trusted in TRUSTED_DOMAINS:
            if trusted in url.lower():
                has_trusted_domain = True
                trust_signals.append(f"✓ Verified domain ({trusted})")
                trust_score += 15
                domain_found = True
                break
        for suspicious in SUSPICIOUS_DOMAINS:
            if suspicious in url.lower():
                has_suspicious_domain = True
                domain_risk += 40
                critical_flags.append("Suspicious Domain Detected")
                risk_reasons.append(f"Malicious or deceptive link ({suspicious})")
                domain_found = True
                break
        if not domain_found:
            has_unknown_domain = True
            domain_risk += 20
            risk_reasons.append("Unknown unverified link")

    # 2. CRITICAL FRAUD TRIGGERS (CREDENTIAL THEFT)
    has_otp = bool(re.search(r'\b(otp|one time password)\b', m_lower))
    has_pin = bool(re.search(r'\b(pin|upi pin|m-pin)\b', m_lower))
    has_card = bool(re.search(r'\b(cvv|card details|credit card number|debit card)\b', m_lower))
    has_password = bool(re.search(r'\b(password|login credentials|internet banking)\b', m_lower))

    has_credential_request = has_otp or has_pin or has_card or has_password

    if has_otp:
        credential_risk += 50
        critical_flags.append("OTP Request Detected")
        risk_reasons.append("Attempt to harvest OTP")
    if has_pin:
        credential_risk += 50
        critical_flags.append("UPI PIN Request Detected")
        risk_reasons.append("Attempt to harvest financial PIN")
    if has_card or has_password:
        credential_risk += 50
        critical_flags.append("Credential Theft Attempt")
        risk_reasons.append("Attempt to steal sensitive credentials")

    # 3. MANIPULATION (THREATS & REWARDS)
    has_threat = bool(re.search(r'\b(suspended|blocked|terminate|locked|permanently|freeze|frozen)\b', m_lower))
    has_reward = bool(re.search(r'\b(reward|lottery|winner|prize|cashback|claim|refund pending)\b', m_lower))

    if has_threat:
        manipulation_score += 30
        risk_reasons.append("Threatening or coercive language")
    if has_reward:
        manipulation_score += 30
        risk_reasons.append("Financial reward manipulation")

    # 4. URGENCY
    has_urgency = bool(re.search(r'\b(urgent|immediately|now|expire|expires|warning|within|minutes|today)\b', m_lower))
    if has_urgency:
        urgency_score += 25
        risk_reasons.append("Coercive Urgency")

    # 5. CONTEXTUAL MILD ACTION
    has_mild_action = bool(re.search(r'\b(kyc|verify|update|account|click|login)\b', m_lower))
    if has_mild_action and (has_urgency or has_suspicious_domain or has_threat):
        manipulation_score += 15
        risk_reasons.append("Suspicious action requested under pressure")

    # ── COMPOUND ESCALATION RULES ──
    # Combinations that override math and force a high risk assessment
    auto_dangerous = False

    if (has_otp or has_pin) and has_urgency:
        auto_dangerous = True
        critical_flags.append("Urgent Credential Request")

    if has_credential_request and (has_suspicious_domain or has_unknown_domain):
        auto_dangerous = True
        critical_flags.append("Credential Request with Unverified Link")

    if has_threat and has_mild_action and has_urgency:
        auto_dangerous = True
        critical_flags.append("Coercive Action Demand")

    if has_reward and (has_pin or has_otp or has_mild_action):
        auto_dangerous = True
        critical_flags.append("Reward Manipulation")

    # Base Rule Score Calculation
    rule_score = domain_risk + credential_risk + manipulation_score + urgency_score
    # Trust only slightly reduces rule score (max 15), but NEVER cancels critical risks
    rule_score -= trust_score
    rule_score = max(0, rule_score)

    if auto_dangerous:
        rule_score = max(rule_score, 95)
    
    if not has_credential_request and not has_threat and not has_reward:
        trust_signals.append("✓ No credential or payment requested")

    # ── Layer 2: LLM Analysis ──
    prompt = f"""You are a senior cybersecurity fraud analyst detecting phishing, social engineering, and financial scams.
Analyze this message:
"{message}"

CONTEXT & GUARDRAILS:
1. Legitimate banking notifications commonly contain links, KYC notices, account updates, transaction alerts, statements, or verification reminders. These alone are NOT evidence of fraud.
2. AGGRESSIVELY INCREASE RISK to HIGH/CRITICAL if you detect ANY of the following intents:
   - OTP harvesting or PIN harvesting
   - Credential theft (passwords, CVV)
   - Account takeover threats (e.g., "account will be blocked")
   - Financial reward manipulation (e.g., fake cashback, pending refunds)
   - Suspicious or unverified links combined with urgency
3. Prioritize strict fraud detection over politeness.

Return exactly this JSON format:
{{
  "fraud_score": <number 0-100>,
  "reasons": ["<reason1>", "<reason2>"],
  "intent": "<short description of the sender's intent>",
  "advice": "<actionable advice>"
}}"""

    ai_score = 0
    ai_reasons = []
    ai_advice = ""
    ai_intent = ""

    groq_keys = [
        os.getenv("GROQ_API_KEY_1"),
        os.getenv("GROQ_API_KEY_2"),
        os.getenv("GROQ_API_KEY_3"),
        os.getenv("GROK_API_KEY_1")
    ]
    groq_keys = [k for k in groq_keys if k]
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    success = False
    for key in groq_keys:
        try:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                },
                timeout=10
            )
            if res.status_code == 200:
                data = res.json()
                content = json.loads(data["choices"][0]["message"]["content"])
                ai_score = int(content.get("fraud_score", 0))
                ai_reasons = content.get("reasons", [])
                ai_advice = content.get("advice", "")
                ai_intent = content.get("intent", "")
                success = True
                break
        except Exception as e:
            continue

    if not success:
        ai_score = min(rule_score, 100)
        ai_advice = "Do NOT interact if the message asks for OTP, PIN, or clicks on unknown links."

    # ── Layer 3: Hybrid Combiner ──
    final_score = int((rule_score * 0.4) + (ai_score * 0.6))
    
    # Escalation Overrides
    if auto_dangerous or len(critical_flags) > 0:
        final_score = max(final_score, 85)

    # Prevent trust signals from dropping obvious fraud
    if has_credential_request and final_score < 80:
        final_score = 85

    final_score = min(max(final_score, 0), 100)

    # Cleanups
    trust_signals = list(dict.fromkeys(trust_signals))[:3]
    critical_flags = list(dict.fromkeys(critical_flags))
    
    combined_reasons = []
    for r in risk_reasons + ai_reasons:
        if r not in combined_reasons:
            combined_reasons.append(r)
            
    if ai_intent and ai_score >= 50:
        combined_reasons.insert(0, f"Detected Intent: {ai_intent}")

    if final_score >= 70:
        verdict = "dangerous"
        recommendation = ai_advice if success else "⚠️ HIGH RISK — Do NOT click any link or respond."
    elif final_score >= 40:
        verdict = "suspicious"
        recommendation = ai_advice if success else "Treat with caution. Verify the sender through official channels."
    else:
        verdict = "safe"
        recommendation = ai_advice if success else "This message appears safe, but always remain vigilant."
        if not combined_reasons:
             combined_reasons.append("No strong indicators of fraud found.")

    return {
        "risk_score": final_score,
        "verdict": verdict,
        "risk_reasons": combined_reasons[:6],
        "reasons": combined_reasons[:6],  # Backend-compat
        "trust_signals": trust_signals,
        "critical_flags": critical_flags,
        "recommendation": recommendation,
        "confidence": 95 if success else 60
    }


# ─────────────────────────────────────────────
# /parse-csv  — CSV parsing endpoint
# ─────────────────────────────────────────────

@app.post("/parse-csv")
async def parse_csv(file: UploadFile = File(...)):
    """
    Parse an uploaded CSV file and return structured transactions.
    Accepts formats: date,description,amount  OR  description,amount
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    contents = await file.read()
    try:
        text = contents.decode("utf-8-sig")   # strip BOM if present
    except UnicodeDecodeError:
        text = contents.decode("latin-1")

    try:
        df = pd.read_csv(io.StringIO(text), header=None)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {e}")

    if df.empty:
        raise HTTPException(status_code=422, detail="CSV file is empty")

    # Detect header row: if first cell of last column is non-numeric → header
    has_header = False
    try:
        float(str(df.iloc[0, -1]).replace(",", ""))
    except ValueError:
        has_header = True

    if has_header:
        df.columns = [str(c).strip().lower() for c in df.iloc[0]]
        df = df.iloc[1:].reset_index(drop=True)

    df = df.applymap(lambda x: str(x).strip().replace('"', '') if pd.notna(x) else "")

    transactions: list[dict] = []

    if df.shape[1] >= 3:
        # date, description, amount
        for _, row in df.iterrows():
            try:
                amt = float(str(row.iloc[2]).replace(",", ""))
            except ValueError:
                continue
            desc = str(row.iloc[1])
            date = str(row.iloc[0]) if row.iloc[0] else None
            if desc and amt > 0:
                transactions.append({"description": desc, "amount": round(amt, 2), "date": date})
    elif df.shape[1] == 2:
        # description, amount
        for _, row in df.iterrows():
            try:
                amt = float(str(row.iloc[1]).replace(",", ""))
            except ValueError:
                continue
            desc = str(row.iloc[0])
            if desc and amt > 0:
                transactions.append({"description": desc, "amount": round(amt, 2)})
    else:
        raise HTTPException(status_code=422, detail="CSV must have at least 2 columns: description, amount")

    if not transactions:
        raise HTTPException(status_code=422, detail="No valid transactions found in CSV")

    return {
        "success": True,
        "transactions": transactions,
        "count": len(transactions),
    }


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "MoneyMirror computation engine running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)