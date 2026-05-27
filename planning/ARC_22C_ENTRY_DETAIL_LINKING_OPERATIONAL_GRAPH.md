# Arc 22C — Entry Detail, Linking, and Operational Graph Hardening

## Purpose

Arc 22C hardens Entry detail and relationship navigation so operators can understand what an Entry is connected to and move safely into linked operational records.

This arc remains additive and migration-safe:

- no broad destructive schema rewrites
- no Journals/Habits runtime build
- no full Communications runtime build

## Arc 22C Linking Contract

Entry linking uses three complementary paths:

- `EntryLink` for Entry-to-Entry relationships
- `EntryObjectLink` for Entry-to-domain object links
- `OperationalRelationship` for broader graph edges and traversal

Entry detail should show link context without duplicating source records.

## Supported Linked Object Targets (Current)

Where supported by existing models/routes, Entry links may target:

- person records
- team/program/season records
- event/session-adjacent records
- gear/resource/reservation records
- follow-up task / note records
- related entries

## Entry Detail Behavior (Arc 22C)

- Entry detail surfaces:
  - title, content/body, type, status, priority
  - creator, assignee, updated-by, due and timestamp metadata
  - linked object panel
  - linked entry panel
  - related operational graph panel
  - activity/history
- Entry detail includes clear navigation to Entries list, Entry Inbox, and Feed.
- Entry edit/link/unlink actions remain role-gated.

## Authorization and Visibility Notes

- Entry read surfaces are staff-role-gated for current runtime safety.
- Entry mutation/link actions require existing write permission checks (`entry.update`).
- Linked object display must not leak protected details:
  - unresolved/deleted records render safe unavailable placeholders
  - inaccessible records render restricted placeholders without exposing hidden details

## Manual QA

Use `ARC_22C_ENTRY_VALIDATION_CHECKLIST.md`.

## Deferred Scope (Explicit)

Deferred beyond Arc 22C:

- advanced graph visualization
- drag/drop linking
- AI relationship suggestions
- bulk linking
- external calendar/message links
- deep audit timeline
- full notification delivery
- Journals/Habits-specific linking rules

## Recommended Next Arc

**Arc 22D — Workflow Orchestration, Follow-Ups, and Entry-to-Task Conversion**

Primary objective: strengthen follow-up chaining, workflow execution visibility, and dependable Entry-to-task orchestration on top of Arc 22C linking/detail foundations.
