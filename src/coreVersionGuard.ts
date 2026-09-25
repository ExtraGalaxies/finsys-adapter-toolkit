import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { dirname, join, parse } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Refuse to validate silently against a resolved `@finsys/core` this toolkit
 * does not support.
 *
 * `@finsys/core` is a peerDependency, so npm should resolve exactly one copy
 * in a partner's tree. This guard covers the case where that isn't true: a
 * partner who ignores the peer warning, or a workspace that hoists something
 * unexpected, ends up validating against a different major than the one
 * their service actually runs. The failure is silent either way: a correct
 * manifest field can be rejected because the resolved core's registry never
 * had it, and a retired field can be accepted because that registry still
 * does.
 *
 * This reads the version ACTUALLY RESOLVED at runtime rather than the one
 * requested, because those are exactly the cases where they differ.
 */

const require_ = createRequire(import.meta.url)

/**
 * The core majors this toolkit's validation logic is written against.
 *
 * BOTH 6 and 7, and that is a statement about the DATA rather than a
 * convenience. Core 7.0.0 is a types-only major: it replaced the loose
 * `string` vocabulary aliases with generated literal unions and changed no
 * field, no category and no schema. Verified by unpacking published 6.0.2 and
 * diffing its adapter-categories.json against 7.0.0's — byte-identical.
 *
 * So `categoryFieldsOf()` returns the same set under either, and refusing 7
 * would reject a core this toolkit validates perfectly well against. Drop 6
 * from this list only when a 7.x release actually changes the vocabulary.
 */
// Must agree with package.json's peerDependencies["@finsys/core"] — the two
// are one fact declared twice, and tests/toolkit.test.ts holds them together.
// 8: core 8.0.0 removed only its survey-core re-exports; the adapter
// vocabulary this toolkit reads is byte-identical to 7.10.0's.
// 9: core 9.0.0 reshapes the SUBJECT surface (SubjectSource, and the merge in
// subjectViewFromRecords). This toolkit reads none of it — measured the same
// way 8 was: dist/data and dist/schema are byte-identical to published
// 8.1.2's, so categoryFieldsOf() returns the same set under either.
export const SUPPORTED_CORE_MAJORS = [6, 7, 8, 9] as const

/**
 * The version of `@finsys/core` this process actually resolved, or null.
 *
 * Resolves the module ENTRY and walks up to the owning package.json, rather
 * than requiring "@finsys/core/package.json" directly. The direct form is the
 * obvious one and it does not work: core's `exports` map declares only ".",
 * "./schema" and "./schema/adapter-manifest", and Node enforces that map — so
 * the subpath throws ERR_PACKAGE_PATH_NOT_EXPORTED.
 */
export function resolvedCoreVersion(): string | null {
  try {
    let dir = dirname(require_.resolve("@finsys/core"))
    const { root } = parse(dir)
    // Bounded walk: dist/ -> package root is one hop, but a different build
    // layout could nest deeper, and an unbounded loop on a symlink cycle is
    // worse than giving up.
    for (let i = 0; i < 8 && dir !== root; i++) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
          name?: string
          version?: string
        }
        // Check the NAME too: walking up out of a nested install would
        // otherwise report the consumer's own version as core's.
        if (pkg.name === "@finsys/core" && typeof pkg.version === "string") return pkg.version
      } catch {
        // no package.json at this level, or unreadable — keep walking
      }
      dir = dirname(dir)
    }
    return null
  } catch {
    return null
  }
}

let warned = false

/**
 * Warn ONCE if the resolved core is outside the supported majors.
 *
 * A warning rather than a throw, deliberately. The toolkit is a partner's
 * development tool, and taking their build down over a version skew would be a
 * worse first experience than the mis-validation it prevents — while a silent
 * skew is worse than both. So: loud, once, naming both numbers and the fix.
 */
export function assertSupportedCore(): void {
  if (warned) return
  const version = resolvedCoreVersion()
  if (version === null) {
    // "I could not check" is a different fact from "it is fine", and the whole
    // point of this module is that a skew must never be silent. Said once.
    warned = true
    console.warn(
      `[@finsys/adapter-toolkit] could not determine the resolved @finsys/core version, so ` +
        `the supported-major check did not run. Manifests are still validated, but against a ` +
        `vocabulary whose provenance is unverified.`
    )
    return
  }
  const major = Number(version.split(".")[0])
  if (!Number.isFinite(major)) return
  if ((SUPPORTED_CORE_MAJORS as readonly number[]).includes(major)) return

  warned = true
  console.warn(
    `[@finsys/adapter-toolkit] resolved @finsys/core@${version}, but this toolkit ` +
      `validates against major ${SUPPORTED_CORE_MAJORS.join(" or ")}. Manifests will be ` +
      `checked against a vocabulary that is not the one your service uses: a correct ` +
      `field name can be rejected, and a retired one accepted, with no other signal. ` +
      `Install a supported @finsys/core — it is a peerDependency, so there should be ` +
      `exactly one copy in your tree.`
  )
}

/** Test seam: forget that the warning has fired. Not used by the toolkit itself. */
export function __resetCoreVersionWarningForTests(): void {
  warned = false
}
