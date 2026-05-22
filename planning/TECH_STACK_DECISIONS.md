# CadreOS Tech Stack Decisions

## Canonical MVP Technical Direction
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend pattern:** Next.js server actions + route handlers
- **Validation:** Zod at API/server boundaries
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Database hosting:** Neon
- **Hosting:** Vercel
- **CI/CD:** GitHub Actions checks + Vercel preview deployments

## Authentication Decision
### MVP choice
- **Clerk** is the preferred MVP authentication provider.
- Reason: fastest path to secure auth/org membership flows for solo-builder execution speed.

### Future alternative
- **Auth.js** is a valid later alternative if ownership/control/portability priorities outweigh MVP speed.
- Migration is possible but should be planned intentionally if adopted later.

## Product/Architecture Constraints from Build Readiness
- CadreOS is coach-centered and program-aware.
- Data model is multi-org-ready from day one.
- MVP pilot UX is focused on one organization.
- Observation notes are staff-only by default.
- Parent/guardian visibility for notes requires explicit controlled workflow (Phase 2).
- Inbox/communication MVP is metadata/workflow routing only (no full chat/messaging).
- No medical/health records in MVP.
- Minimize PII and enforce server-side role/scope authorization.

## Scope Tiers
### MVP
- People, roles, guardian relationships
- Teams, seasons, rosters
- Observation notes
- Events, RSVP, attendance
- Follow-up tasks
- Audit log
- Inbox routing metadata

### Phase 2
- Controlled note-sharing workflow
- Enhanced routing and notifications
- Additional operational reporting depth

### Later
- Full messaging/chat
- Inventory/compliance/development modules
- Advanced analytics and AI
