# fake-telco — reference adapter + fake upstream

A complete, runnable example of a FinSys Source Adapter:

- **`api/`** — a tiny Express service (`fake-telco-api`) that serves canned
  per-applicant payment histories for three personas (strong / mid / weak).
  Stand-in for a real carrier API. Lookup is by IC (Malaysian national ID).
- **`adapter/`** — `fake-telco-v1`, a `telco-carrier` adapter that calls
  the fake API via `fetch(identity)` and translates the response into
  canonical telco fields via `extract(raw)`.
- **`docker-compose.yml`** — brings up the fake API in a container; the
  adapter is a directory you mount into a FinSys / FinSim stack alongside.

The same shape (`manifest.json` + `extract.mjs` + optional `fetch`) is what
a partner ships when building a real adapter against Celcom, NTT/iPay88,
GHL, etc.

## Personas

| IC | Persona | Tenure | On-time | Late | Unpaid |
|---|---|---|---|---|---|
| `850101015432` | A — strong  | ~36 mo | 24 | 0 | 0 |
| `920514075321` | B — mid     | ~18 mo | 14 | 4 | 0 |
| `991230146789` | C — weak    | ~9 mo  | 3  | 4 | 2 |

The eval engine should score A > B > C cleanly on the canonical telco
fields the adapter emits. That ordering is the e2e signal that the
framework is wired through from upstream API → canonical store →
scoring.

## Try it locally

### Stand the fake API up by itself

```bash
cd examples/fake-telco
docker compose up --build

# Health
curl http://localhost:4100/health

# Lookup
curl -H "x-api-key: demo-key" \
     -H "content-type: application/json" \
     -X POST http://localhost:4100/v1/subscribers/lookup \
     -d '{"ic":"850101015432","fullName":"Aiman bin Hassan"}'
```

### Validate the adapter against the contract

From the toolkit root, after `npm install && npm run build`:

```bash
node dist/cli.js validate ./examples/fake-telco/adapter
```

The CLI parses `manifest.json`, validates it against the `@finsys/core`
JSON-schema, loads `extract.mjs`, and confirms the export shape matches
the manifest's `id` and `category`. Exit code 0 means the adapter is
ready to drop into a FinSys host.

### Run inside FinSys / FinSim

1. Bring up `fake-telco-api` (above).
2. Mount `examples/fake-telco/adapter/` into the host's adapters dir
   (default `/app/adapters` in finsys-api). Point the adapter at the
   API via env vars:
   ```yaml
   environment:
     FAKE_TELCO_API_URL: http://fake-telco-api:4100
     FAKE_TELCO_API_KEY: demo-key
   ```
3. Boot finsys-api. On startup it discovers `fake-telco-v1` and logs
   `adapters registered: 1`.
4. Drive an IHS to `APPLICATION_FINALIZED`. The host calls
   `adapter.fetch(identity)` with the applicant's IC + name, persists
   the raw payload, then `adapter.extract(...)` and writes canonical
   rows into `ihs_alt_data_telco`.
5. The eval engine sees the canonical fields on the next
   `getIhsDetailsById()` and scores accordingly.

## Why this is a useful reference

- **Self-contained.** No real carrier credentials needed. Clone, build,
  run.
- **Realistic shape.** `fetch(identity)` returns a real HTTP payload
  the adapter then transforms — the same flow a Celcom or GHL adapter
  follows.
- **Tunable.** Edit `api/data/applicants.json` to add personas or
  change values, then exercise the eval engine against the new
  numbers without touching either the adapter or the host.
