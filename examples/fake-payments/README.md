# fake-payments — reference adapter + fake upstream

A complete, runnable example of a `payment-network` FinSys Source Adapter:

- **`api/`** — a tiny Express service (`fake-payments-api`) that serves
  canned per-merchant payment metrics for three personas (strong /
  mid / weak). Stand-in for a real iPay88 or GHL merchant lookup.
- **`adapter/`** — `fake-payments-v1`, a `payment-network` adapter that
  calls the fake API via `fetch(identity)` and translates the response
  into canonical payment-network fields.
- **`docker-compose.yml`** — brings up the fake API in a container.

Same shape as the sibling `fake-telco` example, and uses the **same
IC identity key** as `fake-telco-v1` — a single applicant's identity
drives both adapters in the same lifecycle hook.

## Personas

| IC | Persona | Monthly vol (MYR) | Dispute rate | Customer conc. | Tenure |
|---|---|---|---|---|---|
| `850101015432` | A — strong | 285k T3 / 240k T12 | 0.08% | 18% top-5 | 38 mo |
| `920514075321` | B — mid    | 95k T3 / 88k T12   | 0.4%  | 33% top-5 | 22 mo |
| `991230146789` | C — weak   | 12.5k T3 / 18.4k T12 | 2.7% | 71% top-5 | 5 mo  |

A scoring eval policy weighted on these canonical fields will rank
A > B > C cleanly. Combined with the sibling `fake-telco-v1`, the two
adapters give congruent signal from independent sources — the
**cross-source agreement** is the demo punchline.

## Try it locally

### Stand the fake API up by itself

```bash
cd examples/fake-payments
docker compose up --build

# Health
curl http://localhost:4200/health

# Lookup
curl -H "x-api-key: demo-key" \
     -H "content-type: application/json" \
     -X POST http://localhost:4200/v1/merchants/lookup \
     -d '{"ic":"850101015432","fullName":"Hassan Trading"}'
```

### Validate the adapter against the contract

From the toolkit root:

```bash
node dist/cli.js validate ./examples/fake-payments/adapter
```

### Run inside FinSys / FinSim

1. Bring up `fake-payments-api`.
2. Mount `examples/fake-payments/adapter/` into the host's adapters
   dir. Env-wire `FAKE_PAYMENTS_API_URL` + `FAKE_PAYMENTS_API_KEY`.
3. Boot finsys-api. On startup it discovers `fake-payments-v1`
   alongside any other adapters and logs `adapters registered: N`.
4. Drive an IHS to `APPLICATION_FINALIZED`. The host calls
   `adapter.fetch(identity)` per adapter — telco hits its API,
   payments hits its API — both write to their own canonical
   table (`ihs_alt_data_telco`, `ihs_alt_data_payments`).
5. The eval engine sees the merged canonical fields on the next
   `getIhsDetailsById()` and scores using whatever weights the
   lender's policy declares for each field.

## Cohort-aware mode

For larger cohorts (e.g. FinSim's 100-applicant run), mount a
`cohort-payments.json` (keyed by IC → lookup response) into the API
container and set `COHORT_DATA_FILE=/path/to/cohort-payments.json`.
The API overlays the cohort data on top of the 3 built-in personas.
See `finsim/scripts/generate-cohort-data.py` for the generator.
