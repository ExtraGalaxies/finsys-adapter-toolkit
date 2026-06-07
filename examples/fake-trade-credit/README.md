# Reference example: fake trade-credit (accounting AR/AP) adapter

A complete, runnable reference for the **`trade-credit`** category: a fake
accounting-data API (the kind of AR/AP + P&L summary an AutoCount-/SQL-Account-
class system exports) plus an adapter that maps it to FinHero's canonical
trade-credit fields. This is the data-provider onramp for the B2B trade-credit
bureau use case.

## What's here
- `api/` — a tiny Express service serving a raw accounting summary per IC
  (`POST /v1/accounts/lookup`), with 3 personas (A=strong, B=mid, C=weak).
- `adapter/` — `manifest.json` + `extract.mjs`: fetches from the API and maps
  the raw AR aging / AP / P&L into canonical fields (DSO, 90+ overdue ratio,
  debtor concentration, gross margin, cash-conversion cycle, …).
- `test.mjs` — offline mapping test (no docker needed).

## Try it locally
```bash
# Offline: just test the raw→canonical mapping
npm install @finsys/adapter-toolkit @finsys/core
node ./test.mjs

# End-to-end: bring up the fake API + call it
docker compose up --build
curl -H "x-api-key: demo-key" -X POST http://localhost:4300/v1/accounts/lookup \
     -H "content-type: application/json" \
     -d '{"ic":"850101015432","fullName":"Aiman bin Hassan"}'

# Validate the adapter conforms to the contract
npx finsys-adapter-toolkit validate ./adapter
```

## Use it as a template
Copy `adapter/`, point `fetch()` at your real accounting/ERP API, and adjust
`extract()` to your payload. Keep `produces` a subset of the trade-credit
fields in [`../../docs/canonical-fields.md`](../../docs/canonical-fields.md).
See the [integration guide](../../docs/integration-guide.md) for the full
contract. The same 3 IC keys are used across the `fake-telco`, `fake-payments`,
`fake-trade-credit`, and `fake-social` examples, so one applicant carries all
four alternative-data layers.
