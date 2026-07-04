# Exploration Guide — Kiwi

This guide helps you navigate and study the Kiwi codebase, showing how the UI, CLI, memory client, and backend API interact.

---

## Orientation Map

| Component | Responsibility | Path |
|---|---|---|
| **CLI & REPL Surface** | Interactive terminal rendering and command parser (React + Ink) | [kiwi-ui/index.tsx](../kiwi-ui/index.tsx) |
| **Backend API** | FastAPI server hosting endpoints for queries, tests, and configuration | [app/main.py](../app/main.py) |
| **Memory Client** | Client wrapper around Cognee graph database (`remember`, `recall`) | [sentinel/cognee_client.py](../sentinel/cognee_client.py) |
| **Review Engine** | Prompt generator that builds and lints grounding reviews using LLMs | [sentinel/reviewer.py](../sentinel/reviewer.py) |
| **Dynamic Configuration**| Priority-based env loader (.env.local -> .env) and state files | [sentinel/config.py](../sentinel/config.py) |

---

## Data Flow Pipeline

Trace how a user action (e.g. running a test or query) flows through Kiwi:

```
[kiwi-ui/index.tsx] (User input / command execution)
       ↓
[app/main.py] (FastAPI Endpoint Handler)
       ↓
[sentinel/cognee_client.py] (Recall historical matches / remember failures)
       ↓
[sentinel/reviewer.py] (LLM prompt synthesis & n-gram grounding validation)
       ↓
[kiwi-ui/index.tsx] (Renders final review response in Ink UI)
```

---

## Key Patterns to Recognize

### 1. Dynamic LLM Instantiation
Kiwi dynamically resolves the active provider (Anthropic, OpenAI, or Gemini) and model directly from the persistent config or `.env` files:
```python
# sentinel/llm_client.py
provider, client, model = get_llm_client()
```

### 2. Environment Priority Matching
Dot-env files are loaded in override-priority order so that local config files take precedence:
```python
# sentinel/config.py
env_files = glob.glob(".env*")
env_files.sort(key=get_priority)
for f in env_files:
    load_dotenv(f)
```
