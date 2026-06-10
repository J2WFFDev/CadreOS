# Arc 24D.8S-B Owner/Creator Lifecycle Actions

## Decision

Generic Entry creators may archive and restore their own Entries. Existing
elevated `entry.delete` authorization remains available. Assignee-only access
does not grant archive or restore rights.

Generic Entry detail UI and archive/restore routes use the same shared
lifecycle policy. Journal author/creator lifecycle behavior remains governed
by the existing Journal access policy and privacy predicates.

## Manual Validation Checklist

- ARCH-B-001: Athlete opens their own active Task detail.
- ARCH-B-002: **Archive entry** is visible.
- ARCH-B-003: Archive the Task.
- ARCH-B-004: Task disappears from Inbox, List, and All Entries defaults.
- ARCH-B-005: Archived filter shows the Task.
- ARCH-B-006: Archived Task detail opens.
- ARCH-B-007: **Restore entry** is visible.
- ARCH-B-008: Restore the Task.
- ARCH-B-009: Task returns to default working views.
- ARCH-B-010 through ARCH-B-014: Created by, Assignee, Context/List,
  Visibility, and pre-archive workflow status remain unchanged.
- ARCH-B-015: Unrelated and assignee-only users cannot archive or restore.
- ARCH-B-016: Archive does not hard delete.

Manual role-session validation was not run locally. Automated lifecycle
policy, route wiring, Journal policy, typecheck, test, and build validation
cover the implementation contract.
