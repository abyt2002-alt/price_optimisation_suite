import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Play } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import AspOptimizationSidebar from '../components/asp-determination/AspOptimizationSidebar'
import AspOptimizationTable from '../components/asp-determination/AspOptimizationTable'
import CurrentVsOptimizedLadderChart from '../components/asp-determination/CurrentVsOptimizedLadderChart'
import LadderComparisonChart from '../components/asp-determination/LadderComparisonChart'
import OptimizationSummaryCards from '../components/asp-determination/OptimizationSummaryCards'
import { optimizeAspLadder } from '../services/aspOptimizationApi'
import { formatYearMonthLabel, getInsightsMonths } from '../utils/insightsUtils'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const parseNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const lerp = (start, end, progress) => start + (end - start) * progress

const buildInterpolatedResult = (fromResult, toResult, progress) => {
  const rows = toResult.optimizedProducts.map((toRow, index) => {
    const fromRow = fromResult.optimizedProducts[index] ?? toRow

    const optimizedAsp = lerp(fromRow.optimizedAsp, toRow.optimizedAsp, progress)
    const optimizedVolume = lerp(fromRow.optimizedVolume, toRow.optimizedVolume, progress)
    const optimizedRevenue = lerp(fromRow.optimizedRevenue, toRow.optimizedRevenue, progress)
    const optimizedProfit = lerp(fromRow.optimizedProfit, toRow.optimizedProfit, progress)

    return {
      ...toRow,
      optimizedAsp,
      optimizedVolume,
      optimizedRevenue,
      optimizedProfit,
      aspChange: optimizedAsp - toRow.currentAsp,
      aspChangePct: (optimizedAsp - toRow.currentAsp) / toRow.currentAsp,
      volumeChangePct: (optimizedVolume - toRow.currentVolume) / toRow.currentVolume,
      revenueChangePct: (optimizedRevenue - toRow.currentRevenue) / toRow.currentRevenue,
      profitChangePct:
        toRow.currentProfit === 0 ? 0 : (optimizedProfit - toRow.currentProfit) / toRow.currentProfit,
    }
  })

  const optimizedTotals = {
    totalVolume: lerp(fromResult.optimizedTotals.totalVolume, toResult.optimizedTotals.totalVolume, progress),
    totalRevenue: lerp(fromResult.optimizedTotals.totalRevenue, toResult.optimizedTotals.totalRevenue, progress),
    totalProfit: lerp(fromResult.optimizedTotals.totalProfit, toResult.optimizedTotals.totalProfit, progress),
  }

  const changedCount = rows.filter((row) => Math.abs(row.aspChange) >= 0.5).length
  const revenueLiftPct =
    (optimizedTotals.totalRevenue - toResult.currentTotals.totalRevenue) / toResult.currentTotals.totalRevenue
  const profitLiftPct =
    (optimizedTotals.totalProfit - toResult.currentTotals.totalProfit) / toResult.currentTotals.totalProfit
  const volumeLiftPct =
    (optimizedTotals.totalVolume - toResult.currentTotals.totalVolume) / toResult.currentTotals.totalVolume

  return {
    ...toResult,
    optimizedProducts: rows,
    optimizedTotals,
    changedCount,
    revenueLiftPct,
    profitLiftPct,
    volumeLiftPct,
  }
}

