import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const ComparisonTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0].payload

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-sm font-semibold text-slate-800">{point.productName}</p>
      <p className="text-xs text-slate-600">Base ASP: {point.baseAsp.toFixed(1)}</p>
      <p className="text-xs text-slate-600">Optimized ASP: {point.optimizedAsp.toFixed(1)}</p>
      <p className="text-xs text-slate-600">Change: {point.basePriceChange >= 0 ? '+' : ''}{point.basePriceChange.toFixed(1)}</p>
    </div>
  )
}

const LadderComparisonChart = ({ rows }) => {
  const ladderRows = [...rows].sort(
    (a, b) => (a.baseAsp ?? a.currentAsp) - (b.baseAsp ?? b.currentAsp) || a.productName.localeCompare(b.productName),
  )

  return (
    <div className="panel p-4">
      <h3 className="text-lg font-bold text-slate-800">ASP Ladder View</h3>
      <p className="mt-1 text-xs text-slate-500">Base-to-optimized stair-step ladder by product.</p>
      <div className="mt-3 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={ladderRows} margin={{ top: 20, right: 16, left: 4, bottom: 12 }}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
            <XAxis dataKey="productName" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={66} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<ComparisonTooltip />} />
            <Line type="stepAfter" dataKey="baseAsp" stroke="#458EE2" strokeWidth={2.5} dot={{ r: 4 }} name="Base ASP" />
            <Line type="stepAfter" dataKey="optimizedAsp" stroke="#41C185" strokeWidth={3} dot={{ r: 5 }} name="Optimized ASP" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default LadderComparisonChart
