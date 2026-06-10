# Arc UI.1 Collapsible Sidebar And Independent Scrolling Validation

## Scope

- Preserve the canonical CadreOS module taxonomy, routes, role visibility, and
  planned/disabled navigation items.
- Keep existing accessible collapsible sidebar sections and localStorage
  persistence.
- Make the desktop header stationary while the sidebar and main content use
  independent scroll regions.
- Preserve the current narrow/mobile menu and normal page scrolling behavior.

## Automated Validation

- Focused app-shell/sidebar and navigation tests: passed, 37/37.
- `npm run typecheck`: passed.
- `npm run build`: passed with the known Next.js middleware convention warning.
- `git diff --check`: passed.
- Local browser smoke check: attempted, but the keyless Clerk session rendered
  its authentication alert before the dashboard shell. Interactive
  desktop/mobile checks remain pending.

## Manual Validation Checklist

- NAV-UI-001: Sidebar sections collapse and expand.
- NAV-UI-002: Active route section auto-expands.
- NAV-UI-003: Active child link remains visually indicated.
- NAV-UI-004: Sidebar scrolls independently.
- NAV-UI-005: Main content scrolls independently.
- NAV-UI-006: Header remains stationary.
- NAV-UI-007: Role-based navigation still hides unauthorized links.
- NAV-UI-008: Planned/disabled items still display correctly.
- NAV-UI-009: Mobile/narrow layout remains usable.
- NAV-UI-010: Dashboard, MemberOps, EntryOps, and GearOps routes still load.
