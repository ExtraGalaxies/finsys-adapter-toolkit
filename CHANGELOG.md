# Changelog

All notable changes to `@finsys/adapter-toolkit` are documented here.
Versions publish to npm on a **GitHub Release** (not on merge to main) —
cutting a release tag is the explicit cutover.

## 0.1.1

Re-release of 0.1.0 with `dist/` actually included. The hand-published
0.1.0 tarball was packed from a checkout without a build, so npm's
`files` allowlist silently dropped the missing `dist/` directory —
the package could not be imported. 0.1.0 is deprecated on the registry;
this and all future versions publish from the release workflow, which
builds before publishing. No source changes.

## 0.1.0 (deprecated — broken tarball, missing dist/)

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
