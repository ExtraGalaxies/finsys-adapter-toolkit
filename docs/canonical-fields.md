# Canonical fields by category

> Auto-generated from `@finsys/core` by `scripts/gen-canonical-fields.mjs` — do not edit by hand. Regenerate with `npm run docs:canonical-fields` after a core bump.

Each category below is a kind of alternative data FinHero can ingest. Your adapter declares ONE `category` and a `produces` list; **every name in `produces` must appear in that category's table here** (the toolkit's `validate` command enforces this). You don't have to produce every field — produce what your source actually has.

_5 categories in this `@finsys/core` version._

## Telco Carrier — `telco-carrier`

Mobile carrier bill-payment + account-history signals. Any mobile carrier implementing this category produces the same canonical field set.

Canonical table: `ihs_alt_data_telco` · 7 fields

| Field | Type | Unit / range | Description |
| --- | --- | --- | --- |
| `telcoOnTimePaymentRatio24m` | number | ratio [0, 1] | Fraction of bills paid on time over the last 24 months. Strongest single telco predictor; ≥0.95 is the clean-history signal. |
| `telcoTenureMonths` | number | months [0, 600] | Account age. ≥48 months is the thin-file uplift trigger. |
| `telcoSuspensionsCount24m` | number | count [0, 100] | Non-payment-driven account suspensions in the last 24 months. ≥3 is a strong distress signal. |
| `telcoLateDays24m` | number | days [0, 800] | Cumulative days late across all bills in the trailing 24-month window. |
| `telcoHandsetFinancingActive` | boolean | — | Has an active handset-EMI account currently. Proxy for financing capacity already extended. |
| `telcoHandsetFinancingDelinquent` | boolean | — | Recent handset-EMI delinquency in the last 24 months. Distress signal even with otherwise clean bill payment. |
| `telcoArpuMyr` | number | MYR [0, 10000] | Average Revenue Per User (monthly) in Malaysian Ringgit. Coarse spending-capacity proxy. |

## Payment Network — `payment-network`

Merchant-side payment-flow signals from POS / payment-gateway networks. Captures actual transaction velocity rather than self-reported revenue.

Canonical table: `ihs_alt_data_payments` · 6 fields

| Field | Type | Unit / range | Description |
| --- | --- | --- | --- |
| `paymentsMonthlyVolumeMyrT3` | number | MYR [0, 100000000] | Mean monthly inbound transaction volume (RM) over the trailing 3 months. |
| `paymentsMonthlyVolumeMyrT12` | number | MYR [0, 100000000] | Mean monthly inbound transaction volume (RM) over the trailing 12 months. Pair with T3 for trend direction. |
| `paymentsArpuStability12m` | number | ratio [0, 1] | Coefficient-of-variation inverse over monthly ARPU in the trailing 12 months. Closer to 1 = steadier; closer to 0 = volatile. |
| `paymentsDisputeRate12m` | number | ratio [0, 1] | Fraction of transactions disputed or refunded in the trailing 12 months. |
| `paymentsCustomerConcentrationTop5Pct` | number | ratio [0, 1] | Revenue share from the top-5 recurring customers. Above ~0.7 is concentration risk. |
| `paymentsActiveTenureMonths` | number | months [0, 600] | Months since first transaction on the payment network. Establishment / continuity proxy. |

## Bank Statement — `bank-statement`

Per-month bank-statement extractions. Naturally multi-instance: one statement per (account, month). Eval components typically aggregate across instances (sum closing balance, max debit, count of bounced transactions).

Canonical table: `ihs_alt_data_bank_statements` · 6 fields

| Field | Type | Unit / range | Description |
| --- | --- | --- | --- |
| `bankStatementMonth` | string | — | Statement period in YYYY-MM format. Used as the instance_key discriminator + by the `latest` aggregation operator. |
| `bankClosingBalanceMyr` | number | MYR [-100000000, 100000000] | Closing balance for the statement period. |
| `bankTotalCreditsMyr` | number | MYR [0, 100000000] | Sum of credit transactions during the period. |
| `bankTotalDebitsMyr` | number | MYR [0, 100000000] | Sum of debit transactions during the period. |
| `bankLargestSingleCreditMyr` | number | MYR [0, 100000000] | Largest single inbound transaction in the period. Useful for spotting one-off injections vs steady revenue. |
| `bankBouncedTransactionsCount` | number | count [0, 1000] | Bounced / returned transactions in the period. Distress signal at counts > 0. |

## Social Media Presence — `social-media`

Public business-presence signals from social / commerce platforms — establishment, reach, engagement authenticity, customer reputation, and account standing. Vendor-agnostic: any platform exposing a public business profile maps its data to this canonical field set. Useful as thin-file corroboration of a borrower's operating reality where formal financials are sparse.

