from unittest.mock import MagicMock, patch
import pytest

from sentinel.config import Settings
from sentinel.kiwi_cli import run_session


@pytest.fixture
def mock_client():
    return MagicMock()


@pytest.fixture
def mock_settings():
    return Settings(
        base_url="https://test.cognee.ai",
        api_key="test-key",
        tenant_id="test-tenant",
        dataset="kiwi-test"
    )


def test_kiwi_exit(mock_client, mock_settings):
    inputs = ["/exit"]
    def mock_input(prompt):
        return inputs.pop(0)

    run_session(mock_client, mock_settings, input_func=mock_input)
    mock_client.remember.assert_not_called()


def test_kiwi_remember(mock_client, mock_settings):
    inputs = ["/remember test fact", "/exit"]
    def mock_input(prompt):
        return inputs.pop(0)

    run_session(mock_client, mock_settings, input_func=mock_input)
    mock_client.remember.assert_called_once_with("test fact", dataset="kiwi-test")


def test_kiwi_recall(mock_client, mock_settings):
    inputs = ["/recall test query", "/exit"]
    def mock_input(prompt):
        return inputs.pop(0)

    mock_client.recall.return_value = [{"text": "Found incident details"}]
    run_session(mock_client, mock_settings, input_func=mock_input)
    mock_client.recall.assert_any_call("test query", dataset="kiwi-test")


def test_kiwi_forget(mock_client, mock_settings):
    inputs = ["/forget", "/exit"]
    def mock_input(prompt):
        return inputs.pop(0)

    run_session(mock_client, mock_settings, input_func=mock_input)
    mock_client.forget.assert_called_once_with(dataset="kiwi-test")


@patch("sentinel.kiwi_cli.get_llm_client")
@patch("sentinel.kiwi_cli.ask_llm")
def test_kiwi_chat_query(mock_ask_llm, mock_get_llm, mock_client, mock_settings):
    inputs = ["Does the API charge twice?", "/exit"]
    def mock_input(prompt):
        return inputs.pop(0)

    mock_client.recall.return_value = [{"text": "observed customer billed twice"}]
    mock_get_llm.return_value = ("gemini", MagicMock())
    mock_ask_llm.return_value = "Yes, due to retries."

    run_session(mock_client, mock_settings, input_func=mock_input)
    
    mock_client.recall.assert_any_call("Does the API charge twice?", dataset="kiwi-test")
    mock_ask_llm.assert_called_once()
    assert "observed customer billed twice" in mock_ask_llm.call_args[0][2]


def test_kiwi_history_recalls_by_test_name(mock_client, mock_settings):
    inputs = ["/history test_login", "/exit"]
    def mock_input(prompt):
        return inputs.pop(0)

    mock_client.recall.return_value = [{"text": "test_login failed 2026-02-10"}]
    run_session(mock_client, mock_settings, input_func=mock_input)
    assert any("test_login" in call.args[0] for call in mock_client.recall.call_args_list)


def test_kiwi_resolve_without_failure_is_a_noop(mock_client, mock_settings):
    inputs = ["/resolve added idempotency key", "/exit"]
    def mock_input(prompt):
        return inputs.pop(0)

    run_session(mock_client, mock_settings, input_func=mock_input)
    mock_client.remember.assert_not_called()
    mock_client.remember_entry.assert_not_called()


def test_kiwi_flaky_empty_runs_clean(mock_client, mock_settings, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)  # no flaky-state file present
    inputs = ["/flaky", "/exit"]
    def mock_input(prompt):
        return inputs.pop(0)

    run_session(mock_client, mock_settings, input_func=mock_input)


def test_kiwi_session_empty_runs_clean(mock_client, mock_settings):
    inputs = ["/session", "/exit"]
    def mock_input(prompt):
        return inputs.pop(0)

    run_session(mock_client, mock_settings, input_func=mock_input)
