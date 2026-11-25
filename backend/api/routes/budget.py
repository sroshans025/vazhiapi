"""POST /budget-plan — needs-first monthly budget for a household with debt"""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from tn_context import knowledge

router = APIRouter()


class BudgetRequest(BaseModel):
    monthly_income: float = Field(gt=0, le=1e8)
    debt_emi: float = Field(ge=0, le=1e8)
    debt_category: str = "general_financial_stress"
    num_dependents: int = Field(default=2, ge=0, le=20)
    rent: float | None = Field(default=None, ge=0)


@router.post("/budget-plan")
async def budget_plan(payload: BudgetRequest):
    """
    Needs-first budget. v1 could output a negative 'discretionary' amount and a savings target
    that ignored EMIs; this version allocates sequentially so the parts always add up to income.
    """
    income, emi = payload.monthly_income, payload.debt_emi
    emi_pct = emi / income * 100

    # Essentials scale gently with household size (base 45% + 2.5% per dependent, capped at 65%)
    essentials_pct = min(45 + 2.5 * payload.num_dependents, 65)
    essentials = max(income * essentials_pct / 100, payload.rent or 0)
    after_needs = income - essentials
    debt_paid = min(emi, max(after_needs, 0))
    shortfall = max(emi - debt_paid, 0) + max(essentials - income, 0)
    left = max(after_needs - debt_paid, 0)
    savings = round(left * 0.5)
    discretionary = round(left - savings)

    if emi_pct > 50:
        status, rec = "critical", ("Your loan repayments take more than half your income — a debt trap. Ask every lender in writing for a "
                                   "longer tenure or moratorium, get free legal help (DLSA 15100), and don't borrow again to repay.")
    elif emi_pct > 40:
        status, rec = "distressed", ("EMIs above 40% of income leave no buffer. Move the highest-interest loan to SHG/MUDRA credit "
                                     "and request restructuring before you miss a payment.")
    elif emi_pct > 25:
        status, rec = "at_risk", "EMI burden is high. Clear the highest-interest debt first and build a small emergency fund."
    else:
        status, rec = "manageable", "Your debt ratio is manageable. Build an emergency fund of 3 months' expenses."

    return {
        "monthly_income": income,
        "debt_emi": emi,
        "emi_to_income_ratio": round(emi_pct, 1),
        "status": status,
        "recommendation": rec,
        "shortfall": round(shortfall),
        "budget_allocation": {
            "needs_essentials": round(essentials),
            "debt_repayment": round(debt_paid),
            "savings_target": savings,
            "discretionary": discretionary,
        },
        "monthly_savings_target": savings,
        "emergency_fund_target": round(essentials * 3),
        "debt_category": payload.debt_category,
        "suggested_schemes": [s["name"] for s in knowledge.schemes_for(payload.debt_category, limit=3)],
    }
