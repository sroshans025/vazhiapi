"""POST /budget-plan — AI-generated monthly budget"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from core.dependencies import get_current_user

router = APIRouter()


class BudgetRequest(BaseModel):
    monthly_income: float
    debt_emi: float
    debt_category: str
    num_dependents: int = 2


@router.post("/budget-plan")
async def budget_plan(payload: BudgetRequest, current_user=Depends(get_current_user)):
    """
    Generate a simple AI-assisted monthly budget plan based on income,
    existing EMI burden, and debt category.
    """
    income = payload.monthly_income
    emi = payload.debt_emi
    emi_pct = (emi / income * 100) if income > 0 else 0

    # 50-30-20 rule adapted for TN households with debt
    needs_pct = 50
    savings_pct = 20
    discretionary_pct = 30

    # If EMI > 40% income, recommend restructuring
    status = "manageable"
    recommendation = ""
    if emi_pct > 40:
        status = "distressed"
        recommendation = (
            "Your EMI is consuming over 40% of income — this is a debt trap zone. "
            "Immediately contact DLSA for free legal consultation and explore SHG refinancing."
        )
    elif emi_pct > 25:
        status = "at_risk"
        recommendation = "EMI burden is high. Consider SHG refinancing to reduce interest cost."
    else:
        recommendation = "Your debt ratio is manageable. Focus on building a ₹10,000 emergency fund."

    return {
        "monthly_income": income,
        "debt_emi": emi,
        "emi_to_income_ratio": round(emi_pct, 1),
        "status": status,
        "recommendation": recommendation,
        "budget_allocation": {
            "needs_essentials": round(income * needs_pct / 100, 0),
            "debt_repayment": emi,
            "savings_target": round(max(income * savings_pct / 100 - emi, 0), 0),
            "discretionary": round(income - (income * needs_pct / 100) - emi, 0),
        },
        "monthly_savings_target": round(income * 0.1, 0),
        "emergency_fund_target": round(income * 3, 0),
        "debt_category": payload.debt_category,
    }
