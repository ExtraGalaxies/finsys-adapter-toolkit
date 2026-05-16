import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import express from "express"

const __dirname = dirname(fileURLToPath(import.meta.url))
const APPLICANTS = JSON.parse(
  readFileSync(resolve(__dirname, "data/applicants.json"), "utf8"),
)

const PORT = Number(process.env.PORT ?? 4100)
const API_KEY = process.env.FAKE_TELCO_API_KEY ?? "demo-key"

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
  res.json({ ok: true, applicants: Object.keys(APPLICANTS).length })
})

app.post("/v1/subscribers/lookup", (req, res) => {
  const { ic, fullName } = req.body ?? {}
  if (!ic || typeof ic !== "string") {
    return res.status(400).json({ error: "ic_required" })
  }
  const record = APPLICANTS[ic]
  if (!record || record._comment) {
    return res.status(404).json({ error: "subscriber_not_found", ic })
  }
  res.json({
    ic,
    requestedName: fullName ?? null,
    matchedName: record.displayName,
    subscriberSince: record.subscriberSince,
    paymentHistory: {
      windowMonths: record.windowMonths,
      billsIssued: record.billsIssued,
      billsPaidOnTime: record.billsPaidOnTime,
      billsPaidLate: record.billsPaidLate,
      billsUnpaid: record.billsUnpaid,
    },
    averageMonthlyArpuMyr: record.averageMonthlyArpuMyr,
    currentPlan: record.currentPlan,
  })
})

app.listen(PORT, () => {
  console.log(`[fake-telco-api] listening on :${PORT} — ${Object.keys(APPLICANTS).filter((k) => k !== "_comment").length} applicants loaded`)
})
