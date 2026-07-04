import os
from dataclasses import dataclass
from dotenv import load_dotenv

import glob

# Load .env files with most-specific-wins precedence. Template files
# (.env.example and friends) hold only placeholders and are never loaded —
# loading them was shadowing the real .env, since load_dotenv(override=False)
# keeps whichever value is set first.
_ENV_TEMPLATE_SUFFIXES = (".example", ".sample", ".template", ".dist")


def _env_load_order(filename: str) -> int:
    """Lower rank loads first; the last-loaded file wins (override=True)."""
    name = os.path.basename(filename)
    if name == ".env":
        return 0  # base config — lowest precedence
    if name == ".env.local":
        return 3  # personal overrides — highest precedence, load last
    if name.endswith(".local"):
        return 2
    return 1  # other .env.<environment> files


_env_files = [
    f
    for f in glob.glob(".env*")
    if os.path.isfile(f) and not f.endswith(_ENV_TEMPLATE_SUFFIXES)
]
for _env_file in sorted(_env_files, key=_env_load_order):
    load_dotenv(_env_file, override=True)


@dataclass(frozen=True)
class Settings:
    base_url: str
    api_key: str
    tenant_id: str
    dataset: str


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def load_settings() -> Settings:
    import json
    state_file = "kiwi_session_state.json"
    if "PYTEST_CURRENT_TEST" not in os.environ and os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                state = json.load(f)
            if state.get("is_logged_in") and state.get("base_url") and state.get("api_key") and state.get("tenant_id"):
                return Settings(
                    base_url=state["base_url"].rstrip("/"),
                    api_key=state["api_key"],
                    tenant_id=state["tenant_id"],
                    dataset=os.environ.get("SENTINEL_DATASET", "sentinel"),
                )
        except Exception:
            pass

    return Settings(
        base_url=_require("COGNEE_BASE_URL").rstrip("/"),
        api_key=_require("COGNEE_API_KEY"),
        tenant_id=_require("COGNEE_TENANT_ID"),
        dataset=os.environ.get("SENTINEL_DATASET", "sentinel"),
    )


def auth_headers(settings: Settings) -> dict[str, str]:
    return {"X-Api-Key": settings.api_key, "X-Tenant-Id": settings.tenant_id}
