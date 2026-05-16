/**
 * fake-payments-v1 — reference adapter for the FinSys Source Adapter
 * Framework. Reads from the sibling fake-payments-api service and
 * translates its response into canonical payment-network fields.
 *
 * Same shape as fake-telco-v1, different category + upstream. A real
 * partner adapter (NTT/iPay88, GHL, etc.) follows the same pattern:
 *   - fetch(identity)  → call the upstream service, return RawPayload
 *   - extract(raw)     → map upstream → canonical AdapterExtraction[]
 */

const API_URL = process.env.FAKE_PAYMENTS_API_URL ?? "http://fake-payments-api:4200"
const API_KEY = process.env.FAKE_PAYMENTS_API_KEY ?? "demo-key"

const adapter = {
  id: "fake-payments-v1",
  category: "payment-network",
  version: 1,
  produces: [
    "paymentsMonthlyVolumeMyrT3",
    "paymentsMonthlyVolumeMyrT12",
    "paymentsArpuStability12m",
    "paymentsDisputeRate12m",
    "paymentsCustomerConcentrationTop5Pct",
    "paymentsActiveTenureMonths",
  ],

  async fetch(identity) {
    if (!identity?.ic || !identity?.fullName) {
      throw new Error("fake-payments-v1: identity.ic and identity.fullName are required")
    }
    const res = await fetch(`${API_URL}/v1/merchants/lookup`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ ic: identity.ic, fullName: identity.fullName }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`fake-payments-v1 fetch failed: HTTP ${res.status} ${text}`)
    }
    return res.json()
  },

  async extract(raw) {
    const metrics = raw.paymentsMetrics ?? {}
    return [
      {
        instanceKey: "default",
        observedAt: new Date().toISOString(),
        values: {
          paymentsMonthlyVolumeMyrT3: Number(metrics.monthlyVolumeMyrT3 ?? 0),
          paymentsMonthlyVolumeMyrT12: Number(metrics.monthlyVolumeMyrT12 ?? 0),
          paymentsArpuStability12m: Number(metrics.arpuStability12m ?? 0),
          paymentsDisputeRate12m: Number(metrics.disputeRate12m ?? 0),
          paymentsCustomerConcentrationTop5Pct: Number(metrics.customerConcentrationTop5Pct ?? 0),
          paymentsActiveTenureMonths: Number(metrics.activeTenureMonths ?? 0),
        },
      },
    ]
  },
}

export default adapter
