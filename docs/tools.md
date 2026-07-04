# Tools Reference — Kiwi / Sentinel

---

## 1. Pytest Runner

**Location:** `sentinel/kiwi_cli.py` (`/test` command), `sentinel/cli.py` (no direct subcommand — called via `ingest`)

Runs the local test suite in a subprocess, captures JUnit XML output, and feeds failures directly into the ingest pipeline.

- **Command**: `uv run pytest --junitxml=junit_report.xml`
- **REPL trigger**: `/test [path]` — runs pytest, ingests `junit_report.xml`, displays reviews
- **Flaky tracking**: each failure bumps a per-test counter in `kiwi_flaky_state.json` (read with `/flaky`)
- **Demo mode**: set `FLAKY_MODE=1` to arm the engineered duplicate-charge race in `app/tests/`

---

## 2. Cognee Memory Client

**Location:** `sentinel/cognee_client.py`

REST wrapper over Cognee Cloud. Two primary operations used by the ingest pipeline:

**`remember(text, dataset, filename)`**
- `POST /api/v1/remember` — multipart file upload
- Cognee runs the `cognify_pipeline` synchronously: chunks text, extracts entities, builds graph nodes/edges, stores embeddings (~20s per call)
- Auth: `X-Api-Key` + `X-Tenant-Id` headers

**`recall(query, dataset, top_k=15)`**
- `POST /api/v1/recall` — JSON body `{query, datasets, topK}`
- Hybrid vector + graph search; returns `[{"text": "..."}, ...]` ranked by relevance (~7s)
- The ingest pipeline takes `hits[0]["text"]` as the recalled history

Both calls are made in `ingest.py` — `recall` before `remember` so a new failure never matches itself.

---

## 3. Review Builder

**Location:** `sentinel/reviewer.py`

Two-stage review generation:

**Stage 1 — LLM draft**

`build_review(result, diff)` sends the failure details + recalled history to the active LLM (`get_llm_client()` resolves provider from state or env). System prompt instructs the model to quote recalled history verbatim and avoid unsupported claims.

**Stage 2 — Grounding lint**

`ground_review(draft, history)` filters the draft: any sentence matching history keywords (`prior`, `previous`, `incident`, `resolved`, etc.) is dropped unless it shares a 4-gram overlap with the recalled text. Non-history sentences pass through unchanged.

**Fallback**

When no LLM API key is configured, `fallback_review(result)` returns a deterministic markdown block quoting the recalled history verbatim — no LLM required, always factual.

**PR posting**

`post_pr_comment(body, repo, pr_number, token)` — `POST https://api.github.com/repos/{repo}/issues/{pr_number}/comments`. Called by `sentinel ingest --post`.
