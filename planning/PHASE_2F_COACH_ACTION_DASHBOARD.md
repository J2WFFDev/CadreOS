# Phase 2F: Coach Action Dashboard

## Scope
- Upgrade `/dashboard` from a shell into an organization-scoped operational summary.
- Show read-only counts for programs, teams, people, upcoming events, open tasks, and recent notes.
- Surface the next 5 upcoming events with title, date/time, program, optional team, and event status.
- Surface the next 5 open or in-progress follow-up tasks with title, status, assignee, and due date when present.
- Surface the newest 5 notes with created date and linked person, team, or event when present.
- Add practical RSVP and attendance snapshots using existing event, RSVP, and attendance data.
- Add dashboard navigation cards for people, programs, teams, events, notes, and tasks.

## Operational Positioning
- This phase turns the app from a collection of screens into an operational command center.
- Coaches and program operators can see the most urgent work, upcoming events, and recent observations in one place.
- The dashboard stays focused on execution and coordination rather than adding new systems or analytics layers.

## Data and Query Positioning
- All dashboard queries stay scoped to the active organization through the existing organization context helper.
- The dashboard uses existing Prisma models only: organizations, programs, teams, people, events, RSVP, attendance, notes, and follow-up tasks.
- Query shapes stay simple: counts, limited lists, and recent snapshots with small `take` limits.
- No new Prisma schema fields or major data models are required for this phase.

## Read-Only Positioning
- The dashboard remains read-only in Phase 2F.
- Operators navigate from the dashboard into existing detail screens to take action.
- No create or edit forms are introduced directly on `/dashboard`.

## Resilience Expectations
- The dashboard should render clear fallback messaging when database access or schema availability is missing.
- Missing or partial operational data should degrade gracefully to empty-state messaging instead of crashing the page.

## Non-Scope / Guardrails
- No messaging features.
- No inventory workflows.
- No health or medical record workflows.
- No AI or analytics features.
- No real authentication provider integration.
- No automatic seed execution.
- No delete workflows added in this phase.
