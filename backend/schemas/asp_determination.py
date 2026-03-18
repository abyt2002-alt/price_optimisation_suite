from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


ObjectiveType = Literal["revenue", "profit", "volume"]


class AspOptimizationRequest(BaseModel):
    selected_month: Optional[str] = Field(
        default=None,
        description="Portfolio time key, e.g. 2024-W31",
    )
    selected_scenario: Optional[str] = None
    selected_portfolio_slice: Optional[str] = None
    selected_channel: Optional[str] = None

    optimization_objective: ObjectiveType = "revenue"
    max_price_change_pct: float = Field(default=12.0, ge=0.1, le=60.0)
    minimum_price_gap: float = Field(default=0.0, ge=0.0, le=200.0)
    minimum_volume_retention_pct: float = Field(default=75.0, ge=1.0, le=100.0)
    minimum_volume_retention_pct_by_product: Optional[dict[str, float]] = None

    enforce_revenue_floor: bool = False
    enforce_profit_floor: bool = False
    revenue_floor_value: Optional[float] = Field(default=None, ge=0.0)
    profit_floor_value: Optional[float] = Field(default=None, ge=0.0)
    minimum_revenue_drop_pct_from_current: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    minimum_profit_drop_pct_from_current: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    allowed_profit_decrease_pct: float = Field(default=0.0, ge=0.0, le=100.0)


class ProductOptimizationResult(BaseModel):
    product_id: str
    product_name: str
    base_price: float
    current_price: float
    optimized_price: float
    price_change: float
    price_change_pct: float
    base_price_change: float
    base_price_change_pct: float
    current_volume: float
    new_volume: float
    volume_change_pct: float
    current_revenue: float
    new_revenue: float
    revenue_change_pct: float
    current_profit: float
    new_profit: float
    profit_change_pct: float


class PortfolioTotals(BaseModel):
    total_volume: float
    total_revenue: float
    total_profit: float


class SummaryMetrics(BaseModel):
    revenue_uplift_pct: float
    profit_uplift_pct: float
    volume_uplift_pct: float
    changed_count: int
    increased_count: int
    decreased_count: int


class OptimizationModelContext(BaseModel):
    own_elasticities: list[float]
    beta_ppu: list[float]
    cross_matrix: list[list[float]]


class AspOptimizationResponse(BaseModel):
    controls: AspOptimizationRequest
    selected_month: str
    current_totals: PortfolioTotals
    optimized_totals: PortfolioTotals
    product_results: list[ProductOptimizationResult]
    summary: SummaryMetrics
    model_context: OptimizationModelContext
