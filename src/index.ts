/**
 * @finsys/adapter-toolkit — partner SDK for the FinSys Source Adapter
 * Framework. Validator + harness + mock consumer for adapter authors
 * who want to develop + test their adapter without standing up the
 * full FinSys stack.
 *
 * v0.1.0 minimum-viable surface; expanding as adapter-partner feedback
 * sharpens what partners actually need.
 */

export { validateAdapter, type ValidateAdapterResult } from "./validateAdapter.js"
export { runFixtures, type FixtureResult, type Fixture } from "./runFixtures.js"
export { MockConsumer } from "./MockConsumer.js"

// SYS-2554: re-export the Source Adapter contract from @finsys/core so an
// integrator gets the full type + helper surface from ONE import
// (`@finsys/adapter-toolkit`) instead of also having to discover and depend
// on @finsys/core directly to find the interfaces they implement against.
export type {
  SourceAdapter,
  AdapterManifest,
  AdapterExtraction,
  ApplicantIdentity,
  RawPayload,
  AdapterCategory,
  CanonicalFieldName,
  CanonicalFieldValues,
  CategorySchema,
  CanonicalFieldSpec,
} from "@finsys/core"
export {
  AdapterError,
  categoryFieldsOf,
  categoryForField,
  allCategories,
  isAdapterCategory,
  assertAdapterCategory,
  ADAPTER_CATEGORY_IDS,
} from "@finsys/core"
