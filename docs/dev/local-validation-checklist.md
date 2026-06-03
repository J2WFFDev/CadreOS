@'
# Local LLM Development Workflow

## Purpose

This document defines the safe local development workflow for CadreOS when using a local LLM through VS Code and Continue.dev.

The goal is to let the local LLM assist with code changes while keeping GitHub branch discipline, review control, and rollback safety.

## Recovery Point

Backup branch:

```text
backup/milestone-before-local-llm-2026-06-03