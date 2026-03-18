from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.schemas.asp_determination import AspOptimizationRequest, AspOptimizationResponse
from backend.services.asp_optimization_service import optimize_asp_portfolio


router = APIRouter(prefix="/api/asp-determination", tags=["ASP Determination"])


@router.post("/optimize", response_model=AspOptimizationResponse)
def optimize_asp_ladder(payload: AspOptimizationRequest) -> AspOptimizationResponse:
    try:
        return optimize_asp_portfolio(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Unhandled optimization error: {exc}") from exc

