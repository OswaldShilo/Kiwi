from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import os
import subprocess
import json

from app.webhook_service import ChargeStore, process_webhook
from sentinel.cognee_client import CogneeClient, CogneeError
from sentinel.config import load_settings
from sentinel.ingest import process_report
from sentinel.reviewer import build_review
from sentinel.llm_client import get_llm_client, ask_llm

app = FastAPI(title="Demo payments service")
store = ChargeStore()

STATE_FILE = "kiwi_session_state.json"


def load_state() -> dict:
    if not os.path.exists(STATE_FILE):
        return {
            "last_failures": [],
            "failure_counts": {},
            "session_log": []
        }
    try:
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {
            "last_failures": [],
            "failure_counts": {},
            "session_log": []
        }


def save_state(state: dict):
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except Exception:
        pass


class RememberReq(BaseModel):
    text: str


class QueryReq(BaseModel):
    query: str


class TestReq(BaseModel):
    path: str = ""


class ForgetReq(BaseModel):
    all: bool = False
    dataset: str = ""


class LoginDetails(BaseModel):
    base_url: str
    api_key: str
    tenant_id: str
    llm_provider: str
    llm_model: str


class ResolveReq(BaseModel):
    summary: str


class FlakyReq(BaseModel):
    test_name: str = ""


@app.post("/webhook")
def receive_webhook(event: dict):
    process_webhook(store, event)
    return {"event_id": event["id"], "charges": len(store.charges_for(event["id"]))}


@app.post("/kiwi/remember")
def kiwi_remember(req: RememberReq):
    try:
        settings = load_settings()
        client = CogneeClient(settings)
        client.remember(req.text, dataset=settings.dataset)

        state = load_state()
        state["session_log"].append(f"[Manual Remember] Stored context: {req.text}")
        save_state(state)

        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/kiwi/recall")
