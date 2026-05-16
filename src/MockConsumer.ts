import type {
  AdapterCategory,
  AdapterExtraction,
  AdapterErrorReason,
  CanonicalFieldValues,
} from "@finsys/core"

/**
 * In-memory stand-in for FinSys's persistence layer
 * (AdapterStorageService). Mirrors the contract just enough that
 * partners can do a full round-trip locally:
 *
 *   adapter.extract(raw) → MockConsumer.persistExtraction(...)
 *   → MockConsumer.getCanonicalRowsForIhs(ihsId)
 *   → assert against expected
 *
 * Replace-on-rerun semantics match the real persistence layer:
 * persistExtraction for a (ihsId, adapterId) tuple drops any prior-
 * run rows for that tuple before writing the new instance set.
 */
export class MockConsumer {
  private rawPayloads: Array<{
    id: number
    ihsId: number
    adapterId: string
    adapterVersion: number
    payload: unknown
    receivedAt: Date
  }> = []

  private adapterRuns: Array<{
    id: number
    ihsId: number
    adapterId: string
    adapterVersion: number
    rawPayloadId: number | null
    status: "succeeded" | "failed"
    reason: AdapterErrorReason | null
    message: string | null
    ranAt: Date
  }> = []

  private canonicalRows: Map<
    AdapterCategory,
    Array<{
      id: number
      ihsId: number
      adapterId: string
      adapterVersion: number
      adapterRunId: number
      instanceKey: string
      observedAt: Date
      values: CanonicalFieldValues
    }>
  > = new Map([
    ["telco-carrier", []],
    ["payment-network", []],
    ["bank-statement", []],
  ])

  private nextId = 1

  saveRawPayload(input: {
    ihsId: number
    adapterId: string
    adapterVersion: number
    payload: unknown
  }): number {
    const id = this.nextId++
    this.rawPayloads.push({ id, ...input, receivedAt: new Date() })
    return id
  }

  recordAdapterRun(input: {
    ihsId: number
    adapterId: string
    adapterVersion: number
    rawPayloadId?: number | null
    status: "succeeded" | "failed"
    reason?: AdapterErrorReason | null
    message?: string | null
  }): number {
    const id = this.nextId++
    this.adapterRuns.push({
      id,
      ihsId: input.ihsId,
      adapterId: input.adapterId,
      adapterVersion: input.adapterVersion,
      rawPayloadId: input.rawPayloadId ?? null,
      status: input.status,
      reason: input.reason ?? null,
      message: input.message ?? null,
      ranAt: new Date(),
    })
    return id
  }

  persistExtraction(input: {
    category: AdapterCategory
    ihsId: number
    adapterId: string
    adapterVersion: number
    adapterRunId: number
    observedAt: Date
    instances: ReadonlyArray<AdapterExtraction>
  }): void {
    const table = this.canonicalRows.get(input.category)
    if (!table) {
      throw new Error(`MockConsumer: unknown category '${input.category}'`)
    }
    // Replace-on-rerun semantics MUST match finsys-api's
    // AdapterStorageService.persistExtraction (see
    // src/services/adapterStorageService.ts:100-141 in finsys-api).
    // Prod uses `Not(adapterRunId)` — it drops rows from OTHER runs of
    // the same (ihs_id, adapter_id) tuple but PRESERVES rows already
    // written by the current run. That matters if an adapter calls
    // persistExtraction twice in one run (unusual but legal), or if
    // tests stage multiple instance batches under the same runId.
    //
    // The older shape (drop ALL prior rows for (ihs, adapter)) gave
    // partners green local tests + red prod surprises when the prod
    // contract preserved current-run rows.
    const surviving = table.filter(
      (r) =>
        !(
          r.ihsId === input.ihsId &&
          r.adapterId === input.adapterId &&
          r.adapterRunId !== input.adapterRunId
        ),
    )
    table.length = 0
    table.push(...surviving)
    // Empty-instances early-out (mirrors prod's behavior: the
    // replace-on-rerun cleanup runs above, but we don't INSERT
    // anything if instances is empty — caller should still
    // recordAdapterRun externally so the audit trail captures it).
    if (input.instances.length === 0) {
      return
    }
    for (const inst of input.instances) {
      table.push({
        id: this.nextId++,
        ihsId: input.ihsId,
        adapterId: input.adapterId,
        adapterVersion: input.adapterVersion,
        adapterRunId: input.adapterRunId,
        instanceKey: inst.instanceKey,
        observedAt: input.observedAt,
        values: inst.values,
      })
    }
  }

  getCanonicalRowsForIhs(ihsId: number): {
    telco: ReturnType<MockConsumer["allCategoryRows"]>
    payments: ReturnType<MockConsumer["allCategoryRows"]>
    bankStatements: ReturnType<MockConsumer["allCategoryRows"]>
  } {
    return {
      telco: this.allCategoryRows("telco-carrier", ihsId),
      payments: this.allCategoryRows("payment-network", ihsId),
      bankStatements: this.allCategoryRows("bank-statement", ihsId),
    }
  }

  /** Diagnostics: every adapter_run row recorded. */
  allRuns() {
    return [...this.adapterRuns]
  }

  /** Diagnostics: every raw_payload row stored. */
  allRawPayloads() {
    return [...this.rawPayloads]
  }

  private allCategoryRows(category: AdapterCategory, ihsId: number) {
    return (this.canonicalRows.get(category) ?? []).filter((r) => r.ihsId === ihsId)
  }
}
