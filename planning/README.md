# CadreOS Planning Index

CadreOS is an **Athlete Program Operating System**.

## Planning Documents
- [Product Vision](./PRODUCT_VISION.md)
- [PRD](./PRD.md)
- [Feature Breakdown](./FEATURE_BREAKDOWN.md)
- [Domain Model](./DOMAIN_MODEL.md)
- [Roadmap](./ROADMAP.md)
- [Roadmap: Core MVP, FieldOps, GearOps](./ROADMAP_CORE_FIELDOPS_GEAROPS.md)
- [Notes / Inbox / Entry Model](./NOTES_INBOX_ENTRY_MODEL.md)
- [User Stories](./USER_STORIES.md)
- [MVP Spec](./MVP_SPEC.md)
- [Permissions Matrix](./PERMISSIONS_MATRIX.md)
- [Screen Inventory](./SCREEN_INVENTORY.md)
- [Data Model Draft](./DATA_MODEL.md)
- [Prisma Model Draft](./PRISMA_MODEL_DRAFT.md)
- [API Contract](./API_CONTRACT.md)
- [Acceptance Criteria](./ACCEPTANCE_CRITERIA.md)
- [Tech Stack Decisions](./TECH_STACK_DECISIONS.md)
- [User Story AC Template](./USER_STORY_AC_TEMPLATE.md)
- [Milestone 1 Foundation](./MILESTONE_1_FOUNDATION_OS.md)
- [Phase 1A Database Foundation](./PHASE_1A_DATABASE_FOUNDATION.md)
- [Phase 1C Controlled Create/Edit](./PHASE_1C_CONTROLLED_CREATE_EDIT.md)
- [Phase 1D Role Assignment Management](./PHASE_1D_ROLE_ASSIGNMENT_MANAGEMENT.md)
- [Phase 1E Program Management](./PHASE_1E_PROGRAM_MANAGEMENT.md)
- [Phase 1F Season Management](./PHASE_1F_SEASON_MANAGEMENT.md)
- [Phase 2A Event Management](./PHASE_2A_EVENT_MANAGEMENT.md)
- [Phase 2B RSVP Availability](./PHASE_2B_RSVP_AVAILABILITY.md)
- [Phase 2C Attendance Management](./PHASE_2C_ATTENDANCE_MANAGEMENT.md)
- [Phase 2D Notes Observations](./PHASE_2D_NOTES_OBSERVATIONS.md)
- [Phase 2E Follow-up Tasks](./PHASE_2E_FOLLOW_UP_TASKS.md)
- [Phase 2F Coach Action Dashboard](./PHASE_2F_COACH_ACTION_DASHBOARD.md)
- [Phase 3A Navigation UX Cleanup](./PHASE_3A_NAVIGATION_UX_CLEANUP.md)
- [Phase 4A Auth Integration Plan](./PHASE_4A_AUTH_INTEGRATION_PLAN.md)
- [Phase 4B Clerk Provider Setup](./PHASE_4B_CLERK_PROVIDER_SETUP.md)
- [Phase 4C UserAccount Person Linking](./PHASE_4C_USERACCOUNT_PERSON_LINKING.md)
- [Phase 4D Route Protection Auth Cleanup](./PHASE_4D_ROUTE_PROTECTION_AUTH_CLEANUP.md)
- [Phase 4E Basic Authorization](./PHASE_4E_BASIC_AUTHORIZATION.md)
- [Phase 4F Mock Auth Fallback Hardening](./PHASE_4F_MOCK_AUTH_FALLBACK_HARDENING.md)
- [Phase 5A MVP Pilot Test Plan](./PHASE_5A_MVP_PILOT_TEST_PLAN.md)
- [Phase 5B Bootstrap Org Admin](./PHASE_5B_BOOTSTRAP_ORG_ADMIN.md)
- [Phase 6B Entry / Inbox / Feed / Journal Plan](./PHASE_6B_ENTRY_INBOX_FEED_JOURNAL_PLAN.md)
- [Module Roadmap: FieldOps and GearOps](./MODULE_ROADMAP_FIELDOPS_GEAROPS.md)
- [Build Readiness Review](./BUILD_READINESS_REVIEW.md)
- [Chat Transcript](./CHAT_TRANSCRIPT.md)
- [**Product Decisions**](./PRODUCT_DECISIONS.md)

## Decision Log Summary
- Product name: **CadreOS**
- Product category: **Athlete Program Operating System**
- MVP focus: people/roles, teams/rosters, notes/inbox, communication routing, event scheduling, attendance, and task workflows
- Delivery shape: milestone-based roadmap with MVP-first issue seeding
- Role and access model: Person + RoleAssignment + Scope; guardian access is relationship-scoped only
- Parent/guardian model: Person-first, optional UserAccount linking; staff-only notes must not be exposed to guardians
- Entry/Inbox model: unified Entry is the long-term direction; default type is Task; default container is Inbox
- Communication routing: messaging surfaces are future-only; Entry routing by audience/visibility/type/role is the intended design
- FieldOps direction: pre-checks and recommendations before human approval; MVP starts with resource booking and conflict detection
- Pilot scope: whole organization; first validation is a one-day scripted scenario test; feedback categories are Bug, Friction, Missing Feature, Workflow Confusion, Decision Needed, Follow-up Task, Nice-to-Have
