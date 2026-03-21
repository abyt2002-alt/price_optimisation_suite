import { Save } from 'lucide-react'

const SEGMENTS = [
  { key: 'daily', label: 'Daily Casual', color: '#2563EB' },
  { key: 'core', label: 'Core Plus', color: '#F97316' },
  { key: 'premium', label: 'Premium', color: '#16A34A' },
]

const formatInt = (value) => Math.round(value).toLocaleString('en-IN')
const formatCurrency = (value) => `INR ${formatInt(value)}`
const formatSignedPct = (value) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
const formatPct = (value) => `${Number(value).toFixed(1)}%`
const formatElasticity = (value) => Number(value).toFixed(2)
const parseNumeric = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const volumeTone = (value) => {
  if (value > 0.001) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value < -0.001) return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}
const toElasticityLinePct = (elasticity) => {
  const absValue = Math.abs(Number(elasticity) || 0)
  const minE = 0.5
  const maxE = 2.5
  const ratio = (absValue - minE) / (maxE - minE)
  return Math.max(0, Math.min(100, ratio * 100))
}
const getSliderBounds = (basePrice) => {
  const base = Math.max(1, Math.round(parseNumeric(basePrice, 1)))
  return {
    min: Math.max(1, base - 150),
    max: base + 150,
  }
}
const getSliderValue = (value, basePrice) => {
  const { min, max } = getSliderBounds(basePrice)
  const current = Math.round(parseNumeric(value, basePrice))
  const clamped = Math.max(min, Math.min(max, current))
  const offset = clamped - Math.round(parseNumeric(basePrice, 1))
  const snappedOffset = Math.round(offset / 50) * 50
  return Math.max(min, Math.min(max, Math.round(parseNumeric(basePrice, 1)) + snappedOffset))
}

const normalizeProductLabel = (value) =>
  String(value ?? '')
    .replace(/\|/g, ' | ')
    .replace(/\s+/g, ' ')
    .trim()