Canonical table: `ihs_alt_data_social_media` · 8 fields

| Field | Type | Unit / range | Description |
| --- | --- | --- | --- |
| `socialAccountTenureMonths` | number | months [0, 600] | Age of the oldest verified public business presence across linked profiles. Establishment / continuity proxy, parallel to telco + payment-network tenure. |
| `socialFollowerCount` | number | count [0, 100000000] | Aggregate audience size across linked public profiles. Coarse reach / scale proxy — gameable on its own, so read alongside socialEngagementRate90d. |
| `socialEngagementRate90d` | number | ratio [0, 1] | Mean interactions per impression over the trailing 90 days. Authenticity signal: a large follower count with near-zero engagement indicates a bought or dormant audience. |
| `socialPostingConsistency12m` | number | ratio [0, 1] | Fraction of weeks in the trailing 12 months with at least one public post. Ongoing-operation signal — distinguishes an active business from a stale listing. |
| `socialVerifiedBusinessAccount` | boolean | — | Has at least one platform-verified business / commerce profile. Legitimacy signal — the platform has performed its own business-identity check. |
| `socialCustomerRatingAvg` | number | rating [0, 5] | Mean public customer rating (normalised to a 0–5 scale) across review-bearing profiles. Reputation signal; especially predictive for consumer-facing SMEs. |
| `socialNegativeSentimentRatio90d` | number | ratio [0, 1] | Fraction of public mentions / reviews classified as negative over the trailing 90 days. Reputation-risk / distress signal independent of overall rating volume. |
| `socialAccountFlags24m` | number | count [0, 100] | Policy strikes, suspensions, or content takedowns across linked profiles in the last 24 months. Distress signal, parallel to telcoSuspensionsCount24m. |

## Trade Credit (Accounting) — `trade-credit`

Accounts-receivable / accounts-payable aging and ledger-derived working-capital signals sourced from a business's accounting / ERP system. Captures how promptly the business collects from its debtors and pays its creditors, the aging profile and concentration of its receivables, and P&L / cash-conversion efficiency. Vendor-agnostic: any accounting or ERP system that exposes an AR/AP aging report plus a P&L summary maps its data to this canonical field set. A direct, high-signal view of trade-obligation behaviour — closer to formal credit history than most alternative data — and the anchor for cross-referencing self-reported accounting figures against bank-statement reality.

Canonical table: `ihs_alt_data_trade_credit` · 10 fields

| Field | Type | Unit / range | Description |
| --- | --- | --- | --- |
| `arDaysSalesOutstanding` | number | days [0, 400] | Days Sales Outstanding — average days to collect a receivable. The headline collection-efficiency metric; lower is healthier, and a rising DSO is an early liquidity-stress signal. |
| `apDaysPayableOutstanding` | number | days [0, 400] | Days Payable Outstanding — average days the business takes to pay its suppliers. Context for DSO; a very high DPO can indicate the business is stretching its creditors to fund operations. |
| `arTotalOutstandingMyr` | number | MYR [0, 1000000000] | Total accounts-receivable balance outstanding (RM). The size of the debtor book the business is carrying. |
| `arCurrentRatio` | number | ratio [0, 1] | Fraction of the receivables book that is current (within payment terms, not yet overdue). Higher is healthier; the complement is the overdue share across all aging buckets. |
| `arOverdue90PlusRatio` | number | ratio [0, 1] | Fraction of the receivables book aged more than 90 days past terms. The key impairment / bad-debt risk signal from the AR aging report; elevated values indicate collection difficulty. |
| `debtorConcentrationTop5Ratio` | number | ratio [0, 1] | Share of total receivables owed by the top-5 debtors. Above ~0.6 is single-customer concentration risk — one debtor default would materially impair cash flow. |
| `tradeReferenceDefaults12m` | number | count [0, 1000] | Count of supplier-reported defaults or dishonoured / returned payments against the business in the trailing 12 months. Direct distress signal, parallel to a bureau default record. |
| `accountingRevenue12mMyr` | number | MYR [0, 1000000000] | Trailing-12-month turnover per the general ledger (RM). The cross-reference anchor: comparing this self-reported accounting revenue against payment-network volume and bank-statement inflows surfaces book-vs-reality inconsistencies. |
| `grossMarginPct` | number | ratio [0, 1] | Gross margin from the P&L (gross profit / revenue). Profitability-quality signal; a thin or declining margin constrains debt-service capacity even at healthy revenue. |
| `cashConversionCycleDays` | number | days [-200, 600] | Cash Conversion Cycle (DSO + days-inventory-outstanding − DPO). Working-capital efficiency; negative values (collect before paying suppliers) are strongest, very high values indicate cash tied up in operations. |

