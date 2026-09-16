export type Tariff = { startKwh: number; pricePerKwh: number; effectiveReadingAt?: string };
export function calculateMeterCharge(reading: number, tariffs: Tariff[]) {
  if (!Number.isFinite(reading) || !tariffs.length) return null;
  if (tariffs.some((entry, i) => !Number.isFinite(entry.startKwh) || entry.startKwh < 0
    || !Number.isFinite(entry.pricePerKwh) || entry.pricePerKwh < 0
    || (i > 0 && entry.startKwh < tariffs[i - 1].startKwh)) || reading < tariffs[0].startKwh) return null;
  const amount = tariffs.reduce((sum, entry, i) => {
    const end = Math.min(reading, tariffs[i + 1]?.startKwh ?? reading);
    return sum + Math.max(0, end - entry.startKwh) * entry.pricePerKwh;
  }, 0);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
