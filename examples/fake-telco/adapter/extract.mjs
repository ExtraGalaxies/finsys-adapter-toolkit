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
// DEVOPS-540 gate hook, hardening per QA review: the test-override marker
// below is otherwise unconditional -- gating it behind an explicit env flag
// means the shipped reference adapter can't honor it in any non-test mount,
// only when a test harness deliberately opts in.
const TEST_HOOKS_ENABLED = process.env.FAKE_TELCO_ENABLE_TEST_HOOKS === "1"

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
    // SYS-3033: coarse enum-kind bucket parallels of the continuous/
    // discrete signals above. Labels are declared verbatim in this
    // adapter's manifest.json (enumValues) -- deliberately numeric
    // strings (plus one "N"/"Y" pair) to exercise the string-coercion
    // seam. extract() below must always emit these as STRINGS, never
    // numbers -- a numeric-looking label silently coerced to a number
    // downstream is exactly the bug this fixture exists to pin.
    "telcoPaymentReliabilityTier",
    "telcoTenureTier",
    "telcoDistressTier",
    "telcoHandsetRiskTier",
  ],

  async fetch(identity) {
    if (!identity?.ic || !identity?.fullName) {
      throw new Error("fake-telco-v1: identity.ic and identity.fullName are required")
    }
    // DEVOPS-540 gate hook: a narrow, deliberate test-only override so the
    // enum ingest gate's refusal paths (out-of-set label, non-string
    // label) can be exercised through this REAL default-mounted reference
    // adapter rather than a separate test-only fixture -- same "marker in
    // fullName" convention as compose/fixtures/adapter-registry-enum's
    // dedicated gate fixture. Gated behind FAKE_TELCO_ENABLE_TEST_HOOKS so
    // the shipped adapter can't honor the marker in any non-test mount;
    // every other identity (and every mount without the flag set) takes
    // the normal upstream path below.
    if (TEST_HOOKS_ENABLED && identity.fullName.includes("FAKETELCO:DISTRESS_OOR")) {
      return { _enumTestOverride: "out-of-set" }
    }
    if (TEST_HOOKS_ENABLED && identity.fullName.includes("FAKETELCO:DISTRESS_NUM")) {
      return { _enumTestOverride: "non-string" }
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
    if (raw._enumTestOverride === "out-of-set") {
      return [
        {
          instanceKey: "default",
          observedAt: new Date().toISOString(),
          values: { telcoTenureMonths: 12, telcoDistressTier: "5" }, // "5" is not in this adapter's declared set (["1","2","3","4"])
        },
      ]
    }
    if (raw._enumTestOverride === "non-string") {
      return [
        {
          instanceKey: "default",
          observedAt: new Date().toISOString(),
          values: { telcoTenureMonths: 12, telcoDistressTier: 2 }, // JS number, not the string "2" -- host must not coerce
        },
      ]
    }

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
    // JS precedence: `??` binds tighter than `?:`, so without the inner
    // parens this parses as `Number((history.suspensions ?? (unpaid > 0)) ? 1 : 0)`
    // and silently squashes any provided non-zero suspensions count to 1.
    // Parens force the intended fallback: use upstream value if set,
    // otherwise infer 1 suspension when there are any unpaid bills.
    const suspensions = Number(history.suspensions ?? (unpaid > 0 ? 1 : 0))
    const handsetActive = Boolean(raw.handsetFinancing?.active ?? false)
    const handsetDelinquent = Boolean(raw.handsetFinancing?.delinquent ?? false)

    // SYS-3033: coarse tier labels derived from the same signals above.
    // Every branch returns a STRING literal -- never a bare number -- so
    // a numeric-looking label ("1".."4") survives as a string end-to-end
    // (manifest enumValues -> here -> ingest -> storage -> projection).
    const telcoPaymentReliabilityTier =
      onTimeRatio >= 0.95 ? "1" : onTimeRatio >= 0.85 ? "2" : onTimeRatio >= 0.7 ? "3" : "4"
    const telcoTenureTier = tenureMonths < 12 ? "1" : tenureMonths <= 60 ? "2" : "3"
    const distressScore = suspensions * 2 + late
    const telcoDistressTier =
      distressScore === 0 ? "1" : distressScore <= 2 ? "2" : distressScore <= 5 ? "3" : "4"
    const telcoHandsetRiskTier = handsetActive && handsetDelinquent ? "Y" : "N"

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
          telcoPaymentReliabilityTier,
          telcoTenureTier,
          telcoDistressTier,
          telcoHandsetRiskTier,
        },
      },
    ]
  },
}

export default adapter
