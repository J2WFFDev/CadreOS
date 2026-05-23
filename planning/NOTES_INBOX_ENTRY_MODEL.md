# CadreOS Notes / Inbox / Entry Model (Planning)

## 1) Current State

Current implemented records:
- **Observation Notes**: staff observations with optional athlete/team/event links and staff-only visibility.
- **Follow-up Tasks**: actionable items with assignee, status, optional due date, optional source note/event/inbox item links.
- **Events**: scheduled activities with event lifecycle and optional note/task linkage.

Current routing layer:
- **InboxRoutingItem** exists as metadata routing/workflow support, not as a full unified content entry model.

Decisions not yet implemented:
- Unified capture model across note/task/event/decision.
- Decision-specific record type and lifecycle.
- Formal item conversion/migration UX across entry types.
- Consistent inbox-first behavior across all capture paths.

## 2) Target Concept

Target direction is a **unified capture inbox** with consistent triage behavior.

Entry types:
- Note
- Task
- Event
- Decision
- Optional Contact Note

Capture rule:
- Items start in **Inbox** by default unless created directly in a container context.

Container rule:
- Items can be moved/linked into **Person, Team, Program, Season, Event, or Organization** containers.

## 3) Entry Type Definitions

### Note
- **Purpose:** capture observations, context, and narrative facts.
- **Typical use case:** coach logs behavior/performance observation.
- **Status lifecycle:** active -> archived (optionally flagged for follow-up).
- **Linked entities:** person/team/program/season/event/org.
- **Conversion behavior:** can spawn Task, Event, or Decision while preserving source link.

### Task
- **Purpose:** assign accountable action with ownership and optional due date.
- **Typical use case:** follow up from note/event outcome.
- **Status lifecycle:** open -> in_progress -> done; with blocked/cancelled.
- **Linked entities:** assignee person plus related container(s) and optional source entry.
- **Conversion behavior:** can be generated from Note/Event/Decision; can resolve back into Decision log.

### Event
- **Purpose:** schedule time-bound activity.
- **Typical use case:** practice, meeting, travel activity.
- **Status lifecycle:** draft -> published -> completed -> archived (or cancelled if added later).
- **Linked entities:** program/team/season/event participants and optional source entry.
- **Conversion behavior:** can be created from Note/Task as scheduled action; completion can emit Note/Decision.

### Decision
- **Purpose:** record explicit determination and rationale.
- **Typical use case:** roster, policy, or operational decision needing audit trail.
- **Status lifecycle:** proposed -> decided -> superseded/archived.
- **Linked entities:** decision owner/approver plus impacted person/team/program/season/event/org.
- **Conversion behavior:** can be derived from Note/Task/Event context; can spawn follow-up Task(s).

### Optional Contact Note
- **Purpose:** log communication touchpoints with stakeholder context.
- **Typical use case:** parent/guardian outreach summary.
- **Status lifecycle:** active -> archived.
- **Linked entities:** person + optional team/program/event.
- **Conversion behavior:** can escalate to Task or Decision when action/policy impact appears.

## 4) Bullet Journal-Inspired Behavior

- **Rapid capture:** friction-light, quick add from mobile/desktop with minimal required fields.
- **Migrate:** unfinished items are re-triaged into new container/date/owner contexts.
- **Schedule:** date-bound items are promoted into calendar/event workflow.
- **Complete:** done state is explicit and timestamped.
- **Cancel:** non-actionable items are intentionally closed (not silently dropped).
- **Archive:** completed/cancelled items remain retrievable for institutional memory.

## 5) TickTick-Inspired Behavior

- **Inbox:** default landing zone for uncategorized capture.
- **List/container:** item can live within scoped containers (person/team/program/season/event/org).
- **Due date:** optional but first-class for task/time-bound follow-up.
- **Status:** visible lifecycle state drives queue filtering.
- **Priority/follow-up marker:** lightweight urgency marker for triage and dashboard surfacing.

## 6) Implementation Options Comparison

### Option A: Keep separate models + add inbox layer

Pros:
- Lower migration risk in near term.
- Reuses current ObservationNote, FollowUpTask, Event structures.
- Faster MVP-safe incremental rollout.

Cons:
- Ongoing mapping complexity across models.
- Harder to guarantee uniform lifecycle behavior.
- Conversion logic becomes scattered across feature boundaries.

### Option B: Introduce unified Entry model

Pros:
- Single capture and lifecycle abstraction.
- Cleaner cross-type conversion and inbox semantics.
- Better long-term extensibility for Decision and Contact Note.

Cons:
- Higher schema and migration complexity.
- Requires careful backfill of existing note/task/event records.
- Larger coordination risk if done too early.

## 7) Recommended Phased Path (No Code Changes Yet)

1. **Phase 1: Vocabulary and behavior alignment**
   - Lock shared lifecycle/state language for Note/Task/Event/Decision.
2. **Phase 2: Inbox-first UX contract on current models**
   - Define capture defaults, triage actions, and container movement rules without schema replacement.
3. **Phase 3: Decision entry pilot**
   - Introduce Decision behavior conceptually first (possibly backed by existing models/metadata initially).
4. **Phase 4: Option checkpoint**
   - Re-evaluate Option A vs B using real usage/volume and auth maturity.
5. **Phase 5: Structured migration plan (if Option B chosen)**
   - Design reversible migration, backfill strategy, and compatibility window before implementation.

## 8) Schema Risks and Migration Concerns

- Link integrity risk when converting between entry types with existing foreign keys.
- Status normalization risk across mismatched enums/lifecycles.
- Backfill ambiguity for historical records missing container/priority/due semantics.
- Audit continuity risk if source/derived relationships are not preserved.
- Query/index performance risk if a unified table becomes high-volume without planned indexing.
- Rollback risk if migration is not staged with dual-read/dual-write compatibility.

## 9) MVP-Safe Improvements to Current Notes (Before Large Refactor)

- Standardize note capture prompts/tags for clearer downstream triage.
- Add explicit follow-up marker on notes to improve conversion into tasks.
- Improve note list filters (container/date/author/follow-up-needed).
- Improve note detail linkage visibility to related task/event records.
- Clarify note status affordances (active vs archived) at UX level without schema overhaul.
- Tighten copy and workflow hints around inbox triage and migration behavior.
