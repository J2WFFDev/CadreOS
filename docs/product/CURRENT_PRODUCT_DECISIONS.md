# Current Product Decisions

This document captures the current active product decisions and is the source of truth for present product direction.

- Sidebar taxonomy uses **Home**, **MemberOps**, **EntryOps**, **FieldOps/ResourceOps**, **GearOps**, and **AdminOps**.
- **MemberOps** is the chosen name (not TeamOps or PeopleOps).
- **Programs** and **Seasons** belong under **MemberOps**.
- **EntryOps** is the current active module name for entries and remains feed/filter/context-first (not type-first).
- **SignalOps** is a possible future product-facing name candidate, but no rebrand is active yet.
- Final EntryOps/SignalOps naming decision is deferred to a later broader experience/rebrand arc.
- **FieldOps** and **ResourceOps** are conceptually separate, but current `/field-ops` routes still contain ResourceOps infrastructure.
- **GearOps** remains its own module.
- **AdminOps** should not contain Programs or Seasons.
- **Account/Profile** should move toward top-right header ownership.
- Build/release identity must be visible in screenshots.
- All Work Items is named **All Entries**. All Entries displays authorized
  Entries with their list/context placement; cross-user organization-admin
  oversight belongs there or in Admin views.
- Inbox and Quick Capture are actor-scoped. Quick Capture does not assign work
  to a Guardian-linked dependent Athlete.
- List/context placement is organization, visibility is sharing, and assignment
  is responsibility. Moving an Entry between Personal, Admin, Program, or Team
  contexts must not change visibility or assignment; Program/Team placement
  does not grant either.
- Creator is immutable system history shown as Created by; Assignee is
  responsibility; Journal Author is Journal-specific context; Owner remains a
  mostly internal record concept and owner transfer is not implemented.
- Guardian app visibility derives from active Guardian relationships and must
  not expose unrelated members. Guardian-linked Athlete Personal lists are
  grouped by Athlete and remain read-only Guardian context, but Journal access
  remains narrower: only Final/Done Guardian-visible dependent Journals are
  readable; Draft, Private, and staff-only Journals remain hidden.
- All Entries defaults to non-archived Entries and active Habit definitions.
  Archived Entries and inactive or archived Habits require an explicit status
  filter. Done/Final/completed is not archive. Archive preserves record
  identity, metadata, visibility, and relationships; restore returns a generic
  Entry to its recorded pre-archive workflow status when available. Entry
  creators may archive and restore their own Entries; existing elevated
  lifecycle permissions remain intact, while assignee-only access is not
  broadened. Habit definitions use the separate Habit model; check-ins/activity
  remain completion/history records unless explicitly modeled as Entries.
  Habit definitions do not currently have Entry Context/List or explicit
  visibility fields; the existing team link is an assignment field, not
  Program/Team Context/List placement or fan-out. Team recurring Habit
  assignment/fan-out, compliance dashboards, and advanced streak analytics
  remain future work. **My Habits** is the current created/assigned Habit
  management surface; **Habit Library** is reserved for a future predefined
  catalog. Athlete self-service Habit creation is self-only with no team
  assignment. Normal user-facing Habit lifecycle is Active, Paused, and
  Archived; `COMPLETED` remains legacy/internal, and progress/schedule signals
  are not lifecycle. Tracking units use controlled choices with Custom
  preservation.
  Additional Today redesign/integration remains future roadmap work.
