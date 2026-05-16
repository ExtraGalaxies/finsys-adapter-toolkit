#!/usr/bin/env node
import { validateAdapter } from "./validateAdapter.js"

async function main() {
  const [, , cmd, ...args] = process.argv
  if (cmd !== "validate") {
    printUsage()
    process.exit(2)
  }
  const dir = args[0]
  if (!dir) {
    printUsage()
    process.exit(2)
  }

  const result = await validateAdapter(dir)
  if (result.ok) {
    console.log(`✅ ${dir} — manifest + adapter shape OK`)
    if (result.manifest) {
      console.log(`   id=${result.manifest.id} category=${result.manifest.category} v${result.manifest.version}`)
    }
    process.exit(0)
  }

  console.error(`❌ ${dir} — adapter validation failed:`)
  for (const e of result.errors) {
    console.error(`   • ${e}`)
  }
  process.exit(1)
}

function printUsage() {
  console.error("usage: finsys-adapter-toolkit validate <adapter-directory>")
  console.error("")
  console.error("Validates an adapter directory against @finsys/core's manifest schema +")
  console.error("loads the entry-point module to verify it exports a SourceAdapter.")
  console.error("Exit code: 0 on pass, 1 on fail, 2 on usage error.")
}

main().catch((err) => {
  console.error(`internal error: ${(err as Error).message}`)
  process.exit(3)
})
