# GearOps Mobile / Offline Foundation

This document captures the bounded Arc 20K foundation now implemented for GearOps mobile and intermittent-connectivity workflows.

---

## Strategy

GearOps now exposes a pragmatic offline-aware foundation for mobile web field usage without introducing full replication, native app work, or hidden background sync.

Implemented foundations:

- browser online/offline detection
- persistent connectivity banner
- organization-scoped pending action storage in local browser storage
- visible pending action panel with retry and discard controls
- bounded offline policy classification for core GearOps and event gear actions
- local-only pending activity indicators on item and event workflows
- reconnect auto-retry for retry-safe actions only
- clear separation between local pending state and confirmed server history

Deferred by design:

- full offline database replication
- native mobile app packaging
- background sync workers beyond current browser session behavior
- automatic conflict resolution beyond bounded retry/review states
- hidden mutation replay without user visibility

---

## Sync Language

Users now see these explicit states:

- **Drafted locally**
- **Pending sync**
- **Sync failed**
- **Needs review**
- **Completed**
- **Online required**

Confirmed server activity remains the only source of truth for standard history sections.

---

## Action Boundaries

### Offline-safe

- maintenance log creation
- readiness / verification scan drafts

These can retry automatically on reconnect where practical.

### Offline-draftable

- scan lookup drafts
- audit / location scan drafts
- consumable adjustment drafts

These stay visible locally until an operator retries them.

### Offline-limited / pending review

- gear check-out
- gear assignment
- event staging
- event recovery

These can be held locally, but GearOps does not present them as complete until the server confirms them.

### Online-required

- event gear plan save
- event gear requirement creation
- event-specific gear assignment selection
- broader admin/configuration and authorization-sensitive changes

These remain blocked offline with explicit user messaging.

---

## Pending Action Architecture

Pending actions are stored per organization in local browser storage with:

- action type and offline policy
- request target and serialized form fields
- subject scope (item, event, scan workflow, or general GearOps)
- permission/workflow key metadata
- retry count and last error
- current pending state

This keeps offline behavior inspectable and bounded.

---

## Retry / Failure Behavior

- reconnect auto-retries only apply to retry-safe actions
- review-sensitive actions require explicit user retry
- failures remain visible in the pending panel
- users can discard local drafts explicitly
- GearOps never marks pending actions as final until server confirmation succeeds

---

## Activity and History Trust

Standard GearOps history remains trustworthy because pending local actions are shown separately from confirmed history.

Item detail and event gear pages now surface local pending activity in a dedicated section so operators can see what is still unconfirmed without contaminating audit history.

---

## Future Path

Arc 20L should focus on:

1. richer client validation before queueing offline actions
2. broader pending coverage for check-in, custody transfer, and readiness workflows
3. conflict review UX that opens the original form with preserved local draft values
4. optional PWA/session-resume enhancements for scan-first workflows
5. native app compatibility layers that reuse the same offline policy and pending-action vocabulary
