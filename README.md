# @finsys/adapter-toolkit

Partner SDK for the **FinSys Source Adapter Framework**. Build, validate,
and locally test a source adapter without standing up the full FinSys
stack.

> Status: **v0.1.0 — minimum viable surface.** Expanding as partner-side
> feedback sharpens what authors actually need.

## What's in the box

- **`validateAdapter(dir)`** — loads `manifest.json`, validates against
  the `@finsys/core` JSON-schema, dynamically imports the entry point,
  confirms the exported `SourceAdapter` matches the manifest's id +
  category, and cross-checks `produces` against the category's canonical
  field set. CLI variant: `finsys-adapter-toolkit validate ./my-adapter`.
- **`runFixtures(adapter, fixtures)`** — runs the adapter against
  partner-supplied fixture pairs. Two modes:
  - `rawPayload` → calls `extract(raw)` only (tests transformation
    logic in isolation)
  - `identity` → calls `fetch(identity)` then `extract(raw)` (full
    e2e against a real or mocked upstream)
  Diffs actual canonical instances against `expected` and reports
  per-fixture pass/fail with structured errors.
- **`MockConsumer`** — in-memory stand-in for FinSys's persistence
  layer. Mirrors the real `AdapterStorageService` contract enough that
  partners can do a full round-trip locally: `extract → persist → query
  → assert`. Implements replace-on-rerun semantics.

## Example: `examples/fake-telco/`

A complete, runnable example: a fake telco API as a Docker container +
a reference adapter that calls it. Drop it into a FinSys or FinSim
stack as a first-time integration sanity check, or use it as a
template for your own adapter.

See [`examples/fake-telco/README.md`](./examples/fake-telco/README.md).

## Install (once published)

```bash
npm install --save-dev @finsys/adapter-toolkit
```

During pre-release iteration this package is published to an internal
Verdaccio registry, not the public npm registry. Public npm release
lands after the OSS split.

## Quickstart

```ts
import { validateAdapter, runFixtures, MockConsumer } from "@finsys/adapter-toolkit"

const result = await validateAdapter("./adapters/my-telco-v1")
if (!result.ok) {
  console.error(result.errors)
  process.exit(1)
}

const adapter = result.adapter!
const fixtures = [
  {
    name: "strong-payer",
    identity: { ihsId: 1, ic: "850101015432", fullName: "Aiman bin Hassan" },
    expected: [
      {
        instanceKey: "default",
        observedAt: "2026-01-01T00:00:00.000Z",
        values: { telcoOnTimePaymentRatio24m: 1.0 /* ... */ },
      },
    ],
  },
]

const results = await runFixtures(adapter, fixtures)
console.log(results)
```

## Adapter contract (reference)

A source adapter is a directory with:

```
my-adapter/
├── manifest.json   # id, version, category, produces, optional requiredIdentityFields
└── extract.mjs     # default export: SourceAdapter { id, category, version, produces, extract(raw), fetch?(identity) }
```

See `@finsys/core`'s `SourceAdapter` and `AdapterManifest` types for
the full contract.

## License

Apache-2.0
