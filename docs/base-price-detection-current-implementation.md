# Base Price Detection - End-to-End Flow (Current Implementation)

This document explains, step by step, what currently happens in the **Base Price Detection** feature.
It reflects the code as implemented right now.

## Scope

- Frontend page: `src/pages/AspDeterminationPage.jsx` (UI label: **Base Price Detection**)
- Backend endpoint: `POST /api/asp-determination/optimize`
- Backend service: `backend/services/asp_optimization_service.py`

## Step 0 - User Opens Step 3

1. User opens Step 3 page.
2. UI normalizes URL params:
   - objective: `revenue` or `profit`
   - gross margin %
3. UI checks cache fingerprint:
   - `selectedMonth|objective|grossMarginPct`
4. If matching cached result exists, UI uses it.
5. Otherwise UI calls backend optimize API.

## Step 1 - Frontend Sends Request

Frontend API call (`src/services/aspOptimizationApi.js`):

- URL: `/api/asp-determination/optimize`
- Method: `POST`
- Payload fields used:
  - `selected_month`
  - `optimization_objective` (`revenue` / `profit`)
  - `gross_margin_pct` (minimum GM floor, range 20-60)

Request schema: `backend/schemas/asp_determination.py` (`AspOptimizationRequest`).

## Step 2 - Backend Loads Data

Service loads rows from:

- `src/data/portfolioMockData.js`
- export: `ownBrandMonthlyData`

Loader file: `backend/utils/data_loader.py`.

Month selection logic:

- if request month exists in data, use it
- else use latest available month

## Step 3 - Product Rows Are Sorted

Rows are sorted for optimization by:

1. base price (fallback: current price)
2. product name

Function: `_sorted_rows_for_optimization(...)`.

## Step 4 - Build Current-Reference Elasticities

From `backend/utils/elasticity_utils.py`:

1. `build_own_elasticities(sorted_rows)`
   - tries fixed mapping first (`FIXED_OWN_ELASTICITY_BY_KEY`)
   - fallback formula otherwise
   - clamped to [-2.5, -0.5]

2. `build_cross_elasticity_matrix(sorted_rows)`
   - interaction only when price gap <= 100
   - otherwise cross elasticity = 0
   - cross signs currently negative in this implementation

## Step 5 - Convert Everything to Base Reference

Function: `convert_to_base_reference(...)`.

Inputs:

- current prices
- base prices
- current volumes
- current own/cross elasticity

What it does:

1. builds `beta_current` and `gamma_current`
2. backcasts base volume per product
3. computes own elasticity at base
4. computes cross elasticity matrix at base

Outputs:

- `own_elasticities_base`
- `cross_matrix_base`
- `base_volumes`

## Step 6 - Build Beta/Gamma and Cost Inputs

Still in service:

1. `build_beta_and_gamma(...)` creates:
   - `beta_ppu` (own coefficient)
   - `gamma_matrix` (cross coefficients)

2. Unit cost from fixed COGS business rule:

- `unit_cost_i = base_price_i * 0.40` (fixed COGS 40%)

## Step 7 - Generate Candidate Prices Per Product

Candidate offsets are fixed:

- `[-100, -50, 0, +50, +100]`

Elasticity gating rules:

- if own elasticity <= -1.5: only same/decrease offsets
- if own elasticity > -0.80: only same/increase offsets
- else all offsets

Candidate min clamp:

- price >= 1

## Step 8 - Evaluate a Scenario (Math)

For a scenario price vector `P`:

- `delta_i = P_i - BasePrice_i`

Volume equation:

- `Q_i_new = max(1, Q_i_base + beta_i * delta_i + sum_j(gamma_ij * delta_j))`

Totals:

- `Revenue = sum_i(P_i * Q_i_new)`
- `Profit = sum_i((P_i - unit_cost_i) * Q_i_new)`
- `Volume = sum_i(Q_i_new)`

This is applied for each candidate state explored in search.

## Step 9 - Beam Search (Why It Is Fast)

Engine uses deterministic beam search.

Constants:

- `BEAM_WIDTH = 1000`
- `TOP_SCENARIOS = 1000`

Flow:

1. start from one state
2. expand product 1 candidates, score, keep top 1000
3. expand product 2 from beam, score, keep top 1000
4. repeat product-by-product
5. final top 1000 states retained

Important:

- It does **not** enumerate full combinatorial space.
- This is why it is fast.

## Step 10 - Ranking and Determinism

Score function:

- objective `revenue`: primary = total revenue
- objective `profit`: primary = total profit

Deterministic tie-breakers:

1. secondary economic metric
2. higher volume
3. lower total absolute movement
4. stable tuple ordering

Because inputs + sort rules are fixed, same request gives same ranked scenarios.

## Step 11 - Baseline Merge and Revenue Fallback

After beam search:

1. baseline/current state is merged
2. duplicate price vectors removed
3. apply minimum gross-margin feasibility filter:
   - `total_profit / total_revenue * 100 >= gross_margin_pct`
   - `gross_margin_pct` accepted range is 20-60
4. reranked and trimmed to top 1000

Extra fallback only in revenue objective:

- if no positive revenue uplift vs current,
- tries alternate variants (current-anchor candidates + scaled gamma)
- picks first variant that yields positive best revenue.

## Step 12 - Response Construction

For each final scenario:

- ID generated: `S1`, `S2`, ...
- create scenario totals + product rows
- create summary uplift percentages

Response fields include:

- `base_totals`
- `current_totals`
- `optimized_totals` (selected top scenario)
- `scenario_summaries` (ranked list)
- `scenario_details` (full rows per scenario)
- `model_context` (`own_elasticities`, `beta_ppu`, `cross_matrix`)

## Step 13 - Frontend Rendering

UI components consume response:

1. `OptimizationSummaryCards`
   - hero (objective uplift)
   - scenario bar chart with paging/filtering
2. `CurrentVsOptimizedLadderChart`
   - row-wise base vs optimized movement
3. `LadderComparisonChart`
   - step chart + CSV download for base ladder

On scenario click:

- UI switches selected scenario
- hero + ladders animate/interpolate to new values

## Current Constraint Status

- Ladder-order constraint (`P_i >= P_{i-1}`) is currently **removed** in search expansion.

## What Is Real vs Simplified

Real in current implementation:

- actual backend optimization service runs each request
- own and cross effects influence volume
- objective-based ranking is active
- 1000 ranked scenarios returned

Simplified vs original heavy stack:

- not using Pyomo/IPOPT now
- cross effects are currently generated from price-gap interaction rule
- fixed elasticity mapping + fallback formula in utility

## Quick Reviewer Checks

1. Same payload twice -> same top scenario order.
2. Change objective revenue/profit -> ranking changes accordingly.
3. Change gross margin -> profit rankings move.
4. Click different scenario -> UI updates all cards/charts.
5. Disable cache (or change controls) -> API rerun happens.

