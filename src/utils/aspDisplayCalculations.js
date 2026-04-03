const hashToInt = (text) => {
  let hash = 0
  const value = String(text ?? '')
  for (let idx = 0; idx < value.length; idx += 1) {
    hash = (hash * 33 + value.charCodeAt(idx)) >>> 0
  }
  return hash
}

const CROSS_EFFECT_STRENGTH = 0.5

const getSegmentKey = (basePrice) => {
  if (basePrice <= 599) return 'daily'
  if (basePrice <= 899) return 'core'
  return 'premium'
}

const getSegmentLabel = (basePrice) => {
  if (basePrice <= 599) return 'Daily Casual'
  if (basePrice <= 899) return 'Core Plus'
  return 'Premium'
}

export const computeDriftPct = (productName, yearMonth) => {
  const normalized = hashToInt(`${productName}|${yearMonth}`) % 701
  const fullStrengthDriftPct = -0.03 + normalized / 10000
  return fullStrengthDriftPct * 0.5
}

export const buildDisplayRows = ({
  rows,
  selectedMonth,
  basePriceEditMap = {},
  recommendedPriceEditMap = {},
  modelContext = {},
}) => {
  const rowList = rows ?? []
  const n = rowList.length
  if (!n) return []

  const hasMatrixShape = (matrix) =>
    Array.isArray(matrix) && matrix.length === n && matrix.every((entry) => Array.isArray(entry) && entry.length === n)
  const safeNumber = (value, fallback) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const refBasePrices =
    Array.isArray(modelContext?.basePrices) && modelContext.basePrices.length === n
      ? modelContext.basePrices.map((value) => Math.max(1, Number(value) || 1))
      : rowList.map((item) => Math.max(1, Number(item.baseAsp ?? item.currentAsp ?? 1)))
  const refBaseVolumes =
    Array.isArray(modelContext?.baseVolumes) && modelContext.baseVolumes.length === n
      ? modelContext.baseVolumes.map((value) => Math.max(1, Number(value) || 1))
      : rowList.map((item) => Math.max(1, Number(item.currentVolume ?? 1)))
  const ownElasticities =
    Array.isArray(modelContext?.ownElasticities) && modelContext.ownElasticities.length === n
      ? modelContext.ownElasticities.map((value) => Number(value))
      : rowList.map(() => -1.1)
  const staticGammaMatrix = hasMatrixShape(modelContext?.gammaMatrix)
    ? modelContext.gammaMatrix.map((rowGamma) => rowGamma.map((value) => Number(value) || 0))
    : Array.from({ length: n }, () => Array.from({ length: n }, () => 0))
  const crossMatrix = hasMatrixShape(modelContext?.crossMatrix)
    ? modelContext.crossMatrix.map((rowCross) => rowCross.map((value) => Number(value) || 0))
    : null
  const referenceCurrentPrices = rowList.map((row, idx) =>
    Math.max(1, safeNumber(row.currentAsp, safeNumber(row.baseAsp, refBasePrices[idx]))),
  )
  const referenceCurrentVolumes = rowList.map((row, idx) =>
    Math.max(1, safeNumber(row.currentVolume, refBaseVolumes[idx])),
  )
  const referenceScenarioPrices = rowList.map((row, idx) =>
    Math.max(1, safeNumber(row.optimizedAsp, referenceCurrentPrices[idx])),
  )
  const referenceScenarioVolumes = rowList.map((row, idx) =>
    Math.max(1, safeNumber(row.optimizedVolume, referenceCurrentVolumes[idx])),
  )
  const betaPpu = referenceScenarioVolumes.map((referenceVolume, idx) => {
    const price = Math.max(1, referenceScenarioPrices[idx])
    const ownElasticity = Number.isFinite(ownElasticities[idx]) ? ownElasticities[idx] : -1.1
    return ownElasticity * (referenceVolume / price)
  })
  const gammaMatrix = crossMatrix
    ? crossMatrix.map((rowCross, i) =>
        rowCross.map((crossElasticity, j) => {
          if (i === j) return 0
          return crossElasticity * (referenceScenarioVolumes[i] / Math.max(1, referenceScenarioPrices[j]))
        }),
      )
    : staticGammaMatrix

  const optimizedPrices = rowList.map((row, idx) => {
    const basePrice = Math.max(1, referenceScenarioPrices[idx] ?? refBasePrices[idx] ?? 1)
    const editedBaseAspRaw = basePriceEditMap[row.productName]
    const editedRecommendedRaw = recommendedPriceEditMap[row.productName]
    const scenarioOptimizedAsp = Number(referenceScenarioPrices[idx] ?? row.optimizedAsp ?? row.currentAsp ?? basePrice)
    return Number.isFinite(Number(editedRecommendedRaw)) && Number(editedRecommendedRaw) > 0
      ? Number(editedRecommendedRaw)
      : Number.isFinite(Number(editedBaseAspRaw)) && Number(editedBaseAspRaw) > 0
        ? Number(editedBaseAspRaw)
        : scenarioOptimizedAsp
  })
  const deltas = optimizedPrices.map((price, idx) => Number(price) - referenceScenarioPrices[idx])
  const ownTerms = deltas.map((delta, idx) => (betaPpu[idx] ?? 0) * delta)
  const crossTerms = deltas.map((_, idx) => {
    let cross = 0
    for (let j = 0; j < n; j += 1) {
      if (j === idx) continue
      cross -= (gammaMatrix[idx]?.[j] ?? 0) * deltas[j] * CROSS_EFFECT_STRENGTH
    }
    return cross
  })

  return rowList.map((row, idx) => {
    const driftPct = computeDriftPct(row.productName, selectedMonth)
    const driftFactor = 1 + driftPct
    const originalBaseAsp = Math.max(1, Number(refBasePrices[idx] ?? row.baseAsp ?? row.currentAsp ?? 1))
    const ownElasticity = Number.isFinite(ownElasticities[idx]) ? ownElasticities[idx] : -1.1
    const optimizedAsp = optimizedPrices[idx]
    const currentAsp = referenceCurrentPrices[idx]
    const currentVolume = referenceCurrentVolumes[idx]
    const ownDeltaVolumeBase = ownTerms[idx] ?? 0
    const crossDeltaVolumeBase = crossTerms[idx] ?? 0
    const optimizedVolumeBase = Math.max(
      1,
      referenceScenarioVolumes[idx] + ownDeltaVolumeBase + crossDeltaVolumeBase,
    )
    const optimizedVolume = Math.max(1, optimizedVolumeBase * driftFactor)
    const unitCost = originalBaseAsp * 0.4
    const currentRevenue = currentAsp * currentVolume
    const optimizedRevenue = optimizedAsp * optimizedVolume
    const currentProfit = (currentAsp - unitCost) * currentVolume
    const optimizedProfit = (optimizedAsp - unitCost) * optimizedVolume
    const basePriceChange = optimizedAsp - currentAsp

    return {
      ...row,
      segmentKey: row.segmentKey ?? getSegmentKey(originalBaseAsp),
      segmentLabel: row.segmentLabel ?? getSegmentLabel(originalBaseAsp),
      baseAsp: originalBaseAsp,
      currentAsp,
      optimizedAsp,
      currentVolume,
      optimizedVolume,
      currentRevenue,
      optimizedRevenue,
      currentProfit,
      optimizedProfit,
      aspChange: basePriceChange,
      aspChangePct: currentAsp === 0 ? 0 : basePriceChange / currentAsp,
      basePriceChange,
      basePriceChangePct: currentAsp === 0 ? 0 : basePriceChange / currentAsp,
      volumeChangePct: currentVolume === 0 ? 0 : (optimizedVolume - currentVolume) / currentVolume,
      revenueChangePct: currentRevenue === 0 ? 0 : (optimizedRevenue - currentRevenue) / currentRevenue,
      profitChangePct: currentProfit === 0 ? 0 : (optimizedProfit - currentProfit) / currentProfit,
      ownElasticity,
      ownVolumeDelta: ownDeltaVolumeBase * driftFactor,
      crossVolumeDelta: crossDeltaVolumeBase * driftFactor,
      baselineDriftPct: driftPct,
    }
  })
}
