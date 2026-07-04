# Exploration Guide — Kiwi / Sentinel

Code orientation map for contributors and reviewers.

---

## Component Map

| Component | Responsibility | Path |
|---|---|---|
| **Python REPL** | Interactive QA shell — command dispatch, credential management, chat loop | `sentinel/kiwi_cli.py` |
| **CI CLI** | `sentinel` console script — seed / ingest / confirm / forget | `sentinel/cli.py` |
| **Memory Client** | Cognee Cloud REST wrapper (`remember`, `recall`, `forget`, `graph`) | `sentinel/cognee_client.py` |
| **Ingest Pipeline** | recall-before-remember loop, JUnit XML parsing | `sentinel/ingest.py` |
| **Review Engine** | LLM draft + deterministic n-gram grounding lint + PR comment post | `sentinel/reviewer.py` |
| **Lifecycle** | `confirm` (QA/feedback session bridge) and `forget_dataset` | `sentinel/lifecycle.py` |
| **Config** | `.env` priority loader, `Settings` dataclass, auth headers | `sentinel/config.py` |
| **JUnit Adapter** | Parses JUnit XML → `FailureRecord` | `sentinel/adapters/junit.py` |
| **Seed Loader** | Formats and batch-uploads `seed_data.jsonl` | `sentinel/seed_loader.py` |
| **Graph Panel** | Streamlit live graph + recall query box | `viz/graph_panel.py` |
| **Demo App** | Payments service with engineered duplicate-charge race | `app/webhook_service.py` |

---

## Data Flow — CI path

```
FLAKY_MODE=1 pytest app/tests --junitxml=junit_report.xml
        │
        ▼
sentinel ingest junit_report.xml --review --post
        │
        ├─ parse_junit_xml()  →  FailureRecord
        │
        ├─ recall(build_query(failure))
        │        └─ POST /api/v1/recall  →  Cognee Cloud
        │                └─ returns [{"text": prior incident + fix}]
        │
        ├─ remember(format_failure())
        │        └─ POST /api/v1/remember  →  Cognee Cloud
        │
        ├─ build_review(IngestResult)
        │        ├─ ask_llm(provider, client, failure + history)
        │        └─ ground_review(draft, history)  ← n-gram lint
        │
        └─ post_pr_comment()  →  GitHub API
```

## Data Flow — REPL path

```
uv run kiwi
        │
        ├─ /recall <query>   →  client.recall()  →  Cognee Cloud
        ├─ /remember <text>  →  client.remember()  →  Cognee Cloud
        ├─ /test             →  pytest subprocess  →  ingest pipeline (same as CI path)
        ├─ /resolve <fix>    →  lifecycle.confirm()  →  Cognee Cloud (session QA/feedback)
        └─ plain text query  →  recall() for context  →  ask_llm()  →  answer
```

---

## Key Patterns

### 1. LLM resolution

`get_llm_client()` in `sentinel/kiwi_cli.py` returns `(provider, client)` — a 2-tuple. Provider preference is read from `kiwi_session_state.json` (set via `/provider` or `/login`), then falls back to whichever env key is present.

```python
# sentinel/kiwi_cli.py
provider, client = get_llm_client()
```

### 2. Environment priority

`.env` files are loaded with `override=True` in ascending specificity — `.env` loads first (lowest precedence), `.env.local` loads last (highest precedence). Files matching `.example`, `.sample`, `.template`, `.dist` are excluded.

```python
# sentinel/config.py — simplified
for _env_file in sorted(_env_files, key=_env_load_order):
    load_dotenv(_env_file, override=True)
```

### 3. Grounding lint

`ground_review()` in `sentinel/reviewer.py` drops sentences that reference history keywords (`prior`, `previous`, `incident`, etc.) but share no 4-gram overlap with the recalled text. Non-history sentences are always kept.

### 4. Engineered flake

`app/webhook_service.py` — `FLAKY_MODE=1` routes to `add_charge()` (no idempotency); unset routes to `add_charge_idempotent()`. Two threads race in `process_webhook()` with a 20ms artificial latency, guaranteeing the race fires.
