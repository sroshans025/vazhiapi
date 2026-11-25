"""Financial calculators (public) — true interest rate, EMI, and multi-debt payoff plans"""
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/tools")

PERIODS = {"day": 365, "week": 52, "month": 12, "year": 1}
BENCHMARKS = [
    {"name": "Kisan Credit Card (prompt repayment)", "apr": 4},
    {"name": "SHG bank linkage", "apr": 10},
    {"name": "MUDRA / bank personal loan", "apr": 12},
    {"name": "Gold loan (bank)", "apr": 9},
    {"name": "Credit card (revolving)", "apr": 42},
]


class InterestRequest(BaseModel):
    rate: float = Field(gt=0, le=1000, description="Interest rate in percent per period")
    period: Literal["day", "week", "month", "year"] = "month"
    principal: float | None = Field(default=None, gt=0, le=1e9)
    months: int | None = Field(default=None, ge=1, le=600)


@router.post("/interest")
async def true_interest(p: InterestRequest):
    """Convert a moneylender-style rate (e.g. 10% per week) into a yearly rate and total cost."""
    n = PERIODS[p.period]
    simple_apr = p.rate * n
    effective_apr = ((1 + p.rate / 100) ** n - 1) * 100
    out = {
        "rate": p.rate, "period": p.period,
        "simple_annual_rate": round(simple_apr, 1),
        "effective_annual_rate": round(min(effective_apr, 1e9), 1),
        "likely_illegal_private_lending": simple_apr > 36,
        "benchmarks": BENCHMARKS,
    }
    if p.principal and p.months:
        periods = p.months * n / 12
        simple_interest = p.principal * p.rate / 100 * periods
        compound_total = p.principal * (1 + p.rate / 100) ** periods
        out |= {
            "principal": p.principal, "months": p.months,
            "simple_interest": round(simple_interest),
            "total_payable_simple": round(p.principal + simple_interest),
            "total_payable_compound": round(min(compound_total, 1e12)),
            "shg_comparison_total": round(p.principal * (1 + 0.10 * p.months / 12)),
        }
    return out


class EMIRequest(BaseModel):
    principal: float = Field(gt=0, le=1e9)
    annual_rate: float = Field(ge=0, le=500)
    months: int = Field(ge=1, le=600)


def _emi(principal: float, annual_rate: float, months: int) -> float:
    r = annual_rate / 12 / 100
    if r == 0:
        return principal / months
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)


@router.post("/emi")
async def emi(p: EMIRequest):
    e = _emi(p.principal, p.annual_rate, p.months)
    balance, schedule = p.principal, []
    r = p.annual_rate / 12 / 100
    for m in range(1, p.months + 1):
        interest = balance * r
        principal_part = e - interest
        balance = max(balance - principal_part, 0)
        if m <= 12 or m == p.months or m % 12 == 0:
            schedule.append({"month": m, "interest": round(interest), "principal": round(principal_part),
                             "balance": round(balance)})
    return {"emi": round(e), "total_payable": round(e * p.months),
            "total_interest": round(e * p.months - p.principal), "schedule": schedule}


class Debt(BaseModel):
    name: str = Field(max_length=60)
    balance: float = Field(gt=0, le=1e9)
    annual_rate: float = Field(ge=0, le=5000)
    min_payment: float = Field(ge=0, le=1e8)


class PayoffRequest(BaseModel):
    debts: list[Debt] = Field(min_length=1, max_length=15)
    monthly_budget: float = Field(gt=0, le=1e8)
    strategy: Literal["avalanche", "snowball"] = "avalanche"


def _simulate(debts: list[dict], budget: float, strategy: str) -> dict:
    debts = [dict(d) for d in debts]
    order_key = (lambda d: -d["annual_rate"]) if strategy == "avalanche" else (lambda d: d["balance"])
    month, total_interest, payoff_order = 0, 0.0, []
    while any(d["balance"] > 0.5 for d in debts) and month < 600:
        month += 1
        for d in debts:
            if d["balance"] > 0:
                i = d["balance"] * d["annual_rate"] / 1200
                d["balance"] += i
                total_interest += i
        remaining = budget
        for d in debts:                                     # minimums first
            pay = min(d["min_payment"], d["balance"], remaining)
            d["balance"] -= pay
            remaining -= pay
        for d in sorted([d for d in debts if d["balance"] > 0.5], key=order_key):  # extra to target
            pay = min(d["balance"], remaining)
            d["balance"] -= pay
            remaining -= pay
            if remaining <= 0:
                break
        for d in debts:
            if d["balance"] <= 0.5 and d["name"] not in payoff_order:
                payoff_order.append(d["name"])
                d["balance"] = 0
    return {"months": month, "total_interest": round(total_interest), "payoff_order": payoff_order,
            "debt_free": month < 600}


@router.post("/payoff")
async def payoff(p: PayoffRequest):
    debts = [d.model_dump() for d in p.debts]
    min_total = sum(d["min_payment"] for d in debts)
    if p.monthly_budget < min_total:
        raise HTTPException(status_code=422, detail=f"Monthly budget must cover the minimum payments (₹{min_total:,.0f})")
    chosen = _simulate(debts, p.monthly_budget, p.strategy)
    other = _simulate(debts, p.monthly_budget, "snowball" if p.strategy == "avalanche" else "avalanche")
    return {"strategy": p.strategy, **chosen,
            "comparison": {"strategy": "snowball" if p.strategy == "avalanche" else "avalanche", **other}}
