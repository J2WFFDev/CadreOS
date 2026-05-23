# Phase 3A: Navigation, UX Cleanup, and Information Architecture

## Overview

Phase 3A improves the usability and consistency of the CadreOS application before adding more complex modules. The goal is to make the existing Phase 2F functionality easier to navigate and use — without introducing new data models, real authentication, or major new features.

## Why This Phase

After Phase 2F, the core workflows (People, Programs, Teams, Seasons, Rosters, Roles, Events, RSVP, Attendance, Notes, Follow-up Tasks) are functional but the app has no consistent shell navigation. Users moving between pages rely on browser navigation or memorizing URLs. Pages lack descriptions, and empty states do not guide users toward their first action.

Phase 3A addresses these usability gaps so the app is ready for day-to-day coach and operator use, and so future phases can build on a solid UX foundation.

## What Was Done

### 1. Sidebar Shell Navigation

- Added a persistent left sidebar to the dashboard layout (`app/(dashboard)/layout.tsx`).
- Sidebar includes links to: Dashboard, People, Programs, Teams, Events, Notes, Tasks.
- The active route is highlighted using `usePathname()` in a client component (`components/nav-sidebar.tsx`).
- The header logo links back to `/dashboard`.

### 2. Standardized Page Headers for List Pages

For all major list pages (`/people`, `/programs`, `/teams`, `/events`, `/notes`, `/tasks`):

- Added a short page description below the title.
- Moved the primary action button (e.g. "New event") to the top-right of the header area.
- Styled the primary action button consistently (dark background, white text).
- Removed the redundant "Organization: ..." label from the header row.

### 3. Breadcrumb Back Links for Detail Pages

For detail pages that were missing back links:

| Detail page | Back link added |
|---|---|
| Person detail | ← People |
| Program detail | ← Programs |
| Team detail | ← Teams · Program name (links to program) |
| Event detail | ← Events |
| Note detail | ← Notes (converted from button to breadcrumb) |
| Task detail | ← Tasks (converted from button to breadcrumb) |

### 4. Improved Empty States

For all list pages, the empty state now includes:

- A descriptive message explaining what is missing.
- A clearly visible call-to-action link pointing to the creation form.

Examples:
- No events → "No events have been scheduled yet." + "Schedule the first event"
- No tasks → "No follow-up tasks have been created yet." + "Create the first task"
- No notes → "No observation notes have been recorded yet." + "Record the first note"

### 5. Teams List — Program Links

The teams list now links each team card's program name to the corresponding program detail page.

### 6. Dashboard Improvements

- Updated page title from "Coach Action Dashboard" to "Dashboard" for conciseness.
- Updated the subtitle to "Operational overview for coaches and program operators."
- Renamed the "Navigation" section to "Quick links".
- Removed the redundant "Read-only operations" info box.

## Guardrails Followed

- No new Prisma schema changes.
- No new data models.
- No new major features.
- No authentication changes.
- No messaging, inventory, health records, AI, or analytics.
- Existing business logic and route handlers are unchanged.
- The seed script cannot be triggered automatically.

## Validation

```bash
npm run typecheck
npm run lint
DATABASE_URL=<connection-string> npx prisma validate
```

## Known Limitations

- The sidebar is hidden on mobile (below `md` breakpoint). A mobile nav hamburger menu is deferred to a future phase.
- The "Organization: ..." label has been removed from page headers; organization context is still available on the dashboard and within individual records.
- The `/dashboard` route is a separate path from `/`; the root route redirect behavior is unchanged from Phase 2F.

## Next Steps

Phase 3B or later phases can build on this foundation to add:
- Mobile-responsive navigation (hamburger menu).
- More detailed filtering or search within list pages.
- Notifications or activity feeds.