def kiwi_recall(req: QueryReq):
    try:
        settings = load_settings()
        client = CogneeClient(settings)
        hits = client.recall(req.query, dataset=settings.dataset)

        state = load_state()
        state["session_log"].append(f"[Recall] Searched memory for: {req.query}")
        save_state(state)

        return {"hits": hits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/kiwi/query")
def kiwi_query(req: QueryReq):
    def generator():
        try:
            # Yield thinking step 1
            yield json.dumps({"type": "thinking", "text": "Analyzing query and setting up context..."}) + "\n"

            # Yield thinking step 2
            yield json.dumps({"type": "thinking", "text": "Querying Cognee memory graph for similar past failures..."}) + "\n"

            # Perform Cognee recall
            settings = load_settings()
            client = CogneeClient(settings)
            context_str = ""
            try:
                hits = client.recall(req.query, dataset=settings.dataset)
                if hits:
                    context_str = "\n".join(f"- {h.get('text')}" for h in hits)
                    yield json.dumps({"type": "thinking", "text": f"Querying Cognee memory graph for similar past failures...\n-> Found {len(hits)} matching memories in graph database."}) + "\n"
                else:
                    yield json.dumps({"type": "thinking", "text": "Querying Cognee memory graph for similar past failures...\n-> No similar past failures found in memory."}) + "\n"
            except Exception as e:
                yield json.dumps({"type": "thinking", "text": f"Querying Cognee memory graph...\n-> Error querying memory: {e}"}) + "\n"

            # Resolve LLM client
            from sentinel.llm_client import get_llm_client, stream_llm
            provider, llm, model = get_llm_client()
            if not llm:
                msg = f"Warning: No LLM configured. Recalled Context:\n{context_str}" if context_str else "No LLM configured and no memories found."
                yield json.dumps({"type": "text", "text": msg}) + "\n"
                return

            yield json.dumps({"type": "thinking", "text": f"Contacting LLM provider ({provider}) using model {model}..."}) + "\n"

            prompt = req.query
            if context_str:
                prompt = (
                    "Context retrieved from memory of past failures/incidents:\n"
                    f"{context_str}\n\n"
                    f"User Query:\n{req.query}\n\n"
                    "Please answer the user's query utilizing the recalled context above if relevant."
                )

            system_instruction = (
                "You are Kiwi, a developer's QA assistant with access to historical memory of test failures and resolutions. "
                "The user might ask you to perform an action or run a command, or they might ask a general question. "
                "\n\n"
                "If the user wants to perform an action (such as running tests, clearing screen, remembering details, recalling memory, etc.), "
                "you MUST output a JSON object containing the action details and arguments. Do NOT output any other text beside the JSON.\n"
                "Supported actions:\n"
                "1. 'test': Run pytest. Args: 'path' (string, path to a specific test file, optional).\n"
                "2. 'clear': Clear the conversation screen history.\n"
                "3. 'exit': Exit the Kiwi session.\n"
                "4. 'remember': Store manual context/incident details. Args: 'text' (string, the fact to remember).\n"
                "5. 'recall': Query memory for similar past issues. Args: 'query' (string, search query).\n"
                "6. 'forget': Clear memory datasets. Args: 'all' (boolean, true to clear all), 'dataset' (string, dataset name to clear).\n"
                "7. 'resolve': Log the fix for the last failing test. Args: 'summary' (string, description of the fix).\n"
                "8. 'flaky': Show flaky test tracking counts. Args: 'test_name' (string, optional).\n"
                "9. 'history': List failure timeline logs for a specific test. Args: 'test_name' (string).\n"
                "10. 'session': Show active session logs.\n"
                "11. 'help': Show the list of available commands.\n"
                "\n"
                "Format for actions (strict JSON):\n"
                '{"action": "<action_name>", "args": { ... }}\n'
                "\n"
                "If the user is asking a general question (not requesting an action), answer it normally utilizing the context provided below.\n"
                f"Context:\n{context_str}"
            )

            # Stream the LLM response
            full_text = ""
            for chunk in stream_llm(provider, llm, prompt, system_instruction, model):
                full_text += chunk
                yield json.dumps({"type": "chunk", "text": chunk}) + "\n"

            # Check if accumulated text is an action JSON
            stripped = full_text.strip()
            if stripped.startswith("{") and stripped.endswith("}"):
                try:
                    parsed = json.loads(stripped)
                    if "action" in parsed:
                        yield json.dumps({"type": "action", "action": parsed["action"], "args": parsed.get("args", {})}) + "\n"
                except Exception:
                    pass

        except Exception as e:
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(generator(), media_type="text/event-stream")


@app.post("/kiwi/test")
def kiwi_test(req: TestReq):
    try:
        settings = load_settings()
        client = CogneeClient(settings)
        cmd = ["uv", "run", "pytest", "--junitxml=junit_report.xml"]
        if req.path:
            cmd.append(req.path)
        res = subprocess.run(cmd, capture_output=True, text=True)
        reviews = []

        state = load_state()
        state["last_failures"] = []

        if os.path.exists("junit_report.xml"):
            results = process_report("junit_report.xml", client=client, dataset=settings.dataset)
            for r in results:
                reviews.append(build_review(r))
                fail_data = {
                    "test_name": r.failure.test_name,
                    "class_name": r.failure.class_name,
                    "error_message": r.failure.error_message,
                    "file_hint": r.failure.file_hint,
                    "stack_trace": r.failure.stack_trace
                }
                state["last_failures"].append(fail_data)

                # Increment failure count
                cnt = state["failure_counts"].get(r.failure.test_name, 0)
                state["failure_counts"][r.failure.test_name] = cnt + 1

                # Log to session
                state["session_log"].append(f"[Auto-Remember] Stored failure for test: {r.failure.test_name}")

        save_state(state)
        return {"output": res.stdout, "reviews": reviews, "failures": state["last_failures"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/kiwi/forget")
def kiwi_forget(req: ForgetReq):
    try:
        settings = load_settings()
        client = CogneeClient(settings)
        if req.all:
            client.forget(everything=True)
        elif req.dataset:
            client.forget(dataset=req.dataset)
        else:
            client.forget(dataset=settings.dataset)

        state = load_state()
        state["session_log"].append("[Forget] Cleared memory")
        save_state(state)

        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/kiwi/resolve")
def kiwi_resolve(req: ResolveReq):
    try:
        settings = load_settings()
        client = CogneeClient(settings)
        state = load_state()

        if not state["last_failures"]:
            raise HTTPException(status_code=400, detail="No active failure in context. Run /test first.")

        # Get the most recent failure in context
        last_fail = state["last_failures"][-1]

        # Link resolution to the failure
        res_record = (
            f"Test Resolution/Fix:\n"
            f"Test Name: {last_fail['test_name']}\n"
            f"Original Error: {last_fail['error_message']}\n"
            f"Resolution Summary: {req.summary}\n"
        )

        client.remember(res_record, dataset=settings.dataset)

        state["session_log"].append(f"[Resolve] Stored fix for {last_fail['test_name']}: {req.summary}")
        save_state(state)

        return {"status": "success", "test_name": last_fail['test_name']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/kiwi/flaky")
def kiwi_flaky(req: FlakyReq):
    try:
        state = load_state()
        if req.test_name:
            count = state["failure_counts"].get(req.test_name, 0)
            return {"test_name": req.test_name, "count": count}
        else:
            return {"flaky_tests": state["failure_counts"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/kiwi/session")
def kiwi_session():
    try:
        state = load_state()
        return {"session_log": state["session_log"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/kiwi/auth-status")
def auth_status():
    state = load_state()
    env_base_url = os.environ.get("COGNEE_BASE_URL", "").strip()
    env_api_key = os.environ.get("COGNEE_API_KEY", "").strip()
    env_tenant_id = os.environ.get("COGNEE_TENANT_ID", "").strip()
    has_env = bool(env_base_url and env_api_key and env_tenant_id)
    return {
        "is_logged_in": state.get("is_logged_in", False),
        "base_url": state.get("base_url", env_base_url),
        "api_key": state.get("api_key", env_api_key),
        "tenant_id": state.get("tenant_id", env_tenant_id),
        "llm_provider": state.get("llm_provider", ""),
        "llm_model": state.get("llm_model", ""),
        "has_env_credentials": has_env
    }


@app.post("/kiwi/login")
def kiwi_login(req: LoginDetails):
    try:
        state = load_state()
        state["is_logged_in"] = True
        state["base_url"] = req.base_url
        state["api_key"] = req.api_key
        state["tenant_id"] = req.tenant_id
        state["llm_provider"] = req.llm_provider
        state["llm_model"] = req.llm_model
        save_state(state)

        # Validate LLM API credentials instantly
        from sentinel.llm_client import validate_llm_credentials
        valid, err = validate_llm_credentials(req.llm_provider.lower(), req.llm_model)
        if not valid:
            state["is_logged_in"] = False
            save_state(state)
            raise HTTPException(status_code=400, detail=f"LLM API Key verification failed: {err}")

        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
