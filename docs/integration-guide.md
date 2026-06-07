# Becoming a FinHero data provider — integration guide

This guide walks you (a data-holding company) through building a **Source
Adapter**: a small package that maps your data to FinHero's canonical
alternative-data schema so FinHero can use it in credit reports and scoring.

You write one adapter per **category** of data you provide (e.g. telco
records, payment-network flows, trade-credit/AR-AP, social-media presence).
The full toolkit — validator, local test harness, mock consumer — lets you
build and verify your adapter end-to-end **without standing up FinHero's
stack**.

---

## The mental model

```
your source ──fetch()──> raw payload ──extract()──> canonical rows ──> FinHero ingests
   (your API,            (whatever your            (FinHero's field
    DB, file…)            source returns)           names + units)
```

- FinHero's host calls your adapter once per applicant when an application is
  finalized. It hands you an **ApplicantIdentity**; you return **canonical
  rows**.
- You only deal in **one category** and its canonical fields. You never touch
  scoring, storage, or the rest of FinHero.
- Everything is **typed**. `import` the contract from `@finsys/adapter-toolkit`.

---

## What you implement

A `SourceAdapter` (type re-exported from `@finsys/adapter-toolkit`):

```ts
import type { SourceAdapter, ApplicantIdentity, RawPayload, AdapterExtraction } from "@finsys/adapter-toolkit"
import { AdapterError } from "@finsys/adapter-toolkit"

export const adapter: SourceAdapter = {
  id: "acme-telco-v1",          // your unique adapter id
  category: "telco-carrier",    // ONE category (see canonical-fields.md)
  version: 1,
  produces: [                    // subset of the category's canonical fields
    "telcoOnTimePaymentRatio24m",
    "telcoTenureMonths",
  ],

  // Optional: pull data for one applicant from your source. Omit if your
  // data is pushed/batched and extract() gets the raw payload another way.
  async fetch(identity: ApplicantIdentity): Promise<RawPayload> {
    if (!identity.ic) throw new AdapterError("payload_invalid", "missing IC")
    const res = await fetch(`https://api.acme.example/subscriber/${identity.ic}`)
    if (!res.ok) throw new AdapterError("source_unavailable", `HTTP ${res.status}`)
    return await res.json()
  },

  // Map your raw payload to canonical rows. One row per "instance"
  // (e.g. one telco line; one merchant). Most providers return exactly one.
  async extract(raw: RawPayload): Promise<AdapterExtraction[]> {
    const r = raw as { onTime: number; ageMonths: number }
    return [{
      instanceKey: "",                       // "" for single-instance; else a stable per-instance id
      observedAt: new Date().toISOString(),  // when your data was observed
      values: {
        telcoOnTimePaymentRatio24m: r.onTime,
        telcoTenureMonths: r.ageMonths,
      },
    }]
  },
}
```

### The contract, field by field
- **`id`** — globally unique, stable. `vendor-category-vN`.
- **`category`** — exactly one, from [`docs/canonical-fields.md`](./canonical-fields.md).
- **`produces`** — the canonical field names you emit. **Must be a subset of
  the category's fields** (the validator enforces this). Produce only what you
  actually have.
- **`extract(raw)`** — pure mapping from your payload to `values` keyed by
  canonical field names. No I/O here ideally.
- **`fetch(identity)`** — optional per-applicant pull. Required only if your
  manifest lists `requiredIdentityFields`.

### Identity
`ApplicantIdentity` carries `{ ihsId, ic?, fullName? }`. `ic` (Malaysian national
ID) and `fullName` may be **absent** for non-MY scope — check defensively and
throw `AdapterError("payload_invalid", …)` if you can't proceed.

### Errors — always throw `AdapterError`
| reason | when |
| --- | --- |
| `source_unavailable` | your source is unreachable / timed out (retryable) |
| `payload_invalid` | your source returned something unusable, or identity is insufficient |
| `mapping_failed` | the payload was fine but couldn't be mapped to canonical fields |
| `not_applicable` | this applicant legitimately has no data with you |

The host catches `AdapterError`, records the run outcome, and moves on — one
adapter failing never breaks the others or the application.

---

## The manifest

Ship a `manifest.json` next to your adapter:

```jsonc
{
  "manifestVersion": 1,
  "id": "acme-telco-v1",
  "displayName": "Acme Telco",
  "category": "telco-carrier",
  "version": 1,
  "produces": ["telcoOnTimePaymentRatio24m", "telcoTenureMonths"],
  "requiredIdentityFields": [],         // e.g. ["ic"] if fetch() needs the IC; never list ihsId/fullName
  "implementation": { "type": "typescript", "entryPoint": "extract.mjs" }
}
```
The `produces` here must match your adapter's, and both must be a subset of the
category's canonical fields. The validator checks all of this.

---

## Build + test locally (no FinHero stack needed)

```bash
npm install @finsys/adapter-toolkit @finsys/core

# 1. Validate the manifest + adapter export shape
npx finsys-adapter-toolkit validate ./my-adapter      # exit 0 = conformant

# 2. Run your adapter against fixtures + assert the output
node my-adapter/test.mjs                               # uses runFixtures()
```

- **`validate`** — schema-checks the manifest, resolves the entrypoint, and
  verifies the export matches the `SourceAdapter` contract. Wire it into your CI.
- **`runFixtures(adapter, fixtures)`** — feeds raw payloads (or identities, to
  exercise `fetch()`) and diffs the result against your `expected` rows. See
  [`examples/minimal-adapter-template/`](../examples/minimal-adapter-template/)
  for a runnable test, and one full reference adapter per category — telco
  ([`fake-telco/`](../examples/fake-telco/)), payment-network
  ([`fake-payments/`](../examples/fake-payments/)), trade-credit
  ([`fake-trade-credit/`](../examples/fake-trade-credit/)) and social-media
  ([`fake-social/`](../examples/fake-social/)) — each with a sample source API +
  docker-compose.
- **`MockConsumer`** — an in-memory stand-in for FinHero's persistence, so you
  can round-trip fetch → extract → persist → read and assert the canonical rows
  exactly as the host would store them.

---

## How it runs inside FinHero (what to expect)

1. FinHero registers your adapter (manifest + entrypoint) in its host.
2. When an application is finalized, the host runs every registered adapter for
   that applicant: `fetch(identity)` → `extract(raw)` → persist the canonical
   rows to the category's table.
3. **Re-runs replace** the prior rows for `(applicant, your adapter)` — emitting
   the same `instanceKey` updates in place; a new `instanceKey` adds a row.
4. Your canonical fields then flow into the applicant's credit report + scoring.

You don't manage any of that — you just keep your adapter conformant.

---

## Adding a new category

The canonical categories live in `@finsys/core`. If FinHero doesn't yet have a
category for your data, that's a FinHero-side addition (the registry is central
so every provider of a category emits the same fields) — open a request rather
than inventing fields. The five current categories are in
[`docs/canonical-fields.md`](./canonical-fields.md).

---

## Checklist before you submit
- [ ] `validate` passes (manifest + export shape conformant)
- [ ] `produces` is a subset of your category's canonical fields
- [ ] `extract()` emits correct units/types per `canonical-fields.md`
- [ ] `fetch()` throws `AdapterError` (right reason) on every failure path
- [ ] fixtures/round-trip test green
