// Offline mapping test for the fake-social adapter — no API/docker needed.
// Feeds the raw /v1/profiles/lookup shape and asserts the canonical
// social-media output. Run: node ./test.mjs
//
// (runFixtures compares instanceKey + values only; observedAt is ignored.)

import { runFixtures } from "@finsys/adapter-toolkit"
import adapter from "./adapter/extract.mjs"

const fixtures = [
  {
    name: "persona A (strong) → canonical social-media",
    rawPayload: {
      profile: { accountAgeMonths: 84, followers: 18500, verified: true },
      engagement90d: { engagementRate: 0.062, avgInteractionsPerPost: 1147 },
      posting12m: { activeMonths: 12 },
      reviews: { avgRating: 4.6, count: 312 },
      sentiment90d: { negativeMentions: 4, totalMentions: 220 },
      flags24m: { count: 0 },
    },
    expected: [
      {
        instanceKey: "default",
        observedAt: "ignored-by-diff",
        values: {
          socialAccountTenureMonths: 84,
          socialFollowerCount: 18500,
          socialEngagementRate90d: 0.062,
          socialPostingConsistency12m: 1,
          socialVerifiedBusinessAccount: true,
          socialCustomerRatingAvg: 4.6,
          socialNegativeSentimentRatio90d: 0.0182,
          socialAccountFlags24m: 0,
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
