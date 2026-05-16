import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import express from "express"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Built-in 3-persona data — what consumers get with zero config.
// COHORT_DATA_FILE env var overrides with a larger keyed-by-IC dataset
// (used by finsim's 100-applicant cohort replay).
const DEFAULT_DATA = JSON.parse(
  readFileSync(resolve(__dirname, "data/merchants.json"), "utf8"),
)
const COHORT_FILE = process.env.COHORT_DATA_FILE
let MERCHANTS = DEFAULT_DATA
if (COHORT_FILE && existsSync(COHORT_FILE)) {
  const cohort = JSON.parse(readFileSync(COHORT_FILE, "utf8"))
  MERCHANTS = { ...DEFAULT_DATA, ...cohort }
  console.log(`[fake-payments-api] loaded cohort overlay from ${COHORT_FILE} (${Object.keys(cohort).length} records, plus ${Object.keys(DEFAULT_DATA).length - 1} built-in personas)`)
}

const PORT = Number(process.env.PORT ?? 4200)
const API_KEY = process.env.FAKE_PAYMENTS_API_KEY ?? "demo-key"

const app = express()
app.use(express.json({ limit: "256kb" }))

app.use((req, res, next) => {
  if (req.path === "/health") return next()
  const provided = req.header("x-api-key")
  if (provided !== API_KEY) {
    return res.status(401).json({ error: "invalid_api_key" })
  }
  next()
})

app.get("/health", (_req, res) => {
  res.json({ ok: true, merchants: Object.keys(MERCHANTS).filter((k) => k !== "_comment").length })
})

app.post("/v1/merchants/lookup", (req, res) => {
  const { ic, fullName } = req.body ?? {}
  if (!ic || typeof ic !== "string") {
    return res.status(400).json({ error: "ic_required" })
  }
  const record = MERCHANTS[ic]
  if (!record || record._comment) {
    return res.status(404).json({ error: "merchant_not_found", ic })
  }
  res.json({
    ic,
    requestedName: fullName ?? null,
    matchedMerchantName: record.merchantName,
    merchantSince: record.merchantSince,
    paymentsMetrics: {
      monthlyVolumeMyrT3: record.monthlyVolumeMyrT3,
      monthlyVolumeMyrT12: record.monthlyVolumeMyrT12,
      arpuStability12m: record.arpuStability12m,
      disputeRate12m: record.disputeRate12m,
      customerConcentrationTop5Pct: record.customerConcentrationTop5Pct,
      activeTenureMonths: record.activeTenureMonths,
    },
  })
})

app.listen(PORT, () => {
  const count = Object.keys(MERCHANTS).filter((k) => k !== "_comment").length
  console.log(`[fake-payments-api] listening on :${PORT} — ${count} merchants loaded`)
})
