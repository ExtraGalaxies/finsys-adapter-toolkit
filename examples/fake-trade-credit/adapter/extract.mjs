/**
 * fake-trade-credit-v1 — reference adapter for the FinSys Source Adapter
 * Framework. Reads an accounting system's AR/AP + P&L summary from the
 * sibling fake-trade-credit-api and maps it to canonical trade-credit fields
 * (the B2B trade-credit-bureau signal set: DSO/DPO, AR aging, concentration,
 * trade-reference defaults, margin, cash-conversion cycle).
 *
 * Production adapters follow the same shape against a real accounting/ERP API.
 * For typed failure reasons, throw `AdapterError` from `@finsys/core`
 * (`new AdapterError("source_unavailable", …)`); this reference stays
 * dependency-free and throws plain Errors — the host classifies either.
 */

const API_URL =
  process.env.FAKE_TRADE_CREDIT_API_URL ?? "http://fake-trade-credit-api:4300"
const API_KEY = process.env.FAKE_TRADE_CREDIT_API_KEY ?? "demo-key"

const round4 = (n) => Number(n.toFixed(4))
const ratio = (num, den) => (den > 0 ? round4(num / den) : 0)

const adapter = {
  id: "fake-trade-credit-v1",
  category: "trade-credit",
  version: 1,
  produces: [
    "arDaysSalesOutstanding",
    "apDaysPayableOutstanding",
    "arTotalOutstandingMyr",
    "arCurrentRatio",
    "arOverdue90PlusRatio",
    "debtorConcentrationTop5Ratio",
    "tradeReferenceDefaults12m",
    "accountingRevenue12mMyr",
    "grossMarginPct",
    "cashConversionCycleDays",
  ],

  async fetch(identity) {
    if (!identity?.ic || !identity?.fullName) {
      throw new Error("fake-trade-credit-v1: identity.ic and identity.fullName are required")
    }
    const res = await fetch(`${API_URL}/v1/accounts/lookup`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ ic: identity.ic, fullName: identity.fullName }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`fake-trade-credit-v1 fetch failed: HTTP ${res.status} ${text}`)
    }
    return res.json()
  },

  async extract(raw) {
    const ar = raw.accountsReceivable ?? {}
    const aging = ar.aging ?? {}
    const total = Number(ar.totalMyr ?? 0)
    const pnl = raw.incomeStatement12m ?? {}
    const revenue = Number(pnl.revenueMyr ?? 0)
    const cogs = Number(pnl.cogsMyr ?? 0)

    return [
      {
        instanceKey: "default",
        observedAt: new Date().toISOString(),
        values: {
          arDaysSalesOutstanding: Number(raw.metrics?.daysSalesOutstanding ?? 0),
          apDaysPayableOutstanding: Number(raw.accountsPayable?.avgDaysOutstanding ?? 0),
          arTotalOutstandingMyr: total,
          arCurrentRatio: ratio(Number(aging.current ?? 0), total),
          arOverdue90PlusRatio: ratio(Number(aging.d90plus ?? 0), total),
          debtorConcentrationTop5Ratio: round4(Number(ar.top5DebtorShareRatio ?? 0)),
          tradeReferenceDefaults12m: Number(raw.tradeReferences?.defaults12m ?? 0),
          accountingRevenue12mMyr: revenue,
          grossMarginPct: ratio(revenue - cogs, revenue),
          cashConversionCycleDays: Number(raw.metrics?.cashConversionCycleDays ?? 0),
        },
      },
    ]
  },
}

export default adapter
