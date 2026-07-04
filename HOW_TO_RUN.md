# How to Run — Kiwi / Sentinel

Full setup and demo walkthrough for the Python REPL + Streamlit stack.

---

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) — install with `pip install uv` or the shell installer
- A [Cognee Cloud](https://cognee.ai) tenant (free tier works — grab `COGNEE_BASE_URL`, `COGNEE_API_KEY`, `COGNEE_TENANT_ID` from the dashboard)
- At least one LLM key (`ANTHROPIC_API_KEY` or `GEMINI_API_KEY`) — optional; without one, reviews fall back to the deterministic memory-quoting path

---

## Step 1 — Configure credentials

```bash
cp .env.example .env
```

Open `.env` and fill in the three required values:

```env
COGNEE_BASE_URL=https://tenant-<your-id>.aws.cognee.ai
COGNEE_API_KEY=<your-api-key>
COGNEE_TENANT_ID=<your-tenant-id>

# Optional — needed for LLM-generated reviews
ANTHROPIC_API_KEY=<key>
GEMINI_API_KEY=<key>

# Optional — needed for posting PR comments via sentinel ingest --post
GITHUB_TOKEN=<token>
```

`.env.local` overrides `.env` if you need machine-local overrides without touching `.env`.

---

## Step 2 — Install

```bash
uv sync
```

Installs all dependencies and the `sentinel` + `kiwi` console scripts into `.venv`.

---

## Step 3 — Seed historical memory

```bash
uv run sentinel seed
```

Loads 20 pre-written historical failure records into the `sentinel` dataset on Cognee Cloud as a single batched call. Takes ~20s (Cognee cognifies synchronously).

Records 1 and 2 are deliberate semantic matches for the engineered double-charge flake — they are what gets recalled in the demo.

**Only needs to run once per Cognee tenant.** If you wipe the dataset with `sentinel forget --dataset sentinel`, re-run this.

---

## Step 4 — Trigger the engineered flake

PowerShell:
```powershell
$env:FLAKY_MODE="1"; uv run pytest app/tests --junitxml=junit_report.xml
```

Bash / CI:
```bash
FLAKY_MODE=1 uv run pytest app/tests --junitxml=junit_report.xml
```

`test_concurrent_retry_creates_single_charge` will fail deterministically: two threads race on `add_charge` without an idempotency key, producing two charges instead of one. Output is `junit_report.xml`.

Without `FLAKY_MODE`, `add_charge_idempotent` is used instead and the test passes — that is the fixed path.

---

## Step 5 — Ingest the failure and get a review

```bash
uv run sentinel ingest junit_report.xml --review
```

This is the core demo moment:

1. Parses `junit_report.xml` → `FailureRecord`
2. Calls `recall()` against Cognee — semantic search over the seeded history
3. Prints the matched prior incident (the 2026-03-14 duplicate-charge record)
4. Calls `remember()` — stores the new failure in the graph
5. Builds a grounded review quoting the recalled history
6. Prints the review

To also post the review as a GitHub PR comment:

```bash
GITHUB_TOKEN=<token> uv run sentinel ingest junit_report.xml --review \
  --post --repo <owner>/<repo> --pr <number>
```

To run in CI without ever failing the build (Cognee/LLM errors are soft):

```bash
uv run sentinel ingest junit_report.xml --review --ci
```

---

## Step 6 — Graph visualization

```bash
uv run streamlit run viz/graph_panel.py
```

Opens at `http://localhost:8501`.

- **Left panel**: recall query box — type a query and hit Recall to see matched memories
- **Right panel**: live Cognee knowledge graph rendered with pyvis (nodes + edges from the `sentinel` dataset)

The graph is populated after Step 3 (seed) and grows with each `sentinel ingest` run.

---

## Step 7 — Interactive REPL

```bash
uv run kiwi
```

Rich-based Python REPL. Key commands to try after completing Steps 3–5:

```
/recall double charge after concurrent retries
/history test_concurrent_retry_creates_single_charge
/flaky
/test app/tests
/resolve added idempotency key on charge creation
/session
```

`/login` lets you set Cognee credentials and LLM provider interactively if you haven't configured `.env`.

---

## Running the unit tests

```bash
uv run pytest
```

53 tests, no network required. Integration tests (marked `integration`) are excluded by default — run explicitly with:

```bash
uv run pytest -m integration
```

---

## Environment variable reference

| Variable | Required | Default | Notes |
|---|---|---|---|
| `COGNEE_BASE_URL` | Yes | — | Tenant URL from Cognee dashboard |
| `COGNEE_API_KEY` | Yes | — | Cognee API key |
| `COGNEE_TENANT_ID` | Yes | — | Cognee tenant ID |
| `SENTINEL_DATASET` | No | `sentinel` | Dataset name in Cognee |
| `ANTHROPIC_API_KEY` | No | — | Claude-generated reviews |
| `GEMINI_API_KEY` | No | — | Gemini-generated reviews |
| `GITHUB_TOKEN` | No | — | PR comment posting via `--post` |
| `FLAKY_MODE` | No | — | Set to `1` to arm the engineered duplicate-charge race |

---

## Resetting memory

Clear the dataset and re-seed:

```bash
uv run sentinel forget --dataset sentinel
uv run sentinel seed
```

Or wipe everything on the tenant:

```bash
uv run sentinel forget --dataset sentinel --memory-only
```
