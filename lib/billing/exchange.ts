let cachedRate: { rate: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const EXCHANGE_API_URL =
  "https://open.er-api.com/v6/latest/USD";

export async function fetchExchangeRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return cachedRate.rate;
  }

  try {
    const res = await fetch(EXCHANGE_API_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Exchange API returned ${res.status}`);

    const data = (await res.json()) as {
      result: string;
      rates?: Record<string, number>;
    };

    if (data.result !== "success" || !data.rates?.INR) {
      throw new Error("Unexpected exchange API response shape");
    }

    const inrPerUsd = data.rates.INR;
    cachedRate = { rate: inrPerUsd, fetchedAt: Date.now() };
    return inrPerUsd;
  } catch (err) {
    if (cachedRate) return cachedRate.rate;
    console.error("[exchange] Failed to fetch rate:", err);
    throw new Error(
      "Could not fetch exchange rate and no cached rate available"
    );
  }
}

export function convertInrToUsd(amountInr: number, inrPerUsd: number): number {
  if (inrPerUsd <= 0) throw new Error("Invalid exchange rate");
  return amountInr / inrPerUsd;
}
