/**
 * fake-social-v1 — reference adapter for the FinSys Source Adapter Framework.
 * Reads a business social-presence profile from the sibling fake-social-api and
 * maps it to canonical social-media fields (tenure, audience, engagement,
 * posting consistency, verification, customer rating, negative sentiment,
 * account flags).
 *
 * Production adapters follow the same shape against a real social-data API.
 * For typed failure reasons, throw `AdapterError` from `@finsys/core`
 * (`new AdapterError("source_unavailable", …)`); this reference stays
 * dependency-free and throws plain Errors — the host classifies either.
 */

const API_URL =
  process.env.FAKE_SOCIAL_API_URL ?? "http://fake-social-api:4400"
const API_KEY = process.env.FAKE_SOCIAL_API_KEY ?? "demo-key"

const round4 = (n) => Number(n.toFixed(4))
const ratio = (num, den) => (den > 0 ? round4(num / den) : 0)
const clamp01 = (n) => Math.max(0, Math.min(1, n))

const adapter = {
  id: "fake-social-v1",
  category: "social-media",
  version: 1,
  produces: [
    "socialAccountTenureMonths",
    "socialFollowerCount",
    "socialEngagementRate90d",
    "socialPostingConsistency12m",
    "socialVerifiedBusinessAccount",
    "socialCustomerRatingAvg",
    "socialNegativeSentimentRatio90d",
    "socialAccountFlags24m",
  ],

  async fetch(identity) {
    if (!identity?.ic || !identity?.fullName) {
      throw new Error("fake-social-v1: identity.ic and identity.fullName are required")
    }
    const res = await fetch(`${API_URL}/v1/profiles/lookup`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ ic: identity.ic, fullName: identity.fullName }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`fake-social-v1 fetch failed: HTTP ${res.status} ${text}`)
    }
    return res.json()
  },

  async extract(raw) {
    const profile = raw.profile ?? {}
    const posting = raw.posting12m ?? {}
    const sentiment = raw.sentiment90d ?? {}

    return [
      {
        instanceKey: "default",
        observedAt: new Date().toISOString(),
        values: {
          socialAccountTenureMonths: Number(profile.accountAgeMonths ?? 0),
          socialFollowerCount: Number(profile.followers ?? 0),
          socialEngagementRate90d: round4(Number(raw.engagement90d?.engagementRate ?? 0)),
          socialPostingConsistency12m: clamp01(ratio(Number(posting.activeMonths ?? 0), 12)),
          socialVerifiedBusinessAccount: Boolean(profile.verified),
          socialCustomerRatingAvg: round4(Number(raw.reviews?.avgRating ?? 0)),
          socialNegativeSentimentRatio90d: ratio(
            Number(sentiment.negativeMentions ?? 0),
            Number(sentiment.totalMentions ?? 0),
          ),
          socialAccountFlags24m: Number(raw.flags24m?.count ?? 0),
        },
      },
    ]
  },
}

export default adapter
