# Command Reference — Kiwi

This document describes all interactive slash (`/`) commands available in the Kiwi CLI REPL, including their purpose, function, and examples.

---

## Command List

| Command | Purpose | Example |
|---|---|---|
| [`/login`](#/login) | Interactive credentials authentication gate | `/login` |
| [`/provider`](#/provider) | Switches the active LLM Provider at runtime | `/provider` |
| [`/model`](#/model) | Switches the LLM model for the active provider | `/model` |
| [`/config`](#/config) | Prints current session configuration details | `/config` |
| [`/test`](#/test-path) | Executes pytest suite and auto-ingests failures | `/test tests/test_cli.py` |
| [`/remember`](#/remember-text) | Manually stores custom facts/comments in graph memory | `/remember JWT expiry was fixed by changing config` |
| [`/recall`](#/recall-query) | Contextually queries the Cognee memory graph | `/recall JWT token expiry` |
| [`/resolve`](#/resolve-summary) | Stores a resolution summary for the last failed test | `/resolve updated mock response to return 200` |
| [`/flaky`](#/flaky-test) | Displays local failure tracking statistics | `/flaky test_user_login` |
| [`/history`](#/history-test) | Lists all failure timeline logs for a specific test | `/history test_user_login` |
| [`/session`](#/session) | Outputs the log of all operations in the active session | `/session` |
| [`/forget`](#/forget-all--dataset) | Clears memory datasets from Cognee storage | `/forget --all` |
| [`/clear`](#/clear) | Clears the active command screen logs | `/clear` |
| [`/help`](#/help) | Lists all available commands and their summaries | `/help` |
| [`/exit`](#/exit) | Safely shuts down the Kiwi CLI REPL | `/exit` |

---

## Detailed Command Documentation

### `/login`
* **Purpose**: Authenticates the Kiwi session by configuring backend connections.
* **Function**: Initializes the credentials pipeline. If credentials exist in the root `.env` or `.env.local` file, it automatically imports them (displaying `"Cognee credentials detected from .env file!"`) and prompts you to select the LLM Provider. Otherwise, it launches an interactive walkthrough asking you to specify the Cognee Base URL, API Key, and Tenant ID.
* **Example**:
  ```text
  /login
  ```

### `/provider`
* **Purpose**: Switches the active LLM provider.
* **Function**: Changes the active AI model vendor to route reviews and queries. Displays an interactive menu to choose between **Anthropic**, **OpenAI**, and **Gemini**.
* **Example**:
  ```text
  /provider
  ```
  *Output:*
  ```text
  Choose LLM Provider:
  1. Anthropic
  2. OpenAI
  3. Gemini
  Enter number (1-3):
  ```

### `/model`
* **Purpose**: Updates the specific AI model configuration.
* **Function**: Switches model sizes/versions for the currently active LLM provider (e.g. switching from `gemini-3.5-flash` to `gemini-3.1-pro-preview`).
* **Example**:
  ```text
  /model
  ```
  *Output:*
  ```text
  Choose Gemini model:
  1. gemini-3.5-flash
  2. gemini-3.1-flash-lite
  3. gemini-3.1-pro-preview
  4. gemini-3-flash-preview
  Enter number (1-4):
  ```

### `/config`
* **Purpose**: Inspects active parameters.
* **Function**: Prints all active endpoint connections and configured runtime details, including the Cognee Base URL, Tenant ID, active LLM Provider, and active LLM Model.
* **Example**:
  ```text
  /config
  ```
  *Output:*
  ```text
  Active Configuration:
    - Cognee Base URL: https://tenant-d4bbb38b.aws.cognee.ai
    - Tenant ID:       d4bbb38b-84bf-42b2-9780-838433c58e62
    - LLM Provider:    Gemini
    - LLM Model:       gemini-3.1-pro-preview
  ```

### `/test [path]`
* **Purpose**: Runs unit or integration tests.
* **Function**: Executes the local `pytest` suite in a subprocess, automatically generating JUnit XML reports. If any tests fail, Kiwi automatically ingests the stack traces, queries Cognee for similar past issues to construct a factual review, and logs the new failure to memory.
* **Example**:
  * Run entire suite:
    ```text
    /test
    ```
  * Run specific test file:
    ```text
    /test tests/auth/test_login.py
    ```

### `/remember <text>`
* **Purpose**: Enriches Cognee memory with developer context.
* **Function**: Manually indexes a custom note, resolution fact, or log string directly into the Cognee vector graph so it can be retrieved during future test failures.
* **Example**:
  ```text
  /remember fixed flaky database connection by adding a retry loop in the client fixture
  ```

### `/recall <query>`
* **Purpose**: Contextually queries stored memory.
* **Function**: Performs a vector similarity query against the Cognee memory graph to retrieve stored notes, incidents, or resolutions related to the search terms.
* **Example**:
  ```text
  /recall database connection flake
  ```

### `/resolve <summary>`
* **Purpose**: Registers a resolution for the last failed test.
* **Function**: Records a fix summary and links it contextually to the most recently failed test case in the current session.
* **Example**:
  ```text
  /resolve updated database timeout limit from 5s to 30s
  ```

### `/flaky [test_name]`
* **Purpose**: Monitors local failure rates.
* **Function**: Retrieves statistics for test runs. If no arguments are provided, it lists all tests that have failed and their occurrence count. If a test name is provided, it returns the failure count for that specific test.
* **Example**:
  * View all failures:
    ```text
    /flaky
    ```
  * View specific test statistics:
    ```text
    /flaky test_user_login
    ```

### `/history <test_name>`
* **Purpose**: Displays the historical timeline of a test.
* **Function**: Retrieves all logged failure contexts and associated resolution comments for a target test case, allowing developers to see recurrence patterns.
* **Example**:
  ```text
  /history test_user_login
  ```

### `/session`
* **Purpose**: Views active session activity.
* **Function**: Lists the timeline log of all operations performed in the current terminal interface session (such as manual remember calls, executed tests, and loaded context).
* **Example**:
  ```text
  /session
  ```

### `/forget [--all | dataset_name]`
* **Purpose**: Wipes stored datasets from Cognee memory.
* **Function**: Cleans the vector storage database.
* **Arguments**:
  - `--all`: Clears all data across all indexed Cognee datasets.
  - `dataset_name`: Clears only the data indexed under the specified dataset name (e.g. `sentinel`).
* **Examples**:
  * Clear all datasets:
    ```text
    /forget --all
    ```
  * Clear a specific dataset:
    ```text
    /forget sentinel
    ```

### `/clear`
* **Purpose**: Cleans the active console terminal view.
* **Function**: Instantly clears the screen's message logs.
* **Example**:
  ```text
  /clear
  ```

### `/help`
* **Purpose**: Display help.
* **Function**: Outputs the command registry helper table.
* **Example**:
  ```text
  /help
  ```

### `/exit` (or `/quit`)
* **Purpose**: Exits the Kiwi CLI REPL session.
* **Function**: Gracefully shuts down the console interface, clean-unmounts the React/Ink components to prevent UI overlapping, terminates the background uvicorn backend server, clears the screen, and returns control to your shell.
* **Example**:
  ```text
  /exit
  ```
