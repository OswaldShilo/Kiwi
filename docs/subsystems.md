# Subsystems Guide — Kiwi / Sentinel

---

## 1. Python REPL Subsystem

**Location:** `sentinel/kiwi_cli.py` — entry point `uv run kiwi`

Rich-based interactive shell. Handles command dispatch, credential management, and the chat-query loop.

- **Command dispatch**: `/recall`, `/remember`, `/test`, `/review`, `/resolve`, `/flaky`, `/history`, `/session`, `/forget`, `/login`, `/provider`, `/model`, `/config`, `/clear`, `/exit`
- **Credentials gate**: `/login` collects Cognee base URL + API key + tenant ID + LLM provider interactively, persists to `kiwi_session_state.json`; `load_settings()` reads the state file first, then falls back to env vars
- **Flaky tracking**: `/test` and `/review` bump per-test failure counters in `kiwi_flaky_state.json`
- **LLM resolution**: `get_llm_client()` returns `(provider, client)` — reads provider preference from state, then falls back to whichever env key is present

---

## 2. CI CLI Subsystem

**Location:** `sentinel/cli.py` — entry point `uv run sentinel`

Subcommands for use in CI pipelines and local automation:

| Subcommand | What it does |
|---|---|
| `sentinel seed` | Bulk-loads `sentinel/seed_data.jsonl` (20 records) into Cognee in one batched call |
| `sentinel ingest <xml> [--review] [--post]` | Parses JUnit XML, recalls history, remembers failure, optionally builds and posts a review |
| `sentinel confirm <test> <resolution> --run-id` | Records engineer confirmation via Cognee's improve mechanism (QA + feedback session entries) |
| `sentinel forget --dataset <name>` | Deletes a dataset from Cognee memory |

All exceptions are swallowed and exit 0 when `--ci` is passed — the pipeline never fails because of Sentinel.

---

## 3. Memory Subsystem

**Location:** `sentinel/cognee_client.py`

Thin wrapper over the Cognee Cloud REST API.

| Method | HTTP call | Purpose |
|---|---|---|
| `remember(text, dataset)` | `POST /api/v1/remember` (multipart) | Cognifies text into the knowledge graph (~20s) |
| `recall(query, dataset)` | `POST /api/v1/recall` (JSON) | Semantic + graph search; returns ranked `[{"text": ...}]` |
| `remember_entry(entry, session_id)` | `POST /api/v1/remember/entry` | QA / feedback entry for the improve mechanism |
| `forget(dataset)` | `POST /api/v1/forget` | Delete a dataset or specific data |
| `datasets()` | `GET /api/v1/datasets/` | List all datasets on the tenant |
| `graph(dataset_id)` | `GET /api/v1/datasets/{id}/graph` | Raw graph nodes + edges for visualization |

Auth is `X-Api-Key` + `X-Tenant-Id` headers on every request. 5xx responses are retried once.

---

## 4. Ingest Pipeline

**Location:** `sentinel/ingest.py`

The recall-before-remember loop run for each failing test in a JUnit XML report:

```
parse_junit_xml(xml_path)
    for each FailureRecord:
        recall(build_query(failure))   ← semantic search before storing
        remember(format_failure())     ← store new failure
    → list[IngestResult(failure, matched, history)]
```

`recall` runs before `remember` so the new failure doesn't match itself on the first ingest. Cognee errors fail soft — `matched=False, history=None`, warning printed, pipeline continues.

---

## 5. Review & Grounding Subsystem

**Location:** `sentinel/reviewer.py`

Two-stage: LLM draft → deterministic grounding lint.

- **`build_review(result)`**: calls the active LLM (resolved via `get_llm_client()`) with the failure + recalled history as context
- **`ground_review(draft, history)`**: drops any sentence that references history (keyword regex) but shares no 4-gram overlap with the recalled text — prevents the LLM from fabricating incident details
- **`fallback_review(result)`**: deterministic fallback when no LLM key is configured — quotes the recalled history verbatim
- **`post_pr_comment(body, repo, pr_number, token)`**: `POST https://api.github.com/repos/{repo}/issues/{pr_number}/comments`

---

## 6. Graph Visualization

**Location:** `viz/graph_panel.py` — `uv run streamlit run viz/graph_panel.py`

Streamlit app with two panels:

- **Left** — recall query box: free-text query sent to `client.recall()`, results rendered as markdown
- **Right** — live graph: `client.datasets()` finds the active dataset, `client.graph(id)` fetches nodes + edges, pyvis renders the network in an HTML iframe

---

## Paused — future development

**`kiwi-ui/` (React + Ink frontend)** and **`app/main.py` (FastAPI backend)** are present in the repo but not part of the current demo stack. They implement the same commands as the Python REPL via a React terminal UI backed by a FastAPI server. Post-hackathon development target.
