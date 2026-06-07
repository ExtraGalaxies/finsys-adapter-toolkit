import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import express from "express"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Built-in 3-persona data — what consumers get with zero config.
// COHORT_DATA_FILE env var overrides with a larger keyed-by-IC dataset.
const DEFAULT_DATA = JSON.parse(
  readFileSync(resolve(__dirname, "data/applicants.json"), "utf8"),
)
const COHORT_FILE = process.env.COHORT_DATA_FILE
let APPLICANTS = DEFAULT_DATA
if (COHORT_FILE && existsSync(COHORT_FILE)) {
  const cohort = JSON.parse(readFileSync(COHORT_FILE, "utf8"))
  APPLICANTS = { ...DEFAULT_DATA, ...cohort }
  console.log(
    `[fake-trade-credit-api] loaded cohort overlay from ${COHORT_FILE} (${Object.keys(cohort).length} records)`,
  )
}

const PORT = Number(process.env.PORT ?? 4300)
const API_KEY = process.env.FAKE_TRADE_CREDIT_API_KEY ?? "demo-key"

const app = express()
app.use(express.json({ limit: "256kb" }))

app.use((req, res, next) => {
  if (req.path === "/health") return next()
  if (req.header("x-api-key") !== API_KEY) {
    return res.status(401).json({ error: "invalid_api_key" })
  }
  next()
})

app.get("/health", (_req, res) => {
  res.json({ ok: true, applicants: Object.keys(APPLICANTS).length })
})

// Returns the raw accounting summary (AR/AP + P&L) for an account, the way a
// real accounting-data provider's API would. The adapter maps it to canonical.
app.post("/v1/accounts/lookup", (req, res) => {
  const { ic, fullName } = req.body ?? {}
  if (!ic || typeof ic !== "string") {
    return res.status(400).json({ error: "ic_required" })
  }
  const record = APPLICANTS[ic]
  if (!record || record._comment) {
    return res.status(404).json({ error: "account_not_found", ic })
  }
  res.json({
    ic,
    requestedName: fullName ?? null,
    matchedName: record.displayName,
    accountsReceivable: record.accountsReceivable,
    accountsPayable: record.accountsPayable,
    incomeStatement12m: record.incomeStatement12m,
    tradeReferences: record.tradeReferences,
    metrics: record.metrics,
  })
})

app.listen(PORT, () => {
  console.log(`[fake-trade-credit-api] listening on :${PORT} (${Object.keys(APPLICANTS).length} applicants)`)
})
