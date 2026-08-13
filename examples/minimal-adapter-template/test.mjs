// Local conformance test — runs the adapter against fixtures and asserts the
// canonical output. No FinHero stack needed.  Run: node ./test.mjs
//
// runFixtures compares `instanceKey` + `values` only (observedAt is ignored),
// so this test is deterministic.

import { readFileSync } from "node:fs"
import { categoryFieldsOf } from "@finsys/core"
import { runFixtures } from "@finsys/adapter-toolkit"
import adapter from "./adapter/extract.mjs"

// ── SYS-3346: DERIVE the vocabulary, do not restate it ──────────────────────
//
// This is the file most partners copy, so whatever it does is what most
// adapters will do. It used to state field names as literals in three places
// — manifest, extract, fixtures — and nothing tied them to the registry that
// defines them. That is exactly the habit that made one rename cost a day
// across four consumers, and the reason this SDK shipped examples teaching a
// vocabulary the platform had already retired.
//
// So the manifest's own `produces` is checked against the CATEGORY, from the
// installed @finsys/core, before any fixture runs. A name your service no
// longer knows fails here — on your machine, with the field named — instead of
// arriving as a deprecation warning in someone else's logs, or as a silently
// dropped column.
//
// Copy this block into your own test. It is eight lines and it is the whole
// difference between an adapter that survives a rename and one that does not.
const manifest = JSON.parse(readFileSync(new URL("./adapter/manifest.json", import.meta.url)))
const known = new Set(categoryFieldsOf(manifest.category))
const unknown = manifest.produces.filter((f) => !known.has(f))
if (unknown.length > 0) {
  console.error(
    `✗ manifest.produces names ${unknown.length} field(s) that category ` +
      `"${manifest.category}" does not declare: ${unknown.join(", ")}\n` +
      `  Check them against \`categoryFieldsOf("${manifest.category}")\` — a retired name ` +
      `still works today via the compatibility layer, but only for now.`
  )
  process.exit(1)
}
console.log(`✓ all ${manifest.produces.length} produced fields exist in category "${manifest.category}"`)

const fixtures = [
  {
    name: "maps a typical telco payload",
    // Your source's raw shape. (Use `identity: {...}` instead to exercise fetch().)
    rawPayload: { onTimeRatio: 0.96, tenureMonths: 60 },
    expected: [
      {
        instanceKey: "",
        observedAt: "ignored-by-diff",
        values: { onTimePaymentRatio24m: 0.96, tenureMonths: 60 },
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
        values: { onTimePaymentRatio24m: 0, tenureMonths: 0 },
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
