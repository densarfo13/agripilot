export function calculateDroughtRisk({
  soilMoisture,
  rainMmNext24h,
  temperature,
}) {

  let risk = 'low';

  if (
    soilMoisture < 0.1 &&
    rainMmNext24h < 2 &&
    temperature > 32
  ) {
    risk = 'high';
  }

  else if (
    soilMoisture < 0.2 &&
    rainMmNext24h < 5
  ) {
    risk = 'moderate';
  }

  return {
    droughtRisk: risk,
    irrigationNeeded:
      risk === 'high' || risk === 'moderate',
  };
}