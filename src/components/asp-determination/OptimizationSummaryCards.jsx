import { Activity, BadgeIndianRupee, ChartNoAxesCombined } from 'lucide-react'

const formatInt = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
const formatPct = (value) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
const formatObjectiveValue = (key, value) => (key === 'volume' ? formatInt(value) : `INR ${formatInt(value)}`)
const formatObjectiveDelta = (key, value) => {
  const sign = value >= 0 ? '+' : '-'
  const abs = Math.abs(value)
  return key === 'volume' ? `${sign}${formatInt(abs)}` : `${sign}INR ${formatInt(abs)}`
}

const KpiCard = ({ label, value, icon: Icon, tone = 'default', subline = '' }) => {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : 'border-slate-200 bg-white'

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <p className="mt-1 text-xl font-bold text-slate-800">{value}</p>
      {subline ? <p className="mt-1 text-[11px] font-medium text-slate-500">{subline}</p> : null}
    </div>
  )
}

const objectiveConfig = {
  revenue: {
    label: 'Optimized Revenue',
    key: 'revenue',
    liftKey: 'revenueLiftPct',
  },
  profit: {
    label: 'Optimized Profit',
    key: 'profit',
    liftKey: 'profitLiftPct',
  },
  volume: {
    label: 'Optimized Volume',
    key: 'volume',
    liftKey: 'volumeLiftPct',
  },
}

const OptimizationSummaryCards = ({ result }) => {
  const objective = result.controls?.optimization_objective ?? 'revenue'
  const goal = objectiveConfig[objective] ?? objectiveConfig.revenue
  const optimizedGoalValue = result.optimizedTotals[`total${goal.key[0].toUpperCase()}${goal.key.slice(1)}`]
  const currentGoalValue = result.currentTotals[`total${goal.key[0].toUpperCase()}${goal.key.slice(1)}`]
  const goalLiftPct = result[goal.liftKey] ?? 0
  const goalDelta = optimizedGoalValue - currentGoalValue
  const maxGoalValue = Math.max(optimizedGoalValue, currentGoalValue, 1)
  const currentBarWidth = `${(currentGoalValue / maxGoalValue) * 100}%`
  const optimizedBarWidth = `${(optimizedGoalValue / maxGoalValue) * 100}%`

  return (
    <div className="panel p-4">
      <h3 className="text-base font-semibold text-slate-800">Optimization Summary</h3>

      <div className="mt-3 grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[1.25fr_1fr]">
        <div className="h-full rounded-xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4">
          <div className="flex h-full flex-col">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Primary Optimized Goal</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{goal.label}</p>
              <p className={`mt-2 text-4xl font-extrabold leading-none ${goalLiftPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatPct(goalLiftPct)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Lift vs current
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span>Current</span>
                  <span>{formatObjectiveValue(goal.key, currentGoalValue)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-slate-500" style={{ width: currentBarWidth }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                  <span>Optimized</span>
                  <span>{formatObjectiveValue(goal.key, optimizedGoalValue)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-emerald-100">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: optimizedBarWidth }} />
                </div>
              </div>
            </div>

            <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
              <div className="rounded-lg border border-emerald-200 bg-white px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Delta</p>
                <p className={`mt-1 text-sm font-bold ${goalDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatObjectiveDelta(goal.key, goalDelta)}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Lift</p>
                <p className={`mt-1 text-sm font-bold ${goalLiftPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatPct(goalLiftPct)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Price Changes</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{result.changedCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <KpiCard
            label="Optimized Total Volume"
            value={formatInt(result.optimizedTotals.totalVolume)}
            icon={Activity}
            tone="success"
            subline={`Current: ${formatInt(result.currentTotals.totalVolume)}`}
          />
          <KpiCard
            label="Optimized Revenue"
            value={`INR ${formatInt(result.optimizedTotals.totalRevenue)}`}
            icon={BadgeIndianRupee}
            tone="success"
            subline={`Current: INR ${formatInt(result.currentTotals.totalRevenue)}`}
          />
          <KpiCard
            label="Optimized Profit"
            value={`INR ${formatInt(result.optimizedTotals.totalProfit)}`}
            icon={ChartNoAxesCombined}
            tone="success"
            subline={`Current: INR ${formatInt(result.currentTotals.totalProfit)}`}
          />
        </div>
      </div>
    </div>
  )
}

export default OptimizationSummaryCards
