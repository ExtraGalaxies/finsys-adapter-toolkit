# Reference example: fake social (business-presence) adapter

A complete, runnable reference for the **`social-media`** category: a fake
social-data API (the kind of business social-presence summary a social-data
provider would expose) plus an adapter that maps it to FinHero's canonical
social-media fields. Social signals are a thin-file alternative-data layer —
useful where an SME has little formal credit history but a real online presence.

## What's here
- `api/` — a tiny Express service serving a raw social profile per IC
  (`POST /v1/profiles/lookup`), with 3 personas (A=strong, B=mid, C=weak).
- `adapter/` — `manifest.json` + `extract.mjs`: fetches from the API and maps
  the raw profile into canonical fields (tenure, followers, engagement, posting
  consistency, verification, customer rating, negative sentiment, flags).
- `test.mjs` — offline mapping test (no docker needed).

## Try it locally
```bash
# Offline: just test the raw→canonical mapping
npm install @finsys/adapter-toolkit @finsys/core
node ./test.mjs

# End-to-end: bring up the fake API + call it
docker compose up --build
curl -H "x-api-key: demo-key" -X POST http://localhost:4400/v1/profiles/lookup \
     -H "content-type: application/json" \
     -d '{"ic":"850101015432","fullName":"Aiman bin Hassan"}'

# Validate the adapter conforms to the contract
npx finsys-adapter-toolkit validate ./adapter
```

## Use it as a template
Copy `adapter/`, point `fetch()` at your real social-data API, and adjust
`extract()` to your payload. Keep `produces` a subset of the social-media
fields in [`../../docs/canonical-fields.md`](../../docs/canonical-fields.md).
See the [integration guide](../../docs/integration-guide.md) for the full
contract. The same 3 IC keys are used across the `fake-telco`, `fake-payments`,
`fake-trade-credit`, and `fake-social` examples, so one applicant carries all
four alternative-data layers.
