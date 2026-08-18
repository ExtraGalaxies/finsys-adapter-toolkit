# Changelog

All notable changes to `@finsys/adapter-toolkit` are documented here.
Versions publish to npm on a **GitHub Release** (not on merge to main) —
cutting a release tag is the explicit cutover.

## 0.2.2

**Admits `@finsys/core` 8.** Peer range `>=6.0.1 <8` → `>=6.0.1 <9`, and
`SUPPORTED_CORE_MAJORS` `[6, 7]` → `[6, 7, 8]`. Released **before** core 8.0.0
on purpose: this range still admits 7.x, so it is installable today, and once
8.0.0 becomes `latest` there is no window in which `npm install
@finsys/adapter-toolkit @finsys/core` resolves to a pair that cannot co-install.

Justified the same way 0.2.1 justified admitting 7: core 8.0.0's only breaking
change is the removal of five `survey-core` type re-exports (SYS-3420) —
nothing this toolkit reads. Every file under `dist/data` and `dist/schema` in
the 8.0.0 tarball is byte-identical to 7.10.0's, `adapter-categories.json`
included, so `categoryFieldsOf()` returns the same set under either. Lint and
the full suite pass against the 8.0.0 candidate as well as against 6.0.2.

**New test: the peer range and `SUPPORTED_CORE_MAJORS` must agree.** They are
one fact declared twice — the guard cannot read `package.json` at runtime
through core's exports map, so it carries its own copy — and until now nothing
compared them. The test parses the range (this repo's `>=A.B.C <N` shape only;
any other shape fails closed) and asserts the guard lists exactly those majors.
Observed red with the range at `<8` and the guard at `[6, 7, 8]`.

## 0.2.1

Fixes two defects in 0.2.0, both found before either version reached npm.

**The peer range excluded the core that shipped.** 0.2.0 declared
`@finsys/core` as `>=6.0.1 <7` while core was at 6.0.2; core then released
7.0.0, so installing the pair would have produced an unsatisfiable peer — the
exact install-time breakage the peerDependency move existed to end. Widened to
`>=6.0.1 <8`, justified by diffing published 6.0.2's `adapter-categories.json`
against 7.0.0's: byte-identical, because 7.0.0 is a types-only major. So
`categoryFieldsOf()` returns the same set under either.

**The core-version guard could never have fired.** It read
`@finsys/core/package.json`, which Node blocks — core's `exports` map does not
declare that subpath — so the lookup threw, the catch swallowed it, and the
check returned early on every call. A guard written to make a version skew
loud, silently doing nothing. It now resolves the module entry and walks up to
the owning `package.json`, verifying `name` so a walk out of a nested install
cannot report the consumer's own version as core's. "Could not determine" now
warns rather than returning quietly, because that is a different fact from
"it is fine".

## 0.2.0

**`@finsys/core` is now a peerDependency**, not a dependency. It was pinned
`^4.8.0`, which cannot accept 5.x or 6.x, so npm NESTED a second copy: a
partner installing both got their own core at the current major and this
toolkit's at 4.x. `validateAdapter` then checked their manifest against a
two-major-old vocabulary — rejecting a correct field name, accepting a retired
one, and never saying two registries were in play. A peer range makes nesting
impossible.

**Every published example moved to the current vocabulary.** All five taught
names that SYS-3333 retired, so a partner copying the reference example started
deprecated on day one. Rewritten from core's own `legacyName` table: 33 renames
across the manifests, then the extract code and fixtures that EMIT those names,
then the README, the four HTML integration guides and `docs/canonical-fields.md`.

**`minimal-adapter-template` now DERIVES its vocabulary.** Zero of the five
examples derived a field name from core; all were literals, so the blueprint
taught restatement — the habit that makes a rename expensive. The template's
test now asserts `manifest.produces` against `categoryFieldsOf(manifest.category)`
before any fixture runs, so a retired name fails on the partner's own machine
with the field named. It is the file most partners copy, which is why it is the
one that had to change.

## 0.1.3

Ships adapter cardinality declarations in the reference examples.

## 0.1.2

Republished so the shipped artifacts match the anonymized source. No API
changes; no source changes beyond the version bump.

0.1.1 was packed from a checkout predating the partner-name anonymization,
so two artifacts still carried a named carrier that the source no longer
does: `examples/fake-telco/README.md`, and — less obviously —
`dist/index.js.map`. Source maps embed the ORIGINAL source text, including
comments, so editing a comment in `src/` does not remove it from an
already-published map. Anyone auditing only the `.ts` files would have
concluded the package was clean.

Also removes named third-party companies from the payments example, which
referred to two brands that have since rebranded. A stale brand name is
worse than none: it misnames the company and dates the material. The
examples now describe the category ("a payment gateway", "a POS-terminal
network") rather than naming anyone.

Anyone on 0.1.1 should upgrade; there is no functional difference.

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
