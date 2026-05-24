# CadreOS Roadmap Reset (Post-15A): GearOps Next Build Arc

## Purpose

This document resets roadmap direction after Phase 15A user test case validation and establishes GearOps as the next build arc.

## Current Baseline (Post-15A)

- Core MVP is deployed, working, and manually smoke-tested as usable.
- FieldOps MVP exists and remains available as an operational extension.
- Entry wrapper work is additive and read-only; no destructive migration behavior is introduced.
- Communications runtime remains deferred (notifications, feed, inbox, and messaging surfaces are not in active implementation).
- AI/automation workflows remain deferred.

## Arc 15 Definition (Validation + Roadmap Reset Only)

Arc 15 is a planning/validation arc only:

- Confirm practical user test coverage and MVP usability confidence.
- Capture roadmap reset decisions from current product state.
- Do not add runtime features.
- Do not change Prisma schema.
- Do not expand deferred communication or automation tracks.

## Arc 16 Definition: GearOps MVP

Arc 16 is the next implementation arc and is dedicated to GearOps MVP delivery in the following sequence:

### 16A — GearOps architecture and boundaries
- Finalize module boundaries, ownership, and integration points with existing Core/FieldOps surfaces.

### 16B — GearOps schema/data model
- Define and validate GearOps data shape for inventory, assignments, lifecycle state, and condition history.

### 16C — Gear catalog read-only views
- Deliver browse/search/list/detail read-only gear catalog visibility for staff operations.

### 16D — Gear create/edit workflows
- Add controlled create/edit workflows for inventory items and core metadata.

### 16E — Gear assignment to person/team/event
- Support assignment workflows linking gear custody/allocation to people, teams, and events.

### 16F — Check-out/check-in workflow
- Implement custody transfer workflow with explicit check-out/check-in state transitions.

### 16G — Maintenance/condition logs
- Add maintenance and condition history logging tied to gear lifecycle accountability.

### 16H — Dashboard integration
- Integrate GearOps operational visibility into existing dashboard context.

### 16I — GearOps closeout
- Complete MVP closeout validation, deferred-scope confirmation, and next-arc decision handoff.

## Post-GearOps Decision Branches

After Arc 16 closeout, select the next priority branch:

1. Roster/member lifecycle depth
2. Ops/reporting uplift
3. Track 3 communications toolset

## Explicit GearOps Non-Goals (Not Included Yet)

GearOps MVP must not include the following in Arc 16:

- Barcode scanning
- Purchasing/finance workflows
- Automated replenishment
- Parent-facing gear agreements
- Offline/mobile-native inventory workflows
- Messaging/notifications behavior

## Guardrails

- Keep changes scoped to MVP GearOps accountability and operational visibility.
- Preserve organization-scoped authorization and identity attribution patterns.
- Continue deferring communication runtime and AI/automation expansion until explicitly selected in later arcs.
