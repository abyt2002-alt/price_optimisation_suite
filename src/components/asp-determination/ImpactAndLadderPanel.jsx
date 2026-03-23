import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const SEGMENT_COLORS = {
  daily: '#1D4ED8',
  core: '#EA580C',
  premium: '#16A34A',
}

const formatInt = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(value))
const formatCurrency = (value) => `INR ${formatInt(value)}`
const formatSignedPct = (value) => {
  const pct = Number(value) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

const MetricBarCard = ({ label, baseValue, newValue, isCurrency = false }) => {
  const deltaPct = baseValue === 0 ? 0 : (newValue - baseValue) / baseValue
  const isPositive = deltaPct >= 0
  const width = Math.min(100, Math.abs(deltaPct * 100))
  const fromText = isCurrency ? formatCurrency(baseValue) : formatInt(baseValue)
  const toText = isCurrency ? formatCurrency(newValue) : formatInt(newValue)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className={`text-2xl font-extrabold leading-none ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
          {formatSignedPct(deltaPct)}
        </p>
        <p className="text-[11px] font-semibold text-slate-600">
          {fromText} -&gt; {toText}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

const LadderTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
      <p className="text-xs font-semibold text-slate-800">{point.productName}</p>
      <p className="text-[11px] text-slate-600">Base: {formatCurrency(point.baseAsp)}</p>
      <p className="text-[11px] text-slate-600">Adjusted: {formatCurrency(point.optimizedAsp)}</p>
    </div>
  )
}

const renderSegmentDot = (props) => {
  const { cx, cy, payload } = props
  if (cx === undefined || cy === undefined || !payload) return null
  const color = SEGMENT_COLORS[payload.segmentKey] ?? '#64748B'
  return <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#ffffff" strokeWidth={1.6} />
}

const ImpactAndLadderPanel = ({ rows = [], onOpenLadderModal, sticky = false }) => {
  const baseVolume = rows.reduce((sum, row) => sum + (row.currentVolume ?? 0), 0)
  const newVolume = rows.reduce((sum, row) => sum + (row.optimizedVolume ?? 0), 0)
  const baseRevenue = rows.reduce((sum, row) => sum + (row.currentRevenue ?? 0), 0)
  const newRevenue = rows.reduce((sum, row) => sum + (row.optimizedRevenue ?? 0), 0)
  const baseProfit = rows.reduce((sum, row) => sum + (row.currentProfit ?? 0), 0)
  const newProfit = rows.reduce((sum, row) => sum + (row.optimizedProfit ?? 0), 0)

  const ladderRows = rows
    .slice()
    .sort(
      (a, b) =>
        (a.baseAsp ?? a.currentAsp) - (b.baseAsp ?? b.currentAsp) || a.productName.localeCompare(b.productName),
    )

  const stickyMetricsClass = sticky
    ? 'sticky top-2 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 pb-4 pt-0 backdrop-blur supports-[backdrop-filter]:bg-white/80'
    : ''

  return (
    <div className="panel p-4">
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-bold text-slate-800">Current Price Ladder and Projected Business Impact</h3>
        <div className={`space-y-3 ${stickyMetricsClass}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricBarCard label="Volume" baseValue={baseVolume} newValue={newVolume} />
            <MetricBarCard label="Revenue" baseValue={baseRevenue} newValue={newRevenue} isCurrency />
            <MetricBarCard label="Profit" baseValue={baseProfit} newValue={newProfit} isCurrency />
          </div>
          <p className="text-[10px] font-medium leading-snug text-slate-500">
            Projections reflect both a baseline forecast and the impact of price adjustments. Growth rates are Y-o-Y
            comparison with the same season.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">Brand Price Ladder</p>
            <button
              type="button"
              onClick={onOpenLadderModal}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Expand
            </button>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-0 w-6 border-t-[3px] border-[#475569]" style={{ borderTopStyle: 'dashed' }} />
              Base Ladder
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-0 w-6 border-t-[3px] border-[#0F766E]" />
              Adjusted Ladder
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#1D4ED8]" />
              Daily Casual
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#EA580C]" />
              Core Plus
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
              Premium
            </span>
          </div>
          <div className="h-[250px] cursor-pointer" onClick={onOpenLadderModal}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={ladderRows} margin={{ top: 8, right: 8, left: 0, bottom: 18 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey="productName" tick={{ fontSize: 9 }} interval={0} angle={-18} textAnchor="end" height={68} />
                <YAxis tick={{ fontSize: 10, fontWeight: 600 }} />
                <Tooltip content={<LadderTooltip />} />
                <Line
                  type="stepAfter"
                  dataKey="baseAsp"
                  stroke="#475569"
                  strokeWidth={2.8}
                  strokeDasharray="5 4"
                  dot={renderSegmentDot}
                />
                <Line type="stepAfter" dataKey="optimizedAsp" stroke="#0F766E" strokeWidth={3} dot={renderSegmentDot} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImpactAndLadderPanel
