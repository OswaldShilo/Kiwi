# Subsystems Guide — Kiwi

This document details the major subsystems of the Kiwi QA Harness Agent.

---

## 1. CLI Surface & REPL Subsystem
**Location:** [kiwi-ui/index.tsx](../kiwi-ui/index.tsx)

An interactive React + Ink shell that runs in the terminal.
* **REPL Component**: Manages terminal output streaming, autocomplete suggestions, and history buffers.
* **Credentials Gate**: Restricts execution until settings are loaded or interactive `/login` config is completed.
* **State Store**: Uses React state hooks to coordinate login states, loader overlays, and chat history.

---

## 2. API Backend Subsystem
**Location:** [app/main.py](../app/main.py)

A FastAPI web service coordinating executions and client interactions.
* **Endpoints**:
  - `/kiwi/query`: Coordinates memory recall and system prompts.
  - `/kiwi/test`: Spawns pytest commands and captures output logs.
  - `/kiwi/login` & `/kiwi/auth-status`: Serializes dynamic session configurations.
  - `/webhook`: Connects Kiwi to external event hooks (such as GitHub Actions or pull request updates).

---

## 3. Memory Subsystem
**Location:** [sentinel/cognee_client.py](../sentinel/cognee_client.py)

Connects the agent to a Cognee graph database.
* **Remember pipeline**: Serializes test traces, stack traces, and resolution summaries, writing them into graph databases.
* **Recall pipeline**: Uses vector search and semantic matching to find similar failure context based on test signatures.

---

## 4. Review & Grounding Subsystem
**Location:** [sentinel/reviewer.py](../sentinel/reviewer.py)

Ensures generated reviews are factual and grounded.
* **get_diff()**: Queries git history for local repository code modifications.
* **ground_review()**: Validates model output using n-gram grounding checks against recalled history to prevent hallucinations.
