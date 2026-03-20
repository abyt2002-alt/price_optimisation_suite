import { useMemo } from 'react'
import { Download } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const VOLUME_COLOR = '#458EE2'
const REVENUE_COLOR = '#41C185'
const GROSS_MARGIN_COLOR = '#FFBD59'

const formatInt = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
const formatCurrency = (value) => `INR ${formatInt(value)}`
const formatPct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
const formatShortPct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
const escapeCsv = (value) => {
  const raw = String(value ?? '')
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replaceAll('"', '""')}"`
  }
  return raw
}

const ScenarioLegend = () => (
  <div className="mt-2 flex items-center justify-center gap-5 text-[11px] font-semibold text-[#0F172A]">
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: VOLUME_COLOR }} />
      <span>Volume %</span>
    </div>
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: REVENUE_COLOR }} />
      <span>Revenue %</span>
    </div>
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: GROSS_MARGIN_COLOR }} />
      <span>Gross Margin %</span>
    </div>
  </div>
)

const ScenarioTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-sm font-semibold text-[#0F172A]">{row.scenarioName}</p>
      <p className="text-xs text-slate-600">Family: {row.scenarioFamily}</p>
      <p className="mt-1 text-xs text-slate-600">Volume: {formatInt(row.totalVolume)}</p>
      <p className="text-xs text-slate-600">Revenue: {formatCurrency(row.totalRevenue)}</p>
      <p className="text-xs text-slate-600">Profit: {formatCurrency(row.totalProfit)}</p>
      <p className="mt-1 text-xs text-slate-600">Volume %: {formatShortPct(row.volumePct)}</p>
      <p className="text-xs text-slate-600">Revenue %: {formatShortPct(row.revenuePct)}</p>
      <p className="text-xs text-slate-600">Gross Margin %: {formatShortPct(row.grossMarginPct)}</p>
    </div>
  )
}

const computeGrossMarginPct = (profit, revenue) => {
  if (!Number.isFinite(profit) || !Number.isFinite(revenue) || revenue === 0) return 0
  return (profit / revenue) * 100
}

