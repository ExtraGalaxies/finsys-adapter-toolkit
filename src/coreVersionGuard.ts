import { createRequire } from "node:module"

/**
 * SYS-3346 — refuse to validate silently against a core the toolkit does not
 * support.
 *
 * WHY THIS EXISTS, and it is not defensive programming.
 *
 * The toolkit used to declare `@finsys/core` as an ordinary DEPENDENCY, pinned
 * `^4.8.0`. npm resolves that by NESTING: a partner who installs both the
 * toolkit and a current core ends up with two copies in one tree — theirs at
 * the current major, and the toolkit's at 4.x. `validateAdapter` then calls
 * `categoryFieldsOf()` against the STALE one, so it checks a partner's
 * manifest against a two-major-old vocabulary.
 *
 * The failure is symmetric and both halves are silent: a correct manifest is
 * rejected for naming a field the old registry never had, and an obsolete one
 * is accepted because the old registry still has it. Nothing anywhere says two
 * registries are in play.
 *
 * The pin is now a peerDependency, which makes nesting impossible — npm
 * installs one core, the partner's. This guard covers what the peer range
 * cannot: a partner who ignores the peer warning, or a workspace that hoists
 * something unexpected. It reads the version ACTUALLY RESOLVED at runtime
 * rather than the one requested, because those are exactly the cases where
 * they differ.
 */

const require_ = createRequire(import.meta.url)

/** The core majors this toolkit's validation logic is written against. */
export const SUPPORTED_CORE_MAJORS = [6] as const

/** The version of `@finsys/core` this process actually resolved, or null. */
export function resolvedCoreVersion(): string | null {
  try {
    const pkg = require_("@finsys/core/package.json") as { version?: string }
    return typeof pkg.version === "string" ? pkg.version : null
  } catch {
    // Not resolvable as a subpath export on every core line. Unknown is not
    // the same as wrong, so this stays quiet rather than crying wolf.
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
  if (version === null) return
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
