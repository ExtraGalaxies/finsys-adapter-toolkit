/**
 * fake-telco-v1 — reference adapter for the FinSys Source Adapter
 * Framework. Reads from the sibling fake-telco-api service and
 * translates its response into canonical telco-carrier fields.
 *
 * Production adapters follow the same shape against real carrier APIs:
 *   - fetch(identity)  → call the upstream service, return RawPayload
 *   - extract(raw)     → map upstream → canonical AdapterExtraction[]
 *
 * Wire the upstream URL + API key through env vars at adapter-host
 * boot time; never commit credentials.
 */

const API_URL = process.env.FAKE_TELCO_API_URL ?? "http://fake-telco-api:4100"
const API_KEY = process.env.FAKE_TELCO_API_KEY ?? "demo-key"

const adapter = {
  id: "fake-telco-v1",
  category: "telco-carrier",
  version: 1,
  produces: [
    "telcoTenureMonths",
    "telcoOnTimePaymentRatio24m",
    "telcoLateDays24m",
    "telcoSuspensionsCount24m",
    "telcoArpuMyr",
    "telcoHandsetFinancingActive",
    "telcoHandsetFinancingDelinquent",
  ],

  async fetch(identity) {
    if (!identity?.ic || !identity?.fullName) {
      throw new Error("fake-telco-v1: identity.ic and identity.fullName are required")
    }
    const res = await fetch(`${API_URL}/v1/subscribers/lookup`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ ic: identity.ic, fullName: identity.fullName }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`fake-telco-v1 fetch failed: HTTP ${res.status} ${text}`)
    }
    return res.json()
  },

  async extract(raw) {
    const since = new Date(raw.subscriberSince)
    const now = new Date()
    const tenureMonths = Math.max(
      0,
      (now.getFullYear() - since.getFullYear()) * 12 + (now.getMonth() - since.getMonth()),
    )
    const history = raw.paymentHistory ?? {}
    const onTime = Number(history.billsPaidOnTime ?? 0)
    const late = Number(history.billsPaidLate ?? 0)
    const unpaid = Number(history.billsUnpaid ?? 0)
    const total = onTime + late + unpaid
    const onTimeRatio = total > 0 ? Number((onTime / total).toFixed(4)) : 0
    // Upstream gives us late-bill counts; canonical asks for late-days.
    // Approximate with a 15-day-per-late-bill conversion (a Telekom Malaysia
    // postpaid bill that goes late typically lands ~14-21 days late before
    // suspension). Real adapters with day-level visibility should use it.
    const lateDays = late * 15
    const suspensions = Number(history.suspensions ?? unpaid > 0 ? 1 : 0)
    const handsetActive = Boolean(raw.handsetFinancing?.active ?? false)
    const handsetDelinquent = Boolean(raw.handsetFinancing?.delinquent ?? false)

    return [
      {
        instanceKey: "default",
        observedAt: new Date().toISOString(),
        values: {
          telcoTenureMonths: tenureMonths,
          telcoOnTimePaymentRatio24m: onTimeRatio,
          telcoLateDays24m: lateDays,
          telcoSuspensionsCount24m: suspensions,
          telcoArpuMyr: Number(raw.averageMonthlyArpuMyr ?? 0),
          telcoHandsetFinancingActive: handsetActive,
          telcoHandsetFinancingDelinquent: handsetDelinquent,
        },
      },
    ]
  },
}

export default adapter
