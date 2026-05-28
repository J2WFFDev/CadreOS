# Arc 23F — Journal Version History and Trust/Audit Model

**Status:** Implementation complete  
**Depends on:** Arc 23A–23E  
**Next:** Arc 23G — Journals & Habits Views, Filters, and Readiness UX

---

## Objective

Arc 23F introduces additive, policy-bound journal version history so meaningful journal lifecycle changes can be audited and recovered without exposing private journal body content in broad feed or activity surfaces.

This arc:
- adds immutable `JournalVersion` snapshots
- captures actor, timestamp, and status transition metadata
- restricts version history/body access intentionally (author + admin/staff policy path)
- keeps `EntryActivity` journal metadata safe and body-free

This arc does **not** add communications delivery, notifications, AI summaries, mood/sentiment analysis, or readiness scoring.

---

## Data Model

### `JournalVersion` (new)

Append-only snapshot table keyed to `Entry` rows where `Entry.type = JOURNAL`.

Key fields:
- `organizationId`
- `entryId`
- `versionNumber` (aligned to `Entry.version`)
- `changeType` (`DRAFT_CREATED`, `DRAFT_UPDATED`, `SUBMITTED`, `ARCHIVED`)
- `titleSnapshot`
- `contentSnapshot`
- `visibilityAtVersion`
- `statusAtVersion`
- `fromStatus` / `toStatus`
- `capturedByPersonId`
- `capturedAt`
- `changeReason`

Design constraints:
- additive migration only
- immutable snapshots (no update route)
- unique `(entryId, versionNumber)` for ordered audit continuity

---

## Versioning Policy Decisions (Arc 23F Defaults)

| Policy question | Arc 23F decision |
|---|---|
| Which changes create snapshots? | Draft create, draft edit (meaningful content/visibility change), submit/finalize, archive |
| Are draft edits versioned? | Yes, when title/content/visibility changed |
| Are submitted/final edits allowed? | No workflow change in Arc 23F; submit creates immutable snapshot |
| Can authors see own prior versions? | Yes |
| Can coaches see prior versions? | No (restricted in Arc 23F) |
| Can guardians see prior versions? | No (restricted in Arc 23F) |
| Can admins/staff see prior versions? | Yes via intentional role-bound access path |
| Are archived versions retained? | Yes (append-only) |
| Is deletion soft-delete only for Release 1? | Yes; journal version rows remain for audit continuity |

---

## Runtime Behavior

### Snapshot capture

Snapshots are written transactionally with journal mutations:

1. Journal draft create → `DRAFT_CREATED`
2. Journal draft update → `DRAFT_UPDATED`
3. Journal submit/finalize → `SUBMITTED`
4. Journal archive → `ARCHIVED`

Each snapshot records actor, timestamp, and status transition metadata.

### Access policy

- Journal detail still uses role-aware `canReadJournalEntry`
- Version history and snapshot body access are stricter in Arc 23F:
  - allowed: journal author, org admin/program director
  - denied: guardians, coaches, unrelated users

### Feed/activity privacy

- Journal body and prior-version body are still excluded from broad feed activity labels
- `EntryActivity.metadataJson` remains safe-summary only for journal actions
- version counts are not emitted into broad feed metadata

---

## UI Scope (low-risk)

### Journal detail (`/journals/[entryId]`)

- Adds a role-aware **Version history** panel
- Authorized roles see version list with:
  - version number
  - change type
  - captured timestamp
  - changed-by
  - status transition metadata
- Unauthorized roles receive a safe restriction message

### Journal version detail (`/journals/[entryId]/versions/[versionId]`)

- Direct URL is authorization-checked
- Shows snapshot metadata + title/body snapshot only for authorized roles
- Unauthorized access is blocked with safe error state

---

## Tests Added

- `tests/journals/access-policy.test.ts`
  - verifies guardians/coaches denied version history
  - verifies author/admin allowed version history
- `tests/journals/versioning.test.ts`
  - verifies snapshot create-input mapping and change-type labels

---

## Deferred Scope

- Rich diff viewer between versions
- Restore previous version workflow
- Legal-grade audit export package
- Granular per-version sharing controls
- Consent-driven visibility changes
- AI summaries
- Sentiment/mood analysis
- Readiness scoring
- External notifications (email/SMS/push)

---

## Recommended Next Arc

**Arc 23G — Journals & Habits Views, Filters, and Readiness UX**

