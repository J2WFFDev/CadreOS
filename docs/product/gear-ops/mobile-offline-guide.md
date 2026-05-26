# GearOps Mobile and Offline Behavior Guide

This guide explains what happens when connectivity is unstable or unavailable.

## Core Rule

Only server-confirmed actions are treated as final operational history.

## Status Language You Will See

- **Drafted locally**
- **Pending sync**
- **Sync failed**
- **Needs review**
- **Completed**
- **Online required**

## Online vs Offline

- **Online:** normal submit flow to server.
- **Offline:** queueable actions are saved locally with explicit status.
- **Online-required actions:** blocked until connection returns.

## Current Offline Capability Boundaries

- **Offline-safe:** some verification/maintenance capture can queue and auto-retry.
- **Offline-draftable:** lookup/audit-style drafts can be held locally.
- **Offline-limited:** custody-sensitive actions can queue but need review/confirmation.
- **Online-required:** event plan/requirement/assignment and other sensitive flows require live connection.

## Pending Action Handling

Use the pending panel to:
- review local actions
- retry failed/review-needed actions
- discard invalid drafts

## What Not To Do Offline

- do not assume queued custody changes are final
- do not close reconciliation tasks based only on local pending items
- do not skip post-reconnect verification

## Recovery Steps After Reconnect

1. open pending panel
2. retry failed/review actions
3. confirm completion in server-backed history
4. resolve any remaining online-required actions

## Field Safety Warning

If an action affects custody, assignment, or event state, verify server confirmation before handing gear to the next operator.
