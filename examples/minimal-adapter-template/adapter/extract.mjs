// Minimal Source Adapter template — the smallest thing that validates +
// passes a fixture test. Copy this directory, rename, and fill in YOUR
// category + fields + source.
//
//   validate:  npx finsys-adapter-toolkit validate ./adapter
//   test:      node ./test.mjs
//
// See ../../docs/integration-guide.md for the full contract and
// ../../docs/canonical-fields.md for every category's canonical fields.
// Full reference adapters (with a sample source API): ../fake-telco, ../fake-payments.

/** @type {import("@finsys/adapter-toolkit").SourceAdapter} */
const adapter = {
  // Globally-unique, stable id for your adapter: <vendor>-<category>-v<N>.
  id: "minimal-telco-v1",
  // Exactly ONE category from docs/canonical-fields.md.
  category: "telco-carrier",
  version: 1,
  // The canonical fields you emit — MUST be a subset of the category's fields.
  produces: ["telcoOnTimePaymentRatio24m", "telcoTenureMonths"],

  // OPTIONAL per-applicant pull from your source. Delete this whole method if
  // your data reaches extract() another way (then `requiredIdentityFields`
  // stays []). When you implement it, import AdapterError and throw it on
  // every failure path:
  //
  //   import { AdapterError } from "@finsys/adapter-toolkit"
  //   async fetch(identity) {
  //     if (!identity.ic) throw new AdapterError("payload_invalid", "missing IC")
  //     const res = await fetch(`https://api.example.com/${identity.ic}`)
  //     if (!res.ok) throw new AdapterError("source_unavailable", `HTTP ${res.status}`)
  //     return await res.json()
  //   },

  // Pure mapping: YOUR raw payload -> canonical rows. One row per instance
  // (most providers return exactly one). Match the units/types in
  // canonical-fields.md.
  async extract(raw) {
    const r = raw ?? {}
    return [
      {
        instanceKey: "", // "" for single-instance; a stable per-instance id otherwise
        observedAt: new Date().toISOString(), // when your data was observed
        values: {
          telcoOnTimePaymentRatio24m: Number(r.onTimeRatio ?? 0),
          telcoTenureMonths: Number(r.tenureMonths ?? 0),
        },
      },
    ]
  },
}

export default adapter
