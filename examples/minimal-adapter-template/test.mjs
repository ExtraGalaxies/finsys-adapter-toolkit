// Local conformance test — runs the adapter against fixtures and asserts the
// canonical output. No FinHero stack needed.  Run: node ./test.mjs
//
// runFixtures compares `instanceKey` + `values` only (observedAt is ignored),
// so this test is deterministic.

import { runFixtures } from "@finsys/adapter-toolkit"
import adapter from "./adapter/extract.mjs"

const fixtures = [
  {
    name: "maps a typical telco payload",
    // Your source's raw shape. (Use `identity: {...}` instead to exercise fetch().)
    rawPayload: { onTimeRatio: 0.96, tenureMonths: 60 },
    expected: [
      {
        instanceKey: "",
        observedAt: "ignored-by-diff",
        values: { telcoOnTimePaymentRatio24m: 0.96, telcoTenureMonths: 60 },
      },
    ],
  },
  {
    name: "missing fields default to 0",
    rawPayload: {},
    expected: [
      {
        instanceKey: "",
        observedAt: "ignored-by-diff",
        values: { telcoOnTimePaymentRatio24m: 0, telcoTenureMonths: 0 },
      },
    ],
  },
]

const results = await runFixtures(adapter, fixtures)
let failed = 0
for (const r of results) {
  if (r.ok) {
    console.log(`✓ ${r.name}`)
  } else {
    failed++
    console.error(`✗ ${r.name}\n  ${r.diff ?? r.error}`)
  }
}
console.log(`\n${results.length - failed}/${results.length} fixtures passed`)
process.exit(failed ? 1 : 0)
