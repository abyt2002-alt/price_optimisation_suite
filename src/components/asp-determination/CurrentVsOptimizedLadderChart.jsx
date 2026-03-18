import { ArrowLeft, ArrowRight, Minus } from 'lucide-react'

const formatCurrency = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`

const formatSignedCurrency = (value) => {
  const rounded = Math.round(value)
  if (rounded > 0) return `+₹${Math.abs(rounded).toLocaleString('en-IN')}`
  if (rounded < 0) return `-₹${Math.abs(rounded).toLocaleString('en-IN')}`
  return '₹0'
}

const formatSignedPct = (value) => {
  const pct = value * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

const changeTone = (value) => {
  if (value > 0.001) {
    return {
      text: 'text-emerald-700',
      chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      line: 'bg-emerald-500',
      Arrow: ArrowRight,
    }
  }
  if (value < -0.001) {
    return {
      text: 'text-rose-700',
      chip: 'border-rose-200 bg-rose-50 text-rose-700',
      line: 'bg-rose-500',
      Arrow: ArrowLeft,
    }
  }
  return {
    text: 'text-slate-600',
    chip: 'border-slate-200 bg-slate-50 text-slate-600',
    line: 'bg-slate-400',
    Arrow: Minus,
  }
}

const volumeTone = (value) => {
  if (value > 0.001) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value < -0.001) return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

const HEADER_GRID_CLASS =
  'grid grid-cols-[minmax(0,2.4fr)_80px_minmax(100px,1.2fr)_82px_90px] gap-2'

const ROW_GRID_CLASS =
  'grid grid-cols-[minmax(0,2.4fr)_80px_minmax(100px,1.2fr)_82px_90px] items-center gap-2'

const LadderRowsBlock = ({ rows, label }) => {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((row) => {
          const baseChange = row.basePriceChange ?? row.aspChange
          const baseChangePct = row.basePriceChangePct ?? row.aspChangePct
          const aspTone = changeTone(baseChange)
          const volumeChipClass = volumeTone(row.volumeChangePct)
          const ArrowIcon = aspTone.Arrow

          const hoverText = [
            row.productName,
            `Base ASP: ${formatCurrency(row.baseAsp ?? row.currentAsp)}`,
            `Current ASP: ${formatCurrency(row.currentAsp)}`,
            `Optimized ASP: ${formatCurrency(row.optimizedAsp)}`,
            `Change vs Base: ${formatSignedCurrency(baseChange)} (${formatSignedPct(baseChangePct)})`,
            `Current Volume: ${Math.round(row.currentVolume).toLocaleString('en-IN')}`,
            `Optimized Volume: ${Math.round(row.optimizedVolume).toLocaleString('en-IN')}`,
            `Revenue Change: ${formatSignedPct(row.revenueChangePct)}`,
            `Profit Change: ${formatSignedPct(row.profitChangePct)}`,
          ].join('\n')

          return (
            <div key={row.productName} title={hoverText} className={`${ROW_GRID_CLASS} px-2 py-2.5 hover:bg-slate-50/70`}>
              <div className="min-w-0 pr-1">
                <p className="text-[13px] font-semibold leading-4 text-slate-800 whitespace-normal break-words">
                  {row.productName}
                </p>
              </div>

              <div className="relative border-l-2 border-slate-300 pl-1 text-right">
                <span className="text-[13px] font-semibold text-slate-700">
                  {formatCurrency(row.baseAsp ?? row.currentAsp)}
                </span>
              </div>

              <div className="px-1">
                <div className="flex items-center gap-1.5">
                  <div className={`h-[2px] flex-1 rounded-full ${aspTone.line}`} />
                  <ArrowIcon className={`h-3.5 w-3.5 ${aspTone.text}`} />
                  <div className={`h-[2px] flex-1 rounded-full ${aspTone.line}`} />
                </div>
                <div className="mt-1 flex justify-center">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${aspTone.chip}`}>
                    {formatSignedCurrency(baseChange)}
                  </span>
                </div>
              </div>

              <div className="relative border-l-2 border-emerald-300 pl-1 text-right">
                <span className="text-[13px] font-bold text-emerald-700">{formatCurrency(row.optimizedAsp)}</span>
              </div>

              <div className="text-right">
                <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[11px] font-bold ${volumeChipClass}`}>
                  Vol: {formatSignedPct(row.volumeChangePct)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const CurrentVsOptimizedLadderChart = ({ rows = [] }) => {
  const sortedRows = [...rows].sort(
    (a, b) => (b.baseAsp ?? b.currentAsp) - (a.baseAsp ?? a.currentAsp) || a.productName.localeCompare(b.productName),
  )
  const splitIndex = Math.ceil(sortedRows.length / 2)
  const firstHalf = sortedRows.slice(0, splitIndex)
  const secondHalf = sortedRows.slice(splitIndex)

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-lg font-bold text-slate-800">Current vs Optimized ASP Ladder</h3>
        <p className="mt-1 text-xs text-slate-500">
          See how the optimizer shifts each product ASP and expected volume.
        </p>
      </div>

      <div className="p-3">
        <div className={`${HEADER_GRID_CLASS} px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500`}>
          <span>Product</span>
          <span className="text-right text-slate-700">Base</span>
          <span className="text-center">Movement (vs Base)</span>
          <span className="text-right text-emerald-700">Optimized</span>
          <span className="text-right">Volume Impact</span>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <LadderRowsBlock rows={firstHalf} label={`Ladder Group 1 (${firstHalf.length})`} />
          {secondHalf.length > 0 && (
            <LadderRowsBlock rows={secondHalf} label={`Ladder Group 2 (${secondHalf.length})`} />
          )}
        </div>
      </div>
    </div>
  )
}

export default CurrentVsOptimizedLadderChart
