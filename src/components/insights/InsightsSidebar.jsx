import { useMemo, useState } from 'react'
import { X } from 'lucide-react'

const ACTION_CONFIG = {
  reduce: {
    label: 'Reduce Price',
    subtitle: 'High price sensitivity',
    rule: '|E| > 1.1',
    recommendation:
      'Products in this bucket are highly price sensitive. Consider reducing ASP selectively.',
    card: 'border-rose-200 bg-rose-50',
    badge: 'bg-rose-100 text-rose-700',
  },
  hold: {
    label: 'Hold Price',
    subtitle: 'Healthy pricing zone',
    rule: '0.9 <= |E| <= 1.1',
    recommendation:
      'Products in this bucket are near the target elasticity zone. Maintain current ASP.',
    card: 'border-emerald-200 bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  increase: {
    label: 'Increase Price',
    subtitle: 'Price headroom available',
    rule: '|E| < 0.9',
    recommendation:
      'Products in this bucket show price headroom. Consider testing ASP increases.',
    card: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
  },
}

const ActionCard = ({ actionKey, items, onClick }) => {
  const cfg = ACTION_CONFIG[actionKey]
  const avgElasticity = items.length
    ? items.reduce((sum, item) => sum + item.avgElasticity, 0) / items.length
    : 0
  const avgAsp = items.length
    ? items.reduce((sum, item) => sum + item.avgAsp, 0) / items.length
    : 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border px-3 py-2 text-left transition hover:brightness-[0.98] ${cfg.card}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">{cfg.label}</p>
          <p className="text-[10px] font-medium text-slate-600">{cfg.subtitle}</p>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-bold ${cfg.badge}`}>{items.length}</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 rounded-md bg-white/70 p-1.5">
        <div>
          <p className="text-[10px] font-medium text-slate-500">Avg Elasticity</p>
          <p className="text-xs font-bold text-slate-700">{items.length ? avgElasticity.toFixed(2) : '-'}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-slate-500">Avg Price</p>
          <p className="text-xs font-bold text-slate-700">{items.length ? `INR ${Math.round(avgAsp)}` : '-'}</p>
        </div>
      </div>
    </button>
  )
}

const InsightsSidebar = ({ portfolioElasticityBands }) => {
  const [activeAction, setActiveAction] = useState(null)

  const actionItems = useMemo(
    () => ({
      reduce: portfolioElasticityBands?.reduce ?? [],
      hold: portfolioElasticityBands?.hold ?? [],
      increase: portfolioElasticityBands?.increase ?? [],
    }),
    [portfolioElasticityBands],
  )

  return (
    <div className="space-y-3">
      {portfolioElasticityBands && (
        <div className="panel p-4">
          <h3 className="text-sm font-bold text-slate-800">Summary Pricing Insights</h3>

          <div className="mt-2.5 space-y-1.5">
            <ActionCard
              actionKey="reduce"
              items={actionItems.reduce}
              onClick={() => setActiveAction('reduce')}
            />
            <ActionCard
              actionKey="hold"
              items={actionItems.hold}
              onClick={() => setActiveAction('hold')}
            />
            <ActionCard
              actionKey="increase"
              items={actionItems.increase}
              onClick={() => setActiveAction('increase')}
            />
          </div>
        </div>
      )}

      {activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close details"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setActiveAction(null)}
          />

          <div className="relative z-10 max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Recommended Action: {ACTION_CONFIG[activeAction].label}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveAction(null)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">SKU</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">Avg Elasticity</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">Current Avg Price</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">Recommended Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(actionItems[activeAction] ?? [])
                    .slice()
                    .sort((a, b) => a.productName.localeCompare(b.productName))
                    .map((item) => (
                      <tr key={item.productName} className="bg-white">
                        <td className="px-3 py-2 text-slate-700">{item.productName}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-700">{item.avgElasticity.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">INR {Math.round(item.avgAsp)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">INR {Math.round(item.recommendedPrice)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InsightsSidebar
