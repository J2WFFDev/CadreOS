# CadreOS Milestone 1: Foundation OS (MVP Core)

## Milestone Objective
Prepare and implement the first buildable CadreOS foundation for coach-centered MVP workflows.

## Locked Decisions Applied
- Authentication provider for MVP: **Clerk**
- Multi-org-ready data model from day one
- MVP pilot UX initially focused on one organization
- Observation notes staff-only by default
- Inbox/communication MVP is metadata routing only (no full messaging/chat)
- No medical/health records in MVP; minimize PII

## Phase 0: App Foundation
- Initialize Next.js App Router project with TypeScript + Tailwind CSS
- Configure Prisma with Neon Postgres
- Defer auth provider integration in Phase 0 while keeping auth as a required later implementation phase
- Add environment variable structure for local/preview/prod
- Add baseline CI checks in GitHub Actions (lint/typecheck/test placeholders aligned to repo state)
- Set Vercel preview deployment assumptions

## Phase 1: Core Data and Access Foundation
- Implement Prisma MVP-first schema from `PRISMA_MODEL_DRAFT.md`
- Add migrations for:
  - Organization, Program, Team, Season
  - Person, UserAccount, RoleAssignment, AthleteGuardianRelationship
  - RosterMembership
  - ObservationNote (staff-only default)
  - Event, RSVP, AttendanceRecord
  - FollowUpTask, InboxRoutingItem, AuditEvent
- Implement role/scope authorization middleware/services (organization/program/team)
- Implement append-only audit event write pattern for protected mutations

## Phase 2: First Coach-Centered MVP Vertical Slices
- People list/profile with scoped access
- Team + season roster management
- Observation note capture + scoped timeline
- Event creation + publish
- RSVP and attendance capture
- Follow-up task creation and status flow
- Inbox routing queue metadata workflow

## Milestone Exit Criteria
- MVP planning docs are complete and aligned:
  - `API_CONTRACT.md`
  - `ACCEPTANCE_CRITERIA.md`
  - `PRISMA_MODEL_DRAFT.md`
- Auth, tenancy, and role/scope rules are implemented server-side
- Staff-only note default is enforced
- RSVP and attendance are operational with audit traces
- No non-MVP modules (chat, medical, inventory, AI) are introduced
