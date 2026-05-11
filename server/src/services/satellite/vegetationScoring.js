export function buildVegetationScore({
  ndvi,
  soilMoisture,
  rainChancePct,
}) {

  let score = 50;

  if (ndvi >= 0.7) score += 25;
  else if (ndvi >= 0.5) score += 15;
  else if (ndvi < 0.3) score -= 20;

  if (soilMoisture >= 0.3) score += 10;
  else if (soilMoisture < 0.1) score -= 15;

  if (rainChancePct >= 40) score += 5;

  score = Math.max(0, Math.min(100, score));

  let status = 'moderate';

  if (score >= 80) status = 'excellent';
  else if (score >= 60) status = 'healthy';
  else if (score >= 40) status = 'moderate';
  else if (score >= 20) status = 'poor';
  else status = 'critical';

  return {
    score,
    status,
  };
}