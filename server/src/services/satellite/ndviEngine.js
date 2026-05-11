export function calculateAverageNDVI(ndviArray = []) {
  if (!Array.isArray(ndviArray)) return null;

  const valid = ndviArray.filter(v => Number.isFinite(v));

  if (!valid.length) return null;

  const total = valid.reduce((sum, v) => sum + v, 0);

  return total / valid.length;
}

export function classifyNDVI(ndvi) {
  if (ndvi == null) {
    return 'unknown';
  }

  if (ndvi < 0.2) {
    return 'critical';
  }

  if (ndvi < 0.4) {
    return 'poor';
  }

  if (ndvi < 0.6) {
    return 'moderate';
  }

  if (ndvi < 0.8) {
    return 'healthy';
  }

  return 'excellent';
}