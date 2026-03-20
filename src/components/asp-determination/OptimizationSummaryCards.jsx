import { useEffect, useMemo, useState } from 'react'
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

const PAGE_SIZE = 5
const VOLUME_COLOR = '#458EE2'
const REVENUE_COLOR = '#41C185'
const GROSS_MARGIN_COLOR = '#FFBD59'

const formatInt = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
const formatCurrency = (value) => `INR ${formatInt(value)}`
const formatPct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
const formatShortPct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

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
  const [scenarioPage, setScenarioPage] = useState(1)
  const [sortBy, setSortBy] = useState('revenue')
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

  const scenariosForDisplay = filteredScenarios

  const sortedScenarios = useMemo(() => {
    const rows = [...scenariosForDisplay]
    rows.sort((a, b) => {
      if (sortBy === 'volume') return b.volumePct - a.volumePct || a.rank - b.rank
      if (sortBy === 'revenue') return b.revenuePct - a.revenuePct || a.rank - b.rank
      if (sortBy === 'grossMargin') return b.grossMarginPct - a.grossMarginPct || a.rank - b.rank
      return b.revenuePct - a.revenuePct || a.rank - b.rank
    })
    return rows
  }, [scenariosForDisplay, sortBy])

  const totalPages = Math.max(1, Math.ceil(sortedScenarios.length / PAGE_SIZE))
  useEffect(() => {
    setScenarioPage((prev) => clamp(prev, 1, totalPages))
  }, [totalPages])

  const safeScenarioPage = clamp(scenarioPage, 1, totalPages)
  const startIndex = (safeScenarioPage - 1) * PAGE_SIZE
  const endIndexExclusive = Math.min(sortedScenarios.length, startIndex + PAGE_SIZE)
  const visibleRows = sortedScenarios.slice(startIndex, endIndexExclusive)

  const chartData = visibleRows.map((row, idx) => ({
    ...row,
    viewIndex: startIndex + idx + 1,
    xLabel:
      row.scenarioName.length > 24
        ? `${row.scenarioName.slice(0, 22)}..`
        : row.scenarioName,
  }))

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
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Sort:</label>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-[#0F172A]"
          >
            <option value="volume">Volume %</option>
            <option value="revenue">Revenue %</option>
            <option value="grossMargin">Gross Margin %</option>
          </select>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>
        </div>
      </div>

      <p className="mt-2 text-[11px] font-medium text-slate-600">
        Generated {generatedCount} scenarios; showing {sortedScenarios.length} after filters.
      </p>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-slate-600">
            Showing {sortedScenarios.length === 0 ? 0 : startIndex + 1}-{endIndexExclusive} of {sortedScenarios.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScenarioPage((prev) => Math.max(1, prev - 1))}
              disabled={safeScenarioPage <= 1}
              className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-[11px] font-medium text-slate-600">
              Page {safeScenarioPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setScenarioPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeScenarioPage >= totalPages}
              className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

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
