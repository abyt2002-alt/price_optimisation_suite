import { useMemo, useState } from 'react'
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
const PAGE_SIZE = 5

const formatShortPct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`

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
      <p className="mt-1 text-xs text-slate-600">Volume: {formatShortPct(row.volumePct)}</p>
      <p className="text-xs text-slate-600">Revenue: {formatShortPct(row.revenuePct)}</p>
      <p className="text-xs text-slate-600">Gross Margin: {formatShortPct(row.grossMarginPct)}</p>
    </div>
  )
}

const computeGrossMarginPct = (profit, revenue) => {
  if (!Number.isFinite(profit) || !Number.isFinite(revenue) || revenue === 0) return 0
  return (profit / revenue) * 100
}

const parseOptionalThreshold = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const isScenarioWithinSkuConstraints = (result, scenarioId, productConstraints = {}) => {
  const detailRows = result?.scenarioDetails?.[scenarioId]?.optimizedProducts
  if (!Array.isArray(detailRows) || !detailRows.length) return true

  const rowByProduct = new Map(detailRows.map((row) => [String(row.productName ?? ''), row]))
  const constrainedEntries = Object.entries(productConstraints ?? {}).filter(([, item]) => item && typeof item === 'object')
  if (!constrainedEntries.length) return true

  return constrainedEntries.every(([productName, item]) => {
    const row = rowByProduct.get(String(productName))
    if (!row) return true

    const baseAsp = Number(row.baseAsp ?? row.currentAsp ?? 0)
    const optimizedAsp = Number(row.optimizedAsp ?? row.currentAsp ?? baseAsp)
    if (!Number.isFinite(baseAsp) || !Number.isFinite(optimizedAsp)) return true

    if (Boolean(item.noChange)) {
      return Math.abs(optimizedAsp - baseAsp) <= 0.5
    }

    const minPrice = Number(item.minPrice)
    const maxPrice = Number(item.maxPrice)
    const hasMin = Number.isFinite(minPrice)
    const hasMax = Number.isFinite(maxPrice)
    if (!hasMin && !hasMax) return true

    const lower = hasMin ? minPrice : -Infinity
    const upper = hasMax ? maxPrice : Infinity
    return optimizedAsp >= lower - 0.5 && optimizedAsp <= upper + 0.5
  })
}

/** Shared by OptimizationSummaryCards and AspDeterminationPage (scenario panel header). */
export function getScenarioSelectionSummary(result, scenarioFilters) {
  if (!result) {
    return {
      generatedCount: 0,
      enrichedScenarios: [],
      filteredScenarios: [],
      bestByMetric: null,
      baseGrossMarginPct: 0,
    }
  }

  const baseTotals = result.baseTotals ?? result.currentTotals
  const baseGrossMarginPct = computeGrossMarginPct(baseTotals.totalProfit, baseTotals.totalRevenue)
  const generatedCount = Number(
    result.aiMetadata?.generation_counts?.final_candidates ?? result.scenarioSummaries?.length ?? 0,
  )

  const enrichedScenarios = (result.scenarioSummaries ?? []).map((scenario) => {
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

  const minVolumeIncreasePct = parseOptionalThreshold(scenarioFilters?.minVolumeUpliftPct)
  const minRevenueIncreasePct = parseOptionalThreshold(scenarioFilters?.minRevenueUpliftPct)
  const minGrossMarginIncreasePct = parseOptionalThreshold(scenarioFilters?.minProfitUpliftPct)
  const skuConstraints = scenarioFilters?.productConstraints ?? {}

  const numericFilteredScenarios = enrichedScenarios.filter(
    (scenario) =>
      (minVolumeIncreasePct === null || scenario.volumePct >= minVolumeIncreasePct) &&
      (minRevenueIncreasePct === null || scenario.revenuePct >= minRevenueIncreasePct) &&
      (minGrossMarginIncreasePct === null || scenario.grossMarginPct >= minGrossMarginIncreasePct),
  )

  const filteredScenarios = numericFilteredScenarios.filter((scenario) =>
    isScenarioWithinSkuConstraints(result, scenario.scenarioId, skuConstraints),
  )

  let bestByMetric = null
  if (filteredScenarios.length) {
    const pickBest = (metricKey) =>
      [...filteredScenarios].sort(
        (a, b) => (b[metricKey] ?? -Infinity) - (a[metricKey] ?? -Infinity) || (a.rank ?? 0) - (b.rank ?? 0),
      )[0]

    bestByMetric = {
      bestVolume: pickBest('volumePct'),
      bestRevenue: pickBest('revenuePct'),
      bestGrossMargin: pickBest('grossMarginPct'),
    }
  }

  return {
    generatedCount,
    enrichedScenarios,
    filteredScenarios,
    bestByMetric,
    baseGrossMarginPct,
  }
}

export { formatShortPct }

const sortScenarioRows = (rows, sortBy) => {
  const keyMap = {
    volume: 'volumePct',
    revenue: 'revenuePct',
    grossMargin: 'grossMarginPct',
    rank: 'rank',
    name: 'scenarioName',
  }
  const metricKey = keyMap[sortBy] ?? 'revenuePct'
  const next = [...rows]

  next.sort((a, b) => {
    if (metricKey === 'scenarioName') {
      return String(a.scenarioName ?? '').localeCompare(String(b.scenarioName ?? ''))
    }
    if (metricKey === 'rank') {
      return (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)
    }
    return (
      (b[metricKey] ?? -Infinity) - (a[metricKey] ?? -Infinity) ||
      (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)
    )
  })

  return next
}

const buildAnchorRows = (rows) => {
  const pickDistinctBest = (metricKey, excludedIds) =>
    rows.find((row) => !excludedIds.has(String(row.scenarioId)) && (row[metricKey] ?? -Infinity) > -Infinity) ?? null

  const byVolume = sortScenarioRows(rows, 'volume')
  const byRevenue = sortScenarioRows(rows, 'revenue')
  const byGross = sortScenarioRows(rows, 'grossMargin')
  const selectedIds = new Set()

  const bestVolume = pickDistinctBest('volumePct', selectedIds) ?? byVolume[0] ?? null
  if (bestVolume) selectedIds.add(String(bestVolume.scenarioId))

  const bestRevenue =
    byRevenue.find((row) => !selectedIds.has(String(row.scenarioId))) ?? null
  if (bestRevenue) selectedIds.add(String(bestRevenue.scenarioId))

  const bestGross =
    byGross.find((row) => !selectedIds.has(String(row.scenarioId))) ?? null

  return [
    bestVolume ? { ...bestVolume, anchorLabel: 'Max Volume' } : null,
    bestRevenue ? { ...bestRevenue, anchorLabel: 'Max Revenue' } : null,
    bestGross ? { ...bestGross, anchorLabel: 'Max Gross Margin' } : null,
  ].filter(Boolean)
}

const downloadScenarioCsv = (rows, filename) => {
  const header = ['Scenario Name', 'Scenario Family', 'Volume %', 'Revenue %', 'Gross Margin %']
  const csvRows = rows.map((row) => [
    row.scenarioName,
    row.scenarioFamily,
    row.volumePct.toFixed(2),
    row.revenuePct.toFixed(2),
    row.grossMarginPct.toFixed(2),
  ])
  const csv = [header, ...csvRows]
    .map((line) =>
      line
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const OptimizationSummaryCards = ({ result, onSelectScenario, scenarioFilters }) => {
  const [viewMode, setViewMode] = useState('anchor')
  const [sortBy, setSortBy] = useState('revenue')
  const [page, setPage] = useState(1)

  const { filteredScenarios, generatedCount } = useMemo(
    () => getScenarioSelectionSummary(result, scenarioFilters),
    [result, scenarioFilters],
  )

  const anchorRows = useMemo(() => buildAnchorRows(filteredScenarios), [filteredScenarios])
  const allRows = useMemo(() => sortScenarioRows(filteredScenarios, sortBy), [filteredScenarios, sortBy])
  const isAllMode = viewMode === 'all'
  const sourceRows = isAllMode ? allRows : anchorRows
  const pageCount = Math.max(1, Math.ceil(sourceRows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return sourceRows.slice(start, start + PAGE_SIZE).map((row) => ({
      ...row,
      xLabel:
        !isAllMode && row.anchorLabel
          ? row.anchorLabel
          : row.scenarioName.length > 22
            ? `${row.scenarioName.slice(0, 20)}..`
            : row.scenarioName,
    }))
  }, [sourceRows, safePage, isAllMode])

  const maxAbsPct = Math.max(
    5,
    ...pagedRows.map((row) =>
      Math.max(Math.abs(row.volumePct ?? 0), Math.abs(row.revenuePct ?? 0), Math.abs(row.grossMarginPct ?? 0)),
    ),
  )
  const yLimit = Math.ceil(maxAbsPct / 5) * 5

  const showingStart = sourceRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const showingEnd = Math.min(sourceRows.length, safePage * PAGE_SIZE)

  const handleToggleView = () => {
    setViewMode((prev) => (prev === 'all' ? 'anchor' : 'all'))
    setPage(1)
  }

  const handleSortChange = (event) => {
    setSortBy(event.target.value)
    setPage(1)
  }

  const handleDownload = () => {
    const rows = isAllMode ? allRows : anchorRows
    const filename = isAllMode ? 'all_filtered_scenarios.csv' : 'anchor_scenarios.csv'
    downloadScenarioCsv(rows, filename)
  }

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleToggleView}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-[#2563EB] hover:bg-slate-50"
        >
          {isAllMode ? `Show Anchor ${anchorRows.length}` : `Show All (${generatedCount || filteredScenarios.length})`}
        </button>
        <select
          value={sortBy}
          onChange={handleSortChange}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
        >
          <option value="revenue">Sort by Revenue %</option>
          <option value="volume">Sort by Volume %</option>
          <option value="grossMargin">Sort by Gross Margin %</option>
          <option value="rank">Sort by Rank</option>
          <option value="name">Sort by Scenario Name</option>
        </select>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Download CSV
        </button>
      </div>

      <p className="mb-3 text-sm font-medium text-slate-600">
        {isAllMode
          ? `Showing ${showingStart}-${showingEnd} of ${sourceRows.length}`
          : `Anchor view (Max Volume / Max Revenue / Max Gross Margin). Showing ${showingStart}-${showingEnd} of ${sourceRows.length}`}
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#0F172A]">View and compare scenarios</h3>
            <p className="mt-1 text-[11px] font-medium text-slate-600">
              Scenarios selected to surface the highest positive volume %, revenue %, and gross margin % vs base (up to
              three distinct scenarios). Change filters to see more.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm font-semibold text-slate-700">
              Page {safePage} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              disabled={safePage >= pageCount}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-3 h-[300px]">
          {pagedRows.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50">
              <p className="px-4 text-center text-sm font-medium text-slate-600">
                Scenarios were generated, but current filters or SKU bounds removed all visible results.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pagedRows} margin={{ top: 18, right: 14, left: 4, bottom: 22 }}>
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
                  {pagedRows.map((entry) => (
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
                  {pagedRows.map((entry) => (
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
                  {pagedRows.map((entry) => (
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
