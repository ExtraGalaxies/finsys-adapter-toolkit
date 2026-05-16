/**
 * @finsys/adapter-toolkit — partner SDK for the FinSys Source Adapter
 * Framework. Validator + harness + mock consumer for adapter authors
 * who want to develop + test their adapter without standing up the
 * full FinSys stack.
 *
 * v0.1.0 minimum-viable surface; expanding as Celcom-side feedback
 * sharpens what partners actually need.
 */

export { validateAdapter, type ValidateAdapterResult } from "./validateAdapter.js"
export { runFixtures, type FixtureResult, type Fixture } from "./runFixtures.js"
export { MockConsumer } from "./MockConsumer.js"
