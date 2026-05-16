import { existsSync, readFileSync, realpathSync, statSync } from "node:fs"
import { resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"
import { createRequire } from "node:module"

import { Ajv, type ValidateFunction } from "ajv"
import {
  type AdapterManifest,
  type SourceAdapter,
  categoryFieldsOf,
} from "@finsys/core"

const require_ = createRequire(import.meta.url)
const manifestSchema = require_("@finsys/core/schema/adapter-manifest") as object
const ajv = new Ajv({ allErrors: true })
const validateManifestSchema = ajv.compile(manifestSchema) as ValidateFunction

export interface ValidateAdapterResult {
  ok: boolean
  errors: string[]
  manifest?: AdapterManifest
  adapter?: SourceAdapter
}

/**
 * Validates an adapter directory against the @finsys/core contract.
 *
 * Checks:
 *   - manifest.json exists and parses
 *   - manifest validates against the JSON-schema
 *   - `produces` is a subset of the category's canonical fields
 *   - For typescript adapters: entryPoint resolves inside the dir,
 *     module loads, exports a default or `adapter` matching the
 *     manifest's id + category
 *   - For typescript adapters that declare `requiredIdentityFields`:
 *     the loaded module exports a `fetch` function (declaration
 *     mismatch is a contract bug)
 *
 * Returns a structured result so partner CI can drive on it. Use the
 * CLI (`finsys-adapter-toolkit validate ./my-adapter`) for a
 * human-friendly exit code.
 */
export async function validateAdapter(dir: string): Promise<ValidateAdapterResult> {
  const errors: string[] = []
  const absDir = resolve(dir)

  if (!existsSync(absDir) || !statSync(absDir).isDirectory()) {
    return { ok: false, errors: [`adapter dir not found or not a directory: ${absDir}`] }
  }

  const manifestPath = resolve(absDir, "manifest.json")
  if (!existsSync(manifestPath)) {
    return { ok: false, errors: [`manifest.json missing in ${absDir}`] }
  }

  let manifest: AdapterManifest
  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf8"))
    if (!validateManifestSchema(raw)) {
      const schemaErrors =
        validateManifestSchema.errors?.map(
          (e) => `${e.instancePath || "<root>"} ${e.message ?? "(no message)"}`,
        ) ?? ["unknown schema error"]
      return { ok: false, errors: [`manifest schema validation failed:`, ...schemaErrors] }
    }
    manifest = raw as AdapterManifest
  } catch (err) {
    return { ok: false, errors: [`manifest parse failed: ${(err as Error).message}`] }
  }

  // Cross-check: produces must be subset of category's canonical fields.
  const allowed = new Set(categoryFieldsOf(manifest.category))
  const outOfCategory = manifest.produces.filter((f) => !allowed.has(f))
  if (outOfCategory.length > 0) {
    errors.push(
      `manifest produces fields not in category '${manifest.category}': ${outOfCategory.join(", ")}`,
    )
  }

  let adapter: SourceAdapter | undefined
  if (manifest.implementation.type === "typescript") {
    const entryPath = resolve(absDir, manifest.implementation.entryPoint)
    const adapterRoot = resolve(absDir) + sep
    if (!entryPath.startsWith(adapterRoot)) {
      errors.push(
        `entryPoint escapes adapter dir: ${manifest.implementation.entryPoint}`,
      )
    } else if (!existsSync(entryPath)) {
      errors.push(`entryPoint file does not exist: ${entryPath}`)
    } else if (!realpathStartsWith(entryPath, absDir)) {
      // Symlink-safety: `resolve` + `startsWith` checks the LITERAL
      // path; it does NOT follow symlinks. A partner could (intentionally
      // or by accident) put a symlink inside the adapter dir pointing
      // to /etc/passwd or another package's source; the literal-path
      // check passes but the dynamic import follows the symlink. Use
      // realpathSync to resolve any symlinks first, then re-check
      // that the resolved path is still inside the adapter root.
      errors.push(
        `entryPoint resolves (via symlink or junction) outside the adapter dir: ${manifest.implementation.entryPoint}`,
      )
    } else {
      try {
        const mod = (await import(pathToFileURL(entryPath).href)) as {
          default?: SourceAdapter
          adapter?: SourceAdapter
        }
        const candidate = mod.default ?? mod.adapter
        if (!candidate || typeof candidate.extract !== "function") {
          errors.push(
            `entryPoint must export 'default' or 'adapter' implementing SourceAdapter`,
          )
        } else {
          adapter = candidate
          if (candidate.id !== manifest.id) {
            errors.push(
              `adapter exports id='${candidate.id}' but manifest says '${manifest.id}'`,
            )
          }
          if (candidate.category !== manifest.category) {
            errors.push(
              `adapter exports category='${candidate.category}' but manifest says '${manifest.category}'`,
            )
          }
          // SYS-2460: if adapter declares requiredIdentityFields but
          // doesn't implement fetch(), the host can't actually use them.
          if (
            (manifest.requiredIdentityFields?.length ?? 0) > 0 &&
            typeof candidate.fetch !== "function"
          ) {
            errors.push(
              `manifest declares requiredIdentityFields but the adapter does not export fetch() — the host will skip it`,
            )
          }
        }
      } catch (err) {
        errors.push(`entryPoint import failed: ${(err as Error).message}`)
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    manifest,
    adapter,
  }
}

/**
 * True iff realpath(child) is contained within realpath(parent).
 * Returns false on realpath errors (broken symlinks, EACCES) so the
 * caller treats unresolvable paths as out-of-bounds.
 */
function realpathStartsWith(child: string, parent: string): boolean {
  try {
    const realChild = realpathSync(child)
    const realParent = realpathSync(parent) + sep
    return realChild.startsWith(realParent)
  } catch {
    return false
  }
}
