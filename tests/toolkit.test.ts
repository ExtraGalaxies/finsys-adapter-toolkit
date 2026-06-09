// SYS-2556: smoke suite for the published SDK surface. Exercises the
// three exported tools against the bundled example adapters — the same
// artifacts a partner downloads — so `npm test` guards the contract the
// README sells. Runs with no network and no FinHero stack.

import { readdirSync, statSync, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { describe, expect, it } from "vitest"

import { MockConsumer, runFixtures, validateAdapter } from "../src/index.js"
import type { Fixture } from "../src/index.js"
import type { SourceAdapter } from "@finsys/core"

const here = dirname(fileURLToPath(import.meta.url))
const examplesDir = resolve(here, "..", "examples")

const exampleAdapterDirs = readdirSync(examplesDir)
  .map((name) => ({ name, dir: resolve(examplesDir, name, "adapter") }))
  .filter(({ dir }) => existsSync(dir) && statSync(dir).isDirectory())

describe("validateAdapter", () => {
  it("finds the bundled example adapters", () => {
    expect(exampleAdapterDirs.map((e) => e.name).sort()).toEqual([
      "fake-payments",
      "fake-social",
      "fake-telco",
      "fake-trade-credit",
      "minimal-adapter-template",
    ])
  })

  for (const { name, dir } of exampleAdapterDirs) {
    it(`validates examples/${name}`, async () => {
      const result = await validateAdapter(dir)
      expect(result.errors).toEqual([])
      expect(result.ok).toBe(true)
      expect(result.manifest?.category).toBeTruthy()
    })
  }

  it("rejects a directory that is not an adapter", async () => {
    const result = await validateAdapter(resolve(here, "..", "docs"))
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe("runFixtures", () => {
  async function loadTemplateAdapter(): Promise<SourceAdapter> {
    const entry = resolve(
      examplesDir,
      "minimal-adapter-template",
      "adapter",
      "extract.mjs",
    )
    const mod = (await import(pathToFileURL(entry).href)) as {
      default: SourceAdapter
    }
    return mod.default
  }

  it("passes fixtures whose expected canonical output matches", async () => {
    const adapter = await loadTemplateAdapter()
    const fixtures: Fixture[] = [
      {
        name: "maps a typical payload",
        rawPayload: { onTimeRatio: 0.96, tenureMonths: 60 },
        expected: [
          {
            instanceKey: "",
            observedAt: "ignored-by-diff",
            values: { telcoOnTimePaymentRatio24m: 0.96, telcoTenureMonths: 60 },
          },
        ],
      },
      {
        name: "missing fields default to 0",
        rawPayload: {},
        expected: [
          {
            instanceKey: "",
            observedAt: "ignored-by-diff",
            values: { telcoOnTimePaymentRatio24m: 0, telcoTenureMonths: 0 },
          },
        ],
      },
    ]
    const results = await runFixtures(adapter, fixtures)
    expect(results).toHaveLength(2)
    for (const r of results) {
      expect(r.error).toBeUndefined()
      expect(r.diff).toBeUndefined()
      expect(r.ok).toBe(true)
    }
  })

  it("reports a diff (not a throw) when expected values mismatch", async () => {
    const adapter = await loadTemplateAdapter()
    const fixtures: Fixture[] = [
      {
        name: "deliberate mismatch",
        rawPayload: { onTimeRatio: 0.5, tenureMonths: 12 },
        expected: [
          {
            instanceKey: "",
            observedAt: "ignored-by-diff",
            values: { telcoOnTimePaymentRatio24m: 0.99, telcoTenureMonths: 12 },
          },
        ],
      },
    ]
    const [result] = await runFixtures(adapter, fixtures)
    expect(result!.ok).toBe(false)
    expect(result!.diff).toBeTruthy()
  })
})

describe("MockConsumer", () => {
  const instance = (ratio: number) => ({
    instanceKey: "",
    observedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    values: { telcoOnTimePaymentRatio24m: ratio, telcoTenureMonths: 24 },
  })

  it("round-trips persistExtraction → getCanonicalRowsForIhs", () => {
    const consumer = new MockConsumer()
    consumer.persistExtraction({
      category: "telco-carrier",
      ihsId: 7,
      adapterId: "minimal-telco-v1",
      adapterVersion: 1,
      adapterRunId: 1,
      observedAt: new Date("2026-01-01T00:00:00Z"),
      instances: [instance(0.9)],
    })
    const rows = consumer.getCanonicalRowsForIhs(7).telco
    expect(rows).toHaveLength(1)
    expect(rows[0]!.values.telcoOnTimePaymentRatio24m).toBe(0.9)
    // Other applicants see nothing.
    expect(consumer.getCanonicalRowsForIhs(8).telco).toHaveLength(0)
  })

  it("replaces prior-run rows on rerun (replace-on-rerun semantics)", () => {
    const consumer = new MockConsumer()
    for (const [runId, ratio] of [
      [1, 0.5],
      [2, 0.8],
    ] as const) {
      consumer.persistExtraction({
        category: "telco-carrier",
        ihsId: 7,
        adapterId: "minimal-telco-v1",
        adapterVersion: 1,
        adapterRunId: runId,
        observedAt: new Date("2026-01-01T00:00:00Z"),
        instances: [instance(ratio)],
      })
    }
    const rows = consumer.getCanonicalRowsForIhs(7).telco
    expect(rows).toHaveLength(1)
    expect(rows[0]!.values.telcoOnTimePaymentRatio24m).toBe(0.8)
  })
})
