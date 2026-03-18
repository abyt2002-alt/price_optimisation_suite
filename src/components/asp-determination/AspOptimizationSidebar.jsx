import { Loader2, Play, RotateCcw } from 'lucide-react'

const SelectControl = ({ label, value, options, onChange }) => {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand.blue focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

const SliderControl = ({ label, value, min, max, step, suffix = '', onChange }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
        <span className="text-xs font-semibold text-slate-700">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-brand.blue"
      />
    </div>
  )
}

const NumberControl = ({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '%' }) => {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value)
            onChange(Number.isFinite(next) ? next : 0)
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm text-slate-700 focus:border-brand.blue focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
          {suffix}
        </span>
      </div>
    </div>
  )
}

const AspOptimizationSidebar = ({
  controls,
  onControlsChange,
  onRun,
  onReset,
  isRunning = false,
}) => {
  const showRevenueDropConstraint = controls.objective === 'profit' || controls.objective === 'volume'
  const showProfitDropConstraint = controls.objective === 'revenue' || controls.objective === 'volume'

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h3 className="text-base font-bold text-slate-800">Optimization Controls</h3>

        <div className="mt-4 space-y-3">
          <SelectControl
            label="Optimization Objective"
            value={controls.objective}
            options={[
              { value: 'revenue', label: 'Maximize Revenue' },
              { value: 'profit', label: 'Maximize Profit' },
              { value: 'volume', label: 'Maximize Volume' },
            ]}
            onChange={(value) => onControlsChange({ objective: value })}
          />

          <SliderControl
            label="Max Price Change From Base (%)"
            value={controls.maxAspChangePct}
            min={4}
            max={25}
            step={1}
            suffix="%"
            onChange={(value) => onControlsChange({ maxAspChangePct: value })}
          />

          <SliderControl
            label="Minimum Volume Retention (%)"
            value={controls.minimumVolumeRetentionPct}
            min={50}
            max={100}
            step={1}
            suffix="%"
            onChange={(value) => onControlsChange({ minimumVolumeRetentionPct: value })}
          />
          <p className="-mt-1 text-[11px] font-medium text-slate-500">
            Applies to all products in the portfolio.
          </p>

          {showRevenueDropConstraint && (
            <div className="space-y-1">
              <NumberControl
                label="Minimum Revenue Drop From Current"
                value={controls.minimumRevenueDropPct}
                min={0}
                max={100}
                step={1}
                onChange={(value) =>
                  onControlsChange({ minimumRevenueDropPct: Math.max(0, Math.min(100, value)) })
                }
              />
              <p className="text-[11px] font-medium text-slate-500">Allowed portfolio revenue decrease limit.</p>
            </div>
          )}

          {showProfitDropConstraint && (
            <div className="space-y-1">
              <NumberControl
                label="Minimum Profit Drop From Current"
                value={controls.minimumProfitDropPct}
                min={0}
                max={100}
                step={1}
                onChange={(value) =>
                  onControlsChange({ minimumProfitDropPct: Math.max(0, Math.min(100, value)) })
                }
              />
              <p className="text-[11px] font-medium text-slate-500">Allowed portfolio profit decrease limit.</p>
            </div>
          )}

          <div className="sticky bottom-0 -mx-4 mt-2 border-t border-slate-200 bg-white px-4 pb-1 pt-3">
            <button
              type="button"
              onClick={onRun}
              disabled={isRunning}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-700 bg-[#458EE2] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3D7FD0] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isRunning ? 'Optimizing...' : 'Run Optimization'}
            </button>

            <button
              type="button"
              onClick={onReset}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Controls
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AspOptimizationSidebar
