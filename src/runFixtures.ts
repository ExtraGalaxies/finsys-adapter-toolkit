import type {
  AdapterExtraction,
  ApplicantIdentity,
  RawPayload,
  SourceAdapter,
} from "@finsys/core"

/**
 * One fixture pair the partner ships alongside their adapter for
 * regression testing. Either:
 *   - `rawPayload` provided directly (skips fetch — tests extract only)
 *   - `identity` provided (calls fetch, then extract — full e2e)
 *
 * `expected` is the canonical instance set the adapter should produce.
 * runFixtures diffs the actual against this and reports mismatches.
 */
export interface Fixture {
  name: string
  rawPayload?: RawPayload
  identity?: ApplicantIdentity
  expected: AdapterExtraction[]
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
        raw = fixture.rawPayload
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
