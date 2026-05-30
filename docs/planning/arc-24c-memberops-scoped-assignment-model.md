# Arc 24C.1 — MemberOps Scoped Assignment Model Alignment

## 1) Current implementation summary
- **Person** is the canonical profile (`Person`) with independent `lifecycleStatus` (`PROSPECT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`, `ALUMNI`).
- **Role assignments** are stored in `RoleAssignment` with `roleType`, `scopeType` (`ORGANIZATION`, `PROGRAM`, `TEAM`), optional `programId`, optional `teamId`.
- **Roster participation** is stored in `RosterMembership` as `teamId + seasonId + personId + rosterRole`.
- **Guardian links** are stored pairwise in `AthleteGuardianRelationship` (`athletePersonId`, `guardianPersonId`, `relationshipType`).
- **Program/Team/Season** model already enforces: team belongs to one program; season belongs to one program.
- Current UI/workflows are split across:
  - `/people` and `/people/[personId]` (lifecycle, role assignment, guardian diagnostics, roster summary)
  - `/people/[personId]/move` (program/team/season roster move)
  - `/teams/[teamId]` (roster assignment and team-scoped role assignment)
  - `/programs/[programId]` and `/reports` (derived readiness/reporting views)
- Staff visibility and selectable scope are filtered via role scope resolution (`allowedProgramIds`, `allowedTeamIds`, org-wide override).

## 2) Intended MemberOps model
MemberOps should explicitly separate:
1. Person identity/profile  
2. Organization lifecycle status  
3. Program participation  
4. Team participation  
5. Season participation  
6. Scoped role assignments  
7. Guardian relationships  
8. Derived roster/member views  

Current schema mostly supports this separation, but UI/workflow coupling still mixes role and roster concepts and does not yet implement the intended scoped selection flow.

## 3) Role and scope rules
- Organization-scope role: Organization Admin / General Manager workflow only.
- Program Directors and Program Managers/Head Coaches should be program-scope roles.
- Team selection should create team-scope assignments.
- Program selection should create program-scope assignments.
- A person may hold multiple scoped roles across programs/teams.
- Volunteer remains reserved/undefined and should not drive current roster design.
- Specialty area roles (equipment/media/field/resource manager) are future area-scoped roles.

## 4) Athlete hard-block role rules
Athletes must be hard-blocked from elevated roles:
- Coach
- Program Manager
- Program Director
- Organization Admin

Current code does **not** enforce these hard blocks yet in role assignment routes.

## 5) Athlete specialty-role warning rules
Athletes may hold specialty roles only with warning/reminder behavior (not hard block), including:
- Equipment Manager
- Media Manager
- Field Manager
- Resource Manager

Current role enum/workflows do not yet model these role values.

## 6) Coach + Parent/Guardian allowed rule
Coach + Parent/Guardian combination is allowed.

Current model supports multiple assignments and does not block this combination.

## 7) Guardian-derived Team visibility rule
Guardian team visibility should be **derived from linked athlete memberships** and should not require duplicate manual team assignment to guardians.

Current code surfaces guardian relationships and readiness, but guardian team visibility derivation is not yet implemented as the assignment model rule.

## 8) Program/Team outline selection design
Target selection UX for assignment:
- Show filtered outline/tree:
  - Program
    - Team
    - Team
- Teams appear only under owning program.
- Allow one or more permitted Program/Team selections.
- Options are filtered by current admin scope.
- Selecting program row => program-scope assignment.
- Selecting team row => team-scope assignment.
- Season shown where participation is season-based, default current season when available.
- Role options filtered by selected scope.

Current UI uses separate dropdowns (program/team/season/role) rather than a unified outline/tree selector.

## 9) Desired views
Planned MemberOps views:
- All Members
- Prospects
- All Member Roles by Program
- All Member Roles by Team
- Program Staff by Program
- Alumni
- Archived

Current `/people`, `/programs`, `/teams`, `/reports` provide parts of these, but not a clean view set aligned to this model.

