"""Public Tamil Nadu knowledge base — debt categories, legal rights, helplines, districts"""
from fastapi import APIRouter, HTTPException

from tn_context import knowledge

router = APIRouter(prefix="/knowledge")


@router.get("/categories")
async def categories():
    return {"categories": knowledge.categories()}


@router.get("/categories/{category_id}")
async def category(category_id: str):
    cat = knowledge.category_map().get(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return {**cat, "schemes": knowledge.schemes_for(category_id), "laws": knowledge.laws_for(category_id),
            "helplines": knowledge.helplines_for([category_id], 4)}


@router.get("/laws")
async def laws():
    return {"laws": knowledge.laws()}


@router.get("/helplines")
async def helplines():
    return {"helplines": knowledge.helplines()}


@router.get("/districts")
async def districts():
    return {"districts": knowledge.TN_DISTRICTS}
