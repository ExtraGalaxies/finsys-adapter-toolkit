import type {
  AdapterExtraction,
  ApplicantIdentity,
  RawPayload,
  SourceAdapter,
} from "@finsys/core"

/**
 * One fixture pair the partner ships alongside their adapter for
 * regression testing. Discriminated union — exactly one of
 * `rawPayload` or `identity` MUST be set:
 *
 *   - `rawPayload` provided → skips fetch, calls extract only
 *     (use this when the partner doesn't own the upstream fetch path
 *     or wants to lock specific payload shapes into the suite)
 *   - `identity` provided → calls fetch(identity), then extract
 *     (full end-to-end; requires the adapter to implement fetch)
 *
 * Constructing a fixture with neither field is a type error.
 * Constructing one with both is also a type error — they're mutually
 * exclusive paths through the harness.
 *
 * Note on type-level enforcement: the discriminated union narrows
 * "neither field set" to a type error at construction sites with
 * literal objects. The "both fields set" case is NOT compile-rejected
 * (TS resolves a both-set literal as FixtureFromPayload — the
 * `identity?: never` only fires when the property is declared on a
 * sibling branch). runFixtures defends in depth at runtime, rejecting
 * both edges (neither-set + both-set) with an explicit error result
 * instead of silently picking a branch.
 *
 * `expected` is the canonical instance set the adapter should produce.
 * runFixtures diffs the actual against this and reports mismatches.
 */
export type Fixture = FixtureFromPayload | FixtureFromIdentity

interface FixtureBase {
  name: string
  expected: AdapterExtraction[]
}

export interface FixtureFromPayload extends FixtureBase {
  rawPayload: RawPayload
  identity?: never
}

export interface FixtureFromIdentity extends FixtureBase {
  identity: ApplicantIdentity
  rawPayload?: never
}

export interface FixtureResult {
  name: string
  ok: boolean
  /** Filled when ok=false — human-readable diff explanation. */
  diff?: string
  /** Filled when fetch() or extract() threw. */
  error?: string
}

/**
 * Runs every fixture against the adapter and returns per-fixture
 * results. Doesn't throw on per-fixture failure; aggregate decisions
 * (CI exit code, summary log) are the caller's job.
 *
 * For fixtures with `identity`: requires the adapter to implement
 * fetch(). For fixtures with `rawPayload`: skips fetch, calls
 * extract directly.
 */
export async function runFixtures(
  adapter: SourceAdapter,
  fixtures: ReadonlyArray<Fixture>,
): Promise<FixtureResult[]> {
  const results: FixtureResult[] = []
  for (const fixture of fixtures) {
    try {
      // Defense-in-depth: the Fixture discriminated union narrows the
      // "neither set" case to a type error, but the "both set" case
      // sneaks past — TS resolves a literal with both `rawPayload`
      // and `identity` to the FixtureFromPayload branch and the
      // sibling `identity?: never` doesn't fire because never-typed
      // properties only enforce when *the property is declared*.
      // Same risk: partner CI passing dynamically-loaded JSON fixtures
      // bypasses the type-system check entirely. Reject both edges
      // here so the harness never silently picks one branch.
      const hasPayload = fixture.rawPayload !== undefined
      const hasIdentity = fixture.identity !== undefined
      if (!hasPayload && !hasIdentity) {
        results.push({
          name: fixture.name,
          ok: false,
          error: `fixture must provide either 'rawPayload' or 'identity' — got neither`,
        })
        continue
      }
      if (hasPayload && hasIdentity) {
        // Narrows to `never` because both branches' `?: never` make
        // the intersection uninhabitable — cast back to a base shape
        // so we can read the name for the error report.
        const f = fixture as unknown as { name: string }
        results.push({
          name: f.name,
          ok: false,
          error: `fixture must provide exactly one of 'rawPayload' or 'identity' — got both`,
        })
        continue
      }
      let raw: RawPayload
      if (fixture.identity !== undefined) {
        if (typeof adapter.fetch !== "function") {
          results.push({
            name: fixture.name,
            ok: false,
            error: `fixture provides identity but adapter does not implement fetch()`,
          })
          continue
        }
        raw = await adapter.fetch(fixture.identity)
      } else {
        // Discriminated union narrows: rawPayload is set in this branch.
        raw = fixture.rawPayload as RawPayload
      }
      const actual = await adapter.extract(raw)
      const diff = diffExtractions(fixture.expected, actual)
      if (diff === null) {
        results.push({ name: fixture.name, ok: true })
      } else {
        results.push({ name: fixture.name, ok: false, diff })
      }
    } catch (err) {
      results.push({
        name: fixture.name,
        ok: false,
        error: `${(err as Error).name}: ${(err as Error).message}`,
      })
    }
  }
  return results
}

function diffExtractions(
  expected: AdapterExtraction[],
  actual: AdapterExtraction[],
): string | null {
  if (expected.length !== actual.length) {
    return `instance count mismatch: expected ${expected.length}, got ${actual.length}`
  }
  // NaN check: JSON.stringify(NaN) returns "null" — without explicit
  // detection, an adapter returning NaN where the fixture expects
  // null (or vice versa) silently passes the diff. Walk the actual
  // values first and report any NaN before the stringify-compare.
  for (const a of actual) {
    const nanFields = findNaNFields(a.values)
    if (nanFields.length > 0) {
      return `instanceKey='${a.instanceKey}' contains NaN value(s) at: ${nanFields.join(", ")}`
    }
  }
  // Order-independent comparison keyed by instanceKey.
  const eByKey = new Map(expected.map((e) => [e.instanceKey, e]))
  for (const a of actual) {
    const e = eByKey.get(a.instanceKey)
    if (!e) {
      return `unexpected instanceKey: '${a.instanceKey}'`
    }
    const expectedJson = JSON.stringify(e.values, sortKeys)
    const actualJson = JSON.stringify(a.values, sortKeys)
    if (expectedJson !== actualJson) {
      return `values mismatch for instanceKey='${a.instanceKey}':\n  expected: ${expectedJson}\n  actual:   ${actualJson}`
    }
  }
  return null
}

function findNaNFields(values: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(values)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === "number" && Number.isNaN(v)) {
      out.push(path)
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...findNaNFields(v as Record<string, unknown>, path))
    }
  }
  return out
}

function sortKeys(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = (value as Record<string, unknown>)[k]
        return acc
      }, {})
  }
  return value
}
