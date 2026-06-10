# Arc 24D.8S-A Discoverable Lifecycle Actions

## Scope

This follow-up aligns Entry detail action visibility with the same existing
`entry.delete` permission enforced by the generic Entry archive and restore
routes. It does not change permissions, visibility, Journal privacy,
Guardian relationships, assignment, context placement, or lifecycle behavior.

## Manual Validation Checklist

- ARCH-A-001: Open active Task detail.
- ARCH-A-002: Authorized user sees **Archive entry**.
- ARCH-A-003: Click **Archive entry**.
- ARCH-A-004: Task disappears from Inbox, List, and All Entries defaults.
- ARCH-A-005: Archived filter shows the Task.
- ARCH-A-006: Archived Task detail opens.
- ARCH-A-007: Archived Task detail shows **Restore entry**.
- ARCH-A-008: Click **Restore entry**.
- ARCH-A-009: Task returns to Inbox, List, and All Entries defaults.
- ARCH-A-010: Created by is unchanged.
- ARCH-A-011: Assignee is unchanged.
- ARCH-A-012: Context/List is unchanged.
- ARCH-A-013: Visibility is unchanged.
- ARCH-A-014: Done/Completed remains separate from Archived.
- ARCH-A-015: Unauthorized user cannot see or use archive/restore.
- ARCH-A-016: No hard delete was added.

Manual role-session validation was not run locally. Focused lifecycle,
permission-gating, detail UI, and full repository validation cover the
automated contract.
