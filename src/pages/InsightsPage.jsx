import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import CrossElasticityMatrix from '../components/insights/CrossElasticityMatrix'
import DemandCurveChart from '../components/insights/DemandCurveChart'
import ElasticitySummaryCards from '../components/insights/ElasticitySummaryCards'
import InsightsSidebar from '../components/insights/InsightsSidebar'
import RevenueCurveChart from '../components/insights/RevenueCurveChart'
import AppLayout from '../components/layout/AppLayout'
import {
  buildPortfolioElasticityBands,
  buildInsightsPayload,
  getProductOptions,
} from '../utils/insightsUtils'

const InsightsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const productOptions = useMemo(() => getProductOptions(), [])
  const productParam = searchParams.get('iProduct')
  const selectedProduct = productOptions.includes(productParam) ? productParam : productOptions[0]
  const crossProductParam = searchParams.get('iCrossProduct')
  const selectedCrossProduct = productOptions.includes(crossProductParam)
    ? crossProductParam
    : selectedProduct

  const curveRange = 'standard'
  const sensitivity = 'base'

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let dirty = false

    if (next.get('step') !== '2') {
      next.set('step', '2')
      dirty = true
    }

    if (next.has('iMonth')) {
      next.delete('iMonth')
      dirty = true
    }

    if (!next.get('iProduct') && productOptions[0]) {
      next.set('iProduct', productOptions[0])
      dirty = true
    }

    const nextCrossProduct = next.get('iCrossProduct')
    if (!nextCrossProduct || !productOptions.includes(nextCrossProduct)) {
      if (productOptions[0]) {
        next.set('iCrossProduct', productOptions[0])
      } else {
        next.delete('iCrossProduct')
      }
      dirty = true
    }

    if (dirty) {
      setSearchParams(next, { replace: true })
    }
  }, [productOptions, searchParams, setSearchParams])

  const setParams = (patch) => {
    const next = new URLSearchParams(searchParams)

    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        next.delete(key)
      } else {
        next.set(key, String(value))
      }
    })

    next.set('step', '2')
    setSearchParams(next)
  }

  const payload = useMemo(
    () =>
      buildInsightsPayload({
        productName: selectedProduct,
        curveRange,
        sensitivity,
      }),
    [selectedProduct, curveRange, sensitivity],
  )

  const portfolioElasticityBands = useMemo(
    () => buildPortfolioElasticityBands(payload.monthRows, sensitivity),
    [payload.monthRows, sensitivity],
  )

  const rightSidebar = <InsightsSidebar portfolioElasticityBands={portfolioElasticityBands} />

  return (
    <AppLayout rightSidebar={rightSidebar}>
      <div className="space-y-5">
        <div className="panel p-5">
          <h2 className="text-3xl font-bold text-slate-800">Pricing strategy review</h2>
          <p className="mt-2 max-w-4xl text-sm font-medium text-slate-600">
            Select an SKU to review
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Season: Winter 2025
          </p>
        </div>

        <div className="panel p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">SKU</label>
              <select
                value={selectedProduct}
                onChange={(event) => setParams({ iProduct: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand.blue focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {productOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <ElasticitySummaryCards
          anchorRow={payload.anchorRow}
          ownElasticity={payload.ownElasticity}
          currentPointElasticity={payload.currentPointElasticity}
          revenueCurrent={payload.revenueCurve.currentPoint.revenue}
          revenueMax={payload.revenueCurve.maxRevenuePoint.revenue}
          revenueMaxPrice={payload.revenueCurve.maxRevenuePoint.price}
          volumeAtRevenueMax={payload.revenueCurve.maxRevenuePoint.predictedDemand}
        />

        <div className="grid grid-cols-1 items-stretch gap-5 2xl:grid-cols-2">
          <DemandCurveChart
            points={payload.demandCurve}
            currentPoint={payload.revenueCurve.currentPoint}
            maxRevenuePrice={payload.revenueCurve.maxRevenuePoint.price}
            visible
          />

          <RevenueCurveChart
            points={payload.revenueCurve.points}
            currentPoint={payload.revenueCurve.currentPoint}
            maxPoint={payload.revenueCurve.maxRevenuePoint}
            visible
          />
        </div>

        <CrossElasticityMatrix
          matrix={payload.matrix}
          selectedProduct={selectedCrossProduct}
          productOptions={productOptions}
          onSelectedProductChange={(value) => setParams({ iCrossProduct: value })}
          visible
        />
      </div>
    </AppLayout>
  )
}

export default InsightsPage