const OptimizationSummaryCards = ({ result, onSelectScenario, scenarioFilters }) => {
  const baseTotals = result.baseTotals ?? result.currentTotals
  const baseGrossMarginPct = computeGrossMarginPct(baseTotals.totalProfit, baseTotals.totalRevenue)
  const generatedCount = Number(result.aiMetadata?.generation_counts?.final_candidates ?? result.scenarioSummaries?.length ?? 0)

  const enrichedScenarios = useMemo(() => {
    return (result.scenarioSummaries ?? []).map((scenario) => {
      const grossMarginPct = computeGrossMarginPct(scenario.totalProfit, scenario.totalRevenue) - baseGrossMarginPct
      return {
        ...scenario,
        scenarioName: scenario.scenarioName ?? `Scenario ${scenario.scenarioId}`,
        scenarioFamily: scenario.scenarioFamily ?? 'Balanced Ladder',
        volumePct: Number(scenario.volumeLiftPct ?? 0) * 100,
        revenuePct: Number(scenario.revenueLiftPct ?? 0) * 100,
        profitPct: Number(scenario.profitLiftPct ?? 0) * 100,
        grossMarginPct,
      }
    })
  }, [result.scenarioSummaries, baseGrossMarginPct])

  const parseOptionalThreshold = (value) => {
    if (value === '' || value === null || value === undefined) return null
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }
  const minVolumeIncreasePct = parseOptionalThreshold(scenarioFilters?.minVolumeUpliftPct)
  const minRevenueIncreasePct = parseOptionalThreshold(scenarioFilters?.minRevenueUpliftPct)
  const minProfitIncreasePct = parseOptionalThreshold(scenarioFilters?.minProfitUpliftPct)

  const filteredScenarios = useMemo(() => {
    return enrichedScenarios.filter(
      (scenario) =>
        (minVolumeIncreasePct === null || scenario.volumePct >= minVolumeIncreasePct) &&
        (minRevenueIncreasePct === null || scenario.revenuePct >= minRevenueIncreasePct) &&
        (minProfitIncreasePct === null || scenario.profitPct >= minProfitIncreasePct),
    )
  }, [enrichedScenarios, minVolumeIncreasePct, minRevenueIncreasePct, minProfitIncreasePct])

  const bestByMetric = useMemo(() => {
    if (!filteredScenarios.length) return null

    const pickBest = (metricKey) => {
      return [...filteredScenarios].sort(
        (a, b) => (b[metricKey] ?? -Infinity) - (a[metricKey] ?? -Infinity) || (a.rank ?? 0) - (b.rank ?? 0),
      )[0]
    }

    return {
      bestVolume: pickBest('volumePct'),
      bestRevenue: pickBest('revenuePct'),
      bestGrossMargin: pickBest('grossMarginPct'),
    }
  }, [filteredScenarios])

  const chartData = useMemo(() => {
    const sortedBy = (metricKey) => {
      const rows = [...filteredScenarios]
      rows.sort((a, b) => (b[metricKey] ?? 0) - (a[metricKey] ?? 0) || (a.rank ?? 0) - (b.rank ?? 0))
      return rows
    }

    const selectedIds = new Set()
    const byVolume = sortedBy('volumePct')
    const byRevenue = sortedBy('revenuePct')
    const byGross = sortedBy('grossMarginPct')

    const bestVolume = byVolume.filter((s) => (s.volumePct ?? 0) > 0).length ? byVolume.find((s) => (s.volumePct ?? 0) > 0) : byVolume[0] ?? null
    if (bestVolume) selectedIds.add(String(bestVolume.scenarioId))

    const bestRevenue =
      byRevenue.filter((s) => (s.revenuePct ?? 0) > 0 && !selectedIds.has(String(s.scenarioId)))[0] ?? byRevenue.find((s) => !selectedIds.has(String(s.scenarioId))) ?? null
    if (bestRevenue) selectedIds.add(String(bestRevenue.scenarioId))

    const bestGross =
      byGross.filter((s) => (s.grossMarginPct ?? 0) > 0 && !selectedIds.has(String(s.scenarioId)))[0] ?? byGross.find((s) => !selectedIds.has(String(s.scenarioId))) ?? null

    const ordered = [bestVolume, bestRevenue, bestGross].filter(Boolean)

    return ordered.map((row, idx) => ({
      ...row,
      viewIndex: idx + 1,
      xLabel: row.scenarioName.length > 24 ? `${row.scenarioName.slice(0, 22)}..` : row.scenarioName,
    }))
  }, [filteredScenarios])

  const selectedRow = chartData.find((row) => row.scenarioId === result.selectedScenarioId) ?? chartData[0] ?? null
  const maxAbsPct = Math.max(
    5,
    ...chartData.map((row) => Math.max(Math.abs(row.volumePct), Math.abs(row.revenuePct), Math.abs(row.grossMarginPct))),
  )
  const yLimit = Math.ceil(maxAbsPct / 5) * 5

  const handleDownloadCsv = () => {
    const allRows = [...(result.scenarioSummaries ?? [])]
    allRows.sort((a, b) => Number(a.scenarioId) - Number(b.scenarioId))

    const baseGross = baseGrossMarginPct
    const header = [
      'Scenario ID',
      'Scenario Name',
      'Family',
      'Total Volume',
      'Total Revenue',
      'Total Profit',
      'Volume Uplift %',
      'Revenue Uplift %',
      'Profit Uplift %',
      'Gross Margin %',
      'Gross Margin % Change',
    ]
    const lines = [header.join(',')]

    allRows.forEach((row) => {
      const rowGross = computeGrossMarginPct(row.totalProfit, row.totalRevenue)
      const rowValues = [
        row.scenarioId,
        row.scenarioName ?? `Scenario ${row.scenarioId}`,
        row.scenarioFamily ?? 'Balanced Ladder',
        formatInt(row.totalVolume),
        row.totalRevenue.toFixed(2),
        row.totalProfit.toFixed(2),
        (Number(row.volumeLiftPct ?? 0) * 100).toFixed(4),
        (Number(row.revenueLiftPct ?? 0) * 100).toFixed(4),
        (Number(row.profitLiftPct ?? 0) * 100).toFixed(4),
        rowGross.toFixed(4),
        (rowGross - baseGross).toFixed(4),
      ]
      lines.push(rowValues.map(escapeCsv).join(','))
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `base_ladder_scenarios_${result.selectedMonth || 'current'}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-[#0F172A]">TOTAL % Comparison (Volume / Revenue / Gross Margin)</h3>
        <button
          type="button"
          onClick={handleDownloadCsv}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </button>
      </div>

      <div className="mt-2 space-y-1">
        <p className="text-[11px] font-medium text-slate-600">{generatedCount} scenarios generated!</p>
        {bestByMetric ? (
          <p className="text-[11px] font-medium text-slate-600">
            Highest Volume: {formatShortPct(bestByMetric.bestVolume.volumePct)} · Highest Revenue:{' '}
            {formatShortPct(bestByMetric.bestRevenue.revenuePct)} · Highest Gross Margin:{' '}
            {formatShortPct(bestByMetric.bestGrossMargin.grossMarginPct)}
          </p>
        ) : (
          <p className="text-[11px] font-medium text-rose-700">No scenarios match current filters.</p>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-2 text-[11px] font-medium text-slate-600">
          1) Highest volume% (positive) · 2) Highest revenue% (positive) · 3) Highest gross margin% (positive)
        </p>

        {selectedRow && (
          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-[#0F172A]">
            Selected: {selectedRow.scenarioName} | Volume: {formatInt(selectedRow.totalVolume)} | Revenue:{' '}
            {formatCurrency(selectedRow.totalRevenue)}
          </div>
        )}

        <div className="mt-3 h-[300px]">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50">
              <p className="text-sm font-medium text-slate-600">No scenarios match current filters.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 18, right: 14, left: 4, bottom: 22 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <ReferenceLine y={0} stroke="#64748B" strokeWidth={1} />
                <XAxis
                  dataKey="xLabel"
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#0F172A' }}
                  interval={0}
                  tickMargin={8}
                />
                <YAxis
                  domain={[-yLimit, yLimit]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#0F172A' }}
                />
                <Tooltip content={<ScenarioTooltip />} />
                <Legend content={<ScenarioLegend />} />

                <Bar dataKey="volumePct" name="Volume %" fill={VOLUME_COLOR} radius={[3, 3, 0, 0]} onClick={(entry) => onSelectScenario?.(entry.scenarioId)}>
                  <LabelList
                    dataKey="volumePct"
                    position="top"
                    formatter={(value) => formatShortPct(Number(value))}
                    fill="#0F172A"
                    fontSize={11}
                    fontWeight={800}
                  />
                  {chartData.map((entry) => (
                    <Cell key={`vol-${entry.scenarioId}`} fill={VOLUME_COLOR} />
                  ))}
                </Bar>

                <Bar dataKey="revenuePct" name="Revenue %" fill={REVENUE_COLOR} radius={[3, 3, 0, 0]} onClick={(entry) => onSelectScenario?.(entry.scenarioId)}>
                  <LabelList
                    dataKey="revenuePct"
                    position="top"
                    formatter={(value) => formatShortPct(Number(value))}
                    fill="#0F172A"
                    fontSize={11}
                    fontWeight={800}
                  />
                  {chartData.map((entry) => (
                    <Cell key={`rev-${entry.scenarioId}`} fill={REVENUE_COLOR} />
                  ))}
                </Bar>

                <Bar dataKey="grossMarginPct" name="Gross Margin %" fill={GROSS_MARGIN_COLOR} radius={[3, 3, 0, 0]} onClick={(entry) => onSelectScenario?.(entry.scenarioId)}>
                  <LabelList
                    dataKey="grossMarginPct"
                    position="top"
                    formatter={(value) => formatShortPct(Number(value))}
                    fill="#0F172A"
                    fontSize={11}
                    fontWeight={800}
                  />
                  {chartData.map((entry) => (
                    <Cell key={`gm-${entry.scenarioId}`} fill={GROSS_MARGIN_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

export default OptimizationSummaryCards