## 10) Gap list
1. **Role taxonomy gap**: `RoleType` lacks Program Manager, General Manager, and specialty roles listed by product model.
2. **Rule enforcement gap**: no hard-block for athlete + elevated roles.
3. **Warning policy gap**: no warning/reminder path for athlete + specialty roles.
4. **Scope-driven role picker gap**: role options are not filtered by selected scope in assignment flows.
5. **Outline selection gap**: no Program→Team tree selection interaction.
6. **Multi-selection gap**: flows are mostly single assignment per submit.
7. **Program/team participation clarity gap**: program participation is inferred from team/role, not represented as a first-class assignment flow concept.
8. **Guardian visibility derivation gap**: not yet implemented as explicit derived rule from athlete memberships.
9. **Duplicate athlete-in-program control gap**: current prevention is partial (some route checks), not a consistent model-wide warning/prevent policy.
10. **View alignment gap**: required roster/member views are not explicitly materialized as model-aligned views.

## 11) Recommended implementation phases
### Phase A — Model/rules alignment
- Finalize role catalog and scope mapping for current release.
- Add assignment validation policy layer for hard blocks, warnings, and scope-role compatibility.
- Keep tags/groups deferred.

### Phase B — Assignment workflow alignment
- Introduce scoped Program/Team outline selection component and backend contract.
- Apply admin-scope filtering consistently in option queries and mutation validation.
- Add season defaulting rules for season-based participation.

### Phase C — Derived visibility and views
- Implement guardian team visibility derivation from linked athletes.
- Add role-by-program, role-by-team, program-staff views aligned to scoped assignments.
- Keep Volunteer and area-scoped specialty permissions deferred where specified.

### Phase D — Validation hardening
- Add tests for hard-blocks, warnings, duplicate-athlete safeguards, and scope filtering.
- Add regression checks for lifecycle/roster/member derived views.

## 12) Specific UI changes needed
- Replace separate program/team assignment inputs with permission-filtered Program→Team outline/tree selector.
- Support multi-selection of allowed Program/Team combinations in assignment workflow.
- Scope-aware role picker:
  - Program row selected => show program-scope roles only.
  - Team row selected => show team-scope roles only.
  - Organization roles only in org-admin workflow.
- Add explicit warning UI for athlete specialty-role assignments.
- Add explicit blocking UI/messages for athlete elevated-role attempts.
- Add guardian-derived visibility indicator (derived from linked athlete memberships, not manual team assignment).

## 13) Specific schema changes needed (if any)
Likely required for Arc 24C.2+:
- Extend `RoleType` enum to include missing model roles (Program Manager, General Manager, specialty roles).
- Optionally add structured policy metadata for role behavior (hard-block, warning) if not encoded in service layer.
- No immediate need to redesign core entities (`Person`, `RoleAssignment`, `RosterMembership`, `AthleteGuardianRelationship`, `Program`, `Team`, `Season`, `UserAccount`) for this arc.

## 14) Validation tests for the next implementation arc
- **Policy tests**
  - Athlete cannot receive elevated roles (hard fail).
  - Athlete specialty-role assignment triggers warning path.
  - Coach + Parent/Guardian allowed.
- **Scope tests**
  - Admin sees only allowed Program/Team options.
  - Program selection creates program-scope assignment.
  - Team selection creates team-scope assignment.
- **Participation tests**
  - Multiple scoped roles across different programs/teams allowed.
  - Duplicate athlete team assignment within same program in same season warns or blocks per policy.
- **Guardian derivation tests**
  - Guardian team visibility derives from linked athlete memberships.
  - No duplicate manual guardian team assignment required.
- **View tests**
  - All Members, Prospects, Alumni, Archived filters.
  - Roles by Program/Team and Program Staff views reflect scoped assignments.

## 15) Risks and non-goals
### Risks
- Expanding role enum and policy rules can affect authorization assumptions across dashboards.
- Mixed current use of role assignments and roster roles may create migration/compatibility complexity.
- Guardian-derived visibility must avoid leaking cross-scope data.

### Non-goals (explicit)
- No assignment UI implementation in this arc.
- No tags/groups implementation in this arc (**deferred explicitly**).
- No full MemberOps redesign in this arc.
- No auth provider behavior changes.
- No EntryOps/GearOps/Journal/Habit/Dashboard/navigation behavior changes.
- No schema migration execution in this planning pass (only documenting future needs).