const SegmentWorkspacePanel = ({
  rows = [],
  selectedSegment = 'daily',
  onSelectSegment,
  mode = 'comparison',
  baseInputValues = {},
  onBaseInputChange,
  onBaseCommit,
  recommendedInputValues = {},
  onRecommendedInputChange,
  onRecommendedCommit,
  onSaveScenario,
  onResetToBaseScenario,
  selectedScenarioName = '',
}) => {
  const isBaseOnly = mode === 'base'

  const segments = SEGMENTS.map((segment) => {
    const segmentRows = rows.filter((row) => row.segmentKey === segment.key)
    const baseRevenue = segmentRows.reduce((sum, row) => sum + (row.currentRevenue ?? 0), 0)
    const recRevenue = segmentRows.reduce((sum, row) => sum + (row.optimizedRevenue ?? 0), 0)
    const baseVolume = segmentRows.reduce((sum, row) => sum + (row.currentVolume ?? 0), 0)
    const recVolume = segmentRows.reduce((sum, row) => sum + (row.optimizedVolume ?? 0), 0)
    const revenueLift = baseRevenue === 0 ? 0 : (recRevenue - baseRevenue) / baseRevenue
    const volumeLift = baseVolume === 0 ? 0 : (recVolume - baseVolume) / baseVolume

    return {
      ...segment,
      rows: segmentRows,
      baseRevenue,
      recRevenue,
      baseVolume,
      recVolume,
      revenueLift,
      volumeLift,
      avgElasticity:
        segmentRows.length > 0
          ? segmentRows.reduce((sum, row) => sum + parseNumeric(row.ownElasticity, -1), 0) /
            segmentRows.length
          : 0,
    }
  }).filter((segment) => segment.rows.length > 0)

  const totalRecommendedRevenue = rows.reduce((sum, row) => sum + parseNumeric(row.optimizedRevenue, 0), 0)

  const activeSegment = segments.find((segment) => segment.key === selectedSegment) ?? segments[0] ?? null
  const detailRows = (activeSegment?.rows ?? [])
    .slice()
    .sort((a, b) => (b.baseAsp ?? b.currentAsp) - (a.baseAsp ?? a.currentAsp))

  const activeSegmentRevenueTotal = parseNumeric(activeSegment?.recRevenue, 0)

  const getRevenueContributionPct = (row) => {
    if (activeSegmentRevenueTotal <= 0) return 0
    const rowRevenue = parseNumeric(row.optimizedRevenue, 0)
    return (rowRevenue / activeSegmentRevenueTotal) * 100
  }

  const renderProductSignals = (row) => {
    const contributionPct = getRevenueContributionPct(row)
    const elasticity = parseNumeric(row.ownElasticity, -1)

    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(140px,170px)_minmax(140px,170px)] items-center gap-2">
        <p className="min-w-0 whitespace-normal break-words pr-1 text-[13px] font-semibold text-slate-800">
          {normalizeProductLabel(row.productName)}
        </p>
        <div className="rounded border border-slate-200 bg-white px-1.5 py-1">
          <div className="flex items-center justify-between text-[10px] font-semibold">
            <span className="text-slate-500">E</span>
            <span className="text-[#2563EB]">{formatElasticity(elasticity)}</span>
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-white px-1.5 py-1">
          <div className="flex items-center justify-between text-[10px] font-semibold">
            <span className="text-slate-500">Contr</span>
            <span className="text-emerald-700">{formatPct(contributionPct)}</span>
          </div>
        </div>
      </div>
    )
  }

  const handleBaseSliderChange = (row, nextValue) => {
    const value = String(Math.round(parseNumeric(nextValue, row.baseAsp)))
    onBaseInputChange?.(row.productName, value)
    onBaseCommit?.(row.productName, value)
  }

  const handleRecommendedSliderChange = (row, nextValue) => {
    const value = String(Math.round(parseNumeric(nextValue, row.optimizedAsp)))
    onRecommendedInputChange?.(row.productName, value)
    onRecommendedCommit?.(row.productName, value)
  }

  return (
    <div className="panel overflow-hidden p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{isBaseOnly ? 'Base Ladder' : 'Current vs Recommended Base Ladder'}</h3>
          {selectedScenarioName && !isBaseOnly ? (
            <p className="mt-1 text-xs font-semibold text-slate-600">Scenario: {selectedScenarioName}</p>
          ) : null}
        </div>
        {onSaveScenario ? (
          <div className="flex items-center gap-2">
            {!isBaseOnly && onResetToBaseScenario ? (
              <button
                type="button"
                onClick={onResetToBaseScenario}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset to Base Scenario
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSaveScenario}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isBaseOnly ? 'Save Base Plan' : 'Save Scenario'}
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(220px,20%)_minmax(0,80%)]">
        <div className="space-y-2">
          {segments.map((segment) => (
            <button
              key={segment.key}
              type="button"
              onClick={() => onSelectSegment?.(segment.key)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                activeSegment?.key === segment.key
                  ? 'border-slate-400 bg-slate-100 shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{segment.label}</p>
                <span className="text-[11px] font-semibold text-slate-500">{segment.rows.length} products</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                  <p className="font-semibold text-slate-500">Volume</p>
                  <p className="font-bold text-slate-800">{formatSignedPct(segment.volumeLift)}</p>
                </div>
                <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                  <p className="font-semibold text-slate-500">Revenue</p>
                  <p className="font-bold text-slate-800">{formatSignedPct(segment.revenueLift)}</p>
                </div>
              </div>
                <div className="mt-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-500">Revenue Contribution</p>
                    <p className="font-bold text-slate-800">
                      {formatPct(totalRecommendedRevenue <= 0 ? 0 : (segment.recRevenue / totalRecommendedRevenue) * 100)}
                    </p>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, totalRecommendedRevenue <= 0 ? 0 : (segment.recRevenue / totalRecommendedRevenue) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">
                    Avg elasticity: {segment.avgElasticity.toFixed(2)}
                </p>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {activeSegment?.label ?? 'Segment'}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              Slider edit only: step 50, range base +/-150.
            </p>
          </div>

          <div className="overflow-x-auto">
            {isBaseOnly ? (
              <>
                <div className="grid min-w-[1180px] grid-cols-[minmax(0,1.6fr)_140px_210px_220px_120px] gap-2 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Product</span>
                  <span className="text-right">Elasticity</span>
                  <span className="text-right">Contribution to Sales</span>
                  <span className="text-right">Base Price</span>
                  <span className="text-right">Volume change</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {detailRows.map((row) => (
                    (() => {
                      const elasticity = parseNumeric(row.ownElasticity, -1)
                      const contributionPct = getRevenueContributionPct(row)
                      return (
                        <div
                          key={row.productName}
                          className="grid min-w-[1180px] grid-cols-[minmax(0,1.6fr)_140px_210px_220px_120px] items-center gap-2 px-2 py-2.5 hover:bg-slate-50/70"
                        >
                          <div className="min-w-0 line-clamp-2 break-words text-[13px] font-semibold leading-4 text-slate-800">
                            {normalizeProductLabel(row.productName)}
                          </div>
                          <div className="text-right text-[12px] font-bold text-slate-700">{formatElasticity(elasticity)}</div>
                          <div className="text-right text-[12px] font-bold text-emerald-700">{formatPct(contributionPct)}</div>
                          <div className="w-full space-y-1">
                            <div className="text-right text-[12px] font-bold text-slate-700">
                              INR {Math.round(parseNumeric(baseInputValues?.[row.productName], row.baseAsp))}
                            </div>
                            <input
                              type="range"
                              min={getSliderBounds(row.baseAsp).min}
                              max={getSliderBounds(row.baseAsp).max}
                              step={50}
                              value={getSliderValue(baseInputValues?.[row.productName] ?? row.baseAsp, row.baseAsp)}
                              onChange={(event) => handleBaseSliderChange(row, event.target.value)}
                              className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
                              aria-label={`${row.productName} base price slider`}
                            />
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex rounded-full border px-1.5 py-0.5 text-[11px] font-bold ${volumeTone(row.volumeChangePct ?? 0)}`}
                            >
                              {formatSignedPct(row.volumeChangePct ?? 0)}
                            </span>
                          </div>
                        </div>
                      )
                    })()
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="grid min-w-[900px] grid-cols-[minmax(0,1.8fr)_104px_24px_184px_98px] gap-2 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Product</span>
                  <span className="text-right">Base Price</span>
                  <span className="text-center">&nbsp;</span>
                  <span className="text-right">Recommended</span>
                  <span className="text-right">Volume</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {detailRows.map((row) => (
                    <div
                      key={row.productName}
                      className="grid min-w-[900px] grid-cols-[minmax(0,1.8fr)_104px_24px_184px_98px] items-center gap-2 px-2 py-2.5 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0">{renderProductSignals(row)}</div>

                      <div className="text-right">
                        <span className="text-[12px] font-bold text-slate-700">{formatCurrency(row.baseAsp)}</span>
                      </div>

                      <div className="text-center text-[12px] font-bold text-slate-400">{"->"}</div>

                      <div className="w-full space-y-1">
                        <div className="text-right text-[12px] font-bold text-emerald-700">
                          INR {Math.round(parseNumeric(recommendedInputValues?.[row.productName], row.optimizedAsp))}
                        </div>
                        <input
                          type="range"
                          min={getSliderBounds(row.baseAsp).min}
                          max={getSliderBounds(row.baseAsp).max}
                          step={50}
                          value={getSliderValue(recommendedInputValues?.[row.productName] ?? row.optimizedAsp, row.baseAsp)}
                          onChange={(event) => handleRecommendedSliderChange(row, event.target.value)}
                          className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
                          aria-label={`${row.productName} recommended price slider`}
                        />
                      </div>

                      <div className="text-right">
                        <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[11px] font-bold ${volumeTone(row.volumeChangePct ?? 0)}`}>
                          {formatSignedPct(row.volumeChangePct ?? 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SegmentWorkspacePanel





