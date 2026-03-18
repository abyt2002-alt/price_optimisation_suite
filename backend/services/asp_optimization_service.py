from __future__ import annotations

from typing import Any

from pyomo.environ import (
    Constraint,
    ConcreteModel,
    NonNegativeReals,
    Objective,
    RangeSet,
    SolverFactory,
    Var,
    maximize,
    value,
)
from pyomo.opt import SolverStatus, TerminationCondition

from backend.schemas.asp_determination import (
    AspOptimizationRequest,
    AspOptimizationResponse,
    OptimizationModelContext,
    PortfolioTotals,
    ProductOptimizationResult,
    SummaryMetrics,
)
from backend.utils.asp_result_formatter import (
    build_product_results,
    build_summary,
    build_totals,
    build_unit_costs,
)
from backend.utils.data_loader import load_portfolio_rows, select_month_rows
from backend.utils.elasticity_utils import (
    build_beta_and_gamma,
    build_cross_elasticity_matrix,
    build_own_elasticities,
    convert_to_base_reference,
)


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed


def _sorted_rows_for_optimization(month_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        month_rows,
        key=lambda row: (_safe_float(row.get("currentPrice"), 0.0), str(row.get("productName", ""))),
    )


def _build_price_bounds(reference_prices: list[float], max_change_pct: float) -> tuple[list[float], list[float]]:
    ratio = max_change_pct / 100.0
    lower = [max(1.0, price * (1.0 - ratio)) for price in reference_prices]
    upper = [max(low + 0.5, price * (1.0 + ratio)) for low, price in zip(lower, reference_prices)]
    return lower, upper


