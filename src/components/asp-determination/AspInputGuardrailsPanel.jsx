const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const SegmentProductTable = ({ products, productConstraints, onProductConstraintChange }) => {
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[minmax(0,2fr)_84px_88px_84px_84px] gap-2 border-b border-slate-200 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Product</span>
        <span className="text-right">Base</span>
        <span className="text-center">No Change</span>
        <span className="text-right">Min</span>
        <span className="text-right">Max</span>
      </div>
      <div className="max-h-[252px] divide-y divide-slate-100 overflow-auto">
        {products.map((item) => {
          const key = item.productName
          const c = productConstraints[key] ?? {}
          const minAllowed = Math.max(1, item.basePrice - 150)
          const maxAllowed = item.basePrice + 150
          const noChange = Boolean(c.noChange)
          const minPrice = Number.isFinite(c.minPrice) ? clamp(c.minPrice, minAllowed, maxAllowed) : minAllowed
          const maxPrice = Number.isFinite(c.maxPrice) ? clamp(c.maxPrice, minAllowed, maxAllowed) : maxAllowed
          return (
            <div key={key} className="grid grid-cols-[minmax(0,2fr)_84px_88px_84px_84px] items-center gap-2 px-2 py-1.5">
              <span className="line-clamp-2 break-words text-[12px] font-medium leading-4 text-slate-800">{item.productName}</span>
              <span className="text-right text-[12px] font-semibold text-slate-700">{Math.round(item.basePrice)}</span>
              <label className="inline-flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={noChange}
                  onChange={(event) => {
                    const checked = Boolean(event.target.checked)
                    onProductConstraintChange?.(key, {
                      noChange: checked,
                      minPrice: checked ? item.basePrice : Math.max(1, item.basePrice - 150),
                      maxPrice: checked ? item.basePrice : item.basePrice + 150,
                    })
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                />
              </label>
              <input
                type="number"
                value={Math.round(noChange ? item.basePrice : minPrice)}
                min={Math.round(minAllowed)}
                max={Math.round(maxAllowed)}
                step={1}
                disabled={noChange}
                onChange={(event) =>
                  onProductConstraintChange?.(key, {
                    noChange: false,
                    minPrice: Number(event.target.value),
                    maxPrice,
                  })
                }
                className="w-full rounded border border-slate-300 px-1.5 py-1 text-right text-[12px] font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <input
                type="number"
                value={Math.round(noChange ? item.basePrice : maxPrice)}
                min={Math.round(minAllowed)}
                max={Math.round(maxAllowed)}
                step={1}
                disabled={noChange}
                onChange={(event) =>
                  onProductConstraintChange?.(key, {
                    noChange: false,
                    minPrice,
                    maxPrice: Number(event.target.value),
                  })
                }
                className="w-full rounded border border-slate-300 px-1.5 py-1 text-right text-[12px] font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const SegmentColumn = ({
  title,
  noChange,
  onNoChangeChange,
  maxDecrease,
  maxIncrease,
  onRangeChange,
  products,
  productConstraints,
  onProductConstraintChange,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="text-[11px] font-medium text-slate-500">{products.length} products</p>
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(noChange)}
            onChange={(event) => onNoChangeChange?.(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
          />
          No Change
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Max Decrease (INR)</p>
          <input
            type="number"
            value={Math.round(maxDecrease)}
            min={0}
            max={150}
            step={1}
            disabled={Boolean(noChange)}
            onChange={(event) => onRangeChange({ maxDecrease: clamp(Number(event.target.value) || 0, 0, 150), maxIncrease })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Max Increase (INR)</p>
          <input
            type="number"
            value={Math.round(maxIncrease)}
            min={0}
            max={150}
            step={1}
            disabled={Boolean(noChange)}
            onChange={(event) => onRangeChange({ maxDecrease, maxIncrease: clamp(Number(event.target.value) || 0, 0, 150) })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </div>
      </div>

      <details className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
        <summary className="cursor-pointer text-xs font-semibold text-slate-700">
          SKU-level override (optional)
        </summary>
        <SegmentProductTable
          products={products}
          productConstraints={productConstraints}
          onProductConstraintChange={onProductConstraintChange}
        />
      </details>
    </div>
  )
}

const AspInputGuardrailsPanel = ({
  controls,
  onControlsChange,
  products = [],
  productConstraints = {},
  onProductConstraintChange,
  onResetProductConstraints,
}) => {
  const dailyProducts = products.filter((item) => item.segmentKey === 'daily')
  const coreProducts = products.filter((item) => item.segmentKey === 'core')
  const premiumProducts = products.filter((item) => item.segmentKey === 'premium')

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">Input Controls</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Set segment limits first, then optional SKU overrides.</p>
        </div>
        <button
          type="button"
          onClick={onResetProductConstraints}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reset Product Bounds
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <SegmentColumn
          title="Daily Casual"
          noChange={Boolean(controls.dailyNoChange)}
          onNoChangeChange={(value) => onControlsChange({ dailyNoChange: value })}
          maxDecrease={controls.dailyMaxDecrease}
          maxIncrease={controls.dailyMaxIncrease}
          onRangeChange={({ maxDecrease, maxIncrease }) => onControlsChange({ dailyMaxDecrease: maxDecrease, dailyMaxIncrease: maxIncrease })}
          products={dailyProducts}
          productConstraints={productConstraints}
          onProductConstraintChange={onProductConstraintChange}
        />

        <SegmentColumn
          title="Core Plus"
          noChange={Boolean(controls.coreNoChange)}
          onNoChangeChange={(value) => onControlsChange({ coreNoChange: value })}
          maxDecrease={controls.coreMaxDecrease}
          maxIncrease={controls.coreMaxIncrease}
          onRangeChange={({ maxDecrease, maxIncrease }) => onControlsChange({ coreMaxDecrease: maxDecrease, coreMaxIncrease: maxIncrease })}
          products={coreProducts}
          productConstraints={productConstraints}
          onProductConstraintChange={onProductConstraintChange}
        />

        <SegmentColumn
          title="Premium"
          noChange={Boolean(controls.premiumNoChange)}
          onNoChangeChange={(value) => onControlsChange({ premiumNoChange: value })}
          maxDecrease={controls.premiumMaxDecrease}
          maxIncrease={controls.premiumMaxIncrease}
          onRangeChange={({ maxDecrease, maxIncrease }) => onControlsChange({ premiumMaxDecrease: maxDecrease, premiumMaxIncrease: maxIncrease })}
          products={premiumProducts}
          productConstraints={productConstraints}
          onProductConstraintChange={onProductConstraintChange}
        />
      </div>
    </div>
  )
}

export default AspInputGuardrailsPanel
