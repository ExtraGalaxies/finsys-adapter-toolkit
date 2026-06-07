# Minimal adapter template

The smallest Source Adapter that **validates** and **passes a fixture test** —
your copy-paste starting point for becoming a FinHero data provider.

Unlike [`../fake-telco`](../fake-telco) / [`../fake-payments`](../fake-payments)
(full references with a sample source API + docker-compose), this is just the
bare adapter + a local test, so you can see the contract with nothing else in
the way.

## Files
- `adapter/manifest.json` — declares id, category, `produces`, entrypoint.
- `adapter/extract.mjs` — the adapter: `extract()` (required) + optional `fetch()`.
- `test.mjs` — runs the adapter against fixtures via `runFixtures()`.

## Try it
```bash
npm install @finsys/adapter-toolkit @finsys/core
npx finsys-adapter-toolkit validate ./adapter   # manifest + export shape -> exit 0
node ./test.mjs                                  # fixtures -> exit 0
```

## Make it yours
1. Copy this directory; rename to `<your-vendor>-adapter/`.
2. In `manifest.json` + `extract.mjs`: set a unique `id`, pick your `category`
   (see [`../../docs/canonical-fields.md`](../../docs/canonical-fields.md)), and
   set `produces` to the canonical fields you can supply (a **subset** of that
   category's fields).
3. Rewrite `extract()` to map your payload to those fields (mind the
   units/types in the canonical-fields doc).
4. If FinHero must pull per-applicant from your source, implement `fetch()` and
   list any extra identity it needs in `requiredIdentityFields` (never list the
   core `ihsId`/`ic`/`fullName`). Throw `AdapterError` on every failure path.
5. Update `test.mjs` fixtures to cover your real shapes; keep `validate` + the
   test green in your CI.

Full walkthrough: [`../../docs/integration-guide.md`](../../docs/integration-guide.md).