def optimize_asp_portfolio(request: AspOptimizationRequest) -> AspOptimizationResponse:
    all_rows = load_portfolio_rows()
    selected_month, month_rows = select_month_rows(all_rows, request.selected_month)
    sorted_rows = _sorted_rows_for_optimization(month_rows)
    if len(sorted_rows) < 2:
        raise ValueError("At least 2 products are required for ladder optimization.")

    own_elasticities_current = build_own_elasticities(sorted_rows)
    cross_matrix_current = build_cross_elasticity_matrix(sorted_rows)

    current_prices = [_safe_float(row.get("currentPrice"), 0.0) for row in sorted_rows]
    base_prices = [_safe_float(row.get("basePrice"), row.get("currentPrice", 0.0)) for row in sorted_rows]
    current_volumes = [max(1.0, _safe_float(row.get("volume"), 1.0)) for row in sorted_rows]

    own_elasticities, cross_matrix, base_volumes = convert_to_base_reference(
        sorted_rows,
        own_elasticities_current=own_elasticities_current,
        cross_elasticity_matrix_current=cross_matrix_current,
    )
    beta_ppu, gamma_matrix = build_beta_and_gamma(
        sorted_rows,
        own_elasticities=own_elasticities,
        cross_elasticity_matrix=cross_matrix,
        reference_prices=base_prices,
        reference_volumes=base_volumes,
    )
    unit_costs = build_unit_costs(sorted_rows)
    lower_bounds, upper_bounds = _build_price_bounds(base_prices, request.max_price_change_pct)

    current_product_results = build_product_results(sorted_rows, current_prices, current_volumes, unit_costs)
    current_totals = build_totals(current_product_results, current=True)

    model = ConcreteModel()
    n = len(sorted_rows)
    model.I = RangeSet(0, n - 1)

    model.p = Var(model.I, domain=NonNegativeReals)
    model.q = Var(model.I, domain=NonNegativeReals)

    for i in range(n):
        model.p[i].setlb(lower_bounds[i])
        model.p[i].setub(upper_bounds[i])

    def volume_response_rule(m, i):
        own_term = beta_ppu[i] * (m.p[i] - base_prices[i])
        cross_term = sum(
            gamma_matrix[i][j] * (m.p[j] - base_prices[j])
            for j in range(n)
            if j != i
        )
        return m.q[i] == base_volumes[i] + own_term + cross_term

    model.volume_response = Constraint(model.I, rule=volume_response_rule)

    retention_by_product = request.minimum_volume_retention_pct_by_product or {}
    min_retention_ratios = []
    for row in sorted_rows:
        product_name = str(row.get("productName"))
        per_product = retention_by_product.get(product_name, request.minimum_volume_retention_pct)
        ratio = max(0.01, min(1.0, float(per_product) / 100.0))
        min_retention_ratios.append(ratio)

    model.volume_retention = Constraint(
        model.I,
        rule=lambda m, i: m.q[i] >= base_volumes[i] * min_retention_ratios[i],
    )

    model.nonzero_volume = Constraint(model.I, rule=lambda m, i: m.q[i] >= 1.0)

    min_gap = max(0.0, float(request.minimum_price_gap))
    model.ladder_order = Constraint(
        RangeSet(0, n - 2),
        rule=lambda m, i: m.p[i + 1] >= m.p[i] + min_gap,
    )

    revenue_expr = sum(model.p[i] * model.q[i] for i in range(n))
    profit_expr = sum((model.p[i] - unit_costs[i]) * model.q[i] for i in range(n))
    volume_expr = sum(model.q[i] for i in range(n))

    objective_key = request.optimization_objective

    has_absolute_revenue_floor = request.enforce_revenue_floor or (
        request.revenue_floor_value is not None and request.revenue_floor_value > 0
    )
    has_absolute_profit_floor = request.enforce_profit_floor or (
        request.profit_floor_value is not None and request.profit_floor_value > 0
    )

    # New objective-aware floor behavior:
    # - maximize revenue => guard profit
    # - maximize profit => guard revenue
    # - maximize volume => guard both if provided
    should_apply_revenue_drop_floor = objective_key in {"profit", "volume"}
    should_apply_profit_drop_floor = objective_key in {"revenue", "volume"}

    if has_absolute_revenue_floor:
        revenue_floor = (
            request.revenue_floor_value
            if request.revenue_floor_value and request.revenue_floor_value > 0
            else current_totals["total_revenue"]
        )
        model.revenue_floor = Constraint(expr=revenue_expr >= revenue_floor)
    elif should_apply_revenue_drop_floor and request.minimum_revenue_drop_pct_from_current is not None:
        drop_pct = max(0.0, min(100.0, float(request.minimum_revenue_drop_pct_from_current)))
        revenue_floor = current_totals["total_revenue"] * (1.0 - drop_pct / 100.0)
        model.revenue_floor = Constraint(expr=revenue_expr >= revenue_floor)

    if has_absolute_profit_floor:
        if request.profit_floor_value and request.profit_floor_value > 0:
            profit_floor = request.profit_floor_value
        else:
            floor_ratio = max(0.0, 1.0 - request.allowed_profit_decrease_pct / 100.0)
            profit_floor = current_totals["total_profit"] * floor_ratio
        model.profit_floor = Constraint(expr=profit_expr >= profit_floor)
    elif should_apply_profit_drop_floor and request.minimum_profit_drop_pct_from_current is not None:
        drop_pct = max(0.0, min(100.0, float(request.minimum_profit_drop_pct_from_current)))
        profit_floor = current_totals["total_profit"] * (1.0 - drop_pct / 100.0)
        model.profit_floor = Constraint(expr=profit_expr >= profit_floor)

    if objective_key == "volume":
        model.objective = Objective(expr=volume_expr, sense=maximize)
    elif objective_key == "profit":
        model.objective = Objective(expr=profit_expr, sense=maximize)
    else:
        model.objective = Objective(expr=revenue_expr, sense=maximize)

    solver = SolverFactory("ipopt")
    if not solver.available(False):
        raise RuntimeError(
            "IPOPT solver is not available. Install IPOPT and ensure it is discoverable by Pyomo."
        )

    solved = solver.solve(model, tee=False)
    if solved.solver.status != SolverStatus.ok:
        raise RuntimeError(f"Optimization failed: solver status {solved.solver.status}")
    if solved.solver.termination_condition not in {
        TerminationCondition.optimal,
        TerminationCondition.locallyOptimal,
    }:
        raise RuntimeError(
            f"Optimization failed: {solved.solver.termination_condition}"
        )

    optimized_prices = [float(value(model.p[i])) for i in range(n)]
    optimized_volumes = [float(max(0.0, value(model.q[i]))) for i in range(n)]

    product_results = build_product_results(
        sorted_rows,
        optimized_prices=optimized_prices,
        optimized_volumes=optimized_volumes,
        unit_costs=unit_costs,
    )
    optimized_totals = build_totals(product_results, current=False)
    summary = build_summary(product_results, current_totals, optimized_totals)

    return AspOptimizationResponse(
        controls=request,
        selected_month=selected_month,
        current_totals=PortfolioTotals(**current_totals),
        optimized_totals=PortfolioTotals(**optimized_totals),
        product_results=[ProductOptimizationResult(**row) for row in product_results],
        summary=SummaryMetrics(**summary),
        model_context=OptimizationModelContext(
            own_elasticities=own_elasticities,
            beta_ppu=[float(x) for x in beta_ppu],
            cross_matrix=[[float(x) for x in row] for row in cross_matrix],
        ),
    )
