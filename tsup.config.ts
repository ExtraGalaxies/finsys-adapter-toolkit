import { defineConfig } from "tsup"

// ESM only for v0.1.0 — validateAdapter uses createRequire(import.meta.url)
// to resolve the @finsys/core JSON schema, which doesn't survive tsup's
// CJS transform. Node 24+ is ESM-native; revisit if a partner needs CJS.
export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
})
