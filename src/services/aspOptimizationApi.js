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

export const optimizeAspLadder = async (requestPayload) => {
  const response = await fetch('/api/asp-determination/optimize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestPayload),
  })

  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  return response.json()
}

