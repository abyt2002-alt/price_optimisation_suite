const parseApiError = async (response) => {
  try {
    const payload = await response.json()
    if (payload?.detail) {
      return payload.detail
    }
  } catch {
    // ignore and fallback
  }
  return `Optimization request failed (${response.status})`
}

const withNetworkHint = async (requestFn) => {
  try {
    return await requestFn()
  } catch (error) {
    const message = String(error?.message || '')
    const isNetworkIssue =
      message.toLowerCase().includes('failed to fetch') ||
      message.toLowerCase().includes('networkerror') ||
      message.toLowerCase().includes('network request failed')
    if (isNetworkIssue) {
      throw new Error(
        'Backend API is unreachable. Start backend on http://127.0.0.1:8011 and retry.',
      )
    }
    throw error
  }
}

export const optimizeAspLadder = async (requestPayload) => {
  const response = await withNetworkHint(() =>
    fetch('/api/asp-determination/optimize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    }),
  )

  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  return response.json()
}

export const createAspOptimizationJob = async (requestPayload) => {
  const response = await withNetworkHint(() =>
    fetch('/api/asp-determination/optimize-jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    }),
  )

  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  return response.json()
}

export const getAspOptimizationJobStatus = async (jobId) => {
  const response = await withNetworkHint(() =>
    fetch(`/api/asp-determination/optimize-jobs/${encodeURIComponent(jobId)}/status`),
  )
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
  return response.json()
}

export const getAspOptimizationJobResult = async (jobId) => {
  const response = await withNetworkHint(() =>
    fetch(`/api/asp-determination/optimize-jobs/${encodeURIComponent(jobId)}/result`),
  )
  if (response.status === 404) {
    const notReadyError = new Error('Optimization result is not ready yet.')
    notReadyError.code = 'JOB_RESULT_NOT_READY'
    throw notReadyError
  }
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
  return response.json()
}

export const runAspOptimizationJob = async (requestPayload, { onProgress, pollMs = 1000, timeoutMs = 180000 } = {}) => {
  const runJobPolling = async () => {
    const created = await createAspOptimizationJob(requestPayload)
    const jobId = created?.job_id
    if (!jobId) {
      throw new Error('Failed to create optimization job.')
    }

    const startedAt = Date.now()
    let lastKnownStage = 'Queued'
    let transientStatusErrors = 0
    let resultNotReadyCount = 0

    while (Date.now() - startedAt <= timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, pollMs))

      let status
      try {
        status = await getAspOptimizationJobStatus(jobId)
        transientStatusErrors = 0
      } catch (statusError) {
        transientStatusErrors += 1
        if (transientStatusErrors >= 4) {
          throw statusError
        }
        if (onProgress) {
          onProgress({
            status: 'running',
            progress_pct: 0,
            stage: 'Reconnecting to optimization job...',
          })
        }
        continue
      }

      lastKnownStage = status?.stage || lastKnownStage
      if (onProgress) {
        onProgress(status)
      }

      if (status?.status === 'completed') {
        let resultPayload
        try {
          resultPayload = await getAspOptimizationJobResult(jobId)
        } catch (resultError) {
          if (resultError?.code === 'JOB_RESULT_NOT_READY' && resultNotReadyCount < 8) {
            resultNotReadyCount += 1
            if (onProgress) {
              onProgress({
                status: 'running',
                progress_pct: 99,
                stage: 'Finalizing optimization output...',
              })
            }
            continue
          }
          throw resultError
        }
        if (!resultPayload?.result) {
          throw new Error('Optimization completed but result payload is empty.')
        }
        return resultPayload.result
      }

      if (status?.status === 'failed') {
        throw new Error(status?.error || 'Optimization job failed.')
      }
    }

    throw new Error(`Optimization job timed out at stage: ${lastKnownStage}.`)
  }

  try {
    return await runJobPolling()
  } catch (jobError) {
    if (onProgress) {
      onProgress({
        status: 'running',
        progress_pct: 95,
        stage: 'Retrying in direct mode...',
      })
    }
    try {
      return await optimizeAspLadder(requestPayload)
    } catch (fallbackError) {
      const primaryMessage = jobError?.message || 'Optimization job failed.'
      const fallbackMessage = fallbackError?.message || 'Direct optimization failed.'
      throw new Error(`${primaryMessage} ${fallbackMessage}`)
    }
  }
}
