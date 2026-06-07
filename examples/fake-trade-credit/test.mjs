// Offline mapping test for the fake-trade-credit adapter — no API/docker
// needed. Feeds the raw /v1/accounts/lookup shape and asserts the canonical
// trade-credit output. Run: node ./test.mjs
//
// (runFixtures compares instanceKey + values only; observedAt is ignored.)

import { runFixtures } from "@finsys/adapter-toolkit"
import adapter from "./adapter/extract.mjs"

const fixtures = [
  {
    name: "persona A (strong) → canonical trade-credit",
    rawPayload: {
      accountsReceivable: {
        totalMyr: 250000,
        aging: { current: 232000, d1_30: 14000, d31_60: 3000, d61_90: 1000, d90plus: 0 },
        top5DebtorShareRatio: 0.31,
      },
      accountsPayable: { totalMyr: 120000, avgDaysOutstanding: 38 },
      incomeStatement12m: { revenueMyr: 2400000, cogsMyr: 1320000 },
      tradeReferences: { defaults12m: 0 },
      metrics: { daysSalesOutstanding: 28, cashConversionCycleDays: 11 },
    },
    expected: [
      {
        instanceKey: "default",
        observedAt: "ignored-by-diff",
        values: {
          arDaysSalesOutstanding: 28,
          apDaysPayableOutstanding: 38,
          arTotalOutstandingMyr: 250000,
          arCurrentRatio: 0.928,
          arOverdue90PlusRatio: 0,
          debtorConcentrationTop5Ratio: 0.31,
          tradeReferenceDefaults12m: 0,
          accountingRevenue12mMyr: 2400000,
          grossMarginPct: 0.45,
          cashConversionCycleDays: 11,
        },
      },
    ],
  },
]

const results = await runFixtures(adapter, fixtures)
let failed = 0
for (const r of results) {
  if (r.ok) console.log(`✓ ${r.name}`)
  else {
    failed++
    console.error(`✗ ${r.name}\n  ${r.diff ?? r.error}`)
  }
}
console.log(`\n${results.length - failed}/${results.length} fixtures passed`)
process.exit(failed ? 1 : 0)