const adaptApiResult = (apiResult) => {
  const optimizedProducts = (apiResult.product_results ?? []).map((row) => ({
    productName: row.product_name,
    baseAsp: row.base_price,
    currentAsp: row.current_price,
    optimizedAsp: row.optimized_price,
    aspChange: row.price_change,
    aspChangePct: row.price_change_pct,
    basePriceChange: row.base_price_change,
    basePriceChangePct: row.base_price_change_pct,
    currentVolume: row.current_volume,
    optimizedVolume: row.new_volume,
    volumeChangePct: row.volume_change_pct,
    currentRevenue: row.current_revenue,
    optimizedRevenue: row.new_revenue,
    revenueChangePct: row.revenue_change_pct,
    currentProfit: row.current_profit,
    optimizedProfit: row.new_profit,
    profitChangePct: row.profit_change_pct,
  }))

  return {
    controls: apiResult.controls,
    modelContext: {
      ownElasticities: apiResult.model_context?.own_elasticities ?? [],
      betaPpu: apiResult.model_context?.beta_ppu ?? [],
      crossMatrix: apiResult.model_context?.cross_matrix ?? [],
    },
    currentTotals: {
      totalVolume: apiResult.current_totals?.total_volume ?? 0,
      totalRevenue: apiResult.current_totals?.total_revenue ?? 0,
      totalProfit: apiResult.current_totals?.total_profit ?? 0,
    },
    optimizedTotals: {
      totalVolume: apiResult.optimized_totals?.total_volume ?? 0,
      totalRevenue: apiResult.optimized_totals?.total_revenue ?? 0,
      totalProfit: apiResult.optimized_totals?.total_profit ?? 0,
    },
    optimizedProducts,
    changedCount: apiResult.summary?.changed_count ?? 0,
    revenueLiftPct: apiResult.summary?.revenue_uplift_pct ?? 0,
    profitLiftPct: apiResult.summary?.profit_uplift_pct ?? 0,
    volumeLiftPct: apiResult.summary?.volume_uplift_pct ?? 0,
    selectedMonth: apiResult.selected_month,
  }
}

const AspDeterminationPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [optimizationResult, setOptimizationResult] = useState(null)
  const [displayResult, setDisplayResult] = useState(null)
  const [isRunningOptimization, setIsRunningOptimization] = useState(false)
  const [optimizationError, setOptimizationError] = useState('')
  const animationFrameRef = useRef(null)

  const monthOptions = useMemo(() => getInsightsMonths(), [])
  const latestMonth = monthOptions[monthOptions.length - 1]
  const selectedMonth = latestMonth

  const controls = useMemo(
    () => ({
      objective: ['revenue', 'profit', 'volume'].includes(searchParams.get('aObj'))
        ? searchParams.get('aObj')
        : 'revenue',
      maxAspChangePct: clamp(parseNumber(searchParams.get('aMaxChg'), 12), 4, 25),
      minimumVolumeRetentionPct: clamp(parseNumber(searchParams.get('aMinRet'), 75), 50, 100),
      minimumRevenueDropPct: clamp(parseNumber(searchParams.get('aRevDropPct'), 0), 0, 100),
      minimumProfitDropPct: clamp(parseNumber(searchParams.get('aProfDropPct'), 0), 0, 100),
    }),
    [searchParams],
  )

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let dirty = false

    if (next.get('step') !== '3') {
      next.set('step', '3')
      dirty = true
    }

    if (next.has('aMonth')) {
      next.delete('aMonth')
      dirty = true
    }

    if (!next.get('aObj')) {
      next.set('aObj', 'revenue')
      dirty = true
    }

    if (!next.get('aMaxChg')) {
      next.set('aMaxChg', '12')
      dirty = true
    }

    if (!next.get('aMinRet')) {
      next.set('aMinRet', '75')
      dirty = true
    }

    if (!next.get('aRevDropPct')) {
      next.set('aRevDropPct', '0')
      dirty = true
    }

    if (!next.get('aProfDropPct')) {
      next.set('aProfDropPct', '0')
      dirty = true
    }

    ;['aGap', 'aRevFloor', 'aProfFloor', 'aIter', 'aRevFloorVal', 'aProfFloorVal'].forEach((legacyKey) => {
      if (next.has(legacyKey)) {
        next.delete(legacyKey)
        dirty = true
      }
    })

    if (dirty) {
      setSearchParams(next, { replace: true })
    }
  }, [latestMonth, searchParams, setSearchParams])

  const setParams = (patch) => {
    const next = new URLSearchParams(searchParams)
    next.delete('aMonth')

    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        next.delete(key)
      } else {
        next.set(key, String(value))
      }
    })

    next.set('step', '3')
    setSearchParams(next)
  }

  const runOptimization = useCallback(
    async (animate = true) => {
      if (!selectedMonth) {
        return
      }

      setOptimizationError('')
      setIsRunningOptimization(true)

      try {
        const apiResult = await optimizeAspLadder({
          selected_month: selectedMonth,
          optimization_objective: controls.objective,
          max_price_change_pct: controls.maxAspChangePct,
          minimum_price_gap: 0,
          minimum_volume_retention_pct: controls.minimumVolumeRetentionPct,
          minimum_revenue_drop_pct_from_current: controls.minimumRevenueDropPct,
          minimum_profit_drop_pct_from_current: controls.minimumProfitDropPct,
        })
        const result = adaptApiResult(apiResult)

        if (!animate || !displayResult) {
          setOptimizationResult(result)
          setDisplayResult(result)
          setIsRunningOptimization(false)
          return
        }

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }

        const fromResult = displayResult
        const start = performance.now()
        const durationMs = 850

        const animateFrame = (now) => {
          const rawProgress = Math.min((now - start) / durationMs, 1)
          const easedProgress = 1 - (1 - rawProgress) ** 3
          setDisplayResult(buildInterpolatedResult(fromResult, result, easedProgress))

          if (rawProgress < 1) {
            animationFrameRef.current = requestAnimationFrame(animateFrame)
            return
          }

          setOptimizationResult(result)
          setDisplayResult(result)
          setIsRunningOptimization(false)
          animationFrameRef.current = null
        }

        animationFrameRef.current = requestAnimationFrame(animateFrame)
      } catch (error) {
        setOptimizationError(error?.message || 'Optimization request failed.')
        setIsRunningOptimization(false)
      }
    },
    [controls, displayResult, selectedMonth],
  )

  useEffect(() => {
    if (selectedMonth && !displayResult) {
      runOptimization(false).catch(() => {
        // handled in runOptimization
      })
    }
  }, [selectedMonth, displayResult, runOptimization])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const rightSidebar = (
    <AspOptimizationSidebar
      controls={controls}
      onControlsChange={(patch) => {
        const mapped = {}
        if (patch.objective !== undefined) mapped.aObj = patch.objective
        if (patch.maxAspChangePct !== undefined) mapped.aMaxChg = patch.maxAspChangePct
        if (patch.minimumVolumeRetentionPct !== undefined) mapped.aMinRet = patch.minimumVolumeRetentionPct
        if (patch.minimumRevenueDropPct !== undefined) mapped.aRevDropPct = patch.minimumRevenueDropPct
        if (patch.minimumProfitDropPct !== undefined) mapped.aProfDropPct = patch.minimumProfitDropPct
        setParams(mapped)
      }}
      onRun={() => runOptimization(true)}
      onReset={() =>
        setParams({
          aObj: 'revenue',
          aMaxChg: '12',
          aMinRet: '75',
          aRevDropPct: '0',
          aProfDropPct: '0',
        })
      }
      isRunning={isRunningOptimization}
    />
  )

  const activeResult = displayResult ?? optimizationResult

  return (
    <AppLayout rightSidebar={rightSidebar}>
      <div className="space-y-5">
        <div className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-800">ASP Determination</h2>
              <p className="mt-2 max-w-4xl text-sm font-medium text-slate-600">
                Optimize the portfolio ASP ladder using own-price and cross-price elasticities.
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Planning anchor: {formatYearMonthLabel(selectedMonth)} (latest available month)
              </p>
            </div>

            <button
              type="button"
              onClick={() => runOptimization(true)}
              disabled={isRunningOptimization}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand.blue px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isRunningOptimization ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunningOptimization ? 'Optimizing...' : 'Run Optimization'}
            </button>
          </div>
        </div>

        {optimizationError && (
          <div className="panel border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm font-medium text-rose-800">{optimizationError}</p>
          </div>
        )}

        {activeResult && (
          <>
            {isRunningOptimization && (
              <div className="panel p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Running optimization and adjusting ASP ladder...
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-brand.blue" />
                </div>
              </div>
            )}
            <OptimizationSummaryCards result={activeResult} />

            <CurrentVsOptimizedLadderChart rows={activeResult.optimizedProducts} />
            <LadderComparisonChart rows={activeResult.optimizedProducts} />

            <AspOptimizationTable rows={activeResult.optimizedProducts} />
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default AspDeterminationPage
