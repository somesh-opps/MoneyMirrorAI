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
from datetime import datetime
from typing import Optional

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
    monthly_savings: float = 0.0
    current_emergency_fund: float = 0.0


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
    total_expenses = sum(item["amount"] for item in expenses)

    savings_rate = (monthly_savings / monthly_income * 100) if monthly_income > 0 else 0
    expense_ratio = (total_expenses / monthly_income * 100) if monthly_income > 0 else 0

    # Savings Score
    if savings_rate >= 30:
        savings_points = 30
    elif savings_rate >= 20:
        savings_points = 25
    elif savings_rate >= 10:
        savings_points = 15
    elif savings_rate >= 5:
        savings_points = 10
    else:
        savings_points = 0

    # Expense Score
    if expense_ratio < 50:
        expense_points = 30
    elif expense_ratio < 70:
        expense_points = 20
    elif expense_ratio < 90:
        expense_points = 10
    else:
        expense_points = 0

    # Emergency Fund Score
    months_covered = (current_emergency_fund / total_expenses) if total_expenses > 0 else 0
    if months_covered >= 6:
        emergency_points = 40
    elif months_covered >= 3:
        emergency_points = 25
    elif months_covered >= 1:
        emergency_points = 10
    else:
        emergency_points = 0

    financial_score = min(savings_points + expense_points + emergency_points, 100)

    if financial_score >= 80:
        status = "Excellent"
    elif financial_score >= 60:
        status = "Good"
    elif financial_score >= 40:
        status = "Average"
    else:
        status = "Risky"

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

    if monthly_income > 0 and food > monthly_income * 0.30:
        insights.append("Food spending exceeds 30% of income.")
        recommendations.append("Reduce food expenses by 10-15%.")

    if monthly_income > 0 and shopping > monthly_income * 0.20:
        insights.append("Shopping expenses are unusually high.")
        recommendations.append("Reduce discretionary shopping.")

    if monthly_income > 0 and subscriptions > monthly_income * 0.05:
        insights.append("Subscription spending is high.")
        recommendations.append("Review unused subscriptions.")

    if savings_rate < 20:
        recommendations.append("Increase monthly savings by at least ₹1,000.")

    current_annual_savings = monthly_savings * 12
    optimized_annual_savings = (monthly_savings + 1000) * 12

    return {
        "financial_score": financial_score,
        "status": status,
        "monthly_income": monthly_income,
        "monthly_expenses": total_expenses,
        "monthly_savings": monthly_savings,
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

    # Use provided monthly_income/savings if given; else derive from transactions
    monthly_income = payload.monthly_income
    monthly_savings = payload.monthly_savings
    current_emergency_fund = payload.current_emergency_fund

    # Run the financial doctor
    doctor = financial_doctor(
        monthly_income=monthly_income,
        monthly_savings=monthly_savings,
        current_emergency_fund=current_emergency_fund,
        expenses=expenses_for_doctor,
    )

    return {
        # ── Backward-compat shape (used by existing frontend components) ──
        "summary": {
            "score": doctor["financial_score"],
            "total_spent": round(total_spent, 2),
            "total_income": float(df[df["category"] == "Income"]["amount"].sum()),
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
        subscriptions.append({
            "name": str(row["description"]),
            "monthly_cost": monthly,
            "annual_cost": annual,
            "potential_savings": savings,
            "category": "Entertainment",
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
        "twin_recommendations": [
            "Reduce overall expenses by 15% to hit the Improved Trajectory.",
            "Cut subscriptions and dining out by 25% to hit the Best Case Trajectory.",
            "Maintain financial discipline to earn a 10% bonus on your savings rate.",
            "Use the AI interventions to identify exact leaks."
        ],
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

    actions: list[dict] = []

    # 1. Subscription overload
    sub_spend = float(cats.get("Subscriptions", 0))
    if sub_spend > 300:
        cancel_pct = 0.60
        savings = round(sub_spend * cancel_pct * 12)
        actions.append({
            "priority": "high",
            "title": "Cancel Redundant Subscriptions",
            "action": f"You're spending ₹{int(sub_spend):,}/mo on subscriptions. Audit and cancel at least 60% to save ₹{savings:,}/year.",
            "savings_impact": savings,
            "timeline": "This week",
            "category": "Subscriptions",
        })

    # 2. Food delivery reduction
    food_spend = float(cats.get("Food Delivery", 0))
    if food_spend > 800:
        savings = round(food_spend * 0.50 * 12)
        actions.append({
            "priority": "high",
            "title": "Reduce Food Delivery by 50%",
            "action": f"₹{int(food_spend):,}/mo on food delivery detected. Meal-prep 3 days/week — saves ₹{savings:,}/year.",
            "savings_impact": savings,
            "timeline": "This month",
            "category": "Food",
        })

    # 3. Shopping impulse control
    shop_spend = float(cats.get("Shopping", 0))
    if shop_spend > 1500:
        savings = round(shop_spend * 0.40 * 12)
        actions.append({
            "priority": "medium",
            "title": "Apply the 48-Hour Rule for Shopping",
            "action": f"₹{int(shop_spend):,}/mo in shopping. Wait 48h before any non-essential purchase — target saving ₹{savings:,}/year.",
            "savings_impact": savings,
            "timeline": "Ongoing",
            "category": "Shopping",
        })

    # 4. SIP investment
    if monthly_save > 2000:
        sip_amount = round(monthly_save * 0.40)
        projected_10y = int(sip_amount * 12 * ((1.09 ** 10 - 1) / 0.09) * 1.09)
        actions.append({
            "priority": "medium",
            "title": "Start a Monthly SIP in Index Funds",
            "action": f"Invest ₹{sip_amount:,}/mo in a Nifty 50 index fund. Estimated value in 10 years: ₹{projected_10y:,}.",
            "savings_impact": projected_10y,
            "timeline": "Next 30 days",
            "category": "Investments",
        })

    # 5. Transport optimisation
    transport_spend = float(cats.get("Transport", 0))
    if transport_spend > 2000:
        savings = round(transport_spend * 0.30 * 12)
        actions.append({
            "priority": "low",
            "title": "Optimise Daily Commute",
            "action": f"₹{int(transport_spend):,}/mo on transport. Switch 2 days/week to public transit or carpooling — saves ₹{savings:,}/year.",
            "savings_impact": savings,
            "timeline": "Next 2 weeks",
            "category": "Transport",
        })

    # 6. Emergency fund — always recommended
    emergency_target = round(expenses * 6)
    actions.append({
        "priority": "low",
        "title": "Build a 6-Month Emergency Fund",
        "action": f"Your emergency fund target is ₹{emergency_target:,} (6× monthly expenses). Park it in a liquid mutual fund or FD.",
        "savings_impact": 0,
        "timeline": "6–12 months",
        "category": "Safety Net",
    })

    # Sort by priority weight
    priority_order = {"high": 0, "medium": 1, "low": 2}
    actions.sort(key=lambda x: (priority_order.get(x["priority"], 3), -x["savings_impact"]))

    return {"interventions": actions}


# ─────────────────────────────────────────────
# /scam-shield
# ─────────────────────────────────────────────

SCAM_SIGNALS: list[tuple[str, int, str]] = [
    (r"kyc|aadhaar|pan card|voter id", 25, "Mentions KYC / Aadhaar / PAN — a top phishing lure."),
    (r"click|link|http|bit\.ly|tinyurl|t\.me|short\.url", 25, "Contains a suspicious link or call-to-click."),
    (r"urgent|immediately|today|expires|expire|24 hours?|2 hours?|last chance|deadline", 20, "Uses urgency or fear to force quick action."),
    (r"\botp\b|password|cvv|pin|secret|credentials", 25, "Asks for OTP, password, CVV, or PIN — never share these."),
    (r"lottery|prize|won|winner|congratulations|cashback|free money|reward|gift card|voucher", 20, "Promises a prize, reward, or unexpected money."),
    (r"bank|account|suspend|block|frozen|deactivate|rbi|sebi|income tax", 18, "Impersonates a bank/authority or threatens account action."),
    (r"whatsapp|telegram|investment|crypto|trading|forex|binary|returns guaranteed", 18, "Mentions chat-app investment / crypto — common scam vectors."),
    (r"job offer|work from home|part time|earn \d+k|per day earning", 15, "Fake job or work-from-home earnings trap."),
    (r"dear customer|dear user|dear member|valued customer", 10, "Generic salutation — often used in bulk scam messages."),
    (r"verify now|confirm now|update now|validate|authenticate", 12, "Urges immediate verification / account update."),
]


@app.post("/scam-shield")
def scam_shield(payload: ScamShieldPayload):
    """
    Rule-based scam analysis using numpy-weighted scoring.
    """
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    m_lower = message.lower()
    triggered: list[tuple[int, str]] = []

    for pattern, weight, reason in SCAM_SIGNALS:
        if re.search(pattern, m_lower):
            triggered.append((weight, reason))

    # Numpy weighted sum
    weights = np.array([w for w, _ in triggered], dtype=float) if triggered else np.array([0.0])
    base_score = float(np.sum(weights))

    # Baseline for non-empty messages
    base_score += 8 if len(message) > 20 else 3

    # Normalise to 0-98
    risk_score = int(np.clip(np.round(base_score), 0, 98))

    reasons = [r for _, r in triggered]

    if risk_score >= 70:
        verdict = "dangerous"
        recommendation = (
            "⚠️ HIGH RISK — Do NOT click any link or respond. "
            "Delete the message immediately and report it to the National Cyber Crime Portal "
            "(cybercrime.gov.in) or call 1930."
        )
    elif risk_score >= 40:
        verdict = "suspicious"
        recommendation = (
            "Treat with caution. Verify the sender through official channels "
            "(call the bank or organisation's published helpline) before taking any action."
        )
    else:
        verdict = "safe"
        recommendation = (
            "Message appears low-risk, but always confirm requests for money or "
            "credentials directly with the source — never via a link in the message."
        )

    return {
        "risk_score": risk_score,
        "reasons": reasons,
        "recommendation": recommendation,
        "verdict": verdict,
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