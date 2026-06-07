#!/usr/bin/env node
// SYS-2554: generate docs/canonical-fields.md from @finsys/core's category
// registry — the single source of truth for which canonical fields each
// category accepts. An adapter's `produces` list must be a subset of the
// fields listed here for its category.
//
// Run: npm run docs:canonical-fields  (regenerate after a @finsys/core bump)

import { allCategories } from "@finsys/core"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, "..", "docs", "canonical-fields.md")

const esc = (s) => String(s).replace(/\|/g, "\\|")
const unitRange = (f) => {
  const parts = []
  if (f.unit) parts.push(f.unit)
  if (f.range) parts.push(`[${f.range[0]}, ${f.range[1]}]`)
  return parts.join(" ") || "—"
}

const cats = allCategories()
const lines = []
lines.push("# Canonical fields by category")
lines.push("")
lines.push(
  "> Auto-generated from `@finsys/core` by `scripts/gen-canonical-fields.mjs` — " +
    "do not edit by hand. Regenerate with `npm run docs:canonical-fields` after a core bump.",
)
lines.push("")
lines.push(
  "Each category below is a kind of alternative data FinHero can ingest. Your " +
    "adapter declares ONE `category` and a `produces` list; **every name in " +
    "`produces` must appear in that category's table here** (the toolkit's " +
    "`validate` command enforces this). You don't have to produce every field — " +
    "produce what your source actually has.",
)
lines.push("")
lines.push(`_${cats.length} categories in this \`@finsys/core\` version._`)
lines.push("")

for (const c of cats) {
  lines.push(`## ${c.displayName} — \`${c.id}\``)
  lines.push("")
  if (c.description) lines.push(c.description)
  lines.push("")
  lines.push(`Canonical table: \`${c.canonicalTable}\` · ${c.fields.length} fields`)
  lines.push("")
  lines.push("| Field | Type | Unit / range | Description |")
  lines.push("| --- | --- | --- | --- |")
  for (const f of c.fields) {
    lines.push(`| \`${esc(f.name)}\` | ${f.type} | ${esc(unitRange(f))} | ${esc(f.description)} |`)
  }
  lines.push("")
}

writeFileSync(OUT, lines.join("\n") + "\n")
console.log(`wrote ${OUT} (${cats.length} categories)`)
