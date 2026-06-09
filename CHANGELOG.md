# Changelog

All notable changes to `@finsys/adapter-toolkit` are documented here.
Versions publish to npm on a **GitHub Release** (not on merge to main) —
cutting a release tag is the explicit cutover.

## 0.1.0

Initial public release.

- `validateAdapter(dir)` — validates an adapter directory against the
  `@finsys/core` contract (manifest schema, canonical-field subset,
  module shape for TypeScript adapters).
- `runFixtures(adapter, fixtures)` — fixture-based regression harness;
  diff-based comparison of canonical output (`observedAt` ignored).
- `MockConsumer` — in-memory stand-in for FinSys persistence with
  production-matching replace-on-rerun semantics.
- `finsys-adapter-toolkit` CLI (`validate <dir>`).
- Contract type re-exports from `@finsys/core` (`SourceAdapter`,
  `AdapterManifest`, `ApplicantIdentity`, …) so integrators depend on
  one package.
- Reference examples: one runnable adapter + fake source API per
  category (telco, payments, trade-credit, social) and a
  `minimal-adapter-template` starting point.
- Docs: `docs/integration-guide.md`, generated `docs/canonical-fields.md`.
